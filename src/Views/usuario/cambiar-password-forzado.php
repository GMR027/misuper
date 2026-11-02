<?php

declare(strict_types=1);

use App\Middleware\AuthMiddleware;
use App\Middleware\CsrfMiddleware;

$usuario = AuthMiddleware::require();
$csrfToken = CsrfMiddleware::token();

ob_start();
?>
<div class="container py-4">
    <div class="row justify-content-center">
        <div class="col-12 col-md-8 col-lg-6">
            <div class="card card--bs shadow-sm">
                <div class="card-body p-4">
                    <h4 class="card-title text-center mb-2">Cambiar contraseña</h4>
                    <p class="text-center text-muted small mb-4">
                        Hola, <?= htmlspecialchars($usuario['nombre'], ENT_QUOTES, 'UTF-8') ?>.
                        Antes de continuar necesitas establecer una contraseña nueva.
                    </p>

                    <form id="password-forzado-form" method="post" action="/api/me/password-forzado" novalidate>
                        <input type="hidden" name="_csrf" value="<?= htmlspecialchars($csrfToken, ENT_QUOTES, 'UTF-8') ?>">

                        <div class="mb-3">
                            <label class="form-label" for="password_nueva">Contraseña nueva</label>
                            <input
                                class="form-control"
                                type="password"
                                id="password_nueva"
                                name="password_nueva"
                                autocomplete="new-password"
                                minlength="8"
                                required
                                autofocus
                            >
                            <p class="form-text">Mínimo 8 caracteres.</p>
                        </div>

                        <div class="mb-3">
                            <label class="form-label" for="password_confirmar">Confirmar contraseña</label>
                            <input
                                class="form-control"
                                type="password"
                                id="password_confirmar"
                                name="password_confirmar"
                                autocomplete="new-password"
                                minlength="8"
                                required
                            >
                        </div>

                        <p class="form__message mb-3" data-message hidden></p>

                        <button class="btn btn-primary w-100" type="submit">Guardar contraseña</button>
                    </form>
                </div>
            </div>
        </div>
    </div>
</div>
<?php

$content = (string) ob_get_clean();
$title = 'Cambia tu contraseña';
$scripts = ['/assets/js/pages/cambiar-password-forzado.js'];
$active = '';
$ocultarNav = true;

require __DIR__ . '/../layouts/app.php';
