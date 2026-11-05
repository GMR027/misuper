# Mi Súper Desktop

Aplicación de escritorio para Linux construida con **Tauri 2 + Rust**. Es un
contenedor de la web de Mi Súper: la web real se muestra dentro de la ventana,
así que todo lo que existe en la web aparece aquí sin reimplementarlo.

## Requisitos

- Rust 1.90 o superior (`rustup`)
- Node.js 20 o superior
- Cabeceras de WebKitGTK 4.1 y libsoup 3
- `poppler-utils` para leer los PDF de los libros (`pdftotext`)

En Ubuntu/Zorin:

```bash
sudo apt install libwebkit2gtk-4.1-dev libjavascriptcoregtk-4.1-dev \
  libsoup-3.0-dev libssl-dev librsvg2-dev build-essential pkg-config \
  poppler-utils
```

Si no puedes usar `sudo`, este repo incluye un plan B que extrae los `.deb` de
desarrollo en un sysroot del usuario:

```bash
./scripts/setup-sysroot.sh
source ~/.local/share/tauri-sysroot/env.sh
```

## Arrancar en desarrollo

```bash
npm install
./scripts/dev.sh
# o: source ~/.local/share/tauri-sysroot/env.sh && npm run app

# Abrir directamente los ajustes o la pestaña de IA
./target/debug/misuper-desktop --ajustes
./target/debug/misuper-desktop --ia

# Abrir la ventana Chef, opcionalmente con un PDF
./target/debug/misuper-desktop --chef
./target/debug/misuper-desktop --pdf /ruta/al/libro.pdf
```

## Cómo funciona

- En el primer arranque se pide la **dirección del servidor**.
- La ventana carga la web real (`/login`, pantalla rápida, historial, recetas,
  métricas, admin…). El login es el de la web.
- La cookie de sesión vive en el almacén persistente del webview, como en un
  navegador. No hay login propio ni tokens.
- Los enlaces a otros dominios se abren en el navegador del sistema.
- Ajustes y zoom están en el menú nativo o con atajos.

### Inteligencia artificial

La pestaña **Inteligencia artificial** de los ajustes solo aparece para
administradores. La app detecta:

- **Ollama**: servicio, versión y modelos instalados.
- **opencode**: CLI, sesión y modelos de `opencode-go`, incluidos los gratuitos.
- **Claude Code**: CLI, sesión de `claude.ai` y alias disponibles.
- **Hardware**: CPU, RAM, GPU y VRAM.

Cada modelo local recibe una recomendación según el hardware: recomendado para
GPU, funciona en CPU o no recomendado. Las conexiones se guardan en
`config.json`, se pueden probar con una petición real y solo una queda activa.

La app reutiliza las sesiones existentes de cada herramienta; **no guarda claves
ni contraseñas**. La comprobación de administrador usa la cookie de la web y
`GET /api/me`.

Cuando hay una conexión activa, la app inyecta junto al avatar de la web un
indicador con el modelo y un punto de color: verde (verificada), ámbar (sin
probar o antigua) y rojo (error). El indicador solo existe dentro de la app de
escritorio; al pulsarlo se abre la pestaña de IA.

### Chef: importar recetas de un libro

Chef es una página real de Mi Súper (`/chef`) que solo aparece para
administradores. La interfaz vive en la web, pero **el PDF se analiza en el
equipo**: la app inyecta un puente mínimo en el webview y ejecuta los comandos
locales. En un navegador normal la página muestra un aviso y no analiza nada.

1. Eliges un PDF con el botón.
2. La app extrae el texto con `pdftotext` y detecta recetas por bloques de
   metadatos (tiempo, raciones, coste, calorías) o por títulos.
3. Revisas **listas**, **dudosas** y **descartadas**, con vista previa y páginas.
4. Marcas las que quieres y, si un título no se pudo leer, puedes pedir ayuda a
   un modelo con visión.

El libro **no se sube a internet**: el análisis y la extracción ocurren en el
equipo.

Después de revisar la lista puedes pulsar **Extraer seleccionadas**. La app usa
la conexión de IA activa para convertir cada bloque en una receta con
ingredientes, cantidades, pasos reescritos, tiempo y porciones. Al terminar,
**Guardar lote** crea las recetas como pendientes en la web y enlaza al panel de
lotes para publicarlas o deshacerlas completas.

Para desarrollo queda la ventana local Chef, que no necesita la web:

```bash
./target/debug/misuper-desktop --chef
./target/debug/misuper-desktop --pdf /ruta/al/libro.pdf
```

#### Visión de respaldo

Algunos libros diseñados guardan el título en una imagen. Si el título no se
detecta, Chef ofrece **Buscar título con visión**. Requiere un modelo con visión
en Ollama:

```bash
ollama pull qwen2.5vl:7b
```

La imagen de la página se envía solo a Ollama en tu equipo. Si no hay un modelo
con visión, Chef lo dice y no inventa el título.

La ruta `/chef` forma parte de la web: hay que desplegarla con `./deploy.sh`
para que el menú y el botón **Importar recetas** la abran en producción.

### Atajos

| Atajo | Acción |
|---|---|
| `Ctrl` + `,` | Servidor y ajustes |
| `Ctrl` + `Shift` + `A` | Inteligencia artificial |
| `Ctrl` + `Shift` + `C` | Chef: importar recetas (página web) |
| `Ctrl` + `R` | Recargar |
| `Ctrl` + `+` / `-` / `0` | Zoom |
| `Alt` + `←` / `→` | Atrás / adelante |
| `Ctrl` + `Q` | Salir |

## Qué NO hace (todavía)

- No replica pantallas de la web ni guarda un espejo de datos: muestra la web
  real. Si actualizas la web, el escritorio lo ve al instante.
- No funciona sin conexión (la web es remota, igual que Project Web).
- La IA ya se puede configurar y Chef ya detecta recetas en un PDF, pero
  todavía no extrae ingredientes ni pasos con IA, ni las publica en la web.
- No sincroniza las conexiones de IA entre equipos: son locales a este equipo.
- Chef ya extrae ingredientes y pasos, pero la revisión fina se hace desde el
  panel de administración; la edición dentro de Chef llegará después.
- Chef todavía no lee libros escaneados sin texto seleccionable; para los
  títulos en imagen existe el respaldo con visión.
- La página `/chef` debe desplegarse con la web para que el menú la abra.

## Estructura

```
desktop/
├── src-tauri/        Tauri: ventanas, menú, config, comandos
│   └── src/ia/       Detección, hardware, conexiones, pruebas e insignia
│       └── importar/ Lectura de PDF y segmentación en recetas
├── src/              Ajustes locales (general + IA) y ventana Chef
├── tests/fixtures/   Libros y tickets de muestra para pruebas
├── public/assets/    Imágenes de la web
├── crates/           Reservado para las herramientas (core y store)
└── scripts/          dev.sh y setup-sysroot.sh
```

## Estado

- Shell de escritorio con la web incrustada, servidor configurable, sesión
  persistente, zoom, menú nativo y enlaces externos.
- Conexiones de IA para administradores: detección de modelos locales y de
  suscripción, recomendación por hardware, pruebas reales, conexión activa e
  indicador en la cabecera.
- Chef integrado en la web (`/chef`): lectura de PDF, detección por metadatos,
  selección, vista previa, respaldo con visión, extracción con IA y lotes
  pendientes con publicación o deshacer completo. Probado con tres recetarios
  reales de maquetación distinta y con los libros clásicos de muestra.
- Siguiente: extracción con IA de ingredientes y pasos, reescritura, lotes en
  la web y publicación revisada.
