<?php

declare(strict_types=1);

use App\Middleware\AuthMiddleware;

$usuario = AuthMiddleware::require();

ob_start();
?>
<div class="container py-4">
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
        <div>
            <h2 class="mb-1">
                <span class="title-icon"><i class="bi bi-people-fill" aria-hidden="true"></i></span>
                Usuarios
            </h2>
            <p class="text-muted mb-0">
                Crea y administra cuentas. Puedes editar sus datos, generar una contraseña
                temporal o eliminar la cuenta.
            </p>
        </div>

        <div class="d-flex flex-wrap align-items-end gap-2">
            <div>
                <label class="form-label" for="search-input">Buscar</label>
                <input
                    class="form-control w-auto"
                    type="search"
                    id="search-input"
                    maxlength="150"
                    placeholder="Nombre o email…"
                    autocomplete="off"
                    data-search
                >
            </div>

            <button class="btn btn-primary" type="button" data-nuevo-usuario>
                <i class="bi bi-person-plus-fill" aria-hidden="true"></i>
                Nuevo usuario
            </button>
        </div>
    </div>

    <div class="d-flex flex-wrap justify-content-between align-items-baseline gap-2 mb-2">
        <h5 class="mb-0" id="usuarios-tabla-title">Cuentas</h5>
        <p class="text-muted small mb-0" data-total hidden></p>
    </div>

    <div class="table-responsive">
        <table
            class="table table-hover align-middle"
            data-usuarios-table
            data-current-user-id="<?= (int) ($usuario['id'] ?? 0) ?>"
        >
            <thead class="table-light">
                <tr>
                    <th scope="col">ID</th>
                    <th scope="col">Nombre</th>
                    <th scope="col">Email</th>
                    <th scope="col">Rol</th>
                    <th scope="col">Debe cambiar</th>
                    <th scope="col">Creado</th>
                    <th class="text-end" scope="col">Acciones</th>
                </tr>
            </thead>
            <tbody data-usuarios-body>
                <tr>
                    <td class="text-center text-muted py-4" colspan="7">Cargando usuarios…</td>
                </tr>
            </tbody>
        </table>
    </div>

    <p class="form__message mt-3" data-table-message hidden></p>

    <nav aria-label="Paginación de usuarios" data-pagination hidden>
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

<div class="app-modal" id="modal-reset" data-modal-reset hidden role="dialog" aria-modal="true" aria-labelledby="reset-confirm-title">
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
            <div class="modal-body p-4" data-reset-confirm>
                <h5 class="modal-title mb-2" id="reset-confirm-title">Resetear contraseña</h5>
                <p class="text-muted small">
                    ¿Resetear contraseña de <strong data-reset-nombre></strong>? Se generará
                    una contraseña temporal que deberás compartir con el usuario.
                </p>

                <p class="form__message admin-usuarios__modal-message" data-reset-message hidden></p>

                <div class="d-flex flex-wrap justify-content-end gap-2">
                    <button class="btn btn-outline-secondary" type="button" data-reset-cancelar>Cancelar</button>
                    <button class="btn btn-primary" type="button" data-reset-confirmar>Resetear contraseña</button>
                </div>
            </div>

            <div class="modal-body p-4" data-reset-resultado hidden>
                <h5 class="modal-title mb-2" id="reset-result-title">Contraseña temporal</h5>
                <p class="text-muted small">
                    Comparte esta contraseña con <strong data-reset-email></strong>.
                    El usuario deberá cambiarla al iniciar sesión.
                </p>

                <p class="alert alert-warning text-center fs-4 fw-bold admin-usuarios__temp" data-reset-password></p>

                <p class="alert alert-warning small">
                    Esta contraseña no se volverá a mostrar. Cópiala ahora y compártela
                    con el usuario.
                </p>

                <p class="form__message admin-usuarios__modal-message" data-copy-message hidden></p>

                <div class="d-flex flex-wrap justify-content-end gap-2">
                    <button class="btn btn-outline-secondary" type="button" data-reset-cerrar>Cerrar</button>
                    <button class="btn btn-primary" type="button" data-copiar>Copiar al portapapeles</button>
                </div>
            </div>
        </div>
    </div>
</div>

<div class="app-modal" id="modal-usuario" data-modal-usuario hidden role="dialog" aria-modal="true" aria-labelledby="usuario-title">
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
            <form class="modal-body p-4" data-usuario-form novalidate>
                <h5 class="modal-title mb-2" id="usuario-title" data-usuario-title>Nuevo usuario</h5>
                <p class="text-muted small" data-usuario-subtitle>
                    Crea una cuenta y comparte la contraseña con la persona.
                </p>

                <input type="hidden" data-user-id>

                <div class="mb-3">
                    <label class="form-label" for="usuario-nombre">Nombre</label>
                    <input
                        class="form-control"
                        type="text"
                        id="usuario-nombre"
                        name="nombre"
                        maxlength="100"
                        autocomplete="off"
                        required
                    >
                    <p class="form__error" data-error-for="nombre" hidden></p>
                </div>

                <div class="row g-3">
                    <div class="col-12 col-md-8">
                        <label class="form-label" for="usuario-email">Email</label>
                        <input
                            class="form-control"
                            type="email"
                            id="usuario-email"
                            name="email"
                            maxlength="150"
                            autocomplete="off"
                            required
                        >
                        <p class="form__error" data-error-for="email" hidden></p>
                    </div>

                    <div class="col-12 col-md-4">
                        <label class="form-label" for="usuario-rol">Rol</label>
                        <select class="form-select" id="usuario-rol" name="rol" required>
                            <option value="usuario">Usuario</option>
                            <option value="admin">Admin</option>
                        </select>
                        <p class="form__error" data-error-for="rol" hidden></p>
                    </div>
                </div>

                <div data-password-group>
                    <div class="row g-3 mt-1">
                        <div class="col-12 col-md-6">
                            <label class="form-label" for="usuario-password">Contraseña inicial</label>
                            <input
                                class="form-control"
                                type="password"
                                id="usuario-password"
                                name="password"
                                minlength="8"
                                autocomplete="new-password"
                                required
                            >
                            <p class="form-text">Mínimo 8 caracteres.</p>
                            <p class="form__error" data-error-for="password" hidden></p>
                        </div>

                        <div class="col-12 col-md-6">
                            <label class="form-label" for="usuario-password-confirm">Repite la contraseña</label>
                            <input
                                class="form-control"
                                type="password"
                                id="usuario-password-confirm"
                                minlength="8"
                                autocomplete="new-password"
                                required
                            >
                            <p class="form__error" data-error-for="password_confirm" hidden></p>
                        </div>
                    </div>

                    <div class="form-check mt-3">
                        <input class="form-check-input" type="checkbox" id="usuario-debe-cambiar" data-debe-cambiar checked>
                        <label class="form-check-label" for="usuario-debe-cambiar">
                            Pedir cambio de contraseña al iniciar sesión
                        </label>
                    </div>
                </div>

                <p class="text-muted small mt-3" data-password-nota hidden>
                    La contraseña no se cambia desde aquí. Usa «Resetear contraseña» para
                    generar una temporal.
                </p>

                <p class="form__message mt-3" data-usuario-message hidden></p>

                <div class="d-flex flex-wrap justify-content-end gap-2 mt-4">
                    <button class="btn btn-outline-secondary" type="button" data-usuario-cancelar>Cancelar</button>
                    <button class="btn btn-primary" type="submit" data-usuario-submit>Crear usuario</button>
                </div>
            </form>
        </div>
    </div>
</div>

<div class="app-modal" id="modal-eliminar" data-modal-eliminar hidden role="dialog" aria-modal="true" aria-labelledby="delete-title">
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
            <div class="modal-body p-4">
                <h5 class="modal-title mb-2" id="delete-title">Eliminar usuario</h5>
                <p class="text-muted small">
                    ¿Eliminar la cuenta de <strong data-delete-nombre></strong>
                    (<span data-delete-email></span>)?
                </p>

                <p class="alert alert-danger small">
                    Se borrarán también sus compras, notas y fotos. Esta acción no se
                    puede deshacer.
                </p>

                <p class="form__message admin-usuarios__modal-message" data-delete-message hidden></p>

                <div class="d-flex flex-wrap justify-content-end gap-2">
                    <button class="btn btn-outline-secondary" type="button" data-delete-cancelar>Cancelar</button>
                    <button class="btn btn-danger" type="button" data-delete-confirmar>Eliminar definitivamente</button>
                </div>
            </div>
        </div>
    </div>
</div>

<div class="toast-stack" data-toast-stack aria-live="polite"></div>
<?php

$content = (string) ob_get_clean();
$title = 'Usuarios · Admin';
$scripts = ['/assets/js/pages/admin-usuarios.js'];
$styles = [
    '/assets/css/admin.css',
    '/assets/css/pantalla-rapida.css',
    '/assets/css/admin-usuarios.css',
];
$active = 'admin-usuarios';

require __DIR__ . '/../../layouts/app.php';
