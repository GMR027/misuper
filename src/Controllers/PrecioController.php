<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Middleware\AuthMiddleware;
use App\Middleware\CsrfMiddleware;
use App\Services\PrecioService;
use App\Support\Response;

/**
 * Panel y API de precios por usuario y costeo de listas.
 */
final class PrecioController
{
    private readonly PrecioService $precios;

    public function __construct(?PrecioService $precios = null)
    {
        $this->precios = $precios ?? new PrecioService();
    }

    /**
     * GET /costos
     */
    public function vista(): void
    {
        $usuario = AuthMiddleware::usuario();

        if ($usuario === null) {
            header('Location: /login', true, 302);

            return;
        }

        header('Content-Type: text/html; charset=utf-8');
        require BASE_PATH . '/src/Views/usuario/costos.php';
    }

    /**
     * GET /api/precios?q=&estado=
     */
    public function index(): void
    {
        $usuario = AuthMiddleware::require();
        $q = isset($_GET['q']) && is_string($_GET['q']) ? trim($_GET['q']) : '';
        $estado = isset($_GET['estado']) && is_string($_GET['estado'])
            ? $_GET['estado']
            : 'todos';

        if (!in_array($estado, ['todos', 'con-precio', 'sin-precio', 'viejos', 'manuales'], true)) {
            Response::fail('VALIDATION_ERROR', 'El filtro de precios no es válido.', 422);
        }

        if (mb_strlen($q, 'UTF-8') > 100) {
            Response::fail('VALIDATION_ERROR', 'La búsqueda no puede superar 100 caracteres.', 422);
        }

        $data = $this->precios->resumen($usuario['id'], $q, $estado);
        $data['comercios'] = $this->precios->comercios($usuario['id']);

        Response::ok($data);
    }

    /**
     * GET /api/precios/{productoId}
     */
    public function show(int $productoId): void
    {
        $usuario = AuthMiddleware::require();
        $data = $this->precios->producto($usuario['id'], $productoId);

        if ($data === null) {
            Response::fail('NOT_FOUND', 'Producto no encontrado.', 404);
        }

        Response::ok($data);
    }

    /**
     * POST /api/precios/{productoId}/manual
     */
    public function guardarManual(int $productoId): void
    {
        $usuario = AuthMiddleware::require();
        CsrfMiddleware::enforce();
        $data = $this->jsonBody();
        $precio = $this->precioValido($data['precio_unidad'] ?? null);

        if ($precio === null) {
            Response::fail(
                'VALIDATION_ERROR',
                'Escribe un precio por unidad válido.',
                422,
                ['precio_unidad' => 'El precio debe ser un número mayor o igual a 0, con hasta 4 decimales.']
            );
        }

        if ($this->precios->producto($usuario['id'], $productoId) === null) {
            Response::fail('NOT_FOUND', 'Producto no encontrado.', 404);
        }

        $this->precios->guardarManual($usuario['id'], $productoId, $precio);
        $detalle = $this->precios->producto($usuario['id'], $productoId);

        Response::ok($detalle ?? []);
    }

    /**
     * DELETE /api/precios/{productoId}/manual
     */
    public function eliminarManual(int $productoId): void
    {
        $usuario = AuthMiddleware::require();
        CsrfMiddleware::enforce();

        if ($this->precios->producto($usuario['id'], $productoId) === null) {
            Response::fail('NOT_FOUND', 'Producto no encontrado.', 404);
        }

        $this->precios->eliminarManual($usuario['id'], $productoId);
        $detalle = $this->precios->producto($usuario['id'], $productoId);

        Response::ok($detalle ?? []);
    }

    /**
     * GET /api/precios/comercios
     */
    public function comercios(): void
    {
        $usuario = AuthMiddleware::require();

        Response::ok(['items' => $this->precios->comercios($usuario['id'])]);
    }

    private function precioValido(mixed $valor): ?float
    {
        if (!is_int($valor) && !is_float($valor) && !is_string($valor)) {
            return null;
        }

        $texto = trim((string) $valor);

        if (
            $texto === ''
            || preg_match('/^\d{1,9}(?:\.\d{1,4})?$/', $texto) !== 1
        ) {
            return null;
        }

        $precio = (float) $texto;

        return $precio >= 0 ? $precio : null;
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
