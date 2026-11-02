<?php

declare(strict_types=1);

use App\Middleware\AuthMiddleware;

$usuario = $usuario ?? AuthMiddleware::usuario();

if ($usuario === null) {
    header('Location: /login', true, 302);

    return;
}

$hayCompras = $hayCompras ?? false;
$totalCompras = (int) ($totalCompras ?? 0);
$guardada = ($_GET['guardada'] ?? '') === '1';

ob_start();
?>
<div class="container py-4" data-historial data-hay-compras="<?= $hayCompras ? '1' : '0' ?>">
    <h2 class="mb-4">
        <span class="title-icon"><i class="bi bi-clock-history" aria-hidden="true"></i></span>
        Historial de compras
    </h2>

    <?php if ($guardada): ?>
        <div class="alert alert-success" role="status">Compra guardada.</div>
    <?php endif; ?>

    <?php if (!$hayCompras): ?>
        <div class="alert alert-info" data-historial-empty>
            Aún no has registrado compras. Empieza en la pantalla rápida.
        </div>
        <a class="btn btn-primary" href="/">Ir a la pantalla rápida</a>
    <?php else: ?>
        <p class="text-muted small" data-historial-status>Cargando compras…</p>
        <div class="history-groups" data-historial-list></div>
        <nav class="history-pagination" data-historial-pagination aria-label="Paginación del historial" hidden></nav>
    <?php endif; ?>
</div>

<div class="toast-stack" data-toast-stack aria-live="polite"></div>
<?php

$content = (string) ob_get_clean();
$title = 'Historial';
$scripts = ['/assets/js/pages/historial.js'];
$styles = ['/assets/css/pantalla-rapida.css', '/assets/css/historial.css'];
$active = 'historial';

require __DIR__ . '/../layouts/app.php';
