# PROJECT_STATE.md

## Proyecto
App web de despensa y compras. El usuario registra sus compras del súper en el momento,
ve cuánto gasta al mes y en qué 10 productos se le va el dinero.
Stack: PHP 8.1+, MySQL 8, PDO, HTML + CSS + JS vanilla (módulos ES6). Sin frameworks.

## Estado
- Fase actual: MVP COMPLETO CON BOOTSTRAP
- Fases completadas: Fase 1, Fase 2, Fase 3, Fase 4, Fase 5, Fase 6, Fase 7, Fase 8, Fase 9, Fase 10, Fase 11.0, Fase 11.1, Fase 11.2, Fase 11.3, Fase 11.4
- Próximo chunk: MVP COMPLETO CON BOOTSTRAP. Sin fases pendientes.

## Alcance del MVP (resumen)
- Registro abierto, login, logout, sesiones PHP.
- Recuperación de contraseña: reset manual por el Admin (sin SMTP).
- Catálogo de ~200 productos con categoría fija, unidad base fija e imagen de Pexels (hotlink).
- Admin con CRUD de productos, bandeja de sugerencias y lista de usuarios.
- Pantalla rápida: buscador, categorías, productos frecuentes, carrito con localStorage, edición inline, total, guardar compra.
- Compras: sin supermercado, editables y borrables sin restricción.
- Historial agrupado por mes + detalle editable.
- Métricas: gasto mensual + top 10 productos por gasto del mes.
- Sugerencias: ítem libre genera sugerencia agrupada; Admin aprueba o ignora.
- Ajustes: cambiar nombre/email, cambiar contraseña, cerrar sesión, eliminar cuenta (hard delete).

## Fuera del alcance (NO implementar)
- Recetas, planes alimenticios, calculadora de despensa.
- Presupuestos, OCR de tickets, notificaciones internas.
- Auditoría, familias, cotizaciones, estados múltiples de compra.
- Import/export CSV desde la app (solo script de importación inicial).
- Sinónimos, atributos extensibles, métricas globales, cron.
- Modo soporte, ARCO formal, PWA, multi-idioma, foto de perfil, preferencias, temas.
- SMTP, email transaccional.
- Frameworks CSS/JS (Bootstrap, jQuery, React, Vue, Materialize, Tailwind).

## Roles
- Usuario: usa la app, gestiona sus compras y métricas.
- Admin: gestiona catálogo, sugerencias y usuarios. Accede por /admin/*.

## Modelo de datos (6 tablas)

usuarios (id, nombre, email UNIQUE, password_hash, rol ENUM('usuario','admin'),
          debe_cambiar_password BOOL, created_at)

categorias (id, nombre UNIQUE)
-- Seed fijo: Lácteos, Carnes, Frutas y Verduras, Cereales y Legumbres,
-- Bebidas, Limpieza, Hogar, Otros. Sin CRUD.

productos (id, nombre, categoria_id FK, unidad_base ENUM('kg','L','pza'),
           imagen_url VARCHAR(500) NULL, estado ENUM('activo','inactivo'),
           created_at, updated_at)

compras (id, usuario_id FK, fecha DATE, total DECIMAL(12,2) DEFAULT 0,
         created_at, updated_at)

compra_items (id, compra_id FK ON DELETE CASCADE, producto_id NULL FK,
              nombre_libre NULL VARCHAR(150), cantidad DECIMAL(12,3),
              precio_total DECIMAL(12,2),
              CHECK (producto_id XOR nombre_libre))

sugerencias_producto (id, nombre_normalizado VARCHAR(150), nombre_original VARCHAR(150),
                      estado ENUM('pendiente','aprobada','ignorada') DEFAULT 'pendiente',
                      usuario_id FK, created_at,
                      UNIQUE(nombre_normalizado, usuario_id, estado))

## Reglas clave
- compras.total es caché: se recalcula al crear/editar/borrar ítems.
- compra_items: producto_id XOR nombre_libre, nunca ambos.
- Precio unitario = precio_total / cantidad. Se calcula al vuelo, no se guarda.
- Borrado de cuenta = hard delete en cascada.
- Buscador normaliza minúsculas y acentos.
- Sugerencias se agrupan por nombre_normalizado; al aprobar, todas se resuelven.
- Sesiones PHP nativas. Cookies HttpOnly, SameSite=Lax, Secure solo si APP_ENV=production.
- CSRF obligatorio en POST/PUT/DELETE.
- Rate limiting: 5 intentos / 15 min en login y registro.
- password_hash(PASSWORD_DEFAULT) y password_verify. Nunca MD5/SHA1.

## Convenciones
- PHP PSR-12, namespaces App\..., Composer autoload.
- SQL snake_case plural, FK tabla_id.
- JS módulos ES6, camelCase.
- API responde { ok: bool, data: any, error: { code, message } }.
- HTTP: 400, 401, 403, 404, 422, 429, 500.
- Migraciones SQL numeradas e idempotentes con IF NOT EXISTS.

## Estructura de carpetas
/public
  index.php
  /assets/{css, js/modules, js/pages, img}
/src
  /Controllers /Models /Repositories /Services /Middleware
  /Validators /Views /Support
/config
/routes
/database/{migrations, seeds, csv}
/scripts
/storage/logs

## Decisiones cerradas (24)
1. Admin con panel mínimo + catálogo de ~200 productos.
2. Registro abierto.
3. Compras sin supermercado.
4. Carrito en memoria + localStorage.
5. Captura cantidad (decimal) + total pagado; precio unitario calculado.
6. Una sola unidad base por producto (kg, L, pza).
7. Compras editables y borrables sin restricción.
8. Métricas: solo gasto mensual + top 10 por gasto del mes.
9. Top 10 sobre el mes seleccionado.
10. Ajustes: solo cuenta (email, contraseña, logout, eliminar cuenta).
11. 6 pantallas + panel Admin: login/registro, pantalla rápida, historial, detalle, métricas, ajustes; Admin con productos/sugerencias/usuarios.
12. Panel Admin completo (CRUD productos + lista usuarios).
13. Importación inicial de ~200 productos vía CSV, SIN imágenes. Las imágenes se agregan manualmente después desde el panel Admin.
14. Buscador de Pexels en panel Admin: DIFERIDO. No se implementa en el MVP. El campo imagen_url se llena manualmente con una URL pegada por el Admin.
15. Categorías fijas por seed, sin CRUD.
16. Ítem libre + sugerencia al Admin.
17. Sugerencias agrupadas por nombre normalizado; aprobar resuelve todas.
18. 6 tablas estrictas.
19. compras.total guardado como caché, recalculado al editar ítems.
20. Pantalla rápida completa: buscador + categorías + edición inline + total + frecuentes.
21. Frecuentes = top 5-8 por frecuencia (no por gasto).
22. Recuperación de contraseña = reset manual por Admin.
23. HTTP en dev, HTTPS en prod (cookies Secure solo en prod).
24. Borrado de cuenta = hard delete total.

## Deudas / pendientes
- Decisión de estilos visuales: CSS puro (decidido en Fase 1, sin framework).
- Infraestructura de despliegue: PENDIENTE.
- Backup manual: PENDIENTE definir procedimiento.
- MySQL: en desarrollo se usa root sin contraseña con BD despensa_app (solo dev, no producción). En producción: crear usuario dedicado con permisos solo sobre despensa_app. Verificar con: php scripts/check_db.php
- Seed del Admin: la contraseña se define en ADMIN_PASSWORD (.env). Si no se define, scripts/seed.php genera una temporal aleatoria y la muestra una sola vez al ejecutarse.
- Rate limit en storage/logs/rate_limit.json sin tope global. Tiene poda por ventana en cada acceso. En producción: evaluar migrar a Redis o tabla si el volumen crece.
- Verificación de redirecciones JS: la de login → / o /cambiar-password-forzado sigue sin probarse en navegador (solo inspección de código). El guard server-side de / sí se verificó con curl.
- Admin seed tiene debe_cambiar_password=1. Al primer login, la contraseña inicial (definida en ADMIN_PASSWORD o generada por el seed) debe reemplazarse por una nueva.
- Guard server-side en '/' redirige a /cambiar-password-forzado si debe_cambiar_password=1. Comportamiento intencional documentado.
- Flujo de cambio forzado verificado con curl, no en navegador real. Probar manualmente en Fase 4 o 5.
- Borrado en cascada de compras/compra_items/sugerencias_producto queda a la espera de que esas tablas existan con FK ON DELETE CASCADE.
- Flujo JS del panel Admin (crear/editar/desactivar desde navegador, toast, window.confirm) verificado solo por API + HTML renderizado con curl. Probar manualmente antes de cerrar Fase 7.
- Catálogo vacío (0 productos). Se poblará en Fase 5 con la importación Pexels.
- Fase 5: importación de 200 productos sin imágenes. El campo productos.imagen_url queda nullable; el Admin las agrega manualmente desde el panel. No hay dependencia de Pexels en el MVP.
- .env: PEXELS_API_KEY ya no se requiere en el MVP. Puede eliminarse del .env local.
- Producto de prueba (Leche, id=3) eliminado de la tabla productos. AUTO_INCREMENT reseteado a 1. Tabla vacía, lista para importación.
- Catálogo con 200 productos activos, todos con imagen_url=NULL. Las imágenes se agregarán manualmente desde el panel Admin (campo de texto, sin buscador de Pexels).
- Verificar manualmente la asignación de imagen_url al menos una vez en /admin/productos/{id} para confirmar que el input de texto + preview funcionan.
- compra_items no persiste unidad_base para ítems libres. El detalle los muestra sin unidad. Aceptable en MVP; si molesta, migración 006 para agregar la columna.
- Redirección tras guardar compra va a /?guardada=1 (placeholder). Se corrige en Fase 7 cuando exista /historial.
- Carrito en localStorage: si el usuario limpia localStorage manualmente, pierde el carrito. Aceptable en MVP.
- Editar solo cantidad no ajusta precio_total proporcionalmente. El usuario debe cambiar ambos si compró distinto. Coherente con el modelo de captura (cantidad + total pagado).
- Detalle de compra recarga la vista después de cada cambio (simple, no lo más eficiente). Aceptable en MVP.
- Métricas calculadas en tiempo real con SUM() y GROUP BY. Si el volumen crece a miles de compras por usuario, evaluar caché en fase 2 (no es problema ahora).
- Al resolver un grupo de sugerencias, se eliminan las filas pendientes duplicadas del mismo usuario para respetar el UNIQUE. Decisión de diseño aceptada.
- POST /api/sugerencias se dispara en background desde pantalla rápida al agregar ítem libre. Si el usuario borra el ítem del carrito, la sugerencia queda pendiente igual. Aceptable en MVP.
- Si un usuario escribe un nombre libre que ya existe como producto en el catálogo, la sugerencia se crea igual. En una iteración futura se puede detectar y no crear la sugerencia (mejora opcional).
- MVP COMPLETO. Todas las fases cerradas. La app está funcional de extremo a extremo.
- La contraseña temporal del reset no se guarda en claro. Si el Admin la pierde antes de compartirla, debe repetir el reset.
- Pendientes post-MVP (evaluar según uso real): imágenes de productos (actualmente NULL), búsqueda de Pexels (diferida), deploy a producción con HTTPS y usuario dedicado de MySQL, backup automático.
- Bootstrap 5.3.8 cargado vía CDN jsDelivr. CSP configurada para permitir cdn.jsdelivr.net. Para producción: considerar SRI (Subresource Integrity) o auto-hospedar Bootstrap para no depender de CDN externo.
- Fase 11.0 solo integró Bootstrap. Las vistas aún usan CSS propio. Refactorización por pantalla en fases 11.1-11.4.
- cuenta.css sigue siendo base compartida de pantalla rápida, historial, métricas y admin. Se irá reduciendo conforme se refactoricen esas vistas en 11.2-11.4.
- El layout auth.php oculta el header propio para no duplicar el título. Comportamiento intencional.
- Modales propios renombrados .modal → .app-modal para evitar colisión con el componente modal de Bootstrap. Mecanismo propio de toasts conservado con override CSS.
- Historial: paginación usa botones page-link con data-page-prev/next (el JS los escucha). Detalle conserva patrón clic-para-editar. Aviso ?guardada=1 es alert del servidor sin toast duplicado.
- REDISEÑO COMPLETO. Toda la app usa Bootstrap 5.3.8. CSS propio reducido a overrides mínimos (auth 61, cuenta 383 pendiente de reducir, pantalla-rapida 285, historial 94, metricas 29, admin 50, admin-sugerencias 8, admin-usuarios 20).
- Modales propios .app-modal controlados por JS, estilizados con Bootstrap. Reset de contraseña usa modal de dos paneles.
- cuenta.css (383 líneas) es el único CSS propio pendiente de reducir. Se puede hacer en una iteración futura si molesta.
- Pendientes post-MVP: imágenes de productos (actualmente NULL), deploy a producción con HTTPS y usuario dedicado de MySQL, backup automático, SRI o auto-hospedaje de Bootstrap.

## Archivos creados
Fase 1: estructura base (ver STATE_HANDOFF de Fase 1).
Fase 2: 23 archivos nuevos (2 migraciones, 2 seeds, 2 scripts, 10 backend, 3 vistas, 3 JS, 1 CSS) + routes/api.php y routes/web.php modificados. Detalle en STATE_HANDOFF de Fase 2.
Fase 3: 8 archivos nuevos (AccountService, AccountValidator, layout app, ajustes.php, cambiar-password-forzado.php, ajustes.js, cambiar-password-forzado.js, cuenta.css) + 6 modificados (MeController, UsuarioRepository, routes/api.php, routes/web.php, login.js, PROJECT_STATE.md). Detalle en STATE_HANDOFF de Fase 3.
Fase 4: 13 archivos nuevos (1 migración, Model, Repositorio, Service, NormalizadorService, 2 Controllers, Validator, 2 vistas admin, admin-productos.js, admin.css) + 3 modificados (routes/api.php, routes/web.php, layouts/app.php). Detalle en STATE_HANDOFF de Fase 4.
Fase 5: 2 archivos nuevos (database/csv/productos_base.csv, scripts/importar_productos.php) + .env.example modificado (sin PEXELS_API_KEY). Detalle en STATE_HANDOFF de Fase 5.
Fase 6: 16 archivos nuevos (2 migraciones, 2 Models, 1 Repository, 2 Services, 1 Controller, 1 Validator, vista pantalla-rapida, 5 JS, 1 CSS) + 3 modificados (routes/api.php, routes/web.php, layouts/app.php). Detalle en STATE_HANDOFF de Fase 6.
Fase 7: 6 archivos nuevos (HistorialController, historial.php, compra-detalle.php, historial.js, compra-detalle.js, historial.css) + 3 modificados (routes/web.php, pantalla-rapida.js, layouts/app.php). Detalle en STATE_HANDOFF de Fase 7.
Fase 8: 6 archivos nuevos (MetricaRepository, MetricaService, MetricaController, metricas.php, metricas.js, metricas.css) + 3 modificados (routes/api.php, routes/web.php, layouts/app.php). Detalle en STATE_HANDOFF de Fase 8.
Fase 9: 10 archivos nuevos (1 migración, Model, Repository, Service, 2 Controllers, Validator, vista lista, admin-sugerencias.js, admin-sugerencias.css) + 5 modificados (routes/api.php, routes/web.php, layouts/app.php, pantalla-rapida.js, PROJECT_STATE.md). Detalle en STATE_HANDOFF de Fase 9.
Fase 10: 6 archivos nuevos (AdminUsuarioController, AdminUsuarioService, AdminUsuarioValidator, admin/usuarios/lista.php, admin-usuarios.js, admin-usuarios.css) + 5 modificados (UsuarioRepository, routes/api.php, routes/web.php, layouts/app.php, PROJECT_STATE.md). Detalle en STATE_HANDOFF de Fase 10.
Fase 11.0: 3 archivos modificados (src/Views/layouts/app.php, src/Views/layouts/auth.php, config/security.php). Bootstrap 5.3.8 vía CDN (CSS + bundle JS). CSP ajustada para permitir https://cdn.jsdelivr.net en style-src y script-src. Detalle en STATE_HANDOFF de Fase 11.0.
Fase 11.1: 6 archivos modificados (src/Views/auth/login.php, src/Views/auth/registro.php, src/Views/usuario/cambiar-password-forzado.php, src/Views/usuario/ajustes.php, public/assets/css/auth.css reducido a 61 líneas, public/assets/css/cuenta.css reducido a 383 líneas). Bootstrap aplicado a auth y ajustes. Detalle en STATE_HANDOFF de Fase 11.1.
Fase 11.2: 3 archivos modificados (src/Views/usuario/pantalla-rapida.php, public/assets/css/pantalla-rapida.css reducido a 285 líneas, public/assets/js/pages/pantalla-rapida.js solo clases de render). Modales propios renombrados .app-modal para evitar colisión con Bootstrap. Detalle en STATE_HANDOFF de Fase 11.2.
Fase 11.3: 7 archivos modificados (src/Views/usuario/historial.php, compra-detalle.php, metricas.php, public/assets/css/historial.css reducido a 94 líneas, public/assets/css/metricas.css reducido a 29 líneas, public/assets/js/pages/historial.js solo clases, public/assets/js/pages/compra-detalle.js solo clases). Detalle en STATE_HANDOFF de Fase 11.3.
Fase 11.4: 10 archivos modificados (4 vistas admin: productos/lista.php, productos/form.php, sugerencias/lista.php, usuarios/lista.php; 3 CSS: admin.css reducido a 50 líneas, admin-sugerencias.css a 8 líneas, admin-usuarios.css a 20 líneas; 3 JS: admin-productos.js, admin-sugerencias.js, admin-usuarios.js solo clases de render + preview de imagen). Detalle en STATE_HANDOFF de Fase 11.4.

## Cómo trabajar con el modelo
- Una fase por sesión. No pegar dos prompts juntos.
- Pegar este PROJECT_STATE.md al inicio de cada sesión.
- Esperar "✓ FASE X COMPRENDIDA — Listo para comenzar" antes de pedir código.
- Actualizar este archivo con el STATE_HANDOFF al cerrar cada fase.
- No avanzar si los criterios de aceptación fallan.

## STATE_HANDOFF — Fase 3 (Cuenta) — 2026-11-01
- Perfil editable (nombre/email), contraseña con verificación de la actual, baja de cuenta hard delete y cambio forzado.
- Endpoints nuevos: PUT /api/me, PUT /api/me/password, POST /api/me/password-forzado, DELETE /api/me. Todos con AuthMiddleware + CSRF.
- Vistas /ajustes y /cambiar-password-forzado con layout app; sin sesión redirigen a /login.
- Login expone debe_cambiar_password; login.js redirige a /cambiar-password-forzado y / también redirige server-side.
- Repositorio ampliado: updateProfile, emailExistsExcept, updatePasswordHashAndClearFlag, delete.
- Verificación: 20/20 criterios con curl; php -l 9/9 y node --check 3/3. Usuario de prueba borrado.
- Sin cambios de esquema ni datos fuera de despensa_app.
- Próximo chunk: Fase 4.

## STATE_HANDOFF — Fase 4 (Catálogo + CRUD Admin) — 2026-11-01
- Migración 003_create_productos.sql aplicada y re-ejecutable. Tablas: usuarios, categorias, migration_log, productos.
- CRUD Admin en /api/admin/productos (GET/POST/PUT/DELETE); DELETE = soft delete idempotente.
- Público: GET /api/categorias (8, orden alfabético) y GET /api/productos?q=&categoria_id=&page= (solo activos, 20/página).
- Búsqueda normalizada (minúsculas/sin acentos) con NormalizadorService + LOWER()/COLLATE utf8mb4_general_ci.
- Panel: /admin/productos (lista + buscador + filtros + paginación), /admin/productos/nuevo, /admin/productos/{id}.
- layouts/app.php: menú condicional admin ("Admin → Productos" solo con rol admin).
- Guards: AdminMiddleware en API (403 sin rol, 401 sin sesión); web.php redirige a /login sin sesión y 403 sin rol.
- Verificación: 20/20 criterios con curl; producto y usuario de prueba eliminados; BD limpia.
- Pendiente: flujo JS del panel no probado en navegador real (solo API + HTML renderizado con curl).
- Próximo chunk: Fase 5 — Importación con Pexels.

## STATE_HANDOFF — Fase 5 (Importación de productos) — 2026-11-01
- CSV database/csv/productos_base.csv: 200 filas + encabezado, 8 categorías, 0 duplicados.
- Script scripts/importar_productos.php: valida, resuelve categoría y inserta en una transacción.
- Importación: 200/200 insertados, 0 errores, exit code 0.
- Los 200 productos quedaron activos y con imagen_url NULL.
- Distribución: Lácteos 25, Carnes 20, Frutas y Verduras 35, Cereales y Legumbres 25, Bebidas 25, Limpieza 25, Hogar 20, Otros 25.
- Re-ejecución aborta con: "La tabla productos ya tiene 200 productos. Vacíala antes de reimportar." (exit 1).
- .env.example quedó sin PEXELS_API_KEY.
- No se creó PexelsService, PexelsController ni modal de Pexels.
- No se modificaron form.php, admin-productos-form.js ni routes/api.php.
- Esquema de productos sin cambios: mismas 8 columnas de Fase 4.
- Verificación: 15/15 criterios. php -l sin errores.
- Próximo chunk: Fase 6.

## STATE_HANDOFF — Fase 6 (Pantalla rápida) — 2026-11-01
- Migraciones 004/005 aplicadas: compras y compra_items con FK, CHECK y ON DELETE CASCADE.
- Backend completo: crear/listar/ver/editar/borrar compras e ítems con Auth + CSRF.
- Endpoints: /api/compras, /api/compras/{id}, /items, /api/productos/frecuentes y /buscar.
- GET / renderiza pantalla-rapida.php; sin sesión redirige a /login y respeta el cambio forzado.
- Frontend: buscador con debounce 300 ms, chips, frecuentes, carrito, edición inline, modales y toasts.
- Carrito en localStorage con clave carrito_actual y estructura { items: [...] }.
- Aviso de compra anterior al reabrir; guardado completo con un solo POST.
- Verificación: 27/27 criterios. Backend con curl y UI con Firefox headless + Marionette.
- UI: 9 chips, 7 resultados para “leche”, total editable a $35.50, continuación y guardado correctos.
- Datos de prueba eliminados: queda 1 admin, 0 compras, 0 ítems y 200 productos.
- Nota: compra_items no incluye unidad_base; el ítem libre la valida en POST, pero el detalle devuelve null.
- Nota: /historial aún no existe; tras guardar se redirige a /?guardada=1.
- Próximo chunk: Fase 7.

## STATE_HANDOFF — Fase 7 (Historial + Detalle) — 2026-11-01
- Rutas web GET /historial y GET /historial/{id} con guard de sesión y debe_cambiar_password.
- Historial agrupado por año-mes, orden descendente y paginación de 20 vía GET /api/compras?page=N.
- Detalle editable: fecha, cantidad, precio, alta de ítem catalogado/libre, borrado de ítem y compra.
- Todas las mutaciones reutilizan los endpoints de Fase 6; compras.total se recalcula con TotalesService.
- pantalla-rapida.js redirige a /historial?guardada=1; historial muestra toast "Compra guardada.".
- Menú: Pantalla rápida | Historial | Ajustes | Admin → Productos (solo admin).
- Nuevos: HistorialController, historial.php, compra-detalle.php, historial.js, compra-detalle.js, historial.css.
- Modificados: routes/web.php, pantalla-rapida.js, layouts/app.php.
- Verificación: 18/18 criterios con curl + Firefox headless/Marionette; php -l y node --check OK.
- BD final limpia: 1 admin, 0 compras, 0 ítems, 200 productos.
- Nota: editar solo cantidad recalcula la caché pero no cambia el total; precio_total manda.
- Próximo chunk: Fase 8 (no iniciada).

## STATE_HANDOFF — Fase 8 (Métricas) — 2026-11-01
- Métricas personales en tiempo real: sin caché, tablas resumen ni cron.
- GET /api/metricas/gasto-mensual?anio=YYYY: meses con compras (SUM(compras.total)), orden ASC.
- GET /api/metricas/top-productos?mes=&anio=: top 10 por gasto; ítems libres agrupados por nombre_libre.
- Ambos endpoints con AuthMiddleware + PDO prepared; validación de mes (1-12) y año (2000-2100).
- Vista /metricas con selector de año (2020-año actual), barras CSS y top 10 del mes.
- Cambiar mes recarga el top; cambiar año recarga gasto y top.
- Estados vacíos: "Sin compras en {año}." y "Sin compras en este mes.".
- Menú: Pantalla rápida | Historial | Métricas | Ajustes | Admin → Productos (solo admin).
- Nuevos: MetricaRepository, MetricaService, MetricaController, metricas.php, metricas.js, metricas.css.
- Modificados: routes/api.php, routes/web.php, layouts/app.php, PROJECT_STATE.md.
- Verificación: 15/15 criterios; php -l 7/7 y node --check OK; UI con Firefox headless/Marionette.
- Consistencia: suma mensual 2026 = SUM(compras.total) = SUM(compra_items.precio_total) = $4,600.50 (datos de prueba).
- BD final limpia: 1 admin, 0 compras, 0 ítems, 200 productos.
- Próximo chunk: pendiente de instrucción.

STATE_HANDOFF — Fase 9 (Sugerencias) — 2026-11-01
- Migración 006 aplicada: sugerencias_producto con UNIQUE (nombre_normalizado, usuario_id, estado), FK a usuarios ON DELETE CASCADE e índices por estado/nombre.
- POST /api/sugerencias con Auth + CSRF: normaliza con NormalizadorService, 201 si crea y 200 idempotente si ya existe pendiente.
- GET /api/admin/sugerencias?estado= (Admin) devuelve grupos con nombre_original más reciente, total, ids y fechas; orden total DESC y primera_fecha ASC.
- PUT /api/admin/sugerencias/{id}/aprobar crea producto y resuelve el grupo en transacción; /ignorar resuelve sin crear producto.
- Si un usuario ya tiene una fila resuelta del mismo nombre, la pendiente se elimina al resolver para respetar el UNIQUE.
- Pantalla rápida: al agregar ítem libre dispara POST /api/sugerencias en segundo plano; un fallo solo se registra en consola y no bloquea el carrito.
- Vista /admin/sugerencias con filtro de estado, tabla agrupada y modal de aprobación (categoría, unidad, imagen opcional); ignorar con confirm.
- Menú Admin: Pantalla rápida | Historial | Métricas | Ajustes | Admin → Productos | Admin → Sugerencias.
- Nuevos: 006_create_sugerencias_producto.sql, Sugerencia, SugerenciaRepository, SugerenciaService, SugerenciaController, AdminSugerenciaController, SugerenciaValidator, lista.php, admin-sugerencias.js, admin-sugerencias.css.
- Modificados: routes/api.php, routes/web.php, layouts/app.php, pantalla-rapida.js, PROJECT_STATE.md.
- Verificación: 16/16 criterios con curl + Firefox headless/Marionette; php -l 10/10 y node --check 2/2.
- BD final limpia: 1 admin, 0 compras, 0 ítems, 200 productos, 0 sugerencias; usuarios y productos de prueba eliminados.
- Próximo chunk: pendiente de instrucción. No avanzar a Fase 10.

STATE_HANDOFF — Fase 10 (Admin usuarios + reset password) — 2026-11-01
- GET /api/admin/usuarios?q=&page= (Admin + 20/página, orden created_at DESC, búsqueda normalizada en nombre/email).
- POST /api/admin/usuarios/{id}/reset-password (Admin + CSRF): 404 inexistente, 403 propio Admin, 200 con temporal de 12 chars.
- Temporal generada con random_int: mayúscula, minúscula, dígito y símbolo; solo se persiste password_hash(PASSWORD_DEFAULT) y debe_cambiar_password=1.
- UsuarioRepository ampliado con searchAdmin() y updatePasswordHashAndSetFlag(); sin migraciones ni tablas nuevas.
- Vista /admin/usuarios con buscador debounce 300 ms, tabla, badges, paginación 20/página y modal en dos pasos.
- Modal: confirmación → contraseña temporal + copiar al portapapeles + aviso de única visualización; al cerrar recarga la tabla.
- Botón de reset del Admin autenticado deshabilitado con tooltip; el endpoint también responde 403 (defensa en profundidad).
- Menú: Admin → Productos | Admin → Usuarios | Admin → Sugerencias.
- Nuevos: AdminUsuarioController, AdminUsuarioService, AdminUsuarioValidator, admin/usuarios/lista.php, admin-usuarios.js, admin-usuarios.css.
- Modificados: UsuarioRepository, routes/api.php, routes/web.php, layouts/app.php, PROJECT_STATE.md.
- Verificación: 17/17 criterios; curl + Firefox headless/Marionette; php -l 8/8 y node --check OK.
- BD final limpia: 1 admin, 200 productos, 0 compras, 0 ítems, 0 sugerencias; 23 usuarios de prueba eliminados.
- Nota: la temporal no se guarda en claro; si se pierde, el Admin debe repetir el reset.
- Próximo chunk: MVP completo. No hay fase pendiente.

STATE_HANDOFF — Fase 11.0 (Bootstrap 5.3.8 CDN) — 2026-11-01
- Bootstrap CSS (primera hoja) y bundle JS (antes de los módulos propios) en app.php y auth.php.
- Bloqueo detectado: CSP style-src/script-src 'self' impedía el CDN (sheet=false, bootstrap undefined).
- Autorizado por el usuario: config/security.php ahora permite https://cdn.jsdelivr.net en style-src y script-src.
- Verificado en Firefox headless: ambas hojas cargan en orden, window.bootstrap = object, sin violaciones CSP.
- Regresión OK: login, buscador (7 resultados "leche"), carrito, guardado, historial y 3 pantallas admin.
- Sin cambios en CSS propio, JS, vistas, HTML estructural, lógica ni esquema de BD.
- Datos de prueba eliminados; BD limpia (1 usuario, 200 productos, 0 compras/ítems/sugerencias).

STATE_HANDOFF — Fase 11.1 (Bootstrap: Auth + Ajustes) — 2026-11-01
- Login/registro/cambio forzado: card Bootstrap centrada (container/row/col), title h4, form-control, btn-primary.
- Ajustes: h2 + 3 cards apiladas (col-lg-8 offset-lg-2), botones btn-primary y btn-outline-danger.
- auth.css 193→61 líneas: solo fondo, centrado, marca "Mi Súper" y éxito de alertas.
- cuenta.css 440→383: eliminadas reglas exclusivas de ajustes; .card legacy ahora :not(.card--bs) para no tocar admin/historial.
- Se conservan form/message/button/page-head compartidos: los usan las vistas aún no migradas.
- Conservados todos los name/id/data-* de login.js, registro.js, ajustes.js y cambiar-password-forzado.js.
- Verificado en Firefox headless: registro→/login?registrado=1, duplicado y credenciales inválidas, forzado, 3 formularios de ajustes y baja.
- Sin errores JS de la app en consola (solo ruido interno de Firefox). Panel admin e inicio siguen OK.
- BD limpia: 1 admin, 200 productos, 0 compras/ítems/sugerencias. Rate limit de dev vaciado.

STATE_HANDOFF — Fase 11.2 (Bootstrap: Pantalla rápida) — 2026-11-01
- / con container/py-4: header "Nueva compra" + botón outline, buscador form-control-lg y chips btn en scroll horizontal.
- Resultados en row g-3: cards h-100 (col-12/6/4) con imagen 120 px o placeholder, botón btn-primary; generados por JS con product-card/data-product-id.
- Carrito en card sticky (col-lg-4, max-height con scroll interno), badge de ítems, edición inline intacta y btn-success guardar.
- Frecuentes como botones btn-outline-secondary en scroll horizontal; clic agrega al carrito.
- Modales propios renombrados .modal → .app-modal (evita colisión con .modal de Bootstrap) y reestilizados con modal-content/modal-body/footer.
- Toasts: override CSS porque Bootstrap oculta .toast sin .show. Mecanismo JS intacto.
- pantalla-rapida.js: solo clases/nodos de render (chips, cards, frecuentes, vacío); selectores y lógica sin cambios. cart.js/state.js/format.js/toast.js intactos.
- pantalla-rapida.css 657→285 líneas: solo overlay de modales, sticky, miniaturas, edición inline y toasts.
- Verificado en Firefox: buscar "leche" (7), agregar, editar, borrar ($13.00→$10.50), continuar, ítem libre, guardar→/historial, frecuentes.
- Sin errores JS de la app en consola. BD limpia: 1 admin, 200 productos, 0 compras/ítems/sugerencias.

STATE_HANDOFF — Fase 11.3 (Bootstrap: Historial + Detalle + Métricas) — 2026-11-01
- Historial: container py-4, h2, alert-success si ?guardada=1, vacío con alert-info + btn-primary.
- Compras agrupadas con h5 text-muted y list-group; filas list-group-item-action con data-compra-id y badge rounded-pill.
- Paginación con ul.pagination/page-link (botones con data-page-prev/next que el JS necesita).
- Detalle: back/borrar outline, fecha form-control (240 px), total en card bg-light con #total-display, ítems list-group.
- Edición inline conservada: botones btn-outline-secondary, input form-control-sm; alta con app-modal + form-control/select.
- Métricas: h2, selects form-select, gasto con .progress bg-success, top en list-group con badge y miniaturas.
- Estados vacíos como alert-info ("Sin compras en {año}." / "Sin compras en este mes.").
- historial.css 531→94 y metricas.css 251→29 líneas; se añadió list-style:none y ancho de fecha.
- historial.js/compra-detalle.js/metricas.js: solo clases y nodos de render; selectores y lógica intactos.
- Verificado en Firefox: paginación 20+3, fecha/cantidad/precio, borrar/agregar ítem, borrar compra, cambio año/mes.
- Consola sin errores de la app. BD limpia: 1 admin, 200 productos, 0 compras/ítems/sugerencias.

STATE_HANDOFF — Fase 11.4 (Bootstrap: Admin) — 2026-11-01
- Productos: container, filtros en row (form-control/form-select), tabla table-hover, badges y btn-outline.
- Filas con .product-row y data-producto-id; imagen 44 px o placeholder; paginación ul.pagination/page-link.
- Form: card en col-lg-8, form-control/select, errores, preview de imagen en vivo y botones Bootstrap.
- Sugerencias: tabla agrupada, badges de total, botones outline y modal .app-modal con modal-content/formulario.
- Usuarios: tabla con badges, buscador debounce, paginación y modal de reset en dos paneles (confirmación y temporal).
- JS: solo clases y nodos de render; se añadió preview de imagen. Selectores y lógica intactos.
- Modales siguen siendo propios (.app-modal, JS con hidden), estilizados con clases de Bootstrap.
- CSS: admin 286→50, admin-sugerencias 43→8, admin-usuarios 88→20 líneas.
- Verificado: crear, editar, desactivar, aprobar, ignorar, reset (12 chars), copiar y paginación 2 páginas.
- Copiar verificado con clic real (trusted): "Contraseña copiada al portapapeles".
- Consola sin errores de la app; pantalla rápida e historial siguen OK.
- BD limpia: 1 admin, 200 productos, 0 compras/ítems/sugerencias; datos de prueba eliminados.

STATE_HANDOFF — Fase 11.5 (Textura + paletas de color) — 2026-11-01
- Nueva capa palettes.css: 10 paletas (esmeralda, océano, índigo, uva, frambuesa, terracota, ámbar, cítrico, cielo, grafito) con escala --p-*, acento --a-*, superficies, tinta y sombras.
- Las paletas se activan con <html data-theme="..."> y puentean variables de Bootstrap (--bs-primary, --bs-body-bg, etc.).
- Nueva capa texture.css: grano SVG global tipo papel, retícula de puntos en el fondo, halos de color, tramas en cabecera/tarjetas/tablas/hero/modales, brillos en botones e iconos y subrayado degradado en títulos.
- theme.css, cuenta.css y admin.css tokenizados: los verdes fijos pasaron a var(--p-*) y los neutros a --surface/--border/--muted; danger/info/success conservan semántica.
- Ajustes: sección "Color del tema" con 10 muestras (ajustes.css), estado aria-pressed y persistencia en localStorage(^misuper.theme).
- theme.js (script clásico en <head> de ambos layouts) aplica el tema antes del pintado para evitar FOUC; expone window.MiSuperTheme.
- No se tocaron endpoints, selectores JS de negocio ni esquema de BD. El tema es preferencia local del navegador.
- Verificado en Firefox: 10 paletas aplicadas y persistentes, recarga sin parpadeo, login/búsqueda/guardar/admin OK, consola sin errores, móvil 390 px sin desbordes.
- BD limpia: 1 admin, 200 productos, 0 compras/ítems/sugerencias; rate limit vaciado.

STATE_HANDOFF — Fase 11.6 (Foto de perfil y avatares) — 2026-11-01
- Migración 007_add_avatar_usuarios.sql: usuarios.avatar_tipo ENUM('foto','preset') NULL y usuarios.avatar_valor VARCHAR(255) NULL.
- AvatarCatalog.php: 30 avatares predefinidos (emoji + etiqueta); avatars.css define sus degradados y el recorte circular.
- POST /api/me/avatar (multipart, CSRF): tipo=foto sube JPG/PNG/WebP ≤2 MB y ≤6000 px; tipo=preset guarda un id del catálogo; tipo=none quita la foto/avatar.
- AvatarService valida MIME real con finfo, tamaño y dimensiones, guarda en public/uploads/avatars con nombre aleatorio y borra la foto anterior al reemplazar o eliminar la cuenta.
- Usuario::toPublicArray ahora incluye avatar_tipo, avatar_valor, avatar_emoji y avatar_label; AuthMiddleware y el header muestran foto, avatar o iniciales.
- Ajustes → Datos personales: editor con vista previa, pestañas "Subir foto"/"Elegir avatar", grid de 30 avatares, botón Quitar y guardado AJAX inmediato.
- ajustes.js: pinta avatar en cabecera y vista previa, actualiza iniciales al cambiar el nombre, maneja errores y estados de carga. api.js acepta FormData sin forzar Content-Type JSON.
- Verificado en Firefox: 30 avatares, selección persistente, subida real, recorte 34×34 en la cabecera, borrado de archivo anterior, quitar avatar, nombre+iniciales, móvil 390 px sin desbordes y consola sin errores.
- Validación comprobada: archivo no imagen → 422, preset inválido → 422, sin CSRF → 403, borrado de cuenta elimina la foto.
- BD limpia: 1 admin, 200 productos, 0 compras/ítems/sugerencias; carpeta de avatares vacía salvo .gitkeep/.gitignore.

STATE_HANDOFF — Fase 11.7 (Más avatares, más paletas y modo oscuro) — 2026-11-01
- AvatarCatalog: de 30 a 50 avatares (a31–a50: jirafa, cebra, elefante, erizo, nutria, lobo, cerdito, vaca, gallina, pato, pez, tiburón, cocodrilo, flamenco, flor, limón, uvas, dona, paleta, balón); avatars.css añade sus degradados. La etiqueta del panel usa count($avatares).
- palettes.css: 5 paletas nuevas (menta, lavanda, cereza, durazno, arena) → 15 en total. ajustes.php y ajustes.css añaden sus muestras y variables --sw-*.
- Modo claro/oscuro/sistema: <html data-mode="light|dark"> resuelto y <html data-mode-pref="light|dark|auto"> para la preferencia guardada en localStorage(^misuper.mode).
- theme.js: resuelve auto con matchMedia('(prefers-color-scheme: dark)'), escucha cambios del sistema y repinta; expone MiSuperTheme.applyMode/currentMode/resolvedMode. Los atributos se fijan antes del pintado para evitar FOUC.
- Ajustes: selector segmentado "Apariencia" (Claro / Oscuro / Sistema) dentro de "Color del tema".
- palettes.css: cada paleta tiene bloque html[data-mode="dark"][data-theme="..."] con superficies oscuras tintadas y escala --p-* invertida (tonos bajos = fondos teñidos, altos = acentos legibles).
- modes.css (nuevo, cargado al final en ambos layouts): color-scheme, grano con mix-blend screen, texturas blancas atenuadas, rellenos con degradados p-400→p-200, botones de contorno sin brillo blanco, btn-light oscuro, utilidades Bootstrap (bg-light, table-light, text-bg-light, btn-close), mensajes de error/éxito, alert-info y acciones de admin. Incluye scrollbar-color.
- Verificado en Firefox: 15 paletas × claro/oscuro, 50 avatares, selección a50 persistente, login/home/historial/métricas/ajustes/admin productos y usuarios sin errores de consola, móvil 390 px sin desbordes.
- auto comprobado cambiando ui.systemUsesDarkTheme: data-mode pasa dark/light en vivo sin recargar.
- BD limpia: 1 admin, 200 productos, 0 compras/ítems/sugerencias; carpeta de avatares vacía salvo .gitkeep/.gitignore; rate limit vaciado.

STATE_HANDOFF — Fase 11.8 (Favicon y Notas personales) — 2026-11-01
- Favicon: public/favicon.ico (16/32/64), public/assets/img/favicon.svg y favicon.png (marca verde con cesta). Enlaces <link rel="icon"> y apple-touch-icon en layouts app y auth, más <meta name="theme-color">.
- Nuevo botón "Notas" en la navegación, justo a la derecha de Historial, visible para usuario y admin (no va en el bloque admin).
- Migraciones 008_create_notas.sql (notas: id, usuario_id FK ON DELETE CASCADE, titulo, contenido, created_at automático, updated_at ON UPDATE) y 009_create_nota_fotos.sql (nota_fotos: id, nota_id FK ON DELETE CASCADE, ruta).
- Nota.php / NotaRepository.php / NotaValidator.php / NotaService.php / NotaController.php: CRUD por usuario con aislamiento estricto (editar/borrar nota o foto de otra cuenta → 404).
- API: GET/POST /api/notas, PUT/DELETE /api/notas/{id}, POST /api/notas/{id}/fotos (multipart, campo "foto"), DELETE /api/notas/{id}/fotos/{fotoId}. CSRF obligatorio en mutaciones.
- Fotos: JPG/PNG/WebP ≤ 2 MB y ≤ 6000 px, máximo 8 por nota; se guardan en public/uploads/notas con nombre aleatorio y se borran al quitar la foto, eliminar la nota o la cuenta (AccountService llama a NotaService::eliminarArchivosDeUsuario antes del DELETE).
- Vista /notas: encabezado con acción "Nueva nota", buscador local (sin acentos), contador, grid de tarjetas con fecha automática, título, contenido, miniaturas y acciones editar/eliminar.
- Editor modal: título, contenido, subida con etiqueta propia, previsualizaciones "Guardada"/"Nueva", quitar fotos, guardado con subida secuencial de fotos y borrado de las marcadas. Confirmación propia para eliminar y lightbox para ampliar fotos.
- notas.js usa FileReader (data URL) para las previsualizaciones porque la CSP permite data: pero no blob:. En móvil el grid pasa a una columna.
- Verificado en Firefox: crear con 2 fotos, editar, quitar foto, buscar, lightbox, borrar nota, confirmación, modo oscuro, 390 px sin desbordes, consola sin errores.
- Verificado por API: 401/403 sin sesión o CSRF, 422 título corto o imagen inválida, 404 entre usuarios distintos, límite de 8 fotos y borrado de archivos al eliminar la cuenta.
- BD limpia: 1 admin, 200 productos, 0 compras/ítems/sugerencias/notas/fotos; uploads vacíos salvo .gitkeep/.gitignore; rate limit vaciado.

STATE_HANDOFF — Fase 11.9 (Ajustes de modal, carrito y unidades) — 2026-11-01
- Modal de nota: el texto y el botón X se salían porque Bootstrap define --bs-modal-header-padding en .modal y la app usa .app-modal. theme.css añade .app-modal .modal-header con padding 1rem 1.25rem y borde inferior; el título y el btn-close quedan dentro del marco en claro y oscuro.
- Carrito: texture.css usaba un degradado blanco al 0.85 sobre .cart-item (y 0.72 en .cart-panel), que tapaba el color del tema. Ahora usan un brillo suave + tinte rgba(var(--p-rgb)) y modes.css define la versión oscura de ambos.
- Unidades base: migración 010_add_unidades_gr_ml.sql amplía el ENUM a ('kg','L','pza','gr','ml').
- Se añadieron gr (gramo) y ml (mililitro) en: ProductoValidator, CompraValidator, SugerenciaValidator; cart.js, admin-productos.js, admin-sugerencias.js, pantalla-rapida.js y compra-detalle.js; selects de producto nuevo/editar, aprobar sugerencia, ítem libre de pantalla rápida y agregar ítem del detalle. Orden: kg, gr, L, ml, pza.
- Verificado en Firefox: cabecera del modal dentro del marco (claro y oscuro), items del carrito con tinte de esmeralda/lavanda/cereza y fondo oscuro correcto en modo noche, selects con las 5 unidades, consola sin errores.
- BD limpia: 1 admin, 200 productos, 0 compras/ítems/sugerencias/notas/fotos; uploads vacíos salvo .gitkeep/.gitignore; rate limit vaciado.

STATE_HANDOFF — Fase 12.0 (Tarjetas cuadradas y calculadora de importe) — 2026-11-01
- Imágenes de producto: en pantalla rápida, `.product-card .card-img-top` y `.result__thumb--empty` usan aspect-ratio 1/1, ancho 100% y object-fit cover. Los placeholder también quedan cuadrados. Las miniaturas de frecuentes/admin/métricas ya eran cuadradas.
- Tarjetas de resultados: dos acciones al pie. «Agregar» conserva el flujo anterior (cantidad 1, precio pendiente). El botón de calculadora (`bi-calculator`, con aria-label) abre el modal de cálculo.
- Modal «Calcular compra» en pantalla-rapida.php: muestra producto y unidad, pide costo por unidad y cantidad comprada, y calcula el importe en vivo con fórmula visible ($20.00 × 1.25 kg = $25.00). Valida precio >= 0 (2 decimales), cantidad > 0 (3 decimales) y el límite de 100 ítems.
- El costo por unidad se recuerda por producto en localStorage (`misuper.precios_unidad`, mapa id -> precio) y se prellena la próxima vez.
- cart.js: addProduct(product, {cantidad, precio_total}) opcional; sin cambios en BD, validadores ni API. El importe se guarda como precio_total y el detalle sigue derivando el costo unitario.
- Verificado en Firefox: 20 × 1.25 = $25.00, carrito con cantidad 1.25 y precio $25.00, prellenado del costo, imagen real 64x64 renderizada 184.67x184.67 con object-fit cover, botones visibles, modal correcto en claro y oscuro, consola sin errores.
- BD limpia: 1 admin, 200 productos, 0 compras/ítems/sugerencias/notas/fotos. Imagen del producto 1 restaurada; rate limit vaciado.

STATE_HANDOFF — Fase 12.1 (Carrito rediseñado, importe en hero, sliders y paletas) — 2026-11-01
- Hero de pantalla rápida: nueva tarjeta de cristal «Importe del carrito» con total (`data-carrito-hero-total`) y contador (`data-carrito-hero-count`); enlaza a `#carrito`. Se actualiza en cada render del carrito.
- Carrito: cabecera con icono/título/subtítulo y badge, cuerpo con scroll propio, estado vacío ilustrado y pie fijo con importe total + botón Guardar siempre visible. En escritorio el panel sigue sticky.
- Ítems del carrito: tarjeta con barra de acento, costo unitario derivado (`precio_total / cantidad`, o «precio pendiente»), controles tipo input con prefijo `$` y sufijo de unidad, edición inline conservada (data-edit/data-index/data-remove). Se mantiene el límite de 100 ítems y la validación existente.
- Toasts movidos a la esquina inferior izquierda para no tapar el carrito; en móvil ocupan el ancho con márgenes.
- Sliders: scrollbars temáticos en Firefox (`scrollbar-color` con `--scroll-thumb`/`--scroll-thumb-hover`) y WebKit; estilos completos para `input[type=range]`/`.form-range` (pista degradada de la paleta, pulgar con borde y foco).
- Paletas: acentos diferenciados por tema (ámbar, naranja, rosa, lima, cian, verde azulado, azul, violeta, rosa coral, esmeralda, cielo) y primarios propios para Menta (teal), Frambuesa (magenta) y Cereza (rojo). Se actualizaron bloques claros y oscuros, scrollbars y los swatches de Ajustes.
- Verificado en Firefox: hero $0 → $25, carrito con 4 ítems, pie visible, scroll interno, edición inline, costo unitario correcto, toasts sin solapar carrito, modos claro/oscuro, móvil sin desbordes y consola limpia.
- BD limpia: 1 admin, 200 productos, 0 compras/ítems/sugerencias/notas/fotos; usuario y rate limit de prueba eliminados.

STATE_HANDOFF — Fase 12.2 (Ítems de carrito grandes, importe a la derecha e iconos de categoría) — 2026-11-01
- Carrito: ítems rediseñados como tarjetas con avatar de inicial, nombre en dos líneas, pills de unidad y costo unitario, y borde de acento. Campos «Cantidad» y «Precio total» ahora son inputs numéricos siempre visibles de 2.85rem de alto y fuente 1.05rem, con prefijo `$`, sufijo de unidad, foco con anillo de paleta y guardado al cambiar de campo/Enter. Escape restaura el valor. La edición ya no re-renderiza toda la lista: actualiza el costo unitario y el resumen en sitio.
- Hero: el bloque «Importe del carrito» ahora es hermano del contenido y se alinea a la derecha del hero en escritorio; en móvil se compacta y se alinea a la derecha sin ocupar todo el ancho.
- Categorías: cada chip lleva icono de Bootstrap Icons (Todas → grid, Bebidas → cup-straw, Carnes → egg-fried, Cereales → basket2, Frutas → apple, Hogar → house-door, Lácteos → droplet-half, Limpieza → brush, Otros → box-seam), con respaldo `bi-tag-fill` para categorías nuevas. El texto y el orden de la API no cambian.
- Verificado en Firefox: inputs de 45.6px de alto, edición de cantidad y precio sin perder foco al saltar entre campos, costo unitario recalculado ($20 / 3 = $6.67), hero a la derecha, iconos correctos, claro/oscuro/móvil sin desbordes y consola limpia.
- BD limpia: 1 admin, 200 productos, 0 compras/ítems/sugerencias/notas/fotos; usuario y rate limit de prueba eliminados.

STATE_HANDOFF — Fase 12.3 (Icono de categoría en ítems del carrito) — 2026-11-01
- El avatar de cada ítem del carrito ya no muestra la inicial: ahora pinta el icono de Bootstrap Icons de su categoría (mismos iconos que los chips del buscador) sobre el fondo tintado del tema, con `title` de la categoría.
- `cart.js` persiste `categoria_nombre` en cada ítem (`addProduct`) y lo valida al recargar desde localStorage; los productos libres guardan `null`.
- Los ítems antiguos sin categoría usan `bi-tag-fill` como respaldo; los productos libres también.
- Corregido un error de inicialización: las constantes `PRECIOS_KEY`, `CATEGORIA_ICONS` y `UNIDADES_INFO` se movieron antes de la llamada a `init()` para evitar la zona muerta temporal (`CATEGORIA_ICONS before initialization`) al renderizar el carrito con ítems persistidos.
- Verificado en Firefox: recarga conserva 5 ítems con iconos correctos (Lácteos → droplet, Bebidas → cup-straw, Carnes → egg-fried, Limpieza → brush, Cereales → basket2), claro/oscuro/móvil sin desbordes y consola limpia.

STATE_HANDOFF — Fase 12.4 (Barra inferior móvil con buscador y menú) — 2026-11-01
- Nueva barra inferior fija en móvil (< 992px) definida en `src/Views/layouts/app.php` (`nav.app-dock`): Pantalla rápida, Notas, botón «+» elevado, Historial y Menú. Se oculta en escritorio, donde sigue la nav horizontal de la cabecera (la nav de cabecera ahora se oculta en móvil para no duplicar).
- El botón «+» abre `#dock-search-modal` (hoja inferior) con buscador de productos contra `/api/productos/buscar`; cada resultado se agrega al carrito con `addProduct` de `modules/cart.js`, muestra toast y un check temporal. Funciona en cualquier página porque el carrito vive en localStorage; `dock.js` llama `loadCart()` antes de agregar y emite `misuper:cart-changed`, que `pantalla-rapida.js` escucha para refrescar el carrito y el importe del héroe.
- El botón «Menú» abre `#dock-menu-modal` con el resto de secciones (Métricas, Ajustes y, para admin, Productos/Usuarios/Sugerencias), con estado activo.
- `dock.js` es un módulo global cargado solo cuando la nav está visible; gestiona apertura/cierre (X, fondo, Escape), bloqueo de scroll (`body.dock-open`) y foco.
- Los estilos de toast se movieron de `pantalla-rapida.css` a `theme.css` para que funcionen en todas las páginas; en móvil se elevan sobre la barra y, con una hoja abierta, pasan arriba para no taparla.
- `modules/categorias.js` centraliza `CATEGORIA_ICONS`/`iconoCategoria`; `pantalla-rapida.js` lo importa en lugar de duplicarlo.
- Verificado en Firefox (claro/oscuro, 500px y 1440px): barra oculta en escritorio, sin desbordes, búsqueda y alta de productos desde Inicio y desde Notas, menú con secciones correctas, foco y anillo del tema, consola limpia.

STATE_HANDOFF — Fase 12.5 (Calculadora en el buscador móvil y menú mejorado) — 2026-11-01
- Cada resultado del buscador de la barra inferior muestra ahora dos acciones: calculadora y agregar. La calculadora se despliega en la propia fila (una sola abierta a la vez) con costo por unidad, cantidad en la unidad del producto, importe en vivo y validación; al agregar guarda cantidad/importe en el carrito y recuerda el costo por unidad.
- Nuevo módulo `public/assets/js/modules/precios.js` (`PRECIOS_KEY`, `leerPrecioUnidad`, `guardarPrecioUnidad`), compartido por `dock.js` y `pantalla-rapida.js`; así el último costo por unidad se reutiliza entre ambos buscadores.
- `dock.js` añade el formulario de cálculo por resultado y evita el aviso genérico duplicado cuando se agrega desde la calculadora (queda solo el aviso con cantidad e importe).
- Menú móvil rediseñado: tirador superior, cabecera con avatar/nombre/rol y acceso a Ajustes, etiquetas de sección («Secciones» / «Administración»), enlaces con iconos y chevron, y botón «Cerrar sesión» al pie (funciona en todas las páginas).
- Barra inferior: fondo con degradado del tema, iconos con animación, indicador inferior en la sección activa y `aria-current="page"`.
- Verificado en Firefox (claro/oscuro): calculadora de resultados, prefiltrado del último costo, validaciones, alta en carrito, menú nuevo y consola limpia.

STATE_HANDOFF — Fase 12.6 (Barra móvil de 3 botones) — 2026-11-01
- La barra inferior móvil quedó reducida a 3 botones sin texto: Pantalla rápida (icono casa), botón «+» elevado (buscar producto) y menú hamburguesa. Distribución equitativa en 3 columnas (`grid-template-columns: repeat(3, 1fr)`), con la casa en la columna 1, el menú en la 3 y el FAB centrado.
- Se quitaron Notas e Historial de la barra; ahora viven en la hoja del menú junto a Métricas y Ajustes (más las secciones de administración).
- Iconos como único contenido: `aria-label` y `title` mantienen la accesibilidad; el botón activo conserva la pastilla tintada y la barra inferior de color.
- Verificado en Firefox claro/oscuro: 3 botones centrados (1/6, 1/2, 5/6), sin etiquetas, menú con Historial/Notas/Métricas/Ajustes, consola limpia.

STATE_HANDOFF — Fase 12.7 (CRUD de usuarios en Admin) — 2026-11-01
- El panel /admin/usuarios pasa de solo listado + reset a CRUD completo: crear, editar y eliminar cuentas.
- API nueva: POST /api/admin/usuarios (201), PUT /api/admin/usuarios/{id} (200) y DELETE /api/admin/usuarios/{id} (200).
- Todas exigen AdminMiddleware + CSRF. Email único sin distinguir mayúsculas; respuesta 422 EMAIL_DUPLICADO.
- Alta: nombre, email, contraseña (mín. 8), rol usuario/admin y opción de exigir cambio de contraseña al entrar.
- Edición: nombre, email y rol. El propio Admin conserva su rol (servidor y UI) para no perder acceso al panel.
- Baja: hard delete con FK en cascada; reutiliza AccountService::eliminarCuenta para borrar avatar y fotos de notas. El propio Admin no puede borrarse (403); usar /ajustes.
- Vista: botón «Nuevo usuario», modal de alta/edición (contraseña y confirmación solo en alta) y modal de confirmación de borrado.
- admin-usuarios.js: acciones Editar/Resetear/Eliminar en cada fila, validación cliente, mapping de errores del servidor y recarga de la tabla.
- Nuevos métodos: UsuarioRepository::createAdmin/updateAdmin; AdminUsuarioService::crear/actualizar/eliminar; AdminUsuarioValidator::crear/actualizar.
- Verificado por API y en Brave headless (CDP): crear, editar, eliminar, duplicado, validaciones, 403 sin rol/CSRF y consola sin errores.
- BD limpia: 1 admin real, 200 productos, 0 compras/ítems/sugerencias/notas; usuarios temporales de prueba eliminados.

STATE_HANDOFF — Fase 12.8 (Docker + Kubernetes) — 2026-11-01
- Dockerfile multi-etapa (composer + php:8.3-apache) con pdo_mysql, mbstring, DocumentRoot en /public, FallbackResource a index.php y límites de subida de 8 MB.
- .dockerignore excluye .env, vendor, logs, backups, uploads locales, helm y documentación.
- Chart Helm en helm/misuper: Deployment app, MySQL 8, Services, PVC de MySQL y uploads, Ingress con cert-manager (letsencrypt-prod), Secret con credenciales.
- La app arranca con un initContainer que aplica migraciones pendientes y otro que prepara permisos de los PVC para www-data.
- deploy.sh construye y publica gmr27/misuper:<tag>, ejecuta helm upgrade --install en el namespace misuper y espera los rollouts. Genera values.local.yaml (no versionado) con contraseñas aleatorias si falta.
- Desplegado en https://misuper.iguzman.com.mx con TLS válido. MySQL y uploads en PVCs; los upgrades conservan los datos.
- BD despensa_app migrada al clúster desde la instancia local: 1 admin (mismo hash), 8 categorías, 200 productos, 10 migraciones.
- Verificado: login HTTPS con usuario temporal (eliminado), API de categorías/productos, escritura en PVC como www-data y segundo despliegue (tag 2) sin pérdida de datos.
- Secretos reales solo en helm/misuper/values.local.yaml (ignorado por git) y en el Secret de Kubernetes.
