/**
 * confirm.js — confirmación modal propia, en lugar de window.confirm.
 *
 * Uso:
 *   const ok = await confirmar({ title: '…', message: '…', confirmText: 'Eliminar' });
 *
 * Devuelve una promesa que resuelve true si la persona confirma. La ventana
 * comparte el comportamiento accesible del resto de modales de la app.
 */

const TONOS = {
    danger: 'btn-danger',
    primary: 'btn-primary',
};

let modal = null;
let resolver = null;

/**
 * @param {{
 *   title?: string,
 *   message?: string,
 *   confirmText?: string,
 *   cancelText?: string,
 *   tone?: 'danger' | 'primary',
 * }} [opciones]
 * @returns {Promise<boolean>}
 */
export function confirmar(opciones = {}) {
    if (modal instanceof HTMLElement && !modal.hidden) {
        return Promise.resolve(false);
    }

    const config = {
        title: String(opciones.title ?? '¿Continuar?'),
        message: String(opciones.message ?? ''),
        confirmText: String(opciones.confirmText ?? 'Aceptar'),
        cancelText: String(opciones.cancelText ?? 'Cancelar'),
        tone: opciones.tone === 'primary' ? 'primary' : 'danger',
    };

    const ui = asegurarModal();
    ui.title.textContent = config.title;
    ui.message.textContent = config.message;
    ui.message.hidden = config.message === '';
    ui.accept.textContent = config.confirmText;
    ui.cancel.textContent = config.cancelText;
    ui.accept.className = `btn ${TONOS[config.tone]}`;
    ui.aviso.textContent = config.tone === 'danger'
        ? 'Esta acción no se puede deshacer.'
        : '';
    ui.aviso.hidden = config.tone !== 'danger';

    modal.hidden = false;

    return new Promise((resolve) => {
        resolver = resolve;

        window.requestAnimationFrame(() => {
            (config.tone === 'danger' ? ui.cancel : ui.accept).focus({ preventScroll: true });
        });
    });
}

function asegurarModal() {
    if (modal instanceof HTMLElement) {
        return referencias();
    }

    modal = document.createElement('div');
    modal.className = 'app-modal';
    modal.hidden = true;
    modal.setAttribute('role', 'alertdialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'app-confirm-title');
    modal.setAttribute('aria-describedby', 'app-confirm-message');
    modal.innerHTML = `
        <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content">
                <div class="modal-body p-4">
                    <h5 class="modal-title mb-2" id="app-confirm-title" data-confirm-title></h5>
                    <p class="text-muted mb-1" id="app-confirm-message" data-confirm-message></p>
                    <p class="text-danger small mb-0" data-confirm-aviso></p>
                    <div class="d-flex flex-wrap justify-content-end gap-2 mt-4">
                        <button class="btn btn-outline-secondary" type="button" data-confirm-cancel></button>
                        <button class="btn btn-danger" type="button" data-confirm-accept></button>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.append(modal);

    modal.querySelector('[data-confirm-cancel]')?.addEventListener('click', () => cerrar(false));
    modal.querySelector('[data-confirm-accept]')?.addEventListener('click', () => cerrar(true));

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !modal.hidden) {
            event.preventDefault();
            event.stopPropagation();
            cerrar(false);
        }
    }, true);

    return referencias();
}

function referencias() {
    return {
        title: modal.querySelector('[data-confirm-title]'),
        message: modal.querySelector('[data-confirm-message]'),
        aviso: modal.querySelector('[data-confirm-aviso]'),
        accept: modal.querySelector('[data-confirm-accept]'),
        cancel: modal.querySelector('[data-confirm-cancel]'),
    };
}

function cerrar(resultado) {
    if (!(modal instanceof HTMLElement) || modal.hidden) {
        return;
    }

    modal.hidden = true;

    if (typeof resolver === 'function') {
        const terminar = resolver;
        resolver = null;
        terminar(resultado);
    }
}
