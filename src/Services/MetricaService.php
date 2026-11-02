<?php

declare(strict_types=1);

namespace App\Services;

use App\Repositories\MetricaRepository;

/**
 * Reglas de negocio de las métricas personales.
 *
 * Los cálculos se hacen en tiempo real sobre compras y compra_items.
 */
final class MetricaService
{
    public const ANIO_MINIMO = 2000;

    public const ANIO_MAXIMO = 2100;

    private readonly MetricaRepository $metricas;

    public function __construct(?MetricaRepository $metricas = null)
    {
        $this->metricas = $metricas ?? new MetricaRepository();
    }

    /**
     * Convierte el parámetro anio a entero válido (2000-2100).
     */
    public static function anioValido(mixed $valor): ?int
    {
        if (!is_string($valor) || $valor === '' || !ctype_digit($valor)) {
            return null;
        }

        $anio = (int) $valor;

        if ($anio < self::ANIO_MINIMO || $anio > self::ANIO_MAXIMO) {
            return null;
        }

        return $anio;
    }

    /**
     * Convierte el parámetro mes a entero válido (1-12).
     */
    public static function mesValido(mixed $valor): ?int
    {
        if (!is_string($valor) || $valor === '' || !ctype_digit($valor)) {
            return null;
        }

        $mes = (int) $valor;

        if ($mes < 1 || $mes > 12) {
            return null;
        }

        return $mes;
    }

    /**
     * @return array<int, array{mes: int, total: float}>
     */
    public function gastoMensual(int $usuarioId, int $anio): array
    {
        return $this->metricas->gastoMensual($usuarioId, $anio);
    }

    /**
     * @return array<int, array{
     *     producto_id: int|null,
     *     nombre: string,
     *     imagen_url: string|null,
     *     gasto: float,
     *     cantidad_total: float
     * }>
     */
    public function topProductos(int $usuarioId, int $mes, int $anio): array
    {
        return $this->metricas->topProductos($usuarioId, $mes, $anio);
    }
}
