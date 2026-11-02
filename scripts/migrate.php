<?php

declare(strict_types=1);

use App\Support\Database;
use App\Support\Env;

/**
 * Ejecuta las migraciones pendientes de database/migrations en orden numérico.
 * Registra cada archivo aplicado en la tabla migration_log.
 *
 * Uso: php scripts/migrate.php
 */

define('BASE_PATH', dirname(__DIR__));

require BASE_PATH . '/vendor/autoload.php';

Env::load(BASE_PATH . '/.env');

try {
    $pdo = Database::connection();
} catch (Throwable $error) {
    fwrite(STDERR, 'No se pudo conectar a MySQL: ' . $error->getMessage() . "\n");
    exit(1);
}

try {
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS migration_log (
            id INT NOT NULL AUTO_INCREMENT,
            filename VARCHAR(255) NOT NULL,
            applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uq_migration_log_filename (filename)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci'
    );
} catch (Throwable $error) {
    fwrite(STDERR, 'No se pudo crear migration_log: ' . $error->getMessage() . "\n");
    exit(1);
}

$files = glob(BASE_PATH . '/database/migrations/*.sql') ?: [];
sort($files, SORT_STRING);

if ($files === []) {
    fwrite(STDERR, "No hay migraciones en database/migrations.\n");
    exit(1);
}

$statement = $pdo->query('SELECT filename FROM migration_log');
$applied = array_map('strval', $statement->fetchAll(PDO::FETCH_COLUMN));

$executed = 0;
$skipped = 0;

foreach ($files as $file) {
    $filename = basename($file);

    if (in_array($filename, $applied, true)) {
        echo "· Omitida (ya aplicada): {$filename}\n";
        $skipped++;

        continue;
    }

    $sql = file_get_contents($file);

    if ($sql === false) {
        fwrite(STDERR, "No se pudo leer {$filename}.\n");
        exit(1);
    }

    try {
        $pdo->beginTransaction();
        $pdo->exec($sql);

        $insert = $pdo->prepare('INSERT INTO migration_log (filename) VALUES (?)');
        $insert->execute([$filename]);

        // MySQL hace commit implícito en DDL: solo cerramos si sigue abierta.
        if ($pdo->inTransaction()) {
            $pdo->commit();
        }

        echo "✓ Aplicada: {$filename}\n";
        $executed++;
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }

        fwrite(STDERR, "✗ Error en {$filename}: {$error->getMessage()}\n");
        exit(1);
    }
}

echo "\nMigraciones aplicadas: {$executed}. Omitidas: {$skipped}.\n";

exit(0);
