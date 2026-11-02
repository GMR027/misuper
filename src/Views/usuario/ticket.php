<?php

declare(strict_types=1);

use App\Middleware\AuthMiddleware;

$usuario = $usuario ?? AuthMiddleware::usuario();

if ($usuario === null) {
    header('Location: /login', true, 302);

    return;
}

$hoy = (new DateTimeImmutable('today'))->format('Y-m-d');
$minimo = (new DateTimeImmutable('today'))->modify('-2 years')->format('Y-m-d');

ob_start();
?>
<div class="container py-4" data-ticket data-ticket-hoy="<?= htmlspecialchars($hoy, ENT_QUOTES, 'UTF-8') ?>">
    <div class="notes-head">
        <div>
            <h2 class="mb-1">
                <span class="title-icon"><i class="bi bi-receipt-cutoff" aria-hidden="true"></i></span>
                Ticket
            </h2>
            <p class="text-muted mb-0">
                Sube una foto de tu ticket y registra la compra sin capturar todo a mano.
            </p>
        </div>
    </div>

    <section class="ticket-upload" data-ticket-drop aria-labelledby="ticket-upload-title">
        <div class="ticket-upload__inner">
            <span class="ticket-upload__icon" aria-hidden="true">
                <i class="bi bi-receipt"></i>
            </span>

            <h3 class="ticket-upload__title" id="ticket-upload-title">Sube tu ticket de compra</h3>
            <p class="ticket-upload__text">
                Toma una foto o elige una imagen de tu galería. La leeremos y te propondremos
                los artículos para que los revises.
            </p>

            <div class="ticket-upload__actions">
                <label class="btn btn-primary ticket-upload__btn" for="ticket-camara">
                    <i class="bi bi-camera-fill" aria-hidden="true"></i>
                    Tomar foto
                </label>
                <input
                    class="visually-hidden"
                    type="file"
                    id="ticket-camara"
                    accept="image/*"
                    capture="environment"
                    data-ticket-input
                >

                <label class="btn btn-outline-primary ticket-upload__btn" for="ticket-galeria">
                    <i class="bi bi-images" aria-hidden="true"></i>
                    Elegir de galería
                </label>
                <input
                    class="visually-hidden"
                    type="file"
                    id="ticket-galeria"
                    accept="image/jpeg,image/png,image/webp,image/*"
                    data-ticket-input
                >
            </div>

            <p class="ticket-upload__hint">
                JPG, PNG o WebP · máximo 8 MB · también puedes arrastrar la imagen aquí.
            </p>

            <div class="ticket-preview" data-ticket-preview hidden>
                <img class="ticket-preview__img" alt="Vista previa del ticket" data-ticket-preview-img>
                <div class="ticket-preview__foot">
                    <span class="ticket-preview__name" data-ticket-file-name></span>
                    <button class="btn btn-sm btn-outline-secondary" type="button" data-ticket-quitar>
                        Quitar
                    </button>
                </div>
            </div>

            <p class="form__message ticket-upload__status" data-ticket-status hidden aria-live="polite"></p>

            <button class="btn btn-success ticket-upload__read" type="button" data-ticket-leer hidden>
                <i class="bi bi-magic" aria-hidden="true"></i>
                Leer ticket
            </button>
        </div>
    </section>

    <section class="ticket-review" data-ticket-revision hidden aria-labelledby="ticket-review-title">
        <div class="ticket-review__head">
            <div>
                <h3 class="ticket-review__title" id="ticket-review-title">
                    <i class="bi bi-check2-square" aria-hidden="true"></i>
                    Revisa el ticket
                </h3>
                <p class="text-muted small mb-0">
                    Corrige lo que haga falta. La compra se guardará en tu historial al confirmar.
                </p>
            </div>
            <button class="btn btn-outline-secondary" type="button" data-ticket-otra>
                <i class="bi bi-arrow-repeat" aria-hidden="true"></i>
                Elegir otra imagen
            </button>
        </div>

        <div class="ticket-review__summary">
            <div class="ticket-review__field">
                <label class="form-label" for="ticket-fecha">Fecha de la compra</label>
                <input
                    class="form-control"
                    type="date"
                    id="ticket-fecha"
                    value="<?= htmlspecialchars($hoy, ENT_QUOTES, 'UTF-8') ?>"
                    min="<?= htmlspecialchars($minimo, ENT_QUOTES, 'UTF-8') ?>"
                    max="<?= htmlspecialchars($hoy, ENT_QUOTES, 'UTF-8') ?>"
                    data-ticket-fecha
                >
            </div>
            <div class="ticket-review__metric">
                <span class="ticket-review__caption">Total detectado</span>
                <strong class="ticket-review__value" data-ticket-total-detectado>—</strong>
            </div>
            <div class="ticket-review__metric">
                <span class="ticket-review__caption">Suma de artículos</span>
                <strong class="ticket-review__value" data-ticket-suma>$0.00</strong>
            </div>
        </div>

        <p class="alert alert-warning" data-ticket-total-warning hidden></p>
        <p class="alert alert-info" data-ticket-vacio hidden>
            No se detectaron artículos con claridad. Agrega los que aparezcan en tu ticket.
        </p>

        <ul class="ticket-items list-unstyled" data-ticket-items></ul>

        <div class="ticket-review__actions">
            <button class="btn btn-outline-primary" type="button" data-ticket-add>
                <i class="bi bi-plus-lg" aria-hidden="true"></i>
                Agregar artículo
            </button>
            <button class="btn btn-success" type="button" data-ticket-guardar>
                <i class="bi bi-check2-circle" aria-hidden="true"></i>
                Guardar compra
            </button>
        </div>

        <p class="form__message mt-3 mb-0" data-ticket-mensaje hidden aria-live="polite"></p>

        <details class="ticket-raw">
            <summary>Ver texto reconocido por el OCR</summary>
            <pre class="ticket-raw__text" data-ticket-texto></pre>
        </details>
    </section>

<template data-ticket-item-template>
    <li class="ticket-item" data-ticket-item>
        <div class="ticket-item__head">
            <span class="ticket-item__index" data-ticket-index>1</span>
            <span class="ticket-item__confidence badge" data-ticket-confianza hidden></span>
            <button class="ticket-item__remove" type="button" data-ticket-remove aria-label="Quitar artículo">
                <i class="bi bi-x-lg" aria-hidden="true"></i>
            </button>
        </div>

        <div class="ticket-item__grid">
            <label class="ticket-item__field ticket-item__field--name">
                <span>Nombre en el ticket</span>
                <input class="form-control" type="text" maxlength="150" autocomplete="off" data-ticket-nombre>
            </label>

            <label class="ticket-item__field ticket-item__field--product">
                <span>Producto del catálogo</span>
                <select class="form-select" data-ticket-producto>
                    <option value="">Sin catalogar (usar nombre del ticket)</option>
                </select>
                <span class="ticket-item__hint text-muted" data-ticket-sugerencias hidden></span>
            </label>

            <label class="ticket-item__field">
                <span>Cantidad</span>
                <input
                    class="form-control"
                    type="number"
                    min="0.001"
                    step="0.001"
                    inputmode="decimal"
                    value="1"
                    data-ticket-cantidad
                >
            </label>

            <label class="ticket-item__field">
                <span>Precio total</span>
                <span class="input-group">
                    <span class="input-group-text">$</span>
                    <input
                        class="form-control"
                        type="number"
                        min="0"
                        step="0.01"
                        inputmode="decimal"
                        value="0.00"
                        data-ticket-precio
                    >
                </span>
            </label>
        </div>
    </li>
</template>
</div>

<div class="toast-stack" data-toast-stack aria-live="polite"></div>
<?php

$content = (string) ob_get_clean();
$title = 'Ticket';
$scripts = ['/assets/js/pages/ticket.js'];
$styles = ['/assets/css/pantalla-rapida.css', '/assets/css/notas.css', '/assets/css/ticket.css'];
$active = 'ticket';

require __DIR__ . '/../layouts/app.php';
