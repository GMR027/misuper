<?php

declare(strict_types=1);

namespace App\Models;

/**
 * Producto del catálogo.
 *
 * El catálogo público solo expone productos activos y omite los campos de
 * administración (estado, fechas). Para el panel Admin existe toAdminArray().
 */
final class Producto
{
    public function __construct(
        public readonly int $id,
        public readonly string $nombre,
        public readonly ?int $usuarioId,
        public readonly int $categoriaId,
        public readonly ?string $categoriaNombre,
        public readonly string $unidadBase,
        public readonly ?string $imagenUrl,
        public readonly ?float $kcal100 = null,
        public readonly ?float $pesoPiezaG = null,
        public readonly ?string $fuenteNutricion = null,
        public readonly ?string $imagenEstado = null,
        public readonly ?string $imagenVerificadaAt = null,
        public readonly string $estado = 'activo',
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
            nombre: (string) $row['nombre'],
            usuarioId: isset($row['usuario_id']) ? (int) $row['usuario_id'] : null,
            categoriaId: (int) $row['categoria_id'],
            categoriaNombre: isset($row['categoria_nombre']) ? (string) $row['categoria_nombre'] : null,
            unidadBase: (string) $row['unidad_base'],
            imagenUrl: isset($row['imagen_url']) ? (string) $row['imagen_url'] : null,
            kcal100: isset($row['kcal_100']) ? (float) $row['kcal_100'] : null,
            pesoPiezaG: isset($row['peso_pieza_g']) ? (float) $row['peso_pieza_g'] : null,
            fuenteNutricion: isset($row['fuente_nutricion']) ? (string) $row['fuente_nutricion'] : null,
            imagenEstado: isset($row['imagen_estado']) ? (string) $row['imagen_estado'] : null,
            imagenVerificadaAt: isset($row['imagen_verificada_at'])
                ? (string) $row['imagen_verificada_at']
                : null,
            estado: (string) $row['estado'],
            createdAt: isset($row['created_at']) ? (string) $row['created_at'] : null,
            updatedAt: isset($row['updated_at']) ? (string) $row['updated_at'] : null,
        );
    }

    /**
     * Representación para el catálogo público.
     *
     * @return array{id: int, nombre: string, categoria_id: int, categoria_nombre: string|null, unidad_base: string, imagen_url: string|null}
     */
    public function toPublicArray(): array
    {
        return [
            'id' => $this->id,
            'nombre' => $this->nombre,
            'categoria_id' => $this->categoriaId,
            'categoria_nombre' => $this->categoriaNombre,
            'unidad_base' => $this->unidadBase,
            'imagen_url' => $this->imagenUrl,
            'kcal_100' => $this->kcal100,
            'peso_pieza_g' => $this->pesoPiezaG,
            'fuente_nutricion' => $this->fuenteNutricion,
        ];
    }

    /**
     * Representación para el panel Admin (incluye estado y fecha de alta).
     *
     * @return array{id: int, nombre: string, categoria_id: int, categoria_nombre: string|null, unidad_base: string, imagen_url: string|null, kcal_100: float|null, peso_pieza_g: float|null, fuente_nutricion: string|null, imagen_estado: string|null, imagen_verificada_at: string|null, estado: string, created_at: string|null}
     */
    public function toAdminArray(): array
    {
        return [
            'id' => $this->id,
            'nombre' => $this->nombre,
            'categoria_id' => $this->categoriaId,
            'categoria_nombre' => $this->categoriaNombre,
            'unidad_base' => $this->unidadBase,
            'imagen_url' => $this->imagenUrl,
            'kcal_100' => $this->kcal100,
            'peso_pieza_g' => $this->pesoPiezaG,
            'fuente_nutricion' => $this->fuenteNutricion,
            'imagen_estado' => $this->imagenEstado,
            'imagen_verificada_at' => $this->imagenVerificadaAt,
            'estado' => $this->estado,
            'created_at' => $this->createdAt,
        ];
    }
}
