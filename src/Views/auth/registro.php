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
                    <h4 class="card-title text-center mb-2">Crear cuenta</h4>
                    <p class="text-center text-muted small mb-4">
                        Regístrate para empezar a controlar tu despensa.
                    </p>

                    <form id="registro-form" method="post" action="/api/auth/register" novalidate>
                        <div class="mb-3">
                            <label class="form-label" for="nombre">Nombre</label>
                            <input
                                class="form-control"
                                type="text"
                                id="nombre"
                                name="nombre"
                                autocomplete="name"
                                maxlength="100"
                                required
                                autofocus
                            >
                        </div>

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
                            >
                        </div>

                        <div class="mb-3">
                            <label class="form-label" for="password">Contraseña</label>
                            <input
                                class="form-control"
                                type="password"
                                id="password"
                                name="password"
                                autocomplete="new-password"
                                minlength="8"
                                required
                            >
                            <p class="form-text">Mínimo 8 caracteres.</p>
                        </div>

                        <p class="alert alert-danger py-2 px-3 mb-3 form__message" data-message hidden></p>

                        <button class="btn btn-primary w-100" type="submit">
                            <i class="bi bi-person-plus-fill" aria-hidden="true"></i>
                            Crear cuenta
                        </button>
                    </form>

                    <p class="text-center text-muted small mt-4 mb-0">
                        ¿Ya tienes cuenta?
                        <a class="link-primary text-decoration-none" href="/login">Inicia sesión</a>
                    </p>
                </div>
            </div>
        </div>
    </div>
</div>
<?php

$content = (string) ob_get_clean();
$title = 'Crear cuenta';
$subtitle = 'Regístrate para empezar a controlar tu despensa.';
$scripts = ['/assets/js/pages/registro.js'];

require __DIR__ . '/../layouts/auth.php';
