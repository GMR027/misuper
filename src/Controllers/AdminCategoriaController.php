<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Middleware\AdminMiddleware;
use App\Middleware\CsrfMiddleware;
use App\Services\ProductoService;
use App\Support\Response;

/**
 * Alta de categorías desde el panel Admin.
 */
final class AdminCategoriaController
{
    private readonly ProductoService $productos;

    public function __construct(?ProductoService $productos = null)
    {
        $this->productos = $productos ?? new ProductoService();
    }

    /**
     * POST /api/admin/categorias
     */
    public function store(): void
    {
        AdminMiddleware::require();
        CsrfMiddleware::enforce();

        $data = $this->jsonBody();
        $resultado = $this->productos->crearCategoria($data['nombre'] ?? null);

        if ($resultado['status'] !== 'ok') {
            Response::fail(
                'VALIDATION_ERROR',
                'Revisa el nombre de la categoría.',
                422,
                $resultado['errors']
            );
        }

        Response::ok($resultado['categoria'], 201);
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
