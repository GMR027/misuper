/**
 * Formulario compartido para crear/editar recetas (Admin) y proponer recetas.
 */

import { fetchApi } from '../modules/api.js';
import { showToast } from '../modules/toast.js';

const form = document.querySelector('[data-receta-form]');

if (form instanceof HTMLFormElement) {
    init(form);
}

/**
 * @param {HTMLFormElement} form
 */
function init(form) {
    const modo = form.dataset.modo === 'admin' ? 'admin' : 'propuesta';
    const recetaId = Number(form.dataset.recetaId ?? 0);
    const inicial = leerInicial();
    const ingredientes = form.querySelector('[data-ingredientes]');
    const addIngrediente = form.querySelector('[data-add-ingrediente]');
    const mensaje = form.querySelector('[data-receta-mensaje]');
    const guardar = form.querySelector('[data-receta-guardar]');
    const modalIngrediente = document.querySelector('[data-ingrediente-modal]');
    const ingBuscar = modalIngrediente?.querySelector('[data-ing-buscar]');
    const ingStatus = modalIngrediente?.querySelector('[data-ing-status]');
    const ingResultados = modalIngrediente?.querySelector('[data-ing-resultados]');
    const ingNuevoNombre = modalIngrediente?.querySelector('[data-ing-nuevo-nombre]');
    const ingNuevoCategoria = modalIngrediente?.querySelector('[data-ing-nuevo-categoria]');
    const ingNuevoUnidad = modalIngrediente?.querySelector('[data-ing-nuevo-unidad]');
    const ingNuevoMensaje = modalIngrediente?.querySelector('[data-ing-nuevo-mensaje]');
    const ingNuevoCrear = modalIngrediente?.querySelector('[data-ing-nuevo-crear]');
    const imagen = form.querySelector('[data-receta-imagen]');
    const imagenArchivo = form.querySelector('[data-receta-imagen-archivo]');
    const imagenQuitar = form.querySelector('[data-receta-imagen-quitar]');
    const imagenEstado = form.querySelector('[data-receta-imagen-estado]');
    const imagenPreview = form.querySelector('[data-receta-imagen-preview]');
    const imagenPreviewImg = form.querySelector('[data-receta-imagen-preview-img]');

    if (!(ingredientes instanceof HTMLElement)) {
        return;
    }

    let categoriasCargadas = false;
    let searchTimer = null;

    addIngrediente?.addEventListener('click', () => {
        abrirModalIngrediente();
    });

    form.querySelectorAll('[data-receta-tipo]').forEach((input) => {
        input.addEventListener('change', () => {
            input.closest('.receta-form__tipo-card')?.classList.toggle('is-active', input.checked);
        });
    });

    modalIngrediente?.querySelectorAll('[data-ing-cerrar]').forEach((button) => {
        button.addEventListener('click', cerrarModalIngrediente);
    });

    modalIngrediente?.addEventListener('click', (event) => {
        if (event.target === modalIngrediente) {
            cerrarModalIngrediente();
        }
    });

    ingBuscar?.addEventListener('input', () => {
        window.clearTimeout(searchTimer);
        searchTimer = window.setTimeout(buscarProductos, 250);
    });

    ingNuevoCrear?.addEventListener('click', crearProducto);

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && modalIngrediente instanceof HTMLElement && !modalIngrediente.hidden) {
            cerrarModalIngrediente();
        }
    });

    imagen?.addEventListener('input', actualizarPreview);
    imagenArchivo?.addEventListener('change', subirImagen);
    imagenQuitar?.addEventListener('click', () => {
        if (imagen instanceof HTMLInputElement) {
            imagen.value = '';
        }

        if (imagenArchivo instanceof HTMLInputElement) {
            imagenArchivo.value = '';
        }

        actualizarPreview();

        if (imagenEstado instanceof HTMLElement) {
            imagenEstado.textContent = 'Puedes subir un JPG, PNG o WebP de hasta 5 MB, o pegar una URL.';
        }
    });

    actualizarPreview();

    const iniciales = Array.isArray(inicial?.ingredientes) ? inicial.ingredientes : [];

    if (iniciales.length === 0) {
        agregarFila({ nombre: '', cantidad: 1, unidad: 'g', principal: true, basico: false });
    } else {
        iniciales.forEach((ingrediente) => agregarFila(ingrediente));
    }

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        if (!(guardar instanceof HTMLButtonElement)) {
            return;
        }

        const nombre = String(form.querySelector('[data-receta-nombre]')?.value ?? '').trim();
        const categoria = String(form.querySelector('[data-receta-categoria]')?.value ?? '').trim();
        const tipos = Array.from(form.querySelectorAll('[data-receta-tipo]:checked')).map((input) => input.value);
        const pasos = String(form.querySelector('[data-receta-pasos]')?.value ?? '').trim();
        const lista = recolectarIngredientes();

        if (nombre.length < 2) {
            mostrarMensaje('El nombre debe tener al menos 2 caracteres.');

            return;
        }

        if (categoria === '') {
            mostrarMensaje('Selecciona una categoría de platillo.');

            return;
        }

        if (tipos.length === 0) {
            mostrarMensaje('Selecciona al menos un tipo de receta.');

            return;
        }

        if (lista.length === 0) {
            mostrarMensaje('Agrega al menos un ingrediente.');

            return;
        }

        if (pasos === '') {
            mostrarMensaje('Agrega al menos un paso de preparación.');

            return;
        }

        const body = {
            nombre,
            descripcion: String(form.querySelector('[data-receta-descripcion]')?.value ?? '').trim(),
            categoria,
            tipos,
            porciones_base: Number(form.querySelector('[data-receta-porciones]')?.value ?? 4),
            tiempo_min: Number(form.querySelector('[data-receta-tiempo]')?.value ?? 30),
            dificultad: String(form.querySelector('[data-receta-dificultad]')?.value ?? 'facil'),
            ingredientes: lista,
            pasos,
        };

        body.imagen_url = String(form.querySelector('[data-receta-imagen]')?.value ?? '').trim();

        if (modo === 'admin') {
            body.estado = String(form.querySelector('[data-receta-estado]')?.value ?? 'publicada');
            body.video_url = String(form.querySelector('[data-receta-video]')?.value ?? '').trim();
            body.video_titulo = String(form.querySelector('[data-receta-video-titulo]')?.value ?? '').trim();
            body.fuente_nombre = String(form.querySelector('[data-receta-fuente-nombre]')?.value ?? '').trim();
            body.fuente_url = String(form.querySelector('[data-receta-fuente-url]')?.value ?? '').trim();
            body.fuente_autor = String(form.querySelector('[data-receta-fuente-autor]')?.value ?? '').trim();
        }

        guardar.disabled = true;
        const texto = guardar.innerHTML;
        guardar.textContent = modo === 'admin' ? 'Guardando…' : 'Enviando…';
        ocultarMensaje();

        const endpoint = modo === 'admin'
            ? (recetaId > 0 ? `/api/admin/recetas/${recetaId}` : '/api/admin/recetas')
            : '/api/recetas/proponer';
        const method = modo === 'admin' && recetaId > 0 ? 'PUT' : 'POST';

        try {
            const data = await fetchApi(endpoint, { method, body });

            if (modo === 'admin') {
                showToast('Receta guardada.', 'success');

                const volver = new URLSearchParams(window.location.search).get('volver');
                const destino = volver && volver.startsWith('/admin/') ? volver : '/admin/recetas';

                window.setTimeout(() => {
                    window.location.assign(destino);
                }, 400);
            } else {
                showToast('Receta enviada para revisión.', 'success');
                window.setTimeout(() => {
                    window.location.assign('/recetas?propuesta=1');
                }, 400);
            }

            return data;
        } catch (error) {
            if (error?.status === 401) {
                window.location.replace('/login');

                return;
            }

            mostrarMensaje(error?.message ?? 'No se pudo guardar la receta.');
        } finally {
            guardar.disabled = false;
            guardar.innerHTML = texto;
        }

        return null;
    });

    function actualizarPreview() {
        if (!(imagen instanceof HTMLInputElement)) {
            return;
        }

        const url = imagen.value.trim();

        if (!(imagenPreview instanceof HTMLElement) || !(imagenPreviewImg instanceof HTMLImageElement)) {
            return;
        }

        if (url === '') {
            imagenPreview.hidden = true;
            imagenPreviewImg.removeAttribute('src');

            return;
        }

        imagenPreviewImg.onerror = () => {
            imagenPreview.hidden = true;
        };
        imagenPreviewImg.onload = () => {
            imagenPreview.hidden = false;
        };
        imagenPreviewImg.src = url;
    }

    async function subirImagen() {
        if (!(imagenArchivo instanceof HTMLInputElement) || !(imagen instanceof HTMLInputElement)) {
            return;
        }

        const archivo = imagenArchivo.files?.[0];

        if (!(archivo instanceof File)) {
            return;
        }

        if (!['image/jpeg', 'image/png', 'image/webp'].includes(archivo.type)) {
            if (imagenEstado instanceof HTMLElement) {
                imagenEstado.textContent = 'Usa una imagen JPG, PNG o WebP.';
            }

            imagenArchivo.value = '';

            return;
        }

        if (archivo.size > 5 * 1024 * 1024) {
            if (imagenEstado instanceof HTMLElement) {
                imagenEstado.textContent = 'La imagen supera el tamaño máximo de 5 MB.';
            }

            imagenArchivo.value = '';

            return;
        }

        if (imagenEstado instanceof HTMLElement) {
            imagenEstado.textContent = 'Subiendo imagen…';
        }

        const datos = new FormData();
        datos.append('imagen', archivo);

        try {
            const endpoint = modo === 'admin'
                ? '/api/admin/recetas/imagen'
                : '/api/recetas/imagen';
            const data = await fetchApi(endpoint, { method: 'POST', body: datos });
            imagen.value = String(data?.imagen_url ?? '');
            actualizarPreview();

            if (imagenEstado instanceof HTMLElement) {
                imagenEstado.textContent = 'Imagen subida. Se guardará al enviar la receta.';
            }

            showToast('Imagen subida.', 'success');
        } catch (error) {
            if (imagenEstado instanceof HTMLElement) {
                imagenEstado.textContent = error?.message ?? 'No se pudo subir la imagen.';
            }
        } finally {
            imagenArchivo.value = '';
        }
    }

    async function abrirModalIngrediente() {
        if (!(modalIngrediente instanceof HTMLElement)) {
            agregarFila({ nombre: '', cantidad: 1, unidad: 'g', principal: true, basico: false });

            return;
        }

        modalIngrediente.hidden = false;
        document.body.classList.add('modal-open');

        if (ingBuscar instanceof HTMLInputElement) {
            ingBuscar.value = '';
            window.setTimeout(() => ingBuscar.focus(), 50);
        }

        if (ingResultados instanceof HTMLElement) {
            ingResultados.replaceChildren();
        }

        if (ingStatus instanceof HTMLElement) {
            ingStatus.textContent = 'Escribe al menos 2 letras para buscar.';
        }

        if (ingNuevoNombre instanceof HTMLInputElement) {
            ingNuevoNombre.value = '';
        }

        if (ingNuevoCategoria instanceof HTMLSelectElement) {
            ingNuevoCategoria.value = '';
        }

        if (ingNuevoUnidad instanceof HTMLSelectElement) {
            ingNuevoUnidad.value = 'pza';
        }

        ocultarMensajeIngrediente();

        if (!categoriasCargadas) {
            await cargarCategorias();
        }
    }

    function cerrarModalIngrediente() {
        if (modalIngrediente instanceof HTMLElement) {
            modalIngrediente.hidden = true;

            if (!document.querySelector('.app-modal:not([hidden])')) {
                document.body.classList.remove('modal-open');
            }
        }
    }

    async function cargarCategorias() {
        if (!(ingNuevoCategoria instanceof HTMLSelectElement)) {
            return;
        }

        try {
            const data = await fetchApi('/api/categorias');
            const categorias = Array.isArray(data) ? data : [];

            for (const categoria of categorias) {
                const option = document.createElement('option');
                option.value = String(categoria.id);
                option.textContent = String(categoria.nombre);
                ingNuevoCategoria.append(option);
            }

            categoriasCargadas = true;
        } catch (error) {
            if (error?.status !== 401) {
                mostrarMensajeIngrediente('No se pudieron cargar las categorías.');
            }
        }
    }

    async function buscarProductos() {
        if (!(ingBuscar instanceof HTMLInputElement)) {
            return;
        }

        const q = ingBuscar.value.trim();

        if (q.length < 2) {
            if (ingResultados instanceof HTMLElement) {
                ingResultados.replaceChildren();
            }

            if (ingStatus instanceof HTMLElement) {
                ingStatus.textContent = 'Escribe al menos 2 letras para buscar.';
            }

            return;
        }

        if (ingNuevoNombre instanceof HTMLInputElement && ingNuevoNombre.value.trim() === '') {
            ingNuevoNombre.value = q;
        }

        if (ingStatus instanceof HTMLElement) {
            ingStatus.textContent = 'Buscando…';
        }

        try {
            const endpoint = modo === 'admin'
                ? `/api/admin/productos?q=${encodeURIComponent(q)}&estado=activo`
                : `/api/productos/buscar?q=${encodeURIComponent(q)}`;
            const data = await fetchApi(endpoint);
            const items = Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : []);

            renderResultadosIngrediente(items);

            if (ingStatus instanceof HTMLElement) {
                ingStatus.textContent = items.length === 0
                    ? 'No encontramos coincidencias. Puedes registrarlo abajo.'
                    : `${items.length} ${items.length === 1 ? 'producto' : 'productos'} encontrados.`;
            }
        } catch (error) {
            if (ingResultados instanceof HTMLElement) {
                ingResultados.replaceChildren();
            }

            if (ingStatus instanceof HTMLElement) {
                ingStatus.textContent = 'No se pudo buscar en el catálogo.';
            }
        }
    }

    /**
     * @param {Array<any>} items
     */
    function renderResultadosIngrediente(items) {
        if (!(ingResultados instanceof HTMLElement)) {
            return;
        }

        ingResultados.replaceChildren();

        for (const producto of items) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'receta-ing-modal__resultado';

            const icon = document.createElement('span');
            icon.className = 'receta-ing-modal__resultado-icon';
            icon.innerHTML = '<i class="bi bi-basket2-fill" aria-hidden="true"></i>';

            const texto = document.createElement('span');
            texto.className = 'receta-ing-modal__resultado-texto';
            const nombre = document.createElement('strong');
            nombre.textContent = String(producto.nombre ?? '');
            const meta = document.createElement('small');
            meta.textContent = `${String(producto.categoria_nombre ?? 'Sin categoría')} · ${String(producto.unidad_base ?? 'pza')}`;
            texto.append(nombre, meta);

            const add = document.createElement('i');
            add.className = 'bi bi-plus-circle';
            add.setAttribute('aria-hidden', 'true');

            button.append(icon, texto, add);
            button.addEventListener('click', () => {
                usarProducto(producto);
            });
            ingResultados.append(button);
        }
    }

    /**
     * @param {any} producto
     */
    function usarProducto(producto) {
        const unidadProducto = String(producto.unidad_base ?? 'pza');
        const unidadReceta = unidadProducto === 'kg' ? 'g'
            : unidadProducto === 'L' ? 'ml'
                : unidadProducto;
        const cantidad = unidadReceta === 'g' || unidadReceta === 'ml' ? 100 : 1;

        agregarFila({
            nombre: String(producto.nombre ?? ''),
            producto: String(producto.nombre ?? ''),
            cantidad,
            unidad: unidadReceta,
            principal: true,
            basico: false,
        });
        cerrarModalIngrediente();
        showToast(`${producto.nombre} agregado a los ingredientes.`, 'success');
    }

    async function crearProducto() {
        if (
            !(ingNuevoNombre instanceof HTMLInputElement)
            || !(ingNuevoCategoria instanceof HTMLSelectElement)
            || !(ingNuevoUnidad instanceof HTMLSelectElement)
            || !(ingNuevoCrear instanceof HTMLButtonElement)
        ) {
            return;
        }

        const nombre = ingNuevoNombre.value.trim();
        const categoriaId = Number(ingNuevoCategoria.value);
        const unidad = ingNuevoUnidad.value;

        if (nombre.length < 2) {
            mostrarMensajeIngrediente('Escribe un nombre de al menos 2 caracteres.');

            return;
        }

        if (!Number.isInteger(categoriaId) || categoriaId <= 0) {
            mostrarMensajeIngrediente('Selecciona una categoría.');

            return;
        }

        ingNuevoCrear.disabled = true;
        const texto = ingNuevoCrear.innerHTML;
        ingNuevoCrear.textContent = 'Registrando…';
        ocultarMensajeIngrediente();

        try {
            const endpoint = modo === 'admin' ? '/api/admin/productos' : '/api/productos';
            const producto = await fetchApi(endpoint, {
                method: 'POST',
                body: {
                    nombre,
                    categoria_id: categoriaId,
                    unidad_base: unidad,
                    imagen_url: null,
                },
            });

            usarProducto(producto);
        } catch (error) {
            if (error?.status === 401) {
                window.location.replace('/login');

                return;
            }

            mostrarMensajeIngrediente(error?.message ?? 'No se pudo registrar el producto.');
        } finally {
            ingNuevoCrear.disabled = false;
            ingNuevoCrear.innerHTML = texto;
        }
    }

    function mostrarMensajeIngrediente(texto) {
        if (ingNuevoMensaje instanceof HTMLElement) {
            ingNuevoMensaje.textContent = texto;
            ingNuevoMensaje.hidden = false;
        }
    }

    function ocultarMensajeIngrediente() {
        if (ingNuevoMensaje instanceof HTMLElement) {
            ingNuevoMensaje.textContent = '';
            ingNuevoMensaje.hidden = true;
        }
    }

    /**
     * @param {any} ingrediente
     */
    function agregarFila(ingrediente) {
        const fila = document.createElement('div');
        fila.className = 'receta-form__ingrediente';
        fila.dataset.producto = String(ingrediente?.producto ?? '');

        const nombre = document.createElement('input');
        nombre.type = 'text';
        nombre.className = 'form-control form-control-sm';
        nombre.placeholder = 'Ingrediente';
        nombre.maxLength = 150;
        nombre.value = String(ingrediente?.nombre ?? '');
        nombre.dataset.ingNombre = '';
        nombre.setAttribute('aria-label', 'Nombre del ingrediente');

        const cantidad = document.createElement('input');
        cantidad.type = 'number';
        cantidad.className = 'form-control form-control-sm';
        cantidad.min = '0.001';
        cantidad.step = '0.001';
        cantidad.inputMode = 'decimal';
        cantidad.value = ingrediente?.unidad === 'al_gusto' ? '' : String(ingrediente?.cantidad ?? 1);
        cantidad.dataset.ingCantidad = '';
        cantidad.setAttribute('aria-label', 'Cantidad del ingrediente');

        const unidad = document.createElement('select');
        unidad.className = 'form-select form-select-sm';
        unidad.dataset.ingUnidad = '';
        unidad.setAttribute('aria-label', 'Unidad del ingrediente');
        [
            ['g', 'g'],
            ['ml', 'ml'],
            ['pza', 'pza'],
            ['kg', 'kg'],
            ['L', 'L'],
            ['al_gusto', 'Al gusto'],
        ].forEach(([value, label]) => {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = label;
            option.selected = String(ingrediente?.unidad ?? 'g') === value;
            unidad.append(option);
        });
        unidad.addEventListener('change', () => {
            cantidad.disabled = unidad.value === 'al_gusto';
        });
        cantidad.disabled = unidad.value === 'al_gusto';

        const principal = checkbox('Principal', Boolean(ingrediente?.principal));
        const basico = checkbox('Básico', Boolean(ingrediente?.basico));

        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'btn btn-sm btn-outline-danger';
        remove.setAttribute('aria-label', 'Quitar ingrediente');
        remove.innerHTML = '<i class="bi bi-x-lg" aria-hidden="true"></i>';
        remove.addEventListener('click', () => {
            if (ingredientes.querySelectorAll('.receta-form__ingrediente').length <= 1) {
                showToast('Debe quedar al menos un ingrediente.', 'error');

                return;
            }

            fila.remove();
        });

        fila.append(nombre, cantidad, unidad, principal, basico, remove);
        ingredientes.append(fila);
    }

    /**
     * @param {string} label
     * @param {boolean} checked
     * @returns {HTMLLabelElement}
     */
    function checkbox(label, checked) {
        const wrapper = document.createElement('label');
        wrapper.className = 'form-check receta-form__check';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.className = 'form-check-input';
        input.checked = checked;
        const span = document.createElement('span');
        span.className = 'form-check-label';
        span.textContent = label;
        wrapper.append(input, span);

        return wrapper;
    }

    /**
     * @returns {Array<{nombre: string, producto: string|null, cantidad: number|null, unidad: string, principal: boolean, basico: boolean}>}
     */
    function recolectarIngredientes() {
        const lista = [];

        ingredientes.querySelectorAll('.receta-form__ingrediente').forEach((fila) => {
            if (!(fila instanceof HTMLElement)) {
                return;
            }

            const nombre = String(fila.querySelector('[data-ing-nombre]')?.value ?? '').trim();
            const unidad = String(fila.querySelector('[data-ing-unidad]')?.value ?? 'g');
            const cantidadRaw = String(fila.querySelector('[data-ing-cantidad]')?.value ?? '').trim();
            const cantidad = unidad === 'al_gusto' ? null : Number(cantidadRaw);
            const producto = String(fila.dataset.producto ?? '').trim();

            if (nombre === '') {
                return;
            }

            if (unidad !== 'al_gusto' && (!Number.isFinite(cantidad) || Number(cantidad) <= 0)) {
                return;
            }

            lista.push({
                nombre,
                producto: producto === '' ? null : producto,
                cantidad,
                unidad,
                principal: Boolean(fila.querySelector('.receta-form__check input')?.checked),
                basico: Boolean(fila.querySelectorAll('.receta-form__check input')[1]?.checked),
            });
        });

        return lista;
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
     * @returns {any|null}
     */
    function leerInicial() {
        const script = document.querySelector('[data-receta-inicial]');

        if (!(script instanceof HTMLScriptElement)) {
            return null;
        }

        try {
            return JSON.parse(script.textContent ?? '');
        } catch {
            return null;
        }
    }
}
