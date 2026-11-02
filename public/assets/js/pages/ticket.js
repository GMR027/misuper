/**
 * Pantalla de tickets: subida, OCR, revisión y confirmación.
 *
 * La imagen se reduce y se convierte a JPEG en el navegador antes de subirla.
 * Así se acortan los tiempos de OCR y se normalizan fotos de cámara (incluidas
 * las que vienen con orientación EXIF).
 */

import { fetchApi } from '../modules/api.js';
import { formatCurrency } from '../modules/format.js';
import { showToast } from '../modules/toast.js';

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_SIDE = 2200;

const root = document.querySelector('[data-ticket]');

if (root instanceof HTMLElement) {
    init(root);
}

/**
 * @param {HTMLElement} root
 */
function init(root) {
    const upload = root.querySelector('[data-ticket-drop]');
    const preview = root.querySelector('[data-ticket-preview]');
    const previewImg = root.querySelector('[data-ticket-preview-img]');
    const fileName = root.querySelector('[data-ticket-file-name]');
    const status = root.querySelector('[data-ticket-status]');
    const readButton = root.querySelector('[data-ticket-leer]');
    const revision = root.querySelector('[data-ticket-revision]');
    const itemsList = root.querySelector('[data-ticket-items]');
    const template = root.querySelector('[data-ticket-item-template]');
    const empty = root.querySelector('[data-ticket-vacio]');
    const dateInput = root.querySelector('[data-ticket-fecha]');
    const totalDetectado = root.querySelector('[data-ticket-total-detectado]');
    const sumatoria = root.querySelector('[data-ticket-suma]');
    const totalWarning = root.querySelector('[data-ticket-total-warning]');
    const message = root.querySelector('[data-ticket-mensaje]');
    const saveButton = root.querySelector('[data-ticket-guardar]');
    const rawText = root.querySelector('[data-ticket-texto]');
    const inputs = [...root.querySelectorAll('[data-ticket-input]')];

    if (
        !(upload instanceof HTMLElement)
        || !(preview instanceof HTMLElement)
        || !(revision instanceof HTMLElement)
        || !(itemsList instanceof HTMLElement)
        || !(template instanceof HTMLTemplateElement)
        || !(status instanceof HTMLElement)
        || !(readButton instanceof HTMLButtonElement)
        || !(saveButton instanceof HTMLButtonElement)
        || !(dateInput instanceof HTMLInputElement)
        || !(totalDetectado instanceof HTMLElement)
        || !(sumatoria instanceof HTMLElement)
        || !(totalWarning instanceof HTMLElement)
        || !(message instanceof HTMLElement)
        || !(rawText instanceof HTMLElement)
    ) {
        return;
    }

    let archivo = null;
    let previewUrl = null;
    let ticketId = null;
    let totalTicket = null;
    let productos = [];
    let itemSeq = 0;
    let guardando = false;

    for (const input of inputs) {
        if (!(input instanceof HTMLInputElement)) {
            continue;
        }

        input.addEventListener('change', () => {
            const file = input.files?.[0] ?? null;
            input.value = '';
            seleccionarArchivo(file);
        });
    }

    preview.querySelector('[data-ticket-quitar]')?.addEventListener('click', () => {
        limpiarSeleccion();
    });

    readButton.addEventListener('click', () => {
        leerTicket();
    });

    root.querySelector('[data-ticket-otra]')?.addEventListener('click', () => {
        reiniciar();
    });

    root.querySelector('[data-ticket-add]')?.addEventListener('click', () => {
        agregarFila(null);
        actualizarTotales();
    });

    saveButton.addEventListener('click', () => {
        guardarCompra();
    });

    itemsList.addEventListener('click', (event) => {
        const target = event.target;

        if (!(target instanceof Element)) {
            return;
        }

        const remove = target.closest('[data-ticket-remove]');

        if (remove instanceof HTMLButtonElement) {
            remove.closest('[data-ticket-item]')?.remove();
            actualizarTotales();
        }
    });

    itemsList.addEventListener('input', () => {
        actualizarTotales();
    });

    itemsList.addEventListener('change', () => {
        actualizarTotales();
    });

    upload.addEventListener('dragover', (event) => {
        event.preventDefault();
        upload.classList.add('is-dragging');
    });

    upload.addEventListener('dragleave', () => {
        upload.classList.remove('is-dragging');
    });

    upload.addEventListener('drop', (event) => {
        event.preventDefault();
        upload.classList.remove('is-dragging');

        const file = event.dataTransfer?.files?.[0] ?? null;
        seleccionarArchivo(file);
    });

    /**
     * @param {File | null} file
     */
    function seleccionarArchivo(file) {
        if (!(file instanceof File)) {
            return;
        }

        if (!file.type.startsWith('image/') && !/\.(jpe?g|png|webp)$/i.test(file.name)) {
            mostrarError('Selecciona una imagen JPG, PNG o WebP.');
            return;
        }

        if (file.size > MAX_BYTES) {
            mostrarError('La imagen puede pesar como máximo 8 MB.');
            return;
        }

        if (previewUrl !== null) {
            URL.revokeObjectURL(previewUrl);
        }

        archivo = file;
        previewUrl = URL.createObjectURL(file);

        if (previewImg instanceof HTMLImageElement) {
            previewImg.src = previewUrl;
        }

        if (fileName instanceof HTMLElement) {
            fileName.textContent = file.name;
        }

        preview.hidden = false;
        readButton.hidden = false;
        revision.hidden = true;
        message.hidden = true;
        totalWarning.hidden = true;

        status.hidden = true;
        status.textContent = '';
    }

    function limpiarSeleccion() {
        if (previewUrl !== null) {
            URL.revokeObjectURL(previewUrl);
            previewUrl = null;
        }

        archivo = null;
        ticketId = null;

        if (previewImg instanceof HTMLImageElement) {
            previewImg.removeAttribute('src');
        }

        preview.hidden = true;
        readButton.hidden = true;
        status.hidden = true;
        status.textContent = '';
        message.hidden = true;

        for (const input of inputs) {
            if (input instanceof HTMLInputElement) {
                input.value = '';
            }
        }
    }

    function reiniciar() {
        const idParaDescartar = ticketId;

        limpiarSeleccion();

        if (idParaDescartar !== null) {
            // El ticket aún no confirmado se descarta también en el servidor.
            fetchApi(`/api/tickets/${idParaDescartar}`, { method: 'DELETE' }).catch(() => {
                // Si ya se confirmó o falló, no bloquea el cambio de imagen.
            });
        }

        revision.hidden = true;
        upload.hidden = false;
        itemsList.replaceChildren();
        rawText.textContent = '';
        totalTicket = null;
        productos = [];
        totalDetectado.textContent = '—';
        sumatoria.textContent = formatCurrency(0);
        root.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    async function leerTicket() {
        if (archivo === null) {
            mostrarError('Selecciona una imagen del ticket.');

            return;
        }

        readButton.disabled = true;
        upload.classList.add('is-loading');
        mostrarEstado('Preparando la imagen…');

        try {
            const preparado = await prepararImagen(archivo);
            mostrarEstado('Leyendo el ticket… esto puede tardar unos segundos.');

            const formData = new FormData();
            formData.append('foto', preparado);

            const data = await fetchApi('/api/tickets', {
                method: 'POST',
                body: formData,
            });

            ticketId = Number(data?.ticket?.id ?? 0) || null;
            totalTicket = data?.total_detectado === null || data?.total_detectado === undefined
                ? null
                : Number(data.total_detectado);
            productos = Array.isArray(data?.productos) ? data.productos : [];

            pintarRevision(data);

            status.hidden = true;
            status.classList.remove('is-error');
            upload.hidden = true;
            revision.hidden = false;
            revision.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (error) {
            if (error?.status === 401) {
                window.location.href = '/login';

                return;
            }

            mostrarError(error?.message ?? 'No se pudo leer el ticket. Inténtalo de nuevo.');
            showToast(error?.message ?? 'No se pudo leer el ticket.', 'error');
        } finally {
            readButton.disabled = false;
            upload.classList.remove('is-loading');
        }
    }

    /**
     * @param {any} data
     */
    function pintarRevision(data) {
        const hoy = String(root.dataset.ticketHoy ?? '');
        const fecha = typeof data?.fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.fecha)
            ? data.fecha
            : hoy;

        dateInput.value = fecha;
        totalDetectado.textContent = totalTicket === null ? '—' : formatCurrency(totalTicket);
        rawText.textContent = typeof data?.texto === 'string' ? data.texto : '';

        itemsList.replaceChildren();
        message.hidden = true;
        totalWarning.hidden = true;

        const items = Array.isArray(data?.items) ? data.items : [];

        for (const item of items) {
            agregarFila(item);
        }

        empty.hidden = items.length > 0;
        actualizarTotales();
    }

    /**
     * @param {any} item
     */
    function agregarFila(item) {
        const fragment = template.content.cloneNode(true);
        const row = fragment.querySelector('[data-ticket-item]');

        if (!(row instanceof HTMLElement)) {
            return;
        }

        itemSeq += 1;
        row.dataset.itemKey = String(itemSeq);

        const index = row.querySelector('[data-ticket-index]');
        const nameInput = row.querySelector('[data-ticket-nombre]');
        const productSelect = row.querySelector('[data-ticket-producto]');
        const quantityInput = row.querySelector('[data-ticket-cantidad]');
        const priceInput = row.querySelector('[data-ticket-precio]');
        const confidence = row.querySelector('[data-ticket-confianza]');
        const suggestions = row.querySelector('[data-ticket-sugerencias]');

        if (index instanceof HTMLElement) {
            index.textContent = String(itemsList.children.length + 1);
        }

        if (nameInput instanceof HTMLInputElement) {
            nameInput.value = typeof item?.nombre === 'string' ? item.nombre : '';
        }

        if (productSelect instanceof HTMLSelectElement) {
            const libre = productSelect.options[0];
            productSelect.replaceChildren(libre);

            for (const producto of productos) {
                const option = document.createElement('option');
                option.value = String(producto.id);
                option.textContent = `${producto.nombre} · ${producto.unidad_base}`;
                productSelect.append(option);
            }

            if (item?.producto_id !== null && item?.producto_id !== undefined) {
                productSelect.value = String(item.producto_id);
            }
        }

        if (quantityInput instanceof HTMLInputElement) {
            const cantidad = Number(item?.cantidad ?? 1);
            quantityInput.value = String(Number.isFinite(cantidad) && cantidad > 0 ? cantidad : 1);
        }

        if (priceInput instanceof HTMLInputElement) {
            const precio = Number(item?.precio_total ?? 0);
            priceInput.value = Number.isFinite(precio) && precio >= 0 ? precio.toFixed(2) : '0.00';
        }

        if (confidence instanceof HTMLElement) {
            const puntaje = Number(item?.confianza ?? 0);

            if (puntaje > 0) {
                confidence.hidden = false;
                confidence.textContent = puntaje >= 0.85
                    ? 'Coincidencia alta'
                    : puntaje >= 0.72
                        ? 'Coincidencia media'
                        : 'Coincidencia baja';
                confidence.classList.add(
                    puntaje >= 0.85
                        ? 'text-bg-success'
                        : puntaje >= 0.72
                            ? 'text-bg-warning'
                            : 'text-bg-secondary',
                );
            }
        }

        if (suggestions instanceof HTMLElement) {
            const lista = Array.isArray(item?.sugerencias) ? item.sugerencias : [];

            if (lista.length > 0 && !item?.producto_id) {
                suggestions.hidden = false;
                suggestions.textContent = `Sugerencias: ${lista.map((s) => s.nombre).join(', ')}`;
            }
        }

        productSelect?.addEventListener('change', () => {
            const option = productSelect.selectedOptions[0];

            if (
                productSelect.value !== ''
                && nameInput instanceof HTMLInputElement
                && nameInput.value.trim() === ''
                && option instanceof HTMLOptionElement
            ) {
                nameInput.value = option.textContent.split(' · ')[0] ?? '';
            }
        });

        itemsList.append(fragment);
        renumerar();
    }

    function renumerar() {
        const filas = [...itemsList.querySelectorAll('[data-ticket-item]')];

        filas.forEach((fila, indice) => {
            const index = fila.querySelector('[data-ticket-index]');

            if (index instanceof HTMLElement) {
                index.textContent = String(indice + 1);
            }
        });
    }

    function actualizarTotales() {
        let suma = 0;

        for (const row of itemsList.querySelectorAll('[data-ticket-item]')) {
            const priceInput = row.querySelector('[data-ticket-precio]');
            const precio = priceInput instanceof HTMLInputElement ? Number(priceInput.value) : 0;

            if (Number.isFinite(precio) && precio > 0) {
                suma += precio;
            }
        }

        sumatoria.textContent = formatCurrency(suma);

        if (totalTicket !== null && Math.abs(totalTicket - suma) > 0.05) {
            totalWarning.hidden = false;
            totalWarning.textContent = `El total del ticket (${formatCurrency(totalTicket)}) no coincide con la suma de los artículos (${formatCurrency(suma)}). Revisa los precios detectados.`;
        } else {
            totalWarning.hidden = true;
        }

        empty.hidden = itemsList.children.length > 0;
        saveButton.disabled = guardando || itemsList.children.length === 0;
    }

    /**
     * @returns {Array<Record<string, number | string>> | null}
     */
    function recolectarItems() {
        const items = [];
        let indice = 0;

        for (const row of itemsList.querySelectorAll('[data-ticket-item]')) {
            indice += 1;

            const nameInput = row.querySelector('[data-ticket-nombre]');
            const productSelect = row.querySelector('[data-ticket-producto]');
            const quantityInput = row.querySelector('[data-ticket-cantidad]');
            const priceInput = row.querySelector('[data-ticket-precio]');

            const nombre = nameInput instanceof HTMLInputElement ? nameInput.value.trim() : '';
            const productoId = productSelect instanceof HTMLSelectElement
                ? productSelect.value
                : '';
            const cantidad = quantityInput instanceof HTMLInputElement
                ? Number(quantityInput.value)
                : NaN;
            const precio = priceInput instanceof HTMLInputElement
                ? Number(priceInput.value)
                : NaN;

            if (productoId === '' && (nombre.length < 2 || nombre.length > 150)) {
                mostrarError(`El artículo ${indice} necesita un nombre de entre 2 y 150 caracteres.`);

                return null;
            }

            if (!Number.isFinite(cantidad) || cantidad <= 0) {
                mostrarError(`La cantidad del artículo ${indice} debe ser mayor que cero.`);

                return null;
            }

            if (!Number.isFinite(precio) || precio < 0) {
                mostrarError(`El precio del artículo ${indice} no es válido.`);

                return null;
            }

            if (productoId !== '') {
                items.push({
                    producto_id: Number(productoId),
                    cantidad,
                    precio_total: precio,
                });
            } else {
                items.push({
                    nombre_libre: nombre,
                    unidad_base: 'pza',
                    cantidad,
                    precio_total: precio,
                });
            }
        }

        if (items.length === 0) {
            mostrarError('Agrega al menos un artículo para guardar la compra.');

            return null;
        }

        return items;
    }

    async function guardarCompra() {
        if (guardando) {
            return;
        }

        message.hidden = true;
        const items = recolectarItems();

        if (items === null) {
            return;
        }

        if (ticketId === null) {
            mostrarError('Vuelve a leer el ticket antes de guardar.');

            return;
        }

        guardando = true;
        saveButton.disabled = true;
        mostrarMensaje('Guardando la compra…', 'info');

        try {
            const compra = await fetchApi(`/api/tickets/${ticketId}/confirm`, {
                method: 'POST',
                body: {
                    fecha: dateInput.value,
                    items,
                },
            });

            window.location.href = `/historial/${Number(compra.id)}?ticket=1`;
        } catch (error) {
            if (error?.status === 401) {
                window.location.href = '/login';

                return;
            }

            const detalle = error?.data && typeof error.data === 'object'
                ? Object.values(error.data)[0]
                : null;

            mostrarError(
                typeof detalle === 'string'
                    ? detalle
                    : error?.message ?? 'No se pudo guardar la compra.',
            );
            showToast(error?.message ?? 'No se pudo guardar la compra.', 'error');
        } finally {
            guardando = false;
            saveButton.disabled = itemsList.children.length === 0;
        }
    }

    /**
     * @param {string} texto
     */
    function mostrarEstado(texto) {
        status.hidden = false;
        status.textContent = texto;
        status.classList.remove('is-error');
    }

    /**
     * @param {string} texto
     */
    function mostrarError(texto) {
        mostrarMensaje(texto, 'error');

        if (revision.hidden) {
            status.hidden = false;
            status.textContent = texto;
            status.classList.add('is-error');
        }
    }

    /**
     * @param {string} texto
     * @param {'error' | 'info'} tipo
     */
    function mostrarMensaje(texto, tipo) {
        message.hidden = false;
        message.textContent = texto;
        message.classList.toggle('is-error', tipo === 'error');
        message.classList.toggle('is-info', tipo === 'info');
    }
}

/**
 * Reduce la imagen a MAX_SIDE y la convierte a JPEG. También corrige la
 * orientación EXIF cuando el navegador lo permite.
 *
 * @param {File} file
 * @returns {Promise<File>}
 */
async function prepararImagen(file) {
    try {
        const bitmap = await cargarBitmap(file);
        const escala = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
        const ancho = Math.max(1, Math.round(bitmap.width * escala));
        const alto = Math.max(1, Math.round(bitmap.height * escala));

        const canvas = document.createElement('canvas');
        canvas.width = ancho;
        canvas.height = alto;

        const contexto = canvas.getContext('2d');

        if (contexto === null) {
            return file;
        }

        contexto.fillStyle = '#ffffff';
        contexto.fillRect(0, 0, ancho, alto);
        contexto.drawImage(bitmap, 0, 0, ancho, alto);

        if (typeof bitmap.close === 'function') {
            bitmap.close();
        }

        const blob = await new Promise((resolve) => {
            canvas.toBlob(resolve, 'image/jpeg', 0.9);
        });

        if (!(blob instanceof Blob) || blob.size === 0 || blob.size > MAX_BYTES) {
            return file;
        }

        return new File([blob], 'ticket.jpg', { type: 'image/jpeg' });
    } catch {
        return file;
    }
}

/**
 * @param {File} file
 * @returns {Promise<ImageBitmap | HTMLImageElement>}
 */
async function cargarBitmap(file) {
    if (typeof createImageBitmap === 'function') {
        try {
            return await createImageBitmap(file, { imageOrientation: 'from-image' });
        } catch {
            // Se intenta con la carga clásica de <img>.
        }
    }

    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const imagen = new Image();

        imagen.onload = () => {
            URL.revokeObjectURL(url);
            resolve(imagen);
        };

        imagen.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('No se pudo leer la imagen.'));
        };

        imagen.src = url;
    });
}
