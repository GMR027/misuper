<?php

declare(strict_types=1);

namespace App\Models;

/**
 * Sugerencia de un producto que no está en el catálogo.
 *
 * nombre_normalizado es la clave de agrupación para el panel Admin;
 * nombre_original conserva el texto tal como lo escribió el usuario.
 */
final class Sugerencia
{
    public function __construct(
        public readonly int $id,
        public readonly string $nombreNormalizado,
        public readonly string $nombreOriginal,
        public readonly string $estado,
        public readonly int $usuarioId,
        public readonly ?string $createdAt = null,
    ) {
    }

    /**
     * @param array<string, mixed> $row
     */
    public static function fromRow(array $row): self
    {
        return new self(
            id: (int) $row['id'],
            nombreNormalizado: (string) $row['nombre_normalizado'],
            nombreOriginal: (string) $row['nombre_original'],
            estado: (string) $row['estado'],
            usuarioId: (int) $row['usuario_id'],
            createdAt: isset($row['created_at']) ? (string) $row['created_at'] : null,
        );
    }

    /**
     * @return array{id: int, nombre_normalizado: string, nombre_original: string, estado: string}
     */
    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'nombre_normalizado' => $this->nombreNormalizado,
            'nombre_original' => $this->nombreOriginal,
            'estado' => $this->estado,
        ];
    }
}
