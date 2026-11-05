<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Middleware\AdminMiddleware;
use App\Middleware\CsrfMiddleware;
use App\Services\MenuIaService;
use App\Support\Response;
use InvalidArgumentException;

/**
 * Generación asistida del menú semanal. Solo administradores.
 *
 * El modelo se ejecuta en la app de escritorio; aquí solo se prepara el
 * prompt, se valida la respuesta y se guarda lo que el usuario apruebe.
 */
final class MenuIaController
{
    private readonly MenuIaService $ia;

    public function __construct(?MenuIaService $ia = null)
    {
        $this->ia = $ia ?? new MenuIaService();
    }

    /**
     * POST /api/menu/ia/preparar
     */
    public function preparar(): void
    {
        $usuario = AdminMiddleware::require();
        CsrfMiddleware::enforce();

        try {
            Response::ok($this->ia->preparar($usuario['id'], $this->jsonBody()));
        } catch (InvalidArgumentException $error) {
            Response::fail('VALIDATION_ERROR', $error->getMessage(), 422);
        }
    }

    /**
     * POST /api/menu/ia/validar
     */
    public function validar(): void
    {
        $usuario = AdminMiddleware::require();
        CsrfMiddleware::enforce();

        try {
            Response::ok($this->ia->validar($usuario['id'], $this->jsonBody()));
        } catch (InvalidArgumentException $error) {
            Response::fail('VALIDATION_ERROR', $error->getMessage(), 422);
        }
    }

    /**
     * POST /api/menu/ia/aplicar
     */
    public function aplicar(): void
    {
        $usuario = AdminMiddleware::require();
        CsrfMiddleware::enforce();

        try {
            Response::ok($this->ia->aplicar($usuario['id'], $this->jsonBody()));
        } catch (InvalidArgumentException $error) {
            Response::fail('VALIDATION_ERROR', $error->getMessage(), 422);
        }
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
