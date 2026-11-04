<?php

declare(strict_types=1);

use App\Middleware\AuthMiddleware;

$usuario = $usuario ?? AuthMiddleware::usuario();

if ($usuario === null) {
    header('Location: /login', true, 302);

    return;
}

$anioActual = (int) ($anioActual ?? (int) date('Y'));
$mesActual = (int) ($mesActual ?? (int) date('n'));
$anios = $anios ?? range(2020, max(2020, $anioActual));

$meses = [
    1 => 'enero',
    2 => 'febrero',
    3 => 'marzo',
    4 => 'abril',
    5 => 'mayo',
    6 => 'junio',
    7 => 'julio',
    8 => 'agosto',
    9 => 'septiembre',
    10 => 'octubre',
    11 => 'noviembre',
    12 => 'diciembre',
];

ob_start();
?>
<div class="container py-4" data-metricas>
    <h2 class="mb-4">
        <span class="title-icon"><i class="bi bi-graph-up-arrow" aria-hidden="true"></i></span>
        Mis métricas
    </h2>

    <section class="mb-5" aria-labelledby="metrics-anual-title">
        <div class="d-flex flex-wrap justify-content-between align-items-end gap-3 mb-3">
            <div>
                <h5 class="mb-1" id="metrics-anual-title">
                    <span class="title-icon"><i class="bi bi-calendar-range" aria-hidden="true"></i></span>
                    Gasto anual
                </h5>
                <p class="text-muted small mb-0">
                    Comparativa con los tres años anteriores al año seleccionado.
                </p>
            </div>
        </div>

        <div class="row g-3">
            <div class="col-12 col-lg-4">
                <div class="card h-100 metrics-summary">
                    <div class="card-body">
                        <p class="text-muted small text-uppercase mb-1">
                            Total <span data-anual-year><?= $anioActual ?></span>
                        </p>
                        <p class="display-6 fw-bold mb-2" data-anual-total>—</p>
                        <p class="small mb-1" data-anual-variacion></p>
                        <p class="text-muted small mb-0" data-anual-promedio></p>

                        <div class="metrics-summary__stats">
                            <div>
                                <span class="metrics-summary__caption">Promedio mensual</span>
                                <strong class="metrics-summary__value" data-anual-mensual>—</strong>
                            </div>
                            <div>
                                <span class="metrics-summary__caption">Mes más alto</span>
                                <strong class="metrics-summary__value" data-anual-mejor>—</strong>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="col-12 col-lg-8">
                <div class="card h-100">
                    <div class="card-body">
                        <p class="text-muted small mb-2">Los tres años anteriores y el año seleccionado</p>
                        <div class="d-flex flex-column gap-3" data-anual-list></div>
                        <p class="text-muted small mt-3 mb-0" data-anual-status>Cargando gasto anual…</p>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <section class="mb-5" aria-labelledby="metrics-gasto-title">
        <div class="d-flex flex-wrap justify-content-between align-items-end gap-3 mb-3">
            <div>
                <h5 class="mb-1" id="metrics-gasto-title">
                    <span class="title-icon"><i class="bi bi-calendar3" aria-hidden="true"></i></span>
                    Gasto por mes
                </h5>
                <p class="text-muted small mb-0">
                    Total de tus compras registradas en el año seleccionado.
                </p>
            </div>

            <div>
                <label class="form-label" for="select-anio">Año</label>
                <select class="form-select w-auto" id="select-anio" data-anio-select>
                    <?php foreach ($anios as $anio): ?>
                        <option value="<?= (int) $anio ?>"<?= (int) $anio === $anioActual ? ' selected' : '' ?>>
                            <?= (int) $anio ?>
                        </option>
                    <?php endforeach; ?>
                </select>
            </div>
        </div>

        <p class="text-muted small" data-gasto-status>Cargando gasto…</p>
        <div class="d-flex flex-column gap-3" data-gasto-list></div>
    </section>

    <section aria-labelledby="metrics-top-title">
        <h5 class="mb-1" id="metrics-top-title">
            <span class="title-icon"><i class="bi bi-trophy-fill" aria-hidden="true"></i></span>
            Top 10 productos del mes
        </h5>
        <p class="text-muted small mb-3">
            Productos ordenados por gasto durante el mes seleccionado del año
            <span data-top-year><?= $anioActual ?></span>.
        </p>

        <div class="mb-3">
            <label class="form-label" for="select-mes">Mes</label>
            <select class="form-select w-auto" id="select-mes" data-mes-select>
                <?php foreach ($meses as $numero => $nombre): ?>
                    <option value="<?= $numero ?>"<?= $numero === $mesActual ? ' selected' : '' ?>>
                        <?= htmlspecialchars(ucfirst($nombre), ENT_QUOTES, 'UTF-8') ?>
                    </option>
                <?php endforeach; ?>
            </select>
        </div>

        <p class="text-muted small" data-top-status>Cargando top de productos…</p>
        <ol class="list-group" data-top-list></ol>
    </section>
</div>

<div class="toast-stack" data-toast-stack aria-live="polite"></div>
<?php

$content = (string) ob_get_clean();
$title = 'Métricas';
$scripts = ['/assets/js/pages/metricas.js'];
$styles = ['/assets/css/pantalla-rapida.css', '/assets/css/metricas.css'];
$active = 'metricas';

require __DIR__ . '/../layouts/app.php';
