<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Middleware\AuthMiddleware;
use App\Middleware\CsrfMiddleware;
use App\Services\ListaCompraService;
use App\Support\Response;
use InvalidArgumentException;

/**
 * Varias listas de compras por usuario y puente hacia la pantalla rápida.
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
     * GET /api/listas-compra
     */
    public function index(): void
    {
        $usuario = AuthMiddleware::require();

        Response::ok([
            'items' => $this->lista->listas($usuario['id']),
            'pendientes' => $this->lista->contarPendientes($usuario['id']),
        ]);
    }

    /**
     * POST /api/listas-compra
     */
    public function store(): void
    {
        $usuario = AuthMiddleware::require();
        CsrfMiddleware::enforce();

        try {
            $lista = $this->lista->crearLista($usuario['id'], $this->jsonBody());
        } catch (InvalidArgumentException $error) {
            Response::fail('VALIDATION_ERROR', $error->getMessage(), 422);
        }

        Response::ok($lista, 201);
    }

    /**
     * PUT /api/listas-compra/{id}
     */
    public function update(int $id): void
    {
        $usuario = AuthMiddleware::require();
        CsrfMiddleware::enforce();

        try {
            $lista = $this->lista->renombrarLista($usuario['id'], $id, $this->jsonBody());
        } catch (InvalidArgumentException $error) {
            Response::fail('VALIDATION_ERROR', $error->getMessage(), 422);
        }

        if ($lista === null) {
            Response::fail('NOT_FOUND', 'Lista no encontrada.', 404);
        }

        Response::ok($lista);
    }

    /**
     * DELETE /api/listas-compra/{id}
     */
    public function destroy(int $id): void
    {
        $usuario = AuthMiddleware::require();
        CsrfMiddleware::enforce();

        if (!$this->lista->eliminarLista($usuario['id'], $id)) {
            Response::fail('NOT_FOUND', 'Lista no encontrada.', 404);
        }

        Response::ok(['deleted' => true]);
    }

    /**
     * GET /api/listas-compra/{id}/costo
     */
    public function costo(int $id): void
    {
        $usuario = AuthMiddleware::require();
        $costo = $this->lista->costoLista($usuario['id'], $id);

        if ($costo === null) {
            Response::fail('NOT_FOUND', 'Lista no encontrada.', 404);
        }

        Response::ok($costo);
    }

    /**
     * GET /api/listas-compra/{id}
     */
    public function show(int $id): void
    {
        $usuario = AuthMiddleware::require();
        $data = $this->lista->items($usuario['id'], $id);

        if ($data === null) {
            Response::fail('NOT_FOUND', 'Lista no encontrada.', 404);
        }

        Response::ok([
            'lista' => $data['lista'],
            'items' => $data['items'],
            'costo' => $data['costo'],
            'total' => count($data['items']),
        ]);
    }

    /**
     * POST /api/listas-compra/{id}/items
     */
    public function storeItems(int $id): void
    {
        $usuario = AuthMiddleware::require();
        CsrfMiddleware::enforce();

        try {
            $items = $this->lista->agregarItems($usuario['id'], $id, $this->jsonBody());
        } catch (InvalidArgumentException $error) {
            Response::fail('VALIDATION_ERROR', $error->getMessage(), 422);
        }

        if ($items === null) {
            Response::fail('NOT_FOUND', 'Lista no encontrada.', 404);
        }

        Response::ok([
            'items' => $items,
            'total' => count($items),
        ], 201);
    }

    /**
     * PUT /api/listas-compra/items/{itemId}
     */
    public function updateItem(int $itemId): void
    {
        $usuario = AuthMiddleware::require();
        CsrfMiddleware::enforce();

        try {
            $item = $this->lista->actualizarItem($usuario['id'], $itemId, $this->jsonBody());
        } catch (InvalidArgumentException $error) {
            Response::fail('VALIDATION_ERROR', $error->getMessage(), 422);
        }

        if ($item === null) {
            Response::fail('NOT_FOUND', 'Producto de la lista no encontrado.', 404);
        }

        Response::ok($item);
    }

    /**
     * DELETE /api/listas-compra/items/{itemId}
     */
    public function destroyItem(int $itemId): void
    {
        $usuario = AuthMiddleware::require();
        CsrfMiddleware::enforce();

        if (!$this->lista->eliminarItem($usuario['id'], $itemId)) {
            Response::fail('NOT_FOUND', 'Producto de la lista no encontrado.', 404);
        }

        Response::ok(['deleted' => true]);
    }

    /**
     * DELETE /api/listas-compra/{id}/items
     */
    public function clear(int $id): void
    {
        $usuario = AuthMiddleware::require();
        CsrfMiddleware::enforce();

        Response::ok(['deleted' => $this->lista->vaciarLista($usuario['id'], $id)]);
    }

    /**
     * POST /api/listas-compra/{id}/enviar
     */
    public function enviar(int $id): void
    {
        $usuario = AuthMiddleware::require();
        CsrfMiddleware::enforce();

        Response::ok([
            'enviados' => $this->lista->enviarLista($usuario['id'], $id),
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
            Response::fail('INVALID_JSON', 'El cuerpo de la petición no es válido.', 400);
        }

        return $data;
    }
}
