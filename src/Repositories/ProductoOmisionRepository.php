<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Support\Database;
use PDO;

/**
 * Ingredientes que un usuario omite al comparar recetas con su despensa.
 * Cada fila pertenece a un usuario; siempre se filtra por usuario_id.
 */
final class ProductoOmisionRepository
{
    private readonly PDO $pdo;

    public function __construct(?PDO $pdo = null)
    {
        $this->pdo = $pdo ?? Database::connection();
    }

    /**
     * @return array<int, array{id: int, nombre: string}>
     */
    public function listarPorUsuario(int $usuarioId): array
    {
        $statement = $this->pdo->prepare(
            'SELECT id, nombre
             FROM productos_omision
             WHERE usuario_id = ?
             ORDER BY nombre ASC, id ASC'
        );
        $statement->execute([$usuarioId]);

        return array_map(
            static fn (array $row): array => [
                'id' => (int) $row['id'],
                'nombre' => (string) $row['nombre'],
            ],
            $statement->fetchAll()
        );
    }

    /**
     * @return array<int, string>
     */
    public function nombresPorUsuario(int $usuarioId): array
    {
        $statement = $this->pdo->prepare(
            'SELECT nombre
             FROM productos_omision
             WHERE usuario_id = ?
             ORDER BY nombre ASC, id ASC'
        );
        $statement->execute([$usuarioId]);

        return array_map('strval', $statement->fetchAll(PDO::FETCH_COLUMN));
    }

    public function contar(int $usuarioId): int
    {
        $statement = $this->pdo->prepare(
            'SELECT COUNT(*) FROM productos_omision WHERE usuario_id = ?'
        );
        $statement->execute([$usuarioId]);

        return (int) $statement->fetchColumn();
    }

    public function existe(int $usuarioId, string $nombreNormalizado): bool
    {
        $statement = $this->pdo->prepare(
            'SELECT 1 FROM productos_omision
             WHERE usuario_id = ? AND nombre_normalizado = ?
             LIMIT 1'
        );
        $statement->execute([$usuarioId, $nombreNormalizado]);

        return $statement->fetchColumn() !== false;
    }

    public function crear(int $usuarioId, string $nombre, string $nombreNormalizado): int
    {
        $statement = $this->pdo->prepare(
            'INSERT INTO productos_omision (usuario_id, nombre, nombre_normalizado)
             VALUES (?, ?, ?)'
        );
        $statement->execute([$usuarioId, $nombre, $nombreNormalizado]);

        return (int) $this->pdo->lastInsertId();
    }

    public function eliminar(int $id, int $usuarioId): bool
    {
        $statement = $this->pdo->prepare(
            'DELETE FROM productos_omision WHERE id = ? AND usuario_id = ?'
        );
        $statement->execute([$id, $usuarioId]);

        return $statement->rowCount() > 0;
    }
}
