<?php

declare(strict_types=1);

use App\Middleware\AuthMiddleware;
use App\Services\ProductoService;

$usuario = AuthMiddleware::require();
$categorias = (new ProductoService())->categorias();

$q = isset($_GET['q']) && is_string($_GET['q']) ? trim($_GET['q']) : '';
$categoriaSeleccionada = ProductoService::enteroPositivo($_GET['categoria_id'] ?? null);
$estadoSeleccionado = isset($_GET['estado']) && is_string($_GET['estado'])
    ? $_GET['estado']
    : '';
$imagenSeleccionada = isset($_GET['imagen']) && is_string($_GET['imagen'])
    ? $_GET['imagen']
    : '';

if (!in_array($estadoSeleccionado, ['activo', 'inactivo'], true)) {
    $estadoSeleccionado = '';
}

if (!in_array($imagenSeleccionada, ['sin_foto', 'vencida'], true)) {
    $imagenSeleccionada = '';
}

$mensajes = [
    'creado' => 'Producto creado correctamente.',
    'actualizado' => 'Producto actualizado correctamente.',
    'desactivado' => 'Producto desactivado. Ya no aparece en el catálogo público.',
];

$ok = isset($_GET['ok']) && is_string($_GET['ok']) ? $_GET['ok'] : '';

ob_start();
?>
<div class="container py-4">
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
        <div>
            <h2 class="mb-1">
                <span class="title-icon"><i class="bi bi-box-seam-fill" aria-hidden="true"></i></span>
                Productos
            </h2>
            <p class="text-muted mb-0">Catálogo del súper: crea, edita y desactiva productos.</p>
        </div>

        <div class="d-flex flex-wrap gap-2">
            <button class="btn btn-outline-primary" type="button" data-categoria-open>
                <i class="bi bi-tags" aria-hidden="true"></i>
                Nueva categoría
            </button>
            <button class="btn btn-outline-secondary" type="button" data-verificar-fotos>
                <i class="bi bi-image" aria-hidden="true"></i>
                Verificar fotos
            </button>
            <a class="btn btn-primary" href="/admin/productos/nuevo">Nuevo producto</a>
        </div>
    </div>

    <?php if (isset($mensajes[$ok])): ?>
        <div class="alert alert-success" role="status" data-toast>
            <?= htmlspecialchars($mensajes[$ok], ENT_QUOTES, 'UTF-8') ?>
        </div>
    <?php endif; ?>

    <form id="filtros-form" class="row g-2 mb-4" method="get" action="/admin/productos">
        <div class="col-12 col-md-4">
            <label class="form-label" for="q">Buscar</label>
            <input
                class="form-control"
                type="search"
                id="q"
                name="q"
                maxlength="150"
                placeholder="Nombre del producto…"
                value="<?= htmlspecialchars($q, ENT_QUOTES, 'UTF-8') ?>"
            >
        </div>

        <div class="col-6 col-md-2">
            <label class="form-label" for="categoria_id">Categoría</label>
            <select class="form-select" id="categoria_id" name="categoria_id">
                <option value="">Todas</option>
                <?php foreach ($categorias as $categoria): ?>
                    <option
                        value="<?= (int) $categoria['id'] ?>"
                        <?= $categoriaSeleccionada === (int) $categoria['id'] ? 'selected' : '' ?>
                    >
                        <?= htmlspecialchars($categoria['nombre'], ENT_QUOTES, 'UTF-8') ?>
                    </option>
                <?php endforeach; ?>
            </select>
        </div>

        <div class="col-6 col-md-2">
            <label class="form-label" for="estado">Estado</label>
            <select class="form-select" id="estado" name="estado">
                <option value="" <?= $estadoSeleccionado === '' ? 'selected' : '' ?>>Todos</option>
                <option value="activo" <?= $estadoSeleccionado === 'activo' ? 'selected' : '' ?>>Activos</option>
                <option value="inactivo" <?= $estadoSeleccionado === 'inactivo' ? 'selected' : '' ?>>Inactivos</option>
            </select>
        </div>

        <div class="col-6 col-md-4">
            <label class="form-label" for="imagen">Foto</label>
            <select class="form-select" id="imagen" name="imagen">
                <option value="" <?= $imagenSeleccionada === '' ? 'selected' : '' ?>>Todas</option>
                <option value="sin_foto" <?= $imagenSeleccionada === 'sin_foto' ? 'selected' : '' ?>>Sin foto</option>
                <option value="vencida" <?= $imagenSeleccionada === 'vencida' ? 'selected' : '' ?>>Foto vencida (rota)</option>
            </select>
        </div>

        <div class="col-12 d-flex flex-wrap gap-2">
            <button class="btn btn-primary" type="submit">Filtrar</button>
            <a class="btn btn-outline-secondary" href="/admin/productos">Limpiar</a>
        </div>
    </form>

    <div class="d-flex flex-wrap justify-content-between align-items-baseline gap-2 mb-2">
        <h5 class="mb-0" id="tabla-title">Catálogo</h5>
        <p class="text-muted small mb-0" data-total hidden></p>
    </div>

    <div class="table-responsive">
        <table class="table table-hover align-middle">
            <thead class="table-light">
                <tr>
                    <th scope="col" class="d-none d-sm-table-cell">Imagen</th>
                    <th scope="col">Nombre</th>
                    <th scope="col" class="d-none d-md-table-cell">Categoría</th>
                    <th scope="col" class="d-none d-lg-table-cell">Unidad</th>
                    <th scope="col">Estado</th>
                    <th class="text-end" scope="col">Acciones</th>
                </tr>
            </thead>
            <tbody data-productos-body>
                <tr>
                    <td class="text-center text-muted py-4" colspan="6">Cargando productos…</td>
                </tr>
            </tbody>
        </table>
    </div>

    <p class="form__message mt-3" data-table-message hidden></p>

    <nav aria-label="Paginación del catálogo" data-pagination hidden>
        <ul class="pagination justify-content-center mb-0">
            <li class="page-item">
                <button class="page-link" type="button" data-page-prev>Anterior</button>
            </li>
            <li class="page-item disabled">
                <span class="page-link" data-page-status></span>
            </li>
            <li class="page-item">
                <button class="page-link" type="button" data-page-next>Siguiente</button>
            </li>
        </ul>
    </nav>
</div>

<?php require __DIR__ . '/_categoria-modal.php'; ?>
<?php

$content = (string) ob_get_clean();
$title = 'Productos · Admin';
$scripts = ['/assets/js/pages/admin-productos.js'];
$styles = ['/assets/css/admin.css'];
$active = 'admin-productos';

require __DIR__ . '/../../layouts/app.php';
