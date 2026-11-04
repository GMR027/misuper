<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Middleware\AuthMiddleware;
use App\Middleware\CsrfMiddleware;
use App\Services\ListaCompraService;
use App\Support\Response;
use InvalidArgumentException;

/**
 * CRUD de la lista "Productos por comprar" y puente hacia la pantalla rápida.
 */
final class ListaCompraController
{
    private readonly ListaCompraService $lista;

    public function __construct(?ListaCompraService $lista = null)
    {
        $this->lista = $lista ?? new ListaCompraService();
    }

    /**
     * GET /lista-compras
     */
    public function vista(): void
    {
        $usuario = $this->usuarioWeb();

        if ($usuario === null) {
            return;
        }

        header('Content-Type: text/html; charset=utf-8');
        require BASE_PATH . '/src/Views/usuario/lista-compras.php';
    }

    /**
     * GET /api/lista-compras
     */
    public function index(): void
    {
        $usuario = AuthMiddleware::require();
        $items = $this->lista->listar($usuario['id']);

        Response::ok([
            'items' => $items,
            'total' => count($items),
            'pendientes' => $this->lista->contarPendientes($usuario['id']),
        ]);
    }

    /**
     * POST /api/lista-compras
     */
    public function store(): void
    {
        $usuario = AuthMiddleware::require();
        CsrfMiddleware::enforce();

        try {
            $items = $this->lista->crear($usuario['id'], $this->jsonBody());
        } catch (InvalidArgumentException $error) {
            Response::fail('VALIDATION_ERROR', $error->getMessage(), 422);
        }

        Response::ok([
            'items' => $items,
            'total' => count($items),
            'pendientes' => $this->lista->contarPendientes($usuario['id']),
        ], 201);
    }

    /**
     * PUT /api/lista-compras/{id}
     */
    public function update(int $id): void
    {
        $usuario = AuthMiddleware::require();
        CsrfMiddleware::enforce();

        try {
            $item = $this->lista->actualizar($usuario['id'], $id, $this->jsonBody());
        } catch (InvalidArgumentException $error) {
            Response::fail('VALIDATION_ERROR', $error->getMessage(), 422);
        }

        if ($item === null) {
            Response::fail('NOT_FOUND', 'Producto de la lista no encontrado.', 404);
        }

        Response::ok($item);
    }

    /**
     * DELETE /api/lista-compras/{id}
     */
    public function destroy(int $id): void
    {
        $usuario = AuthMiddleware::require();
        CsrfMiddleware::enforce();

        if (!$this->lista->eliminar($usuario['id'], $id)) {
            Response::fail('NOT_FOUND', 'Producto de la lista no encontrado.', 404);
        }

        Response::ok(['deleted' => true]);
    }

    /**
     * DELETE /api/lista-compras
     */
    public function clear(): void
    {
        $usuario = AuthMiddleware::require();
        CsrfMiddleware::enforce();

        Response::ok(['deleted' => $this->lista->vaciar($usuario['id'])]);
    }

    /**
     * POST /api/lista-compras/enviar
     */
    public function enviar(): void
    {
        $usuario = AuthMiddleware::require();
        CsrfMiddleware::enforce();

        Response::ok([
            'enviados' => $this->lista->enviar($usuario['id']),
        ]);
    }

    /**
     * POST /api/lista-compras/consumir
     *
     * La pantalla rápida llama aquí al llegar con ?lista=1.
     */
    public function consumir(): void
    {
        $usuario = AuthMiddleware::require();
        CsrfMiddleware::enforce();

        Response::ok([
            'items' => $this->lista->consumir($usuario['id']),
        ]);
    }

    /**
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
