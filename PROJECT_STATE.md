# PROJECT_STATE.md

## Proyecto
App web de despensa y compras. El usuario registra sus compras del súper en el momento,
ve cuánto gasta al mes y en qué 10 productos se le va el dinero.
Stack: PHP 8.1+, MySQL 8, PDO, HTML + CSS + JS vanilla (módulos ES6). Sin frameworks.

## Estado
- Fase actual: MVP COMPLETO + LECTURA DE TICKETS + RECETAS EDITABLES + AUDITORÍA UX/UI + PRECIOS Y COSTOS + MENÚ SEMANAL
- Fases completadas: Fase 1 a Fase 11.4, Fase 12.0 a Fase 12.9, Fase 13 a Fase 26
- Próximo chunk: post-MVP. Sin fases pendientes.

## Alcance del MVP (resumen)
- Registro abierto, login, logout, sesiones PHP.
- Recuperación de contraseña: reset manual por el Admin (sin SMTP).
- Catálogo de ~200 productos con categoría fija, unidad base fija e imagen de Pexels (hotlink).
- Admin con CRUD de productos, bandeja de sugerencias y lista de usuarios.
- Pantalla rápida: buscador, categorías, productos frecuentes, carrito con localStorage, edición inline, total, guardar compra.
- Compras: sin supermercado, editables y borrables sin restricción.
- Historial agrupado por mes + detalle editable.
- Métricas: gasto mensual + gasto anual comparado con los 3 años anteriores + top 10 productos por gasto del mes.
- Sugerencias: ítem libre genera sugerencia agrupada; Admin aprueba o ignora.
- Ajustes: cambiar nombre/email, cambiar contraseña, cerrar sesión, eliminar cuenta (hard delete).
- Tickets: subir foto, OCR con Tesseract, propuesta editable, relación con el catálogo y compra en el historial.
- Recetas: catálogo editable de 100 recetas base con tipos (general, diabético, kosher, vegetariano, sin gluten), favoritos por usuario, filtros, escalado por porciones, CRUD de recetas y videos para el Admin, propuestas de usuarios y lista «Productos por comprar» que se envía a la pantalla rápida.

## Fuera del alcance (NO implementar)
- Planes nutricionales con calorías o macros. El menú semanal es un planificador de recetas, no una dieta calculada.
- Presupuestos, notificaciones internas.
- Auditoría, familias, cotizaciones, estados múltiples de compra.
- Import/export CSV desde la app (solo script de importación inicial).
- Sinónimos, atributos extensibles, métricas globales, cron.
- Modo soporte, ARCO formal, PWA, multi-idioma, foto de perfil, preferencias, temas.
- SMTP, email transaccional.
- Frameworks CSS/JS (Bootstrap, jQuery, React, Vue, Materialize, Tailwind).

## Roles
- Usuario: usa la app, gestiona sus compras y métricas.
- Admin: gestiona catálogo, sugerencias y usuarios. Accede por /admin/*.

## Modelo de datos

usuarios (id, nombre, email UNIQUE, password_hash, rol ENUM('usuario','admin'),
          debe_cambiar_password BOOL, created_at)

categorias (id, nombre UNIQUE)
-- Seed inicial de 8 categorías; el Admin puede crear nuevas.

productos (id, nombre, categoria_id FK, unidad_base ENUM('kg','gr','L','ml','pza'),
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

tickets (id, usuario_id FK ON DELETE CASCADE, compra_id NULL FK ON DELETE SET NULL,
         ruta VARCHAR(255), texto_ocr MEDIUMTEXT, total_detectado DECIMAL(12,2) NULL,
         estado ENUM('procesado','confirmado','error') DEFAULT 'procesado',
         created_at, updated_at)

menus_semanales (id, usuario_id FK ON DELETE CASCADE, semana DATE UNIQUE por usuario,
                 nombre NULL, created_at, updated_at)
-- semana siempre normalizada al lunes.

menu_semanal_items (id, menu_id FK ON DELETE CASCADE, dia 1..7,
                    momento ENUM('desayuno','comida','cena','colacion','otro'),
                    tipo ENUM('receta','nota'), etiqueta NULL, receta_id NULL FK
                    ON DELETE SET NULL, nombre_snapshot, porciones 1..50, orden,
                    nota NULL, created_at, updated_at)

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
- Tickets: Tesseract lee la imagen; el usuario revisa antes de crear la compra.
- Un ticket solo se confirma una vez y en la misma transacción que la compra.
- Los artículos no catalogados de un ticket se guardan como nombre_libre y generan sugerencia.
- Recetas: catálogo en la tabla `recetas` (las 100 base se migraron desde data/recetas.json con la migración 019). Los favoritos viven en `receta_favoritos`; el Admin administra recetas y videos desde /admin/recetas. Las propuestas de usuarios quedan pendientes hasta que el Admin las publique.
- La despensa de recetas es inferida del historial de compras; no es inventario real.
- Las cantidades de recetas se escalan por porciones y se convierten a la unidad del producto para la lista de compras.
- La lista «Productos por comprar» es personal; al enviarla, la pantalla rápida la consume y la marca como cargada.
- Menú semanal: cada usuario solo ve y edita su propio menú. La semana se guarda normalizada al lunes.
- `menu_semanal_items.receta_id` usa ON DELETE SET NULL y `nombre_snapshot` conserva el nombre de la receta. Un menú viejo muestra «Receta no disponible» en lugar de romperse.
- El menú reutiliza `RecetaService::previewLista()` para armar la lista y `PrecioService::costosRecetas()` para calcular todos los costos con una sola carga de precios.
- Si una unidad no se puede convertir, el ingrediente se conserva en su unidad original y se marca como faltante. Nunca se inventa una cantidad.
- La sugerencia con IA es solo para administradores y solo se ejecuta desde Mi Súper Desktop. El servidor valida slugs, días, momentos y porciones; la IA nunca inventa recetas ni precios y no guarda nada hasta que el usuario aplica la propuesta.

## Convenciones
- PHP PSR-12, namespaces App\..., Composer autoload.
- SQL snake_case plural, FK tabla_id.
- JS módulos ES6, camelCase.
- API responde { ok: bool, data: any, error: { code, message } }.
- HTTP: 400, 401, 403, 404, 409, 422, 429, 500, 503.
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
8. Métricas: gasto mensual, gasto anual comparado con los 3 años anteriores y top 10 por gasto del mes.
9. Top 10 sobre el mes seleccionado.
10. Ajustes: solo cuenta (email, contraseña, logout, eliminar cuenta).
11. 6 pantallas + panel Admin: login/registro, pantalla rápida, historial, detalle, métricas, ajustes; Admin con productos/sugerencias/usuarios.
12. Panel Admin completo (CRUD productos + lista usuarios).
13. Importación inicial de ~200 productos vía CSV, SIN imágenes. Las imágenes se agregan manualmente después desde el panel Admin.
14. Buscador de Pexels en panel Admin: DIFERIDO. No se implementa en el MVP. El campo imagen_url se llena manualmente con una URL pegada por el Admin.
15. Categorías base por seed; el Admin puede crear categorías nuevas desde Productos.
16. Ítem libre + sugerencia al Admin.
17. Sugerencias agrupadas por nombre normalizado; aprobar resuelve todas.
18. 6 tablas estrictas.
19. compras.total guardado como caché, recalculado al editar ítems.
20. Pantalla rápida completa: buscador + categorías + edición inline + total + frecuentes.
21. Frecuentes = top 5-8 por frecuencia (no por gasto).
22. Recuperación de contraseña = reset manual por Admin.
23. HTTP en dev, HTTPS en prod (cookies Secure solo en prod).
24. Borrado de cuenta = hard delete total.
25. OCR de tickets con Tesseract del servidor (idioma español), sin servicios externos.
26. El ticket siempre pasa por revisión humana antes de crear la compra.
27. Artículos no catalogados = ítem libre + sugerencia al Admin; no se crean productos automáticamente.
28. La compra desde ticket se crea en una transacción y queda marcada con su ticket.
29. La foto del ticket se sirve por endpoint autenticado, no por URL pública directa.
30. Límite de 20 tickets por hora por usuario.

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
- Tickets: el parser es heurístico y depende de la calidad de la foto y del formato de cada tienda. La revisión humana es obligatoria.
- Tickets no confirmados quedan en la tabla con su imagen. Evaluar limpieza periódica (por ejemplo, > 30 días) si crece el almacenamiento.
- Los ítems libres de ticket no guardan unidad_base; se envía 'pza' solo para validar. Si se necesita conservarla, migración para agregarla a compra_items.
- Tesseract debe existir en el entorno local; en Docker y Helm ya está previsto.

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
Fase 12.9: 12 archivos nuevos (011_create_tickets.sql, Ticket.php, TicketRepository, TicketService, TicketOcrService, TicketParserService, TicketImagePreprocessor, ProductoMatcherService, TicketController, ticket.php, ticket.js, ticket.css) + modificados (Compra, CompraRepository, CompraService, ProductoRepository, AccountService, routes, layout, historial.js, historial.css, compra-detalle.php, Dockerfile, Helm, README, .env.example, PROJECT_STATE.md).

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

STATE_HANDOFF — Fase 12.9 (Tickets de compra con OCR) — 2026-11-02
- Nueva sección «Ticket» a la derecha de Notas en la nav de escritorio y en el menú móvil. Vista `/ticket` con carga desde cámara (`capture="environment"`), galería/carpetas, arrastrar y soltar, vista previa y botón «Leer ticket».
- La imagen se reduce a 2200 px y se convierte a JPEG en el navegador antes de subirla. El servidor valida MIME real, dimensiones y tamaño máximo de 8 MB.
- OCR con Tesseract del servidor (`-l spa`, `--psm 6`; reintento con `--psm 4` si no hay artículos). Sin dependencias de Composer ni servicios externos.
- `TicketImagePreprocessor` (GD) recorta el área blanca del ticket, la amplía y aplica umbral adaptativo antes de Tesseract. Si GD no está disponible, se usa la imagen original.
- Probado con la foto real `compras.jpg` (Costco, 886x1280, ticket térmico con sombras y mano): 9 artículos, fecha 2026-10-16 y total 2,572.30 detectados correctamente.
- Parser heurístico: fecha, total, líneas con importe, cantidades (`2 x`, `2 PZA`, `1.5 KG`), unión de descripciones partidas y filtrado de encabezados/RFC/IVA/cambio.
- Matching contra los 200 productos activos (normalización, contención de tokens, Jaccard y similitud). Devuelve hasta 3 sugerencias y preselecciona solo coincidencias altas.
- La revisión es obligatoria: nombre, producto del catálogo (o ítem libre), cantidad y precio. Se avisa si la suma no coincide con el total detectado.
- Al confirmar, la compra y el estado del ticket se guardan en una transacción. Los ítems libres generan sugerencia para el Admin.
- Migración 011: tabla `tickets` con FK a usuarios (cascada) y compras (set null). La foto se guarda en `public/uploads/tickets` y se sirve por `GET /ticket/{id}/foto` con autenticación y ownership.
- Historial: badge «Ticket» en las compras con ticket y enlace «Ver ticket original» en el detalle; aviso al llegar desde `?ticket=1`.
- Límite de 20 tickets por hora por usuario. Si Tesseract no está disponible se responde 503 con mensaje claro.
- `DELETE /api/tickets/{id}` descarta un ticket no confirmado y borra su imagen; la UI lo usa al elegir otra imagen.
- Docker instala `tesseract-ocr` y `tesseract-ocr-spa`, sube uploads a 12M/14M y crea `/uploads/tickets`; Helm crea la carpeta en el initContainer. README y `.env.example` documentan `TESSERACT_BIN`.
- Verificado con `php -l` y `node --check`, parser y matcher con tickets de ejemplo, OCR real con Tesseract local, y flujo HTTP completo (login, subida 201, revisión, confirmación 201, duplicado 409, foto 200 JPEG, historial con badge). Datos de prueba eliminados.

STATE_HANDOFF — Fase 13 (Productos propios y fin de sugerencias) — 2026-11-02
- Migración 013: `productos.usuario_id` (NULL = catálogo global). Los productos creados manualmente quedan ligados al usuario y no los ven otros usuarios ni el Admin. FK a usuarios con cascada y `compra_items.producto_id` en cascada para no romper la baja de cuenta.
- Migración 014: se elimina la tabla `sugerencias_producto` y todo el sistema de sugerencias (controladores, servicio, repositorio, modelo, validador, vista, JS, CSS, rutas y enlaces del menú). `/admin/sugerencias` ya no existe.
- `POST /api/productos` crea un producto propio con Auth + CSRF. `GET /api/productos/buscar` ahora exige sesión y devuelve catálogo global + productos del usuario.
- Pantalla rápida: al no haber resultados aparece «Registrar nuevo producto»; el modal pide nombre, categoría, unidad, cantidad y precio, crea el producto y lo agrega al carrito. El botón «Producto no catalogado» se unificó con este alta.

STATE_HANDOFF — Fase 14 (Lectura de tickets por layout) — 2026-11-02
- `TicketOcrService::extraerEstructura()` ejecuta Tesseract en TSV y devuelve palabras con coordenadas, líneas reconstruidas por posición vertical y tamaño de página. Se usa `--psm 6` y se reintenta con `--psm 4` solo si no hay artículos.
- `TicketParserService::parsearEstructura()` detecta la columna de precios por borde derecho, delimita el bloque de artículos y descarta encabezado (dirección, teléfono, RFC, folio, cajero, saldo) y pie (subtotal, IVA, total, pago, cambio). El parser de texto queda como respaldo endurecido.
- Se añadieron fixtures en `database/fixtures/tickets/` y `scripts/test_ticket_parser.php` (6 casos; 0 fallos). También se probó el flujo HTTP completo con una imagen de ticket simulada: 3 artículos correctos, fecha y total detectados.
- Regla conservadora: ante una línea dudosa se omite; el usuario la agrega en la revisión.

STATE_HANDOFF — Fase 15 (Gasto anual, categorías admin y estado de fotos) — 2026-11-03
- Métricas: nueva sección «Gasto anual» con el total del año seleccionado, variación porcentual contra el año anterior y promedio de los 3 años previos. La comparativa muestra los últimos 3 años más el seleccionado.
- Endpoint `GET /api/metricas/gasto-anual?anio=YYYY` (Auth). Rellena con 0 los años sin compras y devuelve `variacion_porcentual`/`promedio_anteriores` en null cuando no hay base de comparación.
- Admin · Productos: botón y modal «Nueva categoría» en lista y formulario. `POST /api/admin/categorias` (Admin + CSRF) valida nombre 2–80, normaliza espacios y evita duplicados según la collation de la tabla.
- Migración 015: `productos.imagen_estado ENUM('ok','vencida') NULL` e `imagen_verificada_at DATETIME NULL`. Al cambiar/quitar `imagen_url` el estado vuelve a NULL.
- Filtro de fotos en Admin: «Sin foto» (imagen_url nula/vacía) y «Foto vencida» (URL verificada como rota). El botón «Verificar fotos» recorre las URLs con HEAD en lotes (curl_multi, timeouts y bloqueo de IP privadas) y marca ok/vencida.
- La tabla Admin muestra badge «Vencida» o «Sin foto»; la verificación informa cuántas fotos se revisaron y cuántas están rotas.
- Verificado: `php -l` y `node --check` sin errores; migración aplicada; endpoints de gasto anual, filtros, alta de categoría (incluido duplicado 422) y verificación de fotos probados por HTTP con usuario admin temporal. Datos de prueba eliminados.

STATE_HANDOFF — Fase 15.1 (Vista de lista en Resultados) — 2026-11-03
- El icono de la sección «Resultados» de la pantalla rápida ahora es un botón que alterna entre cuadrícula y lista.
- La vista de lista convierte cada tarjeta en una fila compacta (miniatura, nombre, categoría/unidad y acciones) y aplica en móvil, tablet y escritorio; en móvil las acciones pasan a una segunda línea.
- La preferencia se guarda en localStorage (`misuper:resultados-vista`) y el botón expone `aria-pressed`, etiqueta y tooltip dinámicos.


STATE_HANDOFF — Fase 16 (Recetas + lista de compras) — 2026-11-03
- Nueva sección `/recetas` con 100 recetas locales en `data/recetas.json`, filtros por tipo, tiempo, búsqueda y «solo con lo que he comprado». Los tipos iniciales son general, diabético, kosher, vegetariano y sin gluten, con avisos orientativos para las etiquetas de salud/religión.
- Cada receta tiene porciones base y el detalle permite escalar cantidades. La despensa se infiere de la última compra del usuario (`CompraRepository::despensa($usuarioId, null, $compraId)` sobre `ultimaCompra`), ordenada por fecha e id, excluyendo Limpieza y Hogar.
- Selección múltiple de recetas con porciones editables, preview de ingredientes agrupados y guardado en la lista personal.
- `/lista-compras` implementa el CRUD de «Productos por comprar»: agregar manual, editar cantidad/unidad, eliminar, vaciar y enviar a la pantalla rápida.
- El botón «Enviar a pantalla rápida» marca los pendientes y redirige a `/?lista=1`; la pantalla rápida consume los ítems, los fusiona con el carrito (sumando cantidades) y deja precio pendiente para asignar costos.
- Migración 016: `recetas_videos` (un video de YouTube por receta, administrado en `/admin/recetas`). Migración 017: `lista_compra_items` con estados pendiente/enviado/cargado.
- Nuevos endpoints: `GET /api/recetas`, `GET /api/recetas/{slug}`, `POST /api/recetas/preview-lista`, CRUD `/api/lista-compras`, `POST /api/lista-compras/enviar`, `POST /api/lista-compras/consumir`, y `GET/PUT/DELETE /api/admin/recetas...`.
- Verificado por HTTP: login, filtros, preview con escalado, alta/edición/borrado de lista, envío/consumo, alta y borrado de video de YouTube. `php -l` y `node --check` sin errores.


STATE_HANDOFF — Fase 17 (Favoritos + CRUD de recetas) — 2026-11-03
- Favoritos por usuario: `receta_favoritos` (PK usuario_id + receta_id). La estrella aparece en tarjetas y detalle; `POST /api/recetas/{slug}/favorito` alterna el estado. El filtro «Solo mis favoritas» usa `GET /api/recetas?favoritas=1`.
- Las recetas base se migraron de `data/recetas.json` a la tabla `recetas` con la migración 019 (100 filas); el catálogo ahora es editable y la fuente de verdad es MySQL.
- El Admin tiene CRUD completo en `/admin/recetas`: listado con filtros por estado, alta/edición, publicación y borrado. El formulario incluye tipos, porciones, tiempo, dificultad, ingredientes, pasos y video de YouTube.
- Los usuarios pueden proponer recetas en `/recetas/proponer`; se guardan con estado `pendiente` y autor. El Admin las revisa, edita y publica desde el listado.
- Migración 018: tablas `recetas` y `receta_favoritos`. Migración 019: seed de las 100 recetas base y copia de videos existentes de `recetas_videos` a las columnas nuevas.
- Endpoints nuevos: `POST /api/recetas/{slug}/favorito`, `POST /api/recetas/proponer`, `GET/POST /api/admin/recetas`, `GET/PUT/DELETE /api/admin/recetas/{id}` y `POST /api/admin/recetas/{id}/publicar`.
- Verificado por HTTP con usuario temporal: listado, favorito on/off, filtro de favoritas, propuesta pendiente, publicación, edición, borrado, video, preview de lista y CRUD de productos por comprar. Datos temporales eliminados.

STATE_HANDOFF — Fase 18 (Tipos editables, portada y slider de navegación) — 2026-11-04
- Migración 020: tabla `tipos_recetas` (seed de los 5 tipos base) y columna `recetas.imagen_url` para la portada de la tarjeta.
- Nuevo CRUD de tipos en `/admin/recetas/tipos` con name/descripción/icono/aviso. Los tipos en uso no se pueden eliminar (409).
- `RecetaService::tipos()` ahora lee de MySQL; el formulario de recetas usa esos tipos y el CRUD de recetas valida contra ellos.
- El Admin puede agregar una imagen de portada por receta. La tarjeta usa `imagen_url` > miniatura de YouTube > icono; el detalle también muestra la portada.
- El botón «Agregar ingrediente» abre un modal para buscar en el catálogo existente o registrar un producto nuevo con categoría y unidad. En Admin el producto se crea global; en propuestas de usuario se crea como producto propio.
- La navegación superior ahora es un slider horizontal arrastrable con ratón/dedo y rueda; en móvil se muestra también en la cabecera además del dock inferior.
- Verificado: migración limpia de 20 pasos con 5 tipos y 100 recetas, CRUD de tipos (crear/editar/borrar/proteger en uso), alta de receta con imagen, búsqueda/alta de producto desde el formulario y render de las pantallas. Sin commit ni deploy todavía.

STATE_HANDOFF — Fase 19 (Porciones arriba, listas múltiples y slider de navegación) — 2026-11-04
- El panel de recetas seleccionadas se movió arriba de las tarjetas, es sticky y muestra por receta el número de porciones y el botón «Generar lista» accesible.
- Productos por comprar admite varias listas por usuario (`listas_compra` + `lista_compra_items.lista_id`, migración 021). Se puede crear, renombrar, seleccionar, vaciar y eliminar cada lista; los ítems existentes se migraron a «Mi lista».
- Al generar una lista desde recetas se elige una lista existente o se crea una nueva; luego se abre `/lista-compras?id=...`.
- El envío a pantalla rápida trabaja por lista seleccionada y el carrito consume todos los ítems enviados.
- El slider de navegación superior ya no captura el puntero al hacer clic normal; solo arrastra tras superar 6 px, por lo que los enlaces vuelven a funcionar. En móvil la barra superior es visible y arrastrable.
- Verificado por HTTP: crear lista, agregar/editar/enviar/consumir ítems, renombrar, borrar, preview de recetas y migración limpia de 21 pasos. Sin commit ni deploy todavía.
- Portadas de recetas: se buscaron fotos de los 100 platillos en la web, se optimizaron a JPEG de 1200 px en `public/assets/img/recetas/<slug>.jpg` y se guardó la ruta local en `recetas.imagen_url`. El archivo `database/recetas-imagenes-origen.json` conserva la URL de origen de cada foto para trazabilidad.

STATE_HANDOFF — Fase 20 (Categorías de platillo, subida de portadas y menú Admin) — 2026-11-04
- Migración 022: tabla `categorias_recetas` con 10 categorías y `recetas.categoria_id`. Las 100 recetas quedaron asignadas (0 sin categoría).
- CRUD admin de categorías en `/admin/recetas/categorias` (API `/api/admin/categorias-recetas`), con protección `409 CATEGORIA_EN_USO`.
- Filtro público por categoría (`?categoria=bebidas`) combinable con el de dieta; chips separados “Categoría” y “Tipo de dieta”, badges en tarjeta y detalle.
- Formulario de receta con selector de categoría obligatorio.
- Subida de portada en el CRUD (`POST /api/admin/recetas/imagen` y `POST /api/recetas/imagen`): JPG/PNG/WebP hasta 5 MB, re-codificada a JPEG 1600 px y guardada en `public/uploads/recetas`. El campo de URL se conserva y acepta rutas locales.
- El nav superior agrupa las secciones de administración en un botón «Admin» con submenú desplegable (Catálogo, Categorías, Tipos, Productos, Usuarios). Validado también en el menú móvil.

STATE_HANDOFF — Fase 21 (Último precio por usuario en la calculadora) — 2026-11-04
- `CompraRepository::frecuentes()` y `buscarActivos()` ahora devuelven `ultimo_precio` (precio por unidad base) calculado del último `compra_items` del usuario por producto, con `ROW_NUMBER() OVER (PARTITION BY producto_id ORDER BY fecha DESC, id DESC)`.
- El costo unitario se obtiene de `precio_total / cantidad`; se ignora `cantidad = 0` y solo aplica a productos del catálogo (`producto_id` no nulo).
- `pantalla-rapida.js` precarga la calculadora con `product.ultimo_precio` (si es mayor que 0); si no existe cae al último precio guardado en localStorage y, si tampoco, deja el campo vacío.
- El precio es por usuario, por lo que cada cuenta/región mantiene el suyo; al guardar o editar una compra el valor de referencia se actualiza solo.
- Verificado con la BD local: la consulta devuelve el último precio correcto y `NULL` para productos nunca comprados. Sin migración nueva ni cambios en el guardado de compras.

STATE_HANDOFF — Fase 22 (Auditoría UX/UI mobile-first) — 2026-11-04
- Shell global: en móvil/tablet se oculta la barra de navegación superior (el dock inferior ya concentra la navegación) para eliminar la duplicidad y el corte horizontal. La cabecera queda más compacta, el avatar enlaza a Ajustes y «Cerrar sesión» tiene nombre accesible incluso cuando el texto se oculta.
- Se añadió un enlace «Saltar al contenido principal» visible solo con teclado.
- Tablas de administración (productos, usuarios, recetas, categorías y tipos): columnas secundarias ocultas por breakpoint, acciones compactas con iconos + `aria-label` y etiquetas visibles solo en escritorio. Ya no requieren scroll horizontal en 390 px.
- Detalle de compra: los ítems pasan a una rejilla de 3 campos en móvil; el botón de borrar se posiciona arriba a la derecha y los campos de cantidad/precio/unidad dejan de recortarse.
- Ajustes: todas las tarjetas comparten el mismo ancho centrado (9 columnas) en lugar de mezclar una tarjeta a ancho completo con formularios de 8 columnas.
- Recetas: filtros alineados; los dos switches pasan a un panel compacto y «Solo con lo que he comprado» ya no descuadra la fila de búsqueda/tiempo. Las filas de ingredientes del formulario se reorganizan en móvil y sus controles tienen nombre accesible.
- Métricas: la tarjeta de gasto anual muestra «Promedio mensual» y «Mes más alto» calculados desde el gasto mensual del año.
- Modales: nuevo `password-toggle.js` (ojo para mostrar/ocultar en login, registro, ajustes y cambio forzado) y `modal-a11y.js` (bloqueo de scroll de fondo, trampa de Tab, cierre al pulsar el fondo y devolución del foco). Los `window.confirm` nativos se sustituyeron por un diálogo propio (`modules/confirm.js`) en carrito, compras, listas, productos, recetas, categorías y tipos.
- Contraste: chips activos y favoritos de recetas legibles en modo oscuro.
- Corrección funcional detectada durante las pruebas: `ListaCompraService::normalizarItem()` llamaba a `mb_substr(null)` cuando el ítem no traía `origen`, lo que devolvía 500 al agregar productos manualmente a una lista. Ahora `origen` se normaliza a `''` antes del recorte.
- Verificado con Playwright en 1440, 768 y 390 px, tema claro y oscuro: sin errores de consola, sin desbordes no intencionados, sin controles sin etiqueta. Flujos probados: login con ojo de contraseña, búsqueda y guardado de compra, alta/edición/borrado de nota, listas (crear/agregar/eliminar), recetas (detalle/selección/preview), tickets (OCR real con Tesseract: 3 artículos, total $101.00), admin de usuarios, categorías, tipos, recetas y productos, confirmaciones propias y modales con foco atrapado.
- BD local limpia después de las pruebas: 1 admin, 200 productos, 3 compras originales, 0 notas, 1 lista y 10 ítems de recetas. Sin migraciones nuevas.

STATE_HANDOFF — Fase 23 (ampliación revertida) — 2026-11-04
- Se generaron 400 recetas y 66 productos adicionales, pero el contenido no cumplió la calidad esperada. Se revirtieron por completo.
- Migraciones `027_remove_recetas_ampliadas.sql` y `028_remove_productos_ampliados.sql`: eliminan las 400 recetas y los 66 productos nuevos en local y clúster. El catálogo vuelve a 100 recetas y 200 productos.
- Se conservan las imágenes originales de los productos existentes (181 en el clúster) y las portadas de las 100 recetas base. Se eliminaron las 400 portadas generadas para las recetas retiradas.
- Las migraciones `025` y `026` se retiraron para que una base nueva no vuelva a cargar el contenido descartado.
- Se conservan los tipos de dieta `mediterranea`, `dash`, `baja_carbohidratos` y `keto` en `tipos_recetas`, sin recetas asociadas por ahora.
- La paginación de `/recetas` a 20 recetas por página se mantiene y queda lista para validarse.

STATE_HANDOFF — Fase 24 (Pantalla rápida landscape mobile-first) — 2026-11-05
- Rediseño de `/` (pantalla rápida) para celular y tableta en horizontal, enfocado en uso dentro del supermercado.
- En landscape se oculta el hero y el dock/header global; se agrega una topbar compacta con menú, total del carrito e ítems.
- Buscador sticky de 44 px con botones compactos para nuevo producto y categorías.
- Tableta horizontal: resultados en 3 columnas, chips de categorías inline y carrito como rail derecho sticky.
- Celular horizontal: resultados en 2 columnas (lista en alturas menores a 400 px), categorías en bottom sheet y carrito en bottom sheet.
- Barra inferior fija en celular con total e ítems para abrir el carrito en cualquier momento.
- Compras frecuentes se movieron a un bottom sheet accesible desde el botón «Frecuentes» en landscape; se conserva la sección inline en portrait/escritorio.
- El modal de nuevo producto y la calculadora usan un ancho mayor y padding compacto en landscape para que el teclado no tape los campos.
- Verificado: `php -l` en vistas/layout, `node --check` en JS, render HTTP 200 de `/` con sesión y presencia de todos los nuevos puntos de interacción.

STATE_HANDOFF — Fase 25 (Pantalla rápida landscape: ajuste senior) — 2026-11-05
- Se eliminó la topbar con «Captura rápida / ¿Qué compraste hoy?» en celular y tableta horizontal. Ahora hay una sola barra sticky con menú, buscador, nuevo producto, categorías y total del carrito.
- «Frecuentes» pasó a ser un chip dentro de categorías (fila inline en tableta y sheet en celular). Al elegirlo, los productos frecuentes se muestran en la misma cuadrícula de resultados con sus botones de agregar/calcular.
- Se retiró el botón y el bottom sheet independiente de frecuentes en landscape; la sección inline se conserva solo en portrait/escritorio.
- Resultados en 3 columnas tanto en celular como en tableta horizontal, con tarjetas compactas: imagen 16:9, nombre a 2 líneas, metadatos en una línea y acciones en una sola fila.
- Se ajustaron paddings, tipografía y alturas de botones por breakpoint; el modo lista sigue disponible y ahora ocupa una sola columna en landscape.
- Sin despliegue: cambios únicamente locales, pendientes de revisión visual.

STATE_HANDOFF — Fase 23 (Precios y costos) — 2026-11-05
- Migración 030: `compras.comercio`, `compra_items.unidad_base`, `compra_items.comercio` y tabla `precios_manuales` por usuario/producto. Se rellenó la unidad de los ítems históricos desde el catálogo.
- `PrecioService` calcula el precio vigente por usuario y producto con la mediana de las últimas 5 compras válidas (`cantidad > 0`, `precio_total > 0`). Normaliza la unidad a la base del producto (g↔kg, ml↔L); si no es compatible, el ingrediente queda como faltante. Marca precios con más de 60 días y usa el precio manual solo cuando no hay compras.
- `PrecioRepository` expone muestras, historial, precios manuales y comercios. El precio manual se guarda con `POST /api/precios/{productoId}/manual` y se elimina con `DELETE` sobre la misma ruta.
- Nuevas rutas: `GET /costos`, `GET /api/precios`, `GET /api/precios/comercios`, `GET /api/precios/{productoId}` y `GET /api/listas-compra/{id}/costo`.
- Pantalla `/costos`: resumen de productos con/sin precio, precios viejos y manuales; buscador y filtro por estado; historial por producto y comparación por comercio.
- Costeo de recetas: `RecetaService::detalle()` devuelve `costo` con total, por porción, falta comprar, valor de despensa, ingredientes sin precio y precios viejos. El modal de receta lo muestra y lo escala al cambiar porciones.
- Costeo de listas: `ListaCompraService` devuelve `costo` al cargar la lista y en su endpoint propio; la página muestra el total estimado, faltantes y precios viejos.
- Captura: la calculadora de pantalla rápida usa la mediana (`ultimo_precio` ahora es el precio sugerido) y muestra muestras/fecha. El guardado de compra acepta comercio y unidad real por ítem; el detalle permite editar el comercio y muestra la unidad de los ítems libres. Tickets: se conserva la unidad detectada y se añadió selector de unidad y comercio en la revisión.
- Verificado en local con Chromium (escritorio y 390 px) y WebKitGTK: `/costos`, historial y precio manual, receta Arroz rojo (total $29.30 para 4 porciones y $58.60 para 8), lista con 2 precios y 1 faltante, guardado de compra con comercio, edición de comercio y calculadora con precio sugerido. Sin errores de consola ni desbordes horizontales. Datos de prueba eliminados: 3 compras, 0 listas y 0 precios manuales.
- No se desplegó a producción. La corrección pendiente del modal (`1bee640`) sigue sin publicar.


STATE_HANDOFF — Fase 26 (Menú semanal + IA de escritorio) — 2026-11-05
- Migración 031: tablas `menus_semanales` y `menu_semanal_items`. La semana se normaliza al lunes y es única por usuario. Los ítems guardan día, momento, tipo (receta o nota), porciones, orden, nota y `nombre_snapshot`.
- `MenuRepository`, `MenuService` y `MenuController`: CRUD del menú, copiar semana, vaciar, costo por día/semana y generación de lista. Todo filtrado por usuario.
- `MenuIaService` y `MenuIaController`: preparar prompt, validar la respuesta del modelo y aplicar sugerencias. Endpoints solo para admin con `AdminMiddleware`.
- Nuevas rutas: `GET /menu`, `GET /api/menu`, `POST /api/menu/items`, `PUT|DELETE /api/menu/items/{id}`, `DELETE /api/menu`, `POST /api/menu/copiar`, `POST /api/menu/lista/preview`, `POST /api/menu/lista` y `POST /api/menu/ia/preparar|validar|aplicar`.
- Pantalla `/menu`: semana de lunes a domingo, 3 comidas por defecto, varios platillos por comida, tiempos extra (colación/otro), notas, selector de recetas con filtros, edición de porciones, mover, copiar semana anterior, vaciar y generar lista.
- Escritorio: arrastrar y soltar solo con mouse en pantallas de 992 px o más. En móvil y teclado se usa el diálogo «Editar / Mover».
- Costos: cada platillo muestra total o «Parcial»; el resumen muestra total semanal, recetas, platillos sin precio y precios viejos. La lista de la semana se puede revisar, excluir ingredientes y guardar en una lista nueva o existente.
- IA: botón visible solo para admin y solo dentro de Mi Súper Desktop. Permite completar huecos o reemplazar la semana, con filtros de personas, tiempo, favoritas y evitar repetidos. El servidor descarta slugs inexistentes, días inválidos, recetas no publicadas y huecos ocupados. La propuesta se revisa antes de aplicar.
- Escritorio: nuevo comando Tauri `menu_completar` y método `window.MiSuperDesktop.menuCompletar(prompt)`, ambos con comprobación de administrador. Requiere recompilar e instalar la app; desplegar solo la web no activa el botón.
- `RecetaService::previewLista()` subió el límite a 100 recetas y dejó de inventar cantidad 1 cuando una unidad es incompatible: ahora conserva la unidad original y el ingrediente queda como faltante.
- `PrecioService` ganó `costosRecetas()` para calcular una semana completa con una sola carga de precios; `costoReceta()` mantiene el mismo comportamiento.
- Verificado: migración desde cero (29 migraciones), permisos de menú ajeno, CRUD, copiar/vaciar, costos con precios manuales temporales, lista nueva y existente, IA con respuesta válida e inválida, botón IA oculto para usuario normal, 403 en endpoints de IA, escritorio 1440/1024 px, móvil 390 px y modo oscuro sin desbordes. `cargo check` y `cargo fmt` pasan. Datos QA eliminados: 0 menús, 0 listas nuevas, 0 precios manuales; se conservan las 3 compras originales.
- No se desplegó a producción.

STATE_HANDOFF — Fase 27 (Navegación adaptable: grupos en tableta y sidebar en PC) — 2026-11-06
- El mapa de navegación vive en `src/Views/layouts/app.php` (`$navItems`, `$navGrupos`, `$navAdmin`) y alimenta las tres variantes: sidebar de escritorio, grupos desplegables de tableta y modal del dock móvil.
- Puntos de quiebre: `< 768 px` dock inferior; `768–1199 px` grupos temáticos en la cabecera («Inicio · Compras · Cocina · Análisis · Notas · Admin»); `≥ 1200 px` barra lateral fija con todos los enlaces visibles.
- Grupos: Compras (Inicio, Por comprar, Ticket, Historial), Cocina (Menú semanal, Recetas, Chef solo admin), Análisis (Métricas, Precios y costos), Personal (Notas) y Administración (Catálogo, Categorías, Tipos, Productos, Usuarios).
- «Ajustes» y «Cerrar sesión» pasan al menú del avatar; se elimina el botón de logout con texto y el enlace duplicado de Ajustes. «Pantalla rápida» se etiqueta como «Inicio» en la navegación.
- Nuevos `public/assets/css/shell.css` (layout de shells, sidebar y desplegables), `public/assets/js/nav-menu.js` (componente único de menús con posicionamiento fijo, Escape, clic fuera y devolución de foco) y `public/assets/js/session.js` (respaldo de cierre de sesión para páginas sin manejador propio).
- Se retiran `admin-menu.js` y `nav-slider.js` junto con su CSS; el dock móvil conserva buscador y hoja de secciones, ahora agrupada.
- Verificado con Chromium headless en 390/500, 768, 1024, 1199, 1200 y 1440 px: sin desbordes, grupos y menú de cuenta funcionando, foco y `aria-expanded` correctos, dock móvil con grupos. No se desplegó a producción.

STATE_HANDOFF — Fase 28 (Alta global del admin, hero compacto, carrito lateral y semanas guardadas) — 2026-11-06
- Productos desde «+ Nuevo producto» de Pantalla rápida: `ProductoController::store()` crea un producto global (`usuario_id = NULL`) cuando la sesión es admin; los usuarios normales siguen creando productos personales. El modal y el toast adaptan su texto según el rol.
- Hero de Pantalla rápida (`quick-hero`): en `<1200 px` se reduce padding, tipografía y resumen, se oculta el párrafo descriptivo y, en teléfono, también el resumen del carrito. La altura baja aproximadamente a la mitad.
- Carrito: el `<aside>` sale del layout y pasa a ser un panel fijo lateral derecho (`width: min(420px, 92vw)`) con backdrop, bloqueo de scroll, cierre con X/backdrop/Escape y devolución del foco. `abrirCarrito()` ya no depende del landscape; el botón del carrito de la barra de búsqueda se muestra en todos los tamaños y el resumen del hero es un botón `data-cart-open`.
- Modal «Agregar al menú»: ancho útil de 720 px y padding explícito en cabecera, cuerpo y pie (con ajuste móvil), corrigiendo el contenido pegado a los bordes.
- «Mis semanas»: nueva tira visible en `/menu` con la semana actual y todas las semanas que tienen platillos. Cada tarjeta muestra rango, número de platillos, estado activo y badge «Esta semana». El backend expone `GET /api/menu/semanas` (`MenuRepository::semanas()` + `MenuService::semanas()`); la semana seleccionada se refleja en `?semana=` y se restaura al recargar.
- Verificado con Chromium/CDP en 390, 500, 768, 1200 y 1440 px: alta global del admin por API, tira de semanas (3 semanas de prueba), navegación entre semanas y URL, apertura/cierre del carrito con Escape y backdrop, y modal del selector con padding. Datos de prueba eliminados (0 menús, 0 ítems, 0 productos ZZ). No se desplegó a producción.

STATE_HANDOFF — Fase 29 (Selección de compras para recetas) — 2026-11-06
- «Solo con lo que he comprado» ahora abre un modal para elegir una o varias compras. La primera vez se marca la más reciente; el usuario puede cambiarla con «Cambiar compras» sin desactivar el filtro.
- El modal reutiliza `GET /api/compras?page=N`: muestra fecha completa, comercio, número de productos y total, con «Seleccionar todas», «Limpiar» y «Cargar más compras».
- Backend: `GET /api/recetas` y `GET /api/recetas/{slug}` aceptan `compras=1,2,3`. `RecetaService::resolverDespensa()` combina las compras seleccionadas o cae en la última cuando no se envía selección.
- `CompraRepository::despensa()` acepta un arreglo de compras (máximo 50, siempre filtrado por `usuario_id`) y se añadió `resumenes()` para devolver fechas, comercios, productos y totales de la selección.
- La despensa y el detalle de cada receta usan la misma selección; el resumen inferior muestra «Basado en N compras (fechas) · X productos».
- Verificado: `php -l` en controlador, servicio, repositorio y vista; `node --check` en `recetas.js`. Sin pruebas de navegador en esta sesión.

STATE_HANDOFF — Fase 30 (Recetas de referencia de Casa de México) — 2026-11-07
- Migración 032: columnas `recetas.fuente_nombre`, `recetas.fuente_url` y `recetas.fuente_autor`, con índice por `fuente_url`. Permiten atribuir recetas externas sin reutilizar `origen`.
- `RecetaRepository` expone los campos de fuente en `COLUMNS`, altas y ediciones, y añade `findByFuenteUrl()` para que la importación sea idempotente.
- `RecetaService` valida la fuente (nombre ≤150, URL http/https ≤500, autor ≤150), expone `fuente_*` y `referencia` en los payloads de listado/detalle/admin y añade `crearReferencia()` / `actualizarReferencia()`. Las referencias siempre nacen en `borrador` y con `creada_por = NULL`; al refrescar conservan el estado que ya tuviera el usuario.
- UI: el detalle público muestra el bloque «Receta de referencia», autor original y enlace «Ver receta original»; las tarjetas y el listado admin muestran el badge «Referencia». El formulario admin incorpora «Fuente y atribución» y `receta-form.js` envía los tres campos.
- `scripts/importar_casademexico.php`: lee el listado de la API REST de WordPress, descarga las fichas en paralelo, extrae ingredientes (listas, párrafos con `<br>` y texto plano), pasos, porciones, tiempo, picante, autor e imagen. Las imágenes se enlazan por URL (no se descargan). Normaliza unidades y cantidades (fracciones, rangos, unidades discretas/no estándar), descarta encabezados de grupo y limpia nombres.
- Clasificación: categoría de platillo y tipos de dieta (`general`, `vegetariano`, `sin_gluten`) sugeridos desde las categorías del sitio, el título y los ingredientes. Son propuestas para revisión manual, no una validación dietética.
- CLI: `--limit=N`, `--dry-run` y `--refrescar`. Sin `--refrescar` omite las recetas ya importadas; con él actualiza las existentes por `fuente_url`.
- Resultado local: 1,004 recetas importadas como borrador de las 1,006 de la fuente (999 con imagen enlazada y 963 con autor). Quedaron fuera «Merluza con salsa de 3 chiles» y «Café de Olla» porque la ficha original no publica pasos. Distribución de dietas: 1,004 general, 827 sin gluten y 331 vegetarianas. El catálogo total pasa a 1,104 recetas (100 base + 1,004 referencias).
- Verificado: migración aplicada, `php -l` en script/repositorio/servicio/vista, `node --check` en JS, dry-run, importación completa, refresco de las 1,004 y muestreo de ingredientes/categorías. Sin commit ni despliegue.
