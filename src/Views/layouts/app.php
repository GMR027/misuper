<?php

declare(strict_types=1);

use App\Middleware\CsrfMiddleware;
use App\Support\Asset;
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

/*
 * Mapa único de navegación. El sidebar de escritorio, los grupos de tableta
 * y el menú móvil se generan desde aquí para no duplicar etiquetas ni rutas.
 */
$navItems = [
    'inicio' => [
        'href' => '/',
        'label' => 'Inicio',
        'icono' => 'bi-house-door-fill',
        'desc' => 'Captura rápida y carrito',
    ],
    'lista-compras' => [
        'href' => '/lista-compras',
        'label' => 'Por comprar',
        'icono' => 'bi-cart-check',
        'desc' => 'Lo que falta para tu próxima compra',
    ],
    'ticket' => [
        'href' => '/ticket',
        'label' => 'Ticket',
        'icono' => 'bi-receipt-cutoff',
        'desc' => 'Escanea y registra una compra',
    ],
    'historial' => [
        'href' => '/historial',
        'label' => 'Historial',
        'icono' => 'bi-clock-history',
        'desc' => 'Compras y gastos anteriores',
    ],
    'menu' => [
        'href' => '/menu',
        'label' => 'Menú semanal',
        'icono' => 'bi-calendar3-week-fill',
        'desc' => 'Planifica los platillos de la semana',
    ],
    'recetas' => [
        'href' => '/recetas',
        'label' => 'Recetas',
        'icono' => 'bi-egg-fried',
        'desc' => 'Explora tu recetario',
    ],
    'productos-omision' => [
        'href' => '/productos-omision',
        'label' => 'Productos por omisión',
        'icono' => 'bi-slash-circle',
        'desc' => 'Ingredientes que no cuentan en tus recetas',
    ],
    'chef' => [
        'href' => '/chef',
        'label' => 'Chef',
        'icono' => 'bi-stars',
        'desc' => 'Genera recetas con IA',
    ],
    'metricas' => [
        'href' => '/metricas',
        'label' => 'Métricas',
        'icono' => 'bi-bar-chart-line-fill',
        'desc' => 'Gastos y hábitos de compra',
    ],
    'costos' => [
        'href' => '/costos',
        'label' => 'Precios y costos',
        'icono' => 'bi-tags-fill',
        'desc' => 'Precios por producto y comercio',
    ],
    'notas' => [
        'href' => '/notas',
        'label' => 'Notas',
        'icono' => 'bi-journal-richtext',
        'desc' => 'Recordatorios y listas rápidas',
    ],
];

$navGrupos = [
    'compras' => [
        'label' => 'Compras',
        'icono' => 'bi-bag-check-fill',
        'items' => ['inicio', 'lista-compras', 'ticket', 'historial'],
    ],
    'cocina' => [
        'label' => 'Cocina',
        'icono' => 'bi-egg-fried',
        'items' => ['menu', 'recetas', 'productos-omision'],
    ],
    'analisis' => [
        'label' => 'Análisis',
        'icono' => 'bi-graph-up-arrow',
        'items' => ['metricas', 'costos'],
    ],
    'personal' => [
        'label' => 'Personal',
        'icono' => 'bi-journal-richtext',
        'items' => ['notas'],
    ],
];

if ($esAdmin) {
    $navGrupos['cocina']['items'][] = 'chef';
}

$navAdmin = [
    'label' => 'Administración',
    'icono' => 'bi-shield-lock-fill',
    'items' => [
        'admin-recetas' => [
            'href' => '/admin/recetas',
            'label' => 'Catálogo de recetas',
            'icono' => 'bi-egg-fried',
            'desc' => 'Crear, editar y publicar recetas',
        ],
        'admin-categorias' => [
            'href' => '/admin/recetas/categorias',
            'label' => 'Categorías',
            'icono' => 'bi-grid-3x3-gap-fill',
            'desc' => 'Bebidas, guisados, ensaladas…',
        ],
        'admin-tipos' => [
            'href' => '/admin/recetas/tipos',
            'label' => 'Tipos de dieta',
            'icono' => 'bi-tags-fill',
            'desc' => 'Vegetariano, sin gluten, kosher…',
        ],
        'admin-productos' => [
            'href' => '/admin/productos',
            'label' => 'Productos',
            'icono' => 'bi-box-seam',
            'desc' => 'Catálogo y fotografías',
        ],
        'admin-usuarios' => [
            'href' => '/admin/usuarios',
            'label' => 'Usuarios',
            'icono' => 'bi-people-fill',
            'desc' => 'Cuentas y roles',
        ],
    ],
];

/** Grupos que se muestran como desplegable en tableta (el resto son enlaces directos). */
$gruposTablet = ['compras', 'cocina', 'analisis'];
$adminActivo = in_array($active, array_keys($navAdmin['items']), true);

$grupoActivo = static function (array $claves) use ($active): bool {
    return in_array($active, $claves, true);
};
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="<?= htmlspecialchars($csrfToken, ENT_QUOTES, 'UTF-8') ?>">
    <title><?= htmlspecialchars($title, ENT_QUOTES, 'UTF-8') ?> · Mi Súper</title>
    <link rel="icon" href="<?= htmlspecialchars(Asset::url('/assets/img/favicon.svg'), ENT_QUOTES, 'UTF-8') ?>" type="image/svg+xml">
    <link rel="icon" href="<?= htmlspecialchars(Asset::url('/assets/img/favicon.png'), ENT_QUOTES, 'UTF-8') ?>" type="image/png" sizes="64x64">
    <link rel="icon" href="<?= htmlspecialchars(Asset::url('/favicon.ico'), ENT_QUOTES, 'UTF-8') ?>" sizes="any">
    <link rel="apple-touch-icon" href="<?= htmlspecialchars(Asset::url('/assets/img/favicon.png'), ENT_QUOTES, 'UTF-8') ?>">
    <meta name="theme-color" content="#0f7a57">
    <script src="<?= htmlspecialchars(Asset::url('/assets/js/theme.js'), ENT_QUOTES, 'UTF-8') ?>"></script>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/@fontsource-variable/plus-jakarta-sans/index.css" rel="stylesheet">
    <link rel="stylesheet" href="<?= htmlspecialchars(Asset::url('/assets/css/palettes.css'), ENT_QUOTES, 'UTF-8') ?>">
    <link rel="stylesheet" href="<?= htmlspecialchars(Asset::url('/assets/css/cuenta.css'), ENT_QUOTES, 'UTF-8') ?>">
    <?php foreach ($styles as $style): ?>
        <link rel="stylesheet" href="<?= htmlspecialchars(Asset::url($style), ENT_QUOTES, 'UTF-8') ?>">
    <?php endforeach; ?>
    <link rel="stylesheet" href="<?= htmlspecialchars(Asset::url('/assets/css/theme.css'), ENT_QUOTES, 'UTF-8') ?>">
    <link rel="stylesheet" href="<?= htmlspecialchars(Asset::url('/assets/css/texture.css'), ENT_QUOTES, 'UTF-8') ?>">
    <link rel="stylesheet" href="<?= htmlspecialchars(Asset::url('/assets/css/avatars.css'), ENT_QUOTES, 'UTF-8') ?>">
    <link rel="stylesheet" href="<?= htmlspecialchars(Asset::url('/assets/css/modes.css'), ENT_QUOTES, 'UTF-8') ?>">
    <link rel="stylesheet" href="<?= htmlspecialchars(Asset::url('/assets/css/shell.css'), ENT_QUOTES, 'UTF-8') ?>">
</head>
<body class="app<?= $active === 'inicio' ? ' app--quick' : '' ?>" data-user-role="<?= htmlspecialchars((string) ($usuario['rol'] ?? ''), ENT_QUOTES, 'UTF-8') ?>">
    <a class="skip-link" href="#contenido">Saltar al contenido principal</a>
    <header class="app-header">
        <div class="app-header__inner">
            <a class="app-header__brand" href="/">
                <span class="brand-mark" aria-hidden="true"><i class="bi bi-basket2-fill"></i></span>
                <span class="brand-text">Mi Súper</span>
            </a>

            <?php if (!$ocultarNav): ?>
                <nav class="app-nav" aria-label="Navegación principal">
                    <a class="app-nav__link<?= $active === 'inicio' ? ' is-active' : '' ?>" href="/"<?= $active === 'inicio' ? ' aria-current="page"' : '' ?>>
                        <i class="bi bi-house-door-fill" aria-hidden="true"></i>
                        <span>Inicio</span>
                    </a>
                    <?php foreach ($gruposTablet as $gid): ?>
                        <?php
                        $grupo = $navGrupos[$gid];
                        // Inicio tiene enlace propio en la tableta: no marcamos
                        // también el grupo «Compras» cuando solo Inicio está activo.
                        $activoEnGrupo = $grupoActivo(array_values(array_diff($grupo['items'], ['inicio'])));
                        ?>
                        <button
                            class="app-nav__link app-nav__group-toggle<?= $activoEnGrupo ? ' is-active' : '' ?>"
                            type="button"
                            data-menu-toggle="<?= htmlspecialchars($gid, ENT_QUOTES, 'UTF-8') ?>"
                            aria-haspopup="true"
                            aria-expanded="false"
                            aria-controls="nav-menu-<?= htmlspecialchars($gid, ENT_QUOTES, 'UTF-8') ?>"
                        >
                            <i class="bi <?= htmlspecialchars($grupo['icono'], ENT_QUOTES, 'UTF-8') ?>" aria-hidden="true"></i>
                            <span><?= htmlspecialchars($grupo['label'], ENT_QUOTES, 'UTF-8') ?></span>
                            <i class="bi bi-chevron-down app-nav__chevron" aria-hidden="true"></i>
                        </button>
                    <?php endforeach; ?>
                    <a class="app-nav__link<?= $active === 'notas' ? ' is-active' : '' ?>" href="/notas"<?= $active === 'notas' ? ' aria-current="page"' : '' ?>>
                        <i class="bi bi-journal-richtext" aria-hidden="true"></i>
                        <span>Notas</span>
                    </a>
                    <?php if ($esAdmin): ?>
                        <button
                            class="app-nav__link app-nav__group-toggle<?= $adminActivo ? ' is-active' : '' ?>"
                            type="button"
                            data-menu-toggle="admin"
                            aria-haspopup="true"
                            aria-expanded="false"
                            aria-controls="nav-menu-admin"
                        >
                            <i class="bi bi-shield-lock-fill" aria-hidden="true"></i>
                            <span>Admin</span>
                            <i class="bi bi-chevron-down app-nav__chevron" aria-hidden="true"></i>
                        </button>
                    <?php endif; ?>
                </nav>
            <?php endif; ?>

            <div class="app-header__account">
                <?php if ($esAdmin): ?>
                    <span class="app-header__ia" data-ia-badge hidden></span>
                <?php endif; ?>
                <button
                    class="app-header__profile"
                    type="button"
                    data-menu-toggle="cuenta"
                    data-menu-align="end"
                    aria-haspopup="true"
                    aria-expanded="false"
                    aria-controls="nav-menu-cuenta"
                    aria-label="Abrir el menú de tu cuenta"
                    title="Mi cuenta"
                >
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
                    <i class="bi bi-chevron-down app-header__chevron" aria-hidden="true"></i>
                </button>
            </div>
        </div>
    </header>

    <?php if (!$ocultarNav): ?>
        <?php foreach ($gruposTablet as $gid): ?>
            <?php $grupo = $navGrupos[$gid]; ?>
            <div class="nav-menu" id="nav-menu-<?= htmlspecialchars($gid, ENT_QUOTES, 'UTF-8') ?>" data-menu-panel="<?= htmlspecialchars($gid, ENT_QUOTES, 'UTF-8') ?>" hidden>
                <p class="nav-menu__label"><?= htmlspecialchars($grupo['label'], ENT_QUOTES, 'UTF-8') ?></p>
                <?php foreach ($grupo['items'] as $clave): ?>
                    <?php $item = $navItems[$clave]; ?>
                    <a class="nav-menu__link<?= $active === $clave ? ' is-active' : '' ?>" href="<?= htmlspecialchars($item['href'], ENT_QUOTES, 'UTF-8') ?>"<?= $active === $clave ? ' aria-current="page"' : '' ?>>
                        <span class="nav-menu__icon"><i class="bi <?= htmlspecialchars($item['icono'], ENT_QUOTES, 'UTF-8') ?>" aria-hidden="true"></i></span>
                        <span class="nav-menu__text">
                            <strong><?= htmlspecialchars($item['label'], ENT_QUOTES, 'UTF-8') ?></strong>
                            <small><?= htmlspecialchars($item['desc'], ENT_QUOTES, 'UTF-8') ?></small>
                        </span>
                    </a>
                <?php endforeach; ?>
            </div>
        <?php endforeach; ?>

        <?php if ($esAdmin): ?>
            <div class="nav-menu" id="nav-menu-admin" data-menu-panel="admin" hidden>
                <p class="nav-menu__label"><?= htmlspecialchars($navAdmin['label'], ENT_QUOTES, 'UTF-8') ?></p>
                <?php foreach ($navAdmin['items'] as $clave => $item): ?>
                    <a class="nav-menu__link<?= $active === $clave ? ' is-active' : '' ?>" href="<?= htmlspecialchars($item['href'], ENT_QUOTES, 'UTF-8') ?>"<?= $active === $clave ? ' aria-current="page"' : '' ?>>
                        <span class="nav-menu__icon"><i class="bi <?= htmlspecialchars($item['icono'], ENT_QUOTES, 'UTF-8') ?>" aria-hidden="true"></i></span>
                        <span class="nav-menu__text">
                            <strong><?= htmlspecialchars($item['label'], ENT_QUOTES, 'UTF-8') ?></strong>
                            <small><?= htmlspecialchars($item['desc'], ENT_QUOTES, 'UTF-8') ?></small>
                        </span>
                    </a>
                <?php endforeach; ?>
            </div>
        <?php endif; ?>
    <?php endif; ?>

    <div class="nav-menu nav-menu--account" id="nav-menu-cuenta" data-menu-panel="cuenta" hidden>
        <p class="nav-menu__label">Cuenta</p>
        <a class="nav-menu__link nav-menu__link--simple<?= $active === 'ajustes' ? ' is-active' : '' ?>" href="/ajustes"<?= $active === 'ajustes' ? ' aria-current="page"' : '' ?>>
            <span class="nav-menu__icon"><i class="bi bi-sliders2" aria-hidden="true"></i></span>
            <span class="nav-menu__text"><strong>Ajustes</strong><small>Perfil, tema y preferencias</small></span>
        </a>
        <button class="nav-menu__link nav-menu__link--simple nav-menu__link--danger" type="button" data-logout>
            <span class="nav-menu__icon"><i class="bi bi-box-arrow-right" aria-hidden="true"></i></span>
            <span class="nav-menu__text"><strong>Cerrar sesión</strong><small>Salir de tu cuenta</small></span>
        </button>
    </div>

    <div class="app-shell">
        <?php if (!$ocultarNav): ?>
            <aside class="app-sidebar" aria-label="Navegación de secciones">
                <nav class="app-sidebar__nav" aria-label="Secciones">
                    <?php foreach ($navGrupos as $grupo): ?>
                        <p class="app-sidebar__label"><?= htmlspecialchars($grupo['label'], ENT_QUOTES, 'UTF-8') ?></p>
                        <?php foreach ($grupo['items'] as $clave): ?>
                            <?php $item = $navItems[$clave]; ?>
                            <a class="app-sidebar__link<?= $active === $clave ? ' is-active' : '' ?>" href="<?= htmlspecialchars($item['href'], ENT_QUOTES, 'UTF-8') ?>"<?= $active === $clave ? ' aria-current="page"' : '' ?>>
                                <i class="bi <?= htmlspecialchars($item['icono'], ENT_QUOTES, 'UTF-8') ?>" aria-hidden="true"></i>
                                <span><?= htmlspecialchars($item['label'], ENT_QUOTES, 'UTF-8') ?></span>
                            </a>
                        <?php endforeach; ?>
                    <?php endforeach; ?>
                    <?php if ($esAdmin): ?>
                        <p class="app-sidebar__label"><?= htmlspecialchars($navAdmin['label'], ENT_QUOTES, 'UTF-8') ?></p>
                        <?php foreach ($navAdmin['items'] as $clave => $item): ?>
                            <a class="app-sidebar__link<?= $active === $clave ? ' is-active' : '' ?>" href="<?= htmlspecialchars($item['href'], ENT_QUOTES, 'UTF-8') ?>"<?= $active === $clave ? ' aria-current="page"' : '' ?>>
                                <i class="bi <?= htmlspecialchars($item['icono'], ENT_QUOTES, 'UTF-8') ?>" aria-hidden="true"></i>
                                <span><?= htmlspecialchars($item['label'], ENT_QUOTES, 'UTF-8') ?></span>
                            </a>
                        <?php endforeach; ?>
                    <?php endif; ?>
                </nav>
            </aside>
        <?php endif; ?>

        <main class="app-main" id="contenido">
            <?= $content ?>
        </main>
    </div>

    <?php if (!$ocultarNav): ?>
        <nav class="app-dock" data-dock aria-label="Navegación rápida">
            <div class="app-dock__bar">
                <a class="app-dock__item app-dock__item--inicio<?= $active === 'inicio' ? ' is-active' : '' ?>" href="/" aria-label="Inicio" title="Inicio"<?= $active === 'inicio' ? ' aria-current="page"' : '' ?>>
                    <i class="bi bi-house-door-fill" aria-hidden="true"></i>
                </a>
                <a class="app-dock__item app-dock__item--notas<?= $active === 'notas' ? ' is-active' : '' ?>" href="/notas" aria-label="Notas" title="Notas"<?= $active === 'notas' ? ' aria-current="page"' : '' ?>>
                    <i class="bi bi-journal-richtext" aria-hidden="true"></i>
                </a>
                <button class="app-dock__fab" type="button" data-dock-nuevo aria-expanded="false" aria-controls="dock-search-modal" aria-label="Buscar producto" title="Buscar producto">
                    <i class="bi bi-plus-lg" aria-hidden="true"></i>
                </button>
                <a class="app-dock__item app-dock__item--ticket<?= $active === 'ticket' ? ' is-active' : '' ?>" href="/ticket" aria-label="Ticket" title="Ticket"<?= $active === 'ticket' ? ' aria-current="page"' : '' ?>>
                    <i class="bi bi-receipt-cutoff" aria-hidden="true"></i>
                </a>
                <button class="app-dock__item app-dock__item--menu" type="button" data-dock-menu aria-expanded="false" aria-controls="dock-menu-modal" aria-label="Abrir menú" title="Menú">
                    <i class="bi bi-list" aria-hidden="true"></i>
                </button>
            </div>
        </nav>
    <?php endif; ?>

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
                        <i class="bi bi-cart3" aria-hidden="true"></i> Ir a Inicio
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
                </div>
                <nav class="dock-menu" aria-label="Más secciones">
                    <?php foreach ($navGrupos as $grupo): ?>
                        <p class="dock-menu__label"><?= htmlspecialchars($grupo['label'], ENT_QUOTES, 'UTF-8') ?></p>
                        <?php foreach ($grupo['items'] as $clave): ?>
                            <?php $item = $navItems[$clave]; ?>
                            <a class="dock-menu__link<?= $active === $clave ? ' is-active' : '' ?>" href="<?= htmlspecialchars($item['href'], ENT_QUOTES, 'UTF-8') ?>"<?= $active === $clave ? ' aria-current="page"' : '' ?>>
                                <span class="dock-menu__icon"><i class="bi <?= htmlspecialchars($item['icono'], ENT_QUOTES, 'UTF-8') ?>" aria-hidden="true"></i></span>
                                <span class="dock-menu__text"><?= htmlspecialchars($item['label'], ENT_QUOTES, 'UTF-8') ?></span>
                                <i class="bi bi-chevron-right dock-menu__chevron" aria-hidden="true"></i>
                            </a>
                        <?php endforeach; ?>
                    <?php endforeach; ?>
                    <?php if ($esAdmin): ?>
                        <p class="dock-menu__label"><?= htmlspecialchars($navAdmin['label'], ENT_QUOTES, 'UTF-8') ?></p>
                        <?php foreach ($navAdmin['items'] as $clave => $item): ?>
                            <a class="dock-menu__link<?= $active === $clave ? ' is-active' : '' ?>" href="<?= htmlspecialchars($item['href'], ENT_QUOTES, 'UTF-8') ?>"<?= $active === $clave ? ' aria-current="page"' : '' ?>>
                                <span class="dock-menu__icon"><i class="bi <?= htmlspecialchars($item['icono'], ENT_QUOTES, 'UTF-8') ?>" aria-hidden="true"></i></span>
                                <span class="dock-menu__text"><?= htmlspecialchars($item['label'], ENT_QUOTES, 'UTF-8') ?></span>
                                <i class="bi bi-chevron-right dock-menu__chevron" aria-hidden="true"></i>
                            </a>
                        <?php endforeach; ?>
                    <?php endif; ?>
                </nav>
            </div>
        </div>
    <?php endif; ?>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/js/bootstrap.bundle.min.js"></script>
    <script type="module" src="<?= htmlspecialchars(Asset::url('/assets/js/password-toggle.js'), ENT_QUOTES, 'UTF-8') ?>"></script>
    <script type="module" src="<?= htmlspecialchars(Asset::url('/assets/js/modal-a11y.js'), ENT_QUOTES, 'UTF-8') ?>"></script>
    <script type="module" src="<?= htmlspecialchars(Asset::url('/assets/js/nav-menu.js'), ENT_QUOTES, 'UTF-8') ?>"></script>
    <script type="module" src="<?= htmlspecialchars(Asset::url('/assets/js/session.js'), ENT_QUOTES, 'UTF-8') ?>"></script>
    <?php if (!$ocultarNav): ?>
        <script type="module" src="<?= htmlspecialchars(Asset::url('/assets/js/dock.js'), ENT_QUOTES, 'UTF-8') ?>"></script>
    <?php endif; ?>
    <?php foreach ($scripts as $script): ?>
        <script type="module" src="<?= htmlspecialchars(Asset::url($script), ENT_QUOTES, 'UTF-8') ?>"></script>
    <?php endforeach; ?>
</body>
</html>
