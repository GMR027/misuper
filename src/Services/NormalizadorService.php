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
}
