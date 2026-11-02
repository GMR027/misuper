<?php

declare(strict_types=1);

namespace App\Support;

/**
 * Resuelve URLs de assets locales añadiendo su fecha de modificación.
 * Así el navegador y la CDN no reutilizan versiones antiguas tras un deploy.
 */
final class Asset
{
    public static function url(string $path): string
    {
        if (preg_match('#^(https?:)?//#i', $path) === 1 || $path === '') {
            return $path;
        }

        $clean = '/' . ltrim($path, '/');
        $file = BASE_PATH . '/public' . $clean;
        $version = is_file($file) ? filemtime($file) : false;

        if ($version === false) {
            return $clean;
        }

        $separator = strpos($clean, '?') === false ? '?' : '&';

        return $clean . $separator . 'v=' . $version;
    }
}
