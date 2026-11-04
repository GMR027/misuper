<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Support\Database;
use PDO;
use Throwable;

/**
 * Listas de compras por usuario y sus ítems.
 */
final class ListaCompraRepository
{
    private const ITEM_COLUMNS = 'li.id, li.lista_id, li.usuario_id, li.producto_id, li.nombre,
        li.cantidad, li.unidad_base, li.origen, li.estado, li.created_at, li.updated_at,
        p.imagen_url, c.nombre AS categoria_nombre';

    private const ITEM_FROM = ' FROM lista_compra_items li
        INNER JOIN listas_compra l ON l.id = li.lista_id
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
    public function listsByUser(int $usuarioId): array
    {
        $statement = $this->pdo->prepare(
            'SELECT l.id, l.usuario_id, l.nombre, l.created_at, l.updated_at,
                    COUNT(li.id) AS items_count,
                    COALESCE(SUM(li.estado = \'pendiente\'), 0) AS pendientes
             FROM listas_compra l
             LEFT JOIN lista_compra_items li ON li.lista_id = l.id
             WHERE l.usuario_id = ?
             GROUP BY l.id, l.usuario_id, l.nombre, l.created_at, l.updated_at
             ORDER BY l.created_at DESC, l.id DESC'
        );
        $statement->execute([$usuarioId]);

        return array_map([$this, 'normalizarLista'], $statement->fetchAll());
    }

    public function findListOwned(int $listId, int $usuarioId): ?array
    {
        $statement = $this->pdo->prepare(
            'SELECT l.id, l.usuario_id, l.nombre, l.created_at, l.updated_at,
                    (SELECT COUNT(*) FROM lista_compra_items li WHERE li.lista_id = l.id) AS items_count,
                    (SELECT COUNT(*) FROM lista_compra_items li WHERE li.lista_id = l.id AND li.estado = \'pendiente\') AS pendientes
             FROM listas_compra l
             WHERE l.id = ? AND l.usuario_id = ?
             LIMIT 1'
        );
        $statement->execute([$listId, $usuarioId]);

        $row = $statement->fetch();

        return $row === false ? null : $this->normalizarLista($row);
    }

    public function createList(int $usuarioId, string $nombre): array
    {
        $statement = $this->pdo->prepare(
            'INSERT INTO listas_compra (usuario_id, nombre) VALUES (?, ?)'
        );
        $statement->execute([$usuarioId, $nombre]);

        $lista = $this->findListOwned((int) $this->pdo->lastInsertId(), $usuarioId);

        if ($lista === null) {
            throw new \RuntimeException('No se pudo leer la lista recién creada.');
        }

        return $lista;
    }

    public function updateList(int $listId, int $usuarioId, string $nombre): ?array
    {
        $statement = $this->pdo->prepare(
            'UPDATE listas_compra SET nombre = ? WHERE id = ? AND usuario_id = ?'
        );
        $statement->execute([$nombre, $listId, $usuarioId]);

        return $this->findListOwned($listId, $usuarioId);
    }

    public function deleteList(int $listId, int $usuarioId): bool
    {
        $statement = $this->pdo->prepare(
            'DELETE FROM listas_compra WHERE id = ? AND usuario_id = ?'
        );
        $statement->execute([$listId, $usuarioId]);

        return $statement->rowCount() > 0;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function itemsByList(int $listId, int $usuarioId): array
    {
        $statement = $this->pdo->prepare(
            'SELECT ' . self::ITEM_COLUMNS . self::ITEM_FROM
            . ' WHERE li.lista_id = ? AND l.usuario_id = ?
                ORDER BY FIELD(li.estado, \'pendiente\', \'enviado\', \'cargado\'), li.created_at ASC, li.id ASC'
        );
        $statement->execute([$listId, $usuarioId]);

        return array_map([$this, 'normalizarItem'], $statement->fetchAll());
    }

    public function findItemOwned(int $itemId, int $usuarioId): ?array
    {
        $statement = $this->pdo->prepare(
            'SELECT ' . self::ITEM_COLUMNS . self::ITEM_FROM
            . ' WHERE li.id = ? AND l.usuario_id = ? LIMIT 1'
        );
        $statement->execute([$itemId, $usuarioId]);

        $row = $statement->fetch();

        return $row === false ? null : $this->normalizarItem($row);
    }

    /**
     * @param array<int, array{producto_id: int|null, nombre: string, cantidad: float|int|string, unidad_base: string, origen: string|null}> $items
     * @return array<int, array<string, mixed>>
     */
    public function createMany(int $usuarioId, int $listId, array $items): array
    {
        $this->pdo->beginTransaction();

        try {
            $statement = $this->pdo->prepare(
                'INSERT INTO lista_compra_items
                    (usuario_id, lista_id, producto_id, nombre, cantidad, unidad_base, origen)
                 VALUES (?, ?, ?, ?, ?, ?, ?)'
            );

            foreach ($items as $item) {
                $statement->execute([
                    $usuarioId,
                    $listId,
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

        return $this->itemsByList($listId, $usuarioId);
    }

    /**
     * @param array<string, mixed> $campos
     */
    public function updateItem(int $itemId, int $usuarioId, array $campos): ?array
    {
        $item = $this->findItemOwned($itemId, $usuarioId);

        if ($item === null) {
            return null;
        }

        $sets = [];
        $params = [];

        foreach (['nombre', 'cantidad', 'unidad_base'] as $columna) {
            if (array_key_exists($columna, $campos)) {
                $sets[] = $columna . ' = ?';
                $params[] = $campos[$columna];
            }
        }

        if ($sets === []) {
            return $item;
        }

        $params[] = $itemId;
        $statement = $this->pdo->prepare(
            'UPDATE lista_compra_items SET ' . implode(', ', $sets) . ' WHERE id = ?'
        );
        $statement->execute($params);

        return $this->findItemOwned($itemId, $usuarioId);
    }

    public function deleteItem(int $itemId, int $usuarioId): bool
    {
        $statement = $this->pdo->prepare(
            'DELETE li FROM lista_compra_items li
             INNER JOIN listas_compra l ON l.id = li.lista_id
             WHERE li.id = ? AND l.usuario_id = ?'
        );
        $statement->execute([$itemId, $usuarioId]);

        return $statement->rowCount() > 0;
    }

    public function clearList(int $listId, int $usuarioId): int
    {
        if ($this->findListOwned($listId, $usuarioId) === null) {
            return 0;
        }

        $statement = $this->pdo->prepare(
            'DELETE FROM lista_compra_items WHERE lista_id = ?'
        );
        $statement->execute([$listId]);

        return $statement->rowCount();
    }

    public function markEnviado(int $listId, int $usuarioId): int
    {
        if ($this->findListOwned($listId, $usuarioId) === null) {
            return 0;
        }

        $statement = $this->pdo->prepare(
            "UPDATE lista_compra_items
             SET estado = 'enviado'
             WHERE lista_id = ? AND estado = 'pendiente'"
        );
        $statement->execute([$listId]);

        return $statement->rowCount();
    }

    /**
     * Devuelve los ítems enviados de todas las listas del usuario y los
     * marca como cargados. La pantalla rápida los consume con ?lista=1.
     *
     * @return array<int, array<string, mixed>>
     */
    public function consume(int $usuarioId): array
    {
        $this->pdo->beginTransaction();

        try {
            $statement = $this->pdo->prepare(
                'SELECT ' . self::ITEM_COLUMNS . self::ITEM_FROM
                . " WHERE l.usuario_id = ? AND li.estado = 'enviado'
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
                     WHERE id IN ({$placeholders})"
                );
                $update->execute($ids);
            }

            $this->pdo->commit();

            foreach ($rows as &$row) {
                $row['estado'] = 'cargado';
            }

            unset($row);

            return array_map([$this, 'normalizarItem'], $rows);
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
            "SELECT COUNT(*) FROM lista_compra_items li
             INNER JOIN listas_compra l ON l.id = li.lista_id
             WHERE l.usuario_id = ? AND li.estado = 'pendiente'"
        );
        $statement->execute([$usuarioId]);

        return (int) $statement->fetchColumn();
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function normalizarLista(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'usuario_id' => (int) $row['usuario_id'],
            'nombre' => (string) $row['nombre'],
            'items_count' => (int) ($row['items_count'] ?? 0),
            'pendientes' => (int) ($row['pendientes'] ?? 0),
            'created_at' => (string) $row['created_at'],
            'updated_at' => (string) $row['updated_at'],
        ];
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function normalizarItem(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'lista_id' => (int) $row['lista_id'],
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
