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
     * Comparativa de gasto anual: el año solicitado y los tres anteriores.
     *
     * Devuelve el total de cada año (incluidos los que no tienen compras),
     * la variación porcentual contra el año inmediatamente anterior y el
     * promedio de los tres años previos.
     *
     * @return array{
     *     anio: int,
     *     total: float,
     *     anios: array<int, array{anio: int, total: float}>,
     *     anio_anterior: int,
     *     total_anterior: float,
     *     variacion_porcentual: float|null,
     *     promedio_anteriores: float|null
     * }
     */
    public function gastoAnual(int $usuarioId, int $anio): array
    {
        $desde = $anio - 3;
        $totales = $this->metricas->gastoAnual($usuarioId, $desde, $anio);
        $anios = [];

        for ($actual = $desde; $actual <= $anio; $actual++) {
            $anios[] = [
                'anio' => $actual,
                'total' => $totales[$actual] ?? 0.0,
            ];
        }

        $totalActual = $totales[$anio] ?? 0.0;
        $anioAnterior = $anio - 1;
        $totalAnterior = $totales[$anioAnterior] ?? 0.0;

        $variacion = null;

        if ($totalAnterior > 0) {
            $variacion = round((($totalActual - $totalAnterior) / $totalAnterior) * 100, 1);
        }

        $totalesAnteriores = [];

        for ($actual = $desde; $actual < $anio; $actual++) {
            $totalesAnteriores[] = $totales[$actual] ?? 0.0;
        }

        $promedio = null;

        if (array_sum($totalesAnteriores) > 0) {
            $promedio = round(array_sum($totalesAnteriores) / count($totalesAnteriores), 2);
        }

        return [
            'anio' => $anio,
            'total' => $totalActual,
            'anios' => $anios,
            'anio_anterior' => $anioAnterior,
            'total_anterior' => $totalAnterior,
            'variacion_porcentual' => $variacion,
            'promedio_anteriores' => $promedio,
        ];
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
