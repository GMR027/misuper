<?php

declare(strict_types=1);

use App\Support\Database;
use App\Support\Env;

/**
 * Ejecuta los seeds de database/seeds en orden numérico.
 * Los archivos deben ser idempotentes (INSERT IGNORE / WHERE NOT EXISTS).
 *
 * Uso: php scripts/seed.php
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

$files = glob(BASE_PATH . '/database/seeds/*.sql') ?: [];
sort($files, SORT_STRING);

if ($files === []) {
    fwrite(STDERR, "No hay seeds en database/seeds.\n");
    exit(1);
}

$adminEmail = Env::get('ADMIN_EMAIL', 'admin@misuper.local');
$adminPassword = Env::get('ADMIN_PASSWORD');
$passwordTemporal = false;

$existeAdmin = false;

try {
    $consulta = $pdo->prepare('SELECT 1 FROM usuarios WHERE email = ? LIMIT 1');
    $consulta->execute([$adminEmail]);
    $existeAdmin = $consulta->fetchColumn() !== false;
} catch (Throwable) {
    // Si la tabla aún no existe, el seed fallará con un mensaje claro.
}

if ($adminPassword === null) {
    if ($existeAdmin) {
        // No se insertará nada (INSERT IGNORE), pero el placeholder necesita un hash.
        $adminPassword = bin2hex(random_bytes(16));
    } else {
        $adminPassword = \App\Services\AdminUsuarioService::generarPasswordTemporal();
        $passwordTemporal = true;
    }
}

$adminHash = password_hash($adminPassword, PASSWORD_DEFAULT);

if ($adminHash === false) {
    fwrite(STDERR, "No se pudo generar el hash del admin inicial.\n");
    exit(1);
}

$executed = 0;

foreach ($files as $file) {
    $filename = basename($file);
    $sql = file_get_contents($file);

    if ($sql === false) {
        fwrite(STDERR, "No se pudo leer {$filename}.\n");
        exit(1);
    }

    $sql = str_replace(
        ['__ADMIN_EMAIL__', '__ADMIN_PASSWORD_HASH__'],
        [$adminEmail, $adminHash],
        $sql
    );

    try {
        $pdo->beginTransaction();
        $affected = $pdo->exec($sql);

        if ($pdo->inTransaction()) {
            $pdo->commit();
        }

        echo "✓ Seed aplicado: {$filename} (filas afectadas: {$affected})\n";
        $executed++;
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }

        fwrite(STDERR, "✗ Error en {$filename}: {$error->getMessage()}\n");
        exit(1);
    }
}

echo "\nSeeds ejecutados: {$executed}.\n";

if ($passwordTemporal) {
    echo "\nAdmin inicial creado:\n";
    echo "  Email:     {$adminEmail}\n";
    echo "  Contraseña temporal: {$adminPassword}\n";
    echo "  Deberás cambiarla al iniciar sesión.\n";
}

exit(0);
