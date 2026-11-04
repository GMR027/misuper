/**
 * password-toggle.js — muestra u oculta contraseñas.
 *
 * Añade un botón de ojo a cada input[type="password"] de la página. Es
 * accesible con teclado, conserva el foco en el campo y no altera el envío
 * del formulario (el botón nunca es de tipo submit).
 */

const ICONO_MOSTRAR = 'bi-eye';
const ICONO_OCULTAR = 'bi-eye-slash';

for (const input of document.querySelectorAll('input[type="password"]')) {
    if (!(input instanceof HTMLInputElement) || input.disabled || input.dataset.passwordToggle === '1') {
        continue;
    }

    input.dataset.passwordToggle = '1';

    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'btn btn-outline-secondary password-field__toggle';
    boton.setAttribute('aria-label', 'Mostrar contraseña');
    boton.setAttribute('aria-pressed', 'false');
    boton.title = 'Mostrar contraseña';
    boton.innerHTML = `<i class="bi ${ICONO_MOSTRAR}" aria-hidden="true"></i>`;

    const padre = input.parentNode;

    if (!(padre instanceof HTMLElement)) {
        continue;
    }

    if (padre.classList.contains('input-group')) {
        padre.appendChild(boton);
    } else {
        const grupo = document.createElement('div');
        grupo.className = 'input-group password-field';
        padre.insertBefore(grupo, input);
        grupo.append(input, boton);
    }

    boton.addEventListener('click', () => {
        const visible = input.type === 'text';

        input.type = visible ? 'password' : 'text';
        boton.setAttribute('aria-pressed', visible ? 'false' : 'true');
        boton.setAttribute('aria-label', visible ? 'Mostrar contraseña' : 'Ocultar contraseña');
        boton.title = visible ? 'Mostrar contraseña' : 'Ocultar contraseña';
        boton.innerHTML = `<i class="bi ${visible ? ICONO_MOSTRAR : ICONO_OCULTAR}" aria-hidden="true"></i>`;

        // Mantiene la posición del cursor al alternar la visibilidad.
        input.focus({ preventScroll: true });
    });
}
