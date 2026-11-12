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
<div class="container py-4" data-productos-omision>
    <div class="recipe-head">
        <div>
            <h2 class="mb-1">
                <span class="title-icon"><i class="bi bi-slash-circle" aria-hidden="true"></i></span>
                Productos por omisión
            </h2>
            <p class="text-muted mb-0">
                Ingredientes que no quieres contar al comparar tus recetas con lo que compraste:
                sal, aceite, especias y otros productos de despensa.
            </p>
        </div>

        <div class="d-flex flex-wrap gap-2">
            <a class="btn btn-outline-secondary" href="/recetas">
                <i class="bi bi-egg-fried" aria-hidden="true"></i>
                Ir a recetas
            </a>
        </div>
    </div>

    <section class="card mb-4" aria-label="Agregar producto por omisión">
        <div class="card-body">
            <form data-omision-form class="row g-3 align-items-end" novalidate>
                <div class="col-12 col-md-7">
                    <label class="form-label" for="omision-nombre">Producto</label>
                    <input
                        class="form-control"
                        id="omision-nombre"
                        name="nombre"
                        type="text"
                        maxlength="100"
                        autocomplete="off"
                        placeholder="Ej. Sal, aceite de oliva, comino"
                        data-omision-input
                        required
                    >
                </div>
                <div class="col-12 col-md-5 d-flex gap-2">
                    <button class="btn btn-primary flex-grow-1" type="submit" data-omision-submit>
                        <i class="bi bi-plus-lg" aria-hidden="true"></i>
                        Agregar
                    </button>
                </div>
                <div class="col-12">
                    <p class="text-muted small mb-2">Sugerencias rápidas:</p>
                    <div class="d-flex flex-wrap gap-2" data-omision-sugerencias>
                        <?php foreach (['Sal', 'Aceite', 'Comino', 'Canela', 'Pimienta', 'Orégano', 'Agua'] as $sugerencia): ?>
                            <button
                                class="btn btn-sm btn-outline-secondary"
                                type="button"
                                data-omision-sugerencia="<?= htmlspecialchars($sugerencia, ENT_QUOTES, 'UTF-8') ?>"
                            >
                                <?= htmlspecialchars($sugerencia, ENT_QUOTES, 'UTF-8') ?>
                            </button>
                        <?php endforeach; ?>
                    </div>
                </div>
                <div class="col-12">
                    <p class="text-danger small mb-0" role="alert" data-omision-error hidden></p>
                </div>
            </form>
        </div>
    </section>

    <section class="card" aria-label="Productos omitidos">
        <div class="card-body">
            <div class="d-flex align-items-center justify-content-between mb-3">
                <h3 class="h6 mb-0">
                    Tu lista
                    <span class="badge text-bg-secondary" data-omision-count>0</span>
                </h3>
            </div>

            <p class="text-muted mb-0" data-omision-vacio>No has agregado productos todavía.</p>

            <ul class="list-group list-group-flush" data-omision-lista hidden></ul>
        </div>
    </section>

    <p class="text-muted small mt-3 mb-0">
        La coincidencia es por palabras: «aceite» omite «aceite de oliva», pero «aceite de oliva»
        no omite el aceite a secas. Estos productos tampoco aparecen en las listas de compras
        generadas desde recetas.
    </p>
</div>
<?php

$content = (string) ob_get_clean();
$title = 'Productos por omisión';
$scripts = ['/assets/js/pages/productos-omision.js'];
$active = 'productos-omision';

require __DIR__ . '/../layouts/app.php';
