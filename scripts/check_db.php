<?php

declare(strict_types=1);

use App\Support\Env;

/**
 * Diagnóstico de conexión a MySQL.
 * No crea bases de datos, usuarios ni tablas: solo intenta conectar.
 *
 * Uso: php scripts/check_db.php
 */

define('BASE_PATH', dirname(__DIR__));

require BASE_PATH . '/vendor/autoload.php';

Env::load(BASE_PATH . '/.env');

require BASE_PATH . '/config/db.php';

$isRoot = strtolower(DB_USER) === 'root';

$databaseSql = "CREATE DATABASE IF NOT EXISTS `" . DB_NAME . "`\n"
    . "    CHARACTER SET utf8mb4\n"
    . "    COLLATE utf8mb4_0900_ai_ci;";

$userSql = "CREATE USER IF NOT EXISTS '" . DB_USER . "'@'localhost'\n"
    . "    IDENTIFIED BY 'CAMBIAR_ESTA_CLAVE';\n\n"
    . "GRANT ALL PRIVILEGES ON `" . DB_NAME . "`.* TO '" . DB_USER . "'@'localhost';\n\n"
    . "FLUSH PRIVILEGES;";

/**
 * Indenta un bloque SQL para mostrarlo en consola.
 */
$indent = static function (string $sql): string {
    return implode("\n", array_map(
        static fn (string $line): string => $line === '' ? '' : '   ' . $line,
        explode("\n", $sql)
    ));
};

$dsn = sprintf('mysql:host=%s;dbname=%s;charset=utf8mb4', DB_HOST, DB_NAME);

echo "=== Diagnóstico de conexión MySQL ===\n\n";

try {
    $pdo = new PDO($dsn, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
} catch (PDOException $error) {
    fwrite(STDERR, "No se pudo conectar a MySQL.\n\n");
    fwrite(STDERR, '  Host:    ' . DB_HOST . "\n");
    fwrite(STDERR, '  Base:    ' . DB_NAME . "\n");
    fwrite(STDERR, '  Usuario: ' . DB_USER . "\n");
    fwrite(STDERR, '  Error:   ' . $error->getMessage() . "\n\n");
    fwrite(STDERR, "Pasos para arreglar el entorno:\n\n");

    fwrite(STDERR, "1) Crear la base de datos (como administrador de MySQL):\n\n");
    fwrite(STDERR, $indent($databaseSql) . "\n\n");

    if ($isRoot) {
        fwrite(STDERR, "2) Dejar el usuario root sin contraseña (o usar un usuario dedicado):\n\n");
        fwrite(STDERR, $indent("sudo mysql -u root -e \"ALTER USER 'root'@'localhost' IDENTIFIED BY '';\"") . "\n\n");
    } else {
        fwrite(STDERR, "2) Crear el usuario y darle permisos sobre la base:\n\n");
        fwrite(STDERR, $indent($userSql) . "\n\n");
    }

    fwrite(STDERR, "3) Verificar el acceso:\n\n");

    $mysqlCommand = DB_PASS === ''
        ? 'mysql -u ' . DB_USER . ' ' . DB_NAME
        : 'mysql -u ' . DB_USER . ' -p ' . DB_NAME;

    fwrite(STDERR, '   ' . $mysqlCommand . "\n\n");
    fwrite(STDERR, "Revisa DB_HOST, DB_NAME, DB_USER y DB_PASS en .env\n");

    exit(1);
}

$version = (string) $pdo->query('SELECT VERSION()')->fetchColumn();

$statement = $pdo->prepare(
    'SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = ?'
);
$statement->execute([DB_NAME]);
$tables = (int) $statement->fetchColumn();

echo 'Conexión OK a ' . DB_NAME . ' con ' . DB_USER . ".\n";
echo 'Versión del servidor MySQL: ' . $version . "\n";
echo 'Tablas en ' . DB_NAME . ': ' . $tables . "\n";

exit(0);
