<?php

declare(strict_types=1);

use App\Services\NormalizadorService;
use App\Services\TicketParserService;

/**
 * Pruebas del parser de tickets contra fixtures de texto.
 *
 * Uso: php scripts/test_ticket_parser.php
 *
 * Cada archivo NN_nombre.txt debe tener su NN_nombre.expected.json con:
 *   { "fecha": "YYYY-MM-DD"|null, "total": number|null,
 *     "items": [{ "nombre": string, "cantidad": number, "precio_total": number }] }
 */

define('BASE_PATH', dirname(__DIR__));

require BASE_PATH . '/vendor/autoload.php';

$directorio = BASE_PATH . '/database/fixtures/tickets';
$archivos = glob($directorio . '/*.txt') ?: [];
sort($archivos, SORT_STRING);

if ($archivos === []) {
    fwrite(STDERR, "No hay fixtures en {$directorio}.\n");
    exit(1);
}

$parser = new TicketParserService();
$fallos = 0;
$pruebas = 0;

foreach ($archivos as $archivo) {
    $nombre = basename($archivo, '.txt');
    $esperadoPath = $directorio . '/' . $nombre . '.expected.json';
    $pruebas++;

    if (!is_file($esperadoPath)) {
        echo "✗ {$nombre}: falta {$nombre}.expected.json\n";
        $fallos++;

        continue;
    }

    $esperado = json_decode((string) file_get_contents($esperadoPath), true);

    if (!is_array($esperado)) {
        echo "✗ {$nombre}: JSON esperado inválido\n";
        $fallos++;

        continue;
    }

    $resultado = $parser->parsear((string) file_get_contents($archivo));
    $errores = [];

    if (($esperado['fecha'] ?? null) !== ($resultado['fecha'] ?? null)) {
        $errores[] = sprintf(
            'fecha: esperado %s, obtenido %s',
            var_export($esperado['fecha'] ?? null, true),
            var_export($resultado['fecha'] ?? null, true)
        );
    }

    if (($esperado['total'] ?? null) !== ($resultado['total'] ?? null)) {
        $errores[] = sprintf(
            'total: esperado %s, obtenido %s',
            var_export($esperado['total'] ?? null, true),
            var_export($resultado['total'] ?? null, true)
        );
    }

    $itemsEsperados = is_array($esperado['items'] ?? null) ? $esperado['items'] : [];
    $itemsObtenidos = is_array($resultado['items'] ?? null) ? $resultado['items'] : [];

    if (count($itemsEsperados) !== count($itemsObtenidos)) {
        $errores[] = sprintf(
            'artículos: esperados %d, obtenidos %d',
            count($itemsEsperados),
            count($itemsObtenidos)
        );
    }

    foreach ($itemsEsperados as $indice => $esperadoItem) {
        $obtenido = $itemsObtenidos[$indice] ?? null;

        if (!is_array($obtenido)) {
            $errores[] = "artículo {$indice}: no obtenido";
            continue;
        }

        foreach (['nombre', 'cantidad', 'precio_total'] as $campo) {
            $esperadoValor = $esperadoItem[$campo] ?? null;
            $obtenidoValor = $obtenido[$campo] ?? null;

            $coincide = $campo === 'nombre'
                ? $esperadoValor === $obtenidoValor
                : (is_numeric($esperadoValor) && is_numeric($obtenidoValor)
                    && abs((float) $esperadoValor - (float) $obtenidoValor) < 0.0001);

            if (!$coincide) {
                $errores[] = sprintf(
                    'artículo %d %s: esperado %s, obtenido %s',
                    $indice,
                    $campo,
                    var_export($esperadoValor, true),
                    var_export($obtenidoValor, true)
                );
            }
        }

        $nombreItem = NormalizadorService::normalizar((string) ($obtenido['nombre'] ?? ''));

        foreach (['rfc', 'telefono', 'tel', 'folio', 'ticket', 'cajero', 'subtotal', 'total', 'iva', 'cambio'] as $prohibida) {
            if (preg_match('/\b' . preg_quote($prohibida, '/') . '\b/u', $nombreItem) === 1) {
                $errores[] = "artículo {$indice}: contiene metadato '{$prohibida}'";
            }
        }
    }

    if ($errores === []) {
        echo "✓ {$nombre}\n";
        continue;
    }

    $fallos++;
    echo "✗ {$nombre}\n";

    foreach ($errores as $error) {
        echo "    - {$error}\n";
    }
}

echo "\nPruebas: {$pruebas}. Fallos: {$fallos}.\n";

exit($fallos === 0 ? 0 : 1);
