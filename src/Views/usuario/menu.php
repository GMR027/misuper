<?php

declare(strict_types=1);

use App\Middleware\AuthMiddleware;

$usuario = $usuario ?? AuthMiddleware::usuario();

if ($usuario === null) {
    header('Location: /login', true, 302);

    return;
}

ob_start();
?>
<div class="container py-4 menu-page" data-menu data-rol="<?= htmlspecialchars((string) ($usuario['rol'] ?? 'usuario'), ENT_QUOTES, 'UTF-8') ?>">
    <div class="menu-head">
        <div>
            <h2 class="mb-1">
                <span class="title-icon"><i class="bi bi-calendar3-week-fill" aria-hidden="true"></i></span>
                Menú semanal
            </h2>
            <p class="text-muted mb-0">
                Planea desayuno, comida y cena. El costo sale de tus compras; si falta un
                precio, se muestra como parcial.
            </p>
        </div>
        <div class="menu-head__links">
            <a class="btn btn-outline-secondary" href="/recetas">
                <i class="bi bi-egg-fried" aria-hidden="true"></i>
                Recetas
            </a>
            <a class="btn btn-outline-secondary" href="/costos">
                <i class="bi bi-tags-fill" aria-hidden="true"></i>
                Costos
            </a>
        </div>
    </div>

    <div class="menu-toolbar">
        <div class="menu-weeknav">
            <button class="btn btn-outline-secondary btn-sm" type="button" data-menu-prev aria-label="Semana anterior">
                <i class="bi bi-chevron-left" aria-hidden="true"></i>
            </button>
            <div class="menu-weeknav__label">
                <strong data-menu-rango>Esta semana</strong>
                <span class="text-muted small" data-menu-status aria-live="polite"></span>
            </div>
            <button class="btn btn-outline-secondary btn-sm" type="button" data-menu-next aria-label="Semana siguiente">
                <i class="bi bi-chevron-right" aria-hidden="true"></i>
            </button>
            <button class="btn btn-sm btn-outline-primary" type="button" data-menu-hoy>
                Hoy
            </button>
        </div>

        <div class="menu-toolbar__actions">
            <button class="btn btn-sm btn-outline-secondary" type="button" data-menu-copiar>
                <i class="bi bi-files" aria-hidden="true"></i>
                Copiar semana anterior
            </button>
            <button class="btn btn-sm btn-outline-danger" type="button" data-menu-vaciar>
                <i class="bi bi-eraser" aria-hidden="true"></i>
                Vaciar
            </button>
            <button class="btn btn-sm btn-primary" type="button" data-menu-lista>
                <i class="bi bi-cart-plus" aria-hidden="true"></i>
                Generar lista
            </button>
            <?php if (($usuario['rol'] ?? '') === 'admin'): ?>
                <button class="btn btn-sm btn-outline-primary" type="button" data-menu-ia hidden>
                    <i class="bi bi-stars" aria-hidden="true"></i>
                    Sugerir con IA
                </button>
            <?php endif; ?>
        </div>
    </div>

    <div class="menu-stats" aria-label="Resumen de la semana">
        <div class="menu-stat">
            <span class="menu-stat__label">Platillos</span>
            <strong class="menu-stat__value" data-menu-stat-items>—</strong>
        </div>
        <div class="menu-stat">
            <span class="menu-stat__label">Recetas</span>
            <strong class="menu-stat__value" data-menu-stat-recetas>—</strong>
        </div>
        <div class="menu-stat">
            <span class="menu-stat__label">Costo estimado</span>
            <strong class="menu-stat__value" data-menu-stat-total>—</strong>
            <small class="menu-stat__nota" data-menu-stat-nota></small>
        </div>
        <div class="menu-stat">
            <span class="menu-stat__label">Sin precio</span>
            <strong class="menu-stat__value" data-menu-stat-sin>—</strong>
        </div>
    </div>

    <div class="menu-tabs" data-menu-tabs role="tablist" aria-label="Días de la semana"></div>

    <div class="menu-week" data-menu-week></div>

    <p class="text-muted small mt-3 mb-0">
        Los tipos de dieta son orientativos. El cálculo de costo usa la mediana de tus
        últimas compras y puede quedar parcial si falta algún precio.
    </p>
</div>

<div class="app-modal" data-menu-picker hidden role="dialog" aria-modal="true" aria-labelledby="menu-picker-title">
    <div class="modal-dialog modal-dialog-centered modal-lg">
        <div class="modal-content">
            <div class="modal-header">
                <div>
                    <h5 class="modal-title" id="menu-picker-title" data-menu-picker-title>Agregar al menú</h5>
                    <p class="text-muted small mb-0" data-menu-picker-subtitle></p>
                </div>
                <button class="btn-close" type="button" data-menu-picker-close aria-label="Cerrar"></button>
            </div>
            <div class="modal-body">
                <div class="menu-picker__filtros">
                    <label class="visually-hidden" for="menu-picker-buscar">Buscar receta</label>
                    <input
                        class="form-control"
                        type="search"
                        id="menu-picker-buscar"
                        placeholder="Buscar receta o ingrediente…"
                        autocomplete="off"
                        data-menu-picker-buscar
                    >
                    <label class="visually-hidden" for="menu-picker-tiempo">Tiempo máximo</label>
                    <select class="form-select" id="menu-picker-tiempo" data-menu-picker-tiempo>
                        <option value="">Cualquier tiempo</option>
                        <option value="20">Hasta 20 min</option>
                        <option value="30">Hasta 30 min</option>
                        <option value="45">Hasta 45 min</option>
                        <option value="60">Hasta 60 min</option>
                    </select>
                    <label class="menu-picker__check">
                        <input class="form-check-input" type="checkbox" data-menu-picker-favoritas>
                        Favoritas
                    </label>
                    <label class="menu-picker__check">
                        <input class="form-check-input" type="checkbox" data-menu-picker-despensa>
                        Con mi despensa
                    </label>
                </div>

                <p class="text-muted small" data-menu-picker-status aria-live="polite"></p>
                <div class="menu-picker__resultados" data-menu-picker-resultados></div>

                <form class="menu-picker__nota" data-menu-nota-form>
                    <label class="form-label" for="menu-nota-input">O agrega una nota</label>
                    <div class="input-group">
                        <input
                            class="form-control"
                            type="text"
                            id="menu-nota-input"
                            maxlength="160"
                            placeholder="Ej. Comer fuera, sobras, cumpleaños…"
                            data-menu-nota-input
                        >
                        <button class="btn btn-outline-primary" type="submit">
                            <i class="bi bi-sticky" aria-hidden="true"></i>
                            Agregar nota
                        </button>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button class="btn btn-outline-secondary" type="button" data-menu-picker-close>Cerrar</button>
            </div>
        </div>
    </div>
</div>

<div class="app-modal" data-menu-item-modal hidden role="dialog" aria-modal="true" aria-labelledby="menu-item-title">
    <div class="modal-dialog modal-dialog-centered">
        <form class="modal-content" data-menu-item-form>
            <div class="modal-header">
                <h5 class="modal-title" id="menu-item-title" data-menu-item-title>Editar platillo</h5>
                <button class="btn-close" type="button" data-menu-item-close aria-label="Cerrar"></button>
            </div>
            <div class="modal-body">
                <p class="text-muted small" data-menu-item-aviso hidden></p>

                <div class="mb-3" data-menu-item-porciones-wrap>
                    <label class="form-label" for="menu-item-porciones">Porciones</label>
                    <input
                        class="form-control"
                        type="number"
                        id="menu-item-porciones"
                        min="1"
                        max="50"
                        step="1"
                        data-menu-item-porciones
                    >
                </div>

                <div class="row g-2 mb-3">
                    <div class="col-6">
                        <label class="form-label" for="menu-item-dia">Día</label>
                        <select class="form-select" id="menu-item-dia" data-menu-item-dia>
                            <option value="1">Lunes</option>
                            <option value="2">Martes</option>
                            <option value="3">Miércoles</option>
                            <option value="4">Jueves</option>
                            <option value="5">Viernes</option>
                            <option value="6">Sábado</option>
                            <option value="7">Domingo</option>
                        </select>
                    </div>
                    <div class="col-6">
                        <label class="form-label" for="menu-item-momento">Comida</label>
                        <select class="form-select" id="menu-item-momento" data-menu-item-momento>
                            <option value="desayuno">Desayuno</option>
                            <option value="comida">Comida</option>
                            <option value="cena">Cena</option>
                            <option value="colacion">Colación</option>
                            <option value="otro">Otro</option>
                        </select>
                    </div>
                </div>

                <div class="mb-3">
                    <label class="form-label" for="menu-item-etiqueta">Etiqueta del tiempo extra</label>
                    <input
                        class="form-control"
                        type="text"
                        id="menu-item-etiqueta"
                        maxlength="30"
                        placeholder="Ej. Postre, comida especial"
                        data-menu-item-etiqueta
                    >
                    <p class="form-text">Solo se usa con Colación u Otro.</p>
                </div>

                <div class="mb-3">
                    <label class="form-label" for="menu-item-nota">Nota</label>
                    <input
                        class="form-control"
                        type="text"
                        id="menu-item-nota"
                        maxlength="160"
                        placeholder="Opcional"
                        data-menu-item-nota
                    >
                </div>

                <p class="form__message mb-0" data-menu-item-error hidden></p>
            </div>
            <div class="modal-footer menu-item__footer">
                <button class="btn btn-outline-primary me-auto" type="button" data-menu-item-reemplazar hidden>
                    <i class="bi bi-arrow-repeat" aria-hidden="true"></i>
                    Reemplazar receta
                </button>
                <button class="btn btn-outline-danger me-auto" type="button" data-menu-item-borrar>
                    <i class="bi bi-trash3" aria-hidden="true"></i>
                    Quitar
                </button>
                <button class="btn btn-outline-secondary" type="button" data-menu-item-close>Cancelar</button>
                <button class="btn btn-primary" type="submit">
                    <i class="bi bi-check2-circle" aria-hidden="true"></i>
                    Guardar
                </button>
            </div>
        </form>
    </div>
</div>

<?php if (($usuario['rol'] ?? '') === 'admin'): ?>
<div class="app-modal" data-menu-ia-modal hidden role="dialog" aria-modal="true" aria-labelledby="menu-ia-title">
    <div class="modal-dialog modal-dialog-centered modal-lg">
        <form class="modal-content" data-menu-ia-form>
            <div class="modal-header">
                <div>
                    <h5 class="modal-title" id="menu-ia-title">
                        <i class="bi bi-stars" aria-hidden="true"></i>
                        Sugerir semana con IA
                    </h5>
                    <p class="text-muted small mb-0" data-menu-ia-subtitle>
                        La IA se ejecuta en Mi Súper Desktop y solo puede elegir recetas de tu recetario.
                    </p>
                </div>
                <button class="btn-close" type="button" data-menu-ia-close aria-label="Cerrar"></button>
            </div>
            <div class="modal-body">
                <div class="alert alert-info py-2 small">
                    El menú no se guarda hasta que lo apruebes. Los precios se calculan después,
                    con tus compras; la IA no inventa costos.
                </div>

                <fieldset class="mb-3">
                    <legend class="form-label">Qué quieres hacer</legend>
                    <label class="menu-ia__radio">
                        <input class="form-check-input" type="radio" name="menu-ia-modo" value="completar" checked>
                        Completar solo los tiempos vacíos
                    </label>
                    <label class="menu-ia__radio">
                        <input class="form-check-input" type="radio" name="menu-ia-modo" value="reemplazar">
                        Reemplazar toda la semana
                    </label>
                </fieldset>

                <div class="row g-3 mb-3">
                    <div class="col-6 col-md-3">
                        <label class="form-label" for="menu-ia-personas">Porciones</label>
                        <input class="form-control" type="number" id="menu-ia-personas" min="1" max="12" value="4" data-menu-ia-personas>
                    </div>
                    <div class="col-6 col-md-3">
                        <label class="form-label" for="menu-ia-tiempo">Tiempo máximo</label>
                        <select class="form-select" id="menu-ia-tiempo" data-menu-ia-tiempo>
                            <option value="0">Sin límite</option>
                            <option value="20">20 min</option>
                            <option value="30">30 min</option>
                            <option value="45">45 min</option>
                            <option value="60">60 min</option>
                        </select>
                    </div>
                    <div class="col-12 col-md-6 d-flex flex-wrap align-items-end gap-3">
                        <label class="menu-picker__check">
                            <input class="form-check-input" type="checkbox" data-menu-ia-favoritas>
                            Solo favoritas
                        </label>
                        <label class="menu-picker__check">
                            <input class="form-check-input" type="checkbox" data-menu-ia-evitar checked>
                            Evitar repetir
                        </label>
                    </div>
                </div>

                <p class="text-muted small" data-menu-ia-status aria-live="polite"></p>
                <p class="form__message mb-0" data-menu-ia-error hidden></p>

                <div class="menu-ia__resultados" data-menu-ia-resultados hidden>
                    <h6 class="mb-2">Propuesta</h6>
                    <div class="menu-lista__items" data-menu-ia-lista></div>
                    <p class="text-muted small mt-2 mb-0" data-menu-ia-resumen></p>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-outline-secondary" type="button" data-menu-ia-close>Cancelar</button>
                <button class="btn btn-outline-primary" type="submit" data-menu-ia-generar>
                    <i class="bi bi-stars" aria-hidden="true"></i>
                    Generar propuesta
                </button>
                <button class="btn btn-primary" type="button" data-menu-ia-aplicar hidden>
                    <i class="bi bi-check2-circle" aria-hidden="true"></i>
                    Aplicar al menú
                </button>
            </div>
        </form>
    </div>
</div>

<?php endif; ?>

<div class="app-modal" data-menu-lista-modal hidden role="dialog" aria-modal="true" aria-labelledby="menu-lista-title">
    <div class="modal-dialog modal-dialog-centered modal-lg">
        <form class="modal-content" data-menu-lista-form>
            <div class="modal-header">
                <div>
                    <h5 class="modal-title" id="menu-lista-title">Lista de la semana</h5>
                    <p class="text-muted small mb-0" data-menu-lista-subtitle></p>
                </div>
                <button class="btn-close" type="button" data-menu-lista-close aria-label="Cerrar"></button>
            </div>
            <div class="modal-body">
                <p class="text-muted small" data-menu-lista-status aria-live="polite"></p>
                <div class="menu-lista__items" data-menu-lista-items></div>

                <div class="menu-lista__resumen">
                    <span>Total estimado</span>
                    <strong data-menu-lista-total>—</strong>
                    <small data-menu-lista-aviso></small>
                </div>

                <div class="row g-3 mt-1">
                    <div class="col-12 col-md-6">
                        <label class="form-label" for="menu-lista-destino">Guardar en</label>
                        <select class="form-select" id="menu-lista-destino" data-menu-lista-destino>
                            <option value="__nueva__">Nueva lista…</option>
                        </select>
                    </div>
                    <div class="col-12 col-md-6" data-menu-lista-nombre-wrap>
                        <label class="form-label" for="menu-lista-nombre">Nombre de la lista</label>
                        <input
                            class="form-control"
                            type="text"
                            id="menu-lista-nombre"
                            maxlength="100"
                            data-menu-lista-nombre
                        >
                    </div>
                </div>

                <p class="form__message mb-0" data-menu-lista-error hidden></p>
            </div>
            <div class="modal-footer">
                <button class="btn btn-outline-secondary" type="button" data-menu-lista-close>Cancelar</button>
                <button class="btn btn-primary" type="submit">
                    <i class="bi bi-cart-plus" aria-hidden="true"></i>
                    Crear lista
                </button>
            </div>
        </form>
    </div>
</div>

<div class="toast-stack" data-toast-stack aria-live="polite"></div>
<?php

$content = (string) ob_get_clean();
$title = 'Menú semanal';
$scripts = ['/assets/js/pages/menu.js'];
$styles = ['/assets/css/menu.css'];
$active = 'menu';

require __DIR__ . '/../layouts/app.php';
