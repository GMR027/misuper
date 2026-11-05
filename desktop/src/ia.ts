import {
  api,
  errorMessage,
  escapar,
  fechaCorta,
  formatearBytes,
  type ConexionIa,
  type DeteccionIa,
  type DeteccionProveedor,
  type IaResumen,
  type ModeloDisponible,
  type NuevaConexion,
  type Proveedor,
} from "./lib/api";

type Mensaje = { tipo: "ok" | "error" | "aviso"; texto: string };

type EstadoIa = {
  resumen: IaResumen | null;
  deteccion: DeteccionIa | null;
  cargando: boolean;
  detectando: boolean;
  error: string;
  mensaje: Mensaje | null;
  probandoId: string | null;
  formAbierto: boolean;
  editandoId: string | null;
  formProveedor: Proveedor;
  formModelo: string;
  formNombre: string;
  formEndpoint: string;
  formProbar: boolean;
};

const NOMBRE_PROVEEDOR: Record<Proveedor, string> = {
  ollama: "Ollama",
  opencode: "opencode",
  claude: "Claude Code",
};

const ICONO_PROVEEDOR: Record<Proveedor, string> = {
  ollama: "bi-cpu-fill",
  opencode: "bi-terminal-fill",
  claude: "bi-stars",
};

export async function montarIa(contenedor: HTMLElement): Promise<void> {
  const estado: EstadoIa = {
    resumen: null,
    deteccion: null,
    cargando: true,
    detectando: false,
    error: "",
    mensaje: null,
    probandoId: null,
    formAbierto: false,
    editandoId: null,
    formProveedor: "ollama",
    formModelo: "",
    formNombre: "",
    formEndpoint: "",
    formProbar: true,
  };

  pintar();
  await cargarResumen();

  if (!estado.error) {
    estado.detectando = true;
    pintar();
    await detectar();
  }

  async function cargarResumen(): Promise<void> {
    try {
      estado.resumen = await api.iaEstado();
      estado.cargando = false;
    } catch (error) {
      estado.cargando = false;
      estado.error = errorMessage(error);
    }
    pintar();
  }

  async function detectar(): Promise<void> {
    estado.detectando = true;
    pintar();

    try {
      estado.deteccion = await api.iaDetectar();
      estado.mensaje = null;

      if (!estado.formAbierto) {
        prepararFormularioNuevo();
      }
    } catch (error) {
      estado.mensaje = { tipo: "error", texto: errorMessage(error) };
    } finally {
      estado.detectando = false;
      pintar();
    }
  }

  function prepararFormularioNuevo(): void {
    const proveedor: Proveedor = estado.deteccion?.ollama.disponible
      ? "ollama"
      : estado.deteccion?.opencode.disponible
        ? "opencode"
        : estado.deteccion?.claude.disponible
          ? "claude"
          : "ollama";

    const modelos = modelosDe(estado.deteccion, proveedor);
    estado.formProveedor = proveedor;
    estado.formModelo = modelos[0]?.id ?? "";
    estado.formNombre = modelos[0] ? `${NOMBRE_PROVEEDOR[proveedor]} · ${modelos[0].nombre}` : "";
    estado.formEndpoint =
      proveedor === "ollama" ? estado.deteccion?.ollama.endpoint ?? "http://127.0.0.1:11434" : "";
  }

  async function probar(id: string): Promise<void> {
    estado.probandoId = id;
    estado.mensaje = null;
    pintar();

    try {
      estado.resumen = await api.iaProbar(id);
      const conexion = estado.resumen.conexiones.find((c) => c.id === id);
      const prueba = conexion?.ultima_prueba;
      estado.mensaje = prueba
        ? {
            tipo: prueba.ok ? "ok" : "error",
            texto: prueba.mensaje,
          }
        : null;
    } catch (error) {
      estado.mensaje = { tipo: "error", texto: errorMessage(error) };
    } finally {
      estado.probandoId = null;
      pintar();
    }
  }

  async function activar(id: string): Promise<void> {
    try {
      estado.resumen = await api.iaActivar(id);
      const conexion = estado.resumen.conexiones.find((c) => c.id === id);
      estado.mensaje = {
        tipo: "ok",
        texto: `Ahora se usará ${conexion?.nombre ?? "esta conexión"}.`,
      };
    } catch (error) {
      estado.mensaje = { tipo: "error", texto: errorMessage(error) };
    }
    pintar();
  }

  async function eliminar(id: string): Promise<void> {
    const conexion = estado.resumen?.conexiones.find((c) => c.id === id);
    if (!conexion) return;

    if (!window.confirm(`¿Eliminar la conexión «${conexion.nombre}»?`)) {
      return;
    }

    try {
      estado.resumen = await api.iaEliminar(id);
      if (estado.editandoId === id) {
        cerrarFormulario();
      }
      estado.mensaje = { tipo: "ok", texto: "Conexión eliminada." };
    } catch (error) {
      estado.mensaje = { tipo: "error", texto: errorMessage(error) };
    }
    pintar();
  }

  function abrirNueva(): void {
    prepararFormularioNuevo();
    estado.formAbierto = true;
    estado.editandoId = null;
    estado.mensaje = null;
    pintar();
  }

  function abrirEdicion(conexion: ConexionIa): void {
    const modelos = modelosDe(estado.deteccion, conexion.proveedor);
    const esPersonalizado = !modelos.some((m) => m.id === conexion.modelo);

    estado.formAbierto = true;
    estado.editandoId = conexion.id;
    estado.formProveedor = conexion.proveedor;
    estado.formModelo = esPersonalizado ? "__otro" : conexion.modelo;
    estado.formNombre = conexion.nombre;
    estado.formEndpoint = conexion.endpoint ?? "";
    estado.mensaje = null;
    pintar();
  }

  function cerrarFormulario(): void {
    estado.formAbierto = false;
    estado.editandoId = null;
    estado.mensaje = null;
    pintar();
  }

  function guardar(evento: Event): void {
    evento.preventDefault();
    const formulario = evento.currentTarget as HTMLFormElement;
    const datos = new FormData(formulario);
    const modeloSeleccionado = String(datos.get("modelo") ?? "");
    const modeloPersonalizado = String(datos.get("modelo_personalizado") ?? "").trim();
    const modelo = modeloSeleccionado === "__otro" ? modeloPersonalizado : modeloSeleccionado;
    const nombre = String(datos.get("nombre") ?? "").trim();
    const endpoint = String(datos.get("endpoint") ?? "").trim();
    const probarAlGuardar = formulario.querySelector<HTMLInputElement>("[name=probar]")?.checked ?? false;

    if (!nombre || !modelo) {
      estado.mensaje = { tipo: "error", texto: "Escribe un nombre y elige un modelo." };
      pintar();
      return;
    }

    const seleccionado = modelosDe(estado.deteccion, estado.formProveedor).find(
      (m) => m.id === modelo,
    );

    const carga: NuevaConexion = {
      id: estado.editandoId,
      nombre,
      proveedor: estado.formProveedor,
      modelo,
      endpoint: estado.formProveedor === "ollama" ? endpoint || null : null,
      comando: null,
      tamano_bytes: seleccionado?.tamano_bytes ?? null,
      parametros: seleccionado?.parametros ?? null,
      cuantizacion: seleccionado?.cuantizacion ?? null,
      capacidades: seleccionado?.capacidades ?? [],
      gratis: seleccionado?.gratis ?? false,
    };

    void (async () => {
      try {
        const editando = Boolean(estado.editandoId);
        estado.resumen = await api.iaGuardar(carga);
        estado.formAbierto = false;
        estado.editandoId = null;
        estado.mensaje = {
          tipo: "ok",
          texto: editando ? "Conexión actualizada." : "Conexión guardada.",
        };
        pintar();

        if (probarAlGuardar) {
          const nueva = estado.resumen.conexiones
            .filter(
              (c) =>
                c.proveedor === carga.proveedor &&
                c.modelo === carga.modelo &&
                c.nombre === carga.nombre,
            )
            .sort((a, b) => b.creada_ms - a.creada_ms)[0];

          if (nueva) {
            await probar(nueva.id);
          }
        }
      } catch (error) {
        estado.mensaje = { tipo: "error", texto: errorMessage(error) };
        pintar();
      }
    })();
  }

  function pintar(): void {
    if (estado.error) {
      contenedor.innerHTML = `
        <section class="ia-gate">
          <h3 class="ia-gate__title"><i class="bi bi-shield-lock-fill" aria-hidden="true"></i> No se pudo cargar la IA</h3>
          <p class="text-muted">${escapar(estado.error)}</p>
          <button class="btn btn-primary" type="button" data-reintentar>
            <i class="bi bi-arrow-clockwise" aria-hidden="true"></i> Reintentar
          </button>
        </section>`;
      contenedor.querySelector("[data-reintentar]")?.addEventListener("click", () => {
        estado.error = "";
        estado.cargando = true;
        pintar();
        void cargarResumen().then(() => {
          if (!estado.error) {
            void detectar();
          }
        });
      });
      return;
    }

    if (estado.cargando || !estado.resumen) {
      contenedor.innerHTML = `
        <section class="ia-gate">
          <span class="spinner-border spinner-border-sm" aria-hidden="true"></span>
          <p class="text-muted mt-3 mb-0">Cargando la configuración de IA…</p>
        </section>`;
      return;
    }

    const resumen = estado.resumen;

    contenedor.innerHTML = `
      <div class="ia-intro">
        <div>
          <h3 class="ia-intro__title">
            <span class="title-icon"><i class="bi bi-robot" aria-hidden="true"></i></span>
            Inteligencia artificial
          </h3>
          <p class="ia-intro__text">
            Elige qué modelo usa Mi Súper. Puedes combinar modelos locales de Ollama con
            suscripciones de opencode y Claude Code.
          </p>
        </div>
        <div class="ia-intro__actions">
          <button class="btn btn-outline-primary btn-sm" type="button" data-chef>
            <i class="bi bi-journal-richtext" aria-hidden="true"></i> Importar recetas
          </button>
          <button class="btn btn-outline-primary btn-sm" type="button" data-detectar ${estado.detectando ? "disabled" : ""}>
            <i class="bi bi-arrow-repeat" aria-hidden="true"></i>
            ${estado.detectando ? "Detectando…" : "Detectar de nuevo"}
          </button>
        </div>
      </div>

      ${estado.mensaje ? mensajeHtml(estado.mensaje) : ""}

      ${hardwareHtml(resumen)}
      ${proveedoresHtml(estado.deteccion, estado.detectando)}

      <div class="ia-section-head">
        <div>
          <h4 class="ia-section-title">Conexiones guardadas</h4>
          <p class="ia-section-text mb-0">Solo una conexión está activa a la vez.</p>
        </div>
        <button class="btn btn-primary btn-sm" type="button" data-nueva>
          <i class="bi bi-plus-lg" aria-hidden="true"></i> Añadir conexión
        </button>
      </div>

      ${
        estado.formAbierto
          ? formularioHtml(estado, resumen)
          : ""
      }

      ${
        resumen.conexiones.length === 0
          ? `<div class="ia-empty">
               <i class="bi bi-plug" aria-hidden="true"></i>
               <p class="mb-1"><strong>Todavía no hay conexiones.</strong></p>
               <p class="text-muted small mb-0">Añade una conexión local o de suscripción para empezar.</p>
             </div>`
          : `<div class="ia-list">${resumen.conexiones.map((c) => conexionHtml(c, estado.probandoId)).join("")}</div>`
      }

      <p class="ia-footnote">
        <i class="bi bi-shield-lock" aria-hidden="true"></i>
        Las credenciales las gestiona cada herramienta por separado. Mi Súper no guarda claves.
        Las pruebas de opencode y Claude envían un mensaje real y pueden consumir cuota de tu plan.
      </p>
    `;

    contenedor.querySelector("[data-detectar]")?.addEventListener("click", () => void detectar());
    contenedor.querySelector("[data-chef]")?.addEventListener("click", () => void api.abrirChef());
    contenedor.querySelector("[data-nueva]")?.addEventListener("click", abrirNueva);

    contenedor.querySelectorAll<HTMLButtonElement>("[data-probar]").forEach((boton) => {
      boton.addEventListener("click", () => void probar(boton.dataset.probar ?? ""));
    });

    contenedor.querySelectorAll<HTMLButtonElement>("[data-activar]").forEach((boton) => {
      boton.addEventListener("click", () => void activar(boton.dataset.activar ?? ""));
    });

    contenedor.querySelectorAll<HTMLButtonElement>("[data-editar]").forEach((boton) => {
      boton.addEventListener("click", () => {
        const conexion = resumen.conexiones.find((c) => c.id === boton.dataset.editar);
        if (conexion) abrirEdicion(conexion);
      });
    });

    contenedor.querySelectorAll<HTMLButtonElement>("[data-eliminar]").forEach((boton) => {
      boton.addEventListener("click", () => void eliminar(boton.dataset.eliminar ?? ""));
    });

    contenedor.querySelector("[data-cancelar]")?.addEventListener("click", cerrarFormulario);

    const formulario = contenedor.querySelector<HTMLFormElement>("[data-form-ia]");
    formulario?.addEventListener("submit", guardar);

    const selectorProveedor = formulario?.querySelector<HTMLSelectElement>("[name=proveedor]");
    selectorProveedor?.addEventListener("change", () => {
      estado.formProveedor = selectorProveedor.value as Proveedor;
      const modelos = modelosDe(estado.deteccion, estado.formProveedor);
      estado.formModelo = modelos[0]?.id ?? "";
      estado.formNombre = modelos[0]
        ? `${NOMBRE_PROVEEDOR[estado.formProveedor]} · ${modelos[0].nombre}`
        : "";
      estado.formEndpoint =
        estado.formProveedor === "ollama"
          ? estado.deteccion?.ollama.endpoint ?? "http://127.0.0.1:11434"
          : "";
      pintar();
    });

    const checkboxProbar = formulario?.querySelector<HTMLInputElement>("[name=probar]");
    checkboxProbar?.addEventListener("change", () => {
      estado.formProbar = checkboxProbar.checked;
    });

    const selectorModelo = formulario?.querySelector<HTMLSelectElement>("[name=modelo]");
    selectorModelo?.addEventListener("change", () => {
      estado.formModelo = selectorModelo.value;
      actualizarRecomendacion(formulario);
    });

    actualizarRecomendacion(formulario);
  }

  function actualizarRecomendacion(formulario: HTMLFormElement | null): void {
    if (!formulario) return;

    const selector = formulario.querySelector<HTMLSelectElement>("[name=modelo]");
    const modelo = selector?.value === "__otro"
      ? formulario.querySelector<HTMLInputElement>("[name=modelo_personalizado]")?.value.trim() ?? ""
      : selector?.value ?? "";
    const caja = formulario.querySelector<HTMLElement>("[data-recomendacion]");
    const personalizado = formulario.querySelector<HTMLElement>("[data-campo-personalizado]");
    const nombre = formulario.querySelector<HTMLInputElement>("[name=nombre]");

    if (personalizado) {
      personalizado.hidden = selector?.value !== "__otro";
    }

    if (nombre && (!nombre.value || nombre.dataset.auto === "1")) {
      const etiqueta = modelosDe(estado.deteccion, estado.formProveedor).find((m) => m.id === modelo);
      nombre.value = modelo
        ? `${NOMBRE_PROVEEDOR[estado.formProveedor]} · ${etiqueta?.nombre ?? modelo}`
        : "";
      nombre.dataset.auto = "1";
    }

    nombre?.addEventListener(
      "input",
      () => {
        if (nombre) nombre.dataset.auto = "0";
      },
      { once: true },
    );

    if (!caja) return;

    const encontrado = modelosDe(estado.deteccion, estado.formProveedor).find((m) => m.id === modelo);

    if (!encontrado) {
      caja.className = "ia-reco ia-reco--neutra";
      caja.innerHTML = `<i class="bi bi-question-circle" aria-hidden="true"></i> Elige un modelo para ver su recomendación.`;
      return;
    }

    const reco = encontrado.recomendacion;
    if (!reco) {
      caja.className = "ia-reco ia-reco--neutra";
      caja.innerHTML = `<i class="bi bi-info-circle" aria-hidden="true"></i> Sin datos de hardware para este modelo.`;
      return;
    }

    const memoria = reco.memoria_estimada_bytes
      ? ` · necesita ~${formatearBytes(reco.memoria_estimada_bytes)}`
      : "";
    caja.className = `ia-reco ia-reco--${claseNivel(reco.nivel)}`;
    caja.innerHTML = `<i class="bi ${iconoNivel(reco.nivel)}" aria-hidden="true"></i> <strong>${escapar(reco.etiqueta)}</strong><span>${escapar(reco.detalle)}${memoria}</span>`;
  }
}

function modelosDe(deteccion: DeteccionIa | null, proveedor: Proveedor): ModeloDisponible[] {
  if (!deteccion) return [];
  return deteccion[proveedor].modelos;
}

function hardwareHtml(resumen: IaResumen): string {
  const hw = resumen.hardware;
  const gpu = hw.gpu
    ? `${escapar(hw.gpu.nombre)}${hw.gpu.vram_total_bytes ? ` · ${formatearBytes(hw.gpu.vram_total_bytes)} VRAM` : ""}`
    : "No detectada";

  return `
    <div class="ia-hw">
      <div class="ia-hw__item">
        <span class="ia-hw__label"><i class="bi bi-cpu" aria-hidden="true"></i> CPU</span>
        <strong>${escapar(hw.cpu)}</strong>
        <small>${hw.nucleos} núcleos</small>
      </div>
      <div class="ia-hw__item">
        <span class="ia-hw__label"><i class="bi bi-memory" aria-hidden="true"></i> RAM</span>
        <strong>${formatearBytes(hw.ram_disponible_bytes)} libres</strong>
        <small>de ${formatearBytes(hw.ram_total_bytes)}</small>
      </div>
      <div class="ia-hw__item">
        <span class="ia-hw__label"><i class="bi bi-gpu-card" aria-hidden="true"></i> GPU</span>
        <strong>${gpu}</strong>
        <small>${hw.gpu?.vram_libre_bytes ? `${formatearBytes(hw.gpu.vram_libre_bytes)} libres` : "Se usará CPU si hace falta"}</small>
      </div>
    </div>`;
}

function proveedoresHtml(deteccion: DeteccionIa | null, detectando: boolean): string {
  const tarjetas = (["ollama", "opencode", "claude"] as Proveedor[])
    .map((proveedor) => proveedorHtml(proveedor, deteccion?.[proveedor] ?? null, detectando))
    .join("");

  return `<div class="ia-providers">${tarjetas}</div>`;
}

function proveedorHtml(
  proveedor: Proveedor,
  deteccion: DeteccionProveedor | null,
  detectando: boolean,
): string {
  const estado = !deteccion
    ? detectando
      ? { clase: "aviso", texto: "Detectando…" }
      : { clase: "neutra", texto: "Sin detectar" }
    : deteccion.disponible
      ? { clase: "ok", texto: "Disponible" }
      : deteccion.instalado
        ? { clase: "aviso", texto: "Instalado, no disponible" }
        : { clase: "error", texto: "No detectado" };

  const detalle = deteccion?.detalle ?? "Pulsa «Detectar de nuevo» para comprobar este proveedor.";
  const extra = deteccion
    ? [
        deteccion.version ? `v${deteccion.version}` : null,
        deteccion.endpoint ?? null,
        deteccion.modelos.length ? `${deteccion.modelos.length} modelo(s)` : null,
        deteccion.autenticado === false ? "sin sesión" : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  return `
    <article class="ia-provider ia-provider--${estado.clase}">
      <header class="ia-provider__head">
        <span class="ia-provider__icon"><i class="bi ${ICONO_PROVEEDOR[proveedor]}" aria-hidden="true"></i></span>
        <div class="ia-provider__title">
          <strong>${NOMBRE_PROVEEDOR[proveedor]}</strong>
          <span class="ia-status ia-status--${estado.clase}"><span class="ia-dot"></span>${estado.texto}</span>
        </div>
      </header>
      <p class="ia-provider__detail">${escapar(detalle)}</p>
      ${extra ? `<p class="ia-provider__meta">${escapar(extra)}</p>` : ""}
    </article>`;
}

function formularioHtml(estado: EstadoIa, resumen: IaResumen): string {
  const conexion = estado.editandoId
    ? resumen.conexiones.find((c) => c.id === estado.editandoId)
    : null;
  const modelos = modelosDe(estado.deteccion, estado.formProveedor);
  const deteccion = estado.deteccion?.[estado.formProveedor] ?? null;
  const esPersonalizado = estado.formModelo === "__otro" || !modelos.some((m) => m.id === estado.formModelo);
  const modeloSeleccionado = esPersonalizado ? "__otro" : estado.formModelo;
  const seleccionado = modelos.find((m) => m.id === estado.formModelo);

  const opciones = modelos
    .map((modelo) => {
      const etiqueta = modelo.gratis ? " · gratis" : "";
      return `<option value="${escapar(modelo.id)}" ${modelo.id === modeloSeleccionado ? "selected" : ""}>${escapar(modelo.nombre)}${etiqueta}${modelo.parametros ? ` · ${escapar(modelo.parametros)}` : ""}</option>`;
    })
    .join("");

  const sinModelos = modelos.length === 0;

  return `
    <section class="ia-form card">
      <div class="card-body">
        <div class="ia-form__head">
          <h4 class="ia-section-title mb-0">${conexion ? "Editar conexión" : "Nueva conexión"}</h4>
          <button class="btn btn-link btn-sm text-muted" type="button" data-cancelar>Cancelar</button>
        </div>

        <form data-form-ia>
          <div class="row g-3">
            <div class="col-12 col-md-4">
              <label class="form-label" for="ia-proveedor">Proveedor</label>
              <select class="form-select" id="ia-proveedor" name="proveedor">
                ${(["ollama", "opencode", "claude"] as Proveedor[])
                  .map(
                    (p) =>
                      `<option value="${p}" ${estado.formProveedor === p ? "selected" : ""}>${NOMBRE_PROVEEDOR[p]}</option>`,
                  )
                  .join("")}
              </select>
            </div>

            <div class="col-12 col-md-8">
              <label class="form-label" for="ia-modelo">Modelo</label>
              ${
                sinModelos
                  ? `<div class="alert alert-warning py-2 px-3 mb-0 small">No hay modelos detectados para ${NOMBRE_PROVEEDOR[estado.formProveedor]}. Revisa la detección o escribe uno manualmente.</div>
                     <input class="form-control mt-2" id="ia-modelo" name="modelo" value="__otro" type="hidden">
                     <input class="form-control" name="modelo_personalizado" placeholder="Identificador del modelo" value="${escapar(conexion?.modelo ?? "")}">`
                  : `<select class="form-select" id="ia-modelo" name="modelo">
                       ${opciones}
                       <option value="__otro" ${modeloSeleccionado === "__otro" ? "selected" : ""}>Escribir otro modelo…</option>
                     </select>
                     <div class="mt-2" data-campo-personalizado ${modeloSeleccionado === "__otro" ? "" : "hidden"}>
                       <input class="form-control" name="modelo_personalizado" placeholder="Identificador del modelo" value="${escapar(conexion?.modelo ?? "")}">
                     </div>`
              }
            </div>

            <div class="col-12 col-md-8">
              <label class="form-label" for="ia-nombre">Nombre de la conexión</label>
              <input class="form-control" id="ia-nombre" name="nombre" maxlength="80" required value="${escapar(estado.formNombre)}" data-auto="${estado.formNombre ? "1" : "0"}">
            </div>

            ${
              estado.formProveedor === "ollama"
                ? `<div class="col-12 col-md-4">
                     <label class="form-label" for="ia-endpoint">Endpoint de Ollama</label>
                     <input class="form-control" id="ia-endpoint" name="endpoint" value="${escapar(estado.formEndpoint || deteccion?.endpoint || "http://127.0.0.1:11434")}" placeholder="http://127.0.0.1:11434">
                   </div>`
                : ""
            }
          </div>

          <div class="ia-reco ia-reco--neutra mt-3" data-recomendacion></div>
          ${
            seleccionado?.gratis
              ? `<p class="form-text mb-0 mt-2"><i class="bi bi-gift" aria-hidden="true"></i> Este modelo figura como gratuito en opencode.</p>`
              : ""
          }

          <div class="d-flex flex-wrap align-items-center justify-content-between gap-3 mt-4">
            <label class="form-check mb-0">
              <input class="form-check-input" type="checkbox" name="probar" ${estado.formProbar ? "checked" : ""}>
              <span class="form-check-label">Probar la conexión al guardar</span>
            </label>
            <button class="btn btn-primary" type="submit">
              <i class="bi bi-check-lg" aria-hidden="true"></i>
              ${conexion ? "Guardar cambios" : "Guardar conexión"}
            </button>
          </div>
        </form>
      </div>
    </section>`;
}

function conexionHtml(conexion: ConexionIa, probandoId: string | null): string {
  const prueba = conexion.ultima_prueba;
  const estadoPrueba = !prueba
    ? { clase: "aviso", texto: "Sin comprobar" }
    : prueba.ok
      ? { clase: "ok", texto: `Correcta${prueba.latencia_ms ? ` · ${prueba.latencia_ms} ms` : ""}` }
      : { clase: "error", texto: "Error de conexión" };

  const meta = [
    conexion.parametros,
    conexion.cuantizacion,
    conexion.tamano_bytes ? formatearBytes(conexion.tamano_bytes) : null,
    conexion.gratis ? "gratis" : null,
  ].filter(Boolean) as string[];

  const reco = conexion.recomendacion;

  return `
    <article class="ia-connection ${conexion.activa ? "is-active" : ""}">
      <div class="ia-connection__main">
        <div class="ia-connection__top">
          <span class="ia-connection__icon"><i class="bi ${ICONO_PROVEEDOR[conexion.proveedor]}" aria-hidden="true"></i></span>
          <div class="ia-connection__title">
            <strong>${escapar(conexion.nombre)}</strong>
            <span class="ia-connection__provider">${NOMBRE_PROVEEDOR[conexion.proveedor]}${conexion.endpoint ? ` · ${escapar(conexion.endpoint)}` : ""}</span>
          </div>
          ${conexion.activa ? `<span class="ia-badge-active"><i class="bi bi-check-circle-fill" aria-hidden="true"></i> En uso</span>` : ""}
        </div>

        <div class="ia-connection__model"><code>${escapar(conexion.modelo)}</code></div>
        ${meta.length ? `<p class="ia-connection__meta">${escapar(meta.join(" · "))}</p>` : ""}

        <div class="ia-connection__status ia-status--${estadoPrueba.clase}">
          <span class="ia-dot"></span>
          <span>${escapar(estadoPrueba.texto)}</span>
          ${prueba ? `<span class="ia-connection__date">${fechaCorta(prueba.fecha_ms)}</span>` : ""}
        </div>
        ${
          prueba && !prueba.ok
            ? `<p class="ia-connection__error">${escapar(prueba.mensaje)}</p>`
            : ""
        }
        ${
          reco
            ? `<span class="ia-reco-pill ia-reco-pill--${claseNivel(reco.nivel)}" title="${escapar(reco.detalle)}">${escapar(reco.etiqueta)}</span>`
            : ""
        }
      </div>

      <div class="ia-connection__actions">
        <button class="btn btn-sm btn-outline-primary" type="button" data-probar="${escapar(conexion.id)}" ${probandoId === conexion.id ? "disabled" : ""}>
          ${probandoId === conexion.id ? `<span class="spinner-border spinner-border-sm" aria-hidden="true"></span> Probando…` : `<i class="bi bi-activity" aria-hidden="true"></i> Probar`}
        </button>
        ${
          conexion.activa
            ? ""
            : `<button class="btn btn-sm btn-primary" type="button" data-activar="${escapar(conexion.id)}"><i class="bi bi-play-fill" aria-hidden="true"></i> Activar</button>`
        }
        <button class="btn btn-sm btn-outline-secondary" type="button" data-editar="${escapar(conexion.id)}" aria-label="Editar conexión">
          <i class="bi bi-pencil" aria-hidden="true"></i>
        </button>
        <button class="btn btn-sm btn-outline-danger" type="button" data-eliminar="${escapar(conexion.id)}" aria-label="Eliminar conexión">
          <i class="bi bi-trash3" aria-hidden="true"></i>
        </button>
      </div>
    </article>`;
}

function mensajeHtml(mensaje: Mensaje): string {
  const icono =
    mensaje.tipo === "ok"
      ? "bi-check-circle-fill"
      : mensaje.tipo === "aviso"
        ? "bi-exclamation-triangle-fill"
        : "bi-x-circle-fill";

  return `<p class="ia-message ia-message--${mensaje.tipo}"><i class="bi ${icono}" aria-hidden="true"></i> ${escapar(mensaje.texto)}</p>`;
}

function claseNivel(nivel: string): string {
  switch (nivel) {
    case "excelente":
      return "excelente";
    case "buena":
      return "buena";
    case "lenta":
      return "lenta";
    case "remota":
      return "remota";
    case "no_recomendada":
      return "no";
    default:
      return "neutra";
  }
}

function iconoNivel(nivel: string): string {
  switch (nivel) {
    case "excelente":
      return "bi-lightning-charge-fill";
    case "buena":
      return "bi-hand-thumbs-up-fill";
    case "lenta":
      return "bi-hourglass-split";
    case "remota":
      return "bi-cloud-fill";
    case "no_recomendada":
      return "bi-slash-circle";
    default:
      return "bi-info-circle";
  }
}
