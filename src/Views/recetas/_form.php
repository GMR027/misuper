<?php

declare(strict_types=1);

/** @var string $modo */
/** @var array<string, mixed> $tipos */
/** @var array<int, array<string, mixed>> $categorias */
/** @var array<string, mixed>|null $receta */

$receta = $receta ?? null;
$esAdmin = $modo === 'admin';
$tiposSeleccionados = is_array($receta['tipos'] ?? null) ? $receta['tipos'] : ['general'];
$ingredientes = is_array($receta['ingredientes'] ?? null) ? $receta['ingredientes'] : [];
$pasos = is_array($receta['pasos'] ?? null) ? $receta['pasos'] : [];
$categoriaActual = (int) ($receta['categoria_id'] ?? 0);
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
            <label class="form-label">Tipos de receta</label>
            <div class="receta-form__tipos">
                <?php foreach ($tipos as $tipo): ?>
                    <?php
                    $slug = (string) ($tipo['slug'] ?? '');
                    $activo = in_array($slug, $tiposSeleccionados, true);
                    ?>
                    <label class="receta-form__tipo-card<?= $activo ? ' is-active' : '' ?>">
                        <input
                            class="visually-hidden"
                            type="checkbox"
                            value="<?= htmlspecialchars($slug, ENT_QUOTES, 'UTF-8') ?>"
                            <?= $activo ? 'checked' : '' ?>
                            data-receta-tipo
                        >
                        <span class="receta-form__tipo-icon">
                            <i class="bi <?= htmlspecialchars((string) ($tipo['icono'] ?? 'bi-tag'), ENT_QUOTES, 'UTF-8') ?>" aria-hidden="true"></i>
                        </span>
                        <span class="receta-form__tipo-text">
                            <strong><?= htmlspecialchars((string) ($tipo['nombre'] ?? $slug), ENT_QUOTES, 'UTF-8') ?></strong>
                            <small><?= htmlspecialchars((string) ($tipo['descripcion'] ?? ''), ENT_QUOTES, 'UTF-8') ?></small>
                        </span>
                        <i class="bi bi-check-circle-fill receta-form__tipo-check" aria-hidden="true"></i>
                    </label>
                <?php endforeach; ?>
            </div>
        </div>

        <div class="col-12 col-md-8">
            <label class="form-label" for="receta-categoria">Categoría de platillo</label>
            <select class="form-select" id="receta-categoria" required data-receta-categoria>
                <option value="">Selecciona una categoría…</option>
                <?php foreach ($categorias as $categoria): ?>
                    <?php $catId = (int) ($categoria['id'] ?? 0); ?>
                    <option
                        value="<?= htmlspecialchars((string) ($categoria['slug'] ?? ''), ENT_QUOTES, 'UTF-8') ?>"
                        <?= $catId === $categoriaActual ? 'selected' : '' ?>
                    >
                        <?= htmlspecialchars((string) ($categoria['nombre'] ?? ''), ENT_QUOTES, 'UTF-8') ?>
                    </option>
                <?php endforeach; ?>
            </select>
            <p class="text-muted small mt-1 mb-0">
                Se usa para filtrar por bebidas, guisados, ensaladas, complementos y más.
            </p>
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

        <div class="col-12">
            <label class="form-label" for="receta-imagen">Imagen de portada <span class="text-muted">(opcional)</span></label>
            <div class="row g-3">
                <div class="col-12 col-md-7">
                    <input
                        class="form-control"
                        type="text"
                        id="receta-imagen"
                        maxlength="500"
                        placeholder="https://… o /assets/img/recetas/…"
                        value="<?= htmlspecialchars((string) ($receta['imagen_url'] ?? ''), ENT_QUOTES, 'UTF-8') ?>"
                        data-receta-imagen
                    >
                    <div class="d-flex flex-wrap gap-2 mt-2">
                        <label class="btn btn-outline-primary mb-0" for="receta-imagen-archivo">
                            <i class="bi bi-upload" aria-hidden="true"></i>
                            Subir foto
                        </label>
                        <input
                            class="visually-hidden"
                            type="file"
                            id="receta-imagen-archivo"
                            accept="image/jpeg,image/png,image/webp"
                            data-receta-imagen-archivo
                        >
                        <button class="btn btn-outline-secondary" type="button" data-receta-imagen-quitar>
                            <i class="bi bi-x-lg" aria-hidden="true"></i>
                            Quitar
                        </button>
                    </div>
                    <p class="text-muted small mt-2 mb-0" data-receta-imagen-estado aria-live="polite">
                        Puedes subir un JPG, PNG o WebP de hasta 5 MB, o pegar una URL.
                    </p>
                    <p class="text-muted small mt-1 mb-0">
                        Se usa en la tarjeta del recetario. Si la dejas vacía, se usará la miniatura del video o el icono.
                    </p>
                </div>
                <div class="col-12 col-md-5">
                    <div class="receta-portada-preview" data-receta-imagen-preview hidden>
                        <img alt="Vista previa de la portada" data-receta-imagen-preview-img>
                    </div>
                </div>
            </div>
        </div>
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

<div class="app-modal" data-ingrediente-modal hidden role="dialog" aria-modal="true" aria-labelledby="ingrediente-modal-title">
    <div class="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="ingrediente-modal-title">
                    <span class="title-icon"><i class="bi bi-basket2-fill" aria-hidden="true"></i></span>
                    Agregar ingrediente
                </h5>
                <button class="btn-close" type="button" aria-label="Cerrar" data-ing-cerrar></button>
            </div>
            <div class="modal-body p-4">
                <label class="form-label" for="ing-buscar">Buscar en el catálogo de productos</label>
                <div class="recipe-search mb-2">
                    <i class="bi bi-search" aria-hidden="true"></i>
                    <input
                        class="form-control"
                        type="search"
                        id="ing-buscar"
                        placeholder="Ej. pechuga de pollo, jitomate, arroz…"
                        autocomplete="off"
                        data-ing-buscar
                    >
                </div>
                <p class="text-muted small" data-ing-status>Escribe al menos 2 letras para buscar.</p>
                <div class="receta-ing-modal__resultados" data-ing-resultados></div>

                <hr class="my-4">

                <div class="receta-ing-modal__nuevo">
                    <h6 class="mb-1">¿No está en el catálogo?</h6>
                    <p class="text-muted small">
                        Escribe el nombre, elige la categoría y la unidad. Se registrará en el catálogo de productos.
                    </p>
                    <div class="row g-2">
                        <div class="col-12 col-md-5">
                            <label class="form-label" for="ing-nuevo-nombre">Producto</label>
                            <input class="form-control" type="text" id="ing-nuevo-nombre" maxlength="150" data-ing-nuevo-nombre>
                        </div>
                        <div class="col-6 col-md-4">
                            <label class="form-label" for="ing-nuevo-categoria">Categoría</label>
                            <select class="form-select" id="ing-nuevo-categoria" data-ing-nuevo-categoria>
                                <option value="">Selecciona…</option>
                            </select>
                        </div>
                        <div class="col-6 col-md-3">
                            <label class="form-label" for="ing-nuevo-unidad">Unidad</label>
                            <select class="form-select" id="ing-nuevo-unidad" data-ing-nuevo-unidad>
                                <option value="kg">kg</option>
                                <option value="gr">gr</option>
                                <option value="L">L</option>
                                <option value="ml">ml</option>
                                <option value="pza" selected>pza</option>
                            </select>
                        </div>
                    </div>
                    <p class="form__message mt-2" data-ing-nuevo-mensaje hidden></p>
                    <button class="btn btn-outline-primary btn-sm mt-2" type="button" data-ing-nuevo-crear>
                        <i class="bi bi-plus-lg" aria-hidden="true"></i>
                        Registrar producto y agregar
                    </button>
                </div>
            </div>
        </div>
    </div>
</div>
