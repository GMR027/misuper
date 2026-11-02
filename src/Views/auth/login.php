<?php

declare(strict_types=1);

ob_start();
?>
<div class="container">
    <div class="row justify-content-center">
        <div class="col-12 col-sm-8 col-md-6 col-lg-4">
            <div class="card shadow-sm">
                <div class="card-body p-4">
                    <p class="auth__brand">
                        <i class="bi bi-basket2-fill" aria-hidden="true"></i>
                        Mi Súper
                    </p>
                    <h4 class="card-title text-center mb-2">Iniciar sesión</h4>
                    <p class="text-center text-muted small mb-4">
                        Accede para registrar tus compras y ver tus gastos.
                    </p>

                    <form id="login-form" method="post" action="/api/auth/login" novalidate>
                        <div class="mb-3">
                            <label class="form-label" for="email">Correo electrónico</label>
                            <input
                                class="form-control"
                                type="email"
                                id="email"
                                name="email"
                                autocomplete="email"
                                maxlength="150"
                                required
                                autofocus
                            >
                        </div>

                        <div class="mb-3">
                            <label class="form-label" for="password">Contraseña</label>
                            <input
                                class="form-control"
                                type="password"
                                id="password"
                                name="password"
                                autocomplete="current-password"
                                minlength="8"
                                required
                            >
                        </div>

                        <p class="alert alert-danger py-2 px-3 mb-3 form__message" data-message hidden></p>

                        <button class="btn btn-primary w-100" type="submit">
                            <i class="bi bi-box-arrow-in-right" aria-hidden="true"></i>
                            Entrar
                        </button>
                    </form>

                    <p class="text-center text-muted small mt-4 mb-0">
                        ¿No tienes cuenta?
                        <a class="link-primary text-decoration-none" href="/registro">Regístrate</a>
                    </p>
                </div>
            </div>
        </div>
    </div>
</div>
<?php

$content = (string) ob_get_clean();
$title = 'Iniciar sesión';
$subtitle = 'Accede para registrar tus compras y ver tus gastos.';
$scripts = ['/assets/js/pages/login.js'];

require __DIR__ . '/../layouts/auth.php';
