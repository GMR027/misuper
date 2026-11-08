<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Middleware\AuthMiddleware;
use App\Middleware\CsrfMiddleware;
use App\Services\ProductoService;
use App\Support\Response;

/**
 * Endpoints del catálogo. La consulta pública no exige autenticación; el alta
 * de productos propios sí, y los asocia al usuario de la sesión.
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

    /**
     * GET /api/productos/nutricion?ids=1,2,3
     */
    public function nutricion(): void
    {
        $raw = isset($_GET['ids']) && is_string($_GET['ids']) ? $_GET['ids'] : '';
        $ids = $raw === '' ? [] : explode(',', $raw);

        Response::ok($this->productos->nutricionPorIds($ids));
    }

    /**
     * POST /api/productos — alta de un producto propio del usuario.
     */
    public function store(): void
    {
        $usuario = AuthMiddleware::require();
        CsrfMiddleware::enforce();

        $data = $this->jsonBody();
        $errors = $this->productos->validarCreacion($data);

        if ($errors !== []) {
            Response::fail('VALIDATION_ERROR', 'Revisa los datos enviados.', 422, $errors);
        }

        $esAdmin = ($usuario['rol'] ?? '') === 'admin';

        // Un administrador da de alta productos del catálogo compartido desde
        // cualquier pantalla; el resto de usuarios solo crea productos propios.
        $producto = $esAdmin
            ? $this->productos->crear($data)
            : $this->productos->crearPersonal((int) $usuario['id'], $data);

        Response::ok($producto->toPublicArray(), 201);
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
