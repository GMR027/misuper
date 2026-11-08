<?php

declare(strict_types=1);

use App\Support\Database;
use App\Support\Env;

/**
 * Importa los datos nutricionales curados de data/nutricion_productos.json.
 *
 * Uso:
 *   php scripts/importar_nutricion.php            # reporte (no escribe)
 *   php scripts/importar_nutricion.php --aplicar  # actualiza la base local
 *   php scripts/importar_nutricion.php --generar-sql
 *       # regenera database/migrations/035_seed_nutricion_productos.sql
 *
 * El JSON se indexa por nombre exacto de producto global. Los productos
 * propios de cada usuario y los productos de Hogar/Limpieza no se tocan.
 */

define('BASE_PATH', dirname(__DIR__));

require BASE_PATH . '/vendor/autoload.php';

Env::load(BASE_PATH . '/.env');

$jsonPath = BASE_PATH . '/data/nutricion_productos.json';
$sqlPath = BASE_PATH . '/database/migrations/035_seed_nutricion_productos.sql';

$opciones = getopt('', ['aplicar', 'generar-sql']);
$aplicar = array_key_exists('aplicar', $opciones);
$generarSql = array_key_exists('generar-sql', $opciones);

if (!is_file($jsonPath)) {
    fwrite(STDERR, "No existe {$jsonPath}\n");
    exit(1);
}

$contenido = file_get_contents($jsonPath);
$data = $contenido === false ? null : json_decode($contenido, true);

if (!is_array($data) || !isset($data['productos']) || !is_array($data['productos'])) {
    fwrite(STDERR, "El JSON no tiene la clave 'productos'.\n");
    exit(1);
}

/** @var array<string, array{kcal_100: float|null, peso_pieza_g: float|null, fuente: string|null}> $productos */
$productos = $data['productos'];

if ($generarSql) {
    $lineas = [
        '-- 035_seed_nutricion_productos.sql',
        '-- Generado por scripts/importar_nutricion.php --generar-sql.',
        '-- Datos orientativos de calorías por producto (ver data/nutricion_productos.json).',
        '--',
        '-- Idempotente: solo actualiza productos globales por nombre exacto.',
        '',
    ];

    foreach ($productos as $nombre => $dato) {
        $kcal = $dato['kcal_100'] ?? null;
        $peso = $dato['peso_pieza_g'] ?? null;
        $fuente = $dato['fuente'] ?? null;

        $lineas[] = sprintf(
            "UPDATE productos SET kcal_100 = %s, peso_pieza_g = %s, fuente_nutricion = %s WHERE nombre = %s AND usuario_id IS NULL;",
            self_sql($kcal),
            self_sql($peso),
            self_sql($fuente),
            self_sql($nombre)
        );
    }

    $lineas[] = '';

    if (file_put_contents($sqlPath, implode("\n", $lineas)) === false) {
        fwrite(STDERR, "No se pudo escribir {$sqlPath}\n");
        exit(1);
    }

    echo '✓ Generada ' . $sqlPath . ' con ' . count($productos) . " productos.\n";
    exit(0);
}

try {
    $pdo = Database::connection();
} catch (Throwable $error) {
    fwrite(STDERR, 'No se pudo conectar a MySQL: ' . $error->getMessage() . "\n");
    exit(1);
}

$statement = $pdo->query(
    'SELECT id, nombre, unidad_base, kcal_100, peso_pieza_g
     FROM productos
     WHERE usuario_id IS NULL'
);
$globales = [];

foreach ($statement->fetchAll() as $row) {
    $globales[(string) $row['nombre']] = $row;
}

$encontrados = 0;
$actualizados = 0;
$sinProducto = [];

if ($aplicar) {
    $update = $pdo->prepare(
        'UPDATE productos
         SET kcal_100 = ?, peso_pieza_g = ?, fuente_nutricion = ?
         WHERE nombre = ? AND usuario_id IS NULL'
    );
}

foreach ($productos as $nombre => $dato) {
    if (!isset($globales[$nombre])) {
        $sinProducto[] = $nombre;

        continue;
    }

    $encontrados++;
    $kcal = $dato['kcal_100'] ?? null;
    $peso = $dato['peso_pieza_g'] ?? null;
    $fuente = $dato['fuente'] ?? null;

    if ($aplicar) {
        $update->execute([$kcal, $peso, $fuente, $nombre]);
        $actualizados++;
    }
}

$conDato = (int) $pdo->query(
    'SELECT COUNT(*) FROM productos WHERE usuario_id IS NULL AND kcal_100 IS NOT NULL'
)->fetchColumn();
$total = (int) $pdo->query(
    'SELECT COUNT(*) FROM productos WHERE usuario_id IS NULL'
)->fetchColumn();

echo "Productos en JSON: " . count($productos) . "\n";
echo "Encontrados en el catálogo global: {$encontrados}\n";

if ($sinProducto !== []) {
    echo 'No encontrados (' . count($sinProducto) . "): " . implode(', ', $sinProducto) . "\n";
}

if ($aplicar) {
    echo "Actualizados: {$actualizados}\n";
}

printf(
    "Cobertura global: %d/%d (%.1f%%)\n",
    $conDato,
    $total,
    $total > 0 ? $conDato / $total * 100 : 0.0
);

if (!$aplicar) {
    echo "\nModo reporte. Usa --aplicar para escribir o --generar-sql para crear la migración.\n";
}

exit(0);

function self_sql(mixed $valor): string
{
    if ($valor === null || $valor === '') {
        return 'NULL';
    }

    if (is_int($valor) || is_float($valor)) {
        return rtrim(rtrim(number_format((float) $valor, 2, '.', ''), '0'), '.');
    }

    return "'" . str_replace("'", "''", (string) $valor) . "'";
}
