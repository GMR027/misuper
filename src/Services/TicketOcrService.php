<?php

declare(strict_types=1);

namespace App\Services;

use App\Support\Env;
use DomainException;

/**
 * Ejecuta Tesseract sobre la imagen de un ticket.
 *
 * Además del texto plano, expone la salida TSV (palabras con coordenadas)
 * para que el parser pueda distinguir el bloque de artículos del encabezado
 * y del pie del ticket usando la posición de la columna de precios.
 *
 * No usa shell: proc_open recibe un array de argumentos, así que el nombre
 * del archivo nunca se interpreta como comando. Si el binario o el idioma
 * español no están disponibles, se lanza una excepción clara para que la
 * interfaz muestre un error comprensible.
 */
final class TicketOcrService
{
    private static ?string $lenguaje = null;

    /**
     * @param int $psm Modo de segmentación de Tesseract (6 bloque, 4 columnas).
     */
    public function extraerTexto(string $archivo, int $psm = 6): string
    {
        return trim($this->ejecutar($archivo, $psm));
    }

    /**
     * Ejecuta Tesseract en modo TSV y devuelve las líneas reconstruidas con
     * coordenadas. Es la base del parser basado en layout.
     *
     * @return array{
     *     texto: string,
     *     ancho: int,
     *     alto: int,
     *     confianza: float,
     *     lineas: array<int, array{
     *         texto: string,
     *         left: int,
     *         top: int,
     *         right: int,
     *         bottom: int,
     *         height: int,
     *         confianza: float,
     *         palabras: array<int, array{texto: string, left: int, top: int, right: int, bottom: int, height: int, confianza: float}>
     *     }>
     * }
     */
    public function extraerEstructura(string $archivo, int $psm = 6): array
    {
        $salida = $this->ejecutar($archivo, $psm, 'tsv');
        $palabras = $this->parsearTsv($salida);
        $lineas = $this->agruparLineas($palabras);
        [$ancho, $alto] = $this->dimensiones($archivo, $palabras);

        $texto = implode("\n", array_map(
            static fn (array $linea): string => $linea['texto'],
            $lineas
        ));

        $confianzas = array_map(
            static fn (array $linea): float => $linea['confianza'],
            $lineas
        );

        return [
            'texto' => $texto,
            'ancho' => $ancho,
            'alto' => $alto,
            'confianza' => $confianzas === [] ? 0.0 : array_sum($confianzas) / count($confianzas),
            'lineas' => $lineas,
        ];
    }

    public function disponible(): bool
    {
        try {
            $this->binario();

            return true;
        } catch (DomainException) {
            return false;
        }
    }

    /**
     * @param string|null $config Configuración de salida de Tesseract (p. ej. "tsv").
     */
    /**
     * Detecta cuántos grados hay que girar la foto para que el texto quede
     * horizontal. Tesseract devuelve 90, 180 o 270; null si no lo sabe.
     */
    public function rotacion(string $archivo): ?int
    {
        if (!is_file($archivo) || !is_readable($archivo) || !is_callable('proc_open')) {
            return null;
        }

        try {
            $binario = $this->binario();
        } catch (\Throwable) {
            return null;
        }

        $comando = [
            $binario,
            $archivo,
            'stdout',
            '-l',
            'osd',
            '--psm',
            '0',
        ];

        $descriptores = [
            1 => ['pipe', 'w'],
            2 => ['pipe', 'w'],
        ];

        $proceso = @proc_open($comando, $descriptores, $tuberias);

        if (!is_resource($proceso)) {
            return null;
        }

        $salida = stream_get_contents($tuberias[1]);
        $error = stream_get_contents($tuberias[2]);

        fclose($tuberias[1]);
        fclose($tuberias[2]);

        if (proc_close($proceso) !== 0) {
            error_log('[ticket-ocr] OSD falló: ' . trim((string) $error));

            return null;
        }

        if (preg_match('/Rotate:\s*(90|180|270)/i', (string) $salida, $m) === 1) {
            return (int) $m[1];
        }

        return null;
    }

    private function ejecutar(string $archivo, int $psm, ?string $config = null): string
    {
        if (!is_file($archivo) || !is_readable($archivo)) {
            throw new DomainException('No se pudo leer la imagen del ticket.', 422);
        }

        if (!is_callable('proc_open')) {
            throw new DomainException(
                'El OCR no está disponible: la función proc_open está deshabilitada.',
                503
            );
        }

        $binario = $this->binario();
        $comando = [
            $binario,
            $archivo,
            'stdout',
            '-l',
            $this->lenguaje($binario),
            '--psm',
            (string) $psm,
            '--oem',
            '1',
            '-c',
            'preserve_interword_spaces=1',
        ];

        if ($config !== null) {
            $comando[] = $config;
        }

        $descriptores = [
            1 => ['pipe', 'w'],
            2 => ['pipe', 'w'],
        ];

        $proceso = @proc_open($comando, $descriptores, $tuberias);

        if (!is_resource($proceso)) {
            throw new DomainException('No se pudo iniciar el OCR del ticket.', 503);
        }

        $salida = stream_get_contents($tuberias[1]);
        $error = stream_get_contents($tuberias[2]);

        fclose($tuberias[1]);
        fclose($tuberias[2]);

        $estado = proc_close($proceso);

        if ($estado !== 0) {
            error_log('[ticket-ocr] Tesseract falló: ' . trim((string) $error));

            throw new DomainException(
                'No se pudo leer la imagen. Intenta con una foto más clara.',
                422
            );
        }

        return (string) $salida;
    }

    /**
     * Convierte la salida TSV en palabras con coordenadas absolutas.
     *
     * @return array<int, array{texto: string, left: int, top: int, right: int, bottom: int, height: int, confianza: float}>
     */
    private function parsearTsv(string $salida): array
    {
        $palabras = [];
        $filas = preg_split('/\r\n|\r|\n/', $salida) ?: [];

        foreach ($filas as $indice => $fila) {
            if ($indice === 0 || trim($fila) === '') {
                continue;
            }

            $columnas = explode("\t", rtrim($fila, "\r"));

            if (count($columnas) < 12) {
                continue;
            }

            // level page block par line word left top width height conf text
            if ((int) $columnas[0] !== 5) {
                continue;
            }

            $texto = trim((string) $columnas[11]);

            if ($texto === '') {
                continue;
            }

            $left = (int) $columnas[6];
            $top = (int) $columnas[7];
            $width = (int) $columnas[8];
            $height = (int) $columnas[9];
            $confianza = (float) $columnas[10];

            $palabras[] = [
                'texto' => $texto,
                'left' => $left,
                'top' => $top,
                'right' => $left + $width,
                'bottom' => $top + $height,
                'height' => max(1, $height),
                'confianza' => $confianza < 0 ? 0.0 : $confianza,
            ];
        }

        return $palabras;
    }

    /**
     * Agrupa palabras por línea física usando su posición vertical. Tesseract
     * a veces separa una misma línea visual en varios bloques (por columnas),
     * así que no basta con block/par/line del TSV.
     *
     * @param array<int, array{texto: string, left: int, top: int, right: int, bottom: int, height: int, confianza: float}> $palabras
     * @return array<int, array{
     *     texto: string,
     *     left: int,
     *     top: int,
     *     right: int,
     *     bottom: int,
     *     height: int,
     *     confianza: float,
     *     palabras: array<int, array{texto: string, left: int, top: int, right: int, bottom: int, height: int, confianza: float}>
     * }>
     */
    private function agruparLineas(array $palabras): array
    {
        if ($palabras === []) {
            return [];
        }

        usort(
            $palabras,
            static fn (array $a, array $b): int => $a['top'] <=> $b['top']
                ?: $a['left'] <=> $b['left']
        );

        $lineas = [];
        $actual = null;

        foreach ($palabras as $palabra) {
            $centro = $palabra['top'] + $palabra['height'] / 2;

            if ($actual === null) {
                $actual = $this->crearLinea($palabra, $centro);
                continue;
            }

            $tolerancia = max(10.0, max($palabra['height'], $actual['height']) * 0.7);

            if (abs($centro - $actual['_centro']) <= $tolerancia) {
                $actual['palabras'][] = $palabra;
                $actual['_centros'][] = $centro;
                $actual['_centro'] = array_sum($actual['_centros']) / count($actual['_centros']);
                $actual['left'] = min($actual['left'], $palabra['left']);
                $actual['right'] = max($actual['right'], $palabra['right']);
                $actual['top'] = min($actual['top'], $palabra['top']);
                $actual['bottom'] = max($actual['bottom'], $palabra['bottom']);
                $actual['height'] = max(1, $actual['bottom'] - $actual['top']);
                $actual['confianza'] = ($actual['confianza'] * (count($actual['palabras']) - 1)
                    + $palabra['confianza']) / count($actual['palabras']);

                continue;
            }

            $lineas[] = $this->cerrarLinea($actual);
            $actual = $this->crearLinea($palabra, $centro);
        }

        if ($actual !== null) {
            $lineas[] = $this->cerrarLinea($actual);
        }

        return $lineas;
    }

    /**
     * @param array{texto: string, left: int, top: int, right: int, bottom: int, height: int, confianza: float} $palabra
     * @return array<string, mixed>
     */
    private function crearLinea(array $palabra, float $centro): array
    {
        return [
            'texto' => '',
            'left' => $palabra['left'],
            'top' => $palabra['top'],
            'right' => $palabra['right'],
            'bottom' => $palabra['bottom'],
            'height' => $palabra['height'],
            'confianza' => $palabra['confianza'],
            'palabras' => [$palabra],
            '_centro' => $centro,
            '_centros' => [$centro],
        ];
    }

    /**
     * @param array<string, mixed> $linea
     * @return array{texto: string, left: int, top: int, right: int, bottom: int, height: int, confianza: float, palabras: array<int, array{texto: string, left: int, top: int, right: int, bottom: int, height: int, confianza: float}>}
     */
    private function cerrarLinea(array $linea): array
    {
        $palabras = $linea['palabras'];
        usort(
            $palabras,
            static fn (array $a, array $b): int => $a['left'] <=> $b['left']
        );

        return [
            'texto' => trim(implode(' ', array_map(
                static fn (array $palabra): string => $palabra['texto'],
                $palabras
            ))),
            'left' => (int) $linea['left'],
            'top' => (int) $linea['top'],
            'right' => (int) $linea['right'],
            'bottom' => (int) $linea['bottom'],
            'height' => (int) $linea['height'],
            'confianza' => (float) $linea['confianza'],
            'palabras' => $palabras,
        ];
    }

    /**
     * @param array<int, array{right: int, bottom: int}> $palabras
     * @return array{0: int, 1: int}
     */
    private function dimensiones(string $archivo, array $palabras): array
    {
        $medidas = @getimagesize($archivo);

        if (is_array($medidas) && ($medidas[0] ?? 0) > 0 && ($medidas[1] ?? 0) > 0) {
            return [(int) $medidas[0], (int) $medidas[1]];
        }

        $ancho = 1;
        $alto = 1;

        foreach ($palabras as $palabra) {
            $ancho = max($ancho, $palabra['right']);
            $alto = max($alto, $palabra['bottom']);
        }

        return [$ancho, $alto];
    }

    private function binario(): string
    {
        $configurado = Env::get('TESSERACT_BIN');

        if ($configurado !== null && is_executable($configurado)) {
            return $configurado;
        }

        foreach (['/usr/bin/tesseract', '/usr/local/bin/tesseract', '/opt/homebrew/bin/tesseract'] as $ruta) {
            if (is_executable($ruta)) {
                return $ruta;
            }
        }

        throw new DomainException(
            'El OCR no está disponible en el servidor. Instala Tesseract con el idioma español.',
            503
        );
    }

    private function lenguaje(string $binario): string
    {
        if (self::$lenguaje !== null) {
            return self::$lenguaje;
        }

        $comando = [$binario, '--list-langs'];
        $descriptores = [
            1 => ['pipe', 'w'],
            2 => ['pipe', 'w'],
        ];

        $proceso = @proc_open($comando, $descriptores, $tuberias);

        if (!is_resource($proceso)) {
            return self::$lenguaje = 'spa';
        }

        $salida = (string) stream_get_contents($tuberias[1]);
        stream_get_contents($tuberias[2]);

        fclose($tuberias[1]);
        fclose($tuberias[2]);
        proc_close($proceso);

        if (preg_match('/^\s*spa\s*$/m', $salida) === 1) {
            return self::$lenguaje = 'spa';
        }

        if (preg_match('/^\s*eng\s*$/m', $salida) === 1) {
            return self::$lenguaje = 'eng';
        }

        throw new DomainException(
            'Tesseract no tiene instalados los datos de idioma (spa o eng).',
            503
        );
    }
}
