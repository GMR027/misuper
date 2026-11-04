/**
 * modal-a11y.js — comportamiento común de las ventanas modales propias.
 *
 * Centraliza lo que cada pantalla repetía (o faltaba): bloqueo del scroll de
 * fondo, devolución del foco al cerrar, trampa de Tab y cierre al pulsar el
 * fondo. Los modales de Bootstrap siguen gestionándose con su propio bundle.
 */

const SELECTOR_FOCUSABLE = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
].join(',');

let ultimoFoco = null;
let modalAbierto = null;

/**
 * @param {HTMLElement} modal
 * @returns {HTMLElement[]}
 */
function focusables(modal) {
    return [...modal.querySelectorAll(SELECTOR_FOCUSABLE)].filter((element) => {
        if (!(element instanceof HTMLElement) || element.hidden) {
            return false;
        }

        return element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden';
    });
}

function modalesAbiertos() {
    return [...document.querySelectorAll('.app-modal')].filter(
        (modal) => modal instanceof HTMLElement && !modal.hidden,
    );
}

function sincronizar() {
    const abiertos = modalesAbiertos();
    const actual = abiertos.length > 0 ? abiertos[abiertos.length - 1] : null;

    if (actual === modalAbierto) {
        return;
    }

    if (!(actual instanceof HTMLElement)) {
        modalAbierto = null;
        document.body.classList.remove('modal-abierto');
        document.documentElement.classList.remove('modal-abierto');

        if (ultimoFoco instanceof HTMLElement && ultimoFoco.isConnected) {
            ultimoFoco.focus({ preventScroll: true });
        }

        ultimoFoco = null;

        return;
    }

    if (modalAbierto === null) {
        ultimoFoco = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }

    modalAbierto = actual;
    document.body.classList.add('modal-abierto');
    document.documentElement.classList.add('modal-abierto');

    // Si la pantalla no movió el foco, lo llevamos al primer control útil.
    window.requestAnimationFrame(() => {
        if (!actual.contains(document.activeElement)) {
            const candidatos = focusables(actual);

            if (candidatos.length > 0) {
                candidatos[0].focus({ preventScroll: true });
            } else {
                actual.setAttribute('tabindex', '-1');
                actual.focus({ preventScroll: true });
            }
        }
    });
}

const observer = new MutationObserver(sincronizar);
observer.observe(document.body, {
    subtree: true,
    attributes: true,
    attributeFilter: ['hidden'],
});

document.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab' || !(modalAbierto instanceof HTMLElement)) {
        return;
    }

    const candidatos = focusables(modalAbierto);

    if (candidatos.length === 0) {
        event.preventDefault();

        return;
    }

    const primero = candidatos[0];
    const ultimo = candidatos[candidatos.length - 1];
    const activo = document.activeElement;

    if (!event.shiftKey && activo === ultimo) {
        event.preventDefault();
        primero.focus();
    } else if (event.shiftKey && (activo === primero || !modalAbierto.contains(activo))) {
        event.preventDefault();
        ultimo.focus();
    }
});

// Cerrar al pulsar el fondo: reutiliza el manejador de Escape de cada pantalla.
document.addEventListener('click', (event) => {
    if (!(event.target instanceof HTMLElement) || !event.target.classList.contains('app-modal')) {
        return;
    }

    event.target.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Escape',
        code: 'Escape',
        bubbles: true,
    }));
});

sincronizar();
