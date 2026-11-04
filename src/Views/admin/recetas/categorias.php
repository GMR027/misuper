<?php

declare(strict_types=1);

use App\Middleware\AdminMiddleware;

$usuario = AdminMiddleware::usuarioWeb();

if ($usuario === null) {
    return;
}

ob_start();
?>
<div class="container py-4" data-admin-categorias>
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
        <div>
            <h2 class="mb-1">
                <span class="title-icon"><i class="bi bi-grid-3x3-gap-fill" aria-hidden="true"></i></span>
                Categorías de recetas
            </h2>
            <p class="text-muted mb-0">
                Organiza el recetario por tipo de platillo: bebidas, guisados, ensaladas y más.
            </p>
        </div>

        <div class="d-flex flex-wrap gap-2">
            <a class="btn btn-outline-secondary" href="/admin/recetas">
                <i class="bi bi-arrow-left" aria-hidden="true"></i>
                Volver al catálogo
            </a>
            <button class="btn btn-primary" type="button" data-categoria-nuevo>
                <i class="bi bi-plus-lg" aria-hidden="true"></i>
                Nueva categoría
            </button>
        </div>
    </div>

    <div class="card mb-4">
        <div class="card-body">
            <p class="text-muted small mb-0" data-categorias-status aria-live="polite">
                Cargando categorías…
            </p>
        </div>
    </div>

    <div class="table-responsive">
        <table class="table table-hover align-middle">
            <thead class="table-light">
                <tr>
                    <th scope="col">Categoría</th>
                    <th scope="col">Slug</th>
                    <th scope="col">Descripción</th>
                    <th scope="col" class="text-center">Orden</th>
                    <th class="text-end" scope="col">Acciones</th>
                </tr>
            </thead>
            <tbody data-categorias-body>
                <tr>
                    <td class="text-center text-muted py-4" colspan="5">Cargando categorías…</td>
                </tr>
            </tbody>
        </table>
    </div>

    <p class="form__message mt-3" data-categorias-mensaje hidden></p>
</div>

<div class="modal fade" id="categoria-modal" tabindex="-1" aria-labelledby="categoria-modal-title" aria-hidden="true" data-categoria-modal>
    <div class="modal-dialog modal-dialog-centered modal-lg">
        <div class="modal-content">
            <form data-categoria-form novalidate>
                <div class="modal-header">
                    <h2 class="modal-title fs-5" id="categoria-modal-title" data-categoria-modal-title>Nueva categoría</h2>
                    <button class="btn-close" type="button" data-bs-dismiss="modal" aria-label="Cerrar"></button>
                </div>
                <div class="modal-body p-4">
                    <input type="hidden" data-categoria-id>

                    <div class="row g-3">
                        <div class="col-12 col-md-7">
                            <label class="form-label" for="categoria-nombre">Nombre</label>
                            <input class="form-control" type="text" id="categoria-nombre" maxlength="80" required data-categoria-nombre>
                        </div>
                        <div class="col-12 col-md-5">
                            <label class="form-label" for="categoria-icono">Icono de Bootstrap</label>
                            <input class="form-control" type="text" id="categoria-icono" maxlength="80" placeholder="bi-tag" data-categoria-icono>
                            <p class="text-muted small mt-1 mb-0">Ej. bi-cup-straw, bi-fire, bi-flower2.</p>
                        </div>
                        <div class="col-12 col-md-9">
                            <label class="form-label" for="categoria-descripcion">Descripción</label>
                            <input class="form-control" type="text" id="categoria-descripcion" maxlength="255" data-categoria-descripcion>
                        </div>
                        <div class="col-12 col-md-3">
                            <label class="form-label" for="categoria-orden">Orden</label>
                            <input class="form-control" type="number" id="categoria-orden" min="0" max="999" step="1" data-categoria-orden>
                        </div>
                    </div>

                    <p class="form__message mt-3" data-categoria-mensaje hidden></p>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline-secondary" type="button" data-bs-dismiss="modal">Cancelar</button>
                    <button class="btn btn-primary" type="submit" data-categoria-guardar>Guardar categoría</button>
                </div>
            </form>
        </div>
    </div>
</div>

<div class="toast-stack" data-toast-stack aria-live="polite"></div>
<?php

$content = (string) ob_get_clean();
$title = 'Categorías de recetas · Admin';
$scripts = ['/assets/js/pages/admin-categorias-recetas.js'];
$styles = ['/assets/css/admin.css', '/assets/css/recetas.css'];
$active = 'admin-categorias';

require __DIR__ . '/../../layouts/app.php';
