<?php

declare(strict_types=1);

namespace App\Middleware;

use App\Support\Response;

/**
 * Middleware de sesión. Las respuestas fallan en JSON con 401.
 */
final class AuthMiddleware
{
    /**
     * Devuelve el usuario autenticado o null. Recarga desde la BD para
     * reflejar cambios de rol o cuentas eliminadas.
     *
     * @return array{id: int, nombre: string, email: string, rol: string, debe_cambiar_password: bool}|null
     */
    public static function usuario(): ?array
    {
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
     * Exige sesión activa o responde 401.
     *
     * @return array{id: int, nombre: string, email: string, rol: string, debe_cambiar_password: bool}
     */
    public static function require(): array
    {
        $usuario = self::usuario();

        if ($usuario === null) {
            Response::fail('UNAUTHENTICATED', 'Debes iniciar sesión.', 401);
        }

        return $usuario;
    }
}
