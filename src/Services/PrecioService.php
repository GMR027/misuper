<?php

declare(strict_types=1);

namespace App\Services;

use App\Repositories\CompraRepository;
use App\Repositories\PrecioRepository;
use App\Repositories\ProductoRepository;

/**
 * Precios por unidad y costeo de recetas y listas.
 *
 * Regla central: el precio sale de compras y tickets reales, o de un precio
 * manual. Si no hay dato suficiente, el ingrediente se marca como faltante;
 * nunca se inventa un importe.
 */
final class PrecioService
{
    public const MUESTRAS = 5;
    public const DIAS_VIEJO = 60;

    private readonly PrecioRepository $precios;
    private readonly ProductoRepository $productos;
    private readonly CompraRepository $compras;

    public function __construct(
        ?PrecioRepository $precios = null,
        ?ProductoRepository $productos = null,
        ?CompraRepository $compras = null
    ) {
        $this->precios = $precios ?? new PrecioRepository();
        $this->productos = $productos ?? new ProductoRepository();
        $this->compras = $compras ?? new CompraRepository();
    }

    /**
     * @return array{
     *     items: array<int, array<string, mixed>>,
     *     resumen: array{total: int, con_precio: int, sin_precio: int, viejos: int, manuales: int}
     * }
     */
    public function resumen(int $usuarioId, string $q = '', string $estado = 'todos'): array
    {
        $mapa = $this->mapaPrecios($usuarioId);
        $productos = $this->productos->catalogoActivo($usuarioId);
        $q = NormalizadorService::normalizar(trim($q));
        $items = [];

        foreach ($productos as $producto) {
            $precio = $mapa[(int) $producto['id']] ?? null;

            if ($q !== '' && !str_contains(NormalizadorService::normalizar($producto['nombre']), $q)) {
                continue;
            }

            if ($estado === 'con-precio' && $precio === null) {
                continue;
            }

            if ($estado === 'sin-precio' && $precio !== null) {
                continue;
            }

            if ($estado === 'viejos' && ($precio === null || !$precio['viejo'])) {
                continue;
            }

            if ($estado === 'manuales' && ($precio === null || $precio['origen'] !== 'manual')) {
                continue;
            }

            $items[] = [
                'id' => (int) $producto['id'],
                'nombre' => (string) $producto['nombre'],
                'categoria_nombre' => (string) ($producto['categoria_nombre'] ?? ''),
                'unidad_base' => (string) $producto['unidad_base'],
                'imagen_url' => $producto['imagen_url'] ?? null,
                'precio' => $precio['precio'] ?? null,
                'muestras' => $precio['muestras'] ?? 0,
                'fecha' => $precio['fecha'] ?? null,
                'comercio' => $precio['comercio'] ?? null,
                'origen' => $precio['origen'] ?? null,
                'viejo' => $precio['viejo'] ?? false,
                'actualizado_at' => $precio['actualizado_at'] ?? null,
            ];
        }

        usort(
            $items,
            static fn (array $a, array $b): int => strcmp($a['nombre'], $b['nombre'])
        );

        $conPrecio = count($mapa);
        $viejos = count(array_filter($mapa, static fn (array $item): bool => $item['viejo']));
        $manuales = count(array_filter(
            $mapa,
            static fn (array $item): bool => $item['origen'] === 'manual'
        ));

        return [
            'items' => $items,
            'resumen' => [
                'total' => count($productos),
                'con_precio' => $conPrecio,
                'sin_precio' => count($productos) - $conPrecio,
                'viejos' => $viejos,
                'manuales' => $manuales,
            ],
        ];
    }

    /**
     * Precio vigente por producto para un usuario.
     *
     * @return array<int, array{
     *     precio: float,
     *     muestras: int,
     *     fecha: string|null,
     *     comercio: string|null,
     *     origen: string,
     *     viejo: bool,
     *     actualizado_at: string|null
     * }>
     */
    public function mapaPrecios(int $usuarioId): array
    {
        $unidades = [];

        foreach ($this->productos->catalogoActivo($usuarioId) as $producto) {
            $unidades[(int) $producto['id']] = (string) $producto['unidad_base'];
        }

        $muestras = [];

        foreach ($this->precios->muestras($usuarioId, self::MUESTRAS) as $fila) {
            $productoId = $fila['producto_id'];

            if (!isset($unidades[$productoId])) {
                continue;
            }

            $unidadOrigen = $fila['unidad'] ?? $unidades[$productoId];
            $precioUnidad = $fila['cantidad'] > 0 ? $fila['precio_total'] / $fila['cantidad'] : null;

            if ($precioUnidad === null) {
                continue;
            }

            $precioBase = UnidadService::convertirPrecio(
                $precioUnidad,
                $unidadOrigen,
                $unidades[$productoId]
            );

            if ($precioBase === null) {
                continue;
            }

            $muestras[$productoId][] = [
                'precio' => $precioBase,
                'fecha' => $fila['fecha'],
                'comercio' => $fila['comercio'],
            ];
        }

        $manuales = $this->precios->manuales($usuarioId);
        $mapa = [];

        foreach ($unidades as $productoId => $unidad) {
            $filas = $muestras[$productoId] ?? [];

            if ($filas !== []) {
                $precios = array_column($filas, 'precio');
                $ultima = $filas[0];
                $mapa[$productoId] = [
                    'precio' => $this->mediana($precios),
                    'muestras' => count($filas),
                    'fecha' => $ultima['fecha'],
                    'comercio' => $ultima['comercio'],
                    'origen' => 'compras',
                    'viejo' => $this->esViejo($ultima['fecha']),
                    'actualizado_at' => $ultima['fecha'],
                ];

                continue;
            }

            if (isset($manuales[$productoId])) {
                $manual = $manuales[$productoId];
                $mapa[$productoId] = [
                    'precio' => round($manual['precio_unidad'], 4),
                    'muestras' => 0,
                    'fecha' => null,
                    'comercio' => null,
                    'origen' => 'manual',
                    'viejo' => false,
                    'actualizado_at' => $manual['updated_at'],
                ];
            }
        }

        ksort($mapa);

        return $mapa;
    }

    /**
     * @return array<string, mixed>|null
     */
    public function producto(int $usuarioId, int $productoId): ?array
    {
        $producto = $this->productos->findById($productoId);

        if (
            $producto === null
            || $producto->estado !== 'activo'
            || ($producto->usuarioId !== null && $producto->usuarioId !== $usuarioId)
        ) {
            return null;
        }

        $mapa = $this->mapaPrecios($usuarioId);
        $precio = $mapa[$productoId] ?? null;
        $manual = $this->precios->manuales($usuarioId)[$productoId] ?? null;
        $historial = [];

        foreach ($this->precios->historial($usuarioId, $productoId) as $fila) {
            $unidadOrigen = $fila['unidad'] ?? $producto->unidadBase;
            $precioUnidad = $fila['cantidad'] > 0 ? $fila['precio_total'] / $fila['cantidad'] : null;
            $precioBase = $precioUnidad === null
                ? null
                : UnidadService::convertirPrecio($precioUnidad, $unidadOrigen, $producto->unidadBase);

            $historial[] = [
                'fecha' => $fila['fecha'],
                'cantidad' => round($fila['cantidad'], 3),
                'precio_total' => round($fila['precio_total'], 2),
                'unidad' => $unidadOrigen,
                'precio_unidad' => $precioUnidad === null ? null : round($precioUnidad, 4),
                'precio_base' => $precioBase === null ? null : round($precioBase, 4),
                'comercio' => $fila['comercio'],
                'compatible' => $precioBase !== null,
            ];
        }

        return [
            'producto' => [
                'id' => $producto->id,
                'nombre' => $producto->nombre,
                'unidad_base' => $producto->unidadBase,
                'categoria_nombre' => $producto->categoriaNombre,
                'imagen_url' => $producto->imagenUrl,
            ],
            'precio' => $precio,
            'manual' => $manual,
            'historial' => $historial,
            'comercios' => $this->precios->comercios($usuarioId),
        ];
    }

    public function guardarManual(int $usuarioId, int $productoId, float $precio): void
    {
        $this->precios->guardarManual(
            $usuarioId,
            $productoId,
            number_format(max(0.0, $precio), 4, '.', '')
        );
    }

    public function eliminarManual(int $usuarioId, int $productoId): bool
    {
        return $this->precios->eliminarManual($usuarioId, $productoId);
    }

    /**
     * Costo estimado de una receta a partir de sus ingredientes.
     *
     * Los ingredientes sin producto o sin unidad compatible se devuelven como
     * faltantes; el total se marca como parcial.
     *
     * @param array<string, mixed> $receta
     * @return array<string, mixed>
     */
    public function costoReceta(int $usuarioId, array $receta, ?int $porciones = null): array
    {
        return $this->costoRecetaConContexto($receta, $porciones, $this->contextoCosto($usuarioId));
    }

    /**
     * Costo de varias recetas compartiendo una sola carga de precios.
     *
     * @param array<int|string, array{receta: array<string, mixed>, porciones?: int|null}> $entradas
     * @return array<int|string, array<string, mixed>>
     */
    public function costosRecetas(int $usuarioId, array $entradas): array
    {
        $contexto = $this->contextoCosto($usuarioId);
        $costos = [];

        foreach ($entradas as $clave => $entrada) {
            if (!is_array($entrada) || !is_array($entrada['receta'] ?? null)) {
                continue;
            }

            $porciones = isset($entrada['porciones']) ? (int) $entrada['porciones'] : null;
            $costos[$clave] = $this->costoRecetaConContexto($entrada['receta'], $porciones, $contexto);
        }

        return $costos;
    }

    /**
     * @return array{indice: array<string, array<string, mixed>>, mapa: array<int, array<string, mixed>>, pantry: array<int, array{nombre: string, tokens: array<int, string>}>}
     */
    private function contextoCosto(int $usuarioId): array
    {
        $productos = $this->productos->catalogoActivo($usuarioId);
        $indice = [];

        foreach ($productos as $producto) {
            $indice[NormalizadorService::normalizar($producto['nombre'])] = $producto;
        }

        return [
            'indice' => $indice,
            'mapa' => $this->mapaPrecios($usuarioId),
            'pantry' => $this->indiceDespensa($this->compras->despensa($usuarioId)),
        ];
    }

    /**
     * @param array<string, mixed> $receta
     * @param array{indice: array<string, array<string, mixed>>, mapa: array<int, array<string, mixed>>, pantry: array<int, array{nombre: string, tokens: array<int, string>}>} $contexto
     * @return array<string, mixed>
     */
    private function costoRecetaConContexto(array $receta, ?int $porciones, array $contexto): array
    {
        $porcionesBase = max(1, (int) ($receta['porciones_base'] ?? 4));
        $porciones = $porciones === null ? $porcionesBase : max(1, min(50, $porciones));
        $factor = $porciones / $porcionesBase;
        $indice = $contexto['indice'];
        $mapa = $contexto['mapa'];
        $pantry = $contexto['pantry'];
        $items = [];
        $total = 0.0;
        $faltaComprar = 0.0;
        $conPrecio = 0;
        $sinPrecio = 0;
        $viejos = 0;
        $fechas = [];

        foreach (($receta['ingredientes'] ?? []) as $ingrediente) {
            if (!is_array($ingrediente)) {
                continue;
            }

            $nombre = (string) ($ingrediente['nombre'] ?? '');
            $unidad = (string) ($ingrediente['unidad'] ?? '');
            $cantidad = $ingrediente['cantidad'] ?? null;
            $alGusto = $unidad === 'al_gusto';
            $producto = $indice[NormalizadorService::normalizar(
                (string) ($ingrediente['producto'] ?? $nombre)
            )] ?? null;
            $yaTienes = $this->estaEnDespensa($pantry, $nombre);
            $cantidadBase = null;
            $precio = null;
            $costo = null;
            $motivo = null;

            if ($alGusto || $cantidad === null || (float) $cantidad <= 0) {
                $motivo = $alGusto ? 'al_gusto' : 'sin_cantidad';
            } elseif ($producto === null) {
                $motivo = 'sin_producto';
            } else {
                $cantidadBase = UnidadService::convertir(
                    (float) $cantidad * $factor,
                    $unidad,
                    (string) $producto['unidad_base']
                );

                if ($cantidadBase === null) {
                    $motivo = 'unidad_incompatible';
                } else {
                    $entradaPrecio = $mapa[(int) $producto['id']] ?? null;

                    if ($entradaPrecio === null) {
                        $motivo = 'sin_precio';
                    } else {
                        $precio = $entradaPrecio['precio'];
                        $costo = round($cantidadBase * $precio, 2);
                        $total += $costo;
                        $conPrecio++;

                        if ($entradaPrecio['viejo']) {
                            $viejos++;
                        }

                        if ($entradaPrecio['fecha'] !== null) {
                            $fechas[] = $entradaPrecio['fecha'];
                        }

                        if (!$yaTienes) {
                            $faltaComprar += $costo;
                        }
                    }
                }
            }

            if ($motivo !== null && $motivo !== 'al_gusto') {
                $sinPrecio++;
            }

            $items[] = [
                'nombre' => $nombre,
                'cantidad' => $cantidad === null ? null : round((float) $cantidad * $factor, 3),
                'unidad' => $unidad,
                'cantidad_base' => $cantidadBase,
                'unidad_base' => $producto['unidad_base'] ?? null,
                'producto_id' => $producto['id'] ?? null,
                'producto_nombre' => $producto['nombre'] ?? null,
                'precio_unidad' => $precio,
                'costo' => $costo,
                'ya_tienes' => $yaTienes,
                'faltante' => $motivo !== null && $motivo !== 'al_gusto',
                'motivo' => $motivo,
                'principal' => (bool) ($ingrediente['principal'] ?? false),
            ];
        }

        sort($fechas);

        return [
            'porciones' => $porciones,
            'porciones_base' => $porcionesBase,
            'total' => round($total, 2),
            'porcion' => round($total / $porciones, 2),
            'falta_comprar' => round($faltaComprar, 2),
            'valor_despensa' => round(max(0.0, $total - $faltaComprar), 2),
            'items_con_precio' => $conPrecio,
            'items_sin_precio' => $sinPrecio,
            'precios_viejos' => $viejos,
            'completo' => $sinPrecio === 0,
            'fecha_precio_mas_antigua' => $fechas[0] ?? null,
            'items' => $items,
        ];
    }

    /**
     * Costo estimado de los ítems de una lista de compras.
     *
     * @param array<int, array<string, mixed>> $items
     * @return array<string, mixed>
     */
    public function costoItems(int $usuarioId, array $items): array
    {
        $productos = $this->productos->catalogoActivo($usuarioId);
        $porId = [];
        $porNombre = [];

        foreach ($productos as $producto) {
            $porId[(int) $producto['id']] = $producto;
            $porNombre[NormalizadorService::normalizar($producto['nombre'])] = $producto;
        }

        $mapa = $this->mapaPrecios($usuarioId);
        $detalle = [];
        $total = 0.0;
        $conPrecio = 0;
        $sinPrecio = 0;
        $viejos = 0;

        foreach ($items as $item) {
            if (!is_array($item)) {
                continue;
            }

            $productoId = isset($item['producto_id']) ? (int) $item['producto_id'] : 0;
            $producto = $porId[$productoId]
                ?? $porNombre[NormalizadorService::normalizar((string) ($item['nombre'] ?? ''))]
                ?? null;
            $unidad = (string) ($item['unidad_base'] ?? ($producto['unidad_base'] ?? ''));
            $cantidad = (float) ($item['cantidad'] ?? 0);
            $costo = null;
            $motivo = null;
            $precio = null;

            if ($producto === null) {
                $motivo = 'sin_producto';
            } elseif ($cantidad <= 0) {
                $motivo = 'sin_cantidad';
            } else {
                $cantidadBase = UnidadService::convertir(
                    $cantidad,
                    $unidad,
                    (string) $producto['unidad_base']
                );
                $entradaPrecio = $mapa[(int) $producto['id']] ?? null;

                if ($cantidadBase === null) {
                    $motivo = 'unidad_incompatible';
                } elseif ($entradaPrecio === null) {
                    $motivo = 'sin_precio';
                } else {
                    $precio = $entradaPrecio['precio'];
                    $costo = round($cantidadBase * $precio, 2);
                    $total += $costo;
                    $conPrecio++;

                    if ($entradaPrecio['viejo']) {
                        $viejos++;
                    }
                }
            }

            if ($motivo !== null) {
                $sinPrecio++;
            }

            $detalle[] = [
                'id' => isset($item['id']) ? (int) $item['id'] : null,
                'nombre' => (string) ($item['nombre'] ?? ''),
                'producto_id' => $producto['id'] ?? null,
                'unidad_base' => $producto['unidad_base'] ?? $unidad,
                'precio_unidad' => $precio,
                'costo' => $costo,
                'faltante' => $motivo !== null,
                'motivo' => $motivo,
            ];
        }

        return [
            'total' => round($total, 2),
            'items_con_precio' => $conPrecio,
            'items_sin_precio' => $sinPrecio,
            'precios_viejos' => $viejos,
            'completo' => $sinPrecio === 0,
            'items' => $detalle,
        ];
    }

    /**
     * @return array<int, string>
     */
    public function comercios(int $usuarioId): array
    {
        return $this->precios->comercios($usuarioId);
    }

    /**
     * @param array<int, float> $valores
     */
    private function mediana(array $valores): float
    {
        sort($valores);
        $total = count($valores);

        if ($total === 0) {
            return 0.0;
        }

        $medio = intdiv($total, 2);

        if ($total % 2 === 0) {
            return round(($valores[$medio - 1] + $valores[$medio]) / 2, 4);
        }

        return round($valores[$medio], 4);
    }

    private function esViejo(?string $fecha): bool
    {
        if ($fecha === null || $fecha === '') {
            return false;
        }

        $date = \DateTimeImmutable::createFromFormat('!Y-m-d', $fecha);

        if ($date === false) {
            return false;
        }

        return $date < (new \DateTimeImmutable('today'))->modify('-' . self::DIAS_VIEJO . ' days');
    }

    /**
     * @return array<int, array{nombre: string, tokens: array<int, string>}>
     */
    private function indiceDespensa(array $despensa): array
    {
        $indice = [];

        foreach ($despensa as $item) {
            $nombre = trim((string) ($item['nombre'] ?? ''));

            if ($nombre === '') {
                continue;
            }

            $indice[] = [
                'nombre' => $nombre,
                'tokens' => NormalizadorService::tokensNombre($nombre),
            ];
        }

        return $indice;
    }

    /**
     * @param array<int, array{nombre: string, tokens: array<int, string>}> $pantry
     */
    private function estaEnDespensa(array $pantry, string $nombre): bool
    {
        $tokens = NormalizadorService::tokensNombre($nombre);

        if ($tokens === []) {
            return false;
        }

        foreach ($pantry as $item) {
            if (NormalizadorService::tokensCompatibles($item['tokens'], $tokens)) {
                return true;
            }
        }

        return false;
    }
}
