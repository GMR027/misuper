<?php

declare(strict_types=1);

namespace App\Services;

use App\Repositories\ProductoRepository;

/**
 * Cálculo orientativo de calorías por producto, receta y compra.
 *
 * Reglas:
 * - En productos con unidad kg/gr/pza, kcal_100 es por 100 gramos.
 * - En productos con unidad L/ml, kcal_100 es por 100 mililitros.
 * - pza se convierte a gramos con peso_pieza_g; si no existe, solo se puede
 *   calcular cuando la cantidad del ingrediente ya viene en gramos.
 * - Sin kcal_100 no se inventa nada: el resultado es null ("sin dato").
 */
final class NutricionService
{
    private readonly ProductoRepository $productos;

    /** @var array<int, array<string, mixed>>|null */
    private ?array $indice = null;

    public function __construct(?ProductoRepository $productos = null)
    {
        $this->productos = $productos ?? new ProductoRepository();
    }

    /**
     * kcal para una cantidad de un producto.
     *
     * @param array<string, mixed> $producto
     */
    public static function calcular(array $producto, float $cantidad, string $unidad): ?float
    {
        $unidad = UnidadService::normalizar($unidad);

        if ($cantidad <= 0 || $unidad === '') {
            return null;
        }

        $kcal100 = $producto['kcal_100'] ?? null;

        if ($kcal100 === null || $kcal100 === '' || !is_numeric($kcal100) || (float) $kcal100 < 0) {
            return null;
        }

        $kcal100 = (float) $kcal100;
        $base = UnidadService::normalizar((string) ($producto['unidad_base'] ?? ''));
        $peso = $producto['peso_pieza_g'] ?? null;
        $peso = $peso !== null && $peso !== '' && is_numeric($peso) && (float) $peso > 0
            ? (float) $peso
            : null;

        if ($base === 'L' || $base === 'ml') {
            $mililitros = self::aMililitros($cantidad, $unidad, $peso);

            if ($mililitros === null) {
                // Aproximación de cocina: 1 g ≈ 1 ml cuando el producto es
                // líquido y la receta lo mide en peso.
                $gramos = self::aGramos($cantidad, $unidad, null);
                $mililitros = $gramos;
            }

            if ($mililitros === null) {
                return null;
            }

            return round($mililitros / 100 * $kcal100, 1);
        }

        $gramos = self::aGramos($cantidad, $unidad, $peso);

        if ($gramos === null) {
            // Aproximación de cocina: 1 ml ≈ 1 g para productos envasados
            // por pieza (crema, nata, leche evaporada...) y para sólidos o
            // polvos medidos en volumen.
            if (
                ($base === 'pza' && $peso !== null)
                || in_array($base, ['kg', 'gr'], true)
            ) {
                $gramos = self::aMililitros($cantidad, $unidad);
            }
        }

        if ($gramos === null) {
            return null;
        }

        return round($gramos / 100 * $kcal100, 1);
    }

    /**
     * Nutrición de una receta completa. Se calcula sobre las porciones base
     * (o las indicadas) y el cliente escala con el factor de porciones.
     *
     * @param array<string, mixed> $receta
     * @return array{
     *     total: float,
     *     porcion: float,
     *     porciones: int,
     *     porciones_base: int,
     *     items: array<int, array{nombre: string, kcal: float|null, motivo: string|null}>,
     *     con_dato: int,
     *     sin_dato: int,
     *     ignorados: int,
     *     completo: bool
     * }
     */
    public function receta(array $receta, ?int $porciones = null, ?int $usuarioId = null): array
    {
        return $this->recetaConIndice($receta, $porciones, $this->indiceProductos($usuarioId));
    }

    /**
     * Calcula varias recetas compartiendo una sola carga del catálogo.
     *
     * @param array<int|string, array{receta: array<string, mixed>, porciones?: int|null}> $entradas
     * @return array<int|string, array<string, mixed>>
     */
    public function recetas(array $entradas, ?int $usuarioId = null): array
    {
        $indice = $this->indiceProductos($usuarioId);
        $resultado = [];

        foreach ($entradas as $clave => $entrada) {
            if (!is_array($entrada) || !is_array($entrada['receta'] ?? null)) {
                continue;
            }

            $porciones = isset($entrada['porciones']) ? (int) $entrada['porciones'] : null;
            $resultado[$clave] = $this->recetaConIndice($entrada['receta'], $porciones, $indice);
        }

        return $resultado;
    }

    /**
     * @param array<string, mixed> $receta
     * @param array<int, array{producto: array<string, mixed>, tokens: array<int, string>}> $indice
     * @return array{
     *     total: float,
     *     porcion: float,
     *     porciones: int,
     *     porciones_base: int,
     *     items: array<int, array{nombre: string, kcal: float|null, motivo: string|null}>,
     *     con_dato: int,
     *     sin_dato: int,
     *     ignorados: int,
     *     completo: bool
     * }
     */
    private function recetaConIndice(array $receta, ?int $porciones, array $indice): array
    {
        $porcionesBase = max(1, (int) ($receta['porciones_base'] ?? 4));
        $porciones = $porciones === null ? $porcionesBase : max(1, min(50, $porciones));
        $factor = $porciones / $porcionesBase;

        $items = [];
        $total = 0.0;
        $conDato = 0;
        $sinDato = 0;
        $ignorados = 0;

        foreach (($receta['ingredientes'] ?? []) as $ingrediente) {
            if (!is_array($ingrediente)) {
                continue;
            }

            $nombre = (string) ($ingrediente['nombre'] ?? '');
            $unidad = (string) ($ingrediente['unidad'] ?? '');
            $cantidad = $ingrediente['cantidad'] ?? null;
            $item = ['nombre' => $nombre, 'kcal' => null, 'motivo' => null];

            if ($unidad === 'al_gusto') {
                $item['motivo'] = 'al_gusto';
                $ignorados++;
                $items[] = $item;

                continue;
            }

            if ($cantidad === null || !is_numeric($cantidad) || (float) $cantidad <= 0) {
                $item['motivo'] = 'sin_cantidad';
                $ignorados++;
                $items[] = $item;

                continue;
            }

            $producto = $this->buscarProducto(
                $indice,
                (string) ($ingrediente['producto'] ?? $nombre),
                $unidad
            );

            if ($producto === null) {
                $item['motivo'] = 'sin_producto';
                $sinDato++;
                $items[] = $item;

                continue;
            }

            $kcal = self::calcular($producto, (float) $cantidad * $factor, $unidad);

            if ($kcal === null) {
                $item['motivo'] = 'sin_dato';
                $sinDato++;
                $items[] = $item;

                continue;
            }

            $item['kcal'] = $kcal;
            $total += $kcal;
            $conDato++;
            $items[] = $item;
        }

        return [
            'total' => round($total, 1),
            'porcion' => round($total / $porciones, 1),
            'porciones' => $porciones,
            'porciones_base' => $porcionesBase,
            'items' => $items,
            'con_dato' => $conDato,
            'sin_dato' => $sinDato,
            'ignorados' => $ignorados,
            'completo' => $sinDato === 0,
        ];
    }

    /**
     * Nutrición de los ítems de una compra.
     *
     * @param array<int, array<string, mixed>> $items
     * @return array{
     *     total: float,
     *     con_dato: int,
     *     sin_dato: int,
     *     items: array<int, array{kcal: float|null, motivo: string|null}>
     * }
     */
    public function compra(array $items): array
    {
        $ids = [];

        foreach ($items as $item) {
            $productoId = (int) ($item['producto_id'] ?? 0);

            if ($productoId > 0) {
                $ids[] = $productoId;
            }
        }

        $mapa = $this->productos->nutricionPorIds($ids);
        $detalle = [];
        $total = 0.0;
        $conDato = 0;
        $sinDato = 0;

        foreach ($items as $indice => $item) {
            $productoId = (int) ($item['producto_id'] ?? 0);
            $cantidad = (float) ($item['cantidad'] ?? 0);
            $unidad = (string) ($item['unidad_base'] ?? ($item['producto_unidad'] ?? ''));
            $kcal = null;
            $motivo = null;

            if ($productoId <= 0 || !isset($mapa[$productoId])) {
                $motivo = 'sin_producto';
            } elseif ($cantidad <= 0 || $unidad === '') {
                $motivo = 'sin_cantidad';
            } else {
                $kcal = self::calcular($mapa[$productoId], $cantidad, $unidad);

                if ($kcal === null) {
                    $motivo = 'sin_dato';
                }
            }

            if ($kcal === null) {
                $sinDato++;
            } else {
                $total += $kcal;
                $conDato++;
            }

            $detalle[$indice] = ['kcal' => $kcal, 'motivo' => $motivo];
        }

        return [
            'total' => round($total, 1),
            'con_dato' => $conDato,
            'sin_dato' => $sinDato,
            'items' => $detalle,
        ];
    }

    /**
     * Totales de kcal para varias compras en una sola pasada.
     *
     * @param array<int, array<int, array<string, mixed>>> $porCompra Filas de compra_items agrupadas por compra.
     * @return array<int, array{total: float, sin_dato: int}>
     */
    public function porCompras(array $porCompra): array
    {
        $ids = [];

        foreach ($porCompra as $filas) {
            foreach ($filas as $fila) {
                $productoId = (int) ($fila['producto_id'] ?? 0);

                if ($productoId > 0) {
                    $ids[] = $productoId;
                }
            }
        }

        $mapa = $this->productos->nutricionPorIds($ids);
        $resultado = [];

        foreach ($porCompra as $compraId => $filas) {
            $total = 0.0;
            $sinDato = 0;

            foreach ($filas as $fila) {
                $productoId = (int) ($fila['producto_id'] ?? 0);
                $cantidad = (float) ($fila['cantidad'] ?? 0);
                $unidad = (string) ($fila['unidad_base'] ?? ($fila['producto_unidad'] ?? ''));
                $kcal = $productoId > 0 && isset($mapa[$productoId])
                    ? self::calcular($mapa[$productoId], $cantidad, $unidad)
                    : null;

                if ($kcal === null) {
                    $sinDato++;
                } else {
                    $total += $kcal;
                }
            }

            $resultado[(int) $compraId] = ['total' => round($total, 1), 'sin_dato' => $sinDato];
        }

        return $resultado;
    }

    private static function aGramos(float $cantidad, string $unidad, ?float $pesoPieza): ?float
    {
        return match ($unidad) {
            'kg' => $cantidad * 1000,
            'gr' => $cantidad,
            'pza' => $pesoPieza === null ? null : $cantidad * $pesoPieza,
            default => null,
        };
    }

    private static function aMililitros(float $cantidad, string $unidad, ?float $pesoPieza = null): ?float
    {
        return match ($unidad) {
            'L' => $cantidad * 1000,
            'ml' => $cantidad,
            'pza' => $pesoPieza === null ? null : $cantidad * $pesoPieza,
            default => null,
        };
    }

    /**
     * @return array<int, array{producto: array<string, mixed>, tokens: array<int, string>}>
     */
    private function indiceProductos(?int $usuarioId): array
    {
        if ($this->indice !== null && $usuarioId === null) {
            return $this->indice;
        }

        $lista = [];

        foreach ($this->productos->catalogoActivo($usuarioId) as $producto) {
            $lista[] = [
                'producto' => $producto,
                'tokens' => NormalizadorService::tokensNombre((string) $producto['nombre']),
            ];
        }

        if ($usuarioId === null) {
            $this->indice = $lista;
        }

        return $lista;
    }

    /**
     * Elige el producto más parecido, no el primero compatible. Así
     * "naranjas" prefiere "Naranja" y no "Jugo de naranja".
     *
     * @param array<int, array{producto: array<string, mixed>, tokens: array<int, string>}> $indice
     * @return array<string, mixed>|null
     */
    private function buscarProducto(array $indice, string $nombre, string $unidad = ''): ?array
    {
        $clave = NormalizadorService::normalizar($nombre);

        foreach ($indice as $entrada) {
            if (NormalizadorService::normalizar((string) $entrada['producto']['nombre']) === $clave) {
                return $entrada['producto'];
            }
        }

        $tokens = NormalizadorService::tokensNombre($nombre);
        $mejor = null;
        $mejorPuntaje = PHP_INT_MAX;

        foreach ($indice as $entrada) {
            if (!NormalizadorService::tokensCompatibles($tokens, $entrada['tokens'])) {
                continue;
            }

            $sobran = self::tokensSobrantes($tokens, $entrada['tokens'])
                + self::tokensSobrantes($entrada['tokens'], $tokens);
            $puntaje = $sobran * 10;

            if (!self::unidadCompatible($entrada['producto'], $unidad)) {
                $puntaje += 5;
            }

            if ($puntaje < $mejorPuntaje) {
                $mejorPuntaje = $puntaje;
                $mejor = $entrada['producto'];
            }
        }

        return $mejor;
    }

    /**
     * Tokens de $otros que no tienen equivalente en $base.
     *
     * @param array<int, string> $base
     * @param array<int, string> $otros
     */
    private static function tokensSobrantes(array $base, array $otros): int
    {
        $sobran = 0;

        foreach ($otros as $token) {
            $encontrado = false;

            foreach ($base as $otro) {
                if (NormalizadorService::tokensCompatibles([$token], [$otro])) {
                    $encontrado = true;
                    break;
                }
            }

            if (!$encontrado) {
                $sobran++;
            }
        }

        return $sobran;
    }

    /**
     * Indica si la unidad del ingrediente encaja de forma natural con el
     * producto (sin recurrir a la aproximación 1 g ≈ 1 ml).
     *
     * @param array<string, mixed> $producto
     */
    private static function unidadCompatible(array $producto, string $unidad): bool
    {
        $unidad = UnidadService::normalizar($unidad);

        if ($unidad === '') {
            return true;
        }

        $base = UnidadService::normalizar((string) ($producto['unidad_base'] ?? ''));
        $peso = $producto['peso_pieza_g'] ?? null;
        $tienePeso = $peso !== null && $peso !== '' && is_numeric($peso) && (float) $peso > 0;

        if ($base === 'L' || $base === 'ml') {
            return in_array($unidad, ['L', 'ml'], true) || ($unidad === 'pza' && $tienePeso);
        }

        return in_array($unidad, ['kg', 'gr'], true) || ($unidad === 'pza' && $tienePeso);
    }
}
