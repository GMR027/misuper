<?php

declare(strict_types=1);

use App\Middleware\AuthMiddleware;

$usuario = AuthMiddleware::require();

ob_start();
?>
<div class="container-fluid quick-page py-3 py-lg-4" data-quick>
    <section class="hero-card quick-hero mb-4" aria-labelledby="hero-title">
        <div class="hero-content">
            <span class="hero-eyebrow">
                <i class="bi bi-lightning-charge-fill" aria-hidden="true"></i>
                Captura rápida
            </span>
            <h1 class="hero-title" id="hero-title">¿Qué compraste hoy?</h1>
            <p class="hero-text">
                Busca productos, ajusta cantidades y guarda la compra completa en un solo paso.
            </p>

            <div class="hero-actions">
                <button class="btn btn-light" type="button" id="btn-add-custom" data-libre-open>
                    <i class="bi bi-plus-lg" aria-hidden="true"></i>
                    Nuevo producto
                </button>
            </div>
        </div>

        <a class="hero-summary" href="#carrito" aria-live="polite">
            <span class="hero-summary__label">
                <i class="bi bi-receipt-cutoff" aria-hidden="true"></i>
                Importe del carrito
            </span>
            <strong class="hero-summary__value" data-carrito-hero-total>$0.00</strong>
            <span class="hero-summary__meta">
                <span data-carrito-hero-count>0 ítems</span>
                <i class="bi bi-arrow-down-short" aria-hidden="true"></i>
            </span>
        </a>
        <i class="bi bi-basket2-fill hero-art" aria-hidden="true"></i>
    </section>

    <section class="quick-toolbar" aria-label="Buscador de productos">
        <form class="quick-toolbar__search mb-3" data-search-form role="search" novalidate>
            <button
                class="btn quick-toolbar__menu"
                type="button"
                data-quick-menu
                aria-label="Abrir menú"
                title="Menú"
            >
                <i class="bi bi-list" aria-hidden="true"></i>
            </button>

            <label class="visually-hidden" for="buscador">Buscar producto</label>
            <div class="input-group input-group-lg search-box quick-search-box">
                <span class="input-group-text" aria-hidden="true"><i class="bi bi-search"></i></span>
                <input
                    class="form-control"
                    type="search"
                    id="buscador"
                    name="q"
                    placeholder="Busca leche, jitomate, arroz…"
                    autocomplete="off"
                    spellcheck="false"
                    data-buscador
                >
            </div>

            <button
                class="btn btn-primary quick-toolbar__new"
                type="button"
                data-libre-open
                aria-label="Nuevo producto"
                title="Nuevo producto"
            >
                <i class="bi bi-plus-lg" aria-hidden="true"></i>
            </button>

            <button
                class="btn btn-outline-secondary quick-toolbar__toggle quick-toolbar__categorias"
                type="button"
                data-categorias-open
                aria-label="Abrir categorías"
            >
                <i class="bi bi-grid-3x3-gap" aria-hidden="true"></i>
                <span>Categorías</span>
            </button>

            <button class="quick-toolbar__cart" type="button" data-cart-open aria-label="Abrir carrito">
                <span class="quick-toolbar__cart-meta">
                    <i class="bi bi-bag-check-fill" aria-hidden="true"></i>
                    <span data-carrito-hero-count>0 ítems</span>
                </span>
                <strong data-carrito-hero-total>$0.00</strong>
            </button>
        </form>

        <div
            class="quick-chips d-flex overflow-auto gap-2 mb-4 pb-2"
            data-categorias
            role="group"
            aria-label="Filtrar por categoría"
        >
            <span class="text-muted small py-2">Cargando categorías…</span>
        </div>
    </section>

    <section class="quick-frequent-inline mb-4" data-frecuentes hidden aria-labelledby="frecuentes-title">
        <div class="d-flex flex-wrap justify-content-between align-items-baseline gap-2 mb-2">
            <h5 class="mb-0" id="frecuentes-title">
                <span class="title-icon"><i class="bi bi-stars" aria-hidden="true"></i></span>
                Compras frecuentes
            </h5>
            <p class="text-muted small mb-0">Lo que más compras, a un toque.</p>
        </div>
        <div class="d-flex overflow-auto gap-2 pb-2" data-frecuentes-grid></div>
    </section>

    <div class="quick-layout">
        <div class="quick-results-col">
            <section aria-labelledby="resultados-title">
                <div class="quick-results-head">
                    <h5 class="mb-0" id="resultados-title">
                        <button
                            class="title-icon title-icon--button"
                            type="button"
                            data-toggle-vista
                            aria-pressed="false"
                            aria-label="Ver productos en lista"
                            title="Ver productos en lista"
                        >
                            <i class="bi bi-list-ul" aria-hidden="true" data-vista-icon></i>
                        </button>
                        Resultados
                    </h5>
                    <p class="text-muted small mb-0" data-resultados-status>
                        Escribe un producto o elige una categoría.
                    </p>
                </div>

                <div class="row g-3 quick-results" data-resultados></div>
            </section>
        </div>

        <div class="quick-cart-col">
            <aside class="card card--bs cart-panel quick-cart" id="carrito" data-carrito data-cart-sheet aria-labelledby="carrito-title">
                <div class="card-body">
                    <div class="cart-panel__head">
                        <div class="cart-panel__heading">
                            <span class="cart-panel__icon" aria-hidden="true">
                                <i class="bi bi-bag-check-fill"></i>
                            </span>
                            <div>
                                <h5 class="card-title mb-0" id="carrito-title">Tu carrito</h5>
                                <p class="cart-panel__subtitle">Ajusta cantidades y precios con un toque.</p>
                            </div>
                        </div>
                        <div class="quick-cart__head-actions">
                            <span class="badge cart-panel__badge" data-carrito-count>0 ítems</span>
                            <button class="quick-cart__close" type="button" data-cart-close aria-label="Cerrar carrito">
                                <i class="bi bi-x-lg" aria-hidden="true"></i>
                            </button>
                        </div>
                    </div>

                    <div class="cart-panel__body">
                        <div class="cart-empty" data-carrito-vacio>
                            <i class="bi bi-basket" aria-hidden="true"></i>
                            <p class="mb-0">Tu carrito está vacío.</p>
                            <p class="cart-empty__hint mb-0">
                                Agrega productos desde los resultados o desde tus compras frecuentes.
                            </p>
                        </div>

                        <ul class="list-unstyled cart-list" data-carrito-items></ul>
                    </div>

                    <div class="cart-panel__footer">
                        <div class="cart-total">
                            <div class="cart-total__caption">
                                <span class="cart-total__label">Importe total</span>
                                <span class="cart-total__hint">Se guarda con la fecha de la compra</span>
                            </div>
                            <strong class="cart-total__value" data-carrito-total>$0.00</strong>
                        </div>

                        <button class="btn btn-success w-100 cart-save" type="button" data-guardar disabled>
                            <i class="bi bi-check2-circle" aria-hidden="true"></i>
                            Guardar compra
                        </button>

                        <p class="cart-panel__hint mb-0">
                            <i class="bi bi-pencil-square" aria-hidden="true"></i>
                            Edita la cantidad o el precio directamente.
                        </p>
                    </div>
                </div>
            </aside>
        </div>
    </div>

    <button class="quick-bottom-bar" type="button" data-cart-open aria-label="Abrir carrito">
        <span class="quick-bottom-bar__summary">
            <i class="bi bi-bag-check-fill" aria-hidden="true"></i>
            <span data-carrito-hero-count>0 ítems</span>
        </span>
        <strong data-carrito-hero-total>$0.00</strong>
        <span class="quick-bottom-bar__cta">
            Ver carrito
            <i class="bi bi-chevron-up" aria-hidden="true"></i>
        </span>
    </button>
</div>

<div class="quick-sheet-backdrop" data-cart-backdrop hidden></div>
<div class="quick-sheet-backdrop" data-categorias-backdrop hidden></div>

<section class="quick-sheet quick-sheet--categorias" data-categorias-sheet hidden role="dialog" aria-modal="true" aria-labelledby="quick-categorias-title">
    <div class="quick-sheet__panel">
        <span class="quick-sheet__grabber" aria-hidden="true"></span>
        <header class="quick-sheet__head">
            <h2 class="quick-sheet__title" id="quick-categorias-title">
                <i class="bi bi-grid-3x3-gap" aria-hidden="true"></i>
                Categorías
            </h2>
            <button class="quick-sheet__close" type="button" data-categorias-close aria-label="Cerrar categorías">
                <i class="bi bi-x-lg" aria-hidden="true"></i>
            </button>
        </header>
        <div class="quick-sheet__body">
            <div class="quick-chips quick-chips--sheet" data-categorias-sheet-grid role="group" aria-label="Filtrar por categoría">
                <span class="text-muted small py-2">Cargando categorías…</span>
            </div>
        </div>
    </div>
</section>

<div class="toast-stack" data-toast-stack aria-live="polite"></div>

<div class="app-modal" data-modal-continuar hidden role="dialog" aria-modal="true" aria-labelledby="continuar-title">
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
            <div class="modal-body p-4">
                <h5 class="modal-title mb-2" id="continuar-title">Tienes una compra sin guardar</h5>
                <p class="text-muted small">
                    Encontramos productos en tu carrito anterior. ¿Quieres continuar con esa compra
                    o empezar una nueva?
                </p>
                <div class="d-flex flex-wrap gap-2">
                    <button class="btn btn-primary flex-grow-1" type="button" data-continuar>Continuar compra</button>
                    <button class="btn btn-outline-secondary flex-grow-1" type="button" data-nueva>Empezar nueva</button>
                </div>
            </div>
        </div>
    </div>
</div>

<div class="app-modal quick-form-modal" data-modal-libre hidden role="dialog" aria-modal="true" aria-labelledby="libre-title">
    <div class="modal-dialog modal-dialog-centered">
        <form class="modal-content" data-form-libre novalidate>
            <div class="modal-body p-4">
                <h5 class="modal-title mb-2" id="libre-title">Nuevo producto</h5>
                <p class="text-muted small">
                    Se guardará como producto propio y se agregará a tu carrito.
                </p>

                <div class="mb-3">
                    <label class="form-label" for="libre-nombre">Nombre</label>
                    <input
                        class="form-control"
                        type="text"
                        id="libre-nombre"
                        name="nombre"
                        maxlength="150"
                        minlength="2"
                        autocomplete="off"
                        required
                        data-libre-nombre
                    >
                </div>

                <div class="row g-2 mb-2">
                    <div class="col-12 col-sm-6">
                        <label class="form-label" for="libre-categoria">Categoría</label>
                        <select class="form-select" id="libre-categoria" name="categoria_id" required data-libre-categoria>
                            <option value="">Elige categoría</option>
                        </select>
                    </div>

                    <div class="col-12 col-sm-6">
                        <label class="form-label" for="libre-unidad">Unidad base</label>
                        <select class="form-select" id="libre-unidad" name="unidad_base" data-libre-unidad>
                            <option value="kg">kg — kilogramo</option>
                            <option value="gr">gr — gramo</option>
                            <option value="L">L — litro</option>
                            <option value="ml">ml — mililitro</option>
                            <option value="pza" selected>pza — pieza</option>
                        </select>
                    </div>
                </div>

                <div class="row g-2">
                    <div class="col-6">
                        <label class="form-label" for="libre-cantidad">Cantidad</label>
                        <input
                            class="form-control"
                            type="number"
                            id="libre-cantidad"
                            name="cantidad"
                            min="0.001"
                            step="0.001"
                            inputmode="decimal"
                            value="1"
                            required
                            data-libre-cantidad
                        >
                    </div>

                    <div class="col-6">
                        <label class="form-label" for="libre-precio">Precio total</label>
                        <input
                            class="form-control"
                            type="number"
                            id="libre-precio"
                            name="precio_total"
                            min="0"
                            step="0.01"
                            inputmode="decimal"
                            placeholder="0.00"
                            required
                            data-libre-precio
                        >
                    </div>
                </div>

                <p class="form__message mt-3 mb-0" data-libre-error hidden></p>
            </div>

            <div class="modal-footer">
                <button class="btn btn-outline-secondary" type="button" data-close-libre>Cancelar</button>
                <button class="btn btn-primary" type="submit">Registrar y agregar</button>
            </div>
        </form>
    </div>
</div>

<div class="app-modal quick-form-modal" data-modal-calc hidden role="dialog" aria-modal="true" aria-labelledby="calc-title">
    <div class="modal-dialog modal-dialog-centered">
        <form class="modal-content" data-form-calc novalidate>
            <div class="modal-body p-4">
                <h5 class="modal-title mb-2" id="calc-title">Calcular compra</h5>
                <p class="text-muted small mb-3">
                    <span class="fw-semibold" data-calc-producto>Producto</span>
                    <span class="d-block" data-calc-detalle></span>
                </p>

                <div class="row g-2">
                    <div class="col-12 col-sm-6">
                        <label class="form-label" for="calc-precio" data-calc-precio-label>Costo por unidad</label>
                        <div class="input-group">
                            <span class="input-group-text">$</span>
                            <input
                                class="form-control"
                                type="number"
                                id="calc-precio"
                                name="precio_unidad"
                                min="0"
                                step="0.01"
                                inputmode="decimal"
                                placeholder="0.00"
                                required
                                data-calc-precio
                            >
                        </div>
                    </div>

                    <div class="col-12 col-sm-6">
                        <label class="form-label" for="calc-cantidad">Cantidad comprada</label>
                        <div class="input-group">
                            <input
                                class="form-control"
                                type="number"
                                id="calc-cantidad"
                                name="cantidad"
                                min="0.001"
                                step="0.001"
                                inputmode="decimal"
                                value="1"
                                required
                                data-calc-cantidad
                            >
                            <span class="input-group-text" data-calc-unidad>pza</span>
                        </div>
                    </div>
                </div>

                <div class="calc-result mt-3" aria-live="polite">
                    <span class="calc-result__caption">Importe a pagar</span>
                    <strong class="calc-result__value" data-calc-total>—</strong>
                </div>

                <p class="calc-hint text-muted small mt-2 mb-0" data-calc-formula></p>
                <p class="calc-hint text-muted small mt-1 mb-0" data-calc-precio-hint></p>
                <p class="form__message mt-2 mb-0" data-calc-error hidden></p>
            </div>

            <div class="modal-footer">
                <button class="btn btn-outline-secondary" type="button" data-close-calc>Cancelar</button>
                <button class="btn btn-primary" type="submit">Agregar al carrito</button>
            </div>
        </form>
    </div>
</div>

<div class="app-modal" data-modal-fecha hidden role="dialog" aria-modal="true" aria-labelledby="fecha-title">
    <div class="modal-dialog modal-dialog-centered">
        <form class="modal-content" data-form-fecha novalidate>
            <div class="modal-body p-4">
                <h5 class="modal-title mb-2" id="fecha-title">Guardar compra</h5>
                <p class="text-muted small">
                    Elige la fecha de la compra. Se guardarán todos los ítems del carrito.
                </p>

                <div class="mb-3">
                    <label class="form-label" for="fecha-compra">Fecha</label>
                    <input class="form-control" type="date" id="fecha-compra" name="fecha" required max="<?= (new DateTimeImmutable('today'))->format('Y-m-d') ?>" data-fecha>
                </div>

                <div class="mb-3">
                    <label class="form-label" for="comercio-compra">Comercio <span class="text-muted">(opcional)</span></label>
                    <input
                        class="form-control"
                        type="text"
                        id="comercio-compra"
                        name="comercio"
                        maxlength="120"
                        autocomplete="off"
                        list="comercios-conocidos"
                        placeholder="Ej. Mercado, Súper, tienda de la esquina"
                        data-comercio
                    >
                    <datalist id="comercios-conocidos" data-comercios></datalist>
                    <p class="form-text">Sirve para comparar precios entre tiendas.</p>
                </div>

                <p class="form__message mb-0" data-fecha-error hidden></p>
            </div>

            <div class="modal-footer">
                <button class="btn btn-outline-secondary" type="button" data-close-fecha>Cancelar</button>
                <button class="btn btn-success" type="submit" data-confirmar-fecha>Guardar compra</button>
            </div>
        </form>
    </div>
</div>
<?php

$content = (string) ob_get_clean();
$title = 'Pantalla rápida';
$scripts = ['/assets/js/pages/pantalla-rapida.js'];
$styles = ['/assets/css/pantalla-rapida.css'];
$active = 'inicio';

require __DIR__ . '/../layouts/app.php';
