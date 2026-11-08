<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Support\Env;
use App\Support\Response;

/**
 * Información pública del instalable Android más reciente.
 *
 * El APK y `version.json` se generan con `pnpm mobile:publish` y viajan en la
 * imagen del backend; Apache los sirve como archivos estáticos.
 */
final class AppReleaseController
{
    /**
     * GET /api/app/version
     */
    public function show(): void
    {
        $archivo = BASE_PATH . '/public/descargas/version.json';

        if (!is_file($archivo)) {
            Response::fail(
                'NOT_FOUND',
                'Todavía no hay un instalable publicado.',
                404
            );
        }

        $datos = json_decode((string) file_get_contents($archivo), true);

        if (
            !is_array($datos)
            || !isset($datos['version'], $datos['version_code'])
        ) {
            Response::fail(
                'INVALID_RELEASE',
                'La información del instalable no es válida.',
                500
            );
        }

        $base = rtrim(
            Env::get('APP_URL', 'https://misuper.iguzman.com.mx'),
            '/'
        );
        $apk = (string) ($datos['apk'] ?? 'misuper.apk');
        $version = rawurlencode((string) $datos['version']);

        $datos['apk_url'] = $base . '/descargas/' . rawurlencode($apk)
            . '?v=' . $version;

        header('Cache-Control: no-store, max-age=0');

        Response::ok($datos);
    }
}
