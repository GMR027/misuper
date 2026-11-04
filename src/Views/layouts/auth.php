<?php

declare(strict_types=1);

use App\Middleware\CsrfMiddleware;
use App\Support\Asset;

/** @var string $title */
/** @var string $subtitle */
/** @var string $content */
/** @var array<int, string> $scripts */

$csrfToken = CsrfMiddleware::token();
$scripts ??= [];
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
    <script src="<?= htmlspecialchars(Asset::url('/assets/js/theme.js'), ENT_QUOTES, 'UTF-8') ?>"></script>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/@fontsource-variable/plus-jakarta-sans/index.css" rel="stylesheet">
    <link rel="stylesheet" href="<?= htmlspecialchars(Asset::url('/assets/css/palettes.css'), ENT_QUOTES, 'UTF-8') ?>">
    <link rel="stylesheet" href="<?= htmlspecialchars(Asset::url('/assets/css/auth.css'), ENT_QUOTES, 'UTF-8') ?>">
    <link rel="stylesheet" href="<?= htmlspecialchars(Asset::url('/assets/css/theme.css'), ENT_QUOTES, 'UTF-8') ?>">
    <link rel="stylesheet" href="<?= htmlspecialchars(Asset::url('/assets/css/texture.css'), ENT_QUOTES, 'UTF-8') ?>">
    <link rel="stylesheet" href="<?= htmlspecialchars(Asset::url('/assets/css/modes.css'), ENT_QUOTES, 'UTF-8') ?>">
</head>
<body>
    <main class="auth">
        <section class="auth__card">
            <header class="auth__header">
                <p class="auth__brand">Mi Súper</p>
                <h1 class="auth__title"><?= htmlspecialchars($title, ENT_QUOTES, 'UTF-8') ?></h1>
                <?php if ($subtitle !== ''): ?>
                    <p class="auth__subtitle"><?= htmlspecialchars($subtitle, ENT_QUOTES, 'UTF-8') ?></p>
                <?php endif; ?>
            </header>

            <?= $content ?>
        </section>
    </main>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/js/bootstrap.bundle.min.js"></script>
    <script type="module" src="<?= htmlspecialchars(Asset::url('/assets/js/password-toggle.js'), ENT_QUOTES, 'UTF-8') ?>"></script>
    <?php foreach ($scripts as $script): ?>
        <script type="module" src="<?= htmlspecialchars(Asset::url($script), ENT_QUOTES, 'UTF-8') ?>"></script>
    <?php endforeach; ?>
</body>
</html>
