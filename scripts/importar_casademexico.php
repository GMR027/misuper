<?php

declare(strict_types=1);

use App\Repositories\RecetaRepository;
use App\Services\NormalizadorService;
use App\Services\RecetaService;
use App\Support\Env;

/**
 * Importa recetas de referencia de Fundación Casa de México en España.
 *
 * - Lee el listado desde la API REST de WordPress.
 * - Descarga cada ficha y extrae ingredientes, pasos, porciones, tiempo,
 *   picante, autor e imagen.
 * - Guarda siempre en estado "borrador" y con atribución de la fuente.
 * - Las imágenes se enlazan (no se descargan).
 *
 * Uso:
 *   php scripts/importar_casademexico.php --limit=5 --dry-run
 *   php scripts/importar_casademexico.php
 *   php scripts/importar_casademexico.php --refrescar
 */

define('BASE_PATH', dirname(__DIR__));

require BASE_PATH . '/vendor/autoload.php';

Env::load(BASE_PATH . '/.env');

const FUENTE_NOMBRE = 'Fundación Casa de México en España';
const FUENTE_BASE = 'https://www.casademexico.es';
const LOTE_DESCARGA = 6;

$opciones = getopt('', ['limit::', 'dry-run', 'refrescar']);

if ($opciones === false) {
    fwrite(STDERR, "No se pudieron leer las opciones.\n");
    exit(1);
}

$limite = isset($opciones['limit']) ? max(0, (int) $opciones['limit']) : 0;
$dryRun = array_key_exists('dry-run', $opciones);
$refrescar = array_key_exists('refrescar', $opciones);

/**
 * Aborta con un mensaje.
 */
function abortar(string $mensaje): never
{
    fwrite(STDERR, '✗ ' . $mensaje . "\n");
    exit(1);
}

/**
 * Descarga una URL con reintentos.
 */
function descargar(string $url, int $intentos = 3): ?string
{
    for ($i = 1; $i <= $intentos; $i++) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS => 5,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_TIMEOUT => 35,
            CURLOPT_USERAGENT => 'Mozilla/5.0 (compatible; Misuper/1.0; +https://misuper.local)',
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_ENCODING => '',
        ]);
        $body = curl_exec($ch);
        $codigo = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        curl_close($ch);

        if ($codigo >= 200 && $codigo < 300 && is_string($body)) {
            return $body;
        }

        if ($i < $intentos) {
            usleep(400000 * $i);
        }
    }

    return null;
}

/**
 * Descarga varias URL en paralelo.
 *
 * @param array<int, string> $urls
 * @return array<int, string|null>
 */
function descargarVarias(array $urls): array
{
    $mh = curl_multi_init();
    $handles = [];

    foreach ($urls as $indice => $url) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS => 5,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_TIMEOUT => 35,
            CURLOPT_USERAGENT => 'Mozilla/5.0 (compatible; Misuper/1.0; +https://misuper.local)',
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_ENCODING => '',
        ]);
        curl_multi_add_handle($mh, $ch);
        $handles[$indice] = $ch;
    }

    $ejecutando = null;

    do {
        $estado = curl_multi_exec($mh, $ejecutando);

        if ($ejecutando > 0) {
            curl_multi_select($mh, 1.0);
        }
    } while ($ejecutando > 0 && $estado === CURLM_OK);

    $resultados = [];

    foreach ($handles as $indice => $ch) {
        $codigo = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        $body = curl_multi_getcontent($ch);
        $resultados[$indice] = $codigo >= 200 && $codigo < 300 && is_string($body)
            ? $body
            : null;
        curl_multi_remove_handle($mh, $ch);
        curl_close($ch);
    }

    curl_multi_close($mh);

    return $resultados;
}

/**
 * Descarga y decodifica un JSON.
 *
 * @return array<string, mixed>|array<int, mixed>|null
 */
function descargarJson(string $url): ?array
{
    $body = descargar($url);

    if ($body === null) {
        return null;
    }

    $data = json_decode($body, true);

    return is_array($data) ? $data : null;
}

/**
 * Espacios normalizados en una línea.
 */
function limpiarEspacios(string $texto): string
{
    $texto = str_replace(["\xc2\xa0", "\r", "\t"], ' ', $texto);
    $texto = preg_replace('/\s+/u', ' ', $texto) ?? $texto;

    return trim($texto);
}

/**
 * Extrae el texto de un nodo insertando saltos en bloques y <br>.
 */
function textoConSaltos(DOMNode $nodo): string
{
    $salida = '';

    foreach ($nodo->childNodes as $hijo) {
        if ($hijo instanceof DOMText) {
            $salida .= $hijo->nodeValue;

            continue;
        }

        if (!($hijo instanceof DOMElement)) {
            continue;
        }

        $tag = strtolower($hijo->tagName);

        if ($tag === 'br') {
            $salida .= "\n";

            continue;
        }

        if (in_array($tag, ['script', 'style', 'svg', 'noscript'], true)) {
            continue;
        }

        $salida .= textoConSaltos($hijo);

        if (in_array($tag, ['p', 'li', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'tr', 'ul', 'ol'], true)) {
            $salida .= "\n";
        }
    }

    return $salida;
}

/**
 * Texto plano de un nodo.
 */
function textoPlano(DOMNode $nodo): string
{
    return limpiarEspacios($nodo->textContent);
}

/**
 * Carga el HTML en DOMDocument.
 *
 * @return array{0: DOMDocument, 1: DOMXPath}
 */
function cargarDom(string $html): array
{
    $dom = new DOMDocument();
    $anterior = libxml_use_internal_errors(true);
    $dom->loadHTML(
        '<?xml encoding="UTF-8">' . $html,
        LIBXML_NOWARNING | LIBXML_NOERROR | LIBXML_NONET
    );
    libxml_clear_errors();
    libxml_use_internal_errors($anterior);

    return [$dom, new DOMXPath($dom)];
}

/**
 * Devuelve el bloque de ingredientes.
 */
function bloqueIngredientes(DOMXPath $xp): ?DOMNode
{
    foreach ($xp->query('//h2[contains(@class, "h2-receta")]') as $h2) {
        if (NormalizadorService::normalizar(textoPlano($h2)) === 'ingredientes') {
            return $h2->parentNode;
        }
    }

    $bloque = $xp->query('//div[contains(@class, "col-receta-1")]');

    return $bloque->length > 0 ? $bloque->item(0) : null;
}

/**
 * Devuelve el autor original de la ficha.
 */
function autorOriginal(DOMXPath $xp): ?string
{
    $nodos = $xp->query('//div[contains(@class, "text-receta") and contains(@class, "autor")]');

    if ($nodos->length > 0) {
        $autor = textoPlano($nodos->item(0));

        return $autor === '' ? null : mb_substr($autor, 0, 150);
    }

    return null;
}

/**
 * Normaliza una URL de imagen (quita espacios y añade el esquema si falta).
 */
function normalizarUrlImagen(string $url): string
{
    $url = trim($url);

    if ($url === '' || str_starts_with($url, 'data:')) {
        return '';
    }

    if (str_starts_with($url, '//')) {
        return 'https:' . $url;
    }

    return $url;
}

/**
 * Devuelve la URL de la imagen principal de la receta.
 */
function imagenPrincipal(DOMXPath $xp, string $html, string $slug): ?string
{
    $excluir = [
        'logo', 'favicon', 'cropped', 'hecho-a-mano', 'slider-gastronomia',
        'placeholder', 'complianz', 'icono', 'avatar',
    ];

    $candidatas = [];

    foreach ($xp->query('//img') as $img) {
        if (!($img instanceof DOMElement)) {
            continue;
        }

        $url = $img->getAttribute('data-lazy-src');

        if ($url === '') {
            $url = $img->getAttribute('data-src');
        }

        if ($url === '') {
            $url = $img->getAttribute('src');
        }

        if ($url === '' || str_starts_with($url, 'data:')) {
            $srcset = $img->getAttribute('data-lazy-srcset');

            if ($srcset === '') {
                $srcset = $img->getAttribute('data-srcset');
            }

            if ($srcset === '') {
                $srcset = $img->getAttribute('srcset');
            }

            if ($srcset !== '') {
                $primera = trim(explode(',', $srcset)[0]);
                $url = trim(explode(' ', $primera)[0]);
            }
        }

        $url = normalizarUrlImagen($url);

        if (!str_contains($url, '/wp-content/uploads/')) {
            continue;
        }

        if (!preg_match('/\.(?:jpe?g|png|webp)(?:\?.*)?$/i', $url)) {
            continue;
        }

        $minusculas = strtolower($url);

        foreach ($excluir as $palabra) {
            if (str_contains($minusculas, $palabra)) {
                continue 2;
            }
        }

        $candidatas[] = $url;
    }

    // Algunas fichas usan la imagen social como única imagen de portada.
    foreach ($xp->query('//meta[@property="og:image" or @name="og:image" or @name="twitter:image"]') as $meta) {
        if (!($meta instanceof DOMElement)) {
            continue;
        }

        $url = normalizarUrlImagen($meta->getAttribute('content'));

        if ($url !== '' && str_contains($url, '/wp-content/uploads/')
            && preg_match('/\.(?:jpe?g|png|webp)(?:\?.*)?$/i', $url)
        ) {
            $minusculas = strtolower($url);
            $excluida = false;

            foreach ($excluir as $palabra) {
                if (str_contains($minusculas, $palabra)) {
                    $excluida = true;
                    break;
                }
            }

            if (!$excluida) {
                $candidatas[] = $url;
            }
        }
    }

    // El nombre del archivo puede no coincidir en mayúsculas con el slug.
    $buscados = array_values(array_unique(array_filter([
        $slug,
        (string) preg_replace('/-\d+$/', '', $slug),
    ])));

    foreach ($buscados as $buscado) {
        foreach ($candidatas as $url) {
            if (str_contains(strtolower($url), strtolower($buscado))) {
                return $url;
            }
        }
    }

    if ($candidatas !== []) {
        return $candidatas[0];
    }

    // Último recurso: buscar en el HTML una imagen que contenga el slug.
    foreach ($buscados as $buscado) {
        if (preg_match(
            '#https://www\.casademexico\.es/wp-content/uploads/[^\s"\'<>]*' . preg_quote($buscado, '#') . '[^\s"\'<>]*\.(?:jpe?g|png|webp)#i',
            $html,
            $m
        ) === 1) {
            return $m[0];
        }
    }

    return null;
}

/**
 * Convierte una cantidad a texto limpio.
 */
function formatearCantidad(float $cantidad): string
{
    $texto = number_format($cantidad, 3, '.', '');
    $texto = rtrim(rtrim($texto, '0'), '.');

    return $texto === '' ? '0' : $texto;
}

/**
 * Normaliza una línea de ingrediente.
 */
function normalizarLinea(string $linea): string
{
    $linea = str_replace(
        ['¼', '½', '¾', '⅓', '⅔', '⅛', '⅜', '⅝', '⅞'],
        ['0.25', '0.5', '0.75', '0.333', '0.667', '0.125', '0.375', '0.625', '0.875'],
        $linea
    );
    $linea = limpiarEspacios($linea);

    // Viñetas y guiones iniciales, incluso pegados a la cantidad ("-3 chiles").
    $linea = (string) preg_replace('/^[\-–—•*·]+\s*/u', '', $linea);

    // Cantidades mixtas escritas como "1 y ½" (ya convertidas a "1 y 0.5").
    $linea = (string) preg_replace_callback(
        '/^(\d+(?:\.\d+)?)\s+y\s+(\d+(?:\.\d+)?)\b/u',
        static fn (array $m): string => formatearCantidad((float) $m[1] + (float) $m[2]),
        $linea
    );

    // "1 ½" (ya convertido a "1 0.5") significa 1.5.
    $linea = (string) preg_replace_callback(
        '/^(\d+)\s+(0\.\d+)\b/u',
        static fn (array $m): string => formatearCantidad((float) $m[1] + (float) $m[2]),
        $linea
    );

    // "de 2 a 4 dientes": la preposición sobra antes de la cantidad.
    $linea = (string) preg_replace('/^de\s+(?=\d)/iu', '', $linea);

    // "¼ de kg", "¼ d taza": el "de" sobra entre la cantidad y la unidad.
    $linea = (string) preg_replace(
        '/^(\d+(?:\.\d+)?)\s+(?:de|d)\s+(?=(?:kg|kilos?|g|gr|gramos?|ml|mililitros?|l|litros?|tzas?|tazas?|cdas?|cucharadas?|cdtas?|cditas?|cucharaditas?|pzas?|piezas?|uds?|unidades?)\b)/iu',
        '$1 ',
        $linea
    );

    // Rangos de cantidad ("2-3 chiles", "24–30 tortillas", "2 a 3 chiles").
    $linea = (string) preg_replace_callback(
        '/^(\d+(?:\.\d+)?)\s*(?:[-–—]|\ba\b)\s*(\d+(?:\.\d+)?)\b/u',
        static fn (array $m): string => formatearCantidad(max((float) $m[1], (float) $m[2])),
        $linea
    );

    $linea = (string) preg_replace('/(\d),(\d)/u', '$1.$2', $linea);
    $linea = (string) preg_replace_callback(
        '/(\d+)\s+(\d+)\/(\d+)/u',
        static fn (array $m): string => formatearCantidad((float) $m[1] + ((float) $m[2] / (float) $m[3])),
        $linea
    );
    $linea = (string) preg_replace_callback(
        '/(?<![\d.])(\d+)\/(\d+)/u',
        static fn (array $m): string => formatearCantidad((float) $m[1] / (float) $m[2]),
        $linea
    );

    return limpiarEspacios($linea);
}

/**
 * Unidades estándar de la app.
 *
 * @return array<string, string>
 */
function unidadesEstandar(): array
{
    return [
        'g' => 'g', 'gr' => 'g', 'grs' => 'g', 'gramo' => 'g', 'gramos' => 'g',
        'kg' => 'kg', 'kgs' => 'kg', 'kilo' => 'kg', 'kilos' => 'kg',
        'kilogramo' => 'kg', 'kilogramos' => 'kg',
        'ml' => 'ml', 'mls' => 'ml', 'mililitro' => 'ml', 'mililitros' => 'ml', 'cc' => 'ml',
        'l' => 'L', 'lt' => 'L', 'lts' => 'L', 'litro' => 'L', 'litros' => 'L',
        'pza' => 'pza', 'pzas' => 'pza', 'pz' => 'pza', 'pzs' => 'pza',
        'pieza' => 'pza', 'piezas' => 'pza', 'unidad' => 'pza', 'unidades' => 'pza',
        'ud' => 'pza', 'uds' => 'pza',
    ];
}

/**
 * Unidades discretas que se pueden contar como piezas.
 *
 * @return array<int, string>
 */
function unidadesDiscretas(): array
{
    return [
        'diente', 'dientes', 'lata', 'latas', 'hoja', 'hojas', 'ramita', 'ramitas',
        'ramo', 'ramos', 'ramito', 'ramitos', 'manojo', 'manojos', 'sobre', 'sobres',
        'paquete', 'paquetes', 'bolsa', 'bolsas', 'bote', 'botes', 'trozo', 'trozos',
        'rodaja', 'rodajas', 'cabeza', 'cabezas',
    ];
}

/**
 * Unidades no estándar que se conservan en el nombre.
 *
 * @return array<int, string>
 */
function unidadesNoEstandar(): array
{
    return [
        'taza', 'tazas', 'tz', 'tzas', 'tza', 'cda', 'cdas', 'cucharada', 'cucharadas',
        'cdta', 'cdtas', 'cdita', 'cditas', 'cucharadita', 'cucharaditas', 'pizca', 'pizcas',
        'chorrito', 'chorritos', 'punado', 'punados', 'puñado', 'puñados',
        'centilitro', 'centilitros', 'cl', 'onza', 'onzas', 'oz', 'cm', 'mm',
    ];
}

/**
 * Quita artículos/adjetivos iniciales del nombre de un ingrediente.
 */
function limpiarNombreIngrediente(string $nombre): string
{
    $nombre = limpiarEspacios($nombre);
    $anterior = null;

    // "de de seta ostra" o "pequeño de cilantro": repetir hasta estabilizar.
    while ($nombre !== $anterior && $nombre !== '') {
        $anterior = $nombre;
        $nombre = (string) preg_replace('/^(?:de|del)\s+/iu', '', $nombre);
        $nombre = (string) preg_replace(
            '/^(?:grandes?|pequeñ[oa]s?|median[oa]s?|chic[oa]s?|enter[oa]s?|picad[oa]s?|fresc[oa]s?|seca?s?|molid[oa]s?|rallad[oa]s?|trocead[oa]s?|desmenuzad[oa]s?|cortad[oa]s?|madur[oa]s?)\s+/iu',
            '',
            $nombre
        );
    }

    $nombre = (string) preg_replace('/\s+al gusto$/iu', '', $nombre);
    $nombre = (string) preg_replace('/\s+suficientes?$/iu', '', $nombre);
    $nombre = (string) preg_replace('/\s+opcional(?:es)?$/iu', '', $nombre);
    $nombre = (string) preg_replace('/\s+c\/n$/iu', '', $nombre);
    $nombre = (string) preg_replace('/\s+n\/c$/iu', '', $nombre);
    $nombre = (string) preg_replace('/\s*\((?:opcional|al gusto)\)\s*$/iu', '', $nombre);

    return limpiarEspacios($nombre);
}

/**
 * Indica si una línea es un encabezado de grupo y no un ingrediente.
 */
function esEncabezadoIngredientes(string $linea): bool
{
    $normalizado = NormalizadorService::normalizar($linea);

    if (in_array($normalizado, [
        'ingredientes', 'utensilios', 'tecnicas requeridas', 'autor', 'preparacion',
        'decoracion', 'montaje', 'presentacion', 'emplatado',
    ], true)) {
        return true;
    }

    if (preg_match('/\d/u', $linea) === 1) {
        return false;
    }

    if (str_ends_with(trim($linea), ':')) {
        return true;
    }

    // "Para la tinga", "Para montar", "Para el aderezo"...
    return preg_match('/^para\s+[a-z]/u', $normalizado) === 1
        && count(preg_split('/\s+/u', $normalizado) ?: []) <= 6;
}

/**
 * Crea un ingrediente sin cantidad.
 *
 * @return array{nombre: string, cantidad: float|null, unidad: string}|null
 */
function ingredienteAlGusto(string $nombre): ?array
{
    $nombre = limpiarNombreIngrediente($nombre);

    if ($nombre === '') {
        return null;
    }

    return ['nombre' => mb_substr($nombre, 0, 150), 'cantidad' => null, 'unidad' => 'al_gusto'];
}

/**
 * Crea un ingrediente con cantidad y unidad.
 *
 * @return array{nombre: string, cantidad: float|null, unidad: string}
 */
function ingredienteConMedida(string $nombre, float $cantidad, string $tokenOriginal, string $resto): array
{
    $estandar = unidadesEstandar();
    $discretas = unidadesDiscretas();
    $noEstandar = unidadesNoEstandar();

    $token = mb_strtolower(trim($tokenOriginal, " .,;:"));
    $nombre = limpiarNombreIngrediente($nombre);
    $resto = limpiarEspacios($resto);

    if ($cantidad <= 0) {
        $alGusto = ingredienteAlGusto(trim($nombre . ' ' . $tokenOriginal . ' ' . $resto));

        return $alGusto ?? ['nombre' => mb_substr($nombre, 0, 150), 'cantidad' => null, 'unidad' => 'al_gusto'];
    }

    // "2 pzs. dientes de ajo": el sustantivo tras "pza" es la unidad real.
    if (($estandar[$token] ?? '') === 'pza' && $nombre !== '') {
        $partesNombre = preg_split('/\s+/u', $nombre) ?: [];

        if ($partesNombre !== [] && in_array(mb_strtolower(rtrim($partesNombre[0], '.,')), $discretas, true)) {
            $token = mb_strtolower(rtrim(array_shift($partesNombre), '.,'));
            $nombre = implode(' ', $partesNombre);
        }
    }

    if (($estandar[$token] ?? '') === 'pza' && $resto !== '') {
        $partes = preg_split('/\s+/u', $resto) ?: [];

        if ($partes !== [] && in_array(mb_strtolower(rtrim($partes[0], '.,')), $discretas, true)) {
            $token = mb_strtolower(rtrim(array_shift($partes), '.,'));
            $resto = implode(' ', $partes);
        }
    }

    // Al quitar "dientes", "hojas"… puede quedar un "de" inicial.
    $nombre = limpiarNombreIngrediente($nombre);

    if (isset($estandar[$token])) {
        $final = $nombre !== '' ? $nombre : limpiarNombreIngrediente($resto);
        $final = $final === '' ? limpiarNombreIngrediente($tokenOriginal . ' ' . $resto) : $final;

        return [
            'nombre' => mb_substr($final, 0, 150),
            'cantidad' => $cantidad,
            'unidad' => $estandar[$token],
        ];
    }

    if (in_array($token, $discretas, true)) {
        $final = $nombre !== '' ? $nombre : limpiarNombreIngrediente($resto);
        $final = $final === '' ? limpiarNombreIngrediente($tokenOriginal . ' ' . $resto) : $final;

        return [
            'nombre' => mb_substr($final, 0, 150),
            'cantidad' => $cantidad,
            'unidad' => 'pza',
        ];
    }

    if (in_array($token, $noEstandar, true)) {
        $final = $nombre !== '' ? $nombre : limpiarNombreIngrediente($resto);
        $final = $final === '' ? limpiarNombreIngrediente($tokenOriginal . ' ' . $resto) : $final;
        $medida = formatearCantidad($cantidad) . ' ' . trim($tokenOriginal);

        return [
            'nombre' => mb_substr($final . ' (' . $medida . ')', 0, 150),
            'cantidad' => null,
            'unidad' => 'al_gusto',
        ];
    }

    // La primera palabra no es una unidad: forma parte del nombre ("2 cebollas blancas").
    $final = $nombre !== '' ? $nombre : limpiarNombreIngrediente(trim($tokenOriginal . ' ' . $resto));
    $final = $final === '' ? limpiarNombreIngrediente($tokenOriginal . ' ' . $resto) : $final;

    return [
        'nombre' => mb_substr($final, 0, 150),
        'cantidad' => $cantidad,
        'unidad' => 'pza',
    ];
}

/**
 * Convierte una línea de ingrediente al formato de la app.
 *
 * @return array{nombre: string, cantidad: float|null, unidad: string}|null
 */
function parsearIngrediente(string $linea): ?array
{
    $original = normalizarLinea($linea);

    if ($original === '' || esEncabezadoIngredientes($original)) {
        return null;
    }

    // Formato "Nombre: 100 G" / "Canela: al gusto".
    if (preg_match('/^([^:\d]+?)\s*:\s*(.+)$/u', $original, $m) === 1) {
        $nombre = $m[1];
        $medida = limpiarEspacios($m[2]);

        if (preg_match('/^(al gusto|c\/s|opcional|suficiente)\.?$/iu', $medida) === 1) {
            return ingredienteAlGusto($nombre);
        }

        if (preg_match('/^(\d+(?:\.\d+)?)\s*([^\s]+)?\s*(.*)$/u', $medida, $mm) === 1) {
            return ingredienteConMedida(
                $nombre,
                (float) $mm[1],
                (string) ($mm[2] ?? ''),
                (string) ($mm[3] ?? '')
            );
        }

        return ingredienteAlGusto(trim($nombre . ' ' . $medida));
    }

    // Formato "100 G de nombre".
    if (preg_match('/^(\d+(?:\.\d+)?)\s*(.*)$/u', $original, $m) === 1) {
        $cantidad = (float) $m[1];
        $resto = limpiarEspacios($m[2]);

        if ($resto === '' || $cantidad <= 0) {
            return null;
        }

        $partes = preg_split('/\s+/u', $resto) ?: [];
        $primerToken = (string) array_shift($partes);
        $nombre = implode(' ', $partes);
        $token = mb_strtolower(rtrim($primerToken, '.,;:'));

        // "1 hoja santa" es una hierba, no una hoja de "santa".
        if (in_array($token, ['hoja', 'hojas'], true)
            && preg_match('/^santa\b/iu', $nombre) === 1
        ) {
            return ingredienteConMedida($resto, $cantidad, '', '');
        }

        $esUnidad = isset(unidadesEstandar()[$token])
            || in_array($token, unidadesDiscretas(), true)
            || in_array($token, unidadesNoEstandar(), true);

        if (!$esUnidad) {
            // "2 cebollas blancas": la palabra es parte del nombre.
            return ingredienteConMedida($resto, $cantidad, '', '');
        }

        return ingredienteConMedida($nombre, $cantidad, $primerToken, '');
    }

    // Formato "Nombre 4 Unidades".
    if (preg_match('/^(.+?)\s+(\d+(?:\.\d+)?)\s*([^\s]+)?$/u', $original, $m) === 1) {
        $token = (string) ($m[3] ?? '');
        $tokenNormalizado = mb_strtolower(rtrim($token, '.,;:'));

        if (
            isset(unidadesEstandar()[$tokenNormalizado])
            || in_array($tokenNormalizado, unidadesDiscretas(), true)
            || in_array($tokenNormalizado, unidadesNoEstandar(), true)
        ) {
            return ingredienteConMedida($m[1], (float) $m[2], $token, '');
        }
    }

    return ingredienteAlGusto($original);
}

/**
 * Extrae ingredientes del bloque correspondiente.
 *
 * @return array<int, array{nombre: string, cantidad: float|null, unidad: string}>
 */
function extraerIngredientes(DOMXPath $xp): array
{
    $bloque = bloqueIngredientes($xp);

    if ($bloque === null) {
        return [];
    }

    $texto = textoConSaltos($bloque);
    $lineas = preg_split('/\R/u', $texto) ?: [];
    $ingredientes = [];

    foreach ($lineas as $linea) {
        $ingrediente = parsearIngrediente($linea);

        if ($ingrediente !== null) {
            $ingredientes[] = $ingrediente;
        }
    }

    return $ingredientes;
}

/**
 * Extrae los pasos de preparación.
 *
 * @return array<int, string>
 */
function extraerPasos(DOMXPath $xp): array
{
    $pasos = [];
    $contenedores = $xp->query('//*[contains(concat(" ", normalize-space(@class), " "), " text-procedimiento ")]');

    foreach ($contenedores as $contenedor) {
        $nodos = $xp->query('.//li', $contenedor);

        if ($nodos->length === 0) {
            $nodos = $xp->query('.//p', $contenedor);
        }

        if ($nodos->length > 0) {
            foreach ($nodos as $nodo) {
                $paso = limpiarEspacios($nodo->textContent);

                if ($paso !== '' && mb_strlen($paso) >= 4) {
                    $pasos[] = mb_substr($paso, 0, 1000);
                }
            }

            continue;
        }

        // Algunas fichas escriben el procedimiento como texto plano con <br>.
        $texto = textoConSaltos($contenedor);
        $lineas = preg_split('/\R/u', $texto) ?: [];

        foreach ($lineas as $linea) {
            $linea = (string) preg_replace('/^[\-–—•*·]+\s*/u', '', limpiarEspacios($linea));
            $normalizada = NormalizadorService::normalizar($linea);

            if ($linea === '' || mb_strlen($linea) < 4) {
                continue;
            }

            if (preg_match('/^(recetas?\b|preparacion\b|ingredientes\b|utensilios\b)/u', $normalizada) === 1) {
                continue;
            }

            $pasos[] = mb_substr($linea, 0, 1000);
        }
    }

    return array_values(array_unique($pasos));
}

/**
 * Extrae los metadatos del encabezado de la receta.
 *
 * @return array{porciones: int, tiempo: int, picante: int|null}
 */
function extraerMeta(DOMXPath $xp, string $titulo): array
{
    $texto = limpiarEspacios($xp->query('//body')->item(0)?->textContent ?? '');
    $posTitulo = $texto === '' ? false : mb_strpos($texto, $titulo);

    if ($posTitulo !== false) {
        $posIngredientes = mb_strpos($texto, 'Ingredientes', $posTitulo);
        $segmento = $posIngredientes !== false && $posIngredientes > $posTitulo
            ? mb_substr($texto, $posTitulo, $posIngredientes - $posTitulo)
            : mb_substr($texto, $posTitulo, 3000);
    } else {
        $segmento = mb_substr($texto, 0, 3000);
    }

    $porciones = 4;

    if (preg_match('/(\d{1,2})\s*porciones?/iu', $segmento, $m) === 1) {
        $porciones = (int) $m[1];
    }

    $porciones = max(1, min(50, $porciones));

    $picante = null;

    if (preg_match('/Picante\s*:\s*(\d)\s*de\s*5/iu', $segmento, $m) === 1) {
        $picante = max(0, min(5, (int) $m[1]));
    }

    $tiempo = 0;
    $vistos = [];

    // Horas con minutos opcionales.
    $patronHoras = '/(\d+)\s*(?:h|hrs?|horas?)\b\.?\s*(\d+)?\s*(?:min(?:utos?)?)?/iu';

    if (preg_match_all($patronHoras, $segmento, $coincidencias, PREG_SET_ORDER) !== false) {
        foreach ($coincidencias as $coincidencia) {
            $clave = mb_strtolower($coincidencia[0]);

            if (isset($vistos[$clave])) {
                continue;
            }

            $vistos[$clave] = true;
            $tiempo += ((int) $coincidencia[1]) * 60 + (int) ($coincidencia[2] ?? 0);
        }
    }

    $segmentoSinHoras = (string) preg_replace($patronHoras, ' ', $segmento);

    if (preg_match_all('/(\d+)\s*min(?:utos?)?/iu', $segmentoSinHoras, $coincidencias, PREG_SET_ORDER) !== false) {
        foreach ($coincidencias as $coincidencia) {
            $clave = mb_strtolower($coincidencia[0]);

            if (isset($vistos[$clave])) {
                continue;
            }

            $vistos[$clave] = true;
            $tiempo += (int) $coincidencia[1];
        }
    }

    $tiempo = $tiempo > 0 ? max(1, min(240, $tiempo)) : 30;

    return ['porciones' => $porciones, 'tiempo' => $tiempo, 'picante' => $picante];
}

/**
 * Mapea categorías del sitio a las categorías de platillo de Misuper.
 *
 * @param array<int, string> $slugs
 */
function categoriaPlatillo(array $slugs, string $titulo): string
{
    $texto = NormalizadorService::normalizar($titulo);

    // Categorías del sitio que son concluyentes.
    $prioridad = [
        'recetas-de-postres-y-panaderia' => 'postres',
        'recetas-de-destilados' => 'bebidas',
        'recetas-de-sopas' => 'sopas',
        'recetas-de-sopas-y-guisos' => 'sopas',
        'recetas-de-desayunos' => 'desayunos',
    ];

    foreach ($prioridad as $slug => $categoria) {
        if (in_array($slug, $slugs, true)) {
            return $categoria;
        }
    }

    // El título pesa más que las categorías amplias de carnes/pescados:
    // hay postres etiquetados como "recetas de carnes".
    $reglas = [
        'postres' => '/\b(postre|pastel|tarta|flan|jericalla|gelatina|galleta|dulce|cajeta|helado|sorbete|mermelada|panque|pay|brownie|churro|natilla|ate|arroz con leche|cocada)\b/u',
        'desayunos' => '/\b(huevo|huevos|chilaquiles|hotcake|panqueque|avena|mollete|omelette|revuelto|rancheros|divorciados|pan frances|waffle)\b/u',
        'pastas' => '/\b(pasta|espagueti|spaghetti|macarron|macarrones|fideo|fideos|lasana|ravioli|tallarines)\b/u',
        'antojitos' => '/\b(tacos?|tostadas?|sopecitos?|sopes?|quesadillas?|enchiladas?|gorditas?|tlacoyos?|tamales?|empanadas?|flautas?|burritos?|tortas?|sandwich|chalupas?|chalupitas?|elotes?|esquites)\b/u',
        'ensaladas' => '/\b(ensalada|ceviche)\b/u',
        'guisados' => '/\b(mole|pipian|tinga|adobo|guisado|entomatado|borracho|cochinita|barbacoa|carne en su jugo)\b/u',
        'sopas' => '/^(sopa|caldo|consome|pozole|menudo|birria|crema)\b/u',
        'bebidas' => '/^(agua|licuado|smoothie|jugos?|batido|atole|chocolate|cafe|te|infusion|horchata|ponche|coctel|margarita|mezcal|tequila|sangria|refresco|limonada|naranjada|jamaica|maracuya|sandia|tamarindo)\b/u',
        'complementos' => '/^(salsa|guacamole|hummus|dip|aderezo|guarnicion|arroz|frijoles|pure|pico de gallo)\b/u',
    ];

    foreach ($reglas as $categoria => $patron) {
        if (preg_match($patron, $texto) === 1) {
            return $categoria;
        }
    }

    if (in_array('recetas-de-carnes', $slugs, true)
        || in_array('recetas-de-pescados-y-mariscos', $slugs, true)
    ) {
        return 'platos-fuertes';
    }

    if (in_array('recetas-de-entrantes', $slugs, true)) {
        return 'antojitos';
    }

    return 'platos-fuertes';
}

/**
 * Detecta los tipos de dieta aplicables a partir de la categoría y los
 * ingredientes. Es una sugerencia: la receta queda en borrador para revisión.
 *
 * @param array<int, string> $slugs
 * @param array<int, array{nombre: string, cantidad: float|null, unidad: string}> $ingredientes
 * @return array<int, string>
 */
function tiposDieta(array $slugs, array $ingredientes, string $titulo = ''): array
{
    $tipos = ['general'];
    $texto = NormalizadorService::normalizar(trim($titulo . ' ' . implode(' ', array_map(
        static fn (array $ingrediente): string => (string) $ingrediente['nombre'],
        $ingredientes
    ))));

    $carne = '/\b(?:res|reses|cerdos?|pollos?|pavos?|corderos?|terneras?|carnes?|jamon(?:es)?|bacon|tocinos?|chorizos?|salchichas?|longanizas?|morcillas?|pescados?|atun(?:es)?|salmon(?:es)?|camaron(?:es)?|mariscos?|pulpos?|calamar(?:es)?|mejillon(?:es)?|almejas?|cangrejos?|patos?|conejos?|higados?|molidas?|bisteces?|costillas?|lomos?|pechugas?|muslos?|chuletas?|embutidos?|anchoas?|sardinas?|bacalaos?|truchas?|corvinas?|robalos?|tilapias?|jaibas?|langostas?|ostion(?:es)?|langostinos?|gambas?|callos?|vieiras?|panceta|carnitas?|lubinas?|merluzas?|doradas?|besugos?|rodaballos?|congrios?|meros?|lenguados?|bonitos?|jureles?|huachinangos?|pargos?|cazones?)\b/u';

    if (preg_match($carne, $texto) !== 1) {
        $tipos[] = 'vegetariano';
    }

    $gluten = '/\b(?:trigos?|cebadas?|centenos?|salvados?|seitan|cuscus|bulgur|pan(?:es)?|bolillos?|baguettes?|espaguetis?|spaghetti|fideos?|lasanas?|raviolis?|tallarin(?:es)?|galletas?|cervezas?|panko|empanizados?|empanizar|bizcochos?|pasteles?|pay(?:es)?|hojaldres?|semolas?|ramen|waffles?|crepes?|tortillas?\s+de\s+harina)\b/u';
    $harinaConGluten = '/\bharina\b(?!\s+de\s+(?:maiz|arroz|almendra|coco|garbanzo|frijol|avena))/u';

    $tieneGluten = preg_match($gluten, $texto) === 1
        || preg_match($harinaConGluten, $texto) === 1
        || preg_match('/\bpasta\s+(?:para sopa|seca|fresca|de trigo)\b/u', $texto) === 1
        || preg_match('/\bpan\s+(?:molido|de caja|integral|blanco)\b/u', $texto) === 1
        || preg_match('/\btortillas?\s+de\s+harina\b/u', $texto) === 1;

    if (!$tieneGluten) {
        $tipos[] = 'sin_gluten';
    }

    return array_values(array_unique($tipos));
}

/**
 * Indica si un ingrediente es básico de despensa.
 */
function esBasico(string $nombre): bool
{
    $texto = NormalizadorService::normalizar($nombre);

    return preg_match(
        '/\b(sal|pimienta|agua|aceite|azucar|vinagre|comino|oregano|laurel|canela|clavo|especia|especias|colorante|bicarbonato|levadura|consome|caldo en cubo)\b/u',
        $texto
    ) === 1;
}

/**
 * Convierte los ingredientes extraídos al formato completo de la app.
 *
 * @param array<int, array{nombre: string, cantidad: float|null, unidad: string}> $ingredientes
 * @return array<int, array{nombre: string, producto: null, cantidad: float|null, unidad: string, principal: bool, basico: bool}>
 */
function prepararIngredientes(array $ingredientes): array
{
    $resultado = [];
    $principales = 0;

    foreach ($ingredientes as $ingrediente) {
        $nombre = limpiarEspacios($ingrediente['nombre']);
        $basico = esBasico($nombre);
        $principal = false;

        if (!$basico && $principales < 3) {
            $principal = true;
            $principales++;
        }

        $resultado[] = [
            'nombre' => mb_substr($nombre, 0, 150),
            'producto' => null,
            'cantidad' => $ingrediente['cantidad'],
            'unidad' => $ingrediente['unidad'],
            'principal' => $principal,
            'basico' => $basico,
        ];
    }

    return $resultado;
}

/**
 * Construye la descripción de una receta importada.
 */
function descripcionReceta(?int $picante): string
{
    $descripcion = 'Receta de referencia de la Fundación Casa de México en España.';

    if ($picante !== null) {
        $descripcion .= ' Picante: ' . $picante . ' de 5.';
    }

    return $descripcion;
}

/**
 * Extrae una receta completa desde su HTML.
 *
 * @param array<int, string> $categoriasSitio
 * @return array<string, mixed>
 */
function extraerReceta(
    string $html,
    string $link,
    string $slug,
    string $tituloApi,
    array $categoriasSitio
): array {
    [$dom, $xp] = cargarDom($html);

    $h1 = $xp->query('//h1')->item(0);
    $titulo = $h1 instanceof DOMNode ? textoPlano($h1) : $tituloApi;
    $titulo = $titulo === '' ? $tituloApi : $titulo;

    $ingredientes = extraerIngredientes($xp);

    if ($ingredientes === []) {
        throw new RuntimeException('No se encontraron ingredientes.');
    }

    $pasos = extraerPasos($xp);

    if ($pasos === []) {
        throw new RuntimeException('No se encontraron pasos de preparación.');
    }

    $meta = extraerMeta($xp, $titulo);
    $slugs = array_values(array_filter(array_map('strval', $categoriasSitio)));
    $categoria = categoriaPlatillo($slugs, $titulo);
    $tipos = tiposDieta($slugs, $ingredientes, $titulo);
    $dificultad = 'facil';

    if (count($pasos) >= 10 || $meta['tiempo'] >= 90) {
        $dificultad = 'media';
    }

    if (count($pasos) >= 16 || $meta['tiempo'] >= 150) {
        $dificultad = 'dificil';
    }

    return [
        'nombre' => mb_substr($titulo, 0, 150),
        'descripcion' => descripcionReceta($meta['picante']),
        'porciones_base' => $meta['porciones'],
        'tiempo_min' => $meta['tiempo'],
        'dificultad' => $dificultad,
        'categoria' => $categoria,
        'tipos' => $tipos,
        'ingredientes' => prepararIngredientes($ingredientes),
        'pasos' => $pasos,
        'imagen_url' => imagenPrincipal($xp, $html, $slug),
        'fuente_nombre' => FUENTE_NOMBRE,
        'fuente_url' => $link,
        'fuente_autor' => autorOriginal($xp),
        'estado' => 'borrador',
    ];
}

/**
 * Listado completo de recetas desde la API REST.
 *
 * @return array<int, array{id: int, slug: string, link: string, title: string, categories: array<int, int>}>
 */
function listarRecetas(): array
{
    $recetas = [];
    $pagina = 1;

    while (true) {
        $url = FUENTE_BASE . '/wp-json/wp/v2/receta?per_page=100&page=' . $pagina
            . '&_fields=id,slug,link,title,categories';
        $data = descargarJson($url);

        if ($data === null || $data === []) {
            break;
        }

        foreach ($data as $fila) {
            if (!is_array($fila)) {
                continue;
            }

            $link = (string) ($fila['link'] ?? '');
            $slug = (string) ($fila['slug'] ?? '');
            $titulo = (string) ($fila['title']['rendered'] ?? '');

            if ($link === '' || $slug === '') {
                continue;
            }

            $recetas[] = [
                'id' => (int) ($fila['id'] ?? 0),
                'slug' => $slug,
                'link' => $link,
                'title' => html_entity_decode($titulo, ENT_QUOTES | ENT_HTML5, 'UTF-8'),
                'categories' => array_map('intval', is_array($fila['categories'] ?? null) ? $fila['categories'] : []),
            ];
        }

        if (count($data) < 100) {
            break;
        }

        $pagina++;
        usleep(150000);
    }

    return $recetas;
}

/**
 * Mapa de categorías del sitio: id => slug.
 *
 * @return array<int, string>
 */
function categoriasSitio(): array
{
    $data = descargarJson(FUENTE_BASE . '/wp-json/wp/v2/categories?per_page=100&_fields=id,slug');
    $mapa = [];

    if ($data === null) {
        return $mapa;
    }

    foreach ($data as $fila) {
        if (is_array($fila)) {
            $mapa[(int) ($fila['id'] ?? 0)] = (string) ($fila['slug'] ?? '');
        }
    }

    return $mapa;
}

/* --------------------------------------------------------------------- */
/* Ejecución                                                             */
/* --------------------------------------------------------------------- */

try {
    $pdo = App\Support\Database::connection();
} catch (Throwable $error) {
    abortar('No se pudo conectar a MySQL: ' . $error->getMessage());
}

$servicio = new RecetaService();
$repositorio = new RecetaRepository($pdo);

echo "Consultando el listado de recetas…\n";
$catalogo = listarRecetas();

if ($catalogo === []) {
    abortar('No se pudo obtener el listado de recetas.');
}

echo 'Recetas en la fuente: ' . count($catalogo) . "\n";

$mapaCategorias = categoriasSitio();

if ($mapaCategorias === []) {
    abortar('No se pudieron obtener las categorías del sitio.');
}

$pendientes = [];

foreach ($catalogo as $fila) {
    $existente = $repositorio->findByFuenteUrl($fila['link']);

    if ($existente !== null && !$refrescar) {
        continue;
    }

    $fila['existente_id'] = $existente === null ? null : (int) $existente['id'];
    $pendientes[] = $fila;
}

if ($limite > 0) {
    $pendientes = array_slice($pendientes, 0, $limite);
}

echo 'Pendientes de procesar: ' . count($pendientes) . ($dryRun ? ' (dry-run)' : '') . "\n\n";

if ($pendientes === []) {
    echo "No hay recetas nuevas que importar.\n";
    exit(0);
}

$importadas = 0;
$actualizadas = 0;
$omitidas = 0;
$errores = [];
$total = count($pendientes);
$procesadas = 0;

foreach (array_chunk($pendientes, LOTE_DESCARGA) as $lote) {
    $urls = array_map(static fn (array $fila): string => $fila['link'], $lote);
    $htmls = descargarVarias($urls);

    foreach ($lote as $indice => $fila) {
        $procesadas++;
        $html = $htmls[$indice] ?? null;

        if ($html === null) {
            $html = descargar($fila['link']);
        }

        $etiqueta = '[' . $procesadas . '/' . $total . '] ' . $fila['title'];

        if ($html === null) {
            $omitidas++;
            $errores[] = $etiqueta . ': no se pudo descargar la ficha.';
            echo '✗ ' . $etiqueta . " (descarga)\n";

            continue;
        }

        try {
            $tiposCategoria = [];

            foreach ($fila['categories'] as $categoriaId) {
                $slugCategoria = $mapaCategorias[$categoriaId] ?? '';

                if ($slugCategoria !== '') {
                    $tiposCategoria[] = $slugCategoria;
                }
            }

            $data = extraerReceta(
                $html,
                $fila['link'],
                $fila['slug'],
                $fila['title'],
                $tiposCategoria
            );

            $resumen = sprintf(
                '%s · %s · %d ing. · %d pasos · %d min',
                $data['categoria'],
                implode(', ', $data['tipos']),
                count($data['ingredientes']),
                count($data['pasos']),
                $data['tiempo_min']
            );

            if ($dryRun) {
                echo '· ' . $etiqueta . ' → ' . $resumen . "\n";

                continue;
            }

            if ($fila['existente_id'] !== null) {
                $actualizada = $servicio->actualizarReferencia($fila['existente_id'], $data);

                if ($actualizada === null) {
                    throw new RuntimeException('No se pudo actualizar la receta existente.');
                }

                $actualizadas++;
                echo '↻ ' . $etiqueta . ' → ' . $resumen . "\n";
            } else {
                $servicio->crearReferencia($data);
                $importadas++;
                echo '✓ ' . $etiqueta . ' → ' . $resumen . "\n";
            }
        } catch (Throwable $error) {
            $omitidas++;
            $errores[] = $etiqueta . ': ' . $error->getMessage();
            echo '✗ ' . $etiqueta . ' → ' . $error->getMessage() . "\n";
        }
    }

    usleep(120000);
}

echo "\n" . str_repeat('-', 60) . "\n";
echo 'Importadas: ' . $importadas . "\n";
echo 'Actualizadas: ' . $actualizadas . "\n";
echo 'Omitidas: ' . $omitidas . "\n";

if ($errores !== []) {
    echo "\nIncidencias:\n";

    foreach (array_slice($errores, 0, 30) as $error) {
        echo '  · ' . $error . "\n";
    }

    if (count($errores) > 30) {
        echo '  · … y ' . (count($errores) - 30) . " más.\n";
    }
}

echo "\nListo.\n";
