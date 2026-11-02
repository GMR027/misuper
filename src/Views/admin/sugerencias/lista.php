<?php

declare(strict_types=1);

use App\Middleware\AuthMiddleware;
use App\Services\ProductoService;

$usuario = AuthMiddleware::require();
$categorias = (new ProductoService())->categorias();

$estados = [
    'pendiente' => 'Pendientes',
    'aprobada' => 'Aprobadas',
    'ignorada' => 'Ignoradas',
];

$estadoInicial = isset($_GET['estado']) && is_string($_GET['estado'])
    ? $_GET['estado']
    : 'pendiente';

if (!isset($estados[$estadoInicial])) {
    $estadoInicial = 'pendiente';
}

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
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
        <div>
            <h2 class="mb-1">
                <span class="title-icon"><i class="bi bi-lightbulb-fill" aria-hidden="true"></i></span>
                Sugerencias de productos
            </h2>
            <p class="text-muted mb-0">
                Ítems libres escritos por los usuarios. Apruébalos para agregarlos al catálogo
                o ignóralos para descartarlos.
            </p>
        </div>

        <div>
            <label class="form-label" for="sugerencias-estado">Estado</label>
            <select class="form-select w-auto" id="sugerencias-estado" data-estado-filter>
                <?php foreach ($estados as $valor => $etiqueta): ?>
                    <option value="<?= htmlspecialchars($valor, ENT_QUOTES, 'UTF-8') ?>"<?= $valor === $estadoInicial ? ' selected' : '' ?>>
                        <?= htmlspecialchars($etiqueta, ENT_QUOTES, 'UTF-8') ?>
                    </option>
                <?php endforeach; ?>
            </select>
        </div>
    </div>

    <div class="d-flex flex-wrap justify-content-between align-items-baseline gap-2 mb-2">
        <h5 class="mb-0" id="sugerencias-tabla-title">Bandeja</h5>
        <p class="text-muted small mb-0" data-total hidden></p>
    </div>

    <div class="table-responsive">
        <table class="table table-hover align-middle">
            <thead class="table-light">
                <tr>
                    <th scope="col">Nombre</th>
                    <th scope="col">Total</th>
                    <th scope="col">Primera</th>
                    <th scope="col">Última</th>
                    <th class="text-end" scope="col">Acciones</th>
                </tr>
            </thead>
            <tbody data-sugerencias-body>
                <tr>
                    <td class="text-center text-muted py-4" colspan="5">Cargando sugerencias…</td>
                </tr>
            </tbody>
        </table>
    </div>

    <p class="form__message mt-3" data-table-message hidden></p>
</div>

<div class="app-modal" id="modal-aprobar" data-modal-aprobar hidden role="dialog" aria-modal="true" aria-labelledby="aprobar-title">
    <div class="modal-dialog modal-dialog-centered">
        <form class="modal-content" data-form-aprobar novalidate>
            <div class="modal-body p-4">
                <h5 class="modal-title mb-2" id="aprobar-title">Aprobar sugerencia</h5>
                <p class="text-muted small">
                    Se creará <strong data-aprobar-nombre></strong> en el catálogo y se resolverán
                    todas las sugerencias pendientes con ese mismo nombre.
                </p>

                <input type="hidden" data-sugerencia-id>

                <div class="mb-3">
                    <label class="form-label" for="aprobar-categoria">Categoría</label>
                    <select class="form-select" id="aprobar-categoria" data-aprobar-categoria required>
                        <option value="">Selecciona una categoría</option>
                        <?php foreach ($categorias as $categoria): ?>
                            <option value="<?= (int) $categoria['id'] ?>">
                                <?= htmlspecialchars($categoria['nombre'], ENT_QUOTES, 'UTF-8') ?>
                            </option>
                        <?php endforeach; ?>
                    </select>
                    <p class="form__error" data-error-for="categoria_id" hidden></p>
                </div>

                <div class="row g-3">
                    <div class="col-12 col-sm-6">
                        <label class="form-label" for="aprobar-unidad">Unidad base</label>
                        <select class="form-select" id="aprobar-unidad" data-aprobar-unidad required>
                            <?php foreach ($unidades as $valor => $etiqueta): ?>
                                <option value="<?= htmlspecialchars($valor, ENT_QUOTES, 'UTF-8') ?>">
                                    <?= htmlspecialchars($etiqueta, ENT_QUOTES, 'UTF-8') ?>
                                </option>
                            <?php endforeach; ?>
                        </select>
                        <p class="form__error" data-error-for="unidad_base" hidden></p>
                    </div>

                    <div class="col-12 col-sm-6">
                        <label class="form-label" for="aprobar-imagen">
                            URL de la imagen <span class="text-muted">(opcional)</span>
                        </label>
                        <input
                            class="form-control"
                            type="url"
                            id="aprobar-imagen"
                            maxlength="500"
                            placeholder="https://images.pexels.com/…"
                            data-aprobar-imagen
                        >
                        <p class="form__error" data-error-for="imagen_url" hidden></p>
                    </div>
                </div>

                <p class="form__message mt-3 mb-0" data-aprobar-message hidden></p>
            </div>

            <div class="modal-footer">
                <button class="btn btn-outline-secondary" type="button" data-close-aprobar>Cancelar</button>
                <button class="btn btn-primary" type="submit">Aprobar y crear producto</button>
            </div>
        </form>
    </div>
</div>

<div class="toast-stack" data-toast-stack aria-live="polite"></div>
<?php

$content = (string) ob_get_clean();
$title = 'Sugerencias de productos · Admin';
$scripts = ['/assets/js/pages/admin-sugerencias.js'];
$styles = [
    '/assets/css/admin.css',
    '/assets/css/pantalla-rapida.css',
    '/assets/css/admin-sugerencias.css',
];
$active = 'admin-sugerencias';

require __DIR__ . '/../../layouts/app.php';
