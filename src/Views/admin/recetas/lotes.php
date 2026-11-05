<?php

declare(strict_types=1);

$totalLotes = count($lotes);
ob_start();
?>
<div class="container py-4" data-admin-lotes>
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
        <div>
            <h2 class="mb-1">
                <span class="title-icon"><i class="bi bi-collection" aria-hidden="true"></i></span>
                Lotes de importación
            </h2>
            <p class="text-muted mb-0">
                Recetas importadas desde libros. Revísalas, edítalas y publica o deshaz el lote completo.
            </p>
        </div>

        <a class="btn btn-outline-secondary" href="/admin/recetas">
            <i class="bi bi-arrow-left" aria-hidden="true"></i>
            Volver al catálogo
        </a>
    </div>

    <p class="form__message" data-admin-lotes-mensaje hidden></p>

    <?php if ($totalLotes === 0): ?>
        <div class="card">
            <div class="card-body text-center py-5">
                <p class="mb-1"><strong>Todavía no hay lotes.</strong></p>
                <p class="text-muted mb-0">Importa un libro desde Chef para verlo aquí.</p>
            </div>
        </div>
    <?php else: ?>
        <div class="card">
            <div class="table-responsive">
                <table class="table table-hover align-middle mb-0">
                    <thead>
                        <tr>
                            <th scope="col">Libro</th>
                            <th scope="col">Recetas</th>
                            <th scope="col">Estado</th>
                            <th scope="col">Fecha</th>
                            <th class="text-end" scope="col">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($lotes as $lote): ?>
                            <?php
                            $loteId = (string) $lote['id'];
                            $estado = (string) ($lote['estado'] ?? 'borrador');
                            $recetas = is_array($lote['recetas'] ?? null) ? $lote['recetas'] : [];
                            $clase = $estado === 'publicado'
                                ? 'text-bg-success'
                                : ($estado === 'descartado' ? 'text-bg-secondary' : 'text-bg-warning');
                            ?>
                            <tr id="lote-<?= htmlspecialchars($loteId, ENT_QUOTES, 'UTF-8') ?>">
                                <td>
                                    <strong><?= htmlspecialchars((string) $lote['nombre'], ENT_QUOTES, 'UTF-8') ?></strong>
                                    <span class="d-block small text-muted">
                                        <?= htmlspecialchars((string) ($lote['autor'] ?? ''), ENT_QUOTES, 'UTF-8') ?>
                                        <?php if (!empty($lote['archivo'])): ?>
                                            · <?= htmlspecialchars(basename((string) $lote['archivo']), ENT_QUOTES, 'UTF-8') ?>
                                        <?php endif; ?>
                                    </span>
                                </td>
                                <td>
                                    <?= (int) ($lote['recetas_actuales'] ?? 0) ?>
                                    <span class="d-block small text-muted">
                                        <?= (int) ($lote['publicadas'] ?? 0) ?> publicadas
                                    </span>
                                </td>
                                <td>
                                    <span class="badge <?= $clase ?>">
                                        <?= htmlspecialchars(ucfirst($estado), ENT_QUOTES, 'UTF-8') ?>
                                    </span>
                                </td>
                                <td class="small text-muted">
                                    <?= htmlspecialchars((string) ($lote['created_at'] ?? ''), ENT_QUOTES, 'UTF-8') ?>
                                </td>
                                <td class="text-end">
                                    <button class="btn btn-sm btn-outline-primary" type="button"
                                        data-lote-toggle="<?= htmlspecialchars($loteId, ENT_QUOTES, 'UTF-8') ?>"
                                        aria-expanded="false"
                                        aria-controls="lote-recetas-<?= htmlspecialchars($loteId, ENT_QUOTES, 'UTF-8') ?>">
                                        <i class="bi bi-pencil-square" aria-hidden="true"></i>
                                        Editar recetas
                                        <span class="badge text-bg-light ms-1"><?= count($recetas) ?></span>
                                    </button>
                                    <?php if ($estado !== 'publicado' && $recetas !== []): ?>
                                        <button class="btn btn-sm btn-primary" type="button"
                                            data-lote-id="<?= htmlspecialchars($loteId, ENT_QUOTES, 'UTF-8') ?>"
                                            data-lote-accion="publicar">
                                            <i class="bi bi-check-lg" aria-hidden="true"></i>
                                            Publicar
                                        </button>
                                    <?php endif; ?>
                                    <button class="btn btn-sm btn-outline-danger" type="button"
                                        data-lote-id="<?= htmlspecialchars($loteId, ENT_QUOTES, 'UTF-8') ?>"
                                        data-lote-accion="descartar">
                                        <i class="bi bi-trash3" aria-hidden="true"></i>
                                        Deshacer
                                    </button>
                                </td>
                            </tr>
                            <tr data-lote-panel="<?= htmlspecialchars($loteId, ENT_QUOTES, 'UTF-8') ?>" hidden>
                                <td colspan="5" class="bg-body-tertiary">
                                    <div id="lote-recetas-<?= htmlspecialchars($loteId, ENT_QUOTES, 'UTF-8') ?>">
                                        <?php if ($recetas === []): ?>
                                            <p class="text-muted small mb-0 py-2">
                                                Este lote no tiene recetas. Puedes deshacerlo.
                                            </p>
                                        <?php else: ?>
                                            <table class="table table-sm align-middle mb-0">
                                                <thead>
                                                    <tr>
                                                        <th scope="col">Receta</th>
                                                        <th scope="col">Categoría</th>
                                                        <th scope="col">Datos</th>
                                                        <th scope="col">Estado</th>
                                                        <th class="text-end" scope="col">Acciones</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    <?php foreach ($recetas as $receta): ?>
                                                        <?php
                                                        $recetaId = (int) $receta['id'];
                                                        $estadoReceta = (string) ($receta['estado'] ?? 'pendiente');
                                                        $claseReceta = $estadoReceta === 'publicada'
                                                            ? 'text-bg-success'
                                                            : ($estadoReceta === 'borrador' ? 'text-bg-secondary' : 'text-bg-warning');
                                                        $volver = '/admin/recetas/lotes#lote-' . $loteId;
                                                        ?>
                                                        <tr data-receta-fila="<?= $recetaId ?>">
                                                            <td>
                                                                <strong><?= htmlspecialchars((string) $receta['nombre'], ENT_QUOTES, 'UTF-8') ?></strong>
                                                                <?php if (!empty($receta['origen'])): ?>
                                                                    <span class="d-block small text-muted">
                                                                        <?= htmlspecialchars((string) $receta['origen'], ENT_QUOTES, 'UTF-8') ?>
                                                                    </span>
                                                                <?php endif; ?>
                                                            </td>
                                                            <td class="small">
                                                                <?= htmlspecialchars((string) ($receta['categoria'] ?? '—'), ENT_QUOTES, 'UTF-8') ?>
                                                            </td>
                                                            <td class="small text-muted">
                                                                <?= (int) ($receta['tiempo_min'] ?? 0) ?> min ·
                                                                <?= (int) ($receta['porciones_base'] ?? 0) ?> porciones
                                                            </td>
                                                            <td>
                                                                <span class="badge <?= $claseReceta ?>">
                                                                    <?= htmlspecialchars(ucfirst($estadoReceta), ENT_QUOTES, 'UTF-8') ?>
                                                                </span>
                                                            </td>
                                                            <td class="text-end text-nowrap">
                                                                <a class="btn btn-sm btn-outline-primary"
                                                                    href="/admin/recetas/<?= $recetaId ?>?volver=<?= rawurlencode($volver) ?>">
                                                                    <i class="bi bi-pencil" aria-hidden="true"></i>
                                                                    Editar
                                                                </a>
                                                                <button class="btn btn-sm btn-outline-danger" type="button"
                                                                    data-quitar-receta="<?= $recetaId ?>"
                                                                    data-lote-id="<?= htmlspecialchars($loteId, ENT_QUOTES, 'UTF-8') ?>"
                                                                    data-receta-nombre="<?= htmlspecialchars((string) $receta['nombre'], ENT_QUOTES, 'UTF-8') ?>">
                                                                    <i class="bi bi-x-lg" aria-hidden="true"></i>
                                                                    Quitar
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    <?php endforeach; ?>
                                                </tbody>
                                            </table>
                                        <?php endif; ?>
                                    </div>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
        </div>
    <?php endif; ?>
</div>
<?php

$content = (string) ob_get_clean();
$title = 'Lotes de importación · Admin';
$scripts = ['/assets/js/pages/admin-lotes.js'];
$styles = ['/assets/css/admin.css'];
$active = 'admin-recetas';

require __DIR__ . '/../../layouts/app.php';
