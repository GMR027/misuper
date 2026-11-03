<?php

declare(strict_types=1);

use App\Controllers\AdminProductoController;
use App\Controllers\AdminUsuarioController;
use App\Controllers\AuthController;
use App\Controllers\CategoriaController;
use App\Controllers\CompraController;
use App\Controllers\MeController;
use App\Controllers\MetricaController;
use App\Controllers\NotaController;
use App\Controllers\ProductoController;
use App\Controllers\TicketController;
use App\Middleware\AdminMiddleware;
use App\Support\Response;

return static function (string $method, string $path): void {
    $method = $method === 'HEAD' ? 'GET' : $method;

    try {
        switch ($method . ' ' . $path) {
            case 'POST /api/auth/register':
                (new AuthController())->register();

                return;

            case 'POST /api/auth/login':
                (new AuthController())->login();

                return;

            case 'POST /api/auth/logout':
                (new AuthController())->logout();

                return;

            case 'GET /api/me':
                (new MeController())->show();

                return;

            case 'PUT /api/me':
                (new MeController())->update();

                return;

            case 'POST /api/me/avatar':
                (new MeController())->updateAvatar();

                return;

            case 'PUT /api/me/password':
                (new MeController())->updatePassword();

                return;

            case 'POST /api/me/password-forzado':
                (new MeController())->updatePasswordForzado();

                return;

            case 'DELETE /api/me':
                (new MeController())->destroy();

                return;

            case 'GET /api/categorias':
                (new CategoriaController())->index();

                return;

            case 'GET /api/productos':
                (new ProductoController())->index();

                return;

            case 'POST /api/productos':
                (new ProductoController())->store();

                return;

            case 'GET /api/productos/frecuentes':
                (new CompraController())->frecuentes();

                return;

            case 'GET /api/productos/buscar':
                (new CompraController())->buscar();

                return;

            case 'GET /api/compras':
                (new CompraController())->index();

                return;

            case 'GET /api/notas':
                (new NotaController())->index();

                return;

            case 'POST /api/notas':
                (new NotaController())->store();

                return;

            case 'POST /api/compras':
                (new CompraController())->store();

                return;

            case 'POST /api/tickets':
                (new TicketController())->store();

                return;

            case 'GET /api/metricas/gasto-mensual':
                (new MetricaController())->gastoMensual();

                return;

            case 'GET /api/metricas/top-productos':
                (new MetricaController())->topProductos();

                return;

            case 'GET /api/admin/productos':
                (new AdminProductoController())->index();

                return;

            case 'POST /api/admin/productos':
                (new AdminProductoController())->store();

                return;

            case 'GET /api/admin/usuarios':
                (new AdminUsuarioController())->index();

                return;

            case 'POST /api/admin/usuarios':
                (new AdminUsuarioController())->store();

                return;
        }

        // Rutas con identificador: /api/notas/{id}
        if (preg_match('#^/api/notas/([1-9][0-9]*)$#', $path, $matches) === 1) {
            $id = (int) $matches[1];

            if ($method === 'PUT') {
                (new NotaController())->update($id);

                return;
            }

            if ($method === 'DELETE') {
                (new NotaController())->destroy($id);

                return;
            }
        }

        // Rutas con identificador: /api/notas/{id}/fotos
        if (preg_match('#^/api/notas/([1-9][0-9]*)/fotos$#', $path, $matches) === 1) {
            if ($method === 'POST') {
                (new NotaController())->storeFoto((int) $matches[1]);

                return;
            }
        }

        // Rutas con identificador: /api/notas/{id}/fotos/{fotoId}
        if (
            preg_match(
                '#^/api/notas/([1-9][0-9]*)/fotos/([1-9][0-9]*)$#',
                $path,
                $matches
            ) === 1
        ) {
            if ($method === 'DELETE') {
                (new NotaController())->destroyFoto((int) $matches[1], (int) $matches[2]);

                return;
            }
        }

        // Rutas con identificador: /api/tickets/{id}
        if (preg_match('#^/api/tickets/([1-9][0-9]*)$#', $path, $matches) === 1) {
            if ($method === 'DELETE') {
                (new TicketController())->destroy((int) $matches[1]);

                return;
            }
        }

        // Rutas con identificador: /api/tickets/{id}/confirm
        if (preg_match('#^/api/tickets/([1-9][0-9]*)/confirm$#', $path, $matches) === 1) {
            if ($method === 'POST') {
                (new TicketController())->confirmar((int) $matches[1]);

                return;
            }
        }

        // Rutas con identificador: /api/compras/{id}
        if (preg_match('#^/api/compras/([1-9][0-9]*)$#', $path, $matches) === 1) {
            $id = (int) $matches[1];

            if ($method === 'GET') {
                (new CompraController())->show($id);

                return;
            }

            if ($method === 'PUT') {
                (new CompraController())->update($id);

                return;
            }

            if ($method === 'DELETE') {
                (new CompraController())->destroy($id);

                return;
            }
        }

        // Rutas con identificador: /api/compras/{id}/items
        if (preg_match('#^/api/compras/([1-9][0-9]*)/items$#', $path, $matches) === 1) {
            if ($method === 'POST') {
                (new CompraController())->storeItem((int) $matches[1]);

                return;
            }
        }

        // Rutas con identificador: /api/compras/{id}/items/{itemId}
        if (preg_match('#^/api/compras/([1-9][0-9]*)/items/([1-9][0-9]*)$#', $path, $matches) === 1) {
            $compraId = (int) $matches[1];
            $itemId = (int) $matches[2];

            if ($method === 'PUT') {
                (new CompraController())->updateItem($compraId, $itemId);

                return;
            }

            if ($method === 'DELETE') {
                (new CompraController())->destroyItem($compraId, $itemId);

                return;
            }
        }

        // Rutas con identificador: /api/admin/productos/{id}
        if (preg_match('#^/api/admin/productos/([1-9][0-9]*)$#', $path, $matches) === 1) {
            $id = (int) $matches[1];

            if ($method === 'PUT') {
                (new AdminProductoController())->update($id);

                return;
            }

            if ($method === 'DELETE') {
                (new AdminProductoController())->destroy($id);

                return;
            }

            AdminMiddleware::require();
            Response::fail('NOT_FOUND', 'Recurso no encontrado.', 404);
        }

        // Rutas con identificador: /api/admin/usuarios/{id}
        if (preg_match('#^/api/admin/usuarios/([1-9][0-9]*)$#', $path, $matches) === 1) {
            $id = (int) $matches[1];

            if ($method === 'PUT') {
                (new AdminUsuarioController())->update($id);

                return;
            }

            if ($method === 'DELETE') {
                (new AdminUsuarioController())->destroy($id);

                return;
            }

            AdminMiddleware::require();
            Response::fail('NOT_FOUND', 'Recurso no encontrado.', 404);
        }

        // Rutas con identificador: /api/admin/usuarios/{id}/reset-password
        if (
            preg_match(
                '#^/api/admin/usuarios/([1-9][0-9]*)/reset-password$#',
                $path,
                $matches
            ) === 1
        ) {
            if ($method === 'POST') {
                (new AdminUsuarioController())->resetPassword((int) $matches[1]);

                return;
            }
        }

        // Guarda del espacio de administración: todo /api/admin/* exige rol 'admin'.
        if (str_starts_with($path, '/api/admin/')) {
            AdminMiddleware::require();
            Response::fail('NOT_FOUND', 'Recurso no encontrado.', 404);
        }

        Response::fail('NOT_FOUND', 'Recurso no encontrado.', 404);
    } catch (Throwable $error) {
        error_log(sprintf(
            '[api] %s en %s:%d',
            $error->getMessage(),
            $error->getFile(),
            $error->getLine()
        ));

        Response::fail('SERVER_ERROR', 'Error interno del servidor.', 500);
    }
};
