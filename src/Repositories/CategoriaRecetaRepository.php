<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Services\NormalizadorService;
use App\Support\Database;
use PDO;

/**
 * Categorías de platillo editables desde el Admin.
 */
final class CategoriaRecetaRepository
{
    private const COLUMNS = 'id, slug, nombre, descripcion, icono, orden, created_at, updated_at';

    private readonly PDO $pdo;

    public function __construct(?PDO $pdo = null)
    {
        $this->pdo = $pdo ?? Database::connection();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function all(): array
    {
        $statement = $this->pdo->query(
            'SELECT ' . self::COLUMNS . ' FROM categorias_recetas ORDER BY orden ASC, nombre ASC'
        );

        return array_map([$this, 'normalizarFila'], $statement->fetchAll());
    }

    public function findById(int $id): ?array
    {
        $statement = $this->pdo->prepare(
            'SELECT ' . self::COLUMNS . ' FROM categorias_recetas WHERE id = ? LIMIT 1'
        );
        $statement->execute([$id]);

        $row = $statement->fetch();

        return $row === false ? null : $this->normalizarFila($row);
    }

    public function findBySlug(string $slug): ?array
    {
        $statement = $this->pdo->prepare(
            'SELECT ' . self::COLUMNS . ' FROM categorias_recetas WHERE slug = ? LIMIT 1'
        );
        $statement->execute([$slug]);

        $row = $statement->fetch();

        return $row === false ? null : $this->normalizarFila($row);
    }

    /**
     * @param array<string, mixed> $data
     * @return array<string, mixed>
     */
    public function create(array $data): array
    {
        $slug = $this->uniqueSlug((string) $data['nombre']);
        $statement = $this->pdo->prepare(
            'INSERT INTO categorias_recetas (slug, nombre, descripcion, icono, orden)
             VALUES (?, ?, ?, ?, ?)'
        );
        $statement->execute([
            $slug,
            $data['nombre'],
            $data['descripcion'],
            $data['icono'],
            $data['orden'],
        ]);

        $categoria = $this->findById((int) $this->pdo->lastInsertId());

        if ($categoria === null) {
            throw new \RuntimeException('No se pudo leer la categoría recién creada.');
        }

        return $categoria;
    }

    /**
     * @param array<string, mixed> $data
     * @return array<string, mixed>|null
     */
    public function update(int $id, array $data): ?array
    {
        $sets = [];
        $params = [];

        foreach (['nombre', 'descripcion', 'icono', 'orden'] as $columna) {
            if (array_key_exists($columna, $data)) {
                $sets[] = $columna . ' = ?';
                $params[] = $data[$columna];
            }
        }

        if ($sets !== []) {
            $params[] = $id;
            $statement = $this->pdo->prepare(
                'UPDATE categorias_recetas SET ' . implode(', ', $sets) . ' WHERE id = ?'
            );
            $statement->execute($params);
        }

        return $this->findById($id);
    }

    public function delete(int $id): bool
    {
        $statement = $this->pdo->prepare('DELETE FROM categorias_recetas WHERE id = ?');
        $statement->execute([$id]);

        return $statement->rowCount() > 0;
    }

    public function countUsage(int $id): int
    {
        $statement = $this->pdo->prepare(
            'SELECT COUNT(*) FROM recetas WHERE categoria_id = ?'
        );
        $statement->execute([$id]);

        return (int) $statement->fetchColumn();
    }

    public function nextOrden(): int
    {
        $statement = $this->pdo->query(
            'SELECT COALESCE(MAX(orden), 0) + 1 FROM categorias_recetas'
        );

        return (int) $statement->fetchColumn();
    }

    public function uniqueSlug(string $nombre): string
    {
        $base = trim((string) preg_replace(
            '/[^a-z0-9]+/',
            '-',
            NormalizadorService::normalizar($nombre)
        ), '-');

        if ($base === '') {
            $base = 'categoria';
        }

        $base = mb_substr($base, 0, 60);
        $slug = $base;
        $suffix = 2;

        while ($this->findBySlug($slug) !== null) {
            $slug = $base . '-' . $suffix;
            $suffix++;
        }

        return $slug;
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function normalizarFila(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'slug' => (string) $row['slug'],
            'nombre' => (string) $row['nombre'],
            'descripcion' => (string) $row['descripcion'],
            'icono' => (string) $row['icono'],
            'orden' => (int) $row['orden'],
            'created_at' => (string) $row['created_at'],
            'updated_at' => (string) $row['updated_at'],
        ];
    }
}
