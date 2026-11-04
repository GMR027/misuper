<?php

declare(strict_types=1);

use App\Middleware\AuthMiddleware;
use App\Middleware\CsrfMiddleware;
use App\Support\AvatarCatalog;

$usuario = AuthMiddleware::require();
$csrfToken = CsrfMiddleware::token();

$avatarTipo = (string) ($usuario['avatar_tipo'] ?? '');
$avatarValor = (string) ($usuario['avatar_valor'] ?? '');
$avatarEsFoto = $avatarTipo === 'foto' && $avatarValor !== '';
$avatarEsPreset = $avatarTipo === 'preset' && AvatarCatalog::has($avatarValor);
$avatarEmoji = $avatarEsPreset ? (AvatarCatalog::get($avatarValor)['emoji'] ?? '') : '';
$avatarLabel = $avatarEsPreset ? (AvatarCatalog::get($avatarValor)['label'] ?? '') : '';
$avatarIniciales = AvatarCatalog::initials($usuario['nombre']);
$avatarTab = $avatarEsPreset ? 'preset' : 'foto';
$avatares = AvatarCatalog::all();

ob_start();
?>
<div class="container py-4">
    <h2 class="mb-1">
        <span class="title-icon"><i class="bi bi-sliders2" aria-hidden="true"></i></span>
        Ajustes
    </h2>
    <p class="text-muted mb-4">Administra tus datos, tu contraseña y tu cuenta.</p>

    <div class="row">
        <div class="col-12 col-lg-9 mx-auto">
    <section class="card card--bs shadow-sm mb-4 theme-picker" aria-labelledby="tema-title">
        <div class="card-body p-4">
            <h3 class="h5 card-title mb-1" id="tema-title">
                <span class="title-icon"><i class="bi bi-palette-fill" aria-hidden="true"></i></span>
                Color del tema
            </h3>
            <p class="text-muted small mb-3">
                Elige una paleta y la apariencia. Se aplica al instante y se recuerda en este navegador.
            </p>

            <div class="mode-picker" role="group" aria-label="Apariencia de la aplicación">
                <span class="mode-picker__label">Apariencia</span>
                <div class="mode-picker__options">
                    <button class="mode-option" type="button" data-mode-choice="light" aria-pressed="false">
                        <i class="bi bi-sun-fill" aria-hidden="true"></i>
                        Claro
                    </button>
                    <button class="mode-option" type="button" data-mode-choice="dark" aria-pressed="false">
                        <i class="bi bi-moon-stars-fill" aria-hidden="true"></i>
                        Oscuro
                    </button>
                    <button class="mode-option" type="button" data-mode-choice="auto" aria-pressed="false">
                        <i class="bi bi-circle-half" aria-hidden="true"></i>
                        Sistema
                    </button>
                </div>
            </div>

            <div class="theme-grid" role="group" aria-label="Paletas de color" data-theme-grid>
                <button class="theme-swatch theme-swatch--esmeralda" type="button" data-theme-choice="esmeralda" aria-pressed="true">
                    <span class="theme-swatch__preview" aria-hidden="true"></span>
                    <span class="theme-swatch__label">Esmeralda</span>
                    <span class="theme-swatch__check" aria-hidden="true"><i class="bi bi-check2"></i></span>
                </button>
                <button class="theme-swatch theme-swatch--oceano" type="button" data-theme-choice="oceano" aria-pressed="false">
                    <span class="theme-swatch__preview" aria-hidden="true"></span>
                    <span class="theme-swatch__label">Océano</span>
                    <span class="theme-swatch__check" aria-hidden="true"><i class="bi bi-check2"></i></span>
                </button>
                <button class="theme-swatch theme-swatch--indigo" type="button" data-theme-choice="indigo" aria-pressed="false">
                    <span class="theme-swatch__preview" aria-hidden="true"></span>
                    <span class="theme-swatch__label">Índigo</span>
                    <span class="theme-swatch__check" aria-hidden="true"><i class="bi bi-check2"></i></span>
                </button>
                <button class="theme-swatch theme-swatch--uva" type="button" data-theme-choice="uva" aria-pressed="false">
                    <span class="theme-swatch__preview" aria-hidden="true"></span>
                    <span class="theme-swatch__label">Uva</span>
                    <span class="theme-swatch__check" aria-hidden="true"><i class="bi bi-check2"></i></span>
                </button>
                <button class="theme-swatch theme-swatch--frambuesa" type="button" data-theme-choice="frambuesa" aria-pressed="false">
                    <span class="theme-swatch__preview" aria-hidden="true"></span>
                    <span class="theme-swatch__label">Frambuesa</span>
                    <span class="theme-swatch__check" aria-hidden="true"><i class="bi bi-check2"></i></span>
                </button>
                <button class="theme-swatch theme-swatch--terracota" type="button" data-theme-choice="terracota" aria-pressed="false">
                    <span class="theme-swatch__preview" aria-hidden="true"></span>
                    <span class="theme-swatch__label">Terracota</span>
                    <span class="theme-swatch__check" aria-hidden="true"><i class="bi bi-check2"></i></span>
                </button>
                <button class="theme-swatch theme-swatch--ambar" type="button" data-theme-choice="ambar" aria-pressed="false">
                    <span class="theme-swatch__preview" aria-hidden="true"></span>
                    <span class="theme-swatch__label">Ámbar</span>
                    <span class="theme-swatch__check" aria-hidden="true"><i class="bi bi-check2"></i></span>
                </button>
                <button class="theme-swatch theme-swatch--citrico" type="button" data-theme-choice="citrico" aria-pressed="false">
                    <span class="theme-swatch__preview" aria-hidden="true"></span>
                    <span class="theme-swatch__label">Cítrico</span>
                    <span class="theme-swatch__check" aria-hidden="true"><i class="bi bi-check2"></i></span>
                </button>
                <button class="theme-swatch theme-swatch--cielo" type="button" data-theme-choice="cielo" aria-pressed="false">
                    <span class="theme-swatch__preview" aria-hidden="true"></span>
                    <span class="theme-swatch__label">Cielo</span>
                    <span class="theme-swatch__check" aria-hidden="true"><i class="bi bi-check2"></i></span>
                </button>
                <button class="theme-swatch theme-swatch--grafito" type="button" data-theme-choice="grafito" aria-pressed="false">
                    <span class="theme-swatch__preview" aria-hidden="true"></span>
                    <span class="theme-swatch__label">Grafito</span>
                    <span class="theme-swatch__check" aria-hidden="true"><i class="bi bi-check2"></i></span>
                </button>
                <button class="theme-swatch theme-swatch--menta" type="button" data-theme-choice="menta" aria-pressed="false">
                    <span class="theme-swatch__preview" aria-hidden="true"></span>
                    <span class="theme-swatch__label">Menta</span>
                    <span class="theme-swatch__check" aria-hidden="true"><i class="bi bi-check2"></i></span>
                </button>
                <button class="theme-swatch theme-swatch--lavanda" type="button" data-theme-choice="lavanda" aria-pressed="false">
                    <span class="theme-swatch__preview" aria-hidden="true"></span>
                    <span class="theme-swatch__label">Lavanda</span>
                    <span class="theme-swatch__check" aria-hidden="true"><i class="bi bi-check2"></i></span>
                </button>
                <button class="theme-swatch theme-swatch--cereza" type="button" data-theme-choice="cereza" aria-pressed="false">
                    <span class="theme-swatch__preview" aria-hidden="true"></span>
                    <span class="theme-swatch__label">Cereza</span>
                    <span class="theme-swatch__check" aria-hidden="true"><i class="bi bi-check2"></i></span>
                </button>
                <button class="theme-swatch theme-swatch--durazno" type="button" data-theme-choice="durazno" aria-pressed="false">
                    <span class="theme-swatch__preview" aria-hidden="true"></span>
                    <span class="theme-swatch__label">Durazno</span>
                    <span class="theme-swatch__check" aria-hidden="true"><i class="bi bi-check2"></i></span>
                </button>
                <button class="theme-swatch theme-swatch--arena" type="button" data-theme-choice="arena" aria-pressed="false">
                    <span class="theme-swatch__preview" aria-hidden="true"></span>
                    <span class="theme-swatch__label">Arena</span>
                    <span class="theme-swatch__check" aria-hidden="true"><i class="bi bi-check2"></i></span>
                </button>
            </div>

            <div class="focus-picker">
                <div class="focus-picker__head">
                    <span class="mode-picker__label">Color de enfoque</span>
                    <span class="focus-picker__hint">Tiñe el halo del fondo y los detalles de acento.</span>
                </div>
                <div class="focus-grid" role="group" aria-label="Colores de enfoque" data-focus-grid>
                    <button class="focus-option" type="button" data-focus-choice="auto" aria-pressed="true">
                        <i class="bi bi-magic" aria-hidden="true"></i>
                        Automático
                    </button>
                    <label class="focus-custom">
                        <input type="color" data-focus-custom data-default="#14b8a6" value="#14b8a6" aria-label="Color de enfoque personalizado">
                        <span class="focus-custom__label">Personalizado</span>
                    </label>
                </div>
                <div class="focus-intensity">
                    <label class="focus-intensity__label" for="focus-intensity">Intensidad</label>
                    <input class="focus-intensity__range" id="focus-intensity" type="range" min="0" max="200" step="5" value="100" data-focus-intensity aria-describedby="focus-intensity-value">
                    <output class="focus-intensity__value" id="focus-intensity-value" for="focus-intensity" data-focus-intensity-value>100%</output>
                </div>
                <div class="focus-intensity">
                    <label class="focus-intensity__label" for="focus-spread">Expansión</label>
                    <input class="focus-intensity__range" id="focus-spread" type="range" min="50" max="250" step="5" value="100" data-focus-spread aria-describedby="focus-spread-value">
                    <output class="focus-intensity__value" id="focus-spread-value" for="focus-spread" data-focus-spread-value>100%</output>
                </div>
            </div>

            <p class="theme-picker__note mb-0">
                <i class="bi bi-info-circle" aria-hidden="true"></i>
                Este ajuste es personal y no cambia la cuenta.
            </p>
        </div>
    </section>

    <div class="row">
        <div class="col-12">
            <section class="card card--bs shadow-sm mb-4" aria-labelledby="perfil-title">
                <div class="card-body p-4">
                    <h3 class="h5 card-title mb-1" id="perfil-title">
                        <span class="title-icon"><i class="bi bi-person-fill" aria-hidden="true"></i></span>
                        Datos personales
                    </h3>
                    <p class="text-muted small mb-3">Este nombre y correo identifican tu cuenta.</p>

                    <div class="avatar-editor" data-avatar-editor data-avatar-tab="<?= htmlspecialchars($avatarTab, ENT_QUOTES, 'UTF-8') ?>">
                        <div class="avatar-editor__preview">
                            <div class="avatar-preview" data-avatar-preview>
                                <?php if ($avatarEsFoto): ?>
                                    <span class="user-avatar user-avatar--preview user-avatar--photo">
                                        <img src="<?= htmlspecialchars($avatarValor, ENT_QUOTES, 'UTF-8') ?>" alt="Foto de perfil actual">
                                    </span>
                                <?php elseif ($avatarEsPreset): ?>
                                    <span class="user-avatar user-avatar--preview user-avatar--<?= htmlspecialchars($avatarValor, ENT_QUOTES, 'UTF-8') ?>">
                                        <?= htmlspecialchars($avatarEmoji, ENT_QUOTES, 'UTF-8') ?>
                                    </span>
                                <?php else: ?>
                                    <span class="user-avatar user-avatar--preview user-avatar--initials">
                                        <?= htmlspecialchars($avatarIniciales, ENT_QUOTES, 'UTF-8') ?>
                                    </span>
                                <?php endif; ?>
                            </div>
                            <p class="avatar-editor__caption" data-avatar-caption>
                                <?= $avatarEsFoto ? 'Foto actual' : ($avatarEsPreset ? 'Avatar: ' . htmlspecialchars($avatarLabel, ENT_QUOTES, 'UTF-8') : 'Sin foto ni avatar') ?>
                            </p>
                            <button class="btn btn-outline-danger btn-sm" type="button" data-avatar-remove <?= $avatarEsFoto || $avatarEsPreset ? '' : 'hidden' ?>>
                                <i class="bi bi-trash3" aria-hidden="true"></i>
                                Quitar
                            </button>
                        </div>

                        <div class="avatar-editor__controls">
                            <div class="avatar-tabs" role="tablist" aria-label="Tipo de foto de perfil">
                                <button
                                    class="avatar-tab<?= $avatarTab === 'foto' ? ' is-active' : '' ?>"
                                    type="button"
                                    role="tab"
                                    data-avatar-tab="foto"
                                    aria-selected="<?= $avatarTab === 'foto' ? 'true' : 'false' ?>"
                                >
                                    <i class="bi bi-upload" aria-hidden="true"></i>
                                    Subir foto
                                </button>
                                <button
                                    class="avatar-tab<?= $avatarTab === 'preset' ? ' is-active' : '' ?>"
                                    type="button"
                                    role="tab"
                                    data-avatar-tab="preset"
                                    aria-selected="<?= $avatarTab === 'preset' ? 'true' : 'false' ?>"
                                >
                                    <i class="bi bi-grid-3x3-gap-fill" aria-hidden="true"></i>
                                    Elegir avatar
                                </button>
                            </div>

                            <div class="avatar-panel" data-avatar-panel="foto" <?= $avatarTab === 'foto' ? '' : 'hidden' ?>>
                                <label class="form-label" for="avatar_foto">Imagen desde tu dispositivo</label>
                                <input
                                    class="form-control"
                                    type="file"
                                    id="avatar_foto"
                                    accept="image/jpeg,image/png,image/webp"
                                >
                                <p class="form-text mb-2">JPG, PNG o WebP · máximo 2 MB.</p>
                                <button class="btn btn-primary btn-sm" type="button" data-avatar-upload disabled>
                                    <i class="bi bi-cloud-arrow-up" aria-hidden="true"></i>
                                    Subir foto
                                </button>
                            </div>

                            <div class="avatar-panel" data-avatar-panel="preset" <?= $avatarTab === 'preset' ? '' : 'hidden' ?>>
                                <p class="form-label mb-2">Elige uno de los <?= count($avatares) ?> avatares</p>
                                <div class="avatar-grid" data-avatar-grid>
                                    <?php foreach ($avatares as $avatarId => $avatar): ?>
                                        <button
                                            class="avatar-option<?= $avatarEsPreset && $avatarValor === $avatarId ? ' is-selected' : '' ?>"
                                            type="button"
                                            data-avatar-choice="<?= htmlspecialchars($avatarId, ENT_QUOTES, 'UTF-8') ?>"
                                            data-avatar-emoji="<?= htmlspecialchars($avatar['emoji'], ENT_QUOTES, 'UTF-8') ?>"
                                            aria-pressed="<?= $avatarEsPreset && $avatarValor === $avatarId ? 'true' : 'false' ?>"
                                            title="<?= htmlspecialchars($avatar['label'], ENT_QUOTES, 'UTF-8') ?>"
                                        >
                                            <span class="user-avatar user-avatar--<?= htmlspecialchars($avatarId, ENT_QUOTES, 'UTF-8') ?>" aria-hidden="true">
                                                <?= htmlspecialchars($avatar['emoji'], ENT_QUOTES, 'UTF-8') ?>
                                            </span>
                                            <span class="visually-hidden"><?= htmlspecialchars($avatar['label'], ENT_QUOTES, 'UTF-8') ?></span>
                                        </button>
                                    <?php endforeach; ?>
                                </div>
                            </div>

                            <p class="form__message mt-3 mb-0" data-avatar-message hidden></p>
                        </div>
                    </div>

                    <form id="perfil-form" method="post" action="/api/me" novalidate>
                        <input type="hidden" name="_csrf" value="<?= htmlspecialchars($csrfToken, ENT_QUOTES, 'UTF-8') ?>">

                        <div class="mb-3">
                            <label class="form-label" for="nombre">Nombre</label>
                            <input
                                class="form-control"
                                type="text"
                                id="nombre"
                                name="nombre"
                                autocomplete="name"
                                maxlength="100"
                                minlength="2"
                                value="<?= htmlspecialchars($usuario['nombre'], ENT_QUOTES, 'UTF-8') ?>"
                                required
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
                                value="<?= htmlspecialchars($usuario['email'], ENT_QUOTES, 'UTF-8') ?>"
                                required
                            >
                        </div>

                        <p class="form__message mb-3" data-message hidden></p>

                        <button class="btn btn-primary" type="submit">Guardar cambios</button>
                    </form>
                </div>
            </section>

            <section class="card card--bs shadow-sm mb-4" aria-labelledby="password-title">
                <div class="card-body p-4">
                    <h3 class="h5 card-title mb-1" id="password-title">
                        <span class="title-icon"><i class="bi bi-shield-lock-fill" aria-hidden="true"></i></span>
                        Contraseña
                    </h3>
                    <p class="text-muted small mb-3">Confirma tu contraseña actual para cambiarla.</p>

                    <form id="password-form" method="post" action="/api/me/password" novalidate>
                        <input type="hidden" name="_csrf" value="<?= htmlspecialchars($csrfToken, ENT_QUOTES, 'UTF-8') ?>">

                        <div class="mb-3">
                            <label class="form-label" for="password_actual">Contraseña actual</label>
                            <input
                                class="form-control"
                                type="password"
                                id="password_actual"
                                name="password_actual"
                                autocomplete="current-password"
                                required
                            >
                        </div>

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
                            >
                            <p class="form-text">Mínimo 8 caracteres y distinta de la actual.</p>
                        </div>

                        <div class="mb-3">
                            <label class="form-label" for="password_confirmar">Confirmar contraseña nueva</label>
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

                        <button class="btn btn-primary" type="submit">Cambiar contraseña</button>
                    </form>
                </div>
            </section>

            <section class="card card--bs border-danger shadow-sm mb-4" aria-labelledby="baja-title">
                <div class="card-body p-4">
                    <h3 class="h5 card-title text-danger mb-1" id="baja-title">
                        <span class="title-icon"><i class="bi bi-trash3-fill" aria-hidden="true"></i></span>
                        Eliminar cuenta
                    </h3>
                    <p class="text-muted small mb-3">
                        Se borrarán tu cuenta y todos tus datos asociados. No se puede deshacer.
                    </p>

                    <button class="btn btn-outline-danger" type="button" data-delete-start>
                        Eliminar mi cuenta
                    </button>

                    <div class="border-top mt-4 pt-4" data-delete-panel hidden>
                        <p class="text-muted small">
                            Para confirmar, escribe <strong class="text-danger">ELIMINAR</strong> en el campo y pulsa el botón rojo.
                        </p>

                        <div class="mb-3">
                            <label class="form-label" for="confirmar_eliminar">Confirmación</label>
                            <input
                                class="form-control"
                                type="text"
                                id="confirmar_eliminar"
                                autocomplete="off"
                                spellcheck="false"
                                data-delete-input
                            >
                        </div>

                        <form id="delete-form" method="post" action="/api/me" novalidate>
                            <input type="hidden" name="_csrf" value="<?= htmlspecialchars($csrfToken, ENT_QUOTES, 'UTF-8') ?>">

                            <p class="form__message mb-3" data-message hidden></p>

                            <div class="d-flex flex-wrap gap-2">
                                <button class="btn btn-danger" type="submit" data-delete-submit>
                                    Eliminar definitivamente
                                </button>
                                <button class="btn btn-outline-secondary" type="button" data-delete-cancel>
                                    Cancelar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </section>
        </div>
    </div>
        </div>
    </div>
</div>
<?php

$content = (string) ob_get_clean();
$title = 'Ajustes';
$scripts = ['/assets/js/pages/ajustes.js'];
$styles = ['/assets/css/ajustes.css'];
$active = 'ajustes';

require __DIR__ . '/../layouts/app.php';
