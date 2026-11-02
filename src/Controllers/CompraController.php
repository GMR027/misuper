<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Middleware\AuthMiddleware;
use App\Middleware\CsrfMiddleware;
use App\Services\CompraService;
use App\Services\ProductoService;
use App\Support\Response;
use App\Validators\CompraValidator;

/**
 * Endpoints de compras, ítems y búsqueda para la pantalla rápida.
 */
final class CompraController
{
    private readonly CompraService $compras;

    public function __construct(?CompraService $compras = null)
    {
        $this->compras = $compras ?? new CompraService();
    }

    /**
     * GET /api/compras?page=
     */
    public function index(): void
    {
        $usuario = AuthMiddleware::require();
        $page = ProductoService::enteroPositivo($_GET['page'] ?? null) ?? 1;

        Response::ok($this->compras->listar($usuario['id'], $page));
    }

    /**
     * GET /api/compras/{id}
     */
    public function show(int $id): void
    {
        $usuario = AuthMiddleware::require();
        $compra = $this->compras->obtener($usuario['id'], $id);

        if ($compra === null) {
            Response::fail('NOT_FOUND', 'Compra no encontrada.', 404);
        }

        Response::ok($compra);
    }

    /**
     * POST /api/compras
     */
    public function store(): void
    {
        $usuario = AuthMiddleware::require();
        CsrfMiddleware::enforce();

        $data = $this->jsonBody();
        $errors = $this->compras->validarCreacion($data);

        if ($errors !== []) {
            Response::fail('VALIDATION_ERROR', 'Revisa los datos enviados.', 422, $errors);
        }

        Response::ok($this->compras->crear($usuario['id'], $data), 201);
    }

    /**
     * PUT /api/compras/{id}
     */
    public function update(int $id): void
    {
        $usuario = AuthMiddleware::require();
        CsrfMiddleware::enforce();

        $data = $this->jsonBody();
        $errors = CompraValidator::fecha($data);

        if ($errors !== []) {
            Response::fail('VALIDATION_ERROR', 'Revisa los datos enviados.', 422, $errors);
        }

        $compra = $this->compras->actualizarFecha($usuario['id'], $id, (string) $data['fecha']);

        if ($compra === null) {
            Response::fail('NOT_FOUND', 'Compra no encontrada.', 404);
        }

        Response::ok($compra);
    }

    /**
     * DELETE /api/compras/{id}
     */
    public function destroy(int $id): void
    {
        $usuario = AuthMiddleware::require();
        CsrfMiddleware::enforce();

        if (!$this->compras->eliminar($usuario['id'], $id)) {
            Response::fail('NOT_FOUND', 'Compra no encontrada.', 404);
        }

        Response::ok(['deleted' => true]);
    }

    /**
     * POST /api/compras/{id}/items
     */
    public function storeItem(int $compraId): void
    {
        $usuario = AuthMiddleware::require();
        CsrfMiddleware::enforce();

        $data = $this->jsonBody();
        $errors = $this->compras->validarItem($data);

        if ($errors !== []) {
            Response::fail('VALIDATION_ERROR', 'Revisa los datos enviados.', 422, $errors);
        }

        $item = $this->compras->agregarItem($usuario['id'], $compraId, $data);

        if ($item === null) {
            Response::fail('NOT_FOUND', 'Compra no encontrada.', 404);
        }

        Response::ok($item, 201);
    }

    /**
     * PUT /api/compras/{id}/items/{itemId}
     */
    public function updateItem(int $compraId, int $itemId): void
    {
        $usuario = AuthMiddleware::require();
        CsrfMiddleware::enforce();

        $data = $this->jsonBody();
        $errors = CompraValidator::itemParcial($data);

        if ($errors !== []) {
            Response::fail('VALIDATION_ERROR', 'Revisa los datos enviados.', 422, $errors);
        }

        $item = $this->compras->actualizarItem($usuario['id'], $compraId, $itemId, $data);

        if ($item === null) {
            Response::fail('NOT_FOUND', 'Compra o ítem no encontrado.', 404);
        }

        Response::ok($item);
    }

    /**
     * DELETE /api/compras/{id}/items/{itemId}
     */
    public function destroyItem(int $compraId, int $itemId): void
    {
        $usuario = AuthMiddleware::require();
        CsrfMiddleware::enforce();

        if (!$this->compras->eliminarItem($usuario['id'], $compraId, $itemId)) {
            Response::fail('NOT_FOUND', 'Compra o ítem no encontrado.', 404);
        }

        Response::ok(['deleted' => true]);
    }

    /**
     * GET /api/productos/frecuentes
     */
    public function frecuentes(): void
    {
        $usuario = AuthMiddleware::require();

        Response::ok($this->compras->frecuentes($usuario['id']));
    }

    /**
     * GET /api/productos/buscar?q=&categoria_id=
     */
    public function buscar(): void
    {
        $q = $_GET['q'] ?? '';
        $categoriaRaw = $_GET['categoria_id'] ?? null;

        if (!is_string($q)) {
            Response::fail('VALIDATION_ERROR', 'El término de búsqueda no es válido.', 422);
        }

        $q = trim($q);

        if (mb_strlen($q, 'UTF-8') > 100) {
            Response::fail(
                'VALIDATION_ERROR',
                'El término de búsqueda no puede superar 100 caracteres.',
                422
            );
        }

        $categoriaId = ProductoService::enteroPositivo($categoriaRaw);

        if ($categoriaRaw !== null && $categoriaId === null) {
            Response::fail('VALIDATION_ERROR', 'La categoría no es válida.', 422);
        }

        Response::ok($this->compras->buscarProductos($q, $categoriaId));
    }

    /**
     * Cuerpo JSON de la petición. 400 si el JSON es inválido.
     *
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
