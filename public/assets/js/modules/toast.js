/**
 * Notificaciones visuales simples, sin librerías externas.
 */

const DEFAULT_DURATION = 3600;

/**
 * @param {string} message
 * @param {'success' | 'error' | 'info'} [type]
 * @param {number} [duration]
 */
export function showToast(message, type = 'success', duration = DEFAULT_DURATION) {
    const stack = ensureStack();
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
    toast.textContent = message;

    stack.append(toast);

    window.setTimeout(() => {
        toast.classList.add('toast--out');
        window.setTimeout(() => toast.remove(), 220);
    }, duration);
}

/**
 * @returns {HTMLElement}
 */
function ensureStack() {
    const existing = document.querySelector('[data-toast-stack]');

    if (existing instanceof HTMLElement) {
        return existing;
    }

    const stack = document.createElement('div');
    stack.className = 'toast-stack';
    stack.dataset.toastStack = '';
    stack.setAttribute('aria-live', 'polite');
    document.body.append(stack);

    return stack;
}
