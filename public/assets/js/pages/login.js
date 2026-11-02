import { fetchApi } from '../modules/api.js';

const form = document.querySelector('#login-form');
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

if (new URLSearchParams(window.location.search).get('registrado') === '1') {
    showMessage('Registro exitoso, ahora puedes iniciar sesión.', 'success');
}

form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearMessage();

    const email = emailInput instanceof HTMLInputElement ? emailInput.value.trim() : '';
    const password = passwordInput instanceof HTMLInputElement ? passwordInput.value : '';

    if (email === '' || password === '') {
        showMessage('Completa el correo y la contraseña.');

        return;
    }

    if (submit instanceof HTMLButtonElement) {
        submit.disabled = true;
        submit.textContent = 'Entrando…';
    }

    try {
        const usuario = await fetchApi('/api/auth/login', {
            method: 'POST',
            body: { email, password },
        });

        window.location.href = usuario?.debe_cambiar_password === true
            ? '/cambiar-password-forzado'
            : '/';
    } catch (error) {
        if (error.code === 'VALIDATION_ERROR' && error.data && typeof error.data === 'object') {
            showMessage(Object.values(error.data)[0] ?? error.message);
        } else if (error.status === 429) {
            showMessage('Demasiados intentos fallidos. Espera unos minutos e inténtalo de nuevo.');
        } else {
            showMessage(error.message);
        }

        if (submit instanceof HTMLButtonElement) {
            submit.disabled = false;
            submit.textContent = 'Entrar';
        }
    }
});
