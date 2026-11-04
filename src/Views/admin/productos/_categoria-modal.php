<?php

declare(strict_types=1);
?>
<div
    class="modal fade"
    id="categoria-modal"
    tabindex="-1"
    aria-labelledby="categoria-modal-title"
    aria-hidden="true"
    data-categoria-modal
>
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
            <form data-categoria-form novalidate>
                <div class="modal-header">
                    <h2 class="modal-title fs-5" id="categoria-modal-title">
                        <span class="title-icon"><i class="bi bi-tags-fill" aria-hidden="true"></i></span>
                        Nueva categoría
                    </h2>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
                </div>

                <div class="modal-body">
                    <label class="form-label" for="categoria-nombre">Nombre</label>
                    <input
                        class="form-control"
                        type="text"
                        id="categoria-nombre"
                        name="nombre"
                        maxlength="80"
                        minlength="2"
                        autocomplete="off"
                        placeholder="Ej. Congelados"
                        required
                    >
                    <p class="form-text">La nueva categoría estará disponible de inmediato en el catálogo.</p>
                    <p class="form__message" data-categoria-message hidden></p>
                </div>

                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                    <button type="submit" class="btn btn-primary" data-categoria-submit>Crear categoría</button>
                </div>
            </form>
        </div>
    </div>
</div>
