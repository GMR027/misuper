/**
 * Menú desplegable «Admin» del encabezado.
 *
 * Se posiciona con coordenadas fijas para que no lo recorte el carrusel
 * horizontal de navegación.
 */

const toggle = document.querySelector('[data-admin-menu-toggle]');
const menu = document.querySelector('[data-admin-menu]');

if (toggle instanceof HTMLButtonElement && menu instanceof HTMLElement) {
    init(toggle, menu);
}

/**
 * @param {HTMLButtonElement} toggle
 * @param {HTMLElement} menu
 */
function init(toggle, menu) {
    const posicionar = () => {
        const rect = toggle.getBoundingClientRect();
        const ancho = menu.offsetWidth || 330;
        const alto = menu.offsetHeight || 320;
        let left = Math.max(12, Math.min(rect.left, window.innerWidth - ancho - 12));
        let top = rect.bottom + 8;

        if (top + alto > window.innerHeight - 12 && rect.top - alto - 8 > 12) {
            top = rect.top - alto - 8;
        }

        menu.style.left = `${Math.round(left)}px`;
        menu.style.top = `${Math.round(top)}px`;
    };

    const fuera = (event) => {
        const objetivo = event.target;

        if (objetivo instanceof Node && (menu.contains(objetivo) || toggle.contains(objetivo))) {
            return;
        }

        cerrar();
    };

    const tecla = (event) => {
        if (event.key === 'Escape') {
            cerrar();
            toggle.focus();
        }
    };

    const abrir = () => {
        menu.hidden = false;
        posicionar();
        toggle.setAttribute('aria-expanded', 'true');
        document.addEventListener('pointerdown', fuera, true);
        document.addEventListener('keydown', tecla);
        window.addEventListener('resize', cerrar);
        window.addEventListener('scroll', cerrar, { passive: true });
    };

    const cerrar = () => {
        if (menu.hidden) {
            return;
        }

        menu.hidden = true;
        toggle.setAttribute('aria-expanded', 'false');
        document.removeEventListener('pointerdown', fuera, true);
        document.removeEventListener('keydown', tecla);
        window.removeEventListener('resize', cerrar);
        window.removeEventListener('scroll', cerrar);
    };

    toggle.addEventListener('click', () => {
        if (menu.hidden) {
            abrir();
        } else {
            cerrar();
        }
    });
}
