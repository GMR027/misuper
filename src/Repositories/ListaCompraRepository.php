<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Support\Database;
use PDO;
use Throwable;

/**
 * Ítems de la lista "Productos por comprar".
 */
final class ListaCompraRepository
{
    private const COLUMNS = 'li.id, li.usuario_id, li.producto_id, li.nombre, li.cantidad,
        li.unidad_base, li.origen, li.estado, li.created_at, li.updated_at,
        p.imagen_url, c.nombre AS categoria_nombre';

    private const FROM = ' FROM lista_compra_items li
        LEFT JOIN productos p ON p.id = li.producto_id
        LEFT JOIN categorias c ON c.id = p.categoria_id';

    private readonly PDO $pdo;

    public function __construct(?PDO $pdo = null)
    {
        $this->pdo = $pdo ?? Database::connection();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function listByUser(int $usuarioId): array
    {
        $statement = $this->pdo->prepare(
            'SELECT ' . self::COLUMNS . self::FROM
            . ' WHERE li.usuario_id = ?
                ORDER BY FIELD(li.estado, \'pendiente\', \'enviado\', \'cargado\'), li.created_at ASC, li.id ASC'
        );
        $statement->execute([$usuarioId]);

        return array_map([$this, 'normalizarFila'], $statement->fetchAll());
    }

    public function findOwned(int $id, int $usuarioId): ?array
    {
        $statement = $this->pdo->prepare(
            'SELECT ' . self::COLUMNS . self::FROM
            . ' WHERE li.id = ? AND li.usuario_id = ? LIMIT 1'
        );
        $statement->execute([$id, $usuarioId]);

        $row = $statement->fetch();

        return $row === false ? null : $this->normalizarFila($row);
    }

    /**
     * @param array<int, array{producto_id: int|null, nombre: string, cantidad: float|int|string, unidad_base: string, origen: string|null}> $items
     * @return array<int, array<string, mixed>>
     */
    public function createMany(int $usuarioId, array $items): array
    {
        $this->pdo->beginTransaction();

        try {
            $statement = $this->pdo->prepare(
                'INSERT INTO lista_compra_items
                    (usuario_id, producto_id, nombre, cantidad, unidad_base, origen)
                 VALUES (?, ?, ?, ?, ?, ?)'
            );

            foreach ($items as $item) {
                $statement->execute([
                    $usuarioId,
                    $item['producto_id'],
                    $item['nombre'],
                    $item['cantidad'],
                    $item['unidad_base'],
                    $item['origen'],
                ]);
            }

            $this->pdo->commit();
        } catch (Throwable $error) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }

            throw $error;
        }

        return $this->listByUser($usuarioId);
    }

    /**
     * @param array<string, mixed> $campos
     */
    public function update(int $id, int $usuarioId, array $campos): ?array
    {
        $sets = [];
        $params = [];

        foreach (['nombre', 'cantidad', 'unidad_base'] as $columna) {
            if (array_key_exists($columna, $campos)) {
                $sets[] = $columna . ' = ?';
                $params[] = $campos[$columna];
            }
        }

        if ($sets === []) {
            return $this->findOwned($id, $usuarioId);
        }

        $params[] = $id;
        $params[] = $usuarioId;

        $statement = $this->pdo->prepare(
            'UPDATE lista_compra_items
             SET ' . implode(', ', $sets) . '
             WHERE id = ? AND usuario_id = ?'
        );
        $statement->execute($params);

        return $this->findOwned($id, $usuarioId);
    }

    public function delete(int $id, int $usuarioId): bool
    {
        $statement = $this->pdo->prepare(
            'DELETE FROM lista_compra_items WHERE id = ? AND usuario_id = ?'
        );
        $statement->execute([$id, $usuarioId]);

        return $statement->rowCount() > 0;
    }

    public function clear(int $usuarioId): int
    {
        $statement = $this->pdo->prepare(
            'DELETE FROM lista_compra_items WHERE usuario_id = ?'
        );
        $statement->execute([$usuarioId]);

        return $statement->rowCount();
    }

    public function markEnviado(int $usuarioId): int
    {
        $statement = $this->pdo->prepare(
            "UPDATE lista_compra_items
             SET estado = 'enviado'
             WHERE usuario_id = ? AND estado = 'pendiente'"
        );
        $statement->execute([$usuarioId]);

        return $statement->rowCount();
    }

    /**
     * Devuelve los ítems enviados y los marca como cargados en una sola
     * transacción. La pantalla rápida los consume al llegar con ?lista=1.
     *
     * @return array<int, array<string, mixed>>
     */
    public function consume(int $usuarioId): array
    {
        $this->pdo->beginTransaction();

        try {
            $statement = $this->pdo->prepare(
                'SELECT ' . self::COLUMNS . self::FROM
                . " WHERE li.usuario_id = ? AND li.estado = 'enviado'
                    ORDER BY li.created_at ASC, li.id ASC
                    FOR UPDATE"
            );
            $statement->execute([$usuarioId]);
            $rows = $statement->fetchAll();

            if ($rows !== []) {
                $ids = array_map(static fn (array $row): int => (int) $row['id'], $rows);
                $placeholders = implode(', ', array_fill(0, count($ids), '?'));
                $update = $this->pdo->prepare(
                    "UPDATE lista_compra_items
                     SET estado = 'cargado'
                     WHERE usuario_id = ? AND id IN ({$placeholders})"
                );
                $update->execute(array_merge([$usuarioId], $ids));
            }

            $this->pdo->commit();

            foreach ($rows as &$row) {
                $row['estado'] = 'cargado';
            }

            unset($row);

            return array_map([$this, 'normalizarFila'], $rows);
        } catch (Throwable $error) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }

            throw $error;
        }
    }

    public function countPendientes(int $usuarioId): int
    {
        $statement = $this->pdo->prepare(
            "SELECT COUNT(*) FROM lista_compra_items
             WHERE usuario_id = ? AND estado = 'pendiente'"
        );
        $statement->execute([$usuarioId]);

        return (int) $statement->fetchColumn();
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function normalizarFila(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'producto_id' => $row['producto_id'] === null ? null : (int) $row['producto_id'],
            'nombre' => (string) $row['nombre'],
            'cantidad' => (float) $row['cantidad'],
            'unidad_base' => (string) $row['unidad_base'],
            'origen' => isset($row['origen']) ? (string) $row['origen'] : null,
            'estado' => (string) $row['estado'],
            'categoria_nombre' => isset($row['categoria_nombre']) ? (string) $row['categoria_nombre'] : null,
            'imagen_url' => isset($row['imagen_url']) ? (string) $row['imagen_url'] : null,
            'created_at' => (string) $row['created_at'],
            'updated_at' => (string) $row['updated_at'],
        ];
    }
}
