<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Middleware\AuthMiddleware;
use App\Middleware\RateLimitMiddleware;
use App\Services\ApiTokenService;
use App\Services\AuthService;
use App\Support\Response;
use App\Validators\AuthValidator;

/**
 * Sesión de la app Android: login, registro y logout con tokens Bearer.
 *
 * El login web (/api/auth/login) sigue usando sesión PHP y CSRF; estos
 * endpoints son los que consume la app nativa.
 */
final class MobileAuthController
{
    private readonly AuthService $auth;

    private readonly ApiTokenService $tokens;

    public function __construct(?AuthService $auth = null, ?ApiTokenService $tokens = null)
    {
        $this->auth = $auth ?? new AuthService();
        $this->tokens = $tokens ?? new ApiTokenService();
    }

    /**
     * POST /api/mobile/auth/login
     */
    public function login(): void
    {
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

        $this->responderSesion($usuario->toPublicArray(), $this->deviceName($data), 200);
    }

    /**
     * POST /api/mobile/auth/register
     */
    public function register(): void
    {
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

        $this->responderSesion($usuario->toPublicArray(), $this->deviceName($data), 201);
    }

    /**
     * POST /api/mobile/auth/logout
     */
    public function logout(): void
    {
        $token = AuthMiddleware::bearerToken();

        if ($token === null) {
            Response::fail('UNAUTHENTICATED', 'Debes iniciar sesión.', 401);
        }

        AuthMiddleware::require();
        $this->tokens->revocar($token);

        Response::ok(['message' => 'Sesión cerrada.']);
    }

    /**
     * @param array<string, mixed> $usuario
     */
    private function responderSesion(array $usuario, ?string $deviceName, int $status): never
    {
        $issued = $this->tokens->emitir((int) $usuario['id'], $deviceName);

        Response::ok([
            'token' => $issued['token'],
            'expires_at' => $issued['expires_at'],
            'usuario' => $usuario,
        ], $status);
    }

    /**
     * @param array<string, mixed> $data
     */
    private function deviceName(array $data): ?string
    {
        $device = $data['device_name'] ?? null;

        return is_string($device) ? $device : null;
    }

    /**
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
