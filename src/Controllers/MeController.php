<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Middleware\AuthMiddleware;
use App\Middleware\CsrfMiddleware;
use App\Services\AccountService;
use App\Services\ApiTokenService;
use App\Services\AvatarService;
use App\Support\Response;
use App\Validators\AccountValidator;
use DomainException;

/**
 * Cuenta del usuario autenticado: consulta, perfil, contraseña y baja.
 */
final class MeController
{
    private readonly AccountService $account;
    private readonly AvatarService $avatars;

    public function __construct(?AccountService $account = null, ?AvatarService $avatars = null)
    {
        $this->account = $account ?? new AccountService();
        $this->avatars = $avatars ?? new AvatarService();
    }

    /**
     * GET /api/me — datos del usuario con sesión activa.
     */
    public function show(): void
    {
        Response::ok(AuthMiddleware::require());
    }

    /**
     * PUT /api/me — actualiza nombre y/o email.
     */
    public function update(): void
    {
        $usuario = AuthMiddleware::require();
        CsrfMiddleware::enforce();

        $data = $this->jsonBody();
        $errors = AccountValidator::perfil($data);

        if ($errors !== []) {
            Response::fail(
                'VALIDATION_ERROR',
                $errors['_general'] ?? 'Revisa los datos enviados.',
                422,
                $errors
            );
        }

        $actualizado = $this->account->actualizarPerfil($usuario['id'], $data);

        if ($actualizado === null) {
            Response::fail('EMAIL_TAKEN', 'El email ya está en uso.', 422);
        }

        Response::ok($actualizado->toPublicArray());
    }

    /**
     * POST /api/me/avatar — sube una foto o elige un avatar predefinido.
     */
    public function updateAvatar(): void
    {
        $usuario = AuthMiddleware::require();
        CsrfMiddleware::enforce();

        $tipo = isset($_POST['tipo']) && is_string($_POST['tipo']) ? $_POST['tipo'] : '';

        try {
            $actualizado = match ($tipo) {
                'preset' => $this->avatars->savePreset(
                    (int) $usuario['id'],
                    isset($_POST['avatar']) && is_string($_POST['avatar']) ? $_POST['avatar'] : ''
                ),
                'foto' => $this->avatars->savePhoto(
                    (int) $usuario['id'],
                    is_array($_FILES['foto'] ?? null) ? $_FILES['foto'] : []
                ),
                'none' => $this->avatars->remove((int) $usuario['id']),
                default => throw new DomainException('Tipo de avatar inválido.'),
            };
        } catch (DomainException $error) {
            Response::fail('AVATAR_INVALID', $error->getMessage(), 422);
        }

        Response::ok($actualizado->toPublicArray());
    }

    /**
     * PUT /api/me/password — cambio de contraseña con verificación de la actual.
     */
    public function updatePassword(): void
    {
        $usuario = AuthMiddleware::require();
        CsrfMiddleware::enforce();

        $data = $this->jsonBody();
        $errors = AccountValidator::password($data);

        if ($errors !== []) {
            Response::fail('VALIDATION_ERROR', 'Revisa los datos enviados.', 422, $errors);
        }

        $cambiada = $this->account->cambiarPassword(
            $usuario['id'],
            (string) $data['password_actual'],
            (string) $data['password_nueva'],
        );

        if (!$cambiada) {
            Response::fail('INVALID_PASSWORD', 'Contraseña actual incorrecta.', 422);
        }

        // Las demás sesiones dejan de valer; si el cambio viene de la app, su
        // token actual se conserva.
        (new ApiTokenService())->revocarTodos(
            (int) $usuario['id'],
            AuthMiddleware::bearerToken()
        );

        if (session_status() === PHP_SESSION_ACTIVE) {
            session_regenerate_id(true);
        }

        Response::ok(['message' => 'Contraseña actualizada.']);
    }

    /**
     * POST /api/me/password-forzado — cambio obligatorio tras el login.
     * Solo disponible mientras debe_cambiar_password sea true.
     */
    public function updatePasswordForzado(): void
    {
        $usuario = AuthMiddleware::require();
        CsrfMiddleware::enforce();

        if (($usuario['debe_cambiar_password'] ?? false) !== true) {
            Response::fail('FORBIDDEN', 'No hay un cambio de contraseña pendiente.', 403);
        }

        $data = $this->jsonBody();
        $errors = AccountValidator::passwordForzado($data);

        if ($errors !== []) {
            Response::fail('VALIDATION_ERROR', 'Revisa los datos enviados.', 422, $errors);
        }

        $this->account->cambiarPasswordForzado($usuario['id'], (string) $data['password_nueva']);

        // Se conserva el token con el que se hizo el cambio; los demás se
        // revocan.
        (new ApiTokenService())->revocarTodos(
            (int) $usuario['id'],
            AuthMiddleware::bearerToken()
        );

        if (session_status() === PHP_SESSION_ACTIVE) {
            session_regenerate_id(true);
        }

        Response::ok(['message' => 'Contraseña actualizada.']);
    }

    /**
     * DELETE /api/me — hard delete de la propia cuenta.
     */
    public function destroy(): void
    {
        $usuario = AuthMiddleware::require();
        CsrfMiddleware::enforce();

        $data = $this->jsonBody();

        if (($data['confirmacion'] ?? null) !== true) {
            Response::fail('VALIDATION_ERROR', 'Confirmación requerida.', 422);
        }

        $this->account->eliminarCuenta($usuario['id']);
        $this->destroySession();

        Response::ok(['deleted' => true]);
    }

    /**
     * Cuerpo JSON de la petición. 400 si el JSON es inválido.
     *
     * @return array<string, mixed>
     */
    private function jsonBody(): array
    {
        $raw = file_get_contents('php://input');

        if ($raw === false || $raw === '') {
            return [];
        }

        $data = json_decode($raw, true);

        if (!is_array($data)) {
            Response::fail('INVALID_JSON', 'El cuerpo de la petición no es JSON válido.', 400);
        }

        return $data;
    }

    /**
     * Invalida la sesión tras eliminar la cuenta.
     */
    private function destroySession(): void
    {
        if (session_status() !== PHP_SESSION_ACTIVE) {
            return;
        }

        session_regenerate_id(true);

        $_SESSION = [];

        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(
                session_name(),
                '',
                [
                    'expires' => time() - 42000,
                    'path' => $params['path'],
                    'domain' => $params['domain'],
                    'secure' => (bool) $params['secure'],
                    'httponly' => (bool) $params['httponly'],
                    'samesite' => $params['samesite'] ?: 'Lax',
                ]
            );
        }

        session_destroy();
    }
}
