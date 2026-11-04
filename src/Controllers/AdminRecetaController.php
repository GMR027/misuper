<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Middleware\AdminMiddleware;
use App\Middleware\CsrfMiddleware;
use App\Services\CategoriaRecetaService;
use App\Services\RecetaService;
use App\Services\TipoRecetaService;
use App\Support\Response;
use DomainException;
use InvalidArgumentException;

/**
 * CRUD de recetas para el panel Admin.
 */
final class AdminRecetaController
{
    private readonly RecetaService $recetas;
    private readonly TipoRecetaService $tipos;
    private readonly CategoriaRecetaService $categorias;

    public function __construct(
        ?RecetaService $recetas = null,
        ?TipoRecetaService $tipos = null,
        ?CategoriaRecetaService $categorias = null
    ) {
        $this->recetas = $recetas ?? new RecetaService();
        $this->tipos = $tipos ?? new TipoRecetaService();
        $this->categorias = $categorias ?? new CategoriaRecetaService();
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
     * GET /admin/recetas/tipos
     */
    public function tiposVista(): void
    {
        $usuario = AdminMiddleware::usuarioWeb();

        if ($usuario === null) {
            return;
        }

        header('Content-Type: text/html; charset=utf-8');
        require BASE_PATH . '/src/Views/admin/recetas/tipos.php';
    }

    /**
     * GET /admin/recetas/categorias
     */
    public function categoriasVista(): void
    {
        $usuario = AdminMiddleware::usuarioWeb();

        if ($usuario === null) {
            return;
        }

        header('Content-Type: text/html; charset=utf-8');
        require BASE_PATH . '/src/Views/admin/recetas/categorias.php';
    }

    /**
     * GET /api/admin/categorias-recetas
     */
    public function categoriasIndex(): void
    {
        AdminMiddleware::require();

        Response::ok([
            'items' => $this->categorias->listar(),
        ]);
    }

    /**
     * POST /api/admin/categorias-recetas
     */
    public function categoriaStore(): void
    {
        AdminMiddleware::require();
        CsrfMiddleware::enforce();

        try {
            $categoria = $this->categorias->crear($this->jsonBody());
        } catch (InvalidArgumentException $error) {
            Response::fail('VALIDATION_ERROR', $error->getMessage(), 422);
        }

        Response::ok($categoria, 201);
    }

    /**
     * PUT /api/admin/categorias-recetas/{id}
     */
    public function categoriaUpdate(int $id): void
    {
        AdminMiddleware::require();
        CsrfMiddleware::enforce();

        try {
            $categoria = $this->categorias->actualizar($id, $this->jsonBody());
        } catch (InvalidArgumentException $error) {
            Response::fail('VALIDATION_ERROR', $error->getMessage(), 422);
        }

        if ($categoria === null) {
            Response::fail('NOT_FOUND', 'Categoría de receta no encontrada.', 404);
        }

        Response::ok($categoria);
    }

    /**
     * DELETE /api/admin/categorias-recetas/{id}
     */
    public function categoriaDestroy(int $id): void
    {
        AdminMiddleware::require();
        CsrfMiddleware::enforce();

        try {
            if (!$this->categorias->eliminar($id)) {
                Response::fail('NOT_FOUND', 'Categoría de receta no encontrada.', 404);
            }
        } catch (DomainException $error) {
            Response::fail('CATEGORIA_EN_USO', $error->getMessage(), 409);
        }

        Response::ok(['deleted' => true]);
    }

    /**
     * POST /api/admin/recetas/imagen
     */
    public function subirImagen(): void
    {
        AdminMiddleware::require();
        CsrfMiddleware::enforce();

        try {
            $url = $this->recetas->subirImagen(
                is_array($_FILES['imagen'] ?? null) ? $_FILES['imagen'] : []
            );
        } catch (DomainException $error) {
            Response::fail('IMAGEN_INVALIDA', $error->getMessage(), 422);
        }

        Response::ok(['imagen_url' => $url], 201);
    }

    /**
     * GET /api/admin/tipos-recetas
     */
    public function tiposIndex(): void
    {
        AdminMiddleware::require();

        Response::ok([
            'items' => $this->tipos->listar(),
        ]);
    }

    /**
     * POST /api/admin/tipos-recetas
     */
    public function tipoStore(): void
    {
        AdminMiddleware::require();
        CsrfMiddleware::enforce();

        try {
            $tipo = $this->tipos->crear($this->jsonBody());
        } catch (InvalidArgumentException $error) {
            Response::fail('VALIDATION_ERROR', $error->getMessage(), 422);
        }

        Response::ok($tipo, 201);
    }

    /**
     * PUT /api/admin/tipos-recetas/{id}
     */
    public function tipoUpdate(int $id): void
    {
        AdminMiddleware::require();
        CsrfMiddleware::enforce();

        try {
            $tipo = $this->tipos->actualizar($id, $this->jsonBody());
        } catch (InvalidArgumentException $error) {
            Response::fail('VALIDATION_ERROR', $error->getMessage(), 422);
        }

        if ($tipo === null) {
            Response::fail('NOT_FOUND', 'Tipo de receta no encontrado.', 404);
        }

        Response::ok($tipo);
    }

    /**
     * DELETE /api/admin/tipos-recetas/{id}
     */
    public function tipoDestroy(int $id): void
    {
        AdminMiddleware::require();
        CsrfMiddleware::enforce();

        try {
            if (!$this->tipos->eliminar($id)) {
                Response::fail('NOT_FOUND', 'Tipo de receta no encontrado.', 404);
            }
        } catch (DomainException $error) {
            Response::fail('TIPO_EN_USO', $error->getMessage(), 409);
        }

        Response::ok(['deleted' => true]);
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
