import { fetchApi } from '../modules/api.js';

const form = document.querySelector('#password-forzado-form');
const passwordNueva = document.querySelector('#password_nueva');
const passwordConfirmar = document.querySelector('#password_confirmar');
const message = form?.querySelector('[data-message]');
const submit = form?.querySelector('button[type="submit"]');

/**
 * @param {string} text
 * @param {'error' | 'success'} [type]
 */
function showMessage(text, type = 'error') {
    if (!(message instanceof HTMLElement)) {
        return;
    }

    message.textContent = text;
    message.dataset.type = type;
    message.hidden = false;
}

function clearMessage() {
    if (!(message instanceof HTMLElement)) {
        return;
    }

    message.textContent = '';
    message.hidden = true;
}

async function verificarEstado() {
    try {
        const usuario = await fetchApi('/api/me');

        if (usuario?.debe_cambiar_password !== true) {
            window.location.replace('/');
        }
    } catch (error) {
        if (error?.status === 401) {
            window.location.replace('/login');
        }
    }
}

form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearMessage();

    const nueva = passwordNueva instanceof HTMLInputElement ? passwordNueva.value : '';
    const confirmar = passwordConfirmar instanceof HTMLInputElement ? passwordConfirmar.value : '';

    if (nueva.length < 8) {
        showMessage('La contraseña debe tener al menos 8 caracteres.');

        return;
    }

    if (nueva !== confirmar) {
        showMessage('La confirmación no coincide con la contraseña.');

        return;
    }

    if (submit instanceof HTMLButtonElement) {
        submit.disabled = true;
        submit.textContent = 'Guardando…';
    }

    try {
        await fetchApi('/api/me/password-forzado', {
            method: 'POST',
            body: { password_nueva: nueva },
        });

        window.location.replace('/');
    } catch (error) {
        if (error?.status === 401) {
            window.location.replace('/login');

            return;
        }

        if (error.code === 'VALIDATION_ERROR' && error.data && typeof error.data === 'object') {
            showMessage(Object.values(error.data)[0] ?? error.message);
        } else {
            showMessage(error.message);
        }

        if (submit instanceof HTMLButtonElement) {
            submit.disabled = false;
            submit.textContent = 'Guardar contraseña';
        }
    }
});

document.querySelector('[data-logout]')?.addEventListener('click', async (event) => {
    const button = event.currentTarget;

    if (button instanceof HTMLButtonElement) {
        button.disabled = true;
    }

    try {
        await fetchApi('/api/auth/logout', { method: 'POST' });
    } catch {
        // Si la sesión ya no existe, igualmente volvemos al login.
    }

    window.location.replace('/login');
});

verificarEstado();
