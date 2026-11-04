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

    /**
     * Guard para vistas HTML del panel: redirige al login o responde 403.
     *
     * @return array{id: int, nombre: string, email: string, rol: string, debe_cambiar_password: bool}|null
     */
    public static function usuarioWeb(): ?array
    {
        $usuario = AuthMiddleware::usuario();

        if ($usuario === null) {
            header('Location: /login', true, 302);

            return null;
        }

        if (!self::allows($usuario)) {
            http_response_code(403);
            header('Content-Type: text/html; charset=utf-8');

            echo <<<'HTML'
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Acceso denegado</title>
</head>
<body>
    <main>
        <h1>403</h1>
        <p>No tienes permisos para acceder al panel de administración.</p>
        <p><a href="/">Volver al inicio</a></p>
    </main>
</body>
</html>
HTML;

            return null;
        }

        return $usuario;
    }
}
