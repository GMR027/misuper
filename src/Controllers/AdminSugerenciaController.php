<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Middleware\AdminMiddleware;
use App\Middleware\CsrfMiddleware;
use App\Services\SugerenciaService;
use App\Support\Response;

/**
 * Bandeja de sugerencias del panel Admin.
 *
 * Lista agrupada por nombre_normalizado y resuelve grupos completos al
 * aprobar (crea producto) o ignorar.
 */
final class AdminSugerenciaController
{
    private readonly SugerenciaService $sugerencias;

    public function __construct(?SugerenciaService $sugerencias = null)
    {
        $this->sugerencias = $sugerencias ?? new SugerenciaService();
    }

    /**
     * GET /api/admin/sugerencias?estado=pendiente
     */
    public function index(): void
    {
        AdminMiddleware::require();

        $estado = isset($_GET['estado']) && is_string($_GET['estado'])
            ? $_GET['estado']
            : 'pendiente';

        if (!in_array($estado, SugerenciaService::ESTADOS, true)) {
            Response::fail('VALIDATION_ERROR', 'El estado no es válido.', 422);
        }

        Response::ok(['items' => $this->sugerencias->listarAgrupadas($estado)]);
    }

    /**
     * PUT /api/admin/sugerencias/{id}/aprobar
     */
    public function aprobar(int $id): void
    {
        AdminMiddleware::require();
        CsrfMiddleware::enforce();

        $data = $this->jsonBody();
        $errors = $this->sugerencias->validarAprobacion($data);

        if ($errors !== []) {
            Response::fail('VALIDATION_ERROR', 'Revisa los datos enviados.', 422, $errors);
        }

        $resultado = $this->sugerencias->aprobar($id, $data);

        if ($resultado['status'] === 'not_found') {
            Response::fail('NOT_FOUND', 'Sugerencia no encontrada.', 404);
        }

        if ($resultado['status'] === 'not_pending') {
            Response::fail('VALIDATION_ERROR', 'La sugerencia ya fue resuelta.', 422);
        }

        Response::ok([
            'producto_id' => $resultado['producto_id'],
            'nombre' => $resultado['nombre'],
            'sugerencias_resueltas' => $resultado['sugerencias_resueltas'],
        ]);
    }

    /**
     * PUT /api/admin/sugerencias/{id}/ignorar
     */
    public function ignorar(int $id): void
    {
        AdminMiddleware::require();
        CsrfMiddleware::enforce();

        $resultado = $this->sugerencias->ignorar($id);

        if ($resultado['status'] === 'not_found') {
            Response::fail('NOT_FOUND', 'Sugerencia no encontrada.', 404);
        }

        if ($resultado['status'] === 'not_pending') {
            Response::fail('VALIDATION_ERROR', 'La sugerencia ya fue resuelta.', 422);
        }

        Response::ok([
            'sugerencias_resueltas' => $resultado['sugerencias_resueltas'],
        ]);
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
