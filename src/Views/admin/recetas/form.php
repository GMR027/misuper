<?php

declare(strict_types=1);

use App\Middleware\AdminMiddleware;
use App\Services\RecetaService;

$usuario = AdminMiddleware::usuarioWeb();

if ($usuario === null) {
    return;
}

$receta = $receta ?? null;
$recetaId = isset($recetaId) ? (int) $recetaId : null;
$servicioRecetas = new RecetaService();
$tipos = $servicioRecetas->tipos();
$categorias = $servicioRecetas->categorias();
$modo = 'admin';

$volver = isset($_GET['volver']) ? (string) $_GET['volver'] : '';
$volver = preg_match('#^/admin/[A-Za-z0-9/_\-\.\#\?=&%]*$#', $volver) === 1 ? $volver : '';
$destinoVolver = $volver === '' ? '/admin/recetas' : $volver;
$textoVolver = str_starts_with($destinoVolver, '/admin/recetas/lotes')
    ? 'Volver a los lotes'
    : 'Volver al listado';

ob_start();
?>
<div class="container py-4" data-receta-form-page data-modo="admin">
    <div class="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-4">
        <div>
            <h2 class="mb-1">
                <span class="title-icon"><i class="bi bi-pencil-square" aria-hidden="true"></i></span>
                <?= $recetaId === null ? 'Nueva receta' : 'Editar receta' ?>
            </h2>
            <p class="text-muted mb-0">
                Completa los datos que alimentan el recetario, los filtros y la lista de compras.
            </p>
        </div>
        <a class="btn btn-outline-secondary" href="<?= htmlspecialchars($destinoVolver, ENT_QUOTES, 'UTF-8') ?>">
            <i class="bi bi-arrow-left" aria-hidden="true"></i>
            <?= htmlspecialchars($textoVolver, ENT_QUOTES, 'UTF-8') ?>
        </a>
    </div>

    <div class="card">
        <div class="card-body p-4">
            <?php require __DIR__ . '/../../recetas/_form.php'; ?>
        </div>
    </div>
</div>

<div class="toast-stack" data-toast-stack aria-live="polite"></div>
<?php

$content = (string) ob_get_clean();
$title = ($recetaId === null ? 'Nueva receta' : 'Editar receta') . ' · Admin';
$scripts = ['/assets/js/pages/receta-form.js'];
$styles = ['/assets/css/pantalla-rapida.css', '/assets/css/admin.css', '/assets/css/recetas.css'];
$active = 'admin-recetas';

require __DIR__ . '/../../layouts/app.php';
