# ===========================================================================
# Dockerfile — Mi Súper (PHP 8.3 + Apache)
#
# Multi-etapa:
#   1. composer → genera el autoloader de producción (vendor/)
#   2. runtime  → php:8.3-apache con pdo_mysql + mbstring y el código
#
# Build:  docker build -t gmr27/misuper:<tag> .
# La app no necesita .env dentro de la imagen: la configuración llega por
# variables de entorno desde Kubernetes (DB_HOST, DB_NAME, DB_USER, DB_PASS…).
# ===========================================================================

# ---------------------------------------------------------------------------
# Etapa 1: dependencias de Composer
# ---------------------------------------------------------------------------
FROM composer:2 AS composer

WORKDIR /app
COPY composer.json ./
RUN composer install \
      --no-dev \
      --no-interaction \
      --no-scripts \
      --prefer-dist \
      --optimize-autoloader

# ---------------------------------------------------------------------------
# Etapa 2: runtime Apache + PHP
# ---------------------------------------------------------------------------
FROM php:8.3-apache

# Extensiones:
#   pdo_mysql → conexión PDO a MySQL
#   mbstring  → normalización de textos (acentos, búsquedas, contraseñas)
#   gd        → preprocesado de las fotos de tickets antes del OCR
# fileinfo viene compilado en la imagen oficial (validación MIME real de fotos).
# Tesseract + traineddata español se usan para leer los tickets de compra.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      libonig-dev libpng-dev libjpeg62-turbo-dev libfreetype6-dev libwebp-dev \
      tesseract-ocr tesseract-ocr-spa \
 && docker-php-ext-configure gd --with-freetype --with-jpeg --with-webp \
 && docker-php-ext-install -j"$(nproc)" pdo_mysql mbstring gd \
 && apt-get clean \
 && rm -rf /var/lib/apt/lists/*

# Front controller: DocumentRoot en /public y fallback a index.php para las
# rutas limpias (/login, /historial, /api/...).
RUN a2enmod rewrite headers \
 && sed -ri 's!/var/www/html!/var/www/html/public!g' /etc/apache2/sites-available/*.conf \
 && printf '%s\n' \
      '<Directory /var/www/html/public>' \
      '    AllowOverride All' \
      '    Require all granted' \
      '    FallbackResource /index.php' \
      '</Directory>' \
      > /etc/apache2/conf-available/misuper.conf \
 && a2enconf misuper

# Límites para fotos de notas/avatares (máx. 2 MB) y tickets (máx. 8 MB).
RUN { \
      echo 'date.timezone = America/Mexico_City'; \
      echo 'upload_max_filesize = 12M'; \
      echo 'post_max_size = 14M'; \
      echo 'memory_limit = 256M'; \
      echo 'max_execution_time = 120'; \
    } > /usr/local/etc/php/conf.d/misuper.ini

WORKDIR /var/www/html

# Código de la aplicación (el .env y los datos locales quedan fuera por .dockerignore).
COPY --chown=www-data:www-data . /var/www/html

# Autoloader generado en la etapa 1.
COPY --from=composer --chown=www-data:www-data /app/vendor /var/www/html/vendor

# Carpetas escribibles por Apache/PHP.
RUN mkdir -p public/uploads/avatars public/uploads/notas public/uploads/tickets storage/logs \
 && chown -R www-data:www-data public/uploads storage \
 && chmod -R ug+rwX public/uploads storage

EXPOSE 80
