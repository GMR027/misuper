<?php

declare(strict_types=1);

namespace App\Services;

use App\Repositories\CategoriaRecetaRepository;
use DomainException;
use InvalidArgumentException;

/**
 * CRUD de categorías de platillo.
 */
final class CategoriaRecetaService
{
    private readonly CategoriaRecetaRepository $categorias;

    public function __construct(?CategoriaRecetaRepository $categorias = null)
    {
        $this->categorias = $categorias ?? new CategoriaRecetaRepository();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function listar(): array
    {
        return $this->categorias->all();
    }

    /**
     * @param array<string, mixed> $data
     * @return array<string, mixed>
     */
    public function crear(array $data): array
    {
        return $this->categorias->create($this->normalizar($data));
    }

    /**
     * @param array<string, mixed> $data
     * @return array<string, mixed>|null
     */
    public function actualizar(int $id, array $data): ?array
    {
        if ($this->categorias->findById($id) === null) {
            return null;
        }

        return $this->categorias->update($id, $this->normalizar($data));
    }

    public function eliminar(int $id): bool
    {
        if ($this->categorias->findById($id) === null) {
            return false;
        }

        if ($this->categorias->countUsage($id) > 0) {
            throw new DomainException('No se puede eliminar una categoría que ya tienen recetas.');
        }

        return $this->categorias->delete($id);
    }

    /**
     * @param array<string, mixed> $data
     * @return array<string, mixed>
     */
    private function normalizar(array $data): array
    {
        $nombre = trim((string) ($data['nombre'] ?? ''));

        if (mb_strlen($nombre) < 2 || mb_strlen($nombre) > 80) {
            throw new InvalidArgumentException('El nombre debe tener entre 2 y 80 caracteres.');
        }

        $descripcion = trim((string) ($data['descripcion'] ?? ''));

        if (mb_strlen($descripcion) > 255) {
            throw new InvalidArgumentException('La descripción no puede superar 255 caracteres.');
        }

        $icono = trim((string) ($data['icono'] ?? 'bi-tag'));

        if (preg_match('/^bi-[a-z0-9-]+$/', $icono) !== 1) {
            throw new InvalidArgumentException('El icono debe ser una clase de Bootstrap Icons, por ejemplo bi-tag.');
        }

        $orden = (int) ($data['orden'] ?? $this->categorias->nextOrden());

        if ($orden < 0 || $orden > 999) {
            throw new InvalidArgumentException('El orden debe estar entre 0 y 999.');
        }

        return [
            'nombre' => $nombre,
            'descripcion' => $descripcion,
            'icono' => $icono,
            'orden' => $orden,
        ];
    }
}
