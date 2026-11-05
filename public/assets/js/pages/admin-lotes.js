(function () {
  "use strict";

  const root = document.querySelector("[data-admin-lotes]");
  if (!root) return;

  const mensaje = root.querySelector("[data-admin-lotes-mensaje]");
  const csrf = document.querySelector('meta[name="csrf-token"]')?.content || "";

  abrirDesdeHash();

  window.addEventListener("hashchange", abrirDesdeHash);

  root.addEventListener("click", async (evento) => {
    const toggle = evento.target.closest("[data-lote-toggle]");
    if (toggle) {
      alternarPanel(toggle.dataset.loteToggle);
      return;
    }

    const quitar = evento.target.closest("[data-quitar-receta]");
    if (quitar) {
      const nombre = quitar.dataset.recetaNombre || "esta receta";
      if (!window.confirm(`¿Quitar "${nombre}" del lote? Se borrará de forma permanente.`)) {
        return;
      }

      quitar.disabled = true;

      try {
        const respuesta = await fetch(
          `/api/admin/lotes/${quitar.dataset.loteId}/recetas/${quitar.dataset.quitarReceta}`,
          {
            method: "DELETE",
            headers: { "X-CSRF-Token": csrf },
          },
        );
        const datos = await respuesta.json();

        if (!respuesta.ok || datos.ok !== true) {
          throw new Error(datos?.error?.message || "No se pudo quitar la receta.");
        }

        window.location.replace(`/admin/recetas/lotes#lote-${quitar.dataset.loteId}`);
        window.location.reload();
      } catch (error) {
        quitar.disabled = false;
        mostrarError(error);
      }

      return;
    }

    const boton = evento.target.closest("[data-lote-accion]");
    if (!boton) return;

    const id = boton.dataset.loteId;
    const accion = boton.dataset.loteAccion;

    if (accion === "descartar" && !window.confirm("¿Deshacer este lote y borrar sus recetas?")) {
      return;
    }

    boton.disabled = true;

    try {
      const respuesta = await fetch(`/api/admin/lotes/${id}/${accion}`, {
        method: "POST",
        headers: { "X-CSRF-Token": csrf },
      });
      const datos = await respuesta.json();

      if (!respuesta.ok || datos.ok !== true) {
        throw new Error(datos?.error?.message || "No se pudo completar la acción.");
      }

      window.location.reload();
    } catch (error) {
      boton.disabled = false;
      mostrarError(error);
    }
  });

  function alternarPanel(loteId) {
    const panel = root.querySelector(`[data-lote-panel="${loteId}"]`);
    const boton = root.querySelector(`[data-lote-toggle="${loteId}"]`);
    if (!panel || !boton) return;

    const abrir = panel.hidden;
    panel.hidden = !abrir;
    boton.setAttribute("aria-expanded", abrir ? "true" : "false");

    if (abrir) {
      const fila = root.querySelector(`#lote-${loteId}`);
      fila?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function abrirDesdeHash() {
    const coincide = window.location.hash.match(/^#lote-([a-f0-9]{32})$/);

    if (!coincide) return;

    const panel = root.querySelector(`[data-lote-panel="${coincide[1]}"]`);
    if (panel && panel.hidden) {
      alternarPanel(coincide[1]);
    }
  }

  function mostrarError(error) {
    mensaje.textContent = error?.message || String(error);
    mensaje.className = "form__message form__message--error";
    mensaje.hidden = false;
    mensaje.scrollIntoView({ behavior: "smooth", block: "center" });
  }
})();
