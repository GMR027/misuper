# Mi Súper

App web personal para registrar las compras del súper, consultar el gasto mensual
y ver en qué productos se va el dinero.

## Stack

- PHP 8.1+ con PDO
- MySQL 8
- HTML, CSS y JavaScript vanilla (módulos ES6)
- Bootstrap 5.3 vía CDN

## Requisitos

- PHP 8.1 o superior con las extensiones `pdo_mysql` y `fileinfo`
- MySQL 8
- Composer (solo para generar el autoload)

## Instalación

```bash
composer install
cp .env.example .env
```

Edita `.env` con los datos de tu base de datos y define el Admin inicial:

```dotenv
DB_HOST=127.0.0.1
DB_NAME=despensa_app
DB_USER=app_user
DB_PASS=tu_password

APP_ENV=local
APP_URL=http://localhost:8000
SESSION_LIFETIME=604800

ADMIN_EMAIL=admin@misuper.local
ADMIN_PASSWORD=una-contraseña-segura
```

### Base de datos

Opción A: importar el dump completo (esquema + 8 categorías + 200 productos).

```bash
mysql -u root -p < misuper_db_despensa_app_2026-11-01.sql
```

Opción B: crear el esquema por migraciones.

```bash
php scripts/migrate.php
php scripts/importar_productos.php
```

En ambos casos, crea el Admin inicial y las categorías con:

```bash
php scripts/seed.php
```

Si `ADMIN_PASSWORD` está vacío, el seed genera una contraseña temporal aleatoria
y la muestra una sola vez en la consola. El Admin deberá cambiarla al entrar.

### Servidor local

```bash
composer serve
# o: php -S localhost:8000 -t public
```

Abre http://localhost:8000.

## Seguridad

- `.env` no se versiona. Usa `.env.example` como plantilla.
- `storage/logs/`, `database/backups/` y los archivos subidos en
  `public/uploads/` se excluyen del repositorio.
- No hay contraseñas ni tokens en el código ni en el dump.
- En producción usa HTTPS, un usuario de MySQL dedicado con permisos solo sobre
  la base de la app y contraseñas fuertes.
- `scripts/check_db.php` ayuda a diagnosticar la conexión.
