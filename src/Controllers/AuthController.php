<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Middleware\CsrfMiddleware;
use App\Middleware\RateLimitMiddleware;
use App\Services\AuthService;
use App\Support\Response;
use App\Validators\AuthValidator;

/**
 * Endpoints de registro, login y logout.
 */
final class AuthController
{
    private readonly AuthService $auth;

    public function __construct(?AuthService $auth = null)
    {
        $this->auth = $auth ?? new AuthService();
    }

    public function register(): void
    {
        CsrfMiddleware::enforce();

        $data = $this->jsonBody();

        $errors = AuthValidator::registro($data);

        if ($errors !== []) {
            Response::fail('VALIDATION_ERROR', 'Revisa los datos enviados.', 422, $errors);
        }

        $ip = RateLimitMiddleware::clientIp();
        $retryAfter = RateLimitMiddleware::registrationRetryAfter($ip);

        if ($retryAfter !== null) {
            header('Retry-After: ' . $retryAfter);
            Response::fail('RATE_LIMITED', 'Demasiados registros. Inténtalo más tarde.', 429);
        }

        $usuario = $this->auth->register(
            (string) $data['nombre'],
            AuthValidator::normalizarEmail((string) $data['email']),
            (string) $data['password'],
        );

        if ($usuario === null) {
            Response::fail('EMAIL_TAKEN', 'El email ya está registrado.', 422);
        }

        RateLimitMiddleware::recordRegistration($ip);

        Response::ok($usuario->toPublicArray(), 201);
    }

    public function login(): void
    {
        CsrfMiddleware::enforce();

        $data = $this->jsonBody();

        $errors = AuthValidator::login($data);

        if ($errors !== []) {
            Response::fail('VALIDATION_ERROR', 'Revisa los datos enviados.', 422, $errors);
        }

        $ip = RateLimitMiddleware::clientIp();
        $email = AuthValidator::normalizarEmail((string) $data['email']);

        $retryAfter = RateLimitMiddleware::loginRetryAfter($ip, $email);

        if ($retryAfter !== null) {
            header('Retry-After: ' . $retryAfter);
            Response::fail('RATE_LIMITED', 'Demasiados intentos fallidos. Inténtalo más tarde.', 429);
        }

        $usuario = $this->auth->login($email, (string) $data['password']);

        if ($usuario === null) {
            RateLimitMiddleware::recordFailedLogin($ip, $email);
            Response::fail('INVALID_CREDENTIALS', 'Credenciales inválidas.', 401);
        }

        RateLimitMiddleware::clearLoginAttempts($ip, $email);

        session_regenerate_id(true);
        $_SESSION['usuario_id'] = $usuario->id;
        $_SESSION['usuario_rol'] = $usuario->rol;

        Response::ok($usuario->toPublicArray());
    }

    public function logout(): void
    {
        CsrfMiddleware::enforce();

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

        Response::ok(['message' => 'Sesión cerrada.']);
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
