# Mi Súper · App Android

App Android de Mi Súper: inicia sesión, registra compras y consulta el gasto
del mes. Está hecha con Expo (React Native), `expo-router` y Material 3 con
Jetpack Compose mediante `@expo/ui`.

Pantallas: **Inicio** (compra rápida), **Tickets**, **Gastos** y **Ajustes**.
La app tiene un **dock inferior** como la web móvil, 15 paletas de color,
calculadora de compras, imágenes de producto y editor de avatar.

## Navegación inferior

El dock tiene cinco posiciones, como la web móvil:

- **Inicio**: compra rápida.
- **Gastos**: resumen de gasto.
- **Botón central `+`**: buscar productos desde cualquier pantalla.
- **Ticket**: subir un ticket.
- **Menú**: hoja con el avatar, la cuenta, las secciones y cerrar sesión.

El avatar de la barra superior también abre el menú. La app ya no usa el drawer
lateral en el teléfono.

## Horizontal y tabletas

La app gira con el teléfono. Desde 600 dp de ancho el dock inferior se
convierte en un **rail lateral** de cinco destinos con el botón `+` al pie, y
las pantallas aprovechan todo el ancho:

- Rejillas de 2–5 columnas en productos, recetas, notas, menú, tickets,
  historial y listas de compra.
- Ajustes y el detalle de receta usan dos paneles desde 840 dp; el login y el
  registro, desde 700 dp en horizontal.
- Márgenes, cabecera y contenido respetan las zonas seguras, con un ancho
  máximo de página de 980/1160 dp.
- `lib/responsive.ts` centraliza los cortes (600/840/1200) y calcula el ancho
  real de contenido descontando el rail y los gutters.

## Iniciar sesión y crear cuenta

La app usa un **token Bearer** emitido por el backend PHP; no depende de cookies
ni de la sesión del navegador. El token se guarda cifrado con
`expo-secure-store` y se revoca al cerrar sesión.

- **Crear cuenta:** desde la pantalla de login, con nombre, correo y contraseña.
- **Contraseña temporal:** si el administrador reseteó la cuenta, la app muestra
  el cambio obligatorio antes de entrar.
- **Servidor:** por defecto usa `https://misuper.iguzman.com.mx`. En la pantalla
  de login puedes cambiarlo (por ejemplo, a la IP de tu PC para pruebas locales).
- **Cerrar sesión:** Ajustes → Cuenta → Cerrar sesión. También se cierra al
  cambiar la URL del servidor.

Endpoints que consume la app:

```http
POST /api/mobile/auth/login
POST /api/mobile/auth/register
POST /api/mobile/auth/logout   (Authorization: Bearer …)
GET  /api/avatars              (catálogo de avatares)
POST /api/me/avatar            (foto o avatar, multipart)
```

Después del login, todos los endpoints normales (`/api/me`, `/api/productos/…`,
`/api/compras`, etc.) aceptan el mismo `Authorization: Bearer …`.

## Pantalla rápida

**Inicio** es la pantalla de compra rápida:

- Barra de búsqueda con botón de producto nuevo, categorías y carrito.
- Hoja de categorías con **Frecuentes**, **Todas** y las categorías del backend.
- Cuadrícula de **2 columnas** con imagen 2:1, nombre, categoría, unidad y
  precio sugerido; vista alternativa en lista.
- Botón **Agregar** y botón de **calculadora** en cada producto.
- **Calcular compra**: costo por unidad × cantidad, importe en vivo, fórmula y
  último precio recordado por producto.
- **Nuevo producto** como en la web: nombre, categoría, unidad, cantidad y
  precio; se guarda como producto personal y se agrega al carrito.
- Carrito persistente; hoja con fecha, comercio, cantidad, precio, total y
  guardado con `POST /api/compras`.
- El carrito se limpia al cerrar sesión para no mezclar cuentas.

## Apariencia y avatar

Ajustes → **Apariencia**:

- 15 paletas: Esmeralda, Océano, Índigo, Uva, Frambuesa, Terracota, Ámbar,
  Cítrico, Cielo, Grafito, Menta, Lavanda, Cereza, Durazno y Arena.
- Modo **Sistema / Claro / Oscuro**.
- **Color de enfoque**: automático o personalizado, con intensidad y expansión
  del halo de fondo.
- Idioma del sistema, español o inglés.

Ajustes → **Datos personales**:

- Subir una foto desde la galería.
- Elegir uno de los **50 avatares** con emoji y degradado.
- Quitar la foto o el avatar.

El avatar aparece en la barra superior, en la hoja del menú y en la tarjeta de
cuenta.


## Requisitos

- Node.js 20 o superior y pnpm 10 o superior.
- JDK 17 (`javac` y `keytool`).
- Android SDK con `platform-tools` (adb).
- Un teléfono Android 7.0 o superior (API 24), con Depuración USB o
  Depuración inalámbrica activada.

El CLI busca adb en `PATH`, en `$ANDROID_HOME` y en `~/Android/Sdk`. Si tu SDK
está en otra ruta, exporta `ANDROID_HOME` antes de correr los comandos.

## Instalar dependencias

Desde la raíz del repo:

```bash
pnpm mobile:install
```

## Compilar e instalar en un teléfono

Desde la raíz del repo:

```bash
pnpm android
```

Sin argumentos abre un menú con tres opciones:

1. **Compilar e instalar (release)** — versión para usar a diario.
2. **Compilar en modo desarrollo (debug + Metro)** — para programar.
3. **Teléfonos** — vincular, conectar, renombrar o eliminar teléfonos.

En el flujo normal el CLI:

1. Pregunta el idioma de los mensajes.
2. Ofrece subir la versión patch (`0.1.4` → `0.1.5`) y actualiza
   `package.json`, `app.json` y `versionCode`.
3. Regenera `android/` si hace falta (`expo prebuild --clean`).
4. Compila el APK release solo para la arquitectura del teléfono elegido.
5. Lo instala con `adb install -r` y abre la app.

### Sin menú

```bash
# Instalar en un teléfono guardado, sin preguntas, en español
pnpm android -d mi-telefono -y --lang es

# Varios teléfonos
pnpm android -d mi-telefono -d tablet -y --lang es
pnpm android -d mi-telefono,tablet -y

# Regenerar android/ aunque esté al día
pnpm android --prebuild

# Ayuda completa
pnpm android --help
```

| Opción | Qué hace |
| --- | --- |
| `-d, --device <apodo>` | Instala en ese teléfono. Se puede repetir o separar con comas. Acepta el apodo guardado o el serial de adb. Falla si no se puede conectar. |
| `-y, --yes` | Usa los valores por defecto: idioma inglés, sube la versión y no desinstala nada. Si no diste `-d`, todavía pregunta en qué teléfonos instalar. |
| `--dev` | Compila el APK debug, lo instala, abre la app y configura `adb reverse` para Metro. |
| `--prebuild` | Fuerza `expo prebuild --platform android --clean`. |
| `--lang en\|es` | Omite la pregunta de idioma. |
| `-h, --help` | Muestra la ayuda. |

## Vincular teléfonos

```bash
pnpm android devices
```

Elige **Vincular un teléfono** y luego:

### Wi-Fi (recomendado, Android 11+)

1. En el teléfono: **Ajustes → Opciones de desarrollador → Depuración
   inalámbrica**.
2. Actívala y toca **Vincular dispositivo con código de vinculación**.
3. Deja esa pantalla abierta. El CLI encuentra el teléfono solo y pide el
   código de 6 dígitos.

El puerto de la depuración inalámbrica cambia cada vez que la activas; el CLI
vuelve a encontrar el teléfono por su serial, así que no hay que volver a
vincularlo.

### USB

1. Conecta el cable (de datos, no solo de carga).
2. Acepta la huella RSA que aparece en el teléfono.

El teléfono queda guardado en modo USB. Si quieres pasarlo a Wi-Fi sin cable,
el CLI puede ejecutar `adb tcpip 5555` y guardar la dirección `<ip>:5555`.
Ese modo dura hasta que el teléfono se reinicie; después hay que volver a
conectarlo por USB.

Los teléfonos se guardan **fuera del repositorio**, en
`~/.config/misuper/android-devices` (o `$XDG_CONFIG_HOME/misuper/android-devices`).

## Firma de la versión release

La app release se firma con una clave propia, nunca con la clave debug. La
clave vive fuera del repo:

| Qué | Dónde |
| --- | --- |
| Keystore | `~/.android/misuper-mobile-release.jks` |
| Alias | `misuper-mobile` |
| Contraseñas | `~/.gradle/gradle.properties` (`MISUPER_MOBILE_RELEASE_*`) |

`pnpm android` crea la clave automáticamente si no existe. También puedes
crearla o consultarla a mano:

```bash
bash misuper-mobile/cli/release-key.sh          # crea la clave si falta
bash misuper-mobile/cli/release-key.sh --print  # muestra rutas y contraseñas
```

> **Importante:** guarda el `.jks` y las contraseñas en un lugar seguro. Todas
> las actualizaciones deben firmarse con esa misma clave. Si la pierdes, habrá
> que desinstalar la app en cada teléfono antes de poder instalar una build
> nueva.

Si falta la clave, la compilación release se detiene con un error en lugar de
firmar con la clave debug.

## Desarrollo con Metro

```bash
# 1. Compila e instala el APK debug, y deja adb reverse listo
pnpm android --dev -d mi-telefono -y --lang es

# 2. En otra terminal, inicia Metro
pnpm mobile:start
```

El APK debug usa el paquete **`app.misuper.debug`**, así que puede convivir con
la app release (`app.misuper`) en el mismo teléfono. Metro sirve el bundle en
`http://localhost:8081`; `adb reverse tcp:8081 tcp:8081` lo hace llegar al
teléfono por USB.

## Dirección de la API

La app habla con el backend PHP de Mi Súper. Por defecto usa
`https://misuper.iguzman.com.mx`. Hay dos formas de cambiarlo:

1. **En el teléfono:** pantalla de login → Servidor → **Cambiar servidor**, o
   Ajustes → Servidor → **URL de la API**. Para pruebas locales usa la IP de tu
   PC, por ejemplo `http://192.168.1.70:8001`.
2. **Al compilar:** copia `.env.example` a `.env` y define
   `EXPO_PUBLIC_API_URL`. El valor se inyecta en la build.

```bash
cp misuper-mobile/.env.example misuper-mobile/.env
# edita misuper-mobile/.env
pnpm android -d mi-telefono -y --lang es
```

La URL guardada en el teléfono tiene prioridad sobre `EXPO_PUBLIC_API_URL`. Para
desarrollo local se permite HTTP sin cifrar; en producción usa HTTPS.

### Probar contra el backend local

El teléfono necesita alcanzar la PC por la red Wi-Fi. Levanta el servidor en
todas las interfaces (no solo en `localhost`):

```bash
php -S 0.0.0.0:8001 -t public
```

Luego, en el login del teléfono, pon `http://<IP-de-tu-PC>:8001`.

## Verificaciones

```bash
pnpm mobile:check   # TypeScript + ESLint
pnpm mobile:lint    # solo ESLint
```

## Estructura

```
misuper-mobile/
  app/            rutas de expo-router (login, registro, drawer y pantallas)
  components/     componentes de UI, incluido components/m3 (Material 3)
  lib/            API, sesión, carrito, base local, ajustes, i18n y formato
  messages/       textos en español e inglés
  modules/        módulos nativos locales (si hacen falta)
  plugins/        config plugins de Expo (firma release, id debug)
  cli/            android.sh, devices.sh y release-key.sh
  assets/         iconos, splash y símbolos Material
  app.json        configuración de Expo
```

## Problemas comunes

**`adb was not found`**
Instala `platform-tools` o exporta `ANDROID_HOME` con la ruta de tu SDK.

**El teléfono no aparece**
Revisa que esté en la misma Wi-Fi, que la Depuración inalámbrica siga activa y
que hayas aceptado la huella RSA. Si usa USB, prueba otro cable.

**`INSTALL_FAILED_UPDATE_INCOMPATIBLE`**
El teléfono tiene la app firmada con otra clave. Desinstálala y vuelve a
instalar. El CLI ofrece hacerlo, pero `-y` nunca desinstala. La app debug
(`app.misuper.debug`) no choca con la release.

**La app debug se queda en el splash o muestra un error de Metro**
Verifica que `pnpm mobile:start` esté corriendo y que `adb reverse --list`
incluya `tcp:8081 tcp:8081`. Si cambiaste de cable o de teléfono, vuelve a
correr `pnpm android --dev`.

**Gradle falla por el JDK**
Usa JDK 17. El CLI lo busca en `JAVA_HOME` y en `/usr/lib/jvm/`.

**La primera compilación tarda**
Es normal: Gradle descarga dependencias y compila las librerías nativas. Las
siguientes builds son mucho más rápidas.
