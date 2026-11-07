/**
 * Admin · Recetas: listado, filtros, publicación y borrado.
 */

import { fetchApi } from '../modules/api.js';
import { confirmar } from '../modules/confirm.js';
import { showToast } from '../modules/toast.js';

const root = document.querySelector('[data-admin-recetas]');

if (root instanceof HTMLElement) {
    init(root);
}

/**
 * @param {HTMLElement} root
 */
function init(root) {
    const body = root.querySelector('[data-admin-recetas-body]');
    const status = root.querySelector('[data-admin-receta-status]');
    const buscar = root.querySelector('[data-admin-receta-buscar]');
    const estado = root.querySelector('[data-admin-receta-estado]');
    const mensaje = root.querySelector('[data-admin-receta-mensaje]');
    const seleccionarTodos = root.querySelector('[data-admin-receta-seleccionar-todos]');
    const publicarLote = root.querySelector('[data-admin-receta-publicar-lote]');
    const seleccionadasTexto = root.querySelector('[data-admin-receta-seleccionadas]');

    if (!(body instanceof HTMLElement)) {
        return;
    }

    /** @type {Array<any>} */
    let items = [];
    /** @type {Array<any>} */
    let visiblesActuales = [];
    const seleccionadas = new Set();
    let publicando = false;

    buscar?.addEventListener('input', render);
    estado?.addEventListener('change', render);
    seleccionarTodos?.addEventListener('change', alternarTodas);
    publicarLote?.addEventListener('click', publicarSeleccionadas);
    load();

    async function load() {
        if (status instanceof HTMLElement) {
            status.textContent = 'Cargando recetas…';
        }

        try {
            const data = await fetchApi('/api/admin/recetas');
            items = Array.isArray(data?.items) ? data.items : [];
            render();
            actualizarStatus();
        } catch (error) {
            if (redirectIfSessionLost(error)) {
                return;
            }

            if (status instanceof HTMLElement) {
                status.textContent = 'No se pudieron cargar las recetas.';
            }

            showToast(error?.message ?? 'No se pudieron cargar las recetas.', 'error');
        }
    }

    function actualizarStatus() {
        if (!(status instanceof HTMLElement)) {
            return;
        }

        const pendientes = items.filter((item) => item.estado === 'pendiente').length;
        const borradores = items.filter((item) => item.estado === 'borrador').length;
        status.textContent = `${items.length} recetas · ${pendientes} pendientes · ${borradores} borradores`;
    }

    function render() {
        const consulta = (buscar instanceof HTMLInputElement ? buscar.value : '').trim().toLowerCase();
        const filtroEstado = estado instanceof HTMLSelectElement ? estado.value : '';
        const visibles = items.filter((item) => {
            const coincideNombre = consulta === ''
                || String(item.nombre ?? '').toLowerCase().includes(consulta);
            const coincideEstado = filtroEstado === '' || String(item.estado) === filtroEstado;

            return coincideNombre && coincideEstado;
        });

        body.replaceChildren();

        if (visibles.length === 0) {
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            cell.colSpan = 8;
            cell.className = 'text-center text-muted py-4';
            cell.textContent = 'No hay recetas que coincidan.';
            row.append(cell);
            body.append(row);
            visiblesActuales = visibles;
            actualizarSeleccion();

            return;
        }

        for (const item of visibles) {
            body.append(crearFila(item));
        }

        visiblesActuales = visibles;
        actualizarSeleccion();
    }

    /**
     * Selecciona o deselecciona todas las recetas visibles que no están publicadas.
     */
    function alternarTodas() {
        const seleccionables = visiblesActuales.filter((item) => item.estado !== 'publicada');
        const todasMarcadas = seleccionables.length > 0
            && seleccionables.every((item) => seleccionadas.has(Number(item.id)));

        for (const item of seleccionables) {
            const id = Number(item.id);

            if (todasMarcadas) {
                seleccionadas.delete(id);
            } else {
                seleccionadas.add(id);
            }
        }

        render();
    }

    /**
     * Sincroniza contador, botón y checkbox de encabezado con la selección actual.
     */
    function actualizarSeleccion() {
        const seleccionables = new Set(
            items
                .filter((item) => item.estado !== 'publicada')
                .map((item) => Number(item.id)),
        );

        for (const id of [...seleccionadas]) {
            if (!seleccionables.has(id)) {
                seleccionadas.delete(id);
            }
        }

        const total = seleccionadas.size;

        if (seleccionadasTexto instanceof HTMLElement) {
            seleccionadasTexto.textContent = `${total} ${total === 1 ? 'seleccionada' : 'seleccionadas'}`;
        }

        if (publicarLote instanceof HTMLButtonElement) {
            publicarLote.disabled = publicando || total === 0;

            if (!publicando) {
                publicarLote.innerHTML = '<i class="bi bi-check2-circle" aria-hidden="true"></i> Publicar seleccionadas';
            }
        }

        if (seleccionarTodos instanceof HTMLInputElement) {
            const visiblesSeleccionables = visiblesActuales.filter((item) => item.estado !== 'publicada');
            const marcadas = visiblesSeleccionables.filter((item) => seleccionadas.has(Number(item.id))).length;

            seleccionarTodos.disabled = visiblesSeleccionables.length === 0;
            seleccionarTodos.checked = visiblesSeleccionables.length > 0
                && marcadas === visiblesSeleccionables.length;
            seleccionarTodos.indeterminate = marcadas > 0 && marcadas < visiblesSeleccionables.length;
        }
    }

    async function publicarSeleccionadas() {
        if (!(publicarLote instanceof HTMLButtonElement) || seleccionadas.size === 0) {
            return;
        }

        const ids = [...seleccionadas];
        const confirmado = await confirmar({
            title: 'Publicar recetas',
            message: `Se publicarán ${ids.length} ${ids.length === 1 ? 'receta' : 'recetas'}. Quedarán visibles en el recetario.`,
            confirmText: 'Publicar',
            tone: 'primary',
        });

        if (!confirmado) {
            return;
        }

        publicando = true;
        publicarLote.disabled = true;
        publicarLote.innerHTML = '<span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span> Publicando…';

        try {
            const data = await fetchApi('/api/admin/recetas/publicar-seleccionadas', {
                method: 'POST',
                body: { ids },
            });
            const publicadas = Number(data?.publicadas ?? ids.length);
            const seleccionIds = new Set(ids);
            items = items.map((item) => (
                seleccionIds.has(Number(item.id)) ? { ...item, estado: 'publicada' } : item
            ));
            seleccionadas.clear();
            showToast(
                `${publicadas} ${publicadas === 1 ? 'receta publicada' : 'recetas publicadas'}.`,
                'success',
            );
        } catch (error) {
            if (redirectIfSessionLost(error)) {
                return;
            }

            showToast(error?.message ?? 'No se pudieron publicar las recetas.', 'error');
        } finally {
            publicando = false;
            render();
            actualizarStatus();
        }
    }

    /**
     * @param {any} item
     * @returns {HTMLTableRowElement}
     */
    function crearFila(item) {
        const row = document.createElement('tr');
        const id = Number(item.id);

        const seleccion = document.createElement('td');
        seleccion.className = 'text-center';

        if (item.estado !== 'publicada') {
            const check = document.createElement('input');
            check.type = 'checkbox';
            check.className = 'form-check-input';
            check.checked = seleccionadas.has(id);
            check.setAttribute('aria-label', `Seleccionar ${String(item.nombre ?? 'receta')}`);
            check.addEventListener('change', () => {
                if (check.checked) {
                    seleccionadas.add(id);
                } else {
                    seleccionadas.delete(id);
                }

                actualizarSeleccion();
            });
            seleccion.append(check);
        }

        const nombre = document.createElement('td');
        const titulo = document.createElement('strong');
        titulo.textContent = String(item.nombre ?? '');
        const slug = document.createElement('p');
        slug.className = 'text-muted small mb-0';
        slug.textContent = String(item.slug ?? '');
        nombre.append(titulo, slug);

        if (item.referencia) {
            const referencia = document.createElement('span');
            referencia.className = 'badge text-bg-warning mt-1';
            referencia.textContent = 'Referencia';
            referencia.title = item.fuente_nombre
                ? `Fuente: ${String(item.fuente_nombre)}`
                : 'Receta de referencia externa';
            nombre.append(referencia);
        }

        const categoria = document.createElement('td');
        categoria.className = 'd-none d-md-table-cell';
        const categoriaBadge = document.createElement('span');
        categoriaBadge.className = 'badge text-bg-success';
        categoriaBadge.textContent = item.categoria
            ? String(item.categoria.nombre ?? '')
            : 'Sin categoría';
        categoria.append(categoriaBadge);

        const tipos = document.createElement('td');
        tipos.className = 'd-none d-lg-table-cell';
        const badges = document.createElement('div');
        badges.className = 'd-flex flex-wrap gap-1';
        for (const tipo of (Array.isArray(item.tipos_nombres) ? item.tipos_nombres : [])) {
            const badge = document.createElement('span');
            badge.className = 'badge text-bg-light';
            badge.textContent = String(tipo);
            badges.append(badge);
        }
        tipos.append(badges);

        const estadoCell = document.createElement('td');
        const estadoBadge = document.createElement('span');
        estadoBadge.className = `badge ${badgeEstado(item.estado)}`;
        estadoBadge.textContent = etiquetaEstado(String(item.estado));
        estadoCell.append(estadoBadge);

        const autor = document.createElement('td');
        autor.className = 'text-muted small d-none d-lg-table-cell';
        autor.textContent = item.creador_nombre ? String(item.creador_nombre) : 'Sistema';

        const video = document.createElement('td');
        video.className = 'd-none d-lg-table-cell';
        if (item.video?.thumbnail_url) {
            const img = document.createElement('img');
            img.src = String(item.video.thumbnail_url);
            img.alt = '';
            img.loading = 'lazy';
            img.className = 'thumb';
            video.append(img);
        } else {
            const span = document.createElement('span');
            span.className = 'text-muted small';
            span.textContent = 'Sin video';
            video.append(span);
        }

        const acciones = document.createElement('td');
        acciones.className = 'text-end admin-actions';
        const grupo = document.createElement('div');
        grupo.className = 'admin-actions d-flex flex-wrap justify-content-end gap-2';

        if (item.estado !== 'publicada') {
            const publicar = document.createElement('button');
            publicar.type = 'button';
            publicar.className = 'btn btn-sm btn-outline-success';
            publicar.setAttribute('aria-label', `Publicar ${String(item.nombre ?? 'receta')}`);
            publicar.innerHTML = '<i class="bi bi-check2-circle" aria-hidden="true"></i> <span class="btn-label">Publicar</span>';
            publicar.addEventListener('click', () => publicarReceta(item, publicar));
            grupo.append(publicar);
        }

        const editar = document.createElement('a');
        editar.className = 'btn btn-sm btn-outline-primary';
        editar.href = `/admin/recetas/${Number(item.id)}`;
        editar.setAttribute('aria-label', `Editar ${String(item.nombre ?? 'receta')}`);
        editar.innerHTML = '<i class="bi bi-pencil" aria-hidden="true"></i> <span class="btn-label">Editar</span>';

        const eliminar = document.createElement('button');
        eliminar.type = 'button';
        eliminar.className = 'btn btn-sm btn-outline-danger';
        eliminar.setAttribute('aria-label', `Eliminar ${String(item.nombre ?? 'receta')}`);
        eliminar.innerHTML = '<i class="bi bi-trash3" aria-hidden="true"></i> <span class="btn-label">Eliminar</span>';
        eliminar.addEventListener('click', () => eliminarReceta(item, eliminar));

        grupo.append(editar, eliminar);
        acciones.append(grupo);

        row.append(seleccion, nombre, categoria, tipos, estadoCell, autor, video, acciones);

        return row;
    }

    async function publicarReceta(item, button) {
        if (!(button instanceof HTMLButtonElement)) {
            return;
        }

        button.disabled = true;
        button.textContent = 'Publicando…';

        try {
            await fetchApi(`/api/admin/recetas/${Number(item.id)}/publicar`, { method: 'POST' });
            item.estado = 'publicada';
            render();
            actualizarStatus();
            showToast('Receta publicada.', 'success');
        } catch (error) {
            if (redirectIfSessionLost(error)) {
                return;
            }

            showToast(error?.message ?? 'No se pudo publicar la receta.', 'error');
            button.disabled = false;
            button.innerHTML = '<i class="bi bi-check2-circle" aria-hidden="true"></i> Publicar';
        }
    }

    async function eliminarReceta(item, button) {
        if (!(button instanceof HTMLButtonElement)) {
            return;
        }

        const confirmado = await confirmar({
            title: 'Eliminar receta',
            message: `Se eliminará «${item.nombre}». Esta acción no se puede deshacer.`,
            confirmText: 'Eliminar receta',
        });

        if (!confirmado) {
            return;
        }

        button.disabled = true;
        button.textContent = 'Eliminando…';

        try {
            await fetchApi(`/api/admin/recetas/${Number(item.id)}`, { method: 'DELETE' });
            items = items.filter((fila) => Number(fila.id) !== Number(item.id));
            render();
            actualizarStatus();
            showToast('Receta eliminada.', 'info');
        } catch (error) {
            if (redirectIfSessionLost(error)) {
                return;
            }

            showToast(error?.message ?? 'No se pudo eliminar la receta.', 'error');
            button.disabled = false;
            button.innerHTML = '<i class="bi bi-trash3" aria-hidden="true"></i> Eliminar';
        }
    }

    function etiquetaEstado(valor) {
        return {
            publicada: 'Publicada',
            pendiente: 'Pendiente',
            borrador: 'Borrador',
        }[valor] ?? valor;
    }

    function badgeEstado(valor) {
        return {
            publicada: 'text-bg-success',
            pendiente: 'text-bg-warning',
            borrador: 'text-bg-secondary',
        }[valor] ?? 'text-bg-light';
    }

    function mostrarMensaje(texto) {
        if (mensaje instanceof HTMLElement) {
            mensaje.textContent = texto;
            mensaje.hidden = false;
        }
    }

    function ocultarMensaje() {
        if (mensaje instanceof HTMLElement) {
            mensaje.textContent = '';
            mensaje.hidden = true;
        }
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
