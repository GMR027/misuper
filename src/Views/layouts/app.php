<?php

declare(strict_types=1);

use App\Middleware\CsrfMiddleware;
use App\Support\AvatarCatalog;

/** @var string $title */
/** @var string $content */
/** @var array<string, mixed> $usuario */
/** @var array<int, string> $scripts */
/** @var array<int, string> $styles */
/** @var string $active */
/** @var bool $ocultarNav */

$csrfToken = CsrfMiddleware::token();
$scripts ??= [];
$styles ??= [];
$active ??= '';
$ocultarNav ??= false;
$esAdmin = ($usuario['rol'] ?? '') === 'admin';

$partesNombre = preg_split('/\s+/u', trim((string) ($usuario['nombre'] ?? ''))) ?: [];
$iniciales = '';

foreach (array_slice($partesNombre, 0, 2) as $parte) {
    if ($parte !== '') {
        $iniciales .= mb_strtoupper(mb_substr($parte, 0, 1));
    }
}

if ($iniciales === '') {
    $iniciales = 'U';
}

$avatarTipo = (string) ($usuario['avatar_tipo'] ?? '');
$avatarValor = (string) ($usuario['avatar_valor'] ?? '');
$avatarEsFoto = $avatarTipo === 'foto' && $avatarValor !== '';
$avatarEsPreset = $avatarTipo === 'preset' && AvatarCatalog::has($avatarValor);
$avatarEmoji = $avatarEsPreset ? (AvatarCatalog::get($avatarValor)['emoji'] ?? '') : '';
$avatarClases = 'app-header__avatar';

if ($avatarEsFoto) {
    $avatarClases .= ' app-header__avatar--photo';
}

if ($avatarEsPreset) {
    $avatarClases .= ' user-avatar user-avatar--' . $avatarValor;
}
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="<?= htmlspecialchars($csrfToken, ENT_QUOTES, 'UTF-8') ?>">
    <title><?= htmlspecialchars($title, ENT_QUOTES, 'UTF-8') ?> · Mi Súper</title>
    <link rel="icon" href="/assets/img/favicon.svg" type="image/svg+xml">
    <link rel="icon" href="/assets/img/favicon.png" type="image/png" sizes="64x64">
    <link rel="apple-touch-icon" href="/assets/img/favicon.png">
    <meta name="theme-color" content="#0f7a57">
    <script src="/assets/js/theme.js"></script>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/@fontsource-variable/plus-jakarta-sans/index.css" rel="stylesheet">
    <link rel="stylesheet" href="/assets/css/palettes.css">
    <link rel="stylesheet" href="/assets/css/cuenta.css">
    <?php foreach ($styles as $style): ?>
        <link rel="stylesheet" href="<?= htmlspecialchars($style, ENT_QUOTES, 'UTF-8') ?>">
    <?php endforeach; ?>
    <link rel="stylesheet" href="/assets/css/theme.css">
    <link rel="stylesheet" href="/assets/css/texture.css">
    <link rel="stylesheet" href="/assets/css/avatars.css">
    <link rel="stylesheet" href="/assets/css/modes.css">
</head>
<body class="app">
    <a class="skip-link" href="#contenido">Saltar al contenido</a>

    <header class="app-header">
        <div class="app-header__inner">
            <a class="app-header__brand" href="/">
                <span class="brand-mark" aria-hidden="true"><i class="bi bi-basket2-fill"></i></span>
                <span class="brand-text">Mi Súper</span>
            </a>

            <?php if (!$ocultarNav): ?>
                <nav class="app-nav" aria-label="Navegación principal">
                    <a class="app-nav__link<?= $active === 'inicio' ? ' is-active' : '' ?>" href="/">
                        <i class="bi bi-house-door-fill" aria-hidden="true"></i>
                        <span>Pantalla rápida</span>
                    </a>
                    <a class="app-nav__link<?= $active === 'historial' ? ' is-active' : '' ?>" href="/historial">
                        <i class="bi bi-clock-history" aria-hidden="true"></i>
                        <span>Historial</span>
                    </a>
                    <a class="app-nav__link<?= $active === 'notas' ? ' is-active' : '' ?>" href="/notas">
                        <i class="bi bi-journal-richtext" aria-hidden="true"></i>
                        <span>Notas</span>
                    </a>
                    <a class="app-nav__link<?= $active === 'metricas' ? ' is-active' : '' ?>" href="/metricas">
                        <i class="bi bi-bar-chart-line-fill" aria-hidden="true"></i>
                        <span>Métricas</span>
                    </a>
                    <a class="app-nav__link<?= $active === 'ajustes' ? ' is-active' : '' ?>" href="/ajustes">
                        <i class="bi bi-sliders2" aria-hidden="true"></i>
                        <span>Ajustes</span>
                    </a>
                    <?php if ($esAdmin): ?>
                        <a class="app-nav__link<?= $active === 'admin-productos' ? ' is-active' : '' ?>" href="/admin/productos">
                            <i class="bi bi-box-seam" aria-hidden="true"></i>
                            <span>Productos</span>
                        </a>
                        <a class="app-nav__link<?= $active === 'admin-usuarios' ? ' is-active' : '' ?>" href="/admin/usuarios">
                            <i class="bi bi-people-fill" aria-hidden="true"></i>
                            <span>Usuarios</span>
                        </a>
                        <a class="app-nav__link<?= $active === 'admin-sugerencias' ? ' is-active' : '' ?>" href="/admin/sugerencias">
                            <i class="bi bi-lightbulb-fill" aria-hidden="true"></i>
                            <span>Sugerencias</span>
                        </a>
                    <?php endif; ?>
                </nav>
            <?php endif; ?>

            <div class="app-header__account">
                <span class="<?= htmlspecialchars($avatarClases, ENT_QUOTES, 'UTF-8') ?>" data-header-avatar aria-hidden="true">
                    <?php if ($avatarEsFoto): ?>
                        <img src="<?= htmlspecialchars($avatarValor, ENT_QUOTES, 'UTF-8') ?>" alt="">
                    <?php elseif ($avatarEsPreset): ?>
                        <?= htmlspecialchars($avatarEmoji, ENT_QUOTES, 'UTF-8') ?>
                    <?php else: ?>
                        <?= htmlspecialchars($iniciales, ENT_QUOTES, 'UTF-8') ?>
                    <?php endif; ?>
                </span>
                <span class="app-header__name" data-username>
                    <?= htmlspecialchars((string) ($usuario['nombre'] ?? ''), ENT_QUOTES, 'UTF-8') ?>
                </span>
                <button class="app-header__logout" type="button" data-logout>
                    <i class="bi bi-box-arrow-right" aria-hidden="true"></i>
                    <span>Cerrar sesión</span>
                </button>
            </div>
        </div>
    </header>

    <?php if (!$ocultarNav): ?>
        <nav class="app-dock" data-dock aria-label="Navegación rápida">
            <div class="app-dock__bar">
                <a class="app-dock__item<?= $active === 'inicio' ? ' is-active' : '' ?>" href="/" aria-label="Pantalla rápida" title="Pantalla rápida"<?= $active === 'inicio' ? ' aria-current="page"' : '' ?>>
                    <i class="bi bi-house-door-fill" aria-hidden="true"></i>
                </a>
                <button class="app-dock__fab" type="button" data-dock-nuevo aria-expanded="false" aria-controls="dock-search-modal" aria-label="Buscar producto" title="Buscar producto">
                    <i class="bi bi-plus-lg" aria-hidden="true"></i>
                </button>
                <button class="app-dock__item app-dock__item--menu" type="button" data-dock-menu aria-expanded="false" aria-controls="dock-menu-modal" aria-label="Abrir menú" title="Menú">
                    <i class="bi bi-list" aria-hidden="true"></i>
                </button>
            </div>
        </nav>
    <?php endif; ?>

    <main class="app-main" id="contenido">
        <?= $content ?>
    </main>

    <?php if (!$ocultarNav): ?>
        <div class="dock-modal" id="dock-search-modal" data-dock-search-modal hidden role="dialog" aria-modal="true" aria-labelledby="dock-search-title">
            <div class="dock-modal__panel">
                <span class="dock-modal__grabber" aria-hidden="true"></span>
                <div class="dock-modal__head">
                    <h2 class="dock-modal__title" id="dock-search-title">
                        <i class="bi bi-search" aria-hidden="true"></i> Buscar producto
                    </h2>
                    <button class="dock-modal__close" type="button" data-dock-close aria-label="Cerrar">
                        <i class="bi bi-x-lg" aria-hidden="true"></i>
                    </button>
                </div>
                <div class="dock-modal__body">
                    <label class="visually-hidden" for="dock-search">Buscar producto</label>
                    <input class="form-control dock-search__input" id="dock-search" type="search" placeholder="Ej. leche, arroz, detergente…" autocomplete="off" data-dock-search>
                    <p class="dock-search__status" data-dock-search-status></p>
                    <ul class="list-unstyled dock-results" data-dock-results></ul>
                </div>
                <div class="dock-modal__foot">
                    <a class="btn btn-outline-primary w-100" href="/">
                        <i class="bi bi-cart3" aria-hidden="true"></i> Ir a Pantalla rápida
                    </a>
                </div>
            </div>
        </div>

        <div class="dock-modal" id="dock-menu-modal" data-dock-menu-modal hidden role="dialog" aria-modal="true" aria-labelledby="dock-menu-title">
            <div class="dock-modal__panel">
                <span class="dock-modal__grabber" aria-hidden="true"></span>
                <div class="dock-modal__head">
                    <h2 class="dock-modal__title" id="dock-menu-title">Menú</h2>
                    <button class="dock-modal__close" type="button" data-dock-close aria-label="Cerrar">
                        <i class="bi bi-x-lg" aria-hidden="true"></i>
                    </button>
                </div>
                <div class="dock-user">
                    <span class="<?= htmlspecialchars($avatarClases, ENT_QUOTES, 'UTF-8') ?> dock-user__avatar" aria-hidden="true">
                        <?php if ($avatarEsFoto): ?>
                            <img src="<?= htmlspecialchars($avatarValor, ENT_QUOTES, 'UTF-8') ?>" alt="">
                        <?php elseif ($avatarEsPreset): ?>
                            <?= htmlspecialchars($avatarEmoji, ENT_QUOTES, 'UTF-8') ?>
                        <?php else: ?>
                            <?= htmlspecialchars($iniciales, ENT_QUOTES, 'UTF-8') ?>
                        <?php endif; ?>
                    </span>
                    <span class="dock-user__text">
                        <strong class="dock-user__name"><?= htmlspecialchars((string) ($usuario['nombre'] ?? ''), ENT_QUOTES, 'UTF-8') ?></strong>
                        <span class="dock-user__role"><?= $esAdmin ? 'Administrador' : 'Cuenta personal' ?></span>
                    </span>
                    <a class="dock-user__link" href="/ajustes" aria-label="Abrir ajustes de la cuenta">
                        <i class="bi bi-gear-fill" aria-hidden="true"></i>
                    </a>
                </div>
                <nav class="dock-menu" aria-label="Más secciones">
                    <p class="dock-menu__label">Secciones</p>
                    <a class="dock-menu__link<?= $active === 'historial' ? ' is-active' : '' ?>" href="/historial">
                        <span class="dock-menu__icon"><i class="bi bi-clock-history" aria-hidden="true"></i></span>
                        <span class="dock-menu__text">Historial</span>
                        <i class="bi bi-chevron-right dock-menu__chevron" aria-hidden="true"></i>
                    </a>
                    <a class="dock-menu__link<?= $active === 'notas' ? ' is-active' : '' ?>" href="/notas">
                        <span class="dock-menu__icon"><i class="bi bi-journal-richtext" aria-hidden="true"></i></span>
                        <span class="dock-menu__text">Notas</span>
                        <i class="bi bi-chevron-right dock-menu__chevron" aria-hidden="true"></i>
                    </a>
                    <a class="dock-menu__link<?= $active === 'metricas' ? ' is-active' : '' ?>" href="/metricas">
                        <span class="dock-menu__icon"><i class="bi bi-bar-chart-line-fill" aria-hidden="true"></i></span>
                        <span class="dock-menu__text">Métricas</span>
                        <i class="bi bi-chevron-right dock-menu__chevron" aria-hidden="true"></i>
                    </a>
                    <a class="dock-menu__link<?= $active === 'ajustes' ? ' is-active' : '' ?>" href="/ajustes">
                        <span class="dock-menu__icon"><i class="bi bi-sliders2" aria-hidden="true"></i></span>
                        <span class="dock-menu__text">Ajustes</span>
                        <i class="bi bi-chevron-right dock-menu__chevron" aria-hidden="true"></i>
                    </a>
                    <?php if ($esAdmin): ?>
                        <p class="dock-menu__label">Administración</p>
                        <a class="dock-menu__link<?= $active === 'admin-productos' ? ' is-active' : '' ?>" href="/admin/productos">
                            <span class="dock-menu__icon"><i class="bi bi-box-seam" aria-hidden="true"></i></span>
                            <span class="dock-menu__text">Productos</span>
                            <i class="bi bi-chevron-right dock-menu__chevron" aria-hidden="true"></i>
                        </a>
                        <a class="dock-menu__link<?= $active === 'admin-usuarios' ? ' is-active' : '' ?>" href="/admin/usuarios">
                            <span class="dock-menu__icon"><i class="bi bi-people-fill" aria-hidden="true"></i></span>
                            <span class="dock-menu__text">Usuarios</span>
                            <i class="bi bi-chevron-right dock-menu__chevron" aria-hidden="true"></i>
                        </a>
                        <a class="dock-menu__link<?= $active === 'admin-sugerencias' ? ' is-active' : '' ?>" href="/admin/sugerencias">
                            <span class="dock-menu__icon"><i class="bi bi-lightbulb-fill" aria-hidden="true"></i></span>
                            <span class="dock-menu__text">Sugerencias</span>
                            <i class="bi bi-chevron-right dock-menu__chevron" aria-hidden="true"></i>
                        </a>
                    <?php endif; ?>
                </nav>
                <div class="dock-modal__foot dock-modal__foot--menu">
                    <button class="dock-menu__logout" type="button" data-dock-logout>
                        <i class="bi bi-box-arrow-right" aria-hidden="true"></i>
                        <span>Cerrar sesión</span>
                    </button>
                </div>
            </div>
        </div>
    <?php endif; ?>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/js/bootstrap.bundle.min.js"></script>
    <?php if (!$ocultarNav): ?>
        <script type="module" src="/assets/js/dock.js"></script>
    <?php endif; ?>
    <?php foreach ($scripts as $script): ?>
        <script type="module" src="<?= htmlspecialchars($script, ENT_QUOTES, 'UTF-8') ?>"></script>
    <?php endforeach; ?>
</body>
</html>
