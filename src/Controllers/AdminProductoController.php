<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Middleware\AdminMiddleware;
use App\Middleware\CsrfMiddleware;
use App\Services\ProductoImagenService;
use App\Services\ProductoService;
use App\Support\Response;

/**
 * CRUD del catálogo para el panel Admin.
 *
 * Todos los métodos exigen rol 'admin'. Las mutaciones además exigen CSRF.
 */
final class AdminProductoController
{
    private readonly ProductoService $productos;

    public function __construct(?ProductoService $productos = null)
    {
        $this->productos = $productos ?? new ProductoService();
    }

    /**
     * GET /api/admin/productos?q=&categoria_id=&estado=&page=
     */
    public function index(): void
    {
        AdminMiddleware::require();

        $q = isset($_GET['q']) && is_string($_GET['q']) ? trim($_GET['q']) : '';
        $categoriaId = ProductoService::enteroPositivo($_GET['categoria_id'] ?? null);
        $estado = isset($_GET['estado']) && is_string($_GET['estado']) ? $_GET['estado'] : null;
        $imagen = isset($_GET['imagen']) && is_string($_GET['imagen']) ? $_GET['imagen'] : null;
        $page = ProductoService::enteroPositivo($_GET['page'] ?? null) ?? 1;

        Response::ok($this->productos->listarAdmin($q, $categoriaId, $estado, $page, $imagen));
    }

    /**
     * POST /api/admin/productos/verificar-fotos
     */
    public function verificarFotos(): void
    {
        AdminMiddleware::require();
        CsrfMiddleware::enforce();

        $resumen = (new ProductoImagenService())->verificarTodas();

        Response::ok($resumen);
    }

    /**
     * POST /api/admin/productos
     */
    public function store(): void
    {
        AdminMiddleware::require();
        CsrfMiddleware::enforce();

        $data = $this->jsonBody();
        $errors = $this->productos->validarCreacion($data);

        if ($errors !== []) {
            Response::fail('VALIDATION_ERROR', 'Revisa los datos enviados.', 422, $errors);
        }

        $producto = $this->productos->crear($data);

        Response::ok($producto->toAdminArray(), 201);
    }

    /**
     * PUT /api/admin/productos/{id}
     */
    public function update(int $id): void
    {
        AdminMiddleware::require();
        CsrfMiddleware::enforce();

        $data = $this->jsonBody();
        $errors = $this->productos->validarActualizacion($data);

        if ($errors !== []) {
            Response::fail('VALIDATION_ERROR', 'Revisa los datos enviados.', 422, $errors);
        }

        $producto = $this->productos->actualizar($id, $data);

        if ($producto === null) {
            Response::fail('NOT_FOUND', 'Producto no encontrado.', 404);
        }

        Response::ok($producto->toAdminArray());
    }

    /**
     * DELETE /api/admin/productos/{id} — soft delete idempotente.
     */
    public function destroy(int $id): void
    {
        AdminMiddleware::require();
        CsrfMiddleware::enforce();

        if (!$this->productos->desactivar($id)) {
            Response::fail('NOT_FOUND', 'Producto no encontrado.', 404);
        }

        Response::ok(['deleted' => true]);
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
