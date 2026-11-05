import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "@fontsource-variable/plus-jakarta-sans";

import "./styles/palettes.css";
import "./styles/auth.css";
import "./styles/theme.css";
import "./styles/texture.css";
import "./styles/modes.css";
import "./styles/settings.css";
import "./styles/ia.css";

import { api, errorMessage, escapar, type AppState, type Sesion } from "./lib/api";
import { montarIa } from "./ia";

const app = document.querySelector<HTMLElement>("#app")!;

void arrancar();

async function arrancar() {
  try {
    const estado = await api.state();

    let sesion: Sesion | null = null;
    let errorSesion: string | null = null;

    if (estado.configured) {
      try {
        sesion = await api.sesionActual();
      } catch (error) {
        errorSesion = errorMessage(error);
        sesion = {
          autenticado: false,
          admin: false,
          nombre: null,
          email: null,
          rol: null,
        };
      }
    }

    render(estado, sesion, errorSesion);
  } catch (error) {
    app.innerHTML = tarjeta(
      "No se pudo abrir la app",
      `<p class="alert alert-danger mb-0">${escapar(errorMessage(error))}</p>`,
    );
  }
}

function render(
  estado: AppState,
  sesion: Sesion | null,
  errorSesion: string | null = null,
): void {
  document.body.className = "settings-body";

  if (!estado.configured) {
    renderPrimeraConfiguracion(estado);
    return;
  }

  if (!estado.settings) {
    app.innerHTML = tarjeta(
      "Mi Súper",
      `<p class="text-muted mb-0">Abriendo Mi Súper…</p>`,
    );
    return;
  }

  renderAjustes(estado, sesion, errorSesion);
}

function renderPrimeraConfiguracion(estado: AppState): void {
  app.innerHTML = `
    <main class="settings-page settings-page--setup">
      <header class="settings-setup__head">
        <p class="settings-brand">
          <i class="bi bi-basket2-fill" aria-hidden="true"></i> Mi Súper
        </p>
        <h1 class="settings-setup__title">Conectar con tu Mi Súper</h1>
        <p class="settings-setup__text">
          Escribe la dirección de tu instalación. La sesión se inicia dentro de la web,
          igual que en el navegador.
        </p>
      </header>

      <section class="card settings-card">
        <div class="card-body p-4">
          <form data-form-setup novalidate>
            <div class="mb-3">
              <label class="form-label" for="server">Dirección del servidor</label>
              <input class="form-control" id="server" name="server" type="url"
                placeholder="https://misuper.ejemplo.com" required autofocus
                value="${escapar(estado.server_url ?? "")}">
              <p class="form-text mb-0">En desarrollo puede ser <code>http://127.0.0.1:8010</code>.</p>
            </div>

            <p class="alert alert-danger py-2 px-3 mb-3" data-error hidden></p>

            <button class="btn btn-primary w-100" type="submit" data-guardar>
              <i class="bi bi-plug-fill" aria-hidden="true"></i> Guardar y conectar
            </button>
          </form>

          <p class="text-muted small mt-4 mb-0">
            <i class="bi bi-shield-lock" aria-hidden="true"></i>
            Las cookies de sesión se guardan en el equipo, como en un navegador.
          </p>
        </div>
      </section>
    </main>`;

  const form = app.querySelector<HTMLFormElement>("[data-form-setup]")!;
  const error = form.querySelector<HTMLElement>("[data-error]")!;
  const boton = form.querySelector<HTMLButtonElement>("[data-guardar]")!;

  form.addEventListener("submit", (evento) => {
    evento.preventDefault();
    const server = (form.elements.namedItem("server") as HTMLInputElement).value;

    error.hidden = true;
    boton.disabled = true;
    boton.innerHTML = `<span class="spinner-border spinner-border-sm" aria-hidden="true"></span> Conectando…`;

    void api.guardarServidor(server).catch((e) => {
      error.textContent = errorMessage(e);
      error.hidden = false;
      boton.disabled = false;
      boton.innerHTML = `<i class="bi bi-plug-fill" aria-hidden="true"></i> Reintentar`;
    });
  });
}

function renderAjustes(
  estado: AppState,
  sesion: Sesion | null,
  errorSesion: string | null = null,
): void {
  const admiteIa = sesion?.admin === true;
  const tabInicial = new URLSearchParams(window.location.search).get("tab") === "ia" && admiteIa
    ? "ia"
    : "general";

  document.title = "Ajustes · Mi Súper";

  app.innerHTML = `
    <main class="settings-page">
      <header class="settings-head">
        <div>
          <p class="settings-brand">
            <i class="bi bi-basket2-fill" aria-hidden="true"></i> Mi Súper
          </p>
          <h1 class="settings-head__title">Ajustes de la aplicación</h1>
        </div>
        <div class="settings-head__actions">
          <button class="btn btn-outline-secondary btn-sm" type="button" data-volver>
            <i class="bi bi-arrow-left" aria-hidden="true"></i> Volver a Mi Súper
          </button>
          <div class="settings-session">
            <span class="settings-session__avatar" aria-hidden="true">
              <i class="bi bi-person-fill"></i>
            </span>
            <div>
              <strong>${escapar(sesion?.nombre ?? "Sin sesión")}</strong>
              <span>
                ${
                  admiteIa
                    ? "Administrador"
                    : sesion?.autenticado
                      ? "Cuenta sin permisos de administración"
                      : "Inicia sesión en Mi Súper"
                }
              </span>
            </div>
          </div>
        </div>
      </header>

      <p class="alert alert-danger py-2 px-3" data-error-volver hidden></p>

      <nav class="settings-tabs" role="tablist" aria-label="Secciones de ajustes">
        <button class="settings-tab" type="button" role="tab" data-tab="general">
          <i class="bi bi-sliders2" aria-hidden="true"></i> General
        </button>
        ${
          admiteIa
            ? `<button class="settings-tab" type="button" role="tab" data-tab="ia">
                 <i class="bi bi-robot" aria-hidden="true"></i> Inteligencia artificial
                 <span class="settings-tab__admin">Admin</span>
               </button>`
            : ""
        }
      </nav>

      ${
        errorSesion
          ? `<p class="alert alert-warning py-2 px-3" data-error-sesion>
               No se pudo comprobar tu sesión: ${escapar(errorSesion)}
             </p>`
          : ""
      }

      <section class="settings-panel" data-panel></section>
    </main>`;

  const panel = app.querySelector<HTMLElement>("[data-panel]")!;
  const tabs = Array.from(app.querySelectorAll<HTMLButtonElement>("[data-tab]"));

  app.querySelector("[data-volver]")?.addEventListener("click", () => {
    void api.volverWeb().catch((error) => {
      const aviso = document.querySelector<HTMLElement>("[data-error-volver]");
      if (aviso) {
        aviso.textContent = `No se pudo volver a Mi Súper: ${errorMessage(error)}`;
        aviso.hidden = false;
      }
    });
  });

  const mostrar = (tab: string) => {
    tabs.forEach((boton) => {
      const activo = boton.dataset.tab === tab;
      boton.classList.toggle("is-active", activo);
      boton.setAttribute("aria-selected", activo ? "true" : "false");
    });

    if (tab === "ia" && admiteIa) {
      panel.innerHTML = "";
      void montarIa(panel);
      return;
    }

    renderGeneral(panel, estado, sesion, admiteIa ? () => mostrar("ia") : null);
  };

  tabs.forEach((boton) => {
    boton.addEventListener("click", () => mostrar(boton.dataset.tab ?? "general"));
  });

  mostrar(tabInicial);
}

function renderGeneral(
  panel: HTMLElement,
  estado: AppState,
  sesion: Sesion | null,
  abrirIa: (() => void) | null,
): void {
  panel.innerHTML = `
    <section class="card settings-card settings-card--wide">
      <div class="card-body p-4">
        <h2 class="settings-section__title">
          <span class="title-icon"><i class="bi bi-hdd-network" aria-hidden="true"></i></span>
          Servidor
        </h2>
        <p class="settings-section__text">
          La app muestra la web real de Mi Súper. Cambia la dirección si usas otro servidor.
        </p>

        <form data-form novalidate>
          <div class="mb-3">
            <label class="form-label" for="server">Dirección del servidor</label>
            <input class="form-control" id="server" name="server" type="url"
              placeholder="https://misuper.ejemplo.com" required
              value="${escapar(estado.server_url ?? "")}">
            <p class="form-text mb-0">En desarrollo puede ser <code>http://127.0.0.1:8010</code>.</p>
          </div>

          <div class="mb-3">
            <label class="form-label" for="zoom">Tamaño de la vista: <output data-zoom>${estado.zoom} %</output></label>
            <input class="form-range" id="zoom" name="zoom" type="range"
              min="50" max="200" step="10" value="${estado.zoom}">
          </div>

          <p class="alert alert-danger py-2 px-3 mb-3" data-error hidden></p>

          <button class="btn btn-primary" type="submit" data-guardar>
            <i class="bi bi-plug-fill" aria-hidden="true"></i> Guardar y abrir
          </button>
        </form>
      </div>
    </section>

    ${
      abrirIa
        ? `<section class="card settings-card settings-card--wide settings-ia-callout">
             <div class="card-body p-4 d-flex flex-wrap align-items-center justify-content-between gap-3">
               <div>
                 <h2 class="settings-section__title mb-1">
                   <span class="title-icon"><i class="bi bi-robot" aria-hidden="true"></i></span>
                   Inteligencia artificial
                 </h2>
                 <p class="settings-section__text mb-0">
                   Conecta modelos locales de Ollama o tus suscripciones de opencode y Claude.
                 </p>
               </div>
               <button class="btn btn-outline-primary" type="button" data-abrir-ia>
                 <i class="bi bi-sliders" aria-hidden="true"></i> Configurar IA
               </button>
             </div>
           </section>`
        : `<p class="settings-note">
             <i class="bi bi-shield-lock" aria-hidden="true"></i>
             Las conexiones de IA solo están disponibles para administradores.
           </p>`
    }

    <p class="settings-note">
      <i class="bi bi-info-circle" aria-hidden="true"></i>
      ${
        sesion?.autenticado
          ? "La sesión es la de la web y vive en este equipo."
          : "Inicia sesión en la web para que la app pueda comprobar tu cuenta."
      }
    </p>
  `;

  const form = panel.querySelector<HTMLFormElement>("[data-form]")!;
  const error = form.querySelector<HTMLElement>("[data-error]")!;
  const zoomInput = form.querySelector<HTMLInputElement>("#zoom")!;
  const zoomOut = form.querySelector<HTMLOutputElement>("[data-zoom]")!;
  const boton = form.querySelector<HTMLButtonElement>("[data-guardar]")!;

  zoomInput.addEventListener("input", () => {
    zoomOut.textContent = `${zoomInput.value} %`;
  });

  zoomInput.addEventListener("change", () => {
    void api
      .aplicarZoom(Number(zoomInput.value))
      .then((zoom) => {
        zoomInput.value = String(zoom);
        zoomOut.textContent = `${zoom} %`;
      })
      .catch((e) => {
        error.textContent = errorMessage(e);
        error.hidden = false;
      });
  });

  form.addEventListener("submit", (evento) => {
    evento.preventDefault();
    const server = (form.elements.namedItem("server") as HTMLInputElement).value;

    error.hidden = true;
    boton.disabled = true;
    boton.innerHTML = `<span class="spinner-border spinner-border-sm" aria-hidden="true"></span> Conectando…`;

    void api.guardarServidor(server).catch((e) => {
      error.textContent = errorMessage(e);
      error.hidden = false;
      boton.disabled = false;
      boton.innerHTML = `<i class="bi bi-plug-fill" aria-hidden="true"></i> Reintentar`;
    });
  });

  panel.querySelector("[data-abrir-ia]")?.addEventListener("click", () => {
    abrirIa?.();
  });
}

function tarjeta(titulo: string, contenido: string): string {
  return `
    <main class="settings-page settings-page--setup">
      <section class="card settings-card">
        <div class="card-body p-4 text-center">
          <p class="settings-brand">
            <i class="bi bi-basket2-fill" aria-hidden="true"></i> Mi Súper
          </p>
          <h1 class="settings-setup__title">${escapar(titulo)}</h1>
          ${contenido}
        </div>
      </section>
    </main>`;
}
