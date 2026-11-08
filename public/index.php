<?php

declare(strict_types=1);

use App\Middleware\AuthMiddleware;
use App\Support\Env;

define('BASE_PATH', dirname(__DIR__));

require BASE_PATH . '/vendor/autoload.php';

Env::load(BASE_PATH . '/.env');

$app = require BASE_PATH . '/config/app.php';
$security = require BASE_PATH . '/config/security.php';

$isProduction = $app['env'] === 'production';

error_reporting(E_ALL);
ini_set('display_errors', $isProduction ? '0' : '1');
ini_set('log_errors', '1');

foreach ($security['headers'] as $name => $value) {
    header($name . ': ' . $value);
}

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$path = '/' . trim($path, '/');
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

session_name('misuper_session');

// La app Android usa Bearer y no necesita una sesión PHP en cada petición.
// Tampoco se abre una sesión para APIs públicas sin cookie: así no se crea un
// archivo de sesión por cada request del teléfono. La web y su login siguen
// usando la sesión de siempre.
$isApi = str_starts_with($path, '/api/');
$hasSessionCookie = isset($_COOKIE[session_name()]);
$needsSession = $hasSessionCookie || !$isApi;

if (AuthMiddleware::bearerToken() !== null) {
    $needsSession = false;
}

if ($needsSession) {
    session_set_cookie_params([
        'lifetime' => $app['session_lifetime'],
        'path' => '/',
        'domain' => '',
        'secure' => $isProduction && $security['session']['secure_in_production'],
        'httponly' => $security['session']['httponly'],
        'samesite' => $security['session']['samesite'],
    ]);
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    ini_set('session.gc_maxlifetime', (string) $app['session_lifetime']);

    session_start();
}

$dispatch = require BASE_PATH . '/routes/web.php';

$dispatch($method, $path);
