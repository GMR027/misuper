<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Middleware\AuthMiddleware;
use App\Middleware\CsrfMiddleware;
use App\Services\SugerenciaService;
use App\Support\Response;

/**
 * Endpoint de sugerencias para el usuario autenticado.
 */
final class SugerenciaController
{
    private readonly SugerenciaService $sugerencias;

    public function __construct(?SugerenciaService $sugerencias = null)
    {
        $this->sugerencias = $sugerencias ?? new SugerenciaService();
    }

    /**
     * POST /api/sugerencias
     *
     * Idempotente por usuario y nombre normalizado: 201 si se crea,
     * 200 si ya existía una pendiente.
     */
    public function store(): void
    {
        $usuario = AuthMiddleware::require();
        CsrfMiddleware::enforce();

        $data = $this->jsonBody();
        $errors = $this->sugerencias->validarCreacion($data);

        if ($errors !== []) {
            Response::fail('VALIDATION_ERROR', 'Revisa los datos enviados.', 422, $errors);
        }

        $resultado = $this->sugerencias->registrar($usuario['id'], $data);

        Response::ok(
            $resultado['sugerencia']->toArray(),
            $resultado['creada'] ? 201 : 200
        );
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
