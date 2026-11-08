<?php

declare(strict_types=1);

use App\Services\NutricionService;
use App\Support\Database;
use App\Support\Env;

/**
 * Comprobaciones rápidas del cálculo de calorías.
 *
 * Uso: php scripts/verificar_nutricion.php
 */

define('BASE_PATH', dirname(__DIR__));

require BASE_PATH . '/vendor/autoload.php';

Env::load(BASE_PATH . '/.env');

$fallos = 0;

function comprobar(string $descripcion, ?float $obtenido, ?float $esperado, float $tolerancia = 0.2): void
{
    global $fallos;

    $ok = ($obtenido === null && $esperado === null)
        || ($obtenido !== null && $esperado !== null && abs($obtenido - $esperado) <= $tolerancia);

    printf(
        "%s %s: obtenido %s, esperado %s\n",
        $ok ? '✓' : '✗',
        $descripcion,
        $obtenido === null ? 'null' : (string) $obtenido,
        $esperado === null ? 'null' : (string) $esperado
    );

    if (!$ok) {
        $fallos++;
    }
}

$pdo = Database::connection();
$nutricion = new NutricionService();

$casos = [
    // nombre, cantidad, unidad, esperado
    ['Huevo blanco', 1, 'pza', 71.5],
    ['Huevo blanco', 100, 'gr', 143.0],
    ['Aceite de oliva', 100, 'ml', 813.0],
    ['Leche entera', 0.1, 'L', 61.0],
    ['Agua purificada', 1, 'L', 0.0],
    ['Papa', 1, 'pza', 115.5],
    ['Papa', 1, 'kg', 770.0],
    ['Tortillas de maíz', 1, 'pza', 54.5],
    ['Jitomate', 2, 'pza', 43.2],
    ['Hueso de res', 1, 'kg', null],
    ['Hoja de maíz', 1, 'pza', null],
];

foreach ($casos as [$nombre, $cantidad, $unidad, $esperado]) {
    $statement = $pdo->prepare(
        'SELECT nombre, unidad_base, kcal_100, peso_pieza_g
         FROM productos WHERE nombre = ? AND usuario_id IS NULL LIMIT 1'
    );
    $statement->execute([$nombre]);
    $producto = $statement->fetch();

    if ($producto === false) {
        printf("✗ No existe el producto %s\n", $nombre);
        $fallos++;

        continue;
    }

    comprobar(
        sprintf('%s · %s %s', $nombre, $cantidad, $unidad),
        NutricionService::calcular($producto, (float) $cantidad, $unidad),
        $esperado
    );
}

$conDato = (int) $pdo->query(
    'SELECT COUNT(*) FROM productos WHERE usuario_id IS NULL AND kcal_100 IS NOT NULL'
)->fetchColumn();
$total = (int) $pdo->query(
    'SELECT COUNT(*) FROM productos WHERE usuario_id IS NULL'
)->fetchColumn();

printf("\nCobertura del catálogo global: %d/%d (%.1f%%)\n", $conDato, $total, $conDato / $total * 100);

$receta = $pdo->query(
    "SELECT nombre, ingredientes, porciones_base FROM recetas WHERE estado = 'publicada' ORDER BY id ASC LIMIT 1"
)->fetch();

if ($receta !== false) {
    $receta['ingredientes'] = json_decode((string) $receta['ingredientes'], true) ?: [];
    $resumen = $nutricion->receta($receta);
    printf(
        "Receta «%s»: %.1f kcal total, %.1f kcal por porción, %d sin dato, %d ignorados.\n",
        (string) $receta['nombre'],
        $resumen['total'],
        $resumen['porcion'],
        $resumen['sin_dato'],
        $resumen['ignorados']
    );
}

exit($fallos === 0 ? 0 : 1);
