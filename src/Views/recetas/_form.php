<?php

declare(strict_types=1);

/** @var string $modo */
/** @var array<string, mixed> $tipos */
/** @var array<string, mixed>|null $receta */

$receta = $receta ?? null;
$esAdmin = $modo === 'admin';
$tiposSeleccionados = is_array($receta['tipos'] ?? null) ? $receta['tipos'] : ['general'];
$ingredientes = is_array($receta['ingredientes'] ?? null) ? $receta['ingredientes'] : [];
$pasos = is_array($receta['pasos'] ?? null) ? $receta['pasos'] : [];
$videoUrl = '';
if (!empty($receta['video']['youtube_id'])) {
    $videoUrl = 'https://youtu.be/' . $receta['video']['youtube_id'];
}
?>
<form class="receta-form" data-receta-form data-modo="<?= htmlspecialchars($modo, ENT_QUOTES, 'UTF-8') ?>" data-receta-id="<?= (int) ($receta['id'] ?? 0) ?>" novalidate>
    <div class="row g-3">
        <div class="col-12 col-lg-8">
            <label class="form-label" for="receta-nombre">Nombre de la receta</label>
            <input
                class="form-control"
                type="text"
                id="receta-nombre"
                maxlength="150"
                required
                autocomplete="off"
                value="<?= htmlspecialchars((string) ($receta['nombre'] ?? ''), ENT_QUOTES, 'UTF-8') ?>"
                data-receta-nombre
            >
        </div>

        <div class="col-6 col-lg-2">
            <label class="form-label" for="receta-porciones">Porciones base</label>
            <input
                class="form-control"
                type="number"
                id="receta-porciones"
                min="1"
                max="50"
                step="1"
                required
                value="<?= (int) ($receta['porciones_base'] ?? 4) ?>"
                data-receta-porciones
            >
        </div>

        <div class="col-6 col-lg-2">
            <label class="form-label" for="receta-tiempo">Minutos</label>
            <input
                class="form-control"
                type="number"
                id="receta-tiempo"
                min="1"
                max="240"
                step="1"
                required
                value="<?= (int) ($receta['tiempo_min'] ?? 30) ?>"
                data-receta-tiempo
            >
        </div>

        <div class="col-12">
            <label class="form-label" for="receta-descripcion">Descripción corta</label>
            <textarea
                class="form-control"
                id="receta-descripcion"
                rows="2"
                maxlength="500"
                placeholder="Una idea de qué hace especial a esta receta…"
                data-receta-descripcion
            ><?= htmlspecialchars((string) ($receta['descripcion'] ?? ''), ENT_QUOTES, 'UTF-8') ?></textarea>
        </div>

        <div class="col-12">
            <label class="form-label">Tipos</label>
            <div class="receta-form__tipos">
                <?php foreach ($tipos as $tipo): ?>
                    <?php
                    $slug = (string) ($tipo['slug'] ?? '');
                    $activo = in_array($slug, $tiposSeleccionados, true);
                    ?>
                    <label class="form-check form-check-inline receta-form__tipo">
                        <input
                            class="form-check-input"
                            type="checkbox"
                            value="<?= htmlspecialchars($slug, ENT_QUOTES, 'UTF-8') ?>"
                            <?= $activo ? 'checked' : '' ?>
                            data-receta-tipo
                        >
                        <span class="form-check-label">
                            <i class="bi <?= htmlspecialchars((string) ($tipo['icono'] ?? 'bi-tag'), ENT_QUOTES, 'UTF-8') ?>" aria-hidden="true"></i>
                            <?= htmlspecialchars((string) ($tipo['nombre'] ?? $slug), ENT_QUOTES, 'UTF-8') ?>
                        </span>
                    </label>
                <?php endforeach; ?>
            </div>
        </div>

        <div class="col-12 col-md-4">
            <label class="form-label" for="receta-dificultad">Dificultad</label>
            <select class="form-select" id="receta-dificultad" data-receta-dificultad>
                <?php foreach (['facil' => 'Fácil', 'media' => 'Media', 'dificil' => 'Difícil'] as $valor => $texto): ?>
                    <option value="<?= $valor ?>" <?= ($receta['dificultad'] ?? 'facil') === $valor ? 'selected' : '' ?>>
                        <?= $texto ?>
                    </option>
                <?php endforeach; ?>
            </select>
        </div>

        <?php if ($esAdmin): ?>
            <div class="col-12 col-md-4">
                <label class="form-label" for="receta-estado">Estado</label>
                <select class="form-select" id="receta-estado" data-receta-estado>
                    <?php foreach (['publicada' => 'Publicada', 'pendiente' => 'Pendiente de revisión', 'borrador' => 'Borrador'] as $valor => $texto): ?>
                        <option value="<?= $valor ?>" <?= ($receta['estado'] ?? 'publicada') === $valor ? 'selected' : '' ?>>
                            <?= $texto ?>
                        </option>
                    <?php endforeach; ?>
                </select>
            </div>

            <div class="col-12 col-md-4">
                <label class="form-label" for="receta-video">Video de YouTube</label>
                <input
                    class="form-control"
                    type="url"
                    id="receta-video"
                    placeholder="https://youtu.be/…"
                    value="<?= htmlspecialchars($videoUrl, ENT_QUOTES, 'UTF-8') ?>"
                    data-receta-video
                >
            </div>

            <div class="col-12">
                <label class="form-label" for="receta-video-titulo">Título del video <span class="text-muted">(opcional)</span></label>
                <input
                    class="form-control"
                    type="text"
                    id="receta-video-titulo"
                    maxlength="150"
                    value="<?= htmlspecialchars((string) ($receta['video_titulo'] ?? ''), ENT_QUOTES, 'UTF-8') ?>"
                    data-receta-video-titulo
                >
            </div>
        <?php endif; ?>
    </div>

    <hr class="my-4">

    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
        <div>
            <h5 class="mb-1">Ingredientes</h5>
            <p class="text-muted small mb-0">
                Indica cantidades y unidades. Marca «principal» para los ingredientes clave.
            </p>
        </div>
        <button class="btn btn-sm btn-outline-primary" type="button" data-add-ingrediente>
            <i class="bi bi-plus-lg" aria-hidden="true"></i>
            Agregar ingrediente
        </button>
    </div>

    <div class="receta-form__ingredientes" data-ingredientes></div>

    <hr class="my-4">

    <div>
        <label class="form-label" for="receta-pasos">Preparación</label>
        <textarea
            class="form-control"
            id="receta-pasos"
            rows="7"
            placeholder="Escribe un paso por línea…"
            data-receta-pasos
        ><?= htmlspecialchars(implode("\n", array_map('strval', $pasos)), ENT_QUOTES, 'UTF-8') ?></textarea>
        <p class="text-muted small mt-1 mb-0">Cada línea se convertirá en un paso numerado.</p>
    </div>

    <p class="form__message mt-3" data-receta-mensaje hidden></p>

    <div class="d-flex flex-wrap gap-2 mt-3">
        <button class="btn btn-primary" type="submit" data-receta-guardar>
            <i class="bi bi-check2" aria-hidden="true"></i>
            <?= $esAdmin ? 'Guardar receta' : 'Enviar receta para revisión' ?>
        </button>
        <a class="btn btn-outline-secondary" href="<?= $esAdmin ? '/admin/recetas' : '/recetas' ?>">Cancelar</a>
    </div>
</form>

<script type="application/json" data-receta-inicial>
<?= json_encode([
    'ingredientes' => array_values($ingredientes),
    'modo' => $modo,
], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_AMP | JSON_HEX_QUOT) ?>
</script>
