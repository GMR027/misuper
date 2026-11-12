<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Middleware\AuthMiddleware;
use App\Middleware\CsrfMiddleware;
use App\Services\ProductoOmisionService;
use App\Support\Response;
use InvalidArgumentException;

/**
 * Productos que el usuario omite al comparar recetas con lo comprado.
 */
final class ProductoOmisionController
{
    private readonly ProductoOmisionService $omisiones;

    public function __construct(?ProductoOmisionService $omisiones = null)
    {
        $this->omisiones = $omisiones ?? new ProductoOmisionService();
    }

    /**
     * GET /productos-omision — pantalla web.
     */
    public function vista(): void
    {
        $usuario = $this->usuarioWeb();

        if ($usuario === null) {
            return;
        }

        header('Content-Type: text/html; charset=utf-8');
        require BASE_PATH . '/src/Views/usuario/productos-omision.php';
    }

    /**
     * GET /api/productos-omision
     */
    public function index(): void
    {
        $usuario = AuthMiddleware::require();

        Response::ok($this->omisiones->listar((int) $usuario['id']));
    }

    /**
     * POST /api/productos-omision
     */
    public function store(): void
    {
        $usuario = AuthMiddleware::require();
        CsrfMiddleware::enforce();

        $data = $this->jsonBody();

        try {
            $item = $this->omisiones->crear(
                (int) $usuario['id'],
                $data['nombre'] ?? null
            );
        } catch (InvalidArgumentException $error) {
            Response::fail('VALIDATION_ERROR', $error->getMessage(), 422);
        }

        Response::ok($item, 201);
    }

    /**
     * DELETE /api/productos-omision/{id}
     */
    public function destroy(int $id): void
    {
        $usuario = AuthMiddleware::require();
        CsrfMiddleware::enforce();

        if (!$this->omisiones->eliminar((int) $usuario['id'], $id)) {
            Response::fail('NOT_FOUND', 'Producto no encontrado.', 404);
        }

        Response::ok(['deleted' => true]);
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

    /**
     * @return array<string, mixed>|null
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
