/**
 * Productos por comprar: varias listas, CRUD de ítems y envío al carrito.
 */

import { fetchApi } from '../modules/api.js';
import { confirmar } from '../modules/confirm.js';
import { formatQuantity } from '../modules/format.js';
import { showToast } from '../modules/toast.js';

const root = document.querySelector('[data-lista-compras]');

if (root instanceof HTMLElement) {
    init(root);
}

/**
 * @param {HTMLElement} root
 */
function init(root) {
    const el = {
        select: root.querySelector('[data-listas-select]'),
        nombre: root.querySelector('[data-lista-nombre]'),
        items: root.querySelector('[data-lista-items]'),
        empty: root.querySelector('[data-lista-empty]'),
        sinListas: root.querySelector('[data-lista-sin-listas]'),
        status: root.querySelector('[data-lista-status]'),
        enviar: root.querySelector('[data-lista-enviar]'),
        vaciar: root.querySelector('[data-lista-vaciar]'),
        nueva: root.querySelector('[data-lista-nueva]'),
        renombrar: root.querySelector('[data-lista-renombrar]'),
        eliminar: root.querySelector('[data-lista-eliminar]'),
        form: root.querySelector('[data-lista-form]'),
        productName: root.querySelector('[data-lista-nombre-producto]'),
        cantidad: root.querySelector('[data-lista-cantidad]'),
        unidad: root.querySelector('[data-lista-unidad]'),
        mensaje: root.querySelector('[data-lista-mensaje]'),
        agregar: root.querySelector('[data-lista-agregar]'),
        modal: document.querySelector('[data-lista-modal]'),
        modalForm: document.querySelector('[data-lista-modal-form]'),
        modalTitle: document.querySelector('[data-lista-modal-title]'),
        modalId: document.querySelector('[data-lista-modal-id]'),
        modalNombre: document.querySelector('[data-lista-modal-nombre]'),
        modalMensaje: document.querySelector('[data-lista-modal-mensaje]'),
        modalGuardar: document.querySelector('[data-lista-modal-guardar]'),
    };

    const bootstrap = window.bootstrap;
    const modal = bootstrap?.Modal && el.modal instanceof HTMLElement
        ? bootstrap.Modal.getOrCreateInstance(el.modal)
        : null;

    /** @type {Array<any>} */
    let listas = [];
    /** @type {Array<any>} */
    let items = [];
    let listaActual = 0;

    const initialId = Number(new URLSearchParams(window.location.search).get('id') ?? 0);

    bind();
    cargarListas(initialId > 0 ? initialId : null);
    showQueryToast();

    function bind() {
        el.select?.addEventListener('change', () => {
            const id = Number(el.select instanceof HTMLSelectElement ? el.select.value : 0);

            if (id > 0 && id !== listaActual) {
                listaActual = id;
                cargarItems(id);
            }
        });

        el.form?.addEventListener('submit', agregarManual);
        el.enviar?.addEventListener('click', enviarLista);
        el.vaciar?.addEventListener('click', vaciarLista);
        el.nueva?.addEventListener('click', () => abrirModalLista(null));
        el.renombrar?.addEventListener('click', () => {
            const lista = listas.find((fila) => Number(fila.id) === listaActual);

            if (lista !== undefined) {
                abrirModalLista(lista);
            }
        });
        el.eliminar?.addEventListener('click', eliminarLista);
        el.modalForm?.addEventListener('submit', guardarLista);
    }

    async function cargarListas(preferida = null) {
        if (el.status instanceof HTMLElement) {
            el.status.textContent = 'Cargando listas…';
        }

        try {
            const data = await fetchApi('/api/listas-compra');
            listas = Array.isArray(data?.items) ? data.items : [];
            renderSelect(preferida);

            if (listas.length === 0) {
                listaActual = 0;
                items = [];
                render();
                return;
            }

            const objetivo = Number(preferida ?? 0);
            const id = listas.some((fila) => Number(fila.id) === objetivo)
                ? objetivo
                : Number(listas[0].id);
            listaActual = id;

            if (el.select instanceof HTMLSelectElement) {
                el.select.value = String(id);
            }

            await cargarItems(id);
        } catch (error) {
            if (redirectIfSessionLost(error)) {
                return;
            }

            if (el.status instanceof HTMLElement) {
                el.status.textContent = 'No se pudieron cargar las listas.';
            }

            showToast(error?.message ?? 'No se pudieron cargar las listas.', 'error');
        }
    }

    function renderSelect(preferida = null) {
        if (!(el.select instanceof HTMLSelectElement)) {
            return;
        }

        el.select.replaceChildren();

        for (const lista of listas) {
            const option = document.createElement('option');
            option.value = String(lista.id);
            option.textContent = `${lista.nombre} (${Number(lista.items_count ?? 0)})`;
            option.title = `${lista.nombre} · ${Number(lista.items_count ?? 0)} productos`;
            option.selected = Number(lista.id) === Number(preferida ?? listaActual);
            el.select.append(option);
        }

        const vacio = listas.length === 0;
        el.select.disabled = vacio;

        if (el.sinListas instanceof HTMLElement) {
            el.sinListas.hidden = !vacio;
        }

        for (const button of [el.enviar, el.renombrar, el.eliminar, el.vaciar, el.agregar]) {
            if (button instanceof HTMLButtonElement) {
                button.disabled = vacio;
            }
        }

        if (el.nombre instanceof HTMLElement) {
            el.nombre.textContent = vacio ? 'Sin listas' : 'Lista seleccionada';
        }
    }

    async function cargarItems(id) {
        if (el.status instanceof HTMLElement) {
            el.status.textContent = 'Cargando productos…';
        }

        try {
            const data = await fetchApi(`/api/listas-compra/${id}`);
            items = Array.isArray(data?.items) ? data.items : [];

            if (el.nombre instanceof HTMLElement) {
                el.nombre.textContent = String(data?.lista?.nombre ?? 'Lista');
            }

            const params = new URLSearchParams(window.location.search);
            params.set('id', String(id));
            window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);

            render();
        } catch (error) {
            if (redirectIfSessionLost(error)) {
                return;
            }

            if (el.status instanceof HTMLElement) {
                el.status.textContent = 'No se pudo cargar la lista.';
            }

            showToast(error?.message ?? 'No se pudo cargar la lista.', 'error');
        }
    }

    function render() {
        if (!(el.items instanceof HTMLElement)) {
            return;
        }

        el.items.replaceChildren();

        if (items.length === 0) {
            if (el.empty instanceof HTMLElement) {
                el.empty.hidden = false;
            }

            if (el.status instanceof HTMLElement) {
                el.status.textContent = 'Sin productos';
            }

            return;
        }

        if (el.empty instanceof HTMLElement) {
            el.empty.hidden = true;
        }

        for (const item of items) {
            el.items.append(crearItem(item));
        }

        if (el.status instanceof HTMLElement) {
            el.status.textContent = `${items.length} ${items.length === 1 ? 'producto' : 'productos'}`;
        }
    }

    /**
     * @param {any} item
     * @returns {HTMLElement}
     */
    function crearItem(item) {
        const row = document.createElement('article');
        row.className = `lista-item is-${String(item.estado ?? 'pendiente')}`;

        const avatar = document.createElement('span');
        avatar.className = 'lista-item__avatar';
        const icon = document.createElement('i');
        icon.className = `bi ${item.categoria_nombre ? 'bi-basket' : 'bi-tag'}`;
        icon.setAttribute('aria-hidden', 'true');
        avatar.append(icon);

        const body = document.createElement('div');
        body.className = 'lista-item__body';

        const name = document.createElement('p');
        name.className = 'lista-item__name';
        name.textContent = String(item.nombre ?? 'Producto');

        const meta = document.createElement('div');
        meta.className = 'lista-item__meta';

        const badge = document.createElement('span');
        badge.className = `lista-item__badge lista-item__badge--${String(item.estado ?? 'pendiente')}`;
        badge.textContent = etiquetaEstado(String(item.estado ?? 'pendiente'));
        meta.append(badge);

        if (item.origen) {
            const origen = document.createElement('span');
            origen.className = 'lista-item__origen';
            origen.textContent = String(item.origen);
            meta.append(origen);
        }

        body.append(name, meta);

        const controls = document.createElement('div');
        controls.className = 'lista-item__controls';

        const cantidadField = document.createElement('div');
        cantidadField.className = 'lista-item__field';
        const cantidadLabel = document.createElement('label');
        cantidadLabel.textContent = 'Cantidad';
        const cantidadInput = document.createElement('input');
        cantidadInput.type = 'number';
        cantidadInput.className = 'form-control form-control-sm';
        cantidadInput.min = '0.001';
        cantidadInput.step = '0.001';
        cantidadInput.inputMode = 'decimal';
        cantidadInput.value = String(Number(item.cantidad ?? 1));
        cantidadInput.setAttribute('aria-label', `Cantidad de ${item.nombre}`);
        cantidadField.append(cantidadLabel, cantidadInput);

        const unidadField = document.createElement('div');
        unidadField.className = 'lista-item__field';
        const unidadLabel = document.createElement('label');
        unidadLabel.textContent = 'Unidad';
        const unidadSelect = document.createElement('select');
        unidadSelect.className = 'form-select form-select-sm';
        unidadSelect.setAttribute('aria-label', `Unidad de ${item.nombre}`);
        ['pza', 'kg', 'gr', 'L', 'ml'].forEach((unidad) => {
            const option = document.createElement('option');
            option.value = unidad;
            option.textContent = unidad;
            option.selected = unidad === item.unidad_base;
            unidadSelect.append(option);
        });
        unidadField.append(unidadLabel, unidadSelect);

        const guardar = async () => {
            const cantidad = Number(cantidadInput.value);

            if (!Number.isFinite(cantidad) || cantidad <= 0) {
                showToast('La cantidad debe ser mayor que 0.', 'error');
                cantidadInput.value = String(Number(item.cantidad ?? 1));

                return;
            }

            try {
                const actualizado = await fetchApi(`/api/listas-compra/items/${Number(item.id)}`, {
                    method: 'PUT',
                    body: { cantidad, unidad_base: unidadSelect.value },
                });

                const index = items.findIndex((fila) => Number(fila.id) === Number(item.id));

                if (index !== -1) {
                    items[index] = actualizado;
                }

                showToast('Producto actualizado.', 'success');
            } catch (error) {
                if (redirectIfSessionLost(error)) {
                    return;
                }

                showToast(error?.message ?? 'No se pudo actualizar.', 'error');
                cargarItems(listaActual);
            }
        };

        cantidadInput.addEventListener('change', guardar);
        unidadSelect.addEventListener('change', guardar);

        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'lista-item__remove';
        remove.setAttribute('aria-label', `Eliminar ${item.nombre}`);
        remove.innerHTML = '<i class="bi bi-trash3" aria-hidden="true"></i>';
        remove.addEventListener('click', async () => {
            const confirmado = await confirmar({
                title: 'Quitar de la lista',
                message: `«${item.nombre}» se eliminará de esta lista.`,
                confirmText: 'Quitar',
            });

            if (!confirmado) {
                return;
            }

            try {
                await fetchApi(`/api/listas-compra/items/${Number(item.id)}`, { method: 'DELETE' });
                items = items.filter((fila) => Number(fila.id) !== Number(item.id));
                render();
                showToast('Producto eliminado.', 'info');
            } catch (error) {
                if (redirectIfSessionLost(error)) {
                    return;
                }

                showToast(error?.message ?? 'No se pudo eliminar.', 'error');
            }
        });

        controls.append(cantidadField, unidadField, remove);
        row.append(avatar, body, controls);

        return row;
    }

    async function agregarManual(event) {
        event.preventDefault();

        if (listaActual <= 0) {
            showToast('Crea o selecciona una lista primero.', 'error');

            return;
        }

        if (!(el.productName instanceof HTMLInputElement) || !(el.cantidad instanceof HTMLInputElement) || !(el.unidad instanceof HTMLSelectElement)) {
            return;
        }

        const nombre = el.productName.value.trim();
        const cantidad = Number(el.cantidad.value);

        if (nombre === '') {
            mostrarMensaje('Escribe el nombre del producto.');

            return;
        }

        if (!Number.isFinite(cantidad) || cantidad <= 0) {
            mostrarMensaje('La cantidad debe ser mayor que 0.');

            return;
        }

        if (el.agregar instanceof HTMLButtonElement) {
            el.agregar.disabled = true;
            el.agregar.textContent = 'Agregando…';
        }

        try {
            const data = await fetchApi(`/api/listas-compra/${listaActual}/items`, {
                method: 'POST',
                body: {
                    nombre,
                    cantidad,
                    unidad_base: el.unidad.value,
                },
            });

            items = Array.isArray(data?.items) ? data.items : items;
            el.productName.value = '';
            el.cantidad.value = '1';
            el.unidad.value = 'pza';
            ocultarMensaje();
            render();
            showToast('Producto agregado a la lista.', 'success');
        } catch (error) {
            if (redirectIfSessionLost(error)) {
                return;
            }

            mostrarMensaje(error?.message ?? 'No se pudo agregar el producto.');
        } finally {
            if (el.agregar instanceof HTMLButtonElement) {
                el.agregar.disabled = false;
                el.agregar.innerHTML = '<i class="bi bi-plus-lg" aria-hidden="true"></i> Agregar a la lista';
            }
        }
    }

    async function enviarLista() {
        if (listaActual <= 0 || !(el.enviar instanceof HTMLButtonElement)) {
            return;
        }

        el.enviar.disabled = true;
        const texto = el.enviar.innerHTML;
        el.enviar.textContent = 'Enviando…';

        try {
            const data = await fetchApi(`/api/listas-compra/${listaActual}/enviar`, { method: 'POST' });
            const enviados = Number(data?.enviados ?? 0);

            if (enviados === 0) {
                showToast('No hay productos pendientes en esta lista.', 'info');
                el.enviar.disabled = false;
                el.enviar.innerHTML = texto;

                return;
            }

            window.location.assign('/?lista=1');
        } catch (error) {
            if (redirectIfSessionLost(error)) {
                return;
            }

            showToast(error?.message ?? 'No se pudo enviar la lista.', 'error');
            el.enviar.disabled = false;
            el.enviar.innerHTML = texto;
        }
    }

    async function vaciarLista() {
        if (listaActual <= 0) {
            return;
        }

        const confirmado = await confirmar({
            title: 'Vaciar lista',
            message: 'Se quitarán todos los productos de esta lista. La lista seguirá existiendo.',
            confirmText: 'Vaciar lista',
        });

        if (!confirmado) {
            return;
        }

        try {
            await fetchApi(`/api/listas-compra/${listaActual}/items`, { method: 'DELETE' });
            items = [];
            render();
            showToast('Lista vaciada.', 'info');
        } catch (error) {
            if (redirectIfSessionLost(error)) {
                return;
            }

            showToast(error?.message ?? 'No se pudo vaciar la lista.', 'error');
        }
    }

    async function eliminarLista() {
        const lista = listas.find((fila) => Number(fila.id) === listaActual);

        if (lista === undefined) {
            return;
        }

        const confirmado = await confirmar({
            title: 'Eliminar lista',
            message: `Se eliminará «${lista.nombre}» y todos sus productos.`,
            confirmText: 'Eliminar lista',
        });

        if (!confirmado) {
            return;
        }

        try {
            await fetchApi(`/api/listas-compra/${listaActual}`, { method: 'DELETE' });
            await cargarListas();
            showToast('Lista eliminada.', 'info');
        } catch (error) {
            if (redirectIfSessionLost(error)) {
                return;
            }

            showToast(error?.message ?? 'No se pudo eliminar la lista.', 'error');
        }
    }

    function abrirModalLista(lista) {
        if (!(el.modalId instanceof HTMLInputElement)
            || !(el.modalNombre instanceof HTMLInputElement)) {
            return;
        }

        el.modalId.value = lista ? String(lista.id) : '';
        el.modalNombre.value = lista ? String(lista.nombre ?? '') : '';

        if (el.modalTitle instanceof HTMLElement) {
            el.modalTitle.textContent = lista ? 'Renombrar lista' : 'Nueva lista';
        }

        if (el.modalMensaje instanceof HTMLElement) {
            el.modalMensaje.hidden = true;
            el.modalMensaje.textContent = '';
        }

        modal?.show();
    }

    async function guardarLista(event) {
        event.preventDefault();

        if (!(el.modalId instanceof HTMLInputElement)
            || !(el.modalNombre instanceof HTMLInputElement)
            || !(el.modalGuardar instanceof HTMLButtonElement)) {
            return;
        }

        const id = Number(el.modalId.value || 0);
        const nombre = el.modalNombre.value.trim();

        if (nombre === '') {
            mostrarMensajeModal('Escribe un nombre para la lista.');

            return;
        }

        el.modalGuardar.disabled = true;
        const texto = el.modalGuardar.textContent;
        el.modalGuardar.textContent = 'Guardando…';

        try {
            const data = await fetchApi(id > 0 ? `/api/listas-compra/${id}` : '/api/listas-compra', {
                method: id > 0 ? 'PUT' : 'POST',
                body: { nombre },
            });

            modal?.hide();
            await cargarListas(Number(data?.id ?? id));
            showToast(id > 0 ? 'Lista renombrada.' : 'Lista creada.', 'success');
        } catch (error) {
            if (redirectIfSessionLost(error)) {
                return;
            }

            mostrarMensajeModal(error?.message ?? 'No se pudo guardar la lista.');
        } finally {
            el.modalGuardar.disabled = false;
            el.modalGuardar.textContent = texto;
        }
    }

    function mostrarMensaje(texto) {
        if (el.mensaje instanceof HTMLElement) {
            el.mensaje.textContent = texto;
            el.mensaje.hidden = false;
        }
    }

    function ocultarMensaje() {
        if (el.mensaje instanceof HTMLElement) {
            el.mensaje.textContent = '';
            el.mensaje.hidden = true;
        }
    }

    function mostrarMensajeModal(texto) {
        if (el.modalMensaje instanceof HTMLElement) {
            el.modalMensaje.textContent = texto;
            el.modalMensaje.hidden = false;
        }
    }

    function etiquetaEstado(estado) {
        return {
            pendiente: 'Pendiente',
            enviado: 'Enviado al carrito',
            cargado: 'En el carrito',
        }[estado] ?? estado;
    }

    function showQueryToast() {
        const params = new URLSearchParams(window.location.search);

        if (params.get('ok') !== '1') {
            return;
        }

        showToast('Lista guardada. Ajusta cantidades o envíala a la pantalla rápida.', 'success');
        params.delete('ok');
        const query = params.toString();
        window.history.replaceState({}, '', `${window.location.pathname}${query === '' ? '' : `?${query}`}`);
    }

    function redirectIfSessionLost(error) {
        if (error?.status === 401) {
            window.location.replace('/login');

            return true;
        }

        return false;
    }
}
