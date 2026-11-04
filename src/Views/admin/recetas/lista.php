<?php

declare(strict_types=1);

use App\Middleware\AdminMiddleware;

$usuario = AdminMiddleware::usuarioWeb();

if ($usuario === null) {
    return;
}

$error = isset($_GET['error']) && is_string($_GET['error']) ? $_GET['error'] : '';

ob_start();
?>
<div class="container py-4" data-admin-recetas>
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
        <div>
            <h2 class="mb-1">
                <span class="title-icon"><i class="bi bi-egg-fried" aria-hidden="true"></i></span>
                Recetas
            </h2>
            <p class="text-muted mb-0">
                Crea, edita, publica o elimina recetas. Las propuestas de usuarios llegan como pendientes.
            </p>
        </div>

        <div class="d-flex flex-wrap gap-2">
            <a class="btn btn-outline-secondary" href="/recetas" target="_blank" rel="noopener">
                <i class="bi bi-box-arrow-up-right" aria-hidden="true"></i>
                Ver recetario
            </a>
            <a class="btn btn-primary" href="/admin/recetas/nuevo">
                <i class="bi bi-plus-lg" aria-hidden="true"></i>
                Nueva receta
            </a>
        </div>
    </div>

    <?php if ($error === 'no_encontrada'): ?>
        <div class="alert alert-warning" role="status">La receta que buscas no existe.</div>
    <?php endif; ?>

    <div class="card mb-4">
        <div class="card-body">
            <div class="row g-3 align-items-end">
                <div class="col-12 col-md-5">
                    <label class="form-label" for="admin-receta-q">Buscar receta</label>
                    <input
                        class="form-control"
                        type="search"
                        id="admin-receta-q"
                        placeholder="Nombre de la receta…"
                        autocomplete="off"
                        data-admin-receta-buscar
                    >
                </div>
                <div class="col-6 col-md-3">
                    <label class="form-label" for="admin-receta-estado">Estado</label>
                    <select class="form-select" id="admin-receta-estado" data-admin-receta-estado>
                        <option value="">Todos</option>
                        <option value="pendiente">Pendientes</option>
                        <option value="publicada">Publicadas</option>
                        <option value="borrador">Borradores</option>
                    </select>
                </div>
                <div class="col-6 col-md-4">
                    <p class="text-muted small mb-0" data-admin-receta-status aria-live="polite">
                        Cargando recetas…
                    </p>
                </div>
            </div>
        </div>
    </div>

    <div class="table-responsive">
        <table class="table table-hover align-middle">
            <thead class="table-light">
                <tr>
                    <th scope="col">Receta</th>
                    <th scope="col">Tipos</th>
                    <th scope="col">Estado</th>
                    <th scope="col">Autor</th>
                    <th scope="col">Video</th>
                    <th class="text-end" scope="col">Acciones</th>
                </tr>
            </thead>
            <tbody data-admin-recetas-body>
                <tr>
                    <td class="text-center text-muted py-4" colspan="6">Cargando recetas…</td>
                </tr>
            </tbody>
        </table>
    </div>

    <p class="form__message mt-3" data-admin-receta-mensaje hidden></p>
</div>

<div class="toast-stack" data-toast-stack aria-live="polite"></div>
<?php

$content = (string) ob_get_clean();
$title = 'Recetas · Admin';
$scripts = ['/assets/js/pages/admin-recetas.js'];
$styles = ['/assets/css/admin.css', '/assets/css/recetas.css'];
$active = 'admin-recetas';

require __DIR__ . '/../../layouts/app.php';
