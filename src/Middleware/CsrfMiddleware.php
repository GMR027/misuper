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
        // Un Bearer no es una credencial ambiental: el navegador no lo adjunta
        // solo, así que no hay ataque CSRF posible. La ruta protegida sigue
        // validando el token con AuthMiddleware::require().
        if (AuthMiddleware::usingToken()) {
            return;
        }

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

        // Sin token en sesión no hay sesión válida: se trata como sesión
        // expirada para que el cliente redirija al login en lugar de mostrar
        // un error de CSRF que el usuario no puede resolver.
        if (!is_string($esperado) || $esperado === '') {
            Response::fail('SESSION_EXPIRED', 'Tu sesión expiró. Inicia sesión de nuevo.', 401);
        }

        if (
            !is_string($recibido)
            || $recibido === ''
            || !hash_equals($esperado, $recibido)
        ) {
            Response::fail('CSRF_INVALID', 'Token CSRF inválido o ausente.', 403);
        }
    }
}
