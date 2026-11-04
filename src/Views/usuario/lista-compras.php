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
<div class="container py-4" data-lista-compras>
    <div class="recipe-head">
        <div>
            <h2 class="mb-1">
                <span class="title-icon"><i class="bi bi-cart-check" aria-hidden="true"></i></span>
                Productos por comprar
            </h2>
            <p class="text-muted mb-0">
                Revisa, ajusta y envía tus productos a la pantalla rápida para asignar precios.
            </p>
        </div>

        <div class="d-flex flex-wrap gap-2">
            <a class="btn btn-outline-secondary" href="/recetas">
                <i class="bi bi-egg-fried" aria-hidden="true"></i>
                Volver a recetas
            </a>
            <button class="btn btn-primary" type="button" data-lista-enviar>
                <i class="bi bi-send" aria-hidden="true"></i>
                Enviar a pantalla rápida
            </button>
        </div>
    </div>

    <div class="row g-4">
        <div class="col-12 col-lg-8">
            <div class="d-flex flex-wrap justify-content-between align-items-baseline gap-2 mb-2">
                <h5 class="mb-0" id="lista-title">Tu lista</h5>
                <p class="text-muted small mb-0" data-lista-status aria-live="polite">Cargando…</p>
            </div>

            <div class="lista-items" data-lista-items></div>
            <div class="alert alert-info" data-lista-empty hidden>
                Tu lista está vacía. Agrega productos manualmente o genera una lista desde Recetas.
            </div>

            <div class="d-flex flex-wrap gap-2 mt-3">
                <button class="btn btn-outline-danger" type="button" data-lista-vaciar>
                    <i class="bi bi-trash3" aria-hidden="true"></i>
                    Vaciar lista
                </button>
            </div>
        </div>

        <div class="col-12 col-lg-4">
            <div class="card">
                <div class="card-body">
                    <h5 class="card-title mb-2">
                        <span class="title-icon"><i class="bi bi-plus-lg" aria-hidden="true"></i></span>
                        Agregar producto
                    </h5>
                    <p class="text-muted small">
                        Añade algo que no venga de una receta.
                    </p>

                    <form data-lista-form novalidate>
                        <div class="mb-2">
                            <label class="form-label" for="lista-nombre">Nombre</label>
                            <input class="form-control" type="text" id="lista-nombre" maxlength="150" required data-lista-nombre>
                        </div>

                        <div class="row g-2 mb-2">
                            <div class="col-7">
                                <label class="form-label" for="lista-cantidad">Cantidad</label>
                                <input
                                    class="form-control"
                                    type="number"
                                    id="lista-cantidad"
                                    min="0.001"
                                    step="0.001"
                                    inputmode="decimal"
                                    value="1"
                                    required
                                    data-lista-cantidad
                                >
                            </div>
                            <div class="col-5">
                                <label class="form-label" for="lista-unidad">Unidad</label>
                                <select class="form-select" id="lista-unidad" data-lista-unidad>
                                    <option value="pza">pza</option>
                                    <option value="kg">kg</option>
                                    <option value="gr">gr</option>
                                    <option value="L">L</option>
                                    <option value="ml">ml</option>
                                </select>
                            </div>
                        </div>

                        <p class="form__message mb-2" data-lista-mensaje hidden></p>

                        <button class="btn btn-primary w-100" type="submit" data-lista-agregar>
                            <i class="bi bi-plus-lg" aria-hidden="true"></i>
                            Agregar a la lista
                        </button>
                    </form>
                </div>
            </div>

            <p class="text-muted small mt-3 mb-0">
                Los productos enviados se cargan en el carrito con precio pendiente. Ahí puedes ajustar
                cantidades y costos antes de guardar la compra.
            </p>
        </div>
    </div>
</div>

<div class="toast-stack" data-toast-stack aria-live="polite"></div>
<?php

$content = (string) ob_get_clean();
$title = 'Productos por comprar';
$scripts = ['/assets/js/pages/lista-compras.js'];
$styles = ['/assets/css/recetas.css', '/assets/css/lista-compras.css'];
$active = 'lista-compras';

require __DIR__ . '/../layouts/app.php';
