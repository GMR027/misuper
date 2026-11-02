<?php

declare(strict_types=1);

namespace App\Services;

use App\Support\Env;
use DomainException;

/**
 * Ejecuta Tesseract sobre la imagen de un ticket.
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
        ];

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

        return trim((string) $salida);
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
