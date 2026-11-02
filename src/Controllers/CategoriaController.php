<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Services\ProductoService;
use App\Support\Response;

/**
 * Endpoint público de categorías fijas (solo lectura).
 */
final class CategoriaController
{
    private readonly ProductoService $productos;

    public function __construct(?ProductoService $productos = null)
    {
        $this->productos = $productos ?? new ProductoService();
    }

    /**
     * GET /api/categorias
     */
    public function index(): void
    {
        Response::ok($this->productos->categorias());
    }
}
