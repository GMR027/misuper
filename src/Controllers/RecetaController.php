<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Middleware\AuthMiddleware;
use App\Middleware\CsrfMiddleware;
use App\Services\RecetaService;
use App\Support\Response;
use DomainException;
use InvalidArgumentException;

/**
 * Recetario público: listado, detalle y preview de lista de compras.
 */
final class RecetaController
{
    private readonly RecetaService $recetas;

    public function __construct(?RecetaService $recetas = null)
    {
        $this->recetas = $recetas ?? new RecetaService();
    }

    /**
     * GET /recetas
     */
    public function vista(): void
    {
        $usuario = $this->usuarioWeb();

        if ($usuario === null) {
            return;
        }

        header('Content-Type: text/html; charset=utf-8');
        require BASE_PATH . '/src/Views/usuario/recetas.php';
    }

    /**
     * GET /api/recetas
     */
    public function index(): void
    {
        $usuario = AuthMiddleware::require();

        Response::ok($this->recetas->listar($usuario['id'], [
            'q' => isset($_GET['q']) && is_string($_GET['q']) ? $_GET['q'] : '',
            'categoria' => isset($_GET['categoria']) && is_string($_GET['categoria']) ? $_GET['categoria'] : '',
            'tipo' => isset($_GET['tipo']) && is_string($_GET['tipo']) ? $_GET['tipo'] : '',
            'tiempo' => isset($_GET['tiempo']) && is_string($_GET['tiempo']) ? $_GET['tiempo'] : '',
            'solo_despensa' => isset($_GET['solo_despensa']) ? $_GET['solo_despensa'] : false,
            'favoritas' => isset($_GET['favoritas']) ? $_GET['favoritas'] : false,
        ]));
    }

    /**
     * GET /api/recetas/{slug}
     */
    public function show(string $slug): void
    {
        $usuario = AuthMiddleware::require();
        $receta = $this->recetas->detalle($usuario['id'], $slug);

        if ($receta === null) {
            Response::fail('NOT_FOUND', 'Receta no encontrada.', 404);
        }

        Response::ok($receta);
    }

    /**
     * POST /api/recetas/{slug}/favorito
     */
    public function favorito(string $slug): void
    {
        $usuario = AuthMiddleware::require();
        CsrfMiddleware::enforce();

        $favorita = $this->recetas->toggleFavorito($usuario['id'], $slug);

        if ($favorita === null) {
            Response::fail('NOT_FOUND', 'Receta no encontrada.', 404);
        }

        Response::ok(['favorita' => $favorita]);
    }

    /**
     * GET /recetas/proponer
     */
    public function propuesta(): void
    {
        $usuario = $this->usuarioWeb();

        if ($usuario === null) {
            return;
        }

        header('Content-Type: text/html; charset=utf-8');
        require BASE_PATH . '/src/Views/usuario/receta-propuesta.php';
    }

    /**
     * POST /api/recetas/imagen
     */
    public function subirImagen(): void
    {
        AuthMiddleware::require();
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
     * POST /api/recetas/proponer
     */
    public function storePropuesta(): void
    {
        $usuario = AuthMiddleware::require();
        CsrfMiddleware::enforce();

        try {
            $receta = $this->recetas->crearPropuesta($usuario['id'], $this->jsonBody());
        } catch (InvalidArgumentException $error) {
            Response::fail('VALIDATION_ERROR', $error->getMessage(), 422);
        }

        Response::ok([
            'id' => $receta['id'],
            'nombre' => $receta['nombre'],
            'estado' => $receta['estado'],
        ], 201);
    }

    /**
     * POST /api/recetas/preview-lista
     */
    public function previewLista(): void
    {
        $usuario = AuthMiddleware::require();
        CsrfMiddleware::enforce();

        $data = $this->jsonBody();
        $seleccion = $data['recetas'] ?? null;

        if (!is_array($seleccion) || $seleccion === []) {
            Response::fail('VALIDATION_ERROR', 'Selecciona al menos una receta.', 422, [
                'recetas' => 'Selecciona al menos una receta.',
            ]);
        }

        if (count($seleccion) > RecetaService::MAX_RECETAS_PREVIEW) {
            Response::fail('VALIDATION_ERROR', 'Puedes seleccionar hasta 20 recetas a la vez.', 422, [
                'recetas' => 'Máximo 20 recetas por lista.',
            ]);
        }

        try {
            Response::ok($this->recetas->previewLista($usuario['id'], $seleccion));
        } catch (InvalidArgumentException $error) {
            Response::fail('VALIDATION_ERROR', $error->getMessage(), 422);
        }
    }

    /**
     * @return array{id: int, nombre: string, email: string, rol: string, debe_cambiar_password: bool}|null
     */
    private function usuarioWeb(): ?array
    {
        $usuario = AuthMiddleware::usuario();

        if ($usuario === null) {
            header('Location: /login', true, 302);

            return null;
        }

        if (($usuario['debe_cambiar_password'] ?? false) === true) {
            header('Location: /cambiar-password-forzado', true, 302);

            return null;
        }

        return $usuario;
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
