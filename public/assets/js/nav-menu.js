/**
 * Menús desplegables de navegación.
 *
 * Un único componente maneja los grupos temáticos de la tableta, el menú
 * de administración y el menú de cuenta del avatar. Los paneles viven fuera
 * del encabezado y se posicionan con coordenadas fijas para que ningún
 * contenedor con overflow o backdrop-filter los recorte.
 */

const toggles = document.querySelectorAll('[data-menu-toggle]');

if (toggles.length > 0) {
    init();
}

function init() {
    /** @type {Array<{toggle: HTMLElement, panel: HTMLElement}>} */
    const entries = [];

    for (const toggle of toggles) {
        if (!(toggle instanceof HTMLElement)) {
            continue;
        }

        const id = toggle.dataset.menuToggle ?? '';
        const panel = document.getElementById(`nav-menu-${id}`);

        if (!(panel instanceof HTMLElement)) {
            continue;
        }

        const entry = { toggle, panel };
        entries.push(entry);

        toggle.addEventListener('click', () => {
            if (panel.hidden) {
                abrir(entry);
            } else {
                cerrar(entry);
            }
        });

        toggle.addEventListener('keydown', (event) => {
            if (event.key !== 'ArrowDown') {
                return;
            }

            event.preventDefault();
            abrir(entry);

            const primero = panel.querySelector('a, button');

            if (primero instanceof HTMLElement) {
                primero.focus();
            }
        });
    }

    if (entries.length === 0) {
        return;
    }

    const abierto = () => entries.find((entry) => !entry.panel.hidden) ?? null;

    const abrir = (entry) => {
        for (const otra of entries) {
            if (otra !== entry && !otra.panel.hidden) {
                cerrar(otra);
            }
        }

        entry.panel.hidden = false;
        posicionar(entry.toggle, entry.panel);
        entry.toggle.setAttribute('aria-expanded', 'true');
    };

    const cerrar = (entry) => {
        if (entry.panel.hidden) {
            return;
        }

        entry.panel.hidden = true;
        entry.toggle.setAttribute('aria-expanded', 'false');
    };

    const cerrarTodo = (devolverFoco = false) => {
        const actual = abierto();

        if (actual === null) {
            return;
        }

        cerrar(actual);

        if (devolverFoco) {
            actual.toggle.focus();
        }
    };

    document.addEventListener('pointerdown', (event) => {
        const actual = abierto();
        const objetivo = event.target;

        if (actual === null || !(objetivo instanceof Node)) {
            return;
        }

        if (actual.panel.contains(objetivo) || actual.toggle.contains(objetivo)) {
            return;
        }

        cerrar(actual);
    }, true);

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            cerrarTodo(true);
        }
    });

    window.addEventListener('resize', () => cerrarTodo());
    window.addEventListener('scroll', () => cerrarTodo(), { passive: true });
}

/**
 * Coloca el panel junto a su disparador, sin salirse del viewport.
 *
 * @param {HTMLElement} toggle
 * @param {HTMLElement} panel
 */
function posicionar(toggle, panel) {
    const rect = toggle.getBoundingClientRect();
    const ancho = panel.offsetWidth || 300;
    const alto = panel.offsetHeight || 320;
    const alinearDerecha = toggle.dataset.menuAlign === 'end';
    let left = alinearDerecha ? rect.right - ancho : rect.left;
    let top = rect.bottom + 8;

    left = Math.max(12, Math.min(left, window.innerWidth - ancho - 12));

    if (top + alto > window.innerHeight - 12 && rect.top - alto - 8 > 12) {
        top = rect.top - alto - 8;
    }

    panel.style.left = `${Math.round(left)}px`;
    panel.style.top = `${Math.round(top)}px`;
}
