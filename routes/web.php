<?php

declare(strict_types=1);

use App\Controllers\HistorialController;
use App\Controllers\MetricaController;
use App\Controllers\NotaController;
use App\Controllers\TicketController;
use App\Middleware\AdminMiddleware;
use App\Middleware\AuthMiddleware;
use App\Services\ProductoService;
use App\Support\Response;

return static function (string $method, string $path): void {
    $method = $method === 'HEAD' ? 'GET' : $method;

    /**
     * Guard server-side del panel Admin.
     * Sin sesión redirige a /login; con sesión sin rol admin responde 403.
     */
    $exigirAdmin = static function (): ?array {
        $usuario = AuthMiddleware::usuario();

        if ($usuario === null) {
            header('Location: /login', true, 302);

            return null;
        }

        if (!AdminMiddleware::allows($usuario)) {
            http_response_code(403);
            header('Content-Type: text/html; charset=utf-8');

            echo <<<'HTML'
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Acceso denegado</title>
</head>
<body>
    <main>
        <h1>403</h1>
        <p>No tienes permisos para acceder al panel de administración.</p>
        <p><a href="/">Volver al inicio</a></p>
    </main>
</body>
</html>
HTML;

            return null;
        }

        return $usuario;
    };

    switch ($method . ' ' . $path) {
        case 'GET /':
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
            require BASE_PATH . '/src/Views/usuario/pantalla-rapida.php';

            return;

        case 'GET /api/health':
            Response::ok(['status' => 'ok']);

            return;

        case 'GET /login':
            header('Content-Type: text/html; charset=utf-8');
            require BASE_PATH . '/src/Views/auth/login.php';

            return;

        case 'GET /registro':
            header('Content-Type: text/html; charset=utf-8');
            require BASE_PATH . '/src/Views/auth/registro.php';

            return;

        case 'GET /ajustes':
            if (AuthMiddleware::usuario() === null) {
                header('Location: /login', true, 302);

                return;
            }

            header('Content-Type: text/html; charset=utf-8');
            require BASE_PATH . '/src/Views/usuario/ajustes.php';

            return;

        case 'GET /cambiar-password-forzado':
            $usuario = AuthMiddleware::usuario();

            if ($usuario === null) {
                header('Location: /login', true, 302);

                return;
            }

            if (($usuario['debe_cambiar_password'] ?? false) !== true) {
                header('Location: /', true, 302);

                return;
            }

            header('Content-Type: text/html; charset=utf-8');
            require BASE_PATH . '/src/Views/usuario/cambiar-password-forzado.php';

            return;

        case 'GET /historial':
            (new HistorialController())->index();

            return;

        case 'GET /notas':
            (new NotaController())->vista();

            return;

        case 'GET /ticket':
            (new TicketController())->vista();

            return;

        case 'GET /metricas':
            (new MetricaController())->index();

            return;

        case 'GET /admin/productos':
            if ($exigirAdmin() === null) {
                return;
            }

            header('Content-Type: text/html; charset=utf-8');
            require BASE_PATH . '/src/Views/admin/productos/lista.php';

            return;

        case 'GET /admin/usuarios':
            if ($exigirAdmin() === null) {
                return;
            }

            header('Content-Type: text/html; charset=utf-8');
            require BASE_PATH . '/src/Views/admin/usuarios/lista.php';

            return;

        case 'GET /admin/productos/nuevo':
            if ($exigirAdmin() === null) {
                return;
            }

            $producto = null;

            header('Content-Type: text/html; charset=utf-8');
            require BASE_PATH . '/src/Views/admin/productos/form.php';

            return;
    }

    if (preg_match('#^/admin/productos/([1-9][0-9]*)$#', $path, $matches) === 1) {
        if ($method !== 'GET') {
            http_response_code(405);
            header('Allow: GET');
            header('Content-Type: text/plain; charset=utf-8');

            echo "Método no permitido.\n";

            return;
        }

        if ($exigirAdmin() === null) {
            return;
        }

        $producto = (new ProductoService())->obtenerParaAdmin((int) $matches[1]);

        if ($producto === null) {
            http_response_code(404);
            header('Content-Type: text/html; charset=utf-8');

            echo <<<'HTML'
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Producto no encontrado</title>
</head>
<body>
    <main>
        <h1>404</h1>
        <p>El producto que buscas no existe.</p>
        <p><a href="/admin/productos">Volver al catálogo</a></p>
    </main>
</body>
</html>
HTML;

            return;
        }

        header('Content-Type: text/html; charset=utf-8');
        require BASE_PATH . '/src/Views/admin/productos/form.php';

        return;
    }

    if (preg_match('#^/ticket/([1-9][0-9]*)/foto$#', $path, $matches) === 1) {
        if ($method !== 'GET') {
            http_response_code(405);
            header('Allow: GET');
            header('Content-Type: text/plain; charset=utf-8');

            echo "Método no permitido.\n";

            return;
        }

        (new TicketController())->foto((int) $matches[1]);

        return;
    }

    if (preg_match('#^/historial/([1-9][0-9]*)$#', $path, $matches) === 1) {
        if ($method !== 'GET') {
            http_response_code(405);
            header('Allow: GET');
            header('Content-Type: text/plain; charset=utf-8');

            echo "Método no permitido.\n";

            return;
        }

        (new HistorialController())->show((int) $matches[1]);

        return;
    }

    if (str_starts_with($path, '/api/')) {
        $dispatchApi = require BASE_PATH . '/routes/api.php';
        $dispatchApi($method, $path);

        return;
    }

    http_response_code(404);
    header('Content-Type: text/html; charset=utf-8');

    echo <<<'HTML'
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Página no encontrada</title>
</head>
<body>
    <main>
        <h1>404</h1>
        <p>La ruta que buscas no existe.</p>
        <p><a href="/">Volver al inicio</a></p>
    </main>
</body>
</html>
HTML;
};
