<?php

declare(strict_types=1);

namespace App\Services;

/**
 * Conversión entre las unidades base de la app.
 *
 * Solo convierte magnitudes compatibles: masa (kg/gr) y volumen (L/ml).
 * Piezas no se convierten a peso ni a volumen.
 */
final class UnidadService
{
    public const UNIDADES = ['kg', 'gr', 'L', 'ml', 'pza'];

    public static function normalizar(string $unidad): string
    {
        return match (mb_strtolower(trim($unidad), 'UTF-8')) {
            'kg', 'kgs', 'kilogramo', 'kilogramos' => 'kg',
            'g', 'gr', 'grs', 'gramo', 'gramos' => 'gr',
            'l', 'lt', 'lts', 'litro', 'litros' => 'L',
            'ml', 'mililitro', 'mililitros' => 'ml',
            'pza', 'pzas', 'pieza', 'piezas', 'unidad', 'unidades' => 'pza',
            default => trim($unidad),
        };
    }

    public static function convertir(float $cantidad, string $origen, string $destino): ?float
    {
        $origen = self::normalizar($origen);
        $destino = self::normalizar($destino);

        if ($origen === $destino) {
            return round($cantidad, 4);
        }

        if ($origen === 'gr' && $destino === 'kg') {
            return round($cantidad / 1000, 4);
        }

        if ($origen === 'kg' && $destino === 'gr') {
            return round($cantidad * 1000, 4);
        }

        if ($origen === 'ml' && $destino === 'L') {
            return round($cantidad / 1000, 4);
        }

        if ($origen === 'L' && $destino === 'ml') {
            return round($cantidad * 1000, 4);
        }

        return null;
    }

    /**
     * Convierte un precio por unidad de una unidad a otra.
     *
     * Ejemplo: $0.05 por gramo → $50.00 por kilogramo.
     */
    public static function convertirPrecio(float $precio, string $origen, string $destino): ?float
    {
        $origen = self::normalizar($origen);
        $destino = self::normalizar($destino);

        if ($origen === $destino) {
            return round($precio, 4);
        }

        $factor = self::convertir(1.0, $destino, $origen);

        return $factor === null ? null : round($precio * $factor, 4);
    }

    public static function compatible(string $origen, string $destino): bool
    {
        return self::convertir(1.0, $origen, $destino) !== null;
    }

    public static function etiqueta(string $unidad): string
    {
        return match (self::normalizar($unidad)) {
            'kg' => 'kg',
            'gr' => 'gr',
            'L' => 'L',
            'ml' => 'ml',
            'pza' => 'pza',
            default => $unidad,
        };
    }
}
