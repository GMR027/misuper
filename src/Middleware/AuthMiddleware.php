<?php

declare(strict_types=1);

namespace App\Middleware;

use App\Services\ApiTokenService;
use App\Support\Response;

/**
 * Middleware de autenticación. Acepta dos formas:
 *
 * - `Authorization: Bearer <token>`: la app Android. El token se valida
 *   contra api_tokens y no depende de cookies ni de la sesión PHP.
 * - Sesión PHP: la web, como siempre.
 *
 * Si viene un Bearer inválido se responde 401; no se cae de vuelta a la
 * sesión, para que un token caducado no herede una sesión abierta.
 */
final class AuthMiddleware
{
    private static ?string $bearerToken = null;

    private static bool $bearerParsed = false;

    private static bool $tokenResolved = false;

    /** @var array{id: int, nombre: string, email: string, rol: string, debe_cambiar_password: bool, avatar_tipo: string|null, avatar_valor: string|null, avatar_emoji: string|null, avatar_label: string|null}|null */
    private static ?array $tokenUser = null;

    /**
     * El token Bearer de la petición, o null si no viene o no tiene el
     * formato esperado.
     */
    public static function bearerToken(): ?string
    {
        if (self::$bearerParsed) {
            return self::$bearerToken;
        }

        self::$bearerParsed = true;

        $header = $_SERVER['HTTP_AUTHORIZATION']
            ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION']
            ?? '';

        if (!is_string($header) || trim($header) === '') {
            $header = self::authorizationFromHeaders();
        }

        if (
            is_string($header)
            && preg_match('/^Bearer\s+([A-Fa-f0-9]{64})$/', trim($header), $matches) === 1
        ) {
            self::$bearerToken = strtolower($matches[1]);
        }

        return self::$bearerToken;
    }

    /** Si la petición se autentica con token y no con sesión. */
    public static function usingToken(): bool
    {
        return self::bearerToken() !== null;
    }

    /**
     * Devuelve el usuario autenticado o null. Con token se recarga desde la
     * BD para reflejar cambios de rol o cuentas eliminadas; con sesión hace
     * lo mismo que antes.
     *
     * @return array{id: int, nombre: string, email: string, rol: string, debe_cambiar_password: bool, avatar_tipo: string|null, avatar_valor: string|null, avatar_emoji: string|null, avatar_label: string|null}|null
     */
    public static function usuario(): ?array
    {
        if (self::usingToken()) {
            if (!self::$tokenResolved) {
                self::$tokenResolved = true;
                self::$tokenUser = (new ApiTokenService())->autenticar((string) self::$bearerToken);
            }

            return self::$tokenUser;
        }

        $id = $_SESSION['usuario_id'] ?? null;

        if (!is_int($id) && !(is_string($id) && ctype_digit($id))) {
            return null;
        }

        $usuario = (new \App\Repositories\UsuarioRepository())->findById((int) $id);

        if ($usuario === null) {
            unset($_SESSION['usuario_id'], $_SESSION['usuario_rol']);

            return null;
        }

        return $usuario->toPublicArray();
    }

    /**
     * Exige autenticación o responde 401.
     *
     * @return array{id: int, nombre: string, email: string, rol: string, debe_cambiar_password: bool, avatar_tipo: string|null, avatar_valor: string|null, avatar_emoji: string|null, avatar_label: string|null}
     */
    public static function require(): array
    {
        $usuario = self::usuario();

        if ($usuario === null) {
            Response::fail('UNAUTHENTICATED', 'Debes iniciar sesión.', 401);
        }

        return $usuario;
    }

    /**
     * Algunos servidores no exponen Authorization en $_SERVER; se busca en
     * las cabeceras que devuelve getallheaders().
     */
    private static function authorizationFromHeaders(): string
    {
        if (!function_exists('getallheaders')) {
            return '';
        }

        $headers = getallheaders();

        if (!is_array($headers)) {
            return '';
        }

        foreach ($headers as $name => $value) {
            if (strcasecmp((string) $name, 'Authorization') === 0 && is_string($value)) {
                return $value;
            }
        }

        return '';
    }
}
