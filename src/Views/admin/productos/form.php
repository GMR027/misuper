<?php

declare(strict_types=1);

use App\Middleware\AuthMiddleware;
use App\Models\Producto;
use App\Services\ProductoService;

/** @var Producto|null $producto */
$usuario = AuthMiddleware::require();
$categorias = (new ProductoService())->categorias();

$producto = $producto ?? null;
$esEdicion = $producto instanceof Producto;

$nombre = $esEdicion ? $producto->nombre : '';
$categoriaActual = $esEdicion ? $producto->categoriaId : 0;
$unidadActual = $esEdicion ? $producto->unidadBase : 'kg';
$imagenActual = $esEdicion ? ($producto->imagenUrl ?? '') : '';

$unidades = [
    'kg' => 'kg — kilogramo',
    'gr' => 'gr — gramo',
    'L' => 'L — litro',
    'ml' => 'ml — mililitro',
    'pza' => 'pza — pieza',
];

ob_start();
?>
<div class="container py-4">
    <div class="row">
        <div class="col-12 col-lg-8 offset-lg-2">
            <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                <h2 class="mb-0">
                    <span class="title-icon"><i class="bi bi-pencil-square" aria-hidden="true"></i></span>
                    <?= $esEdicion ? 'Editar producto' : 'Nuevo producto' ?>
                </h2>
                <a class="btn btn-outline-secondary btn-sm" href="/admin/productos">Volver al catálogo</a>
            </div>

            <p class="text-muted">
                <?= $esEdicion
                    ? 'Modifica los datos del producto o desactívalo para ocultarlo del catálogo.'
                    : 'Agrega un producto al catálogo. Se crea como activo.' ?>
            </p>

            <div class="card card--bs shadow-sm">
                <div class="card-body p-4">
                    <form
                        id="producto-form"
                        method="post"
                        action="/api/admin/productos"
                        novalidate
                        data-mode="<?= $esEdicion ? 'editar' : 'nuevo' ?>"
                        <?= $esEdicion ? 'data-product-id="' . (int) $producto->id . '"' : '' ?>
                    >
                        <div class="mb-3">
                            <label class="form-label" for="nombre">Nombre</label>
                            <input
                                class="form-control"
                                type="text"
                                id="nombre"
                                name="nombre"
                                maxlength="150"
                                minlength="2"
                                autocomplete="off"
                                value="<?= htmlspecialchars($nombre, ENT_QUOTES, 'UTF-8') ?>"
                                required
                            >
                            <p class="form__error" data-error-for="nombre" hidden></p>
                        </div>

                        <div class="row g-3">
                            <div class="col-12 col-md-6">
                                <label class="form-label" for="categoria_id">Categoría</label>
                                <select class="form-select" id="categoria_id" name="categoria_id" required>
                                    <option value="">Selecciona una categoría</option>
                                    <?php foreach ($categorias as $categoria): ?>
                                        <option
                                            value="<?= (int) $categoria['id'] ?>"
                                            <?= $categoriaActual === (int) $categoria['id'] ? 'selected' : '' ?>
                                        >
                                            <?= htmlspecialchars($categoria['nombre'], ENT_QUOTES, 'UTF-8') ?>
                                        </option>
                                    <?php endforeach; ?>
                                </select>
                                <p class="form__error" data-error-for="categoria_id" hidden></p>
                                <button class="btn btn-sm btn-outline-secondary mt-2" type="button" data-categoria-open>
                                    <i class="bi bi-plus-lg" aria-hidden="true"></i>
                                    Nueva categoría
                                </button>
                            </div>

                            <div class="col-12 col-md-6">
                                <label class="form-label" for="unidad_base">Unidad base</label>
                                <select class="form-select" id="unidad_base" name="unidad_base" required>
                                    <?php foreach ($unidades as $valor => $etiqueta): ?>
                                        <option value="<?= htmlspecialchars($valor, ENT_QUOTES, 'UTF-8') ?>" <?= $unidadActual === $valor ? 'selected' : '' ?>>
                                            <?= htmlspecialchars($etiqueta, ENT_QUOTES, 'UTF-8') ?>
                                        </option>
                                    <?php endforeach; ?>
                                </select>
                                <p class="form-text">Una sola unidad por producto. No se cambia al registrar compras.</p>
                                <p class="form__error" data-error-for="unidad_base" hidden></p>
                            </div>
                        </div>

                        <div class="mb-3 mt-3">
                            <label class="form-label" for="imagen_url">
                                URL de la imagen <span class="text-muted">(opcional)</span>
                            </label>
                            <input
                                class="form-control"
                                type="url"
                                id="imagen_url"
                                name="imagen_url"
                                maxlength="500"
                                placeholder="https://images.pexels.com/…"
                                value="<?= htmlspecialchars($imagenActual, ENT_QUOTES, 'UTF-8') ?>"
                            >
                            <p class="form-text">Debe ser una URL http o https. Se muestra como miniatura en el catálogo.</p>
                            <img
                                id="imagen-preview"
                                class="rounded mt-2 imagen-preview"
                                <?= $imagenActual !== '' ? 'src="' . htmlspecialchars($imagenActual, ENT_QUOTES, 'UTF-8') . '"' : '' ?>
                                alt="Vista previa de la imagen"
                                <?= $imagenActual === '' ? 'hidden' : '' ?>
                            >
                            <p class="form__error" data-error-for="imagen_url" hidden></p>
                        </div>

                        <p class="form__message" data-message hidden></p>

                        <div class="d-flex flex-wrap gap-2 mt-4">
                            <button class="btn btn-primary" type="submit">
                                <?= $esEdicion ? 'Guardar cambios' : 'Crear producto' ?>
                            </button>
                            <a class="btn btn-secondary" href="/admin/productos">Cancelar</a>

                            <?php if ($esEdicion): ?>
                                <?php if ($producto->estado === 'activo'): ?>
                                    <button class="btn btn-outline-danger" type="button" data-deactivate>Desactivar</button>
                                <?php else: ?>
                                    <button class="btn btn-outline-success" type="button" data-reactivate>Reactivar</button>
                                <?php endif; ?>
                            <?php endif; ?>
                        </div>

                        <?php if ($esEdicion): ?>
                            <p class="form-text mt-3">
                                Estado actual:
                                <span class="badge <?= $producto->estado === 'activo' ? 'bg-success' : 'bg-secondary' ?>">
                                    <?= $producto->estado === 'activo' ? 'Activo' : 'Inactivo' ?>
                                </span>
                                · Desactivar no borra el producto, solo lo oculta del catálogo.
                            </p>
                        <?php endif; ?>
                    </form>
                </div>
            </div>
        </div>
    </div>
</div>

<?php require __DIR__ . '/_categoria-modal.php'; ?>
<?php

$content = (string) ob_get_clean();
$title = $esEdicion ? 'Editar producto · Admin' : 'Nuevo producto · Admin';
$scripts = ['/assets/js/pages/admin-productos.js'];
$styles = ['/assets/css/admin.css'];
$active = 'admin-productos';

require __DIR__ . '/../../layouts/app.php';
