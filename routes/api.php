<?php

declare(strict_types=1);

use App\Controllers\AdminCategoriaController;
use App\Controllers\AdminProductoController;
use App\Controllers\AdminRecetaController;
use App\Controllers\AdminUsuarioController;
use App\Controllers\AuthController;
use App\Controllers\ImportacionController;
use App\Controllers\CategoriaController;
use App\Controllers\CompraController;
use App\Controllers\ListaCompraController;
use App\Controllers\MeController;
use App\Controllers\MetricaController;
use App\Controllers\NotaController;
use App\Controllers\PrecioController;
use App\Controllers\ProductoController;
use App\Controllers\RecetaController;
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

            case 'GET /api/metricas/gasto-anual':
                (new MetricaController())->gastoAnual();

                return;

            case 'GET /api/metricas/top-productos':
                (new MetricaController())->topProductos();

                return;

            case 'GET /api/precios':
                (new PrecioController())->index();

                return;

            case 'GET /api/precios/comercios':
                (new PrecioController())->comercios();

                return;

            case 'GET /api/recetas':
                (new RecetaController())->index();

                return;

            case 'POST /api/recetas/imagen':
                (new RecetaController())->subirImagen();

                return;

            case 'POST /api/recetas/proponer':
                (new RecetaController())->storePropuesta();

                return;

            case 'POST /api/recetas/preview-lista':
                (new RecetaController())->previewLista();

                return;

            case 'POST /api/chef/lotes':
                (new ImportacionController())->guardarLote();

                return;

            case 'GET /api/listas-compra':
                (new ListaCompraController())->index();

                return;

            case 'POST /api/listas-compra':
                (new ListaCompraController())->store();

                return;

            case 'POST /api/lista-compras/consumir':
                (new ListaCompraController())->consumir();

                return;

            case 'GET /api/admin/recetas':
                (new AdminRecetaController())->index();

                return;

            case 'POST /api/admin/recetas':
                (new AdminRecetaController())->store();

                return;

            case 'GET /api/admin/tipos-recetas':
                (new AdminRecetaController())->tiposIndex();

                return;

            case 'POST /api/admin/tipos-recetas':
                (new AdminRecetaController())->tipoStore();

                return;

            case 'GET /api/admin/categorias-recetas':
                (new AdminRecetaController())->categoriasIndex();

                return;

            case 'POST /api/admin/categorias-recetas':
                (new AdminRecetaController())->categoriaStore();

                return;

            case 'POST /api/admin/recetas/imagen':
                (new AdminRecetaController())->subirImagen();

                return;

            case 'GET /api/admin/productos':
                (new AdminProductoController())->index();

                return;

            case 'POST /api/admin/productos':
                (new AdminProductoController())->store();

                return;

            case 'POST /api/admin/productos/verificar-fotos':
                (new AdminProductoController())->verificarFotos();

                return;

            case 'POST /api/admin/categorias':
                (new AdminCategoriaController())->store();

                return;

            case 'GET /api/admin/usuarios':
                (new AdminUsuarioController())->index();

                return;

            case 'POST /api/admin/usuarios':
                (new AdminUsuarioController())->store();

                return;
        }

        // Precio manual: /api/precios/{productoId}/manual
        if (preg_match('#^/api/precios/([1-9][0-9]*)/manual$#', $path, $matches) === 1) {
            $productoId = (int) $matches[1];

            if ($method === 'POST') {
                (new PrecioController())->guardarManual($productoId);

                return;
            }

            if ($method === 'DELETE') {
                (new PrecioController())->eliminarManual($productoId);

                return;
            }
        }

        // Producto con precio: /api/precios/{productoId}
        if (preg_match('#^/api/precios/([1-9][0-9]*)$#', $path, $matches) === 1) {
            if ($method === 'GET') {
                (new PrecioController())->show((int) $matches[1]);

                return;
            }
        }

        // Costo de lista: /api/listas-compra/{id}/costo
        if (preg_match('#^/api/listas-compra/([1-9][0-9]*)/costo$#', $path, $matches) === 1) {
            if ($method === 'GET') {
                (new ListaCompraController())->costo((int) $matches[1]);

                return;
            }
        }

        // Favoritos: /api/recetas/{slug}/favorito
        if (preg_match('#^/api/recetas/([a-z0-9-]+)/favorito$#', $path, $matches) === 1) {
            if ($method === 'POST') {
                (new RecetaController())->favorito((string) $matches[1]);

                return;
            }
        }

        // Rutas con identificador: /api/recetas/{slug}
        if (preg_match('#^/api/recetas/([a-z0-9-]+)$#', $path, $matches) === 1) {
            if ($method === 'GET') {
                (new RecetaController())->show((string) $matches[1]);

                return;
            }
        }

        // Rutas con identificador: /api/listas-compra/{id}
        if (preg_match('#^/api/listas-compra/([1-9][0-9]*)$#', $path, $matches) === 1) {
            $id = (int) $matches[1];

            if ($method === 'GET') {
                (new ListaCompraController())->show($id);

                return;
            }

            if ($method === 'PUT') {
                (new ListaCompraController())->update($id);

                return;
            }

            if ($method === 'DELETE') {
                (new ListaCompraController())->destroy($id);

                return;
            }
        }

        // Ítems de una lista: /api/listas-compra/{id}/items
        if (preg_match('#^/api/listas-compra/([1-9][0-9]*)/items$#', $path, $matches) === 1) {
            $id = (int) $matches[1];

            if ($method === 'POST') {
                (new ListaCompraController())->storeItems($id);

                return;
            }

            if ($method === 'DELETE') {
                (new ListaCompraController())->clear($id);

                return;
            }
        }

        // Enviar lista: /api/listas-compra/{id}/enviar
        if (preg_match('#^/api/listas-compra/([1-9][0-9]*)/enviar$#', $path, $matches) === 1) {
            if ($method === 'POST') {
                (new ListaCompraController())->enviar((int) $matches[1]);

                return;
            }
        }

        // Ítems individuales: /api/listas-compra/items/{itemId}
        if (preg_match('#^/api/listas-compra/items/([1-9][0-9]*)$#', $path, $matches) === 1) {
            $itemId = (int) $matches[1];

            if ($method === 'PUT') {
                (new ListaCompraController())->updateItem($itemId);

                return;
            }

            if ($method === 'DELETE') {
                (new ListaCompraController())->destroyItem($itemId);

                return;
            }
        }

        // Rutas con identificador: /api/admin/tipos-recetas/{id}
        if (preg_match('#^/api/admin/tipos-recetas/([1-9][0-9]*)$#', $path, $matches) === 1) {
            $id = (int) $matches[1];

            if ($method === 'PUT') {
                (new AdminRecetaController())->tipoUpdate($id);

                return;
            }

            if ($method === 'DELETE') {
                (new AdminRecetaController())->tipoDestroy($id);

                return;
            }
        }

        // Rutas con identificador: /api/admin/categorias-recetas/{id}
        if (preg_match('#^/api/admin/categorias-recetas/([1-9][0-9]*)$#', $path, $matches) === 1) {
            $id = (int) $matches[1];

            if ($method === 'PUT') {
                (new AdminRecetaController())->categoriaUpdate($id);

                return;
            }

            if ($method === 'DELETE') {
                (new AdminRecetaController())->categoriaDestroy($id);

                return;
            }
        }

        // Publicar receta: /api/admin/recetas/{id}/publicar
        if (preg_match('#^/api/admin/recetas/([1-9][0-9]*)/publicar$#', $path, $matches) === 1) {
            if ($method === 'POST') {
                (new AdminRecetaController())->publicar((int) $matches[1]);

                return;
            }
        }

        // Rutas con identificador: /api/admin/recetas/{id}
        if (preg_match('#^/api/admin/recetas/([1-9][0-9]*)$#', $path, $matches) === 1) {
            $id = (int) $matches[1];

            if ($method === 'GET') {
                (new AdminRecetaController())->show($id);

                return;
            }

            if ($method === 'PUT') {
                (new AdminRecetaController())->update($id);

                return;
            }

            if ($method === 'DELETE') {
                (new AdminRecetaController())->destroy($id);

                return;
            }
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

        // Reactivar producto inactivo: /api/admin/productos/{id}/activar
        if (preg_match('#^/api/admin/productos/([1-9][0-9]*)/activar$#', $path, $matches) === 1) {
            if ($method === 'POST') {
                (new AdminProductoController())->activar((int) $matches[1]);

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

        if (preg_match('#^/api/admin/lotes/([a-f0-9]{32})/(publicar|descartar)$#', $path, $matches) === 1) {
            if ($method === 'POST') {
                $controlador = new ImportacionController();

                if ($matches[2] === 'publicar') {
                    $controlador->publicarLote($matches[1]);
                } else {
                    $controlador->descartarLote($matches[1]);
                }

                return;
            }
        }

        if (preg_match('#^/api/admin/lotes/([a-f0-9]{32})/recetas/([1-9][0-9]*)$#', $path, $matches) === 1) {
            if ($method === 'DELETE') {
                (new ImportacionController())->quitarReceta($matches[1], (int) $matches[2]);

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
