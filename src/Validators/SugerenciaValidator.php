<?php

declare(strict_types=1);

namespace App\Validators;

/**
 * Validación server-side de sugerencias.
 *
 * El alta solo recibe el nombre libre. La aprobación recibe los datos con
 * los que se creará el producto en el catálogo.
 */
final class SugerenciaValidator
{
    private const UNIDADES = ['kg', 'gr', 'L', 'ml', 'pza'];

    /**
     * @param array<string, mixed> $data
     * @return array<string, string> Errores por campo (vacío si todo es válido).
     */
    public static function crear(array $data): array
    {
        $errors = [];
        $nombre = $data['nombre'] ?? null;

        if (!is_string($nombre)) {
            $errors['nombre'] = 'El nombre es obligatorio.';

            return $errors;
        }

        $nombre = trim($nombre);

        if (mb_strlen($nombre, 'UTF-8') < 2) {
            $errors['nombre'] = 'El nombre debe tener al menos 2 caracteres.';
        } elseif (mb_strlen($nombre, 'UTF-8') > 150) {
            $errors['nombre'] = 'El nombre debe tener como máximo 150 caracteres.';
        }

        return $errors;
    }

    /**
     * @param array<string, mixed> $data
     * @return array<string, string>
     */
    public static function aprobar(array $data): array
    {
        $errors = [];

        $categoriaId = $data['categoria_id'] ?? null;

        if (!self::enteroPositivo($categoriaId)) {
            $errors['categoria_id'] = 'La categoría es obligatoria.';
        }

        $unidad = $data['unidad_base'] ?? null;

        if (!is_string($unidad) || !in_array($unidad, self::UNIDADES, true)) {
            $errors['unidad_base'] = 'La unidad base debe ser kg, gr, L, ml o pza.';
        }

        $imagen = $data['imagen_url'] ?? null;

        if ($imagen !== null && $imagen !== '') {
            if (!is_string($imagen)) {
                $errors['imagen_url'] = 'La imagen debe ser una URL válida.';
            } elseif (mb_strlen(trim($imagen), 'UTF-8') > 500) {
                $errors['imagen_url'] = 'La imagen debe tener como máximo 500 caracteres.';
            } elseif (!self::urlHttp(trim($imagen))) {
                $errors['imagen_url'] = 'La imagen debe ser una URL http o https válida.';
            }
        }

        return $errors;
    }

    private static function enteroPositivo(mixed $valor): bool
    {
        if (is_int($valor)) {
            return $valor > 0;
        }

        if (!is_string($valor) || $valor === '' || !ctype_digit($valor)) {
            return false;
        }

        return (int) $valor > 0;
    }

    private static function urlHttp(string $url): bool
    {
        if (filter_var($url, FILTER_VALIDATE_URL) === false) {
            return false;
        }

        $scheme = strtolower((string) parse_url($url, PHP_URL_SCHEME));

        return in_array($scheme, ['http', 'https'], true)
            && (string) parse_url($url, PHP_URL_HOST) !== '';
    }
}
