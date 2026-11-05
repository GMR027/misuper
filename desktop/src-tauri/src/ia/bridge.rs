//! Puente entre la web de Mi Súper y la app de escritorio.
//!
//! La página `/chef` vive en la web, pero el PDF se analiza en el equipo. El
//! script se inyecta al inicio de cada página del webview y expone métodos
//! mínimos; los comandos siguen exigiendo administrador.

pub const SCRIPT: &str = r#"(function () {
  const invocar = (comando, argumentos) => {
    const internos = window.__TAURI_INTERNALS__;
    if (!internos || typeof internos.invoke !== "function") {
      return Promise.reject(new Error("La app de escritorio no está disponible."));
    }
    return internos.invoke(comando, argumentos || {});
  };

  const puente = {
    get disponible() {
      const internos = window.__TAURI_INTERNALS__;
      return !!(internos && typeof internos.invoke === "function");
    },
    version: 1,
    estado: () => invocar("app_state"),
    elegirPdf: () => invocar("importar_elegir_pdf"),
    analizarPdf: (ruta) => invocar("importar_analizar_pdf", { ruta }),
    extraerReceta: (texto) => invocar("importar_extraer_receta", { texto }),
    buscarTituloVision: (ruta, pagina) =>
      invocar("importar_titulo_vision", { ruta, pagina }),
    menuCompletar: (prompt) => invocar("menu_completar", { prompt }),
  };

  try {
    Object.defineProperty(window, "MiSuperDesktop", {
      value: puente,
      configurable: true,
    });
  } catch (error) {
    window.MiSuperDesktop = puente;
  }
})();"#;
