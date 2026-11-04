<?php

declare(strict_types=1);

use App\Middleware\AuthMiddleware;

$usuario = $usuario ?? AuthMiddleware::usuario();

if ($usuario === null) {
    header('Location: /login', true, 302);

    return;
}

if (($usuario['debe_cambiar_password'] ?? false) === true) {
    header('Location: /cambiar-password-forzado', true, 302);

    return;
}

ob_start();
?>
<div class="container py-4" data-recetas>
    <div class="recipe-head">
        <div>
            <h2 class="mb-1">
                <span class="title-icon"><i class="bi bi-egg-fried" aria-hidden="true"></i></span>
                Recetas
            </h2>
            <p class="text-muted mb-0">
                Ideas de cocina con los productos que has comprado. Elige recetas y arma tu lista de compras.
            </p>
        </div>

        <div class="d-flex flex-wrap gap-2">
            <a class="btn btn-outline-secondary" href="/recetas/proponer">
                <i class="bi bi-plus-circle" aria-hidden="true"></i>
                Proponer receta
            </a>
            <a class="btn btn-outline-primary" href="/lista-compras">
                <i class="bi bi-cart-check" aria-hidden="true"></i>
                Productos por comprar
                <span class="badge text-bg-primary" data-lista-count hidden></span>
            </a>
        </div>
    </div>

    <?php if (($_GET['propuesta'] ?? '') === '1'): ?>
        <div class="alert alert-success" role="status">
            Receta enviada. El administrador la revisará antes de publicarla en el catálogo.
        </div>
    <?php endif; ?>

    <section class="card recipe-filters mb-4" aria-label="Filtros de recetas">
        <div class="card-body">
            <div class="row g-3 align-items-end">
                <div class="col-12 col-lg-6">
                    <label class="form-label" for="receta-q">Buscar</label>
                    <div class="recipe-search">
                        <i class="bi bi-search" aria-hidden="true"></i>
                        <input
                            class="form-control"
                            type="search"
                            id="receta-q"
                            placeholder="Nombre o ingrediente…"
                            autocomplete="off"
                            data-receta-buscar
                        >
                    </div>
                </div>

                <div class="col-6 col-lg-2">
                    <label class="form-label" for="receta-tiempo">Tiempo</label>
                    <select class="form-select" id="receta-tiempo" data-receta-tiempo>
                        <option value="">Cualquiera</option>
                        <option value="15">Hasta 15 min</option>
                        <option value="30">Hasta 30 min</option>
                        <option value="60">Hasta 60 min</option>
                    </select>
                </div>

                <div class="col-12 col-lg-4">
                    <div class="recipe-switches" role="group" aria-label="Preferencias de recetas">
                        <div class="form-check form-switch recipe-switch">
                            <input class="form-check-input" type="checkbox" role="switch" id="receta-solo-despensa" data-receta-solo>
                            <label class="form-check-label" for="receta-solo-despensa" title="Usa los productos de tu última compra">
                                Solo con lo que he comprado
                            </label>
                        </div>
                        <div class="form-check form-switch recipe-switch">
                            <input class="form-check-input" type="checkbox" role="switch" id="receta-favoritas" data-receta-favoritas>
                            <label class="form-check-label" for="receta-favoritas" title="Muestra únicamente tus recetas favoritas">
                                Solo mis favoritas
                            </label>
                        </div>
                    </div>
                </div>
            </div>

            <div class="mt-3">
                <p class="form-label mb-2">Categoría</p>
                <div class="recipe-type-chips" data-receta-categorias role="group" aria-label="Filtrar por categoría de platillo">
                    <span class="text-muted small">Cargando categorías…</span>
                </div>
            </div>

            <div class="mt-3">
                <p class="form-label mb-2">Tipo de dieta</p>
                <div class="recipe-type-chips" data-receta-tipos role="group" aria-label="Filtrar por tipo de receta">
                    <span class="text-muted small">Cargando tipos…</span>
                </div>
            </div>

            <p class="recipe-type-note mt-2 mb-0" data-receta-tipo-aviso hidden></p>
        </div>
    </section>

    <div class="recipe-selection" data-seleccion hidden>
        <div class="recipe-selection__head">
            <span class="recipe-tray__title">
                <i class="bi bi-basket2-fill" aria-hidden="true"></i>
                <span data-seleccion-count>0 recetas seleccionadas</span>
            </span>
            <div class="d-flex gap-2">
                <button class="btn btn-sm btn-outline-secondary" type="button" data-seleccion-limpiar>
                    Limpiar
                </button>
                <button class="btn btn-sm btn-primary" type="button" data-preview>
                    <i class="bi bi-list-check" aria-hidden="true"></i>
                    Generar lista
                </button>
            </div>
        </div>
        <div class="recipe-tray__items" data-seleccion-items></div>
    </div>

    <div class="d-flex flex-wrap justify-content-between align-items-baseline gap-2 mb-2">
        <p class="text-muted small mb-0" data-recetas-despensa></p>
        <p class="text-muted small mb-0" data-recetas-status aria-live="polite">Cargando recetas…</p>
    </div>

    <div class="row g-3" data-recetas-grid></div>

    <div class="recipe-empty alert alert-info mt-3" data-recetas-empty hidden></div>

</div>

<div class="app-modal" data-receta-modal hidden role="dialog" aria-modal="true" aria-labelledby="receta-detalle-title">
    <div class="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
        <div class="modal-content" data-receta-detalle>
            <div class="modal-header">
                <h5 class="modal-title" id="receta-detalle-title" data-receta-detalle-title>Receta</h5>
                <button class="btn-close" type="button" aria-label="Cerrar" data-receta-cerrar></button>
            </div>
            <div class="modal-body p-4" data-receta-detalle-body>
                <p class="text-muted small mb-0">Cargando receta…</p>
            </div>
            <div class="modal-footer" data-receta-detalle-footer></div>
        </div>
    </div>
</div>

<div class="app-modal" data-preview-modal hidden role="dialog" aria-modal="true" aria-labelledby="preview-lista-title">
    <div class="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="preview-lista-title">Productos para tus recetas</h5>
                <button class="btn-close" type="button" aria-label="Cerrar" data-preview-cerrar></button>
            </div>
            <div class="modal-body p-4">
                <div class="mb-3">
                    <label class="form-label" for="preview-lista-select">Guardar en</label>
                    <select class="form-select" id="preview-lista-select" data-preview-lista>
                        <option value="">Cargando listas…</option>
                    </select>
                    <input
                        class="form-control mt-2"
                        type="text"
                        maxlength="100"
                        placeholder="Nombre de la nueva lista"
                        data-preview-nueva
                        hidden
                    >
                </div>
                <p class="text-muted small" data-preview-resumen></p>
                <p class="text-muted small" data-preview-status></p>
                <div class="recipe-preview-list" data-preview-items></div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-outline-secondary" type="button" data-preview-cerrar>Cancelar</button>
                <button class="btn btn-primary" type="button" data-preview-guardar>
                    <i class="bi bi-cart-plus" aria-hidden="true"></i>
                    Guardar en Productos por comprar
                </button>
            </div>
        </div>
    </div>
</div>

<div class="toast-stack" data-toast-stack aria-live="polite"></div>
<?php

$content = (string) ob_get_clean();
$title = 'Recetas';
$scripts = ['/assets/js/pages/recetas.js'];
$styles = ['/assets/css/pantalla-rapida.css', '/assets/css/recetas.css'];
$active = 'recetas';

require __DIR__ . '/../layouts/app.php';
