import { fetchApi } from '../modules/api.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const perfilForm = document.querySelector('#perfil-form');
const nombreInput = document.querySelector('#nombre');
const emailInput = document.querySelector('#email');

const passwordForm = document.querySelector('#password-form');
const passwordActual = document.querySelector('#password_actual');
const passwordNueva = document.querySelector('#password_nueva');
const passwordConfirmar = document.querySelector('#password_confirmar');

const deleteForm = document.querySelector('#delete-form');
const deleteStart = document.querySelector('[data-delete-start]');
const deletePanel = document.querySelector('[data-delete-panel]');
const deleteInput = document.querySelector('[data-delete-input]');
const deleteCancel = document.querySelector('[data-delete-cancel]');
const deleteMessage = deleteForm?.querySelector('[data-message]');
const usernameLabel = document.querySelector('[data-username]');

const avatarEditor = document.querySelector('[data-avatar-editor]');
const avatarPreview = avatarEditor?.querySelector('[data-avatar-preview]');
const avatarMessage = avatarEditor?.querySelector('[data-avatar-message]');
const avatarCaption = avatarEditor?.querySelector('[data-avatar-caption]');
const avatarFileInput = document.querySelector('#avatar_foto');
const avatarUploadButton = avatarEditor?.querySelector('[data-avatar-upload]');
const avatarRemoveButton = avatarEditor?.querySelector('[data-avatar-remove]');
const avatarChoiceButtons = avatarEditor
    ? Array.from(avatarEditor.querySelectorAll('[data-avatar-choice]'))
    : [];
const avatarTabs = avatarEditor
    ? Array.from(avatarEditor.querySelectorAll('[data-avatar-tab]'))
    : [];
const avatarPanels = avatarEditor
    ? Array.from(avatarEditor.querySelectorAll('[data-avatar-panel]'))
    : [];

/**
 * @param {Element | null} element
 * @param {string} text
 * @param {'error' | 'success'} [type]
 */
function showMessage(element, text, type = 'error') {
    if (!(element instanceof HTMLElement)) {
        return;
    }

    element.textContent = text;
    element.dataset.type = type;
    element.hidden = false;
}

/**
 * @param {Element | null} element
 */
function clearMessage(element) {
    if (!(element instanceof HTMLElement)) {
        return;
    }

    element.textContent = '';
    element.hidden = true;
}

/**
 * @param {Element | null} button
 * @param {boolean} busy
 * @param {string} idleText
 * @param {string} [busyText]
 */
function setBusy(button, busy, idleText, busyText = 'Guardando…') {
    if (!(button instanceof HTMLButtonElement)) {
        return;
    }

    button.disabled = busy;
    button.textContent = busy ? busyText : idleText;
}

/**
 * Primer mensaje de validación del servidor.
 *
 * @param {any} error
 * @returns {string}
 */
function validationMessage(error) {
    if (error?.data && typeof error.data === 'object') {
        return Object.values(error.data)[0] ?? error.message;
    }

    return error?.message ?? 'Ocurrió un error inesperado.';
}

/**
 * @param {any} error
 */
function redirectIfSessionLost(error) {
    if (error?.status === 401) {
        window.location.replace('/login');

        return true;
    }

    return false;
}

/**
 * Iniciales de respaldo para el avatar.
 *
 * @param {string} nombre
 * @returns {string}
 */
function initialsFromName(nombre) {
    const partes = String(nombre ?? '').trim().split(/\s+/).filter(Boolean).slice(0, 2);
    const iniciales = partes.map((parte) => parte.charAt(0).toUpperCase()).join('');

    return iniciales !== '' ? iniciales : 'U';
}

/**
 * Actualiza las iniciales si el usuario no tiene foto ni avatar.
 *
 * @param {string} nombre
 */
function refreshFallbackInitials(nombre) {
    const iniciales = initialsFromName(nombre);
    const headerAvatar = document.querySelector('[data-header-avatar]');

    if (
        headerAvatar instanceof HTMLElement
        && !headerAvatar.querySelector('img')
        && !headerAvatar.classList.contains('user-avatar')
    ) {
        headerAvatar.textContent = iniciales;
    }

    const previewInitials = document.querySelector('[data-avatar-preview] .user-avatar--initials');

    if (previewInitials instanceof HTMLElement) {
        previewInitials.textContent = iniciales;
    }
}

/**
 * Construye el nodo visual del avatar para el encabezado o la vista previa.
 *
 * @param {any} usuario
 * @param {'header' | 'preview'} size
 * @returns {HTMLSpanElement}
 */
function buildAvatarNode(usuario, size) {
    const isHeader = size === 'header';
    const node = document.createElement('span');
    const tipo = usuario?.avatar_tipo;
    const valor = usuario?.avatar_valor;

    node.className = isHeader ? 'app-header__avatar' : 'user-avatar user-avatar--preview';
    node.setAttribute('aria-hidden', 'true');

    if (isHeader) {
        node.setAttribute('data-header-avatar', '');
    }

    if (tipo === 'foto' && typeof valor === 'string' && valor !== '') {
        node.classList.add(isHeader ? 'app-header__avatar--photo' : 'user-avatar--photo');

        const img = document.createElement('img');
        img.src = valor;
        img.alt = isHeader ? '' : 'Foto de perfil';
        node.append(img);

        return node;
    }

    if (tipo === 'preset' && typeof valor === 'string' && valor !== '') {
        if (isHeader) {
            node.classList.add('user-avatar');
        }

        node.classList.add(`user-avatar--${valor}`);
        node.textContent = typeof usuario?.avatar_emoji === 'string' && usuario.avatar_emoji !== ''
            ? usuario.avatar_emoji
            : '🙂';

        return node;
    }

    if (!isHeader) {
        node.classList.add('user-avatar--initials');
    }

    node.textContent = initialsFromName(usuario?.nombre);

    return node;
}

/**
 * Pinta el avatar en la vista previa y en la cabecera tras guardar.
 *
 * @param {any} usuario
 */
function paintAvatar(usuario) {
    if (avatarPreview instanceof HTMLElement) {
        avatarPreview.replaceChildren(buildAvatarNode(usuario, 'preview'));
    }

    const headerAvatar = document.querySelector('[data-header-avatar]');

    if (headerAvatar instanceof HTMLElement) {
        headerAvatar.replaceWith(buildAvatarNode(usuario, 'header'));
    }

    avatarChoiceButtons.forEach((button) => {
        const selected = usuario?.avatar_tipo === 'preset' && button.dataset.avatarChoice === usuario?.avatar_valor;
        button.classList.toggle('is-selected', selected);
        button.setAttribute('aria-pressed', selected ? 'true' : 'false');
    });

    if (avatarRemoveButton instanceof HTMLElement) {
        avatarRemoveButton.hidden = usuario?.avatar_tipo !== 'foto' && usuario?.avatar_tipo !== 'preset';
    }

    if (avatarCaption instanceof HTMLElement) {
        if (usuario?.avatar_tipo === 'foto') {
            avatarCaption.textContent = 'Foto actual';
        } else if (usuario?.avatar_tipo === 'preset') {
            avatarCaption.textContent = `Avatar: ${usuario?.avatar_label ?? ''}`.trim();
        } else {
            avatarCaption.textContent = 'Sin foto ni avatar';
        }
    }

    if (usuario?.avatar_tipo === 'preset') {
        selectAvatarTab('preset');
    } else if (usuario?.avatar_tipo === 'foto') {
        selectAvatarTab('foto');
    }
}

/**
 * @param {boolean} busy
 */
function setAvatarBusy(busy) {
    if (avatarEditor instanceof HTMLElement) {
        avatarEditor.dataset.busy = busy ? 'true' : 'false';
    }

    if (avatarUploadButton instanceof HTMLButtonElement) {
        avatarUploadButton.disabled = busy || !(avatarFileInput instanceof HTMLInputElement && avatarFileInput.files?.length);
    }
}

/**
 * @param {string} tab
 */
function selectAvatarTab(tab) {
    avatarTabs.forEach((button) => {
        const active = button.dataset.avatarTab === tab;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-selected', active ? 'true' : 'false');
    });

    avatarPanels.forEach((panel) => {
        panel.hidden = panel.dataset.avatarPanel !== tab;
    });
}

/**
 * Envía una selección o una foto al endpoint de avatar.
 *
 * @param {FormData} formData
 */
async function sendAvatar(formData) {
    clearMessage(avatarMessage);
    setAvatarBusy(true);

    try {
        const usuario = await fetchApi('/api/me/avatar', {
            method: 'POST',
            body: formData,
        });

        paintAvatar(usuario);
        const accion = String(formData.get('tipo') ?? '');
        showMessage(
            avatarMessage,
            accion === 'preset'
                ? 'Avatar actualizado.'
                : (accion === 'foto'
                    ? 'Foto de perfil actualizada.'
                    : 'Foto o avatar eliminado.'),
            'success',
        );
    } catch (error) {
        if (!redirectIfSessionLost(error)) {
            showMessage(avatarMessage, validationMessage(error));
        }
    } finally {
        if (avatarFileInput instanceof HTMLInputElement) {
            avatarFileInput.value = '';
        }

        setAvatarBusy(false);
    }
}

avatarTabs.forEach((button) => {
    button.addEventListener('click', () => {
        selectAvatarTab(button.dataset.avatarTab ?? 'foto');
    });
});

avatarChoiceButtons.forEach((button) => {
    button.addEventListener('click', () => {
        const formData = new FormData();
        formData.set('tipo', 'preset');
        formData.set('avatar', button.dataset.avatarChoice ?? '');
        sendAvatar(formData);
    });
});

avatarFileInput?.addEventListener('change', () => {
    clearMessage(avatarMessage);

    if (avatarUploadButton instanceof HTMLButtonElement) {
        avatarUploadButton.disabled = !(avatarFileInput instanceof HTMLInputElement && avatarFileInput.files?.length);
    }
});

avatarUploadButton?.addEventListener('click', () => {
    if (
        !(avatarFileInput instanceof HTMLInputElement)
        || !(avatarFileInput.files instanceof FileList)
        || avatarFileInput.files.length === 0
    ) {
        showMessage(avatarMessage, 'Selecciona una imagen primero.');

        return;
    }

    const formData = new FormData();
    formData.set('tipo', 'foto');
    formData.append('foto', avatarFileInput.files[0]);
    sendAvatar(formData);
});

avatarRemoveButton?.addEventListener('click', () => {
    const formData = new FormData();
    formData.set('tipo', 'none');
    sendAvatar(formData);
});

selectAvatarTab(avatarEditor?.dataset.avatarTab ?? 'foto');

async function cargarUsuario() {
    try {
        const usuario = await fetchApi('/api/me');

        if (usuario?.debe_cambiar_password === true) {
            window.location.replace('/cambiar-password-forzado');

            return;
        }

        if (nombreInput instanceof HTMLInputElement && typeof usuario?.nombre === 'string') {
            nombreInput.value = usuario.nombre;
        }

        if (emailInput instanceof HTMLInputElement && typeof usuario?.email === 'string') {
            emailInput.value = usuario.email;
        }

        if (usernameLabel instanceof HTMLElement && typeof usuario?.nombre === 'string') {
            usernameLabel.textContent = usuario.nombre;
        }
    } catch (error) {
        redirectIfSessionLost(error);
    }
}

perfilForm?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const message = perfilForm.querySelector('[data-message]');
    const submit = perfilForm.querySelector('button[type="submit"]');
    clearMessage(message);

    const nombre = nombreInput instanceof HTMLInputElement ? nombreInput.value.trim() : '';
    const email = emailInput instanceof HTMLInputElement ? emailInput.value.trim() : '';

    if (nombre.length < 2) {
        showMessage(message, 'El nombre debe tener al menos 2 caracteres.');

        return;
    }

    if (!EMAIL_PATTERN.test(email)) {
        showMessage(message, 'Escribe un correo válido.');

        return;
    }

    setBusy(submit, true, 'Guardar cambios', 'Guardando…');

    try {
        const usuario = await fetchApi('/api/me', {
            method: 'PUT',
            body: { nombre, email },
        });

        if (nombreInput instanceof HTMLInputElement) {
            nombreInput.value = usuario.nombre;
        }

        if (emailInput instanceof HTMLInputElement) {
            emailInput.value = usuario.email;
        }

        if (usernameLabel instanceof HTMLElement) {
            usernameLabel.textContent = usuario.nombre;
        }

        refreshFallbackInitials(usuario.nombre);
        showMessage(message, 'Datos actualizados.', 'success');
    } catch (error) {
        if (!redirectIfSessionLost(error)) {
            showMessage(message, validationMessage(error));
        }
    } finally {
        setBusy(submit, false, 'Guardar cambios');
    }
});

passwordForm?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const message = passwordForm.querySelector('[data-message]');
    const submit = passwordForm.querySelector('button[type="submit"]');
    clearMessage(message);

    const actual = passwordActual instanceof HTMLInputElement ? passwordActual.value : '';
    const nueva = passwordNueva instanceof HTMLInputElement ? passwordNueva.value : '';
    const confirmar = passwordConfirmar instanceof HTMLInputElement ? passwordConfirmar.value : '';

    if (actual === '') {
        showMessage(message, 'Escribe tu contraseña actual.');

        return;
    }

    if (nueva.length < 8) {
        showMessage(message, 'La contraseña nueva debe tener al menos 8 caracteres.');

        return;
    }

    if (nueva === actual) {
        showMessage(message, 'La contraseña nueva debe ser distinta de la actual.');

        return;
    }

    if (nueva !== confirmar) {
        showMessage(message, 'La confirmación no coincide con la contraseña nueva.');

        return;
    }

    setBusy(submit, true, 'Cambiar contraseña', 'Cambiando…');

    try {
        await fetchApi('/api/me/password', {
            method: 'PUT',
            body: { password_actual: actual, password_nueva: nueva },
        });

        passwordForm.reset();
        showMessage(message, 'Contraseña actualizada.', 'success');
    } catch (error) {
        if (!redirectIfSessionLost(error)) {
            showMessage(message, validationMessage(error));
        }
    } finally {
        setBusy(submit, false, 'Cambiar contraseña');
    }
});

deleteStart?.addEventListener('click', () => {
    if (deletePanel instanceof HTMLElement) {
        deletePanel.hidden = false;
    }

    deleteStart.hidden = true;

    if (deleteInput instanceof HTMLInputElement) {
        deleteInput.focus();
    }
});

deleteCancel?.addEventListener('click', () => {
    if (deletePanel instanceof HTMLElement) {
        deletePanel.hidden = true;
    }

    deleteStart.hidden = false;

    if (deleteInput instanceof HTMLInputElement) {
        deleteInput.value = '';
    }

    clearMessage(deleteMessage);
});

deleteInput?.addEventListener('input', () => {
    clearMessage(deleteMessage);
});

deleteForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearMessage(deleteMessage);

    const confirmacion = deleteInput instanceof HTMLInputElement ? deleteInput.value.trim() : '';

    if (confirmacion.toUpperCase() !== 'ELIMINAR') {
        showMessage(deleteMessage, 'Escribe ELIMINAR para confirmar la baja.');

        return;
    }

    const submit = deleteForm.querySelector('button[type="submit"]');
    setBusy(submit, true, 'Eliminar definitivamente', 'Eliminando…');

    try {
        await fetchApi('/api/me', {
            method: 'DELETE',
            body: { confirmacion: true },
        });

        window.location.replace('/login');
    } catch (error) {
        if (!redirectIfSessionLost(error)) {
            showMessage(deleteMessage, validationMessage(error));
        }

        setBusy(submit, false, 'Eliminar definitivamente');
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

cargarUsuario();

/* Compartir enlace ------------------------------------------------------ */

const shareCopyButton = document.querySelector('[data-share-copy]');
const shareNativeButton = document.querySelector('[data-share-native]');
const shareMessage = document.querySelector('[data-share-message]');
const shareUrlElement = document.querySelector('[data-share-url]');
const shareUrl = shareUrlElement?.textContent?.trim() ?? '';

if (shareNativeButton instanceof HTMLElement && typeof navigator.share === 'function') {
    shareNativeButton.hidden = false;
}

if (shareCopyButton instanceof HTMLButtonElement && shareUrl !== '') {
    shareCopyButton.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(shareUrl);
            showMessage(shareMessage, 'Enlace copiado.', 'success');

            return;
        } catch {
            // Algunos navegadores exigen HTTPS o permiso; se intenta el método clásico.
        }

        const input = document.createElement('textarea');
        input.value = shareUrl;
        input.setAttribute('readonly', '');
        input.style.position = 'fixed';
        input.style.top = '-1000px';
        input.style.opacity = '0';
        document.body.append(input);
        input.select();

        let copied = false;

        try {
            copied = document.execCommand('copy');
        } catch {
            copied = false;
        }

        input.remove();
        showMessage(
            shareMessage,
            copied
                ? 'Enlace copiado.'
                : 'No se pudo copiar; selecciona el enlace manualmente.',
            copied ? 'success' : 'error'
        );
    });
}

if (shareNativeButton instanceof HTMLButtonElement && shareUrl !== '') {
    shareNativeButton.addEventListener('click', async () => {
        try {
            await navigator.share({
                title: 'Mi Súper',
                text: 'Crea tu cuenta en Mi Súper',
                url: shareUrl,
            });
        } catch (error) {
            if (error instanceof DOMException && error.name === 'AbortError') {
                return;
            }

            showMessage(shareMessage, 'No se pudo compartir el enlace.', 'error');
        }
    });
}
