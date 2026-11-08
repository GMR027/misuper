<?php

declare(strict_types=1);

use App\Middleware\AuthMiddleware;

$usuario = $usuario ?? AuthMiddleware::usuario();

if ($usuario === null) {
    header('Location: /login', true, 302);

    return;
}

$compra = $compra ?? null;

if (
    !is_array($compra)
    || !isset($compra['id'], $compra['fecha'], $compra['total'], $compra['items'])
) {
    header('Location: /historial?error=no_encontrada', true, 302);

    return;
}

$formatearMoneda = static fn (float $valor): string => '$' . number_format($valor, 2, '.', ',');

$formatearCantidad = static function (float $valor): string {
    $texto = number_format($valor, 3, '.', '');
    $texto = rtrim(rtrim($texto, '0'), '.');

    return $texto === '' ? '0' : $texto;
};

$formatearFecha = static function (string $fecha): string {
    $date = DateTimeImmutable::createFromFormat('!Y-m-d', $fecha);

    return $date === false ? $fecha : $date->format('d/m/Y');
};

$hoy = (new DateTimeImmutable('today'))->format('Y-m-d');
$minimo = (new DateTimeImmutable('today'))->modify('-2 years')->format('Y-m-d');

$items = is_array($compra['items']) ? $compra['items'] : [];
$ticketId = isset($compra['ticket_id']) ? (int) $compra['ticket_id'] : 0;
$ticketTitulo = isset($compra['ticket_titulo']) ? trim((string) $compra['ticket_titulo']) : '';
$desdeTicket = ($_GET['ticket'] ?? '') === '1' && $ticketId > 0;
$itemsJson = json_encode(
    $items,
    JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_UNICODE
);

ob_start();
?>
<div
    class="container py-4"
    data-detalle
    data-compra-id="<?= (int) $compra['id'] ?>"
    data-items-iniciales="<?= htmlspecialchars((string) $itemsJson, ENT_QUOTES, 'UTF-8') ?>"
>
    <div class="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
        <div>
            <a class="btn btn-outline-secondary btn-sm mb-2" href="/historial">
                <i class="bi bi-arrow-left" aria-hidden="true"></i>
                Volver al historial
            </a>
            <h2 class="mb-0" data-titulo-compra>
                <span class="title-icon"><i class="bi bi-receipt-cutoff" aria-hidden="true"></i></span>
                Compra del <?= htmlspecialchars($formatearFecha((string) $compra['fecha']), ENT_QUOTES, 'UTF-8') ?>
            </h2>
            <?php if ($ticketTitulo !== ''): ?>
                <p class="text-muted small mb-0 mt-1">
                    <i class="bi bi-receipt-cutoff" aria-hidden="true"></i>
                    Ticket: <?= htmlspecialchars($ticketTitulo, ENT_QUOTES, 'UTF-8') ?>
                </p>
            <?php endif; ?>
        </div>

        <div class="d-flex flex-wrap gap-2">
            <?php if ($ticketId > 0): ?>
                <button
                    class="btn btn-outline-secondary"
                    type="button"
                    data-ticket-foto-open
                    data-ticket-foto-url="/ticket/<?= $ticketId ?>/foto"
                >
                    <i class="bi bi-receipt-cutoff" aria-hidden="true"></i>
                    Ver ticket original
                </button>
            <?php endif; ?>

            <button class="btn btn-outline-danger" type="button" id="btn-delete-compra" data-borrar-compra>
                <i class="bi bi-trash3" aria-hidden="true"></i>
                Borrar compra
            </button>
        </div>
    </div>

    <?php if ($desdeTicket): ?>
        <div class="alert alert-success" role="status">
            Compra registrada desde tu ticket. Revisa los artículos y ajusta lo que necesites.
        </div>
    <?php endif; ?>

    <div class="row g-3 mb-4">
        <div class="col-12 col-md-5">
            <label class="form-label" for="input-fecha">Fecha</label>
            <input
                class="form-control detail-date"
                type="date"
                id="input-fecha"
                value="<?= htmlspecialchars((string) $compra['fecha'], ENT_QUOTES, 'UTF-8') ?>"
                max="<?= htmlspecialchars($hoy, ENT_QUOTES, 'UTF-8') ?>"
                min="<?= htmlspecialchars($minimo, ENT_QUOTES, 'UTF-8') ?>"
                data-fecha-compra
            >
            <p class="form-text">Al cambiar la fecha se guarda automáticamente.</p>
        </div>
        <div class="col-12 col-md-5">
            <label class="form-label" for="input-comercio">Comercio <span class="text-muted">(opcional)</span></label>
            <input
                class="form-control"
                type="text"
                id="input-comercio"
                maxlength="120"
                autocomplete="off"
                value="<?= htmlspecialchars((string) ($compra['comercio'] ?? ''), ENT_QUOTES, 'UTF-8') ?>"
                data-comercio-compra
            >
            <p class="form-text">Sirve para comparar precios entre tiendas.</p>
        </div>
    </div>

    <div class="card card--bs bg-light mb-4">
        <div class="card-body text-center">
            <small class="text-muted d-block">Total</small>
            <h3 class="mb-0" id="total-display" data-total-compra>
                <?= htmlspecialchars($formatearMoneda((float) $compra['total']), ENT_QUOTES, 'UTF-8') ?>
            </h3>
            <?php $kcalTotal = (float) ($compra['kcal_total'] ?? 0); ?>
            <p class="text-muted small mb-0 mt-1" data-total-kcal <?= $kcalTotal > 0 ? '' : 'hidden' ?>>
                ≈ <?= htmlspecialchars(number_format($kcalTotal, 0, '.', ','), ENT_QUOTES, 'UTF-8') ?> kcal
            </p>
            <p class="text-muted small mb-0" data-kcal-aviso <?= (int) ($compra['kcal_sin_dato'] ?? 0) > 0 ? '' : 'hidden' ?>>
                <?= (int) ($compra['kcal_sin_dato'] ?? 0) ?> <?= (int) ($compra['kcal_sin_dato'] ?? 0) === 1 ? 'ítem sin dato' : 'ítems sin dato' ?> de calorías.
            </p>
        </div>
    </div>

    <section aria-labelledby="items-title">
        <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
            <div>
                <h5 class="mb-1" id="items-title">Ítems</h5>
                <p class="text-muted small mb-0">Toca la cantidad o el precio para editarlo.</p>
            </div>

            <button class="btn btn-primary" type="button" id="btn-add-item" data-abrir-agregar>
                <i class="bi bi-plus-lg" aria-hidden="true"></i>
                Agregar ítem
            </button>
        </div>

        <p class="alert alert-info" data-items-vacio <?= $items === [] ? '' : 'hidden' ?>>
            Esta compra no tiene ítems. Agrega uno para empezar.
        </p>

        <ul class="list-group mb-4" id="items-list" data-items>
            <?php foreach ($items as $item): ?>
                <?php
                $itemId = (int) $item['id'];
                $cantidad = (float) $item['cantidad'];
                $precio = (float) $item['precio_total'];
                $unitario = $cantidad > 0 ? $precio / $cantidad : 0.0;
                $unidad = $item['unidad_base'] ?? null;
                $esLibre = ($item['producto_id'] ?? null) === null;
                ?>
                <li
                    class="detail-item list-group-item d-flex flex-wrap align-items-center gap-3"
                    data-item
                    data-item-id="<?= $itemId ?>"
                    data-cantidad="<?= htmlspecialchars((string) $cantidad, ENT_QUOTES, 'UTF-8') ?>"
                    data-precio="<?= htmlspecialchars((string) $precio, ENT_QUOTES, 'UTF-8') ?>"
                >
                    <div class="detail-item__info flex-grow-1">
                        <p class="detail-item__name fw-semibold mb-0">
                            <?= htmlspecialchars((string) $item['nombre'], ENT_QUOTES, 'UTF-8') ?>
                        </p>
                        <p class="detail-item__meta text-muted small mb-0">
                            <?= $esLibre
                                ? 'Ítem libre'
                                : 'Unidad: ' . htmlspecialchars((string) ($unidad ?? ''), ENT_QUOTES, 'UTF-8') ?>
                            <?php if (($item['kcal'] ?? null) !== null): ?>
                                · ≈ <?= htmlspecialchars(number_format((float) $item['kcal'], 0, '.', ','), ENT_QUOTES, 'UTF-8') ?> kcal
                            <?php endif; ?>
                        </p>
                    </div>

                    <div class="detail-item__fields d-flex flex-wrap align-items-center gap-2">
                        <span class="detail-item__field d-flex flex-column">
                            <span class="detail-item__caption text-uppercase text-muted small">Cantidad</span>
                            <button
                                class="detail-item__value btn btn-outline-secondary btn-sm text-start"
                                type="button"
                                data-edit="cantidad"
                                data-item-id="<?= $itemId ?>"
                            >
                                <?= htmlspecialchars($formatearCantidad($cantidad), ENT_QUOTES, 'UTF-8') ?>
                            </button>
                        </span>

                        <span class="detail-item__field d-flex flex-column">
                            <span class="detail-item__caption text-uppercase text-muted small">Precio</span>
                            <button
                                class="detail-item__value btn btn-outline-secondary btn-sm text-start"
                                type="button"
                                data-edit="precio_total"
                                data-item-id="<?= $itemId ?>"
                            >
                                <?= htmlspecialchars($formatearMoneda($precio), ENT_QUOTES, 'UTF-8') ?>
                            </button>
                        </span>

                        <span class="detail-item__field detail-item__field--unit d-flex flex-column">
                            <span class="detail-item__caption text-uppercase text-muted small">Unitario</span>
                            <span class="detail-item__unit-price badge text-bg-light text-start fw-semibold">
                                <?= htmlspecialchars($formatearMoneda($unitario), ENT_QUOTES, 'UTF-8') ?><?= $esLibre
                                    ? ''
                                    : ' / ' . htmlspecialchars((string) ($unidad ?? ''), ENT_QUOTES, 'UTF-8') ?>
                            </span>
                        </span>
                    </div>

                    <button
                        class="detail-item__remove btn btn-sm btn-outline-danger"
                        type="button"
                        data-remove-item
                        data-item-id="<?= $itemId ?>"
                        aria-label="Borrar <?= htmlspecialchars((string) $item['nombre'], ENT_QUOTES, 'UTF-8') ?>"
                    >
                        ×
                    </button>
                </li>
            <?php endforeach; ?>
        </ul>
    </section>
</div>

<div class="app-modal" data-modal-agregar hidden role="dialog" aria-modal="true" aria-labelledby="agregar-title">
    <div class="modal-dialog modal-dialog-centered">
        <form class="modal-content" data-form-agregar novalidate>
            <div class="modal-body p-4">
                <h5 class="modal-title mb-2" id="agregar-title">Agregar ítem</h5>
                <p class="text-muted small">
                    Busca un producto del catálogo o escribe un ítem libre.
                </p>

                <div class="mb-2">
                    <label class="form-label" for="agregar-buscar">Buscar producto</label>
                    <input
                        class="form-control"
                        type="search"
                        id="agregar-buscar"
                        autocomplete="off"
                        placeholder="Leche, arroz, jitomate…"
                        data-agregar-buscar
                    >
                </div>

                <p class="form-text" data-agregar-status>Escribe al menos 2 caracteres.</p>
                <ul class="add-results list-group" data-agregar-resultados></ul>

                <div
                    class="add-selected alert alert-success d-flex flex-wrap justify-content-between align-items-center gap-2"
                    data-agregar-seleccion
                    hidden
                >
                    <p class="mb-0 small">
                        Seleccionado: <strong data-agregar-seleccion-nombre></strong>
                        <span class="text-muted" data-agregar-seleccion-unidad></span>
                    </p>
                    <button class="btn btn-sm btn-outline-secondary" type="button" data-agregar-quitar>
                        Quitar selección
                    </button>
                </div>

                <div class="add-divider"><span>o ítem libre</span></div>

                <div class="mb-2">
                    <label class="form-label" for="agregar-libre">Nombre del ítem libre</label>
                    <input
                        class="form-control"
                        type="text"
                        id="agregar-libre"
                        maxlength="150"
                        minlength="2"
                        autocomplete="off"
                        data-agregar-libre
                    >
                </div>

                <div class="row g-2">
                    <div class="col-12 col-sm-4">
                        <label class="form-label" for="agregar-unidad">Unidad base</label>
                        <select class="form-select" id="agregar-unidad" data-agregar-unidad>
                            <option value="kg">kg — kilogramo</option>
                            <option value="gr">gr — gramo</option>
                            <option value="L">L — litro</option>
                            <option value="ml">ml — mililitro</option>
                            <option value="pza" selected>pza — pieza</option>
                        </select>
                    </div>

                    <div class="col-6 col-sm-4">
                        <label class="form-label" for="agregar-cantidad">Cantidad</label>
                        <input
                            class="form-control"
                            type="number"
                            id="agregar-cantidad"
                            min="0.001"
                            step="0.001"
                            inputmode="decimal"
                            value="1"
                            data-agregar-cantidad
                        >
                    </div>

                    <div class="col-6 col-sm-4">
                        <label class="form-label" for="agregar-precio">Precio total</label>
                        <input
                            class="form-control"
                            type="number"
                            id="agregar-precio"
                            min="0"
                            step="0.01"
                            inputmode="decimal"
                            placeholder="0.00"
                            data-agregar-precio
                        >
                    </div>
                </div>

                <p class="form__message mt-3 mb-0" data-agregar-error hidden></p>
            </div>

            <div class="modal-footer">
                <button class="btn btn-outline-secondary" type="button" data-cerrar-agregar>Cancelar</button>
                <button class="btn btn-primary" type="submit">Agregar ítem</button>
            </div>
        </form>
    </div>
</div>

<div class="app-modal ticket-photo-modal" data-ticket-foto-modal hidden role="dialog" aria-modal="true" aria-label="Ticket original">
    <button class="ticket-photo-modal__close" type="button" data-ticket-foto-close aria-label="Cerrar foto del ticket">
        <i class="bi bi-x-lg" aria-hidden="true"></i>
    </button>
    <img class="ticket-photo-modal__img" alt="Foto del ticket original" data-ticket-foto-img>
</div>

<div class="toast-stack" data-toast-stack aria-live="polite"></div>
<?php

$content = (string) ob_get_clean();
$title = 'Detalle de compra';
$scripts = ['/assets/js/pages/compra-detalle.js'];
$styles = ['/assets/css/pantalla-rapida.css', '/assets/css/historial.css'];
$active = 'historial';

require __DIR__ . '/../layouts/app.php';
