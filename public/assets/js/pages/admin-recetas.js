/**
 * Admin · Recetas: listado, filtros, publicación y borrado.
 */

import { fetchApi } from '../modules/api.js';
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

    if (!(body instanceof HTMLElement)) {
        return;
    }

    /** @type {Array<any>} */
    let items = [];

    buscar?.addEventListener('input', render);
    estado?.addEventListener('change', render);
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
        status.textContent = `${items.length} recetas · ${pendientes} pendientes`;
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
            cell.colSpan = 6;
            cell.className = 'text-center text-muted py-4';
            cell.textContent = 'No hay recetas que coincidan.';
            row.append(cell);
            body.append(row);

            return;
        }

        for (const item of visibles) {
            body.append(crearFila(item));
        }
    }

    /**
     * @param {any} item
     * @returns {HTMLTableRowElement}
     */
    function crearFila(item) {
        const row = document.createElement('tr');

        const nombre = document.createElement('td');
        const titulo = document.createElement('strong');
        titulo.textContent = String(item.nombre ?? '');
        const slug = document.createElement('p');
        slug.className = 'text-muted small mb-0';
        slug.textContent = String(item.slug ?? '');
        nombre.append(titulo, slug);

        const categoria = document.createElement('td');
        const categoriaBadge = document.createElement('span');
        categoriaBadge.className = 'badge text-bg-success';
        categoriaBadge.textContent = item.categoria
            ? String(item.categoria.nombre ?? '')
            : 'Sin categoría';
        categoria.append(categoriaBadge);

        const tipos = document.createElement('td');
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
        autor.className = 'text-muted small';
        autor.textContent = item.creador_nombre ? String(item.creador_nombre) : 'Sistema';

        const video = document.createElement('td');
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
        acciones.className = 'text-end';
        const grupo = document.createElement('div');
        grupo.className = 'admin-actions d-flex flex-wrap justify-content-end gap-2';

        if (item.estado !== 'publicada') {
            const publicar = document.createElement('button');
            publicar.type = 'button';
            publicar.className = 'btn btn-sm btn-outline-success';
            publicar.innerHTML = '<i class="bi bi-check2-circle" aria-hidden="true"></i> Publicar';
            publicar.addEventListener('click', () => publicarReceta(item, publicar));
            grupo.append(publicar);
        }

        const editar = document.createElement('a');
        editar.className = 'btn btn-sm btn-outline-primary';
        editar.href = `/admin/recetas/${Number(item.id)}`;
        editar.innerHTML = '<i class="bi bi-pencil" aria-hidden="true"></i> Editar';

        const eliminar = document.createElement('button');
        eliminar.type = 'button';
        eliminar.className = 'btn btn-sm btn-outline-danger';
        eliminar.innerHTML = '<i class="bi bi-trash3" aria-hidden="true"></i> Eliminar';
        eliminar.addEventListener('click', () => eliminarReceta(item, eliminar));

        grupo.append(editar, eliminar);
        acciones.append(grupo);

        row.append(nombre, categoria, tipos, estadoCell, autor, video, acciones);

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

        if (!window.confirm(`¿Eliminar la receta "${item.nombre}"? Esta acción no se puede deshacer.`)) {
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
