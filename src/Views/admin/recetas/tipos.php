<?php

declare(strict_types=1);

use App\Middleware\AdminMiddleware;

$usuario = AdminMiddleware::usuarioWeb();

if ($usuario === null) {
    return;
}

ob_start();
?>
<div class="container py-4" data-admin-tipos>
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
        <div>
            <h2 class="mb-1">
                <span class="title-icon"><i class="bi bi-tags-fill" aria-hidden="true"></i></span>
                Tipos de receta
            </h2>
            <p class="text-muted mb-0">
                Crea, edita y elimina los tipos que se usan para clasificar el recetario.
            </p>
        </div>

        <div class="d-flex flex-wrap gap-2">
            <a class="btn btn-outline-secondary" href="/admin/recetas">
                <i class="bi bi-arrow-left" aria-hidden="true"></i>
                Volver al catálogo
            </a>
            <button class="btn btn-primary" type="button" data-tipo-nuevo>
                <i class="bi bi-plus-lg" aria-hidden="true"></i>
                Nuevo tipo
            </button>
        </div>
    </div>

    <div class="card mb-4">
        <div class="card-body">
            <p class="text-muted small mb-0" data-tipos-status aria-live="polite">
                Cargando tipos…
            </p>
        </div>
    </div>

    <div class="table-responsive">
        <table class="table table-hover align-middle">
            <thead class="table-light">
                <tr>
                    <th scope="col">Tipo</th>
                    <th scope="col">Slug</th>
                    <th scope="col">Descripción</th>
                    <th scope="col">Aviso</th>
                    <th class="text-end" scope="col">Acciones</th>
                </tr>
            </thead>
            <tbody data-tipos-body>
                <tr>
                    <td class="text-center text-muted py-4" colspan="5">Cargando tipos…</td>
                </tr>
            </tbody>
        </table>
    </div>

    <p class="form__message mt-3" data-tipos-mensaje hidden></p>
</div>

<div class="modal fade" id="tipo-modal" tabindex="-1" aria-labelledby="tipo-modal-title" aria-hidden="true" data-tipo-modal>
    <div class="modal-dialog modal-dialog-centered modal-lg">
        <div class="modal-content">
            <form data-tipo-form novalidate>
                <div class="modal-header">
                    <h2 class="modal-title fs-5" id="tipo-modal-title" data-tipo-modal-title>Nuevo tipo</h2>
                    <button class="btn-close" type="button" data-bs-dismiss="modal" aria-label="Cerrar"></button>
                </div>
                <div class="modal-body p-4">
                    <input type="hidden" data-tipo-id>

                    <div class="row g-3">
                        <div class="col-12 col-md-7">
                            <label class="form-label" for="tipo-nombre">Nombre</label>
                            <input class="form-control" type="text" id="tipo-nombre" maxlength="80" required data-tipo-nombre>
                        </div>
                        <div class="col-12 col-md-5">
                            <label class="form-label" for="tipo-icono">Icono de Bootstrap</label>
                            <input class="form-control" type="text" id="tipo-icono" maxlength="80" placeholder="bi-tag" data-tipo-icono>
                            <p class="text-muted small mt-1 mb-0">Ej. bi-tag, bi-heart-pulse, bi-flower1.</p>
                        </div>
                        <div class="col-12">
                            <label class="form-label" for="tipo-descripcion">Descripción</label>
                            <input class="form-control" type="text" id="tipo-descripcion" maxlength="255" data-tipo-descripcion>
                        </div>
                        <div class="col-12">
                            <label class="form-label" for="tipo-aviso">Aviso <span class="text-muted">(opcional)</span></label>
                            <textarea class="form-control" id="tipo-aviso" rows="3" maxlength="500" data-tipo-aviso></textarea>
                            <p class="text-muted small mt-1 mb-0">
                                Se muestra en el detalle de las recetas de este tipo.
                            </p>
                        </div>
                    </div>

                    <p class="form__message mt-3" data-tipo-mensaje hidden></p>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline-secondary" type="button" data-bs-dismiss="modal">Cancelar</button>
                    <button class="btn btn-primary" type="submit" data-tipo-guardar>Guardar tipo</button>
                </div>
            </form>
        </div>
    </div>
</div>

<div class="toast-stack" data-toast-stack aria-live="polite"></div>
<?php

$content = (string) ob_get_clean();
$title = 'Tipos de receta · Admin';
$scripts = ['/assets/js/pages/admin-tipos-recetas.js'];
$styles = ['/assets/css/admin.css', '/assets/css/recetas.css'];
$active = 'admin-tipos';

require __DIR__ . '/../../layouts/app.php';
