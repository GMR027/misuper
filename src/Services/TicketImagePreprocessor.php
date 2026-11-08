<?php

declare(strict_types=1);

namespace App\Services;

/**
 * Prepara la foto de un ticket antes de pasarla a Tesseract.
 *
 * El OCR falla con fotos de mano, sombras y fondos oscuros. Este servicio:
 *  1. Detecta el área blanca del ticket y recorta el resto.
 *  2. Amplía la imagen para que el texto térmico tenga más píxeles.
 *  3. Aplica un umbral adaptativo para separar la tinta del papel.
 *
 * Si GD no está disponible o algo falla, devuelve null y el llamador usa la
 * imagen original. Así el OCR sigue funcionando, aunque con menos precisión.
 */
final class TicketImagePreprocessor
{
    /**
     * @return string|null Ruta del archivo temporal procesado, o null.
     */
    public function preparar(string $archivo): ?string
    {
        if (!function_exists('imagecreatefromstring') || !function_exists('imagejpeg')) {
            return null;
        }

        $datos = @file_get_contents($archivo);

        if ($datos === false) {
            return null;
        }

        $original = @imagecreatefromstring($datos);

        if ($original === false) {
            return null;
        }

        // Las fotos giradas hacen que Tesseract lea columnas verticales.
        // OSD es barato y solo se usa para orientar la imagen antes del OCR.
        try {
            $rotacion = (new TicketOcrService())->rotacion($archivo);

            if ($rotacion !== null && $rotacion !== 0) {
                $blanco = imagecolorallocate($original, 255, 255, 255);
                $rotada = $blanco === false
                    ? false
                    : imagerotate($original, 360 - $rotacion, $blanco);

                if ($rotada !== false) {
                    imagedestroy($original);
                    $original = $rotada;
                }
            }
        } catch (\Throwable) {
            // Si OSD no está disponible, se procesa la imagen tal cual.
        }

        $recorte = null;
        $ampliada = null;
        $gris = null;
        $fondo = null;
        $procesada = null;

        try {
            [$x, $y, $ancho, $alto] = $this->detectarTicket($original);

            $recorte = ($x === 0 && $y === 0 && $ancho === imagesx($original) && $alto === imagesy($original))
                ? $original
                : imagecrop($original, ['x' => $x, 'y' => $y, 'width' => $ancho, 'height' => $alto]);

            if ($recorte === false) {
                $recorte = $original;
                $ancho = imagesx($original);
                $alto = imagesy($original);
            }

            $escala = $this->escala($ancho, $alto);
            $nuevoAncho = max(1, (int) round($ancho * $escala));
            $nuevoAlto = max(1, (int) round($alto * $escala));

            $ampliada = imagecreatetruecolor($nuevoAncho, $nuevoAlto);

            if ($ampliada === false) {
                return null;
            }

            imagecopyresampled(
                $ampliada,
                $recorte,
                0,
                0,
                0,
                0,
                $nuevoAncho,
                $nuevoAlto,
                $ancho,
                $alto
            );
            imagefilter($ampliada, IMG_FILTER_GRAYSCALE);

            $fondo = $this->estimarFondo($ampliada, $nuevoAncho, $nuevoAlto);

            if ($fondo === null) {
                return null;
            }

            $procesada = imagecreatetruecolor($nuevoAncho, $nuevoAlto);

            if ($procesada === false) {
                return null;
            }

            $negro = imagecolorallocate($procesada, 0, 0, 0);
            $blanco = imagecolorallocate($procesada, 255, 255, 255);

            if ($negro === false || $blanco === false) {
                return null;
            }

            // Umbral adaptativo: la tinta es más oscura que el fondo local.
            $constante = 15;

            for ($fila = 0; $fila < $nuevoAlto; $fila++) {
                for ($columna = 0; $columna < $nuevoAncho; $columna++) {
                    $pixel = imagecolorat($ampliada, $columna, $fila) & 0xFF;
                    $fondoPixel = imagecolorat($fondo, $columna, $fila) & 0xFF;
                    $esTinta = ($fondoPixel - $pixel) > $constante;

                    imagesetpixel($procesada, $columna, $fila, $esTinta ? $negro : $blanco);
                }
            }

            $temporal = tempnam(sys_get_temp_dir(), 'misuper_ticket_');

            if ($temporal === false) {
                return null;
            }

            if (!imagejpeg($procesada, $temporal, 95)) {
                @unlink($temporal);

                return null;
            }

            return $temporal;
        } finally {
            if ($recorte !== null && $recorte !== $original) {
                imagedestroy($recorte);
            }

            if ($ampliada !== null) {
                imagedestroy($ampliada);
            }

            if ($fondo !== null) {
                imagedestroy($fondo);
            }

            if ($procesada !== null) {
                imagedestroy($procesada);
            }

            imagedestroy($original);
        }
    }

    /**
     * Detecta el rectángulo del ticket usando brillo y baja saturación.
     *
     * @return array{0: int, 1: int, 2: int, 3: int}
     */
    private function detectarTicket(\GdImage $imagen): array
    {
        $anchoOriginal = imagesx($imagen);
        $altoOriginal = imagesy($imagen);
        $completa = [0, 0, $anchoOriginal, $altoOriginal];

        if ($anchoOriginal < 80 || $altoOriginal < 80) {
            return $completa;
        }

        $anchoAnalisis = min(300, $anchoOriginal);
        $altoAnalisis = max(1, (int) round($altoOriginal * $anchoAnalisis / $anchoOriginal));

        $pequena = imagecreatetruecolor($anchoAnalisis, $altoAnalisis);

        if ($pequena === false) {
            return $completa;
        }

        imagecopyresampled(
            $pequena,
            $imagen,
            0,
            0,
            0,
            0,
            $anchoAnalisis,
            $altoAnalisis,
            $anchoOriginal,
            $altoOriginal
        );

        $columnas = array_fill(0, $anchoAnalisis, 0);
        $filas = array_fill(0, $altoAnalisis, 0);

        for ($y = 0; $y < $altoAnalisis; $y++) {
            for ($x = 0; $x < $anchoAnalisis; $x++) {
                $rgb = imagecolorat($pequena, $x, $y);
                $r = ($rgb >> 16) & 0xFF;
                $g = ($rgb >> 8) & 0xFF;
                $b = $rgb & 0xFF;
                $luminosidad = 0.299 * $r + 0.587 * $g + 0.114 * $b;
                $saturacion = max($r, $g, $b) - min($r, $g, $b);

                if ($luminosidad > 150 && $saturacion < 75) {
                    $columnas[$x]++;
                    $filas[$y]++;
                }
            }
        }

        imagedestroy($pequena);

        $minX = null;
        $maxX = null;
        $minY = null;
        $maxY = null;

        for ($x = 0; $x < $anchoAnalisis; $x++) {
            if ($columnas[$x] >= $altoAnalisis * 0.12) {
                $minX ??= $x;
                $maxX = $x;
            }
        }

        for ($y = 0; $y < $altoAnalisis; $y++) {
            if ($filas[$y] >= $anchoAnalisis * 0.10) {
                $minY ??= $y;
                $maxY = $y;
            }
        }

        if ($minX === null || $maxX === null || $minY === null || $maxY === null) {
            return $completa;
        }

        $factorX = $anchoOriginal / $anchoAnalisis;
        $factorY = $altoOriginal / $altoAnalisis;

        $anchoDeteccion = ($maxX - $minX) * $factorX;
        $altoDeteccion = ($maxY - $minY) * $factorY;

        if ($anchoDeteccion < $anchoOriginal * 0.25 || $altoDeteccion < $altoOriginal * 0.25) {
            return $completa;
        }

        $margenX = (int) round($anchoDeteccion * 0.06);
        $margenY = (int) round($altoDeteccion * 0.02);

        $x = max(0, (int) floor($minX * $factorX) - $margenX);
        $y = max(0, (int) floor($minY * $factorY) - $margenY);
        $ancho = min($anchoOriginal - $x, (int) ceil($anchoDeteccion) + $margenX * 2);
        $alto = min($altoOriginal - $y, (int) ceil($altoDeteccion) + $margenY * 2);

        return [$x, $y, max(1, $ancho), max(1, $alto)];
    }

    private function escala(int $ancho, int $alto): float
    {
        if ($alto < 900) {
            $escala = 3.0;
        } elseif ($alto <= 1600) {
            $escala = 2.0;
        } elseif ($alto <= 2600) {
            $escala = 1.5;
        } else {
            $escala = 1.0;
        }

        // Evita imágenes gigantes que consuman demasiada memoria.
        if ($ancho * $escala > 4000) {
            $escala = 4000 / max(1, $ancho);
        }

        return max(1.0, $escala);
    }

    private function estimarFondo(\GdImage $imagen, int $ancho, int $alto): ?\GdImage
    {
        $anchoFondo = max(1, (int) round($ancho / 14));
        $altoFondo = max(1, (int) round($alto / 14));

        $pequena = imagecreatetruecolor($anchoFondo, $altoFondo);

        if ($pequena === false) {
            return null;
        }

        imagecopyresampled($pequena, $imagen, 0, 0, 0, 0, $anchoFondo, $altoFondo, $ancho, $alto);

        $fondo = imagecreatetruecolor($ancho, $alto);

        if ($fondo === false) {
            imagedestroy($pequena);

            return null;
        }

        imagecopyresampled($fondo, $pequena, 0, 0, 0, 0, $ancho, $alto, $anchoFondo, $altoFondo);
        imagedestroy($pequena);

        for ($i = 0; $i < 3; $i++) {
            imagefilter($fondo, IMG_FILTER_GAUSSIAN_BLUR);
        }

        return $fondo;
    }
}
