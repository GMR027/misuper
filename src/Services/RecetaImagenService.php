<?php

declare(strict_types=1);

namespace App\Services;

use DomainException;

/**
 * Guarda las portadas subidas desde el formulario de recetas.
 *
 * Las imágenes se re-codifican a JPEG para normalizar formato y eliminar
 * metadatos. Las 100 portadas iniciales viven en /assets/img/recetas y no
 * pasan por aquí.
 */
final class RecetaImagenService
{
    private const MAX_BYTES = 5 * 1024 * 1024;
    private const MAX_SIDE = 6000;
    private const MAX_OUTPUT = 1600;
    private const UPLOAD_DIR = '/public/uploads/recetas';
    private const UPLOAD_URL = '/uploads/recetas';

    /**
     * @param array<string, mixed> $file Entrada de $_FILES['imagen'].
     */
    public function guardar(array $file): string
    {
        $error = (int) ($file['error'] ?? UPLOAD_ERR_NO_FILE);

        if ($error === UPLOAD_ERR_NO_FILE) {
            throw new DomainException('Selecciona una imagen para la portada.');
        }

        if (in_array($error, [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true)) {
            throw new DomainException('La imagen supera el tamaño máximo de 5 MB.');
        }

        if ($error !== UPLOAD_ERR_OK) {
            throw new DomainException('No se pudo recibir la imagen. Inténtalo de nuevo.');
        }

        $tmp = $file['tmp_name'] ?? null;

        if (!is_string($tmp) || $tmp === '' || !is_uploaded_file($tmp)) {
            throw new DomainException('No se pudo recibir la imagen. Inténtalo de nuevo.');
        }

        $size = (int) ($file['size'] ?? 0);

        if ($size <= 0 || $size > self::MAX_BYTES) {
            throw new DomainException('La imagen supera el tamaño máximo de 5 MB.');
        }

        $mime = $this->detectarMime($tmp);

        if (!in_array($mime, ['image/jpeg', 'image/png', 'image/webp'], true)) {
            throw new DomainException('Formato no permitido. Usa una imagen JPG, PNG o WebP.');
        }

        $dimensiones = @getimagesize($tmp);

        if ($dimensiones === false) {
            throw new DomainException('El archivo no parece una imagen válida.');
        }

        if ($dimensiones[0] > self::MAX_SIDE || $dimensiones[1] > self::MAX_SIDE) {
            throw new DomainException('La imagen es demasiado grande. Máximo 6000 px por lado.');
        }

        $contenido = file_get_contents($tmp);

        if ($contenido === false) {
            throw new DomainException('No se pudo leer la imagen.');
        }

        $origen = @imagecreatefromstring($contenido);

        if ($origen === false) {
            throw new DomainException('El archivo no parece una imagen válida.');
        }

        $ancho = imagesx($origen);
        $alto = imagesy($origen);
        $escala = min(1.0, self::MAX_OUTPUT / max(1, $ancho, $alto));
        $nuevoAncho = max(1, (int) round($ancho * $escala));
        $nuevoAlto = max(1, (int) round($alto * $escala));

        $lienzo = imagecreatetruecolor($nuevoAncho, $nuevoAlto);

        if ($lienzo === false) {
            imagedestroy($origen);

            throw new DomainException('No se pudo procesar la imagen.');
        }

        $blanco = imagecolorallocate($lienzo, 255, 255, 255);
        imagefill($lienzo, 0, 0, $blanco);
        imagecopyresampled(
            $lienzo,
            $origen,
            0,
            0,
            0,
            0,
            $nuevoAncho,
            $nuevoAlto,
            $ancho,
            $alto
        );
        imagedestroy($origen);

        $directorio = $this->basePath() . self::UPLOAD_DIR;

        if (!is_dir($directorio) && !mkdir($directorio, 0775, true) && !is_dir($directorio)) {
            imagedestroy($lienzo);

            throw new DomainException('No se pudo preparar la carpeta de imágenes.');
        }

        $nombre = 'r' . bin2hex(random_bytes(10)) . '.jpg';
        $destino = $directorio . '/' . $nombre;

        if (!imagejpeg($lienzo, $destino, 85)) {
            imagedestroy($lienzo);

            throw new DomainException('No se pudo guardar la imagen.');
        }

        imagedestroy($lienzo);

        return self::UPLOAD_URL . '/' . $nombre;
    }

    /**
     * Borra una portada subida (solo dentro de /uploads/recetas).
     */
    public function eliminar(?string $url): void
    {
        if ($url === null || !str_starts_with($url, self::UPLOAD_URL . '/')) {
            return;
        }

        $nombre = basename($url);

        if ($nombre === '' || $nombre === '.' || $nombre === '..') {
            return;
        }

        $ruta = $this->basePath() . self::UPLOAD_DIR . '/' . $nombre;

        if (is_file($ruta)) {
            @unlink($ruta);
        }
    }

    private function detectarMime(string $tmp): string
    {
        $finfo = finfo_open(FILEINFO_MIME_TYPE);

        if ($finfo === false) {
            return '';
        }

        $mime = finfo_file($finfo, $tmp);
        finfo_close($finfo);

        return is_string($mime) ? strtolower($mime) : '';
    }

    private function basePath(): string
    {
        if (defined('BASE_PATH')) {
            return (string) BASE_PATH;
        }

        return dirname(__DIR__, 2);
    }
}
