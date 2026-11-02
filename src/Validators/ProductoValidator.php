<?php

declare(strict_types=1);

namespace App\Validators;

/**
 * Validación server-side del catálogo de productos.
 *
 * En creación todos los campos obligatorios están presentes. En edición
 * solo se validan los campos enviados (todos opcionales).
 */
final class ProductoValidator
{
    private const UNIDADES = ['kg', 'gr', 'L', 'ml', 'pza'];

    /**
     * @param array<string, mixed> $data
     * @return array<string, string> Errores por campo (vacío si todo es válido).
     */
    public static function crear(array $data): array
    {
        return self::validar($data, true);
    }

    /**
     * @param array<string, mixed> $data
     * @return array<string, string>
     */
    public static function actualizar(array $data): array
    {
        return self::validar($data, false);
    }

    /**
     * @param array<string, mixed> $data
     * @return array<string, string>
     */
    private static function validar(array $data, bool $esCreacion): array
    {
        if (!$esCreacion) {
            $campos = ['nombre', 'categoria_id', 'unidad_base', 'imagen_url'];
            $presentes = array_filter(
                $campos,
                static fn (string $campo): bool => array_key_exists($campo, $data)
            );

            if ($presentes === []) {
                return ['_general' => 'No hay nada que actualizar.'];
            }
        }

        $errors = [];

        if ($esCreacion || array_key_exists('nombre', $data)) {
            $nombre = $data['nombre'] ?? null;

            if (!is_string($nombre) || mb_strlen(trim($nombre)) < 2) {
                $errors['nombre'] = 'El nombre debe tener al menos 2 caracteres.';
            } elseif (mb_strlen(trim($nombre)) > 150) {
                $errors['nombre'] = 'El nombre debe tener como máximo 150 caracteres.';
            }
        }

        if ($esCreacion || array_key_exists('categoria_id', $data)) {
            $categoriaId = $data['categoria_id'] ?? null;

            if (!self::enteroPositivo($categoriaId)) {
                $errors['categoria_id'] = 'La categoría es obligatoria.';
            }
        }

        if ($esCreacion || array_key_exists('unidad_base', $data)) {
            $unidad = $data['unidad_base'] ?? null;

            if (!is_string($unidad) || !in_array($unidad, self::UNIDADES, true)) {
                $errors['unidad_base'] = 'La unidad base debe ser kg, gr, L, ml o pza.';
            }
        }

        if (array_key_exists('imagen_url', $data)) {
            $imagen = $data['imagen_url'];

            if ($imagen !== null && $imagen !== '') {
                if (!is_string($imagen)) {
                    $errors['imagen_url'] = 'La imagen debe ser una URL válida.';
                } elseif (mb_strlen(trim($imagen)) > 500) {
                    $errors['imagen_url'] = 'La imagen debe tener como máximo 500 caracteres.';
                } elseif (!self::urlHttp(trim($imagen))) {
                    $errors['imagen_url'] = 'La imagen debe ser una URL http o https válida.';
                }
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
