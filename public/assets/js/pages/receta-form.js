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

    if (!(ingredientes instanceof HTMLElement)) {
        return;
    }

    addIngrediente?.addEventListener('click', () => {
        agregarFila({ nombre: '', cantidad: 1, unidad: 'g', principal: false, basico: false });
    });

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
        const tipos = Array.from(form.querySelectorAll('[data-receta-tipo]:checked')).map((input) => input.value);
        const pasos = String(form.querySelector('[data-receta-pasos]')?.value ?? '').trim();
        const lista = recolectarIngredientes();

        if (nombre.length < 2) {
            mostrarMensaje('El nombre debe tener al menos 2 caracteres.');

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
            tipos,
            porciones_base: Number(form.querySelector('[data-receta-porciones]')?.value ?? 4),
            tiempo_min: Number(form.querySelector('[data-receta-tiempo]')?.value ?? 30),
            dificultad: String(form.querySelector('[data-receta-dificultad]')?.value ?? 'facil'),
            ingredientes: lista,
            pasos,
        };

        if (modo === 'admin') {
            body.estado = String(form.querySelector('[data-receta-estado]')?.value ?? 'publicada');
            body.video_url = String(form.querySelector('[data-receta-video]')?.value ?? '').trim();
            body.video_titulo = String(form.querySelector('[data-receta-video-titulo]')?.value ?? '').trim();
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
                window.setTimeout(() => {
                    window.location.assign('/admin/recetas');
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

        const cantidad = document.createElement('input');
        cantidad.type = 'number';
        cantidad.className = 'form-control form-control-sm';
        cantidad.min = '0.001';
        cantidad.step = '0.001';
        cantidad.inputMode = 'decimal';
        cantidad.value = ingrediente?.unidad === 'al_gusto' ? '' : String(ingrediente?.cantidad ?? 1);
        cantidad.dataset.ingCantidad = '';

        const unidad = document.createElement('select');
        unidad.className = 'form-select form-select-sm';
        unidad.dataset.ingUnidad = '';
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
