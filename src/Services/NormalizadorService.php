<?php

declare(strict_types=1);

namespace App\Services;

/**
 * Normaliza texto para búsquedas: minúsculas y sin acentos.
 *
 * Se usa tanto para el término buscado como para construir patrones LIKE
 * seguros (escapando los comodines de SQL).
 */
final class NormalizadorService
{
    /**
     * Mapa de caracteres acentuados frecuentes en español a su forma sin acento.
     */
    private const ACENTOS = [
        'á' => 'a',
        'à' => 'a',
        'ä' => 'a',
        'â' => 'a',
        'ã' => 'a',
        'å' => 'a',
        'é' => 'e',
        'è' => 'e',
        'ë' => 'e',
        'ê' => 'e',
        'í' => 'i',
        'ì' => 'i',
        'ï' => 'i',
        'î' => 'i',
        'ó' => 'o',
        'ò' => 'o',
        'ö' => 'o',
        'ô' => 'o',
        'õ' => 'o',
        'ú' => 'u',
        'ù' => 'u',
        'ü' => 'u',
        'û' => 'u',
        'ñ' => 'n',
        'ç' => 'c',
    ];

    /**
     * Devuelve el texto en minúsculas, sin espacios en los extremos y sin acentos.
     */
    public static function normalizar(string $texto): string
    {
        $texto = trim($texto);
        $texto = mb_strtolower($texto, 'UTF-8');

        return strtr($texto, self::ACENTOS);
    }

    /**
     * Prepara un texto para usarlo dentro de un LIKE con ESCAPE '!'.
     */
    public static function patronLike(string $texto): string
    {
        return strtr(self::normalizar($texto), [
            '!' => '!!',
            '%' => '!%',
            '_' => '!_',
        ]);
    }

    /**
     * Palabras que no distinguen un ingrediente: conectores, cantidades,
     * formas de preparación y medidas caseras.
     */
    private const PALABRAS_IGNORADAS = [
        'a', 'al', 'aproximadamente', 'batir', 'caliente', 'cdas', 'cdta',
        'cdtas', 'cda', 'cocida', 'cocidas', 'cocido', 'cocidos', 'cocinar',
        'congelada', 'congelado', 'con', 'cs', 'cuadraditos', 'cucharada',
        'cucharadas', 'cucharadita', 'cucharaditas', 'de', 'decorar', 'del',
        'deshebrada', 'deshebradas', 'deshebrado', 'deshebrados', 'el',
        'en', 'encurtida', 'encurtidas', 'fileteada', 'fileteadas',
        'fileteado', 'fileteados', 'final', 'finamente', 'freir', 'fria',
        'frio', 'gramo', 'gramos', 'grande', 'grandes', 'gusto', 'juliana',
        'kilo', 'kilos', 'la', 'las', 'litro', 'litros', 'lunas', 'madura',
        'maduras', 'maduro', 'maduros', 'medias', 'mediana', 'medianas',
        'mediano', 'medianos', 'mililitro', 'mililitros', 'montar',
        'natural', 'necesaria', 'necesarias', 'necesario', 'necesarios',
        'o', 'olla', 'onza', 'onzas', 'opcional', 'para', 'pequena',
        'pequenas', 'pequeno', 'pequenos', 'picada', 'picadas', 'picado',
        'picados', 'pizca', 'pizcas', 'por', 'potable', 'pzca', 'rallada',
        'ralladas', 'rallado', 'rallados', 'rodajas', 'servir', 'sin',
        'sopera', 'suficiente', 'suficientes', 'taza', 'tazas', 'templada',
        'templado', 'tibia', 'tibio', 'tipo', 'tza', 'tzas', 'un', 'una',
        'unas', 'unos', 'y', 'ya', 'calibre',
    ];

    /**
     * Nombres regionales o variantes que apuntan al mismo ingrediente.
     */
    private const SINONIMOS = [
        'adobada' => 'adobo',
        'adobadas' => 'adobo',
        'adobado' => 'adobo',
        'adobados' => 'adobo',
        'agria' => 'acida',
        'agrias' => 'acida',
        'agrio' => 'acido',
        'agrios' => 'acido',
        'ajonjoli' => 'sesamo',
        'almidon' => 'maicena',
        'aove' => 'oliva',
        'avecrem' => 'consome',
        'bacon' => 'tocino',
        'betabel' => 'remolacha',
        'blanca' => 'estandar',
        'blancas' => 'estandar',
        'blanco' => 'estandar',
        'blancos' => 'estandar',
        'boniato' => 'camote',
        'cacahuete' => 'cacahuate',
        'cacahuetes' => 'cacahuate',
        'calabacin' => 'calabacita',
        'calabacines' => 'calabacita',
        'cambray' => 'cebolleta',
        'cbolla' => 'cebolla',
        'cebollita' => 'cebolleta',
        'cebollitas' => 'cebolleta',
        'corteza' => 'chicharron',
        'cortezas' => 'chicharron',
        'creme' => 'crema',
        'crotones' => 'crutones',
        'derretir' => 'gratinar',
        'estrellada' => 'estrella',
        'estrellado' => 'estrella',
        'fecula' => 'maicena',
        'frijores' => 'frijol',
        'glas' => 'glass',
        'gorda' => 'gruesa',
        'gordas' => 'gruesa',
        'guisante' => 'chicharo',
        'guisantes' => 'chicharo',
        'hierba' => 'hoja',
        'hongo' => 'champinon',
        'hongos' => 'champinon',
        'judia' => 'ejote',
        'judias' => 'ejote',
        'ketchup' => 'catsup',
        'knorr' => 'consome',
        'latina' => 'fresca',
        'latino' => 'fresco',
        'mayones' => 'mayonesa',
        'mazorca' => 'elote',
        'mazorcas' => 'elote',
        'mesa' => 'barra',
        'morena' => 'mascabado',
        'morenas' => 'mascabado',
        'moreno' => 'mascabado',
        'morenos' => 'mascabado',
        'nata' => 'crema',
        'oleico' => 'oliva',
        'panceta' => 'tocino',
        'pasita' => 'pasa',
        'pasitas' => 'pasa',
        'patata' => 'papa',
        'patatas' => 'papa',
        'ptatas' => 'papa',
        'quesillo' => 'oaxaca',
        'rabanito' => 'rabano',
        'rabanitos' => 'rabano',
        'royal' => 'quimica',
        'rubia' => 'clara',
        'saladita' => 'salada',
        'saladitas' => 'salada',
        'seta' => 'champinon',
        'setas' => 'champinon',
        'sirope' => 'miel',
        'soja' => 'soya',
        'suiza' => 'pollo',
        'ternera' => 'res',
        'tomatito' => 'jitomate',
        'tomatitos' => 'jitomate',
        'tomate' => 'jitomate',
        'tomates' => 'jitomate',
        'torrezno' => 'tocino',
        'torreznos' => 'tocino',
        'trigo' => 'harina',
        'worcestershire' => 'perrins',
        'zumo' => 'jugo',
        'zumos' => 'jugo',
    ];

    /**
     * Divide un nombre de producto o ingrediente en tokens significativos.
     *
     * Quita cantidades entre paréntesis, acentos, signos, conectores y
     * descriptores de preparación, y aplica sinónimos regionales.
     *
     * @return array<int, string>
     */
    public static function tokensNombre(string $texto): array
    {
        $texto = self::normalizar($texto);
        $texto = preg_replace('/\([^)]*\)/u', ' ', $texto) ?? '';
        $texto = preg_replace('/[^a-z0-9ñ]+/u', ' ', $texto) ?? '';
        $tokens = preg_split('/\s+/u', trim($texto)) ?: [];
        $limpios = [];

        foreach ($tokens as $token) {
            if ($token === '' || is_numeric($token) || mb_strlen($token) < 2) {
                continue;
            }

            $token = self::SINONIMOS[$token] ?? $token;

            if (in_array($token, self::PALABRAS_IGNORADAS, true)) {
                continue;
            }

            $limpios[$token] = true;
        }

        return array_keys($limpios);
    }

    /**
     * Compara dos nombres como listas de tokens. Uno puede contener al otro,
     * así que "crema agria" coincide con "crema ácida" y "chiles serranos"
     * con "chile serrano".
     *
     * @param array<int, string> $a
     * @param array<int, string> $b
     */
    public static function tokensCompatibles(array $a, array $b): bool
    {
        if ($a === [] || $b === []) {
            return false;
        }

        return self::tokensContenidos($a, $b) || self::tokensContenidos($b, $a);
    }

    /**
     * Compara dos nombres completos.
     */
    public static function nombresCompatibles(string $a, string $b): bool
    {
        return self::tokensCompatibles(self::tokensNombre($a), self::tokensNombre($b));
    }

    /**
     * @param array<int, string> $necesarios
     * @param array<int, string> $disponibles
     */
    private static function tokensContenidos(array $necesarios, array $disponibles): bool
    {
        foreach ($necesarios as $token) {
            $encontrado = false;

            foreach ($disponibles as $otro) {
                if (self::tokensEquivalentes($token, $otro)) {
                    $encontrado = true;
                    break;
                }
            }

            if (!$encontrado) {
                return false;
            }
        }

        return true;
    }

    /**
     * Equivalencia básica de singular/plural en español.
     */
    private static function tokensEquivalentes(string $a, string $b): bool
    {
        if ($a === $b) {
            return true;
        }

        foreach ([[$a, $b], [$b, $a]] as [$singular, $plural]) {
            if ($plural === $singular . 's' || $plural === $singular . 'es') {
                return true;
            }

            if (
                str_ends_with($plural, 'ces')
                && str_ends_with($singular, 'z')
                && substr($plural, 0, -3) === substr($singular, 0, -1)
            ) {
                return true;
            }
        }

        // Variación de género: mascabada/mascabado, serrana/serrano.
        // Solo cuando la única diferencia es la vocal final.
        if (
            mb_strlen($a) === mb_strlen($b)
            && mb_strlen($a) > 2
            && mb_substr($a, 0, -1) === mb_substr($b, 0, -1)
        ) {
            $finalA = mb_substr($a, -1);
            $finalB = mb_substr($b, -1);

            if (($finalA === 'a' && $finalB === 'o') || ($finalA === 'o' && $finalB === 'a')) {
                return true;
            }
        }

        return false;
    }
}
