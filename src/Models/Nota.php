<?php

declare(strict_types=1);

namespace App\Models;

/**
 * Nota personal de un usuario, con sus fotos adjuntas.
 *
 * La fecha de creación la pone la base de datos; aquí se expone en ISO 8601
 * para que el navegador la formatee sin ambigüedades.
 */
final class Nota
{
    /**
     * @param array<int, array{id: int, ruta: string}> $fotos
     */
    public function __construct(
        public readonly int $id,
        public readonly int $usuarioId,
        public readonly string $titulo,
        public readonly string $contenido,
        public readonly ?string $createdAt = null,
        public readonly ?string $updatedAt = null,
        public readonly array $fotos = [],
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
            titulo: (string) $row['titulo'],
            contenido: (string) ($row['contenido'] ?? ''),
            createdAt: isset($row['created_at']) ? (string) $row['created_at'] : null,
            updatedAt: isset($row['updated_at']) ? (string) $row['updated_at'] : null,
        );
    }

    /**
     * Devuelve una copia con las fotos ya cargadas.
     *
     * @param array<int, array{id: int, ruta: string}> $fotos
     */
    public function withFotos(array $fotos): self
    {
        return new self(
            id: $this->id,
            usuarioId: $this->usuarioId,
            titulo: $this->titulo,
            contenido: $this->contenido,
            createdAt: $this->createdAt,
            updatedAt: $this->updatedAt,
            fotos: $fotos,
        );
    }

    /**
     * @return array{
     *     id: int,
     *     titulo: string,
     *     contenido: string,
     *     fecha: string,
     *     created_at: string|null,
     *     updated_at: string|null,
     *     fotos: array<int, array{id: int, ruta: string}>
     * }
     */
    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'titulo' => $this->titulo,
            'contenido' => $this->contenido,
            'fecha' => $this->createdAt === null ? '' : substr($this->createdAt, 0, 10),
            'created_at' => self::iso($this->createdAt),
            'updated_at' => self::iso($this->updatedAt),
            'fotos' => array_values($this->fotos),
        ];
    }

    private static function iso(?string $fecha): ?string
    {
        if ($fecha === null || $fecha === '') {
            return null;
        }

        return str_replace(' ', 'T', $fecha);
    }
}
