<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Middleware\AuthMiddleware;
use App\Services\CompraService;

/**
 * Renderiza las pantallas web de historial y detalle de compra.
 *
 * No expone endpoints de API: las mutaciones se hacen contra los
 * endpoints de compras de la Fase 6.
 */
final class HistorialController
{
    private readonly CompraService $compras;

    public function __construct(?CompraService $compras = null)
    {
        $this->compras = $compras ?? new CompraService();
    }

    /**
     * GET /historial
     */
    public function index(): void
    {
        $usuario = $this->usuarioWeb();

        if ($usuario === null) {
            return;
        }

        $resultado = $this->compras->listar($usuario['id'], 1);
        $hayCompras = $resultado['total'] > 0;
        $totalCompras = $resultado['total'];

        header('Content-Type: text/html; charset=utf-8');
        require BASE_PATH . '/src/Views/usuario/historial.php';
    }

    /**
     * GET /historial/{id}
     */
    public function show(int $id): void
    {
        $usuario = $this->usuarioWeb();

        if ($usuario === null) {
            return;
        }

        $compra = $this->compras->obtener($usuario['id'], $id);

        if ($compra === null) {
            header('Location: /historial?error=no_encontrada', true, 302);

            return;
        }

        header('Content-Type: text/html; charset=utf-8');
        require BASE_PATH . '/src/Views/usuario/compra-detalle.php';
    }

    /**
     * Guard de sesión y cambio forzado de contraseña para vistas web.
     *
     * @return array{id: int, nombre: string, email: string, rol: string, debe_cambiar_password: bool}|null
     */
    private function usuarioWeb(): ?array
    {
        $usuario = AuthMiddleware::usuario();

        if ($usuario === null) {
            header('Location: /login', true, 302);

            return null;
        }

        if (($usuario['debe_cambiar_password'] ?? false) === true) {
            header('Location: /cambiar-password-forzado', true, 302);

            return null;
        }

        return $usuario;
    }
}
