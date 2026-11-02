/**
 * Panel Admin · Usuarios.
 *
 * CRUD de cuentas: alta, edición, eliminación y reset manual de contraseña.
 * La contraseña temporal solo vive en memoria hasta que se cierra el modal.
 */

import { fetchApi } from '../modules/api.js';
import { showToast } from '../modules/toast.js';

const PER_PAGE = 20;

const tabla = document.querySelector('[data-usuarios-table]');

if (tabla instanceof HTMLElement) {
    init(tabla);
}

/**
 * @param {HTMLElement} tabla
 */
function init(tabla) {
    const body = document.querySelector('[data-usuarios-body]');
    const buscador = document.querySelector('[data-search]');
    const totalLabel = document.querySelector('[data-total]');
    const tableMessage = document.querySelector('[data-table-message]');
    const pagination = document.querySelector('[data-pagination]');
    const prev = document.querySelector('[data-page-prev]');
    const next = document.querySelector('[data-page-next]');
    const pageStatus = document.querySelector('[data-page-status]');

    const nuevoButton = document.querySelector('[data-nuevo-usuario]');
    const userModal = document.querySelector('[data-modal-usuario]');
    const userForm = document.querySelector('[data-usuario-form]');
    const userTitle = document.querySelector('[data-usuario-title]');
    const userSubtitle = document.querySelector('[data-usuario-subtitle]');
    const userIdInput = userForm?.querySelector('[data-user-id]');
    const userNameInput = userForm?.querySelector('#usuario-nombre');
    const userEmailInput = userForm?.querySelector('#usuario-email');
    const userRolSelect = userForm?.querySelector('#usuario-rol');
    const passwordGroup = userForm?.querySelector('[data-password-group]');
    const passwordInput = userForm?.querySelector('#usuario-password');
    const passwordConfirmInput = userForm?.querySelector('#usuario-password-confirm');
    const debeCambiarInput = userForm?.querySelector('[data-debe-cambiar]');
    const passwordNota = userForm?.querySelector('[data-password-nota]');
    const userMessage = userForm?.querySelector('[data-usuario-message]');
    const userSubmit = userForm?.querySelector('[data-usuario-submit]');

    const deleteModal = document.querySelector('[data-modal-eliminar]');
    const deleteNombre = document.querySelector('[data-delete-nombre]');
    const deleteEmail = document.querySelector('[data-delete-email]');
    const deleteMessage = document.querySelector('[data-delete-message]');
    const deleteConfirm = document.querySelector('[data-delete-confirmar]');

    const modal = document.querySelector('[data-modal-reset]');
    const confirmPanel = document.querySelector('[data-reset-confirm]');
    const resultPanel = document.querySelector('[data-reset-resultado]');
    const nombreLabel = document.querySelector('[data-reset-nombre]');
    const emailLabel = document.querySelector('[data-reset-email]');
    const passwordLabel = document.querySelector('[data-reset-password]');
    const resetMessage = document.querySelector('[data-reset-message]');
    const copyMessage = document.querySelector('[data-copy-message]');
    const confirmButton = document.querySelector('[data-reset-confirmar]');
    const copyButton = document.querySelector('[data-copiar]');

    if (!(body instanceof HTMLElement)) {
        return;
    }

    const currentUserId = Number(tabla.dataset.currentUserId ?? 0);
    const state = { page: 1, total: 0, q: '' };

    let debounceId = 0;
    let usuarioPendiente = null;
    let usuarioEditando = null;
    let usuarioAEliminar = null;
    let passwordTemporal = '';

    bindLogout();

    /* Alta y edición de usuarios ---------------------------------------- */

    nuevoButton?.addEventListener('click', () => abrirFormulario(null));

    userForm?.addEventListener('submit', (event) => {
        event.preventDefault();
        guardarUsuario();
    });

    document.querySelector('[data-usuario-cancelar]')?.addEventListener('click', cerrarFormulario);

    // En edición, el propio Admin conserva su rol (el servidor también lo fuerza).
    userRolSelect?.addEventListener('change', () => {
        if (usuarioEditando !== null && Number(usuarioEditando.id) === currentUserId) {
            userRolSelect.value = String(usuarioEditando.rol ?? 'admin');
        }
    });

    /* Eliminación -------------------------------------------------------- */

    document.querySelector('[data-delete-cancelar]')?.addEventListener('click', cerrarEliminar);
    deleteConfirm?.addEventListener('click', confirmarEliminar);

    /* Buscador y paginación --------------------------------------------- */

    if (buscador instanceof HTMLInputElement) {
        buscador.addEventListener('input', () => {
            window.clearTimeout(debounceId);

            debounceId = window.setTimeout(() => {
                state.q = buscador.value.trim();
                state.page = 1;
                cargar();
            }, 300);
        });
    }

    prev?.addEventListener('click', () => {
        if (state.page > 1) {
            state.page -= 1;
            cargar();
        }
    });

    next?.addEventListener('click', () => {
        const paginas = Math.max(1, Math.ceil(state.total / PER_PAGE));

        if (state.page < paginas) {
            state.page += 1;
            cargar();
        }
    });

    /* Acciones de la tabla ---------------------------------------------- */

    body.addEventListener('click', (event) => {
        const target = event.target;

        if (!(target instanceof Element)) {
            return;
        }

        const editar = target.closest('[data-edit-id]');

        if (editar instanceof HTMLButtonElement && !editar.disabled) {
            abrirFormulario({
                id: Number(editar.dataset.editId),
                nombre: editar.dataset.nombre ?? '',
                email: editar.dataset.email ?? '',
                rol: editar.dataset.rol ?? 'usuario',
            });

            return;
        }

        const eliminar = target.closest('[data-delete-id]');

        if (eliminar instanceof HTMLButtonElement && !eliminar.disabled) {
            abrirEliminar({
                id: Number(eliminar.dataset.deleteId),
                nombre: eliminar.dataset.nombre ?? '',
                email: eliminar.dataset.email ?? '',
            });

            return;
        }

        const boton = target.closest('[data-reset-id]');

        if (!(boton instanceof HTMLButtonElement) || boton.disabled) {
            return;
        }

        abrirModal({
            id: Number(boton.dataset.resetId),
            nombre: boton.dataset.nombre ?? '',
            email: boton.dataset.email ?? '',
        });
    });

    /* Modal ------------------------------------------------------------- */

    confirmButton?.addEventListener('click', () => {
        confirmarReset();
    });

    document.querySelector('[data-reset-cancelar]')?.addEventListener('click', cerrarModal);
    document.querySelector('[data-reset-cerrar]')?.addEventListener('click', cerrarModal);
    copyButton?.addEventListener('click', copiarPassword);

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            cerrarModal();
            cerrarFormulario();
            cerrarEliminar();
        }
    });

    modal?.addEventListener('click', (event) => {
        if (event.target === modal) {
            cerrarModal();
        }
    });

    userModal?.addEventListener('click', (event) => {
        if (event.target === userModal) {
            cerrarFormulario();
        }
    });

    deleteModal?.addEventListener('click', (event) => {
        if (event.target === deleteModal) {
            cerrarEliminar();
        }
    });

    cargar();

    /* Carga y render ---------------------------------------------------- */

    async function cargar() {
        clearMessage(tableMessage);

        if (totalLabel instanceof HTMLElement) {
            totalLabel.hidden = true;
        }

        body.replaceChildren();
        body.append(filaMensaje('Cargando usuarios…'));

        const params = new URLSearchParams();

        if (state.q !== '') {
            params.set('q', state.q);
        }

        params.set('page', String(state.page));

        try {
            const data = await fetchApi(`/api/admin/usuarios?${params.toString()}`);
            const items = Array.isArray(data?.items) ? data.items : [];

            state.total = Number(data?.total ?? 0);

            const paginas = Math.max(1, Math.ceil(state.total / PER_PAGE));

            if (state.page > paginas) {
                state.page = paginas;
                cargar();

                return;
            }

            body.replaceChildren();

            if (items.length === 0) {
                body.append(filaMensaje('No hay usuarios.'));
            } else {
                const fragment = document.createDocumentFragment();

                for (const usuario of items) {
                    fragment.append(fila(usuario));
                }

                body.append(fragment);
            }

            if (totalLabel instanceof HTMLElement) {
                totalLabel.textContent = `${state.total} ${state.total === 1 ? 'usuario' : 'usuarios'}`;
                totalLabel.hidden = false;
            }

            renderPaginacion(state.total);
        } catch (error) {
            body.replaceChildren();
            body.append(filaMensaje('No se pudieron cargar los usuarios.'));

            if (!redirectIfSessionLost(error)) {
                showMessage(tableMessage, firstValidationMessage(error));
            }

            if (pagination instanceof HTMLElement) {
                pagination.hidden = true;
            }
        }
    }

    /**
     * @param {any} usuario
     * @returns {HTMLTableRowElement}
     */
    function fila(usuario) {
        const tr = document.createElement('tr');
        tr.dataset.userId = String(Number(usuario.id ?? 0));

        tr.append(celda(String(Number(usuario.id ?? 0))));
        tr.append(celda(String(usuario.nombre ?? ''), 'fw-semibold'));
        tr.append(celda(String(usuario.email ?? '')));

        const rolTd = document.createElement('td');
        const esAdmin = usuario.rol === 'admin';
        rolTd.append(badge(
            esAdmin ? 'Admin' : 'Usuario',
            `badge ${esAdmin ? 'bg-danger' : 'bg-secondary'}`,
        ));
        tr.append(rolTd);

        const flagTd = document.createElement('td');

        if (usuario.debe_cambiar_password === true) {
            flagTd.append(badge('Sí', 'badge bg-warning text-dark'));
        } else {
            flagTd.append(document.createTextNode('—'));
        }

        tr.append(flagTd);

        const fechaTd = document.createElement('td');
        fechaTd.className = 'text-muted small';
        fechaTd.textContent = formatearFecha(usuario.created_at);
        tr.append(fechaTd);

        const acciones = document.createElement('td');
        acciones.className = 'text-end admin-actions';

        const esPropio = Number(usuario.id) === currentUserId;
        const id = String(Number(usuario.id ?? 0));
        const nombre = String(usuario.nombre ?? '');
        const email = String(usuario.email ?? '');
        const rol = String(usuario.rol ?? 'usuario');

        const grupo = document.createElement('span');
        grupo.className = 'd-inline-flex flex-wrap justify-content-end gap-1';

        const editar = document.createElement('button');
        editar.type = 'button';
        editar.className = 'btn btn-sm btn-outline-primary';
        editar.innerHTML = '<i class="bi bi-pencil-square" aria-hidden="true"></i> Editar';
        editar.title = 'Editar nombre, email y rol';
        editar.dataset.editId = id;
        editar.dataset.nombre = nombre;
        editar.dataset.email = email;
        editar.dataset.rol = rol;

        const resetear = document.createElement('button');
        resetear.type = 'button';
        resetear.className = 'btn btn-sm btn-outline-warning btn-reset';
        resetear.innerHTML = '<i class="bi bi-key-fill" aria-hidden="true"></i> Resetear contraseña';
        resetear.disabled = esPropio;
        resetear.dataset.resetId = id;
        resetear.dataset.nombre = nombre;
        resetear.dataset.email = email;

        if (esPropio) {
            resetear.title = 'No puedes resetear tu propia contraseña desde aquí. Usa /ajustes.';
            resetear.setAttribute(
                'aria-label',
                'Resetear contraseña no disponible para tu propia cuenta',
            );
        } else {
            resetear.title = 'Generar una contraseña temporal';
        }

        const eliminar = document.createElement('button');
        eliminar.type = 'button';
        eliminar.className = 'btn btn-sm btn-outline-danger';
        eliminar.innerHTML = '<i class="bi bi-trash3" aria-hidden="true"></i> Eliminar';
        eliminar.disabled = esPropio;
        eliminar.dataset.deleteId = id;
        eliminar.dataset.nombre = nombre;
        eliminar.dataset.email = email;

        if (esPropio) {
            eliminar.title = 'No puedes eliminar tu propia cuenta desde aquí. Usa /ajustes.';
            eliminar.setAttribute(
                'aria-label',
                'Eliminar no disponible para tu propia cuenta',
            );
        } else {
            eliminar.title = 'Eliminar la cuenta y todos sus datos';
        }

        // El wrapper conserva el tooltip aunque el botón esté deshabilitado.
        for (const [button, titulo] of [[resetear, resetear.title], [eliminar, eliminar.title]]) {
            const wrapper = document.createElement('span');
            wrapper.className = 'admin-usuarios__action';

            if (esPropio && button.disabled) {
                wrapper.title = titulo;
            }

            wrapper.append(button);
            grupo.append(wrapper);
        }

        grupo.prepend(editar);
        acciones.append(grupo);
        tr.append(acciones);

        return tr;
    }

    /**
     * @param {number} total
     */
    function renderPaginacion(total) {
        const paginas = Math.max(1, Math.ceil(total / PER_PAGE));

        if (!(pagination instanceof HTMLElement)) {
            return;
        }

        pagination.hidden = paginas <= 1;

        if (prev instanceof HTMLButtonElement) {
            prev.disabled = state.page <= 1;
        }

        if (next instanceof HTMLButtonElement) {
            next.disabled = state.page >= paginas;
        }

        if (pageStatus instanceof HTMLElement) {
            pageStatus.textContent = `Página ${state.page} de ${paginas}`;
        }
    }

    /* Alta y edición ---------------------------------------------------- */

    /**
     * @param {{ id: number, nombre: string, email: string, rol: string } | null} usuario
     */
    function abrirFormulario(usuario) {
        if (!(userForm instanceof HTMLFormElement) || !(userModal instanceof HTMLElement)) {
            return;
        }

        usuarioEditando = usuario;
        const esEdicion = usuario !== null;

        userForm.reset();
        limpiarErroresFormulario();
        clearMessage(userMessage);

        if (userTitle instanceof HTMLElement) {
            userTitle.textContent = esEdicion ? 'Editar usuario' : 'Nuevo usuario';
        }

        if (userSubtitle instanceof HTMLElement) {
            userSubtitle.textContent = esEdicion
                ? 'Actualiza los datos de la cuenta. La contraseña se gestiona con el botón Resetear.'
                : 'Crea una cuenta y comparte la contraseña con la persona.';
        }

        if (userIdInput instanceof HTMLInputElement) {
            userIdInput.value = esEdicion ? String(usuario.id) : '';
        }

        if (userNameInput instanceof HTMLInputElement) {
            userNameInput.value = esEdicion ? usuario.nombre : '';
        }

        if (userEmailInput instanceof HTMLInputElement) {
            userEmailInput.value = esEdicion ? usuario.email : '';
        }

        if (userRolSelect instanceof HTMLSelectElement) {
            userRolSelect.value = esEdicion ? usuario.rol : 'usuario';
            userRolSelect.disabled = esEdicion && Number(usuario.id) === currentUserId;
            userRolSelect.title = userRolSelect.disabled
                ? 'No puedes cambiar tu propio rol.'
                : '';
        }

        if (passwordGroup instanceof HTMLElement) {
            passwordGroup.hidden = esEdicion;
        }

        if (passwordNota instanceof HTMLElement) {
            passwordNota.hidden = !esEdicion;
        }

        for (const campo of [passwordInput, passwordConfirmInput]) {
            if (campo instanceof HTMLInputElement) {
                campo.required = !esEdicion;
                campo.value = '';
            }
        }

        if (debeCambiarInput instanceof HTMLInputElement) {
            debeCambiarInput.checked = true;
        }

        setBusy(userSubmit, false, esEdicion ? 'Guardar cambios' : 'Crear usuario');
        userModal.setAttribute('aria-labelledby', 'usuario-title');
        userModal.hidden = false;

        if (userNameInput instanceof HTMLInputElement) {
            userNameInput.focus();
        }
    }

    async function guardarUsuario() {
        if (!(userForm instanceof HTMLFormElement)) {
            return;
        }

        limpiarErroresFormulario();
        clearMessage(userMessage);

        const nombre = userNameInput instanceof HTMLInputElement ? userNameInput.value.trim() : '';
        const email = userEmailInput instanceof HTMLInputElement ? userEmailInput.value.trim() : '';
        const rol = userRolSelect instanceof HTMLSelectElement ? userRolSelect.value : 'usuario';
        const password = passwordInput instanceof HTMLInputElement ? passwordInput.value : '';
        const passwordConfirm = passwordConfirmInput instanceof HTMLInputElement
            ? passwordConfirmInput.value
            : '';
        const esEdicion = usuarioEditando !== null;
        let valido = true;

        if (nombre === '') {
            marcarErrorFormulario('nombre', 'El nombre es obligatorio.');
            valido = false;
        } else if (nombre.length > 100) {
            marcarErrorFormulario('nombre', 'El nombre debe tener como máximo 100 caracteres.');
            valido = false;
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            marcarErrorFormulario('email', 'Escribe un correo válido.');
            valido = false;
        }

        if (!['usuario', 'admin'].includes(rol)) {
            marcarErrorFormulario('rol', 'Selecciona un rol válido.');
            valido = false;
        }

        if (!esEdicion) {
            if (password.length < 8) {
                marcarErrorFormulario('password', 'La contraseña debe tener al menos 8 caracteres.');
                valido = false;
            }

            if (passwordConfirm !== password || passwordConfirm === '') {
                marcarErrorFormulario('password_confirm', 'Las contraseñas no coinciden.');
                valido = false;
            }
        }

        if (!valido) {
            showMessage(userMessage, 'Revisa los datos marcados.');

            return;
        }

        const body = { nombre, email, rol };

        if (!esEdicion) {
            body.password = password;
            body.debe_cambiar_password = debeCambiarInput instanceof HTMLInputElement
                ? debeCambiarInput.checked
                : true;
        }

        setBusy(userSubmit, true, esEdicion ? 'Guardar cambios' : 'Crear usuario', 'Guardando…');

        try {
            if (esEdicion) {
                await fetchApi(`/api/admin/usuarios/${encodeURIComponent(String(usuarioEditando.id))}`, {
                    method: 'PUT',
                    body,
                });
            } else {
                await fetchApi('/api/admin/usuarios', {
                    method: 'POST',
                    body,
                });
            }

            cerrarFormulario();
            showToast(esEdicion ? 'Usuario actualizado.' : 'Usuario creado.', 'success');

            if (!esEdicion) {
                state.page = 1;
            }

            cargar();
        } catch (error) {
            setBusy(userSubmit, false, esEdicion ? 'Guardar cambios' : 'Crear usuario');

            if (redirectIfSessionLost(error)) {
                return;
            }

            if (error?.data && typeof error.data === 'object') {
                for (const [campo, texto] of Object.entries(error.data)) {
                    if (campo === '_general') {
                        continue;
                    }

                    marcarErrorFormulario(campo, String(texto));
                }
            }

            showMessage(userMessage, firstValidationMessage(error));
        }
    }

    function cerrarFormulario() {
        if (!(userModal instanceof HTMLElement) || userModal.hidden) {
            return;
        }

        userModal.hidden = true;
        usuarioEditando = null;

        if (userForm instanceof HTMLFormElement) {
            userForm.reset();
        }

        if (userRolSelect instanceof HTMLSelectElement) {
            userRolSelect.disabled = false;
            userRolSelect.title = '';
        }

        limpiarErroresFormulario();
        clearMessage(userMessage);
    }

    /**
     * @param {string} campo
     * @param {string} texto
     */
    function marcarErrorFormulario(campo, texto) {
        const slot = userForm?.querySelector(`[data-error-for="${campo}"]`);

        if (slot instanceof HTMLElement) {
            slot.textContent = texto;
            slot.hidden = false;
        }

        const input = userForm?.querySelector(`#usuario-${campo}`);

        if (input instanceof HTMLElement) {
            input.setAttribute('aria-invalid', 'true');
        }
    }

    function limpiarErroresFormulario() {
        if (!(userForm instanceof HTMLFormElement)) {
            return;
        }

        for (const slot of userForm.querySelectorAll('[data-error-for]')) {
            if (slot instanceof HTMLElement) {
                slot.textContent = '';
                slot.hidden = true;
            }
        }

        for (const input of userForm.querySelectorAll('[aria-invalid]')) {
            input.removeAttribute('aria-invalid');
        }
    }

    /* Eliminación -------------------------------------------------------- */

    /**
     * @param {{ id: number, nombre: string, email: string }} usuario
     */
    function abrirEliminar(usuario) {
        if (!(deleteModal instanceof HTMLElement) || usuario.id <= 0) {
            return;
        }

        usuarioAEliminar = usuario;

        if (deleteNombre instanceof HTMLElement) {
            deleteNombre.textContent = usuario.nombre;
        }

        if (deleteEmail instanceof HTMLElement) {
            deleteEmail.textContent = usuario.email;
        }

        clearMessage(deleteMessage);
        setBusy(deleteConfirm, false, 'Eliminar definitivamente');
        deleteModal.hidden = false;

        if (deleteConfirm instanceof HTMLButtonElement) {
            deleteConfirm.focus();
        }
    }

    async function confirmarEliminar() {
        if (usuarioAEliminar === null) {
            return;
        }

        const id = Number(usuarioAEliminar.id);

        if (id <= 0) {
            return;
        }

        clearMessage(deleteMessage);
        setBusy(deleteConfirm, true, 'Eliminar definitivamente', 'Eliminando…');

        try {
            await fetchApi(`/api/admin/usuarios/${encodeURIComponent(String(id))}`, {
                method: 'DELETE',
            });

            cerrarEliminar();
            showToast('Usuario eliminado.', 'success');
            cargar();
        } catch (error) {
            setBusy(deleteConfirm, false, 'Eliminar definitivamente');

            if (redirectIfSessionLost(error)) {
                return;
            }

            if (error?.status === 403) {
                cerrarEliminar();
                showToast(error.message, 'error');

                return;
            }

            showMessage(deleteMessage, firstValidationMessage(error));
        }
    }

    function cerrarEliminar() {
        if (!(deleteModal instanceof HTMLElement) || deleteModal.hidden) {
            return;
        }

        deleteModal.hidden = true;
        usuarioAEliminar = null;
        clearMessage(deleteMessage);
        setBusy(deleteConfirm, false, 'Eliminar definitivamente');
    }

    /* Reset de contraseña ----------------------------------------------- */

    /**
     * @param {{ id: number, nombre: string, email: string }} usuario
     */
    function abrirModal(usuario) {
        if (!(modal instanceof HTMLElement) || usuario.id <= 0) {
            return;
        }

        usuarioPendiente = usuario;
        passwordTemporal = '';

        if (nombreLabel instanceof HTMLElement) {
            nombreLabel.textContent = usuario.nombre;
        }

        if (emailLabel instanceof HTMLElement) {
            emailLabel.textContent = usuario.email;
        }

        if (passwordLabel instanceof HTMLElement) {
            passwordLabel.textContent = '';
        }

        clearMessage(resetMessage);
        clearMessage(copyMessage);
        setBusy(confirmButton, false, 'Resetear contraseña');

        if (copyButton instanceof HTMLButtonElement) {
            copyButton.disabled = false;
        }

        if (confirmPanel instanceof HTMLElement) {
            confirmPanel.hidden = false;
        }

        if (resultPanel instanceof HTMLElement) {
            resultPanel.hidden = true;
        }

        modal.setAttribute('aria-labelledby', 'reset-confirm-title');
        modal.hidden = false;

        if (confirmButton instanceof HTMLButtonElement) {
            confirmButton.focus();
        }
    }

    async function confirmarReset() {
        if (usuarioPendiente === null) {
            return;
        }

        const id = Number(usuarioPendiente.id);

        if (id <= 0) {
            showMessage(resetMessage, 'No se pudo identificar al usuario.');

            return;
        }

        clearMessage(resetMessage);
        setBusy(confirmButton, true, 'Resetear contraseña', 'Generando…');

        try {
            const data = await fetchApi(
                `/api/admin/usuarios/${encodeURIComponent(String(id))}/reset-password`,
                { method: 'POST' },
            );

            const temporal = String(data?.password_temporal ?? '');

            if (temporal === '') {
                throw new Error('La respuesta no incluyó la contraseña temporal.');
            }

            passwordTemporal = temporal;

            if (emailLabel instanceof HTMLElement) {
                emailLabel.textContent = String(data?.email ?? usuarioPendiente.email ?? '');
            }

            if (passwordLabel instanceof HTMLElement) {
                passwordLabel.textContent = temporal;
            }

            if (confirmPanel instanceof HTMLElement) {
                confirmPanel.hidden = true;
            }

            if (resultPanel instanceof HTMLElement) {
                resultPanel.hidden = false;
            }

            if (modal instanceof HTMLElement) {
                modal.setAttribute('aria-labelledby', 'reset-result-title');
            }

            clearMessage(copyMessage);
            showToast('Contraseña temporal generada.', 'success');

            if (copyButton instanceof HTMLButtonElement) {
                copyButton.focus();
            }
        } catch (error) {
            setBusy(confirmButton, false, 'Resetear contraseña');

            if (redirectIfSessionLost(error)) {
                return;
            }

            if (error?.status === 403) {
                cerrarModal();
                showToast(error.message, 'error');

                return;
            }

            showMessage(resetMessage, firstValidationMessage(error));
        }
    }

    async function copiarPassword() {
        if (passwordTemporal === '') {
            return;
        }

        try {
            if (
                !navigator.clipboard
                || typeof navigator.clipboard.writeText !== 'function'
            ) {
                throw new Error('Clipboard no disponible.');
            }

            await navigator.clipboard.writeText(passwordTemporal);
            marcarCopiada();
        } catch {
            if (copiarFallback(passwordTemporal)) {
                marcarCopiada();
            } else {
                showMessage(
                    copyMessage,
                    'No se pudo copiar automáticamente. Selecciona la contraseña y cópiala manualmente.',
                );
            }
        }
    }

    function marcarCopiada() {
        showMessage(copyMessage, 'Contraseña copiada al portapapeles.', 'success');
        showToast('Contraseña copiada.', 'success');
    }

    function cerrarModal() {
        if (!(modal instanceof HTMLElement) || modal.hidden) {
            return;
        }

        modal.hidden = true;
        usuarioPendiente = null;
        passwordTemporal = '';

        if (passwordLabel instanceof HTMLElement) {
            passwordLabel.textContent = '';
        }

        clearMessage(resetMessage);
        clearMessage(copyMessage);

        // Refleja el posible cambio de debe_cambiar_password en la tabla.
        cargar();
    }
}

/* Utilidades de módulo -------------------------------------------------- */

/**
 * @param {string} texto
 * @returns {HTMLTableRowElement}
 */
function filaMensaje(texto) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.className = 'text-center text-muted py-4';
    td.colSpan = 7;
    td.textContent = texto;
    tr.append(td);

    return tr;
}

/**
 * @param {string} texto
 * @param {string} [className]
 * @returns {HTMLTableCellElement}
 */
function celda(texto, className = '') {
    const td = document.createElement('td');
    td.textContent = texto;

    if (className !== '') {
        td.className = className;
    }

    return td;
}

/**
 * @param {string} texto
 * @param {string} className
 * @returns {HTMLSpanElement}
 */
function badge(texto, className) {
    const span = document.createElement('span');
    span.className = className;
    span.textContent = texto;

    return span;
}

/**
 * @param {any} value
 * @returns {string}
 */
function formatearFecha(value) {
    if (typeof value !== 'string' || value.length < 10) {
        return '—';
    }

    const [fecha] = value.split(' ');
    const partes = fecha.split('-');

    if (partes.length !== 3) {
        return fecha;
    }

    return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

/**
 * @param {string} texto
 * @returns {boolean}
 */
function copiarFallback(texto) {
    const area = document.createElement('textarea');
    area.value = texto;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.append(area);
    area.select();

    let copiado = false;

    try {
        copiado = document.execCommand('copy');
    } catch {
        copiado = false;
    }

    area.remove();

    return copiado;
}

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
 * @param {any} error
 * @returns {string}
 */
function firstValidationMessage(error) {
    if (error?.data && typeof error.data === 'object') {
        return Object.values(error.data)[0] ?? error.message;
    }

    return error?.message ?? 'Ocurrió un error inesperado.';
}

/**
 * @param {any} error
 * @returns {boolean} true si ya se redirigió al login.
 */
function redirectIfSessionLost(error) {
    if (error?.status === 401) {
        window.location.replace('/login');

        return true;
    }

    if (error?.status === 403) {
        showToast('No tienes permisos para ver esta sección.', 'error');

        return false;
    }

    return false;
}

function bindLogout() {
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
}
