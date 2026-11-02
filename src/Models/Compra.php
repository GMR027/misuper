<?php

declare(strict_types=1);

namespace App\Models;

/**
 * Compra de un usuario.
 *
 * El total es una caché persistida; se recalcula desde compra_items.
 */
final class Compra
{
    public function __construct(
        public readonly int $id,
        public readonly int $usuarioId,
        public readonly string $fecha,
        public readonly string $total,
        public readonly ?string $createdAt = null,
        public readonly ?string $updatedAt = null,
    ) {
    }

    /**
     * @param array<string, mixed> $row
     */
    public static function fromRow(array $row): self
    {
        return new self(
            id: (int) $row['id'],
            usuarioId: (int) $row['usuario_id'],
            fecha: (string) $row['fecha'],
            total: (string) $row['total'],
            createdAt: isset($row['created_at']) ? (string) $row['created_at'] : null,
            updatedAt: isset($row['updated_at']) ? (string) $row['updated_at'] : null,
        );
    }

    /**
     * @return array{id: int, fecha: string, total: float, items_count: int}
     */
    public function toSummaryArray(int $itemsCount): array
    {
        return [
            'id' => $this->id,
            'fecha' => $this->fecha,
            'total' => round((float) $this->total, 2),
            'items_count' => $itemsCount,
        ];
    }

    /**
     * @param array<int, array<string, mixed>> $items
     * @return array{id: int, fecha: string, total: float, items: array<int, array<string, mixed>>}
     */
    public function toDetailArray(array $items): array
    {
        return [
            'id' => $this->id,
            'fecha' => $this->fecha,
            'total' => round((float) $this->total, 2),
            'items' => $items,
        ];
    }
}
