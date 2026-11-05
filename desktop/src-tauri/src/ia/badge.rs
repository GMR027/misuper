//! Insignia de IA que la app inyecta en la cabecera de la web.
//!
//! La web remota no tiene IPC. Por eso la app construye el HTML y el estado en
//! Rust y los inyecta con `eval` en cada carga de página. Solo se pinta si el
//! usuario es administrador.

use crate::state::AppState;
use tauri::{AppHandle, Manager};

const ESTILOS: &str = r#"
#misuper-ia-style { display: none; }
.misuper-ia-badge {
  display: inline-flex;
  align-items: center;
  gap: .4rem;
  max-width: 16rem;
  margin-right: .35rem;
  padding: .28rem .6rem;
  border: 1px solid var(--border, #dfe7e3);
  border-radius: 999px;
  background: var(--surface, #fff);
  color: var(--body-ink, #1f2a26);
  font-size: .76rem;
  font-weight: 600;
  line-height: 1;
  text-decoration: none;
  white-space: nowrap;
  transition: border-color .15s ease, box-shadow .15s ease, transform .15s ease;
}
.misuper-ia-badge:hover,
.misuper-ia-badge:focus-visible {
  border-color: var(--p-300, #9ed7c3);
  box-shadow: 0 4px 12px rgba(15, 122, 87, .12);
  text-decoration: none;
  transform: translateY(-1px);
}
.misuper-ia-badge:focus-visible { outline: 2px solid var(--p-500, #14b8a6); outline-offset: 2px; }
.misuper-ia-badge__dot {
  flex: 0 0 auto;
  width: .55rem;
  height: .55rem;
  border-radius: 50%;
  background: #94a3b8;
  box-shadow: 0 0 0 2px rgba(148, 163, 184, .2);
}
.misuper-ia-badge--ok .misuper-ia-badge__dot { background: #16a34a; box-shadow: 0 0 0 2px rgba(22, 163, 74, .2); }
.misuper-ia-badge--aviso .misuper-ia-badge__dot { background: #d97706; box-shadow: 0 0 0 2px rgba(217, 119, 6, .2); }
.misuper-ia-badge--error .misuper-ia-badge__dot { background: #dc2626; box-shadow: 0 0 0 2px rgba(220, 38, 38, .2); }
.misuper-ia-badge__text { overflow: hidden; text-overflow: ellipsis; }
@media (max-width: 1150px) {
  .misuper-ia-badge { max-width: 4.5rem; padding: .3rem .4rem; }
  .misuper-ia-badge__text { display: none; }
}
"#;

pub fn inyectar(ventana: &tauri::WebviewWindow) {
    let Some(estado) = ventana.app_handle().try_state::<AppState>() else {
        return;
    };

    let ia = estado.ia();
    let insignia = super::model::estado_insignia(&ia);

    let datos = serde_json::json!({
        "visible": insignia.visible,
        "estado": insignia.estado,
        "proveedor": insignia.proveedor,
        "modelo": insignia.modelo,
        "detalle": insignia.detalle,
    });

    let script = format!(
        r#"(function () {{
  try {{
    const data = {datos};
    const existente = document.querySelector('[data-ia-badge]');

    if (!data.visible) {{
      if (existente) existente.remove();
      return;
    }}

    const rol = document.body && document.body.dataset ? document.body.dataset.userRole : '';
    const esAdmin = rol === 'admin' || !!document.querySelector('[data-admin-menu-toggle]');
    if (!esAdmin) return;

    if (!document.getElementById('misuper-ia-style')) {{
      const style = document.createElement('style');
      style.id = 'misuper-ia-style';
      style.textContent = {estilos};
      document.head.appendChild(style);
    }}

    const cuenta = document.querySelector('.app-header__account');
    if (!cuenta) return;

    let badge = existente;
    if (!badge) {{
      badge = document.createElement('a');
      badge.setAttribute('data-ia-badge', '');
      badge.href = 'misuper-ia://open';
      const perfil = cuenta.querySelector('.app-header__profile');
      cuenta.insertBefore(badge, perfil || cuenta.firstChild);
    }}

    const texto = [data.proveedor, data.modelo].filter(Boolean).join(' · ');
    badge.hidden = false;
    badge.className = 'misuper-ia-badge misuper-ia-badge--' + data.estado;
    badge.title = data.detalle || '';
    badge.setAttribute('aria-label', 'Modelo de IA activo: ' + texto + '. Abrir ajustes de IA.');
    badge.innerHTML = '<span class="misuper-ia-badge__dot" aria-hidden="true"></span>' +
      '<span class="misuper-ia-badge__text"></span>';
    badge.querySelector('.misuper-ia-badge__text').textContent = texto;
  }} catch (error) {{}}
}})();"#,
        datos = datos,
        estilos = serde_json::to_string(ESTILOS).unwrap_or_else(|_| "\"\"".to_string()),
    );

    let _ = ventana.eval(&script);
}

pub fn inyectar_app(app: &AppHandle) {
    if let Some(ventana) = app.get_webview_window("main") {
        inyectar(&ventana);
    }
}
