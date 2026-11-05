import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "@fontsource-variable/plus-jakarta-sans";

import "./styles/palettes.css";
import "./styles/theme.css";
import "./styles/chef.css";

import { open } from "@tauri-apps/plugin-dialog";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

import {
  api,
  errorMessage,
  escapar,
  type AnalisisPdf,
  type RecetaCandidata,
  type Sesion,
} from "./lib/api";

type Filtro = "lista" | "dudosa" | "descartada" | "todas";

const app = document.querySelector<HTMLElement>("#app")!;

const estado = {
  sesion: null as Sesion | null,
  analisis: null as AnalisisPdf | null,
  seleccion: new Set<number>(),
  activa: null as number | null,
  filtro: "todas" as Filtro,
  cargando: false,
  error: "",
  arrastrando: false,
};

void iniciar();

async function iniciar(): Promise<void> {
  pintar();

  try {
    estado.sesion = await api.sesionActual();
  } catch {
    estado.sesion = {
      autenticado: false,
      admin: false,
      nombre: null,
      email: null,
      rol: null,
    };
  }

  pintar();

  const pdf = new URLSearchParams(window.location.search).get("pdf");

  if (pdf && estado.sesion?.admin) {
    void analizar(pdf);
  }

  escucharArrastre();
}

(window as unknown as { __chefAbrirPdf?: (ruta: string) => void }).__chefAbrirPdf = (
  ruta: string,
) => {
  if (typeof ruta === "string" && ruta.trim() && estado.sesion?.admin) {
    void analizar(ruta);
  }
};

async function escucharArrastre(): Promise<void> {
  try {
    const ventana = getCurrentWebviewWindow();
    await ventana.onDragDropEvent((evento) => {
      const carga = evento.payload;

      if (carga.type === "over" || carga.type === "enter") {
        estado.arrastrando = true;
        document.body.classList.add("chef-arrastrando");
        return;
      }

      if (carga.type === "leave") {
        estado.arrastrando = false;
        document.body.classList.remove("chef-arrastrando");
        return;
      }

      if (carga.type === "drop") {
        estado.arrastrando = false;
        document.body.classList.remove("chef-arrastrando");
        const pdf = carga.paths.find((ruta) =>
          ruta.toLowerCase().endsWith(".pdf"),
        );

        if (pdf) {
          void analizar(pdf);
        } else {
          estado.error = "Arrastra un archivo PDF.";
          pintar();
        }
      }
    });
  } catch {
    // El arrastre es una comodidad; el botón de archivo sigue disponible.
  }
}

async function elegirPdf(): Promise<void> {
  try {
    const ruta = await open({
      multiple: false,
      directory: false,
      filters: [{ name: "Documentos PDF", extensions: ["pdf"] }],
      title: "Elegir un libro de recetas",
    });

    if (typeof ruta === "string") {
      await analizar(ruta);
    }
  } catch (error) {
    estado.error = errorMessage(error);
    pintar();
  }
}

async function analizar(ruta: string): Promise<void> {
  estado.cargando = true;
  estado.error = "";
  estado.analisis = null;
  estado.seleccion.clear();
  estado.activa = null;
  estado.filtro = "todas";
  pintar();

  try {
    const analisis = await api.importarAnalizarPdf(ruta);
    estado.analisis = analisis;

    for (const candidata of analisis.candidatas) {
      if (candidata.estado === "lista") {
        estado.seleccion.add(candidata.id);
      }
    }

    estado.activa =
      analisis.candidatas.find((c) => c.estado !== "descartada")?.id ?? null;
  } catch (error) {
    estado.error = errorMessage(error);
  } finally {
    estado.cargando = false;
    pintar();
    window.scrollTo({ top: 0 });
  }
}

function reiniciar(): void {
  estado.analisis = null;
  estado.seleccion.clear();
  estado.activa = null;
  estado.error = "";
  estado.filtro = "todas";
  pintar();
}

function candidatasVisibles(): RecetaCandidata[] {
  if (!estado.analisis) return [];

  if (estado.filtro === "todas") {
    return estado.analisis.candidatas;
  }

  return estado.analisis.candidatas.filter((c) => c.estado === estado.filtro);
}

function candidataActiva(): RecetaCandidata | null {
  return (
    estado.analisis?.candidatas.find((c) => c.id === estado.activa) ?? null
  );
}

function pintar(): void {
  const scroll = window.scrollY;

  if (!estado.sesion) {
    app.innerHTML = `<main class="chef-loading"><span class="spinner-border" aria-hidden="true"></span><p>Comprobando tu sesión…</p></main>`;
    return;
  }

  if (!estado.sesion.admin) {
    app.innerHTML = `
      <main class="chef-gate">
        <section class="chef-gate__card">
          <span class="chef-gate__icon"><i class="bi bi-shield-lock-fill" aria-hidden="true"></i></span>
          <h1>Chef es solo para administradores</h1>
          <p>Inicia sesión en Mi Súper con una cuenta de administrador para importar recetas desde tus libros.</p>
          <button class="btn btn-outline-secondary" type="button" data-cerrar>
            <i class="bi bi-x-lg" aria-hidden="true"></i> Cerrar
          </button>
        </section>
      </main>`;

    app.querySelector("[data-cerrar]")?.addEventListener("click", () => {
      window.close();
    });
    return;
  }

  app.innerHTML = `
    <main class="chef-page">
      <header class="chef-head">
        <div class="chef-brand">
          <span class="chef-brand__mark"><i class="bi bi-journal-richtext" aria-hidden="true"></i></span>
          <div>
            <p class="chef-brand__eyebrow">Chef · Mi Súper</p>
            <h1 class="chef-brand__title">Importar recetas de un libro</h1>
          </div>
        </div>
        <div class="chef-user">
          <span class="chef-user__avatar" aria-hidden="true"><i class="bi bi-person-fill"></i></span>
          <div>
            <strong>${escapar(estado.sesion.nombre ?? "Administrador")}</strong>
            <span>${escapar(estado.sesion.email ?? "")}</span>
          </div>
        </div>
      </header>

      ${estado.error ? `<p class="chef-alert chef-alert--error"><i class="bi bi-x-circle-fill" aria-hidden="true"></i> ${escapar(estado.error)}</p>` : ""}

      ${estado.cargando ? vistaCargando() : estado.analisis ? vistaAnalisis(estado.analisis) : vistaInicio()}
    </main>`;

  conectarEventos();
  window.scrollTo({ top: scroll });
}

function vistaCargando(): string {
  return `
    <section class="chef-progress">
      <span class="spinner-border" aria-hidden="true"></span>
      <h2>Leyendo el libro…</h2>
      <p>Buscando títulos, ingredientes y páginas. En libros grandes puede tardar unos segundos.</p>
    </section>`;
}

function vistaInicio(): string {
  return `
    <section class="chef-drop ${estado.arrastrando ? "is-over" : ""}" data-drop>
      <span class="chef-drop__icon"><i class="bi bi-file-earmark-pdf" aria-hidden="true"></i></span>
      <h2>Arrastra el PDF aquí</h2>
      <p>También puedes elegirlo desde tu equipo. Se analiza en esta computadora: el libro no se sube a internet.</p>
      <button class="btn btn-primary" type="button" data-elegir>
        <i class="bi bi-folder2-open" aria-hidden="true"></i> Elegir PDF
      </button>
      <p class="chef-drop__hint">
        Con texto seleccionable funciona mejor. Si es un libro escaneado, lo detectaremos y te avisaremos.
      </p>
    </section>

    <section class="chef-steps">
      <article>
        <span>1</span>
        <h3>Detectamos el índice</h3>
        <p>La app propone las recetas que encuentra y te dice en qué páginas están.</p>
      </article>
      <article>
        <span>2</span>
        <h3>Eliges cuáles sí</h3>
        <p>Marcas las que quieres y descartas índices, prólogos o textos que no son recetas.</p>
      </article>
      <article>
        <span>3</span>
        <h3>Revisas y publicas</h3>
        <p>En la siguiente entrega, la IA extrae ingredientes y pasos para que los revises antes de publicar.</p>
      </article>
    </section>`;
}

function vistaAnalisis(analisis: AnalisisPdf): string {
  const utiles = analisis.candidatas.filter((c) => c.estado !== "descartada");
  const listas = analisis.candidatas.filter((c) => c.estado === "lista").length;
  const dudosas = analisis.candidatas.filter((c) => c.estado === "dudosa").length;
  const descartadas = analisis.candidatas.filter(
    (c) => c.estado === "descartada",
  ).length;

  return `
    <section class="chef-book">
      <div class="chef-book__main">
        <span class="chef-book__icon"><i class="bi bi-book" aria-hidden="true"></i></span>
        <div>
          <h2>${escapar(analisis.nombre)}</h2>
          <p>
            ${analisis.paginas} página${analisis.paginas === 1 ? "" : "s"} ·
            ${utiles.length} receta${utiles.length === 1 ? "" : "s"} detectada${utiles.length === 1 ? "" : "s"} de ${analisis.candidatas.length} bloques
          </p>
        </div>
      </div>
      <button class="btn btn-outline-secondary btn-sm" type="button" data-reiniciar>
        <i class="bi bi-arrow-repeat" aria-hidden="true"></i> Otro libro
      </button>
    </section>

    ${analisis.avisos.map((aviso) => `<p class="chef-alert chef-alert--aviso"><i class="bi bi-exclamation-triangle-fill" aria-hidden="true"></i> ${escapar(aviso)}</p>`).join("")}

    <nav class="chef-filtros" aria-label="Filtrar recetas detectadas">
      ${botonFiltro("todas", "Todas", analisis.candidatas.length)}
      ${botonFiltro("lista", "Listas", listas)}
      ${botonFiltro("dudosa", "Dudosas", dudosas)}
      ${botonFiltro("descartada", "Descartadas", descartadas)}
    </nav>

    <div class="chef-layout">
      <section class="chef-lista" aria-label="Recetas detectadas">
        <div class="chef-lista__head">
          <label class="chef-check">
            <input type="checkbox" data-todas ${estado.seleccion.size > 0 ? "checked" : ""}>
            <span>${estado.seleccion.size} seleccionada${estado.seleccion.size === 1 ? "" : "s"}</span>
          </label>
          <button class="chef-link" type="button" data-seleccionar-listas>Seleccionar las listas</button>
          <button class="chef-link" type="button" data-quitar-todas>Quitar selección</button>
        </div>

        ${
          candidatasVisibles().length === 0
            ? `<p class="chef-vacio">No hay recetas en este filtro.</p>`
            : `<div class="chef-items">${candidatasVisibles().map(filaHtml).join("")}</div>`
        }
      </section>

      <aside class="chef-preview" aria-label="Vista previa de la receta">
        ${previewHtml(candidataActiva())}
      </aside>
    </div>

    <footer class="chef-acciones">
      <div>
        <strong>${estado.seleccion.size} receta${estado.seleccion.size === 1 ? "" : "s"}</strong>
        <span>lista${estado.seleccion.size === 1 ? "" : "s"} para extraer</span>
      </div>
      <div class="chef-acciones__right">
        <span class="chef-acciones__nota">La extracción con IA llega en la siguiente entrega.</span>
        <button class="btn btn-primary" type="button" disabled title="Disponible en la siguiente fase">
          <i class="bi bi-magic" aria-hidden="true"></i> Extraer seleccionadas
        </button>
      </div>
    </footer>`;
}

function botonFiltro(filtro: Filtro, texto: string, total: number): string {
  return `<button class="chef-filtro ${estado.filtro === filtro ? "is-active" : ""}" type="button" data-filtro="${filtro}">
    ${escapar(texto)} <span>${total}</span>
  </button>`;
}

function filaHtml(candidata: RecetaCandidata): string {
  const seleccionada = estado.seleccion.has(candidata.id);
  const activa = estado.activa === candidata.id;
  const paginas =
    candidata.pagina_inicio === candidata.pagina_fin
      ? `p. ${candidata.pagina_inicio}`
      : `pp. ${candidata.pagina_inicio}–${candidata.pagina_fin}`;

  return `
    <article class="chef-item ${activa ? "is-active" : ""} ${candidata.estado === "descartada" ? "is-discarded" : ""}" data-preview="${candidata.id}">
      <label class="chef-item__check" aria-label="Seleccionar ${escapar(candidata.titulo)}">
        <input type="checkbox" data-candidata="${candidata.id}" ${seleccionada ? "checked" : ""}>
      </label>

      <div class="chef-item__body">
        <h3>${escapar(candidata.titulo)}</h3>
        <p class="chef-item__meta">
          ${paginas} · ${candidata.lineas} líneas ·
          ${candidata.ingredientes_detectados} ingrediente${candidata.ingredientes_detectados === 1 ? "" : "s"} ·
          ${candidata.pasos_detectados} paso${candidata.pasos_detectados === 1 ? "" : "s"}
        </p>
        ${candidata.motivo ? `<p class="chef-item__motivo">${escapar(candidata.motivo)}</p>` : ""}
      </div>

      <div class="chef-item__lado">
        <span class="chef-estado chef-estado--${candidata.estado}">${etiquetaEstado(candidata.estado)}</span>
        <span class="chef-confianza" title="Confianza de la detección">${candidata.confianza}%</span>
      </div>
    </article>`;
}

function previewHtml(candidata: RecetaCandidata | null): string {
  if (!candidata) {
    return `<div class="chef-preview__vacio">
      <i class="bi bi-eye" aria-hidden="true"></i>
      <p>Elige una receta de la lista para ver lo que se detectó.</p>
    </div>`;
  }

  const seleccionada = estado.seleccion.has(candidata.id);

  return `
    <div class="chef-preview__head">
      <span class="chef-estado chef-estado--${candidata.estado}">${etiquetaEstado(candidata.estado)}</span>
      <span class="chef-preview__paginas">p. ${candidata.pagina_inicio}${candidata.pagina_fin !== candidata.pagina_inicio ? `–${candidata.pagina_fin}` : ""}</span>
    </div>
    <h2>${escapar(candidata.titulo)}</h2>
    ${candidata.motivo ? `<p class="chef-preview__motivo">${escapar(candidata.motivo)}</p>` : ""}

    <div class="chef-preview__barra" title="Confianza de la detección">
      <span style="width:${Math.max(4, Math.min(100, candidata.confianza))}%"></span>
    </div>
    <p class="chef-preview__confianza">${candidata.confianza}% de confianza · ${candidata.lineas} líneas</p>

    <button class="btn ${seleccionada ? "btn-outline-secondary" : "btn-primary"} btn-sm w-100" type="button" data-toggle-preview="${candidata.id}">
      <i class="bi ${seleccionada ? "bi-dash-lg" : "bi-plus-lg"}" aria-hidden="true"></i>
      ${seleccionada ? "Quitar de la selección" : "Añadir a la selección"}
    </button>

    <h3 class="chef-preview__subtitulo">Texto detectado</h3>
    <pre class="chef-preview__texto">${escapar(candidata.texto || candidata.vista_previa)}</pre>`;
}

function etiquetaEstado(estado: string): string {
  switch (estado) {
    case "lista":
      return "Lista";
    case "dudosa":
      return "Dudosa";
    case "descartada":
      return "Descartada";
    default:
      return estado;
  }
}

function conectarEventos(): void {
  app.querySelector("[data-elegir]")?.addEventListener("click", () => {
    void elegirPdf();
  });

  app.querySelector("[data-reiniciar]")?.addEventListener("click", reiniciar);

  app.querySelectorAll<HTMLButtonElement>("[data-filtro]").forEach((boton) => {
    boton.addEventListener("click", () => {
      estado.filtro = (boton.dataset.filtro as Filtro) ?? "todas";
      pintar();
    });
  });

  app
    .querySelectorAll<HTMLInputElement>("[data-candidata]")
    .forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        const id = Number(checkbox.dataset.candidata);
        if (checkbox.checked) {
          estado.seleccion.add(id);
        } else {
          estado.seleccion.delete(id);
        }
        pintar();
      });
    });

  app.querySelector("[data-todas]")?.addEventListener("change", (evento) => {
    const marcado = (evento.target as HTMLInputElement).checked;
    estado.seleccion.clear();

    if (marcado) {
      for (const candidata of estado.analisis?.candidatas ?? []) {
        if (candidata.estado !== "descartada") {
          estado.seleccion.add(candidata.id);
        }
      }
    }

    pintar();
  });

  app.querySelector("[data-seleccionar-listas]")?.addEventListener("click", () => {
    for (const candidata of estado.analisis?.candidatas ?? []) {
      if (candidata.estado === "lista") {
        estado.seleccion.add(candidata.id);
      }
    }
    pintar();
  });

  app.querySelector("[data-quitar-todas]")?.addEventListener("click", () => {
    estado.seleccion.clear();
    pintar();
  });

  app.querySelectorAll<HTMLElement>("[data-preview]").forEach((fila) => {
    fila.addEventListener("click", (evento) => {
      if ((evento.target as HTMLElement).closest("input, label")) {
        return;
      }

      estado.activa = Number(fila.dataset.preview);
      pintar();
    });
  });

  app.querySelectorAll<HTMLButtonElement>("[data-toggle-preview]").forEach((boton) => {
    boton.addEventListener("click", () => {
      const id = Number(boton.dataset.togglePreview);
      if (estado.seleccion.has(id)) {
        estado.seleccion.delete(id);
      } else {
        estado.seleccion.add(id);
      }
      pintar();
    });
  });
}
