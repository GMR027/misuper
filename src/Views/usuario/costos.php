<?php

declare(strict_types=1);

use App\Middleware\AuthMiddleware;

$usuario = $usuario ?? AuthMiddleware::usuario();

if ($usuario === null) {
    header('Location: /login', true, 302);

    return;
}

ob_start();
?>
<div class="container py-4" data-costos>
    <div class="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
        <div>
            <h2 class="mb-1">
                <span class="title-icon"><i class="bi bi-tags-fill" aria-hidden="true"></i></span>
                Precios y costos
            </h2>
            <p class="text-muted mb-0">
                Precios calculados con tus compras y tickets. Si no hay datos, se muestran
                como faltantes; nunca se inventan.
            </p>
        </div>
        <a class="btn btn-outline-secondary" href="/metricas">
            <i class="bi bi-graph-up-arrow" aria-hidden="true"></i>
            Ver gasto
        </a>
    </div>

    <div class="row g-3 mb-4" data-costos-resumen>
        <div class="col-6 col-lg-3">
            <div class="card h-100 costos-stat">
                <div class="card-body">
                    <span class="costos-stat__label">Productos</span>
                    <strong class="costos-stat__value" data-stat-total>—</strong>
                </div>
            </div>
        </div>
        <div class="col-6 col-lg-3">
            <div class="card h-100 costos-stat">
                <div class="card-body">
                    <span class="costos-stat__label">Con precio</span>
                    <strong class="costos-stat__value text-success" data-stat-con-precio>—</strong>
                </div>
            </div>
        </div>
        <div class="col-6 col-lg-3">
            <div class="card h-100 costos-stat">
                <div class="card-body">
                    <span class="costos-stat__label">Sin precio</span>
                    <strong class="costos-stat__value text-warning" data-stat-sin-precio>—</strong>
                </div>
            </div>
        </div>
        <div class="col-6 col-lg-3">
            <div class="card h-100 costos-stat">
                <div class="card-body">
                    <span class="costos-stat__label">Precios viejos</span>
                    <strong class="costos-stat__value text-danger" data-stat-viejos>—</strong>
                </div>
            </div>
        </div>
    </div>

    <section aria-labelledby="costos-lista-title">
        <div class="d-flex flex-wrap justify-content-between align-items-end gap-3 mb-3">
            <div>
                <h5 class="mb-1" id="costos-lista-title">Precio por producto</h5>
                <p class="text-muted small mb-0" data-costos-status aria-live="polite">
                    Cargando precios…
                </p>
            </div>
            <div class="costos-filtros">
                <label class="visually-hidden" for="costos-buscar">Buscar producto</label>
                <input
                    class="form-control"
                    type="search"
                    id="costos-buscar"
                    placeholder="Buscar producto…"
                    autocomplete="off"
                    data-costos-buscar
                >
                <label class="visually-hidden" for="costos-estado">Filtrar por estado</label>
                <select class="form-select" id="costos-estado" data-costos-estado>
                    <option value="todos">Todos</option>
                    <option value="con-precio">Con precio</option>
                    <option value="sin-precio">Sin precio</option>
                    <option value="viejos">Precios viejos</option>
                    <option value="manuales">Precio manual</option>
                </select>
            </div>
        </div>

        <div class="costos-list" data-costos-lista></div>

        <p class="text-muted small mt-3 mb-0" data-costos-vacio hidden>
            No hay productos que coincidan con el filtro.
        </p>
    </section>
</div>

<div class="app-modal" data-precio-modal hidden role="dialog" aria-modal="true" aria-labelledby="precio-modal-title">
    <div class="modal-dialog modal-dialog-centered modal-lg">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="precio-modal-title" data-precio-modal-title>Precio</h5>
                <button class="btn-close" type="button" data-precio-cerrar aria-label="Cerrar"></button>
            </div>
            <div class="modal-body" data-precio-modal-body>
                <p class="text-muted small mb-0">Cargando historial…</p>
            </div>
            <div class="modal-footer">
                <button class="btn btn-outline-secondary" type="button" data-precio-cerrar>Cerrar</button>
            </div>
        </div>
    </div>
</div>

<div class="toast-stack" data-toast-stack aria-live="polite"></div>
<?php

$content = (string) ob_get_clean();
$title = 'Precios y costos';
$scripts = ['/assets/js/pages/costos.js'];
$styles = ['/assets/css/pantalla-rapida.css', '/assets/css/costos.css'];
$active = 'costos';

require __DIR__ . '/../layouts/app.php';
