<?php

declare(strict_types=1);

namespace App\Services;

use App\Repositories\TipoRecetaRepository;
use DomainException;
use InvalidArgumentException;

/**
 * CRUD de tipos de receta.
 */
final class TipoRecetaService
{
    private readonly TipoRecetaRepository $tipos;

    public function __construct(?TipoRecetaRepository $tipos = null)
    {
        $this->tipos = $tipos ?? new TipoRecetaRepository();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function listar(): array
    {
        return $this->tipos->all();
    }

    /**
     * @param array<string, mixed> $data
     * @return array<string, mixed>
     */
    public function crear(array $data): array
    {
        return $this->tipos->create($this->normalizar($data));
    }

    /**
     * @param array<string, mixed> $data
     * @return array<string, mixed>|null
     */
    public function actualizar(int $id, array $data): ?array
    {
        if ($this->tipos->findById($id) === null) {
            return null;
        }

        return $this->tipos->update($id, $this->normalizar($data));
    }

    public function eliminar(int $id): bool
    {
        $tipo = $this->tipos->findById($id);

        if ($tipo === null) {
            return false;
        }

        if ($this->tipos->countUsage((string) $tipo['slug']) > 0) {
            throw new DomainException('No se puede eliminar un tipo que ya tienen recetas.');
        }

        return $this->tipos->delete($id);
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

        $aviso = trim((string) ($data['aviso'] ?? ''));

        if (mb_strlen($aviso) > 500) {
            throw new InvalidArgumentException('El aviso no puede superar 500 caracteres.');
        }

        return [
            'nombre' => $nombre,
            'descripcion' => $descripcion,
            'icono' => $icono,
            'aviso' => $aviso,
        ];
    }
}
