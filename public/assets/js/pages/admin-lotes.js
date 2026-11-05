(function () {
  "use strict";

  const root = document.querySelector("[data-admin-lotes]");
  if (!root) return;

  const mensaje = root.querySelector("[data-admin-lotes-mensaje]");
  const csrf = document.querySelector('meta[name="csrf-token"]')?.content || "";

  root.addEventListener("click", async (evento) => {
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
      mensaje.textContent = error?.message || String(error);
      mensaje.className = "form__message form__message--error";
      mensaje.hidden = false;
    }
  });
})();
