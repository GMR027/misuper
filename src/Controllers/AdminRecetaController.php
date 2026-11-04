<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Middleware\AdminMiddleware;
use App\Middleware\CsrfMiddleware;
use App\Services\RecetaService;
use App\Support\Response;
use InvalidArgumentException;

/**
 * CRUD de recetas para el panel Admin.
 */
final class AdminRecetaController
{
    private readonly RecetaService $recetas;

    public function __construct(?RecetaService $recetas = null)
    {
        $this->recetas = $recetas ?? new RecetaService();
    }

    /**
     * GET /admin/recetas
     */
    public function vista(): void
    {
        $usuario = AdminMiddleware::usuarioWeb();

        if ($usuario === null) {
            return;
        }

        header('Content-Type: text/html; charset=utf-8');
        require BASE_PATH . '/src/Views/admin/recetas/lista.php';
    }

    /**
     * GET /admin/recetas/nuevo y /admin/recetas/{id}
     */
    public function form(?int $id = null): void
    {
        $usuario = AdminMiddleware::usuarioWeb();

        if ($usuario === null) {
            return;
        }

        $receta = null;

        if ($id !== null) {
            $receta = $this->recetas->obtenerAdmin($id);

            if ($receta === null) {
                header('Location: /admin/recetas?error=no_encontrada', true, 302);

                return;
            }
        }

        $recetaId = $id;
        header('Content-Type: text/html; charset=utf-8');
        require BASE_PATH . '/src/Views/admin/recetas/form.php';
    }

    /**
     * GET /api/admin/recetas
     */
    public function index(): void
    {
        AdminMiddleware::require();

        Response::ok([
            'items' => $this->recetas->listadoAdmin(),
        ]);
    }

    /**
     * GET /api/admin/recetas/{id}
     */
    public function show(int $id): void
    {
        AdminMiddleware::require();
        $receta = $this->recetas->obtenerAdmin($id);

        if ($receta === null) {
            Response::fail('NOT_FOUND', 'Receta no encontrada.', 404);
        }

        Response::ok($receta);
    }

    /**
     * POST /api/admin/recetas
     */
    public function store(): void
    {
        $usuario = AdminMiddleware::require();
        CsrfMiddleware::enforce();

        try {
            $receta = $this->recetas->crearAdmin($this->jsonBody(), $usuario['id']);
        } catch (InvalidArgumentException $error) {
            Response::fail('VALIDATION_ERROR', $error->getMessage(), 422);
        }

        Response::ok($receta, 201);
    }

    /**
     * PUT /api/admin/recetas/{id}
     */
    public function update(int $id): void
    {
        AdminMiddleware::require();
        CsrfMiddleware::enforce();

        try {
            $receta = $this->recetas->actualizarAdmin($id, $this->jsonBody());
        } catch (InvalidArgumentException $error) {
            Response::fail('VALIDATION_ERROR', $error->getMessage(), 422);
        }

        if ($receta === null) {
            Response::fail('NOT_FOUND', 'Receta no encontrada.', 404);
        }

        Response::ok($receta);
    }

    /**
     * POST /api/admin/recetas/{id}/publicar
     */
    public function publicar(int $id): void
    {
        AdminMiddleware::require();
        CsrfMiddleware::enforce();

        $receta = $this->recetas->cambiarEstado($id, 'publicada');

        if ($receta === null) {
            Response::fail('NOT_FOUND', 'Receta no encontrada.', 404);
        }

        Response::ok($receta);
    }

    /**
     * DELETE /api/admin/recetas/{id}
     */
    public function destroy(int $id): void
    {
        AdminMiddleware::require();
        CsrfMiddleware::enforce();

        if (!$this->recetas->eliminarAdmin($id)) {
            Response::fail('NOT_FOUND', 'Receta no encontrada.', 404);
        }

        Response::ok(['deleted' => true]);
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
