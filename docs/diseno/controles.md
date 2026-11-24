# Controles e iconos

Referencia de la fase de rediseño de botones e iconos de Mi Súper. Se aplica a
la web y a la app Android.

## Referencias de Stitch

- Proyecto: **Mi Súper · Controles e iconos**
- ID: `2148604822813942082`
- URL: https://stitch.withgoogle.com/projects/2148604822813942082
- Capturas:
  - `docs/diseno/stitch/controles-web.png`
  - `docs/diseno/stitch/controles-android.png`
  - `docs/diseno/stitch/inicio-web.png`
  - `docs/diseno/stitch/inicio-android.png`

El cliente `scripts/stitch.mjs` lee `STITCH_API_KEY` desde `.env`; nunca se
versiona la clave.

### Referencias de Inicio

- Web: pantalla `236cc555e1fc47b4ae894b046256c70b`, captura
  `docs/diseno/stitch/inicio-web.png`.
- Android: pantalla `e036e370e62648058c10459fcd033012`, captura
  `docs/diseno/stitch/inicio-android.png`.
- Ambas validan los controles en contexto: un solo carrito visible, buscador
  con micrófono/alta/categorías, selector lista/cuadrícula, tarjetas de
  producto y dock con FAB de búsqueda (lupa, no «+»).

## Tokens de controles

| Token | Web | Android |
|---|---|---|
| Altura compacta | 36 px | 40 dp |
| Altura normal | 44 px | 48 dp |
| Altura grande | 52 px | 56 dp |
| Radio de botón | 12 px | M3 (pill / 12 dp) |
| Icono normal | 20 px | 24 dp |
| Icono compacto | 18 px | 20 dp |
| Objetivo táctil mínimo | 44 px | 48 dp |
| Foco | anillo de 3 px con `--focus-rgb` | state layer de M3 |

### Jerarquía web

- `btn-primary`: acción principal.
- `btn-tonal`: acción secundaria con énfasis.
- `btn-outline-secondary`: acción terciaria.
- `btn-link`: acción discreta.
- `btn-danger`: confirmación destructiva.
- `icon-btn`: acción de solo icono; variantes `--tonal`, `--outlined`,
  `--filled`, `--danger`, `--sm` y `--lg`.

### Jerarquía Android

- `Button` con `variant` filled/tonal/outlined/text/elevated y `tone="danger"`.
- `IconButton` de 48 dp por defecto, con variantes M3 y `tone="danger"`.
- `CompactButton` para tarjetas densas.
- `IconToggle` para el selector lista/cuadrícula.

## Catálogo de iconos

La fuente única es `shared/iconos.json`. Web conserva Bootstrap Icons porque
los campos `icono` de categorías y tipos de dieta ya guardan clases `bi-*` en la
base de datos. Android usa Material Symbols outlined.

Reglas:

1. Dos destinos de navegación nunca comparten icono.
2. Cada acción tiene un verbo propio: guardar, confirmar, publicar, editar,
   eliminar, quitar, vaciar, descartar, reintentar, ver, ocultar, buscar,
   agregar, cargar más, restablecer.
3. `list` y `grid-view` quedan reservados al selector de vista en Android.
4. Ningún botón de solo icono pierde su etiqueta accesible (`aria-label` en web,
   `label` en Android).
5. Todos los iconos de la app Android pasan por `ICONOS`; `check-iconos.mjs`
   falla si vuelve a aparecer un `icon="…"`, `leadingIcon="…"` o
   `SymbolIcon name="…"` literal.

## Comandos

```bash
node scripts/gen-iconos.mjs      # regenera PHP, JS y TS
node scripts/gen-symbols.mjs     # descarga los XML de Material Symbols
node scripts/check-iconos.mjs    # valida duplicados y símbolos faltantes
node scripts/gen-iconos.mjs --check
node scripts/gen-symbols.mjs --check
```

## Duplicados corregidos

- Web · Inicio: un solo acceso visible al carrito por breakpoint.
- Android · drawer: se quitó el enlace de Ajustes del pie; queda la entrada de
  la lista.
- Android · menú: Historial, Recetas, Notas, Catálogo, Productos, Usuarios,
  Omisiones, Métricas y Precios tienen iconos distintos.
- Listas: eliminar, quitar, vaciar y descartar usan iconos diferentes.
- Android · Inicio: el FAB de búsqueda usa `search`; el alta de producto usa
  `add`.
- Android · admin: restablecer contraseña usa `key` y cargar más usa
  `expand-more`.
