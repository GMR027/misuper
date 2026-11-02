# Mi Súper

App web personal para registrar las compras del súper, consultar el gasto mensual
y ver en qué productos se va el dinero.

## Tickets de compra

La sección **Ticket** permite subir una foto del ticket (cámara o galería).
El servidor la lee con Tesseract, propone fecha, artículos, cantidades y precios,
y los relaciona con el catálogo. El usuario revisa la propuesta antes de guardar.
Las compras confirmadas aparecen en el historial con el badge **Ticket** y la foto
original queda enlazada desde el detalle de la compra.

## Stack

- PHP 8.1+ con PDO
- MySQL 8
- HTML, CSS y JavaScript vanilla (módulos ES6)
- Bootstrap 5.3 vía CDN

## Requisitos

- PHP 8.1 o superior con las extensiones `pdo_mysql`, `mbstring`, `fileinfo` y `gd`
- MySQL 8
- Composer (solo para generar el autoload)
- Tesseract OCR con el idioma español (para leer tickets de compra)

En Debian/Ubuntu:

```bash
sudo apt install tesseract-ocr tesseract-ocr-spa
```

Si el binario está en una ruta distinta, define `TESSERACT_BIN=/ruta/a/tesseract`
en `.env`. La imagen Docker ya incluye Tesseract y el idioma español.

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

## Despliegue en Kubernetes

Requisitos: `docker` con sesión en Docker Hub, `helm`, `kubectl` y acceso al
namespace `misuper`.

```bash
./deploy.sh        # tag auto-incremental
./deploy.sh 12     # tag concreto
```

El script:

1. Genera `helm/misuper/values.local.yaml` con contraseñas aleatorias si no
   existe (archivo no versionado; consérvalo).
2. Construye y publica `gmr27/misuper:<tag>` y `:latest`.
3. Ejecuta `helm upgrade --install` en el namespace `misuper`.
4. Aplica las migraciones pendientes en el `initContainer` de la app.
5. Espera el rollout de MySQL y de la app.

- URL: https://misuper.iguzman.com.mx
- Chart: `helm/misuper`
- MySQL 8 en el clúster, datos en el PVC `misuper-mysql-data`.
- Fotos de avatares, notas y tickets en el PVC `misuper-uploads`.
- TLS automático con cert-manager (`letsencrypt-prod`).

La base de datos y los uploads viven en PVCs, así que los upgrades no los
tocan. Para un clúster nuevo, después del primer despliegue importa el dump o
crea el Admin con:

```bash
kubectl -n misuper exec -it deploy/misuper -- \
  sh -c 'ADMIN_PASSWORD="una-contraseña-segura" php scripts/seed.php'
```

## Seguridad

- `.env` no se versiona. Usa `.env.example` como plantilla.
- `storage/logs/`, `database/backups/` y los archivos subidos en
  `public/uploads/` se excluyen del repositorio.
- No hay contraseñas ni tokens en el código ni en el dump.
- En producción usa HTTPS, un usuario de MySQL dedicado con permisos solo sobre
  la base de la app y contraseñas fuertes.
- `scripts/check_db.php` ayuda a diagnosticar la conexión.
