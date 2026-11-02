<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Services\ProductoService;
use App\Support\Response;

/**
 * Endpoints públicos del catálogo. No requieren autenticación.
 */
final class ProductoController
{
    private readonly ProductoService $productos;

    public function __construct(?ProductoService $productos = null)
    {
        $this->productos = $productos ?? new ProductoService();
    }

    /**
     * GET /api/productos?q=&categoria_id=&page=
     */
    public function index(): void
    {
        $q = isset($_GET['q']) && is_string($_GET['q']) ? trim($_GET['q']) : '';
        $categoriaId = ProductoService::enteroPositivo($_GET['categoria_id'] ?? null);
        $page = ProductoService::enteroPositivo($_GET['page'] ?? null) ?? 1;

        Response::ok($this->productos->listarPublicos($q, $categoriaId, $page));
    }
}
