<?php

declare(strict_types=1);

use App\Middleware\AuthMiddleware;
use App\Services\NotaService;

$usuario = $usuario ?? AuthMiddleware::usuario();

if ($usuario === null) {
    header('Location: /login', true, 302);

    return;
}

$maxFotos = NotaService::MAX_FOTOS;

ob_start();
?>
<div class="container py-4" data-notas data-max-fotos="<?= $maxFotos ?>">
    <div class="notes-head">
        <div>
            <h2 class="mb-1">
                <span class="title-icon"><i class="bi bi-journal-richtext" aria-hidden="true"></i></span>
                Notas
            </h2>
            <p class="text-muted mb-0">
                Tus ideas, listas y recordatorios con fotos. Solo tú puedes verlas.
            </p>
        </div>

        <button class="btn btn-primary" type="button" data-nota-nueva>
            <i class="bi bi-plus-lg" aria-hidden="true"></i>
            Nueva nota
        </button>
    </div>

    <div class="notes-toolbar">
        <div class="notes-search">
            <i class="bi bi-search" aria-hidden="true"></i>
            <input
                class="form-control"
                type="search"
                placeholder="Buscar en tus notas…"
                aria-label="Buscar en tus notas"
                autocomplete="off"
                data-nota-buscar
            >
        </div>
        <span class="notes-count" data-nota-count aria-live="polite"></span>
    </div>

    <p class="notes-empty alert alert-info" data-notas-vacio>Cargando notas…</p>
    <div class="notes-grid" data-notas-lista></div>
</div>

<!-- Editor de notas -->
<div class="app-modal" data-nota-modal hidden role="dialog" aria-modal="true" aria-labelledby="nota-modal-title">
    <div class="modal-dialog modal-dialog-centered modal-lg">
        <form class="modal-content" data-nota-form novalidate>
            <div class="modal-header">
                <h5 class="modal-title" id="nota-modal-title" data-nota-form-titulo>Nueva nota</h5>
                <button class="btn-close" type="button" aria-label="Cerrar" data-nota-cerrar></button>
            </div>

            <div class="modal-body p-4">
                <p class="notes-date-hint" data-nota-fecha-hint>
                    <i class="bi bi-calendar3" aria-hidden="true"></i>
                    La fecha se guarda automáticamente.
                </p>

                <div class="mb-3">
                    <label class="form-label" for="nota-titulo">Título</label>
                    <input
                        class="form-control"
                        type="text"
                        id="nota-titulo"
                        maxlength="150"
                        autocomplete="off"
                        required
                        data-nota-titulo
                    >
                </div>

                <div class="mb-3">
                    <label class="form-label" for="nota-contenido">Contenido</label>
                    <textarea
                        class="form-control"
                        id="nota-contenido"
                        rows="6"
                        maxlength="10000"
                        data-nota-contenido
                    ></textarea>
                </div>

                <div>
                    <label class="form-label" for="nota-fotos">
                        Fotos <span class="text-muted">(opcional · máx. <?= $maxFotos ?>)</span>
                    </label>
                    <div class="note-upload">
                        <input
                            class="note-upload__input visually-hidden"
                            type="file"
                            id="nota-fotos"
                            accept="image/jpeg,image/png,image/webp"
                            multiple
                            data-nota-fotos
                        >
                        <label class="note-upload__label" for="nota-fotos">
                            <i class="bi bi-images" aria-hidden="true"></i>
                            Añadir fotos
                        </label>
                        <span class="note-upload__hint" data-nota-fotos-hint>
                            JPG, PNG o WebP · máximo 2 MB por foto.
                        </span>
                    </div>
                    <div class="note-photos" data-nota-fotos-preview></div>
                </div>

                <p class="form__message mt-3 mb-0" data-nota-mensaje hidden></p>
            </div>

            <div class="modal-footer">
                <button class="btn btn-outline-secondary" type="button" data-nota-cerrar>Cancelar</button>
                <button class="btn btn-primary" type="submit" data-nota-guardar>Guardar nota</button>
            </div>
        </form>
    </div>
</div>

<!-- Confirmación de borrado -->
<div class="app-modal" data-borrar-modal hidden role="dialog" aria-modal="true" aria-labelledby="borrar-nota-title">
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
            <div class="modal-body p-4">
                <h5 class="modal-title mb-2" id="borrar-nota-title">Eliminar nota</h5>
                <p class="text-muted small mb-2">
                    Se borrarán la nota y sus fotos. No se puede deshacer.
                </p>
                <p class="notes-delete-target mb-0" data-borrar-nombre></p>
            </div>
            <div class="modal-footer">
                <button class="btn btn-outline-secondary" type="button" data-borrar-cancelar>Cancelar</button>
                <button class="btn btn-danger" type="button" data-borrar-confirmar>Eliminar</button>
            </div>
        </div>
    </div>
</div>

<!-- Foto ampliada -->
<div class="app-modal note-lightbox" data-foto-modal hidden role="dialog" aria-modal="true" aria-label="Foto ampliada">
    <button class="note-lightbox__close" type="button" aria-label="Cerrar" data-foto-cerrar>
        <i class="bi bi-x-lg" aria-hidden="true"></i>
    </button>
    <img class="note-lightbox__img" alt="Foto de la nota" data-foto-grande>
</div>

<div class="toast-stack" data-toast-stack aria-live="polite"></div>
<?php

$content = (string) ob_get_clean();
$title = 'Notas';
$scripts = ['/assets/js/pages/notas.js'];
$styles = ['/assets/css/pantalla-rapida.css', '/assets/css/notas.css'];
$active = 'notas';

require __DIR__ . '/../layouts/app.php';
