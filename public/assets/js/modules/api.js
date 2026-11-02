/**
 * Cliente HTTP de la API.
 *
 * - Envía el token CSRF (meta[name="csrf-token"]) en métodos no seguros.
 * - Parsea el contrato { ok, data, error }.
 * - Lanza un Error enriquecido si la petición falla.
 */

/**
 * @typedef {Object} ApiError
 * @property {string} message
 * @property {string} code
 * @property {number} status
 * @property {any} data
 */

function csrfToken() {
    const meta = document.querySelector('meta[name="csrf-token"]');

    return meta instanceof HTMLMetaElement ? meta.content : '';
}

/**
 * @param {string} endpoint
 * @param {{ method?: string, body?: any, headers?: Record<string, string> }} [options]
 * @returns {Promise<any>} data de la respuesta
 */
export async function fetchApi(endpoint, options = {}) {
    const method = (options.method ?? 'GET').toUpperCase();
    const headers = {
        Accept: 'application/json',
        ...(options.headers ?? {}),
    };

    let body;

    if (options.body !== undefined) {
        if (options.body instanceof FormData) {
            body = options.body;
        } else {
            headers['Content-Type'] = 'application/json';
            body = JSON.stringify(options.body);
        }
    }

    if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
        headers['X-CSRF-Token'] = csrfToken();
    }

    let response;

    try {
        response = await fetch(endpoint, {
            method,
            headers,
            body,
            credentials: 'same-origin',
        });
    } catch {
        const error = new Error('No se pudo conectar con el servidor.');
        error.code = 'NETWORK_ERROR';
        error.status = 0;
        error.data = null;
        throw error;
    }

    let payload = null;

    try {
        payload = await response.json();
    } catch {
        payload = null;
    }

    if (!response.ok || payload === null || payload.ok !== true) {
        const error = new Error(
            payload?.error?.message ?? 'Ocurrió un error inesperado. Inténtalo de nuevo.',
        );
        error.code = payload?.error?.code ?? 'HTTP_ERROR';
        error.status = response.status;
        error.data = payload?.data ?? null;

        throw error;
    }

    return payload.data;
}
