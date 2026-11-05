<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Middleware\AuthMiddleware;
use App\Middleware\CsrfMiddleware;
use App\Services\MenuService;
use App\Support\Response;
use InvalidArgumentException;

/**
 * Menú semanal del usuario y generación de listas de compra.
 */
final class MenuController
{
    private readonly MenuService $menus;

    public function __construct(?MenuService $menus = null)
    {
        $this->menus = $menus ?? new MenuService();
    }

    /**
     * GET /menu
     */
    public function vista(): void
    {
        $usuario = AuthMiddleware::usuario();

        if ($usuario === null) {
            header('Location: /login', true, 302);

            return;
        }

        if (($usuario['debe_cambiar_password'] ?? false) === true) {
            header('Location: /cambiar-password-forzado', true, 302);

            return;
        }

        header('Content-Type: text/html; charset=utf-8');
        require BASE_PATH . '/src/Views/usuario/menu.php';
    }

    /**
     * GET /api/menu?semana=YYYY-MM-DD
     */
    public function show(): void
    {
        $usuario = AuthMiddleware::require();
        $semana = isset($_GET['semana']) && is_string($_GET['semana']) ? $_GET['semana'] : null;

        try {
            Response::ok($this->menus->obtener($usuario['id'], $semana));
        } catch (InvalidArgumentException $error) {
            Response::fail('VALIDATION_ERROR', $error->getMessage(), 422);
        }
    }

    /**
     * POST /api/menu/items
     */
    public function storeItem(): void
    {
        $usuario = AuthMiddleware::require();
        CsrfMiddleware::enforce();

        try {
            Response::ok($this->menus->agregar($usuario['id'], $this->jsonBody()), 201);
        } catch (InvalidArgumentException $error) {
            Response::fail('VALIDATION_ERROR', $error->getMessage(), 422);
        }
    }

    /**
     * PUT /api/menu/items/{id}
     */
    public function updateItem(int $id): void
    {
        $usuario = AuthMiddleware::require();
        CsrfMiddleware::enforce();

        try {
            $menu = $this->menus->actualizar($usuario['id'], $id, $this->jsonBody());
        } catch (InvalidArgumentException $error) {
            Response::fail('VALIDATION_ERROR', $error->getMessage(), 422);
        }

        if ($menu === null) {
            Response::fail('NOT_FOUND', 'Platillo del menú no encontrado.', 404);
        }

        Response::ok($menu);
    }

    /**
     * DELETE /api/menu/items/{id}
     */
    public function destroyItem(int $id): void
    {
        $usuario = AuthMiddleware::require();
        CsrfMiddleware::enforce();

        $menu = $this->menus->eliminar($usuario['id'], $id);

        if ($menu === null) {
            Response::fail('NOT_FOUND', 'Platillo del menú no encontrado.', 404);
        }

        Response::ok($menu);
    }

    /**
     * DELETE /api/menu?semana=YYYY-MM-DD&dia=1
     */
    public function clear(): void
    {
        $usuario = AuthMiddleware::require();
        CsrfMiddleware::enforce();
        $semana = isset($_GET['semana']) && is_string($_GET['semana']) ? $_GET['semana'] : null;
        $dia = isset($_GET['dia']) && $_GET['dia'] !== '' ? (int) $_GET['dia'] : null;

        try {
            Response::ok($this->menus->vaciar($usuario['id'], $semana, $dia));
        } catch (InvalidArgumentException $error) {
            Response::fail('VALIDATION_ERROR', $error->getMessage(), 422);
        }
    }

    /**
     * POST /api/menu/copiar
     */
    public function copiar(): void
    {
        $usuario = AuthMiddleware::require();
        CsrfMiddleware::enforce();

        try {
            Response::ok($this->menus->copiar($usuario['id'], $this->jsonBody()));
        } catch (InvalidArgumentException $error) {
            Response::fail('VALIDATION_ERROR', $error->getMessage(), 422);
        }
    }

    /**
     * POST /api/menu/lista/preview
     */
    public function previewLista(): void
    {
        $usuario = AuthMiddleware::require();
        CsrfMiddleware::enforce();
        $data = $this->jsonBody();
        $semana = isset($data['semana']) ? (string) $data['semana'] : null;
        $excluir = isset($data['excluir']) && is_array($data['excluir']) ? $data['excluir'] : [];

        try {
            Response::ok($this->menus->previewLista($usuario['id'], $semana, $excluir));
        } catch (InvalidArgumentException $error) {
            Response::fail('VALIDATION_ERROR', $error->getMessage(), 422);
        }
    }

    /**
     * POST /api/menu/lista
     */
    public function crearLista(): void
    {
        $usuario = AuthMiddleware::require();
        CsrfMiddleware::enforce();

        try {
            $lista = $this->menus->crearLista($usuario['id'], $this->jsonBody());
        } catch (InvalidArgumentException $error) {
            Response::fail('VALIDATION_ERROR', $error->getMessage(), 422);
        }

        if ($lista === null) {
            Response::fail('NOT_FOUND', 'Lista no encontrada.', 404);
        }

        Response::ok($lista, 201);
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
