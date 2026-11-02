<?php

declare(strict_types=1);

namespace App\Middleware;

use App\Support\Response;

/**
 * Token CSRF por sesión. Se exige en POST/PUT/PATCH/DELETE.
 */
final class CsrfMiddleware
{
    private const SESSION_KEY = 'csrf_token';

    private const METODOS_PROTEGIDOS = ['POST', 'PUT', 'PATCH', 'DELETE'];

    /**
     * Devuelve el token de la sesión, generándolo si no existe.
     */
    public static function token(): string
    {
        $token = $_SESSION[self::SESSION_KEY] ?? null;

        if (!is_string($token) || strlen($token) !== 64) {
            $token = bin2hex(random_bytes(32));
            $_SESSION[self::SESSION_KEY] = $token;
        }

        return $token;
    }

    /**
     * Verifica el token si el método actual está protegido.
     */
    public static function enforce(): void
    {
        $metodo = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));

        if (!in_array($metodo, self::METODOS_PROTEGIDOS, true)) {
            return;
        }

        self::verify();
    }

    /**
     * Valida el token recibido por header X-CSRF-Token o campo _csrf.
     */
    public static function verify(): void
    {
        $recibido = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? $_POST['_csrf'] ?? null;
        $esperado = $_SESSION[self::SESSION_KEY] ?? null;

        if (
            !is_string($recibido)
            || $recibido === ''
            || !is_string($esperado)
            || $esperado === ''
            || !hash_equals($esperado, $recibido)
        ) {
            Response::fail('CSRF_INVALID', 'Token CSRF inválido o ausente.', 403);
        }
    }
}
