/**
 * Notas personales: listado, buscador, CRUD y fotos adjuntas.
 */

import { fetchApi } from '../modules/api.js';
import { showToast } from '../modules/toast.js';

const MAX_BYTES = 2 * 1024 * 1024;
const MIME_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp'];

const root = document.querySelector('[data-notas]');

if (root instanceof HTMLElement) {
    init(root);
}

/**
 * @param {HTMLElement} root
 */
function init(root) {
    const grid = root.querySelector('[data-notas-lista]');
    const empty = root.querySelector('[data-notas-vacio]');
    const countLabel = root.querySelector('[data-nota-count]');
    const search = root.querySelector('[data-nota-buscar]');
    const maxFotos = Math.max(1, Number(root.dataset.maxFotos ?? 8));

    const modal = document.querySelector('[data-nota-modal]');
    const form = modal?.querySelector('[data-nota-form]');
    const formTitle = modal?.querySelector('[data-nota-form-titulo]');
    const fechaHint = modal?.querySelector('[data-nota-fecha-hint]');
    const tituloInput = modal?.querySelector('[data-nota-titulo]');
    const contenidoInput = modal?.querySelector('[data-nota-contenido]');
    const fileInput = modal?.querySelector('[data-nota-fotos]');
    const preview = modal?.querySelector('[data-nota-fotos-preview]');
    const hint = modal?.querySelector('[data-nota-fotos-hint]');
    const submitButton = modal?.querySelector('[data-nota-guardar]');
    const message = modal?.querySelector('[data-nota-mensaje]');

    const deleteModal = document.querySelector('[data-borrar-modal]');
    const deleteName = deleteModal?.querySelector('[data-borrar-nombre]');
    const deleteConfirm = deleteModal?.querySelector('[data-borrar-confirmar]');

    const photoModal = document.querySelector('[data-foto-modal]');
    const photoLarge = photoModal?.querySelector('[data-foto-grande]');

    if (
        !(grid instanceof HTMLElement)
        || !(empty instanceof HTMLElement)
        || !(countLabel instanceof HTMLElement)
        || !(modal instanceof HTMLElement)
        || !(form instanceof HTMLFormElement)
    ) {
        return;
    }

    /** @type {Array<any>} */
    let notas = [];
    /** @type {any|null} */
    let editando = null;
    /** @type {Array<{id: number, ruta: string}>} */
    let fotosGuardadas = [];
    /** @type {Array<{file: File, url: string}>} */
    let fotosNuevas = [];
    /** @type {Set<number>} */
    const fotosBorrar = new Set();
    /** @type {number|null} */
    let borrarId = null;
    let guardando = false;

    const formatoFecha = new Intl.DateTimeFormat('es-MX', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
    const formatoHora = new Intl.DateTimeFormat('es-MX', {
        hour: '2-digit',
        minute: '2-digit',
    });

    bindLogout();
    bindEditor();
    bindDeleteModal();
    bindPhotoModal();

    load();

    /* Carga y render ---------------------------------------------------- */

    async function load() {
        empty.hidden = false;
        empty.textContent = 'Cargando notas…';

        try {
            const data = await fetchApi('/api/notas');
            notas = Array.isArray(data?.items) ? data.items : [];
            render();
        } catch (error) {
            if (redirectIfSessionLost(error)) {
                return;
            }

            empty.hidden = false;
            empty.textContent = 'No se pudieron cargar las notas.';
            showToast(error?.message ?? 'No se pudieron cargar las notas.', 'error');
        }
    }

    function render() {
        const consulta = normalizar(search instanceof HTMLInputElement ? search.value : '');
        const visibles = consulta === ''
            ? notas
            : notas.filter((nota) => normalizar(`${nota.titulo} ${nota.contenido}`).includes(consulta));

        grid.replaceChildren();

        if (notas.length === 0) {
            empty.hidden = false;
            empty.textContent = 'Aún no tienes notas. Crea la primera con «Nueva nota».';
            countLabel.textContent = '';

            return;
        }

        if (visibles.length === 0) {
            empty.hidden = false;
            empty.textContent = 'No hay notas que coincidan con tu búsqueda.';
        } else {
            empty.hidden = true;
        }

        countLabel.textContent = `${visibles.length} ${visibles.length === 1 ? 'nota' : 'notas'}`;

        for (const nota of visibles) {
            grid.append(tarjeta(nota));
        }
    }

    /**
     * @param {any} nota
     * @returns {HTMLElement}
     */
    function tarjeta(nota) {
        const card = document.createElement('article');
        card.className = 'note-card';
        card.dataset.notaId = String(nota.id);

        const head = document.createElement('div');
        head.className = 'note-card__head';

        const fecha = document.createElement('time');
        fecha.className = 'note-card__date';
        fecha.dateTime = String(nota.created_at ?? '');
        fecha.innerHTML = '<i class="bi bi-calendar3" aria-hidden="true"></i>';
        fecha.append(document.createTextNode(formatearFecha(nota.created_at)));

        const acciones = document.createElement('div');
        acciones.className = 'note-card__actions';

        const editar = iconButton('bi-pencil', 'Editar nota');
        editar.dataset.editar = String(nota.id);
        editar.addEventListener('click', () => abrirEditor(nota));

        const borrar = iconButton('bi-trash3', 'Eliminar nota', true);
        borrar.dataset.borrar = String(nota.id);
        borrar.addEventListener('click', () => abrirConfirmacion(nota));

        acciones.append(editar, borrar);
        head.append(fecha, acciones);

        const titulo = document.createElement('h3');
        titulo.className = 'note-card__title';
        titulo.textContent = String(nota.titulo ?? '');

        card.append(head, titulo);

        const contenido = String(nota.contenido ?? '').trim();

        if (contenido !== '') {
            const texto = document.createElement('p');
            texto.className = 'note-card__content';
            texto.textContent = contenido;
            card.append(texto);
        }

        const fotos = Array.isArray(nota.fotos) ? nota.fotos : [];

        if (fotos.length > 0) {
            card.append(galeria(fotos));
        }

        const pie = document.createElement('div');
        pie.className = 'note-card__foot';
        pie.innerHTML = '<i class="bi bi-clock" aria-hidden="true"></i>';
        pie.append(document.createTextNode(pieTexto(nota)));
        card.append(pie);

        return card;
    }

    /**
     * @param {Array<{id: number, ruta: string}>} fotos
     * @returns {HTMLElement}
     */
    function galeria(fotos) {
        const contenedor = document.createElement('div');
        contenedor.className = 'note-card__photos';

        const visibles = fotos.slice(0, 3);

        for (const foto of visibles) {
            const boton = document.createElement('button');
            boton.className = 'note-thumb';
            boton.type = 'button';
            boton.setAttribute('aria-label', 'Ver foto ampliada');

            const img = document.createElement('img');
            img.src = String(foto.ruta);
            img.alt = 'Foto de la nota';
            img.loading = 'lazy';
            boton.append(img);
            boton.addEventListener('click', () => abrirFoto(String(foto.ruta)));
            contenedor.append(boton);
        }

        if (fotos.length > visibles.length) {
            const mas = document.createElement('span');
            mas.className = 'note-thumb__more';
            mas.textContent = `+${fotos.length - visibles.length}`;
            mas.title = `${fotos.length} fotos`;
            contenedor.append(mas);
        }

        return contenedor;
    }

    /* Editor ------------------------------------------------------------ */

    function bindEditor() {
        root.querySelector('[data-nota-nueva]')?.addEventListener('click', () => abrirEditor(null));

        for (const cerrar of Array.from(modal.querySelectorAll('[data-nota-cerrar]'))) {
            cerrar.addEventListener('click', cerrarEditor);
        }

        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                cerrarEditor();
            }
        });

        form.addEventListener('submit', guardar);

        fileInput?.addEventListener('change', () => {
            if (!(fileInput instanceof HTMLInputElement)) {
                return;
            }

            void agregarArchivos(Array.from(fileInput.files ?? []));
            fileInput.value = '';
        });

        search?.addEventListener('input', render);
    }

    /**
     * @param {any|null} nota
     */
    function abrirEditor(nota) {
        editando = nota;
        fotosGuardadas = Array.isArray(nota?.fotos) ? nota.fotos.map((f) => ({ ...f })) : [];
        fotosNuevas = [];
        fotosBorrar.clear();

        form.reset();
        tituloInput.value = nota?.titulo ?? '';
        contenidoInput.value = nota?.contenido ?? '';
        formTitle.textContent = nota === null ? 'Nueva nota' : 'Editar nota';
        fechaHint.replaceChildren();

        const icono = document.createElement('i');
        icono.className = 'bi bi-calendar3';
        icono.setAttribute('aria-hidden', 'true');
        fechaHint.append(
            icono,
            document.createTextNode(
                nota === null
                    ? 'La fecha se guarda automáticamente.'
                    : `Creada el ${formatearFecha(nota.created_at)}`,
            ),
        );

        renderFotosEditor();
        clearMessage();
        modal.hidden = false;
        document.body.classList.add('notes-modal-open');
        tituloInput.focus();
    }

    function cerrarEditor() {
        modal.hidden = true;
        document.body.classList.remove('notes-modal-open');
        liberarNuevas();
        fotosNuevas = [];
        fotosGuardadas = [];
        fotosBorrar.clear();
        editando = null;
        clearMessage();
    }

    function liberarNuevas() {
        // Las previsualizaciones usan data URLs: no hay recursos que liberar.
    }

    /**
     * @param {File[]} archivos
     */
    async function agregarArchivos(archivos) {
        const errores = [];

        for (const archivo of archivos) {
            if (!MIME_PERMITIDOS.includes(archivo.type)) {
                errores.push(`${archivo.name}: formato no permitido.`);
                continue;
            }

            if (archivo.size > MAX_BYTES) {
                errores.push(`${archivo.name}: supera los 2 MB.`);
                continue;
            }

            if (totalFotos() >= maxFotos) {
                errores.push(`Cada nota admite como máximo ${maxFotos} fotos.`);
                break;
            }

            const url = await leerArchivo(archivo);

            if (url === null) {
                errores.push(`${archivo.name}: no se pudo leer.`);
                continue;
            }

            fotosNuevas.push({ file: archivo, url });
        }

        renderFotosEditor();

        if (errores.length > 0) {
            showMessage(errores[0]);
        } else {
            clearMessage();
        }
    }

    /**
     * Lee el archivo como data URL: la CSP permite data: pero no blob:.
     *
     * @param {File} archivo
     * @returns {Promise<string|null>}
     */
    function leerArchivo(archivo) {
        return new Promise((resolve) => {
            const lector = new FileReader();
            lector.onload = () => resolve(typeof lector.result === 'string' ? lector.result : null);
            lector.onerror = () => resolve(null);
            lector.readAsDataURL(archivo);
        });
    }

    function totalFotos() {
        return fotosGuardadas.length + fotosNuevas.length;
    }

    function renderFotosEditor() {
        preview.replaceChildren();

        for (const foto of fotosGuardadas) {
            preview.append(
                miniaturaEditor(String(foto.ruta), 'Guardada', () => {
                    fotosBorrar.add(foto.id);
                    fotosGuardadas = fotosGuardadas.filter((f) => f.id !== foto.id);
                    renderFotosEditor();
                }),
            );
        }

        if (hint instanceof HTMLElement) {
            const total = totalFotos();
            hint.textContent = total === 0
                ? `JPG, PNG o WebP · máximo 2 MB por foto.`
                : `${total} de ${maxFotos} fotos · máximo 2 MB cada una.`;
        }

        for (const foto of fotosNuevas) {
            preview.append(
                miniaturaEditor(foto.url, 'Nueva', () => {
                    fotosNuevas = fotosNuevas.filter((f) => f !== foto);
                    renderFotosEditor();
                }),
            );
        }
    }

    /**
     * @param {string} src
     * @param {string} badge
     * @param {() => void} onRemove
     * @returns {HTMLElement}
     */
    function miniaturaEditor(src, badge, onRemove) {
        const caja = document.createElement('div');
        caja.className = 'note-photo';

        const img = document.createElement('img');
        img.src = src;
        img.alt = 'Foto de la nota';
        caja.append(img);

        const etiqueta = document.createElement('span');
        etiqueta.className = 'note-photo__badge';
        etiqueta.textContent = badge;
        caja.append(etiqueta);

        const quitar = document.createElement('button');
        quitar.className = 'note-photo__remove';
        quitar.type = 'button';
        quitar.setAttribute('aria-label', 'Quitar foto');
        quitar.innerHTML = '<i class="bi bi-x-lg" aria-hidden="true"></i>';
        quitar.addEventListener('click', onRemove);
        caja.append(quitar);

        return caja;
    }

    /**
     * @param {SubmitEvent} event
     */
    async function guardar(event) {
        event.preventDefault();

        if (guardando) {
            return;
        }

        const titulo = tituloInput.value.trim();
        const contenido = contenidoInput.value.trim();

        if (titulo.length < 2) {
            showMessage('El título debe tener al menos 2 caracteres.');
            tituloInput.focus();

            return;
        }

        const borrar = [...fotosBorrar];
        const subir = [...fotosNuevas];
        const notaId = editando?.id ?? null;

        guardando = true;
        setBusy(true);
        clearMessage();

        try {
            const nota = notaId === null
                ? await fetchApi('/api/notas', { method: 'POST', body: { titulo, contenido } })
                : await fetchApi(`/api/notas/${notaId}`, { method: 'PUT', body: { titulo, contenido } });

            const id = Number(nota?.id ?? notaId);

            for (const fotoId of borrar) {
                try {
                    await fetchApi(`/api/notas/${id}/fotos/${fotoId}`, { method: 'DELETE' });
                } catch {
                    // La nota ya está guardada: seguimos con el resto de fotos.
                }
            }

            let fallidas = 0;

            for (const foto of subir) {
                const datos = new FormData();
                datos.set('foto', foto.file, foto.file.name);

                try {
                    await fetchApi(`/api/notas/${id}/fotos`, { method: 'POST', body: datos });
                } catch {
                    fallidas++;
                }
            }

            cerrarEditor();
            await load();

            if (fallidas > 0) {
                showToast(`Nota guardada, pero ${fallidas} foto(s) no se pudieron subir.`, 'info');
            } else {
                showToast('Nota guardada.', 'success');
            }
        } catch (error) {
            if (!redirectIfSessionLost(error)) {
                showMessage(mensajeError(error));
            }
        } finally {
            guardando = false;
            setBusy(false);
        }
    }

    /**
     * @param {boolean} busy
     */
    function setBusy(busy) {
        if (submitButton instanceof HTMLButtonElement) {
            submitButton.disabled = busy;
            submitButton.textContent = busy ? 'Guardando…' : 'Guardar nota';
        }

        for (const control of Array.from(form.querySelectorAll('input, textarea'))) {
            if (control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement) {
                control.disabled = busy;
            }
        }
    }

    /* Borrado ----------------------------------------------------------- */

    function bindDeleteModal() {
        deleteModal?.querySelector('[data-borrar-cancelar]')?.addEventListener('click', cerrarConfirmacion);

        deleteModal?.addEventListener('click', (event) => {
            if (event.target === deleteModal) {
                cerrarConfirmacion();
            }
        });

        deleteConfirm?.addEventListener('click', confirmarBorrado);
    }

    /**
     * @param {any} nota
     */
    function abrirConfirmacion(nota) {
        borrarId = Number(nota.id);

        if (deleteName instanceof HTMLElement) {
            deleteName.textContent = `«${nota.titulo}»`;
        }

        deleteModal.hidden = false;
        deleteConfirm?.focus();
    }

    function cerrarConfirmacion() {
        deleteModal.hidden = true;
        borrarId = null;
    }

    async function confirmarBorrado() {
        if (borrarId === null || !(deleteConfirm instanceof HTMLButtonElement)) {
            return;
        }

        const id = borrarId;
        deleteConfirm.disabled = true;
        deleteConfirm.textContent = 'Eliminando…';

        try {
            await fetchApi(`/api/notas/${id}`, { method: 'DELETE' });
            cerrarConfirmacion();
            await load();
            showToast('Nota eliminada.', 'success');
        } catch (error) {
            if (!redirectIfSessionLost(error)) {
                showToast(error?.message ?? 'No se pudo eliminar la nota.', 'error');
            }
        } finally {
            deleteConfirm.disabled = false;
            deleteConfirm.textContent = 'Eliminar';
        }
    }

    /* Lightbox ---------------------------------------------------------- */

    function bindPhotoModal() {
        photoModal?.querySelector('[data-foto-cerrar]')?.addEventListener('click', cerrarFoto);

        photoModal?.addEventListener('click', (event) => {
            if (event.target === photoModal) {
                cerrarFoto();
            }
        });

        document.addEventListener('keydown', (event) => {
            if (event.key !== 'Escape') {
                return;
            }

            if (photoModal instanceof HTMLElement && !photoModal.hidden) {
                cerrarFoto();
            } else if (deleteModal instanceof HTMLElement && !deleteModal.hidden) {
                cerrarConfirmacion();
            } else if (!modal.hidden) {
                cerrarEditor();
            }
        });
    }

    /**
     * @param {string} ruta
     */
    function abrirFoto(ruta) {
        if (!(photoLarge instanceof HTMLImageElement) || !(photoModal instanceof HTMLElement)) {
            return;
        }

        photoLarge.src = ruta;
        photoModal.hidden = false;
    }

    function cerrarFoto() {
        if (!(photoModal instanceof HTMLElement)) {
            return;
        }

        photoModal.hidden = true;

        if (photoLarge instanceof HTMLImageElement) {
            photoLarge.removeAttribute('src');
        }
    }

    /* Utilidades -------------------------------------------------------- */

    /**
     * @param {string} icono
     * @param {string} label
     * @param {boolean} [peligro]
     * @returns {HTMLButtonElement}
     */
    function iconButton(icono, label, peligro = false) {
        const boton = document.createElement('button');
        boton.type = 'button';
        boton.className = peligro ? 'note-icon-btn note-icon-btn--danger' : 'note-icon-btn';
        boton.title = label;
        boton.setAttribute('aria-label', label);
        boton.innerHTML = `<i class="bi ${icono}" aria-hidden="true"></i>`;

        return boton;
    }

    /**
     * @param {string|null|undefined} iso
     * @returns {string}
     */
    function formatearFecha(iso) {
        if (typeof iso !== 'string' || iso === '') {
            return '';
        }

        const fecha = new Date(iso);

        if (Number.isNaN(fecha.getTime())) {
            return '';
        }

        return `${formatoFecha.format(fecha)} · ${formatoHora.format(fecha)}`;
    }

    /**
     * @param {any} nota
     * @returns {string}
     */
    function pieTexto(nota) {
        if (nota.updated_at && nota.updated_at !== nota.created_at && nota.updated_at !== null) {
            return `Editada el ${formatearFecha(nota.updated_at)}`;
        }

        const fotos = Array.isArray(nota.fotos) ? nota.fotos.length : 0;

        return fotos > 0
            ? `${fotos} ${fotos === 1 ? 'foto' : 'fotos'}`
            : 'Sin fotos';
    }

    /**
     * @param {string} texto
     * @returns {string}
     */
    function normalizar(texto) {
        return String(texto ?? '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
    }

    /**
     * @param {any} error
     * @returns {string}
     */
    function mensajeError(error) {
        const errores = error?.data;

        if (errores && typeof errores === 'object') {
            const primero = Object.values(errores)[0];

            if (typeof primero === 'string') {
                return primero;
            }
        }

        return error?.message ?? 'No se pudo guardar la nota.';
    }

    /**
     * @param {string} texto
     */
    function showMessage(texto) {
        if (message instanceof HTMLElement) {
            message.textContent = texto;
            message.dataset.type = 'error';
            message.hidden = false;
        }
    }

    function clearMessage() {
        if (message instanceof HTMLElement) {
            message.hidden = true;
            message.textContent = '';
        }
    }

    function bindLogout() {
        const logout = document.querySelector('[data-logout]');

        logout?.addEventListener('click', async () => {
            if (logout instanceof HTMLButtonElement) {
                logout.disabled = true;
            }

            try {
                await fetchApi('/api/auth/logout', { method: 'POST' });
            } catch {
                // Si la sesión ya expiró, igualmente volvemos al login.
            }

            window.location.replace('/login');
        });
    }

    /**
     * @param {any} error
     * @returns {boolean}
     */
    function redirectIfSessionLost(error) {
        if (error?.status === 401) {
            window.location.replace('/login');

            return true;
        }

        return false;
    }
}
