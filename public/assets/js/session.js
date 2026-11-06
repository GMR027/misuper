/**
 * Cierre de sesión global.
 *
 * Algunas pantallas ya enlazan su propio manejador sobre [data-logout].
 * Este respaldo se ejecuta al final del burbujeo: si la página ya desactivó
 * el botón de forma síncrona, no hace nada; si no había manejador (recetas,
 * listas, tickets, administración…), cierra la sesión igualmente.
 */

import { fetchApi } from './modules/api.js';

document.addEventListener('click', (event) => {
    const objetivo = event.target;

    if (!(objetivo instanceof Element)) {
        return;
    }

    const boton = objetivo.closest('[data-logout]');

    if (!(boton instanceof HTMLButtonElement)) {
        return;
    }

    window.queueMicrotask(async () => {
        if (boton.disabled) {
            return;
        }

        boton.disabled = true;

        try {
            await fetchApi('/api/auth/logout', { method: 'POST' });
        } catch {
            // Si la sesión ya expiró, igualmente volvemos al login.
        }

        window.location.replace('/login');
    });
});
