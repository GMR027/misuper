<?php

declare(strict_types=1);

use App\Support\Database;
use App\Support\Env;

/**
 * Importación inicial del catálogo de productos desde CSV.
 *
 * - No asocia imágenes: imagen_url queda NULL.
 * - Inserta en una sola transacción.
 * - Aborta si la tabla productos ya tiene filas.
 *
 * Uso: php scripts/importar_productos.php
 */

define('BASE_PATH', dirname(__DIR__));

require BASE_PATH . '/vendor/autoload.php';

Env::load(BASE_PATH . '/.env');

const UNIDADES_VALIDAS = ['kg', 'L', 'pza'];
const COLUMNAS_CSV = ['nombre', 'categoria', 'unidad_base'];

/**
 * Aborta la ejecución con un mensaje claro.
 */
function abortar(string $mensaje): never
{
    fwrite(STDERR, '✗ ' . $mensaje . "\n");
    exit(1);
}

$csvPath = BASE_PATH . '/database/csv/productos_base.csv';

if (!is_file($csvPath) || !is_readable($csvPath)) {
    abortar('No existe o no se puede leer database/csv/productos_base.csv.');
}

try {
    $pdo = Database::connection();
} catch (Throwable $error) {
    abortar('No se pudo conectar a MySQL: ' . $error->getMessage());
}

try {
    $totalActual = (int) $pdo->query('SELECT COUNT(*) FROM productos')->fetchColumn();
} catch (Throwable $error) {
    abortar('No se pudo consultar la tabla productos: ' . $error->getMessage());
}

if ($totalActual > 0) {
    abortar(
        "La tabla productos ya tiene {$totalActual} productos. "
        . 'Vacíala antes de reimportar.'
    );
}

try {
    $categorias = [];

    foreach ($pdo->query('SELECT id, nombre FROM categorias') as $row) {
        $categorias[(string) $row['nombre']] = (int) $row['id'];
    }
} catch (Throwable $error) {
    abortar('No se pudieron leer las categorías: ' . $error->getMessage());
}

$handle = fopen($csvPath, 'rb');

if ($handle === false) {
    abortar('No se pudo abrir el CSV.');
}

$encabezado = fgetcsv($handle, 0, ',', '"', '');

if ($encabezado === false) {
    fclose($handle);
    abortar('El CSV está vacío o no tiene encabezado.');
}

$encabezado[0] = preg_replace('/^\xEF\xBB\xBF/', '', (string) $encabezado[0]) ?? '';
$encabezado = array_map(static fn (mixed $valor): string => trim((string) $valor), $encabezado);

if ($encabezado !== COLUMNAS_CSV) {
    fclose($handle);
    abortar(
        'Encabezado inválido. Se esperaba "nombre,categoria,unidad_base" y se encontró "'
        . implode(',', $encabezado) . '".'
    );
}

$leidas = 0;
$errores = [];
$validas = [];
$nombresVistos = [];
$numeroLinea = 1;

while (($fila = fgetcsv($handle, 0, ',', '"', '')) !== false) {
    $numeroLinea++;

    // Ignora líneas completamente vacías.
    if ($fila === [null] || $fila === ['']) {
        continue;
    }

    $leidas++;

    if (count($fila) !== 3) {
        $errores[] = [
            'linea' => $numeroLinea,
            'motivo' => 'Se esperaban 3 columnas y se encontraron ' . count($fila) . '.',
        ];

        continue;
    }

    $nombre = trim((string) $fila[0]);
    $categoria = trim((string) $fila[1]);
    $unidad = trim((string) $fila[2]);

    $longitud = function_exists('mb_strlen')
        ? mb_strlen($nombre, 'UTF-8')
        : strlen($nombre);

    if ($longitud < 2 || $longitud > 150) {
        $errores[] = [
            'linea' => $numeroLinea,
            'motivo' => 'El nombre debe tener entre 2 y 150 caracteres.',
        ];

        continue;
    }

    if (!array_key_exists($categoria, $categorias)) {
        $errores[] = [
            'linea' => $numeroLinea,
            'motivo' => "La categoría \"{$categoria}\" no existe.",
        ];

        continue;
    }

    if (!in_array($unidad, UNIDADES_VALIDAS, true)) {
        $errores[] = [
            'linea' => $numeroLinea,
            'motivo' => "Unidad base inválida: \"{$unidad}\". Debe ser kg, L o pza.",
        ];

        continue;
    }

    $clave = function_exists('mb_strtolower')
        ? mb_strtolower($nombre, 'UTF-8')
        : strtolower($nombre);

    if (isset($nombresVistos[$clave])) {
        $errores[] = [
            'linea' => $numeroLinea,
            'motivo' => "Producto duplicado: \"{$nombre}\" (ya aparece en la línea "
                . $nombresVistos[$clave] . ').',
        ];

        continue;
    }

    $nombresVistos[$clave] = $numeroLinea;
    $validas[] = [
        'nombre' => $nombre,
        'categoria_id' => $categorias[$categoria],
        'unidad_base' => $unidad,
    ];
}

fclose($handle);

$insertados = 0;

try {
    $pdo->beginTransaction();

    $statement = $pdo->prepare(
        "INSERT INTO productos (nombre, categoria_id, unidad_base, imagen_url, estado)
         VALUES (?, ?, ?, NULL, 'activo')"
    );

    foreach ($validas as $producto) {
        $statement->execute([
            $producto['nombre'],
            $producto['categoria_id'],
            $producto['unidad_base'],
        ]);

        $insertados++;
    }

    $pdo->commit();
} catch (Throwable $error) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    abortar(
        'Error al insertar productos; se revirtió toda la importación: '
        . $error->getMessage()
    );
}

echo "Importación de productos\n";
echo "------------------------\n";
echo "Total filas leídas: {$leidas}\n";
echo "Total insertados: {$insertados}\n";
echo 'Total con error: ' . count($errores) . "\n";

if ($errores !== []) {
    echo "\nErrores de validación:\n";

    foreach ($errores as $error) {
        echo "  - Línea {$error['linea']}: {$error['motivo']}\n";
    }
}

exit($errores === [] ? 0 : 1);
