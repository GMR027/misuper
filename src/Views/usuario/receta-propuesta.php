<?php

declare(strict_types=1);

use App\Middleware\AuthMiddleware;
use App\Services\RecetaService;

$usuario = $usuario ?? AuthMiddleware::usuario();

if ($usuario === null) {
    header('Location: /login', true, 302);

    return;
}

if (($usuario['debe_cambiar_password'] ?? false) === true) {
    header('Location: /cambiar-password-forzado', true, 302);

    return;
}

$tipos = (new RecetaService())->tipos();
$modo = 'propuesta';
$receta = null;

ob_start();
?>
<div class="container py-4" data-receta-form-page data-modo="propuesta">
    <div class="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-4">
        <div>
            <h2 class="mb-1">
                <span class="title-icon"><i class="bi bi-plus-circle" aria-hidden="true"></i></span>
                Proponer receta
            </h2>
            <p class="text-muted mb-0">
                Comparte una receta con la comunidad. El administrador la revisará antes de publicarla.
            </p>
        </div>
        <a class="btn btn-outline-secondary" href="/recetas">
            <i class="bi bi-arrow-left" aria-hidden="true"></i>
            Volver a recetas
        </a>
    </div>

    <div class="card">
        <div class="card-body p-4">
            <?php require __DIR__ . '/../recetas/_form.php'; ?>
        </div>
    </div>
</div>

<div class="toast-stack" data-toast-stack aria-live="polite"></div>
<?php

$content = (string) ob_get_clean();
$title = 'Proponer receta';
$scripts = ['/assets/js/pages/receta-form.js'];
$styles = ['/assets/css/recetas.css'];
$active = 'recetas';

require __DIR__ . '/../layouts/app.php';
