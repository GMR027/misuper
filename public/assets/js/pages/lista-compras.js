/**
 * Productos por comprar: CRUD, envío a la pantalla rápida y estados.
 */

import { fetchApi } from '../modules/api.js';
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
        items: root.querySelector('[data-lista-items]'),
        empty: root.querySelector('[data-lista-empty]'),
        status: root.querySelector('[data-lista-status]'),
        enviar: root.querySelector('[data-lista-enviar]'),
        vaciar: root.querySelector('[data-lista-vaciar]'),
        form: root.querySelector('[data-lista-form]'),
        nombre: root.querySelector('[data-lista-nombre]'),
        cantidad: root.querySelector('[data-lista-cantidad]'),
        unidad: root.querySelector('[data-lista-unidad]'),
        mensaje: root.querySelector('[data-lista-mensaje]'),
        agregar: root.querySelector('[data-lista-agregar]'),
    };

    /** @type {Array<any>} */
    let items = [];

    bind();
    load();
    showQueryToast();

    function bind() {
        el.form?.addEventListener('submit', agregarManual);
        el.enviar?.addEventListener('click', enviar);
        el.vaciar?.addEventListener('click', vaciar);
    }

    async function load() {
        if (el.status instanceof HTMLElement) {
            el.status.textContent = 'Cargando productos…';
        }

        try {
            const data = await fetchApi('/api/lista-compras');
            items = Array.isArray(data?.items) ? data.items : [];
            render();

            if (el.status instanceof HTMLElement) {
                const pendientes = Number(data?.pendientes ?? 0);
                el.status.textContent = `${items.length} ${items.length === 1 ? 'producto' : 'productos'} · ${pendientes} pendientes de enviar`;
            }
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

            if (el.enviar instanceof HTMLButtonElement) {
                el.enviar.disabled = true;
            }

            if (el.vaciar instanceof HTMLButtonElement) {
                el.vaciar.disabled = true;
            }

            return;
        }

        if (el.empty instanceof HTMLElement) {
            el.empty.hidden = true;
        }

        if (el.enviar instanceof HTMLButtonElement) {
            el.enviar.disabled = false;
        }

        if (el.vaciar instanceof HTMLButtonElement) {
            el.vaciar.disabled = false;
        }

        for (const item of items) {
            el.items.append(crearItem(item));
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
                const actualizado = await fetchApi(`/api/lista-compras/${Number(item.id)}`, {
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
                load();
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
            if (!window.confirm(`¿Eliminar "${item.nombre}" de la lista?`)) {
                return;
            }

            try {
                await fetchApi(`/api/lista-compras/${Number(item.id)}`, { method: 'DELETE' });
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

        if (!(el.nombre instanceof HTMLInputElement) || !(el.cantidad instanceof HTMLInputElement) || !(el.unidad instanceof HTMLSelectElement)) {
            return;
        }

        const nombre = el.nombre.value.trim();
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
            const data = await fetchApi('/api/lista-compras', {
                method: 'POST',
                body: {
                    nombre,
                    cantidad,
                    unidad_base: el.unidad.value,
                },
            });

            items = Array.isArray(data?.items) ? data.items : items;
            el.nombre.value = '';
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

    async function enviar() {
        if (!(el.enviar instanceof HTMLButtonElement)) {
            return;
        }

        el.enviar.disabled = true;
        const texto = el.enviar.innerHTML;
        el.enviar.textContent = 'Enviando…';

        try {
            const data = await fetchApi('/api/lista-compras/enviar', { method: 'POST' });
            const enviados = Number(data?.enviados ?? 0);

            if (enviados === 0) {
                showToast('No hay productos pendientes de enviar.', 'info');
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

    async function vaciar() {
        if (!window.confirm('¿Vaciar toda la lista de productos por comprar?')) {
            return;
        }

        try {
            await fetchApi('/api/lista-compras', { method: 'DELETE' });
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

        showToast('Lista guardada. Ajusta cantidades o envía los productos a la pantalla rápida.', 'success');
        params.delete('ok');
        const query = params.toString();
        window.history.replaceState({}, '', `${window.location.pathname}${query === '' ? '' : `?${query}`}`);
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
