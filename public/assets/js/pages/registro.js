import { fetchApi } from '../modules/api.js';

const form = document.querySelector('#registro-form');
const nombreInput = document.querySelector('#nombre');
const emailInput = document.querySelector('#email');
const passwordInput = document.querySelector('#password');
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

form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearMessage();

    const nombre = nombreInput instanceof HTMLInputElement ? nombreInput.value.trim() : '';
    const email = emailInput instanceof HTMLInputElement ? emailInput.value.trim() : '';
    const password = passwordInput instanceof HTMLInputElement ? passwordInput.value : '';

    if (nombre === '') {
        showMessage('Escribe tu nombre.');

        return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showMessage('Escribe un correo válido.');

        return;
    }

    if (password.length < 8) {
        showMessage('La contraseña debe tener al menos 8 caracteres.');

        return;
    }

    if (submit instanceof HTMLButtonElement) {
        submit.disabled = true;
        submit.textContent = 'Creando cuenta…';
    }

    try {
        await fetchApi('/api/auth/register', {
            method: 'POST',
            body: { nombre, email, password },
        });

        window.location.href = '/login?registrado=1';
    } catch (error) {
        if (error.code === 'VALIDATION_ERROR' && error.data && typeof error.data === 'object') {
            showMessage(Object.values(error.data)[0] ?? error.message);
        } else if (error.status === 429) {
            showMessage('Demasiados registros desde esta conexión. Inténtalo más tarde.');
        } else {
            showMessage(error.message);
        }

        if (submit instanceof HTMLButtonElement) {
            submit.disabled = false;
            submit.textContent = 'Crear cuenta';
        }
    }
});
