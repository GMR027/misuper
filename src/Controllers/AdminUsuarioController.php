<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Middleware\AdminMiddleware;
use App\Middleware\CsrfMiddleware;
use App\Services\AdminUsuarioService;
use App\Support\Response;
use App\Validators\AdminUsuarioValidator;

/**
 * Gestión de usuarios desde el panel Admin.
 *
 * Expone listado, alta, edición, baja y reset manual de contraseña.
 * Todos los métodos exigen rol 'admin'; las mutaciones además exigen CSRF.
 */
final class AdminUsuarioController
{
    private readonly AdminUsuarioService $usuarios;

    public function __construct(?AdminUsuarioService $usuarios = null)
    {
        $this->usuarios = $usuarios ?? new AdminUsuarioService();
    }

    /**
     * GET /api/admin/usuarios?q=&page=
     */
    public function index(): void
    {
        AdminMiddleware::require();

        $params = AdminUsuarioValidator::listado($_GET);

        Response::ok($this->usuarios->listar($params['q'], $params['page']));
    }

    /**
     * POST /api/admin/usuarios
     */
    public function store(): void
    {
        AdminMiddleware::require();
        CsrfMiddleware::enforce();

        $data = $this->jsonBody();
        $errors = AdminUsuarioValidator::crear($data);

        if ($errors !== []) {
            Response::fail('VALIDATION_ERROR', 'Revisa los datos enviados.', 422, $errors);
        }

        $resultado = $this->usuarios->crear($data);

        if ($resultado['status'] === 'email_duplicado') {
            Response::fail(
                'EMAIL_DUPLICADO',
                'Ya existe una cuenta con ese email.',
                422,
                ['email' => 'Ya existe una cuenta con ese email.']
            );
        }

        Response::ok($resultado['usuario'], 201);
    }

    /**
     * PUT /api/admin/usuarios/{id}
     */
    public function update(int $id): void
    {
        $admin = AdminMiddleware::require();
        CsrfMiddleware::enforce();

        $data = $this->jsonBody();
        $errors = AdminUsuarioValidator::actualizar($data);

        if ($errors !== []) {
            Response::fail('VALIDATION_ERROR', 'Revisa los datos enviados.', 422, $errors);
        }

        $resultado = $this->usuarios->actualizar($id, $data, (int) $admin['id']);

        if ($resultado['status'] === 'not_found') {
            Response::fail('NOT_FOUND', 'Usuario no encontrado.', 404);
        }

        if ($resultado['status'] === 'email_duplicado') {
            Response::fail(
                'EMAIL_DUPLICADO',
                'Ya existe una cuenta con ese email.',
                422,
                ['email' => 'Ya existe una cuenta con ese email.']
            );
        }

        Response::ok($resultado['usuario']);
    }

    /**
     * DELETE /api/admin/usuarios/{id}
     *
     * Hard delete en cascada. El Admin no puede borrar su propia cuenta.
     */
    public function destroy(int $id): void
    {
        $admin = AdminMiddleware::require();
        CsrfMiddleware::enforce();

        $resultado = $this->usuarios->eliminar($id, (int) $admin['id']);

        if ($resultado['status'] === 'not_found') {
            Response::fail('NOT_FOUND', 'Usuario no encontrado.', 404);
        }

        if ($resultado['status'] === 'self') {
            Response::fail(
                'FORBIDDEN',
                'No puedes eliminar tu propia cuenta desde aquí. Usa /ajustes.',
                403
            );
        }

        Response::ok(['deleted' => true]);
    }

    /**
     * POST /api/admin/usuarios/{id}/reset-password
     *
     * La contraseña temporal se devuelve una única vez en la respuesta.
     */
    public function resetPassword(int $id): void
    {
        $admin = AdminMiddleware::require();
        CsrfMiddleware::enforce();

        $resultado = $this->usuarios->resetPassword($id, (int) $admin['id']);

        if ($resultado['status'] === 'not_found') {
            Response::fail('NOT_FOUND', 'Usuario no encontrado.', 404);
        }

        if ($resultado['status'] === 'self') {
            Response::fail(
                'FORBIDDEN',
                'No puedes resetear tu propia contraseña desde aquí. Usa /ajustes.',
                403
            );
        }

        Response::ok([
            'password_temporal' => $resultado['password_temporal'],
            'usuario_id' => $resultado['usuario_id'],
            'email' => $resultado['email'],
        ]);
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
}
