/**
 * Slider horizontal de navegación: arrastre con ratón/dedo y rueda.
 */

const nav = document.querySelector('[data-nav-slider]');

if (nav instanceof HTMLElement) {
    init(nav);
}

/**
 * @param {HTMLElement} nav
 */
function init(nav) {
    let down = false;
    let moved = false;
    let suppressClick = false;
    let startX = 0;
    let startLeft = 0;
    let pointerId = null;

    const threshold = 6;

    nav.addEventListener('pointerdown', (event) => {
        if (event.pointerType === 'mouse' && event.button !== 0) {
            return;
        }

        down = true;
        moved = false;
        startX = event.clientX;
        startLeft = nav.scrollLeft;
        pointerId = event.pointerId;
        nav.classList.add('is-dragging');
    });

    window.addEventListener('pointermove', (event) => {
        if (!down || event.pointerId !== pointerId) {
            return;
        }

        const delta = event.clientX - startX;

        if (Math.abs(delta) <= threshold) {
            return;
        }

        moved = true;
        suppressClick = true;
        nav.scrollLeft = startLeft - delta;

        if (event.cancelable) {
            event.preventDefault();
        }
    }, { passive: false });

    const end = (event) => {
        if (!down || (event instanceof PointerEvent && event.pointerId !== pointerId)) {
            return;
        }

        down = false;
        pointerId = null;
        nav.classList.remove('is-dragging');

        if (moved) {
            window.setTimeout(() => {
                suppressClick = false;
            }, 0);
        }
    };

    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);

    nav.addEventListener('click', (event) => {
        if (!suppressClick) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        suppressClick = false;
    }, true);

    nav.addEventListener('wheel', (event) => {
        if (nav.scrollWidth <= nav.clientWidth) {
            return;
        }

        if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) {
            return;
        }

        event.preventDefault();
        nav.scrollLeft += event.deltaY;
    }, { passive: false });
}
