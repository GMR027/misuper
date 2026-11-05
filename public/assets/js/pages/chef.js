/**
 * Página Chef dentro de la web.
 *
 * La interfaz vive aquí, pero el análisis del PDF ocurre en Mi Súper Desktop.
 * El puente lo inyecta la app en la ventana del webview: `window.MiSuperDesktop`.
 */
(function () {
  "use strict";

  const root = document.querySelector("[data-chef]");

  if (!root) {
    return;
  }

  const puente = window.MiSuperDesktop;
  const estado = {
    analisis: null,
    seleccion: new Set(),
    activa: null,
    filtro: "todas",
    cargando: false,
    extrayendo: false,
    extraidas: [],
    ruta: "",
  };

  const el = {
    gate: root.querySelector("[data-chef-gate]"),
    browser: root.querySelector("[data-chef-browser]"),
    app: root.querySelector("[data-chef-app]"),
    elegir: root.querySelector("[data-chef-elegir]"),
    mensaje: root.querySelector("[data-chef-mensaje]"),
    progreso: root.querySelector("[data-chef-progreso]"),
    libro: root.querySelector("[data-chef-libro]"),
    nombre: root.querySelector("[data-chef-nombre]"),
    resumen: root.querySelector("[data-chef-resumen]"),
    filtros: root.querySelector("[data-chef-filtros]"),
    layout: root.querySelector("[data-chef-layout]"),
    items: root.querySelector("[data-chef-items]"),
    preview: root.querySelector("[data-chef-preview]"),
    todas: root.querySelector("[data-chef-todas]"),
    seleccion: root.querySelector("[data-chef-seleccion]"),
    acciones: root.querySelector("[data-chef-acciones]"),
    contador: root.querySelector("[data-chef-contador]"),
    extraccion: root.querySelector("[data-chef-extraccion]"),
    resultados: root.querySelector("[data-chef-resultados]"),
    extraer: root.querySelector("[data-chef-extraer]"),
    guardar: root.querySelector("[data-chef-guardar]"),
    loteMensaje: root.querySelector("[data-chef-lote-mensaje]"),
    extraccionResumen: root.querySelector("[data-chef-extraccion-resumen]"),
    extraccionSpinner: root.querySelector("[data-chef-extraccion-spinner]"),
    irLotes: root.querySelector("[data-chef-ir-lotes]"),
  };

  iniciar();

  function iniciar() {
    el.gate.hidden = true;

    if (!puente || !puente.disponible) {
      el.browser.hidden = false;
      return;
    }

    el.app.hidden = false;
    el.elegir.addEventListener("click", elegirPdf);
    root.querySelector("[data-chef-otro]").addEventListener("click", reiniciar);
    root.querySelector("[data-chef-listas]").addEventListener("click", seleccionarListas);
    root.querySelector("[data-chef-quitar]").addEventListener("click", quitarSeleccion);
    el.todas.addEventListener("change", alternarTodas);
    el.extraer.addEventListener("click", extraerSeleccionadas);
    el.guardar.addEventListener("click", guardarLote);

    el.preview.addEventListener("click", (evento) => {
      const vision = evento.target.closest("[data-chef-vision]");
      if (vision) {
        void buscarTituloVision(Number(vision.dataset.chefVision));
        return;
      }

      const boton = evento.target.closest("[data-chef-toggle]");
      if (boton) {
        alternarSeleccion(Number(boton.dataset.chefToggle));
      }
    });

    el.items.addEventListener("change", (evento) => {
      const casilla = evento.target.closest("[data-chef-candidata]");
      if (!casilla) return;
      const id = Number(casilla.dataset.chefCandidata);
      if (casilla.checked) estado.seleccion.add(id);
      else estado.seleccion.delete(id);
      render();
    });

    el.items.addEventListener("click", (evento) => {
      if (evento.target.closest("input, label")) return;
      const fila = evento.target.closest("[data-chef-preview-id]");
      if (!fila) return;
      estado.activa = Number(fila.dataset.chefPreviewId);
      render();
    });

    el.filtros.addEventListener("click", (evento) => {
      const boton = evento.target.closest("[data-chef-filtro]");
      if (!boton) return;
      estado.filtro = boton.dataset.chefFiltro;
      render();
    });
  }

  async function elegirPdf() {
    try {
      const ruta = await puente.elegirPdf();

      if (typeof ruta === "string" && ruta.trim()) {
        await analizar(ruta);
      }
    } catch (error) {
      mostrarError(error);
    }
  }

  async function analizar(ruta) {
    estado.ruta = ruta;
    estado.cargando = true;
    estado.seleccion.clear();
    estado.activa = null;
    estado.filtro = "todas";
    estado.extraidas = [];
    render();

    try {
      const analisis = await puente.analizarPdf(ruta);
      estado.analisis = analisis;

      for (const candidata of analisis.candidatas || []) {
        if (candidata.estado === "lista") {
          estado.seleccion.add(candidata.id);
        }
      }

      estado.activa =
        (analisis.candidatas || []).find((c) => c.estado !== "descartada")?.id ?? null;
    } catch (error) {
      mostrarError(error);
    } finally {
      estado.cargando = false;
      render();
    }
  }

  async function buscarTituloVision(id) {
    const candidata = candidataActiva(id);
    if (!candidata || !puente.buscarTituloVision) return;

    mostrarMensaje("Buscando el título con visión…", "aviso");

    try {
      const titulo = await puente.buscarTituloVision(estado.ruta, candidata.pagina_inicio);

      if (titulo && titulo.trim()) {
        candidata.titulo = titulo.trim();
        candidata.provisional = false;
        candidata.motivo = "Título recuperado con visión.";
        mostrarMensaje(`Título detectado: ${titulo.trim()}`, "ok");
      } else {
        mostrarMensaje("La visión no encontró un título claro.", "aviso");
      }
    } catch (error) {
      mostrarError(error);
    }

    render();
  }

  function reiniciar() {
    estado.analisis = null;
    estado.seleccion.clear();
    estado.activa = null;
    estado.filtro = "todas";
    estado.extraidas = [];
    estado.ruta = "";
    el.mensaje.hidden = true;
    el.loteMensaje.hidden = true;
    render();
  }

  async function extraerSeleccionadas() {
    const seleccionadas = (estado.analisis?.candidatas || []).filter(
      (c) => estado.seleccion.has(c.id) && c.estado !== "descartada",
    );

    if (!seleccionadas.length) {
      mostrarMensaje("Selecciona al menos una receta.", "aviso");
      return;
    }

    if (!puente.extraerReceta) {
      mostrarMensaje("La app de escritorio no tiene el módulo de extracción.", "error");
      return;
    }

    if (
      seleccionadas.length > 8 &&
      !window.confirm(
        `Vas a extraer ${seleccionadas.length} recetas con IA. Puede tardar varios minutos. ¿Continuar?`,
      )
    ) {
      return;
    }

    estado.extrayendo = true;
    estado.extraidas = [];
    el.extraccion.hidden = false;
    el.guardar.hidden = true;
    el.irLotes.hidden = true;
    el.loteMensaje.hidden = true;
    renderExtraccion(0, seleccionadas.length);

    for (let indice = 0; indice < seleccionadas.length; indice++) {
      const candidata = seleccionadas[indice];
      el.extraccionResumen.textContent = `Extrayendo ${indice + 1} de ${seleccionadas.length}: ${candidata.titulo}`;

      try {
        const receta = await puente.extraerReceta(candidata.texto);
        receta.origen = `p. ${candidata.pagina_inicio}`;
        receta.pagina = candidata.pagina_inicio;
        estado.extraidas.push(receta);
      } catch (error) {
        estado.extraidas.push({
          nombre: candidata.titulo,
          error: error?.message || String(error),
          origen: `p. ${candidata.pagina_inicio}`,
        });
      }

      renderExtraccion(indice + 1, seleccionadas.length);
    }

    estado.extrayendo = false;
    renderExtraccion(seleccionadas.length, seleccionadas.length);
  }

  function renderExtraccion(hechas, total) {
    el.extraccion.hidden = false;
    el.extraccionSpinner.hidden = !estado.extrayendo;
    el.extraer.disabled = estado.extrayendo;

    const validas = estado.extraidas.filter((receta) => !receta.error);
    const errores = estado.extraidas.filter((receta) => receta.error);

    if (!estado.extrayendo) {
      el.extraccionResumen.textContent = `${validas.length} receta${validas.length === 1 ? "" : "s"} lista${validas.length === 1 ? "" : "s"}${errores.length ? ` · ${errores.length} con error` : ""}`;
    } else {
      el.extraccionResumen.textContent = `Extrayendo ${hechas} de ${total}…`;
    }

    el.resultados.innerHTML = estado.extraidas
      .map((receta) => {
        if (receta.error) {
          return `<article class="chef__resultado">
            <h3>${escapar(receta.nombre)}</h3>
            <p class="text-danger">${escapar(receta.error)}</p>
          </article>`;
        }

        const avisos = (receta.avisos || [])
          .map((aviso) => `<li>${escapar(aviso)}</li>`)
          .join("");

        return `<article class="chef__resultado">
          <h3>${escapar(receta.nombre)}</h3>
          <p>${receta.ingredientes.length} ingredientes · ${receta.pasos.length} pasos · ${receta.tiempo_min} min · ${receta.porciones} porciones · ${escapar(receta.categoria)}</p>
          ${avisos ? `<ul>${avisos}</ul>` : ""}
        </article>`;
      })
      .join("");

    el.guardar.hidden = estado.extrayendo || validas.length === 0;
    el.guardar.textContent = `Guardar ${validas.length} receta${validas.length === 1 ? "" : "s"} como pendiente${validas.length === 1 ? "" : "s"}`;
  }

  async function guardarLote() {
    const validas = estado.extraidas.filter((receta) => !receta.error);

    if (!validas.length) {
      return;
    }

    el.guardar.disabled = true;
    el.loteMensaje.hidden = true;

    try {
      const respuesta = await fetch("/api/chef/lotes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": tokenCsrf(),
        },
        body: JSON.stringify({
          nombre: estado.analisis?.nombre || "Libro sin título",
          autor: "",
          archivo: estado.analisis?.archivo || estado.ruta,
          recetas: validas.map((receta) => ({
            nombre: receta.nombre,
            descripcion: receta.descripcion,
            porciones_base: receta.porciones,
            tiempo_min: receta.tiempo_min,
            dificultad: receta.dificultad,
            categoria: receta.categoria,
            tipos: receta.tipos,
            ingredientes: receta.ingredientes,
            pasos: receta.pasos,
            avisos: receta.avisos || [],
            origen: receta.origen,
          })),
        }),
      });

      const datos = await respuesta.json();

      if (!respuesta.ok || datos.ok !== true) {
        throw new Error(datos?.error?.message || "No se pudo guardar el lote.");
      }

      el.loteMensaje.textContent = `Lote guardado: ${datos.data.guardadas} recetas pendientes.`;
      el.loteMensaje.className = "chef__message chef__message--ok";
      el.loteMensaje.hidden = false;
      el.guardar.hidden = true;
      el.irLotes.hidden = false;
    } catch (error) {
      el.loteMensaje.textContent = error?.message || String(error);
      el.loteMensaje.className = "chef__message chef__message--error";
      el.loteMensaje.hidden = false;
      el.guardar.disabled = false;
    }
  }

  function tokenCsrf() {
    return document.querySelector('meta[name="csrf-token"]')?.content || "";
  }

  function seleccionarListas() {
    for (const candidata of estado.analisis?.candidatas || []) {
      if (candidata.estado === "lista") estado.seleccion.add(candidata.id);
    }
    render();
  }

  function quitarSeleccion() {
    estado.seleccion.clear();
    render();
  }

  function alternarTodas() {
    estado.seleccion.clear();

    if (el.todas.checked) {
      for (const candidata of estado.analisis?.candidatas || []) {
        if (candidata.estado !== "descartada") estado.seleccion.add(candidata.id);
      }
    }

    render();
  }

  function alternarSeleccion(id) {
    if (estado.seleccion.has(id)) estado.seleccion.delete(id);
    else estado.seleccion.add(id);
    render();
  }

  function render() {
    const analisis = estado.analisis;

    el.progreso.hidden = !estado.cargando;
    el.libro.hidden = !analisis;
    el.filtros.hidden = !analisis;
    el.layout.hidden = !analisis;
    el.acciones.hidden = !analisis;
    el.extraccion.hidden = !analisis || estado.extraidas.length === 0;
    el.app.querySelector("[data-chef-drop]").hidden = !!analisis || estado.cargando;

    if (!analisis) {
      el.todas.checked = false;
      el.seleccion.textContent = "0 seleccionadas";
      el.contador.textContent = "0 recetas";
      return;
    }

    el.nombre.textContent = analisis.nombre;
    const utiles = (analisis.candidatas || []).filter((c) => c.estado !== "descartada");
    el.resumen.textContent = `${analisis.paginas} páginas · ${utiles.length} recetas detectadas de ${analisis.candidatas.length} bloques`;

    if (analisis.avisos?.length) {
      mostrarMensaje(analisis.avisos.join(" "), "aviso");
    } else if (!el.mensaje.dataset.manual) {
      el.mensaje.hidden = true;
    }

    renderFiltros(analisis);
    renderItems();
    renderPreview();
    renderSeleccion();
  }

  function renderFiltros(analisis) {
    const cuenta = (estadoFiltro) =>
      estadoFiltro === "todas"
        ? analisis.candidatas.length
        : analisis.candidatas.filter((c) => c.estado === estadoFiltro).length;

    el.filtros.innerHTML = [
      ["todas", "Todas"],
      ["lista", "Listas"],
      ["dudosa", "Dudosas"],
      ["descartada", "Descartadas"],
    ]
      .map(
        ([clave, texto]) =>
          `<button class="chef__filtro${estado.filtro === clave ? " is-active" : ""}" type="button" data-chef-filtro="${clave}">
             ${texto} <span>${cuenta(clave)}</span>
           </button>`,
      )
      .join("");
  }

  function renderItems() {
    const visibles = (estado.analisis?.candidatas || []).filter(
      (c) => estado.filtro === "todas" || c.estado === estado.filtro,
    );

    if (!visibles.length) {
      el.items.innerHTML = `<p class="chef__vacio">No hay recetas en este filtro.</p>`;
      return;
    }

    el.items.innerHTML = visibles
      .map((candidata) => {
        const seleccionada = estado.seleccion.has(candidata.id);
        const activa = estado.activa === candidata.id;
        const paginas =
          candidata.pagina_inicio === candidata.pagina_fin
            ? `p. ${candidata.pagina_inicio}`
            : `pp. ${candidata.pagina_inicio}–${candidata.pagina_fin}`;
        const provisional = candidata.titulo.startsWith("Receta sin título");

        return `
          <article class="chef__item${activa ? " is-active" : ""}${candidata.estado === "descartada" ? " is-discarded" : ""}" data-chef-preview-id="${candidata.id}">
            <label class="chef__check" aria-label="Seleccionar ${escapar(candidata.titulo)}">
              <input type="checkbox" data-chef-candidata="${candidata.id}" ${seleccionada ? "checked" : ""}>
            </label>
            <div class="chef__item-body">
              <h3>${escapar(candidata.titulo)}</h3>
              <p>${paginas} · ${candidata.lineas} líneas · ${candidata.ingredientes_detectados} ingredientes · ${candidata.pasos_detectados} pasos</p>
              ${candidata.motivo ? `<small>${escapar(candidata.motivo)}</small>` : ""}
            </div>
            <div class="chef__item-side">
              <span class="chef__estado chef__estado--${escapar(candidata.estado)}">${etiquetaEstado(candidata.estado)}</span>
              ${provisional ? `<span class="chef__sin-titulo">Sin título</span>` : ""}
              <span class="chef__confianza">${candidata.confianza}%</span>
            </div>
          </article>`;
      })
      .join("");
  }

  function renderPreview() {
    const candidata = estado.analisis?.candidatas.find((c) => c.id === estado.activa);

    if (!candidata) {
      el.preview.innerHTML = `<div class="chef__preview-vacio">
        <i class="bi bi-eye" aria-hidden="true"></i>
        <p>Elige una receta de la lista para ver lo que se detectó.</p>
      </div>`;
      return;
    }

    const seleccionada = estado.seleccion.has(candidata.id);
    const provisional = candidata.titulo.startsWith("Receta sin título");

    el.preview.innerHTML = `
      <div class="chef__preview-head">
        <span class="chef__estado chef__estado--${escapar(candidata.estado)}">${etiquetaEstado(candidata.estado)}</span>
        <span>p. ${candidata.pagina_inicio}${candidata.pagina_fin !== candidata.pagina_inicio ? `–${candidata.pagina_fin}` : ""}</span>
      </div>
      <h2>${escapar(candidata.titulo)}</h2>
      ${candidata.motivo ? `<p class="chef__motivo">${escapar(candidata.motivo)}</p>` : ""}
      <div class="chef__barra"><span style="width:${Math.max(4, Math.min(100, candidata.confianza))}%"></span></div>
      <p class="chef__confianza-linea">${candidata.confianza}% de confianza · ${candidata.lineas} líneas</p>

      ${
        provisional && puente.buscarTituloVision
          ? `<button class="btn btn-outline-primary btn-sm w-100 mb-2" type="button" data-chef-vision="${candidata.id}">
               <i class="bi bi-eye-fill" aria-hidden="true"></i>
               Buscar título con visión
             </button>`
          : ""
      }

      <button class="btn ${seleccionada ? "btn-outline-secondary" : "btn-primary"} btn-sm w-100" type="button" data-chef-toggle="${candidata.id}">
        <i class="bi ${seleccionada ? "bi-dash-lg" : "bi-plus-lg"}" aria-hidden="true"></i>
        ${seleccionada ? "Quitar de la selección" : "Añadir a la selección"}
      </button>

      <h3 class="chef__subtitulo">Texto detectado</h3>
      <pre class="chef__texto">${escapar(candidata.texto || candidata.vista_previa || "")}</pre>`;
  }

  function renderSeleccion() {
    const total = estado.seleccion.size;
    el.seleccion.textContent = `${total} seleccionada${total === 1 ? "" : "s"}`;
    el.contador.textContent = `${total} receta${total === 1 ? "" : "s"}`;
    el.todas.checked =
      total > 0 && total === (estado.analisis?.candidatas || []).filter((c) => c.estado !== "descartada").length;
  }

  function candidataActiva(id) {
    return (estado.analisis?.candidatas || []).find((c) => c.id === id) ?? null;
  }

  function mostrarError(error) {
    mostrarMensaje(error?.message || String(error), "error");
  }

  function mostrarMensaje(texto, tipo) {
    el.mensaje.textContent = texto;
    el.mensaje.className = `chef__message chef__message--${tipo}`;
    el.mensaje.hidden = false;
    el.mensaje.dataset.manual = "1";

    window.clearTimeout(mostrarMensaje.temporizador);
    mostrarMensaje.temporizador = window.setTimeout(() => {
      el.mensaje.hidden = true;
      delete el.mensaje.dataset.manual;
    }, 6000);
  }

  function etiquetaEstado(estado) {
    return estado === "lista" ? "Lista" : estado === "dudosa" ? "Dudosa" : "Descartada";
  }

  function escapar(texto) {
    return String(texto)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }
})();
