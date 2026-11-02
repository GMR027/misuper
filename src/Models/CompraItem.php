<?php

declare(strict_types=1);

namespace App\Models;

/**
 * Ítem de una compra.
 *
 * Puede apuntar a un producto del catálogo o llevar un nombre libre,
 * nunca ambos. La unidad base de un ítem libre no se persiste porque el
 * esquema de compra_items no incluye esa columna.
 */
final class CompraItem
{
    public function __construct(
        public readonly int $id,
        public readonly int $compraId,
        public readonly ?int $productoId,
        public readonly ?string $nombreLibre,
        public readonly string $cantidad,
        public readonly string $precioTotal,
        public readonly ?string $productoNombre = null,
        public readonly ?string $productoUnidad = null,
    ) {
    }

    /**
     * @param array<string, mixed> $row
     */
    public static function fromRow(array $row): self
    {
        return new self(
            id: (int) $row['id'],
            compraId: (int) $row['compra_id'],
            productoId: isset($row['producto_id']) ? (int) $row['producto_id'] : null,
            nombreLibre: isset($row['nombre_libre']) ? (string) $row['nombre_libre'] : null,
            cantidad: (string) $row['cantidad'],
            precioTotal: (string) $row['precio_total'],
            productoNombre: isset($row['producto_nombre']) ? (string) $row['producto_nombre'] : null,
            productoUnidad: isset($row['producto_unidad']) ? (string) $row['producto_unidad'] : null,
        );
    }

    /**
     * @return array{id: int, producto_id: int|null, nombre: string, unidad_base: string|null, cantidad: float, precio_total: float}
     */
    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'producto_id' => $this->productoId,
            'nombre' => $this->productoNombre ?? $this->nombreLibre ?? '',
            'unidad_base' => $this->productoId !== null ? $this->productoUnidad : null,
            'cantidad' => round((float) $this->cantidad, 3),
            'precio_total' => round((float) $this->precioTotal, 2),
        ];
    }
}
