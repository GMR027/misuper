<?php

declare(strict_types=1);

use App\Middleware\AdminMiddleware;

$usuario = AdminMiddleware::usuarioWeb();

if ($usuario === null) {
    return;
}

ob_start();
?>
<div class="chef" data-chef>
    <header class="chef__head">
        <div>
            <p class="chef__eyebrow">
                <i class="bi bi-journal-richtext" aria-hidden="true"></i>
                Chef · Mi Súper
            </p>
            <h1 class="chef__title">Importar recetas de un libro</h1>
            <p class="chef__intro">
                Elige un PDF y revisa las recetas que se detectan. El libro se analiza en tu
                computadora: no se sube a internet. Solo las recetas que confirmes llegarán al
                recetario.
            </p>
        </div>
        <span class="chef__badge">
            <i class="bi bi-shield-lock" aria-hidden="true"></i>
            Solo administradores
        </span>
    </header>

    <section class="chef__gate" data-chef-gate>
        <span class="spinner-border spinner-border-sm" aria-hidden="true"></span>
        <p>Comprobando la aplicación de escritorio…</p>
    </section>

    <section class="chef__browser" data-chef-browser hidden>
        <span class="chef__browser-icon"><i class="bi bi-window-desktop" aria-hidden="true"></i></span>
        <h2>Esta función vive en Mi Súper Desktop</h2>
        <p>
            La lectura de PDF y la inteligencia artificial se ejecutan en tu equipo. Abre esta
            página desde la aplicación de escritorio para importar un libro.
        </p>
        <a class="btn btn-primary" href="/">
            <i class="bi bi-house-door" aria-hidden="true"></i>
            Volver a Mi Súper
        </a>
    </section>

    <div data-chef-app hidden>
        <section class="chef__drop" data-chef-drop>
            <span class="chef__drop-icon"><i class="bi bi-file-earmark-pdf" aria-hidden="true"></i></span>
            <div>
                <h2>Elige el libro en PDF</h2>
                <p>Se abre el selector de archivos de tu equipo. El PDF no se sube al servidor.</p>
            </div>
            <button class="btn btn-primary" type="button" data-chef-elegir>
                <i class="bi bi-folder2-open" aria-hidden="true"></i>
                Elegir PDF
            </button>
        </section>

        <p class="chef__message" data-chef-mensaje hidden></p>

        <section class="chef__progress" data-chef-progreso hidden>
            <span class="spinner-border spinner-border-sm" aria-hidden="true"></span>
            <p>Leyendo el libro y buscando recetas…</p>
        </section>

        <section class="chef__book" data-chef-libro hidden>
            <div class="chef__book-main">
                <span class="chef__book-icon"><i class="bi bi-book" aria-hidden="true"></i></span>
                <div>
                    <h2 data-chef-nombre></h2>
                    <p data-chef-resumen></p>
                </div>
            </div>
            <button class="btn btn-outline-secondary btn-sm" type="button" data-chef-otro>
                <i class="bi bi-arrow-repeat" aria-hidden="true"></i>
                Otro libro
            </button>
        </section>

        <nav class="chef__filtros" data-chef-filtros aria-label="Filtrar recetas detectadas" hidden></nav>

        <section class="chef__extraccion" data-chef-extraccion hidden>
            <div class="chef__extraccion-head">
                <div>
                    <h2>Recetas extraídas</h2>
                    <p data-chef-extraccion-resumen>Revisa el resultado antes de guardarlo.</p>
                </div>
                <span class="spinner-border spinner-border-sm" data-chef-extraccion-spinner hidden aria-hidden="true"></span>
            </div>
            <div class="chef__resultados" data-chef-resultados></div>
            <p class="chef__message" data-chef-lote-mensaje hidden></p>
            <div class="chef__extraccion-acciones">
                <button class="btn btn-primary" type="button" data-chef-guardar hidden>
                    <i class="bi bi-cloud-arrow-up" aria-hidden="true"></i>
                    Guardar lote como pendiente
                </button>
                <a class="btn btn-outline-secondary" href="/admin/recetas/lotes" data-chef-ir-lotes hidden>
                    Ver lotes
                </a>
            </div>
        </section>

        <div class="chef__layout" data-chef-layout hidden>
            <section class="chef__lista" aria-label="Recetas detectadas">
                <div class="chef__lista-head">
                    <label class="form-check mb-0">
                        <input class="form-check-input" type="checkbox" data-chef-todas>
                        <span class="form-check-label" data-chef-seleccion>0 seleccionadas</span>
                    </label>
                    <button class="btn btn-link btn-sm p-0" type="button" data-chef-listas>
                        Seleccionar las listas
                    </button>
                    <button class="btn btn-link btn-sm p-0 text-muted" type="button" data-chef-quitar>
                        Quitar selección
                    </button>
                </div>
                <div class="chef__items" data-chef-items></div>
            </section>

            <aside class="chef__preview" aria-label="Vista previa de la receta">
                <div data-chef-preview></div>
            </aside>
        </div>
    </div>

    <footer class="chef__acciones" data-chef-acciones hidden>
        <div>
            <strong data-chef-contador>0 recetas</strong>
            <span>listas para extraer</span>
        </div>
        <div class="chef__acciones-right">
            <span class="chef__nota">La extracción usa el modelo de IA activo y puede tardar varios minutos.</span>
            <button class="btn btn-primary" type="button" data-chef-extraer>
                <i class="bi bi-magic" aria-hidden="true"></i>
                Extraer seleccionadas
            </button>
        </div>
    </footer>
</div>
<?php

$content = (string) ob_get_clean();
$title = 'Chef · Importar recetas';
$scripts = ['/assets/js/pages/chef.js'];
$styles = ['/assets/css/chef.css'];
$active = 'chef';

require __DIR__ . '/../layouts/app.php';
