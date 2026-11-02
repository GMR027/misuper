<?php

declare(strict_types=1);

namespace App\Middleware;

use App\Support\Response;

/**
 * Middleware de autorización para el panel de administración.
 */
final class AdminMiddleware
{
    /**
     * Exige sesión activa con rol 'admin'. 401 sin sesión, 403 sin rol.
     *
     * @return array{id: int, nombre: string, email: string, rol: string, debe_cambiar_password: bool}
     */
    public static function require(): array
    {
        $usuario = AuthMiddleware::usuario();

        if ($usuario === null) {
            Response::fail('UNAUTHENTICATED', 'Debes iniciar sesión.', 401);
        }

        if (!self::allows($usuario)) {
            Response::fail('FORBIDDEN', 'No tienes permisos para realizar esta acción.', 403);
        }

        return $usuario;
    }

    /**
     * @param array{rol?: string}|null $usuario
     */
    public static function allows(?array $usuario): bool
    {
        return ($usuario['rol'] ?? null) === 'admin';
    }
}
