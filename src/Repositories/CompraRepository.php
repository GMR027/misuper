<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Models\Compra;
use App\Models\CompraItem;
use App\Models\Producto;
use App\Services\NormalizadorService;
use App\Support\Database;
use PDO;

/**
 * Acceso a compras, compra_items y consultas de productos para la captura.
 *
 * Todas las consultas usan prepared statements.
 */
final class CompraRepository
{
    private const COMPRA_COLUMNS = 'c.id, c.usuario_id, c.fecha, c.total, c.comercio, c.created_at, c.updated_at,
        (SELECT t.id FROM tickets t WHERE t.compra_id = c.id ORDER BY t.id DESC LIMIT 1) AS ticket_id,
        (SELECT t.titulo FROM tickets t WHERE t.compra_id = c.id ORDER BY t.id DESC LIMIT 1) AS ticket_titulo';

    private const ITEM_COLUMNS = 'ci.id, ci.compra_id, ci.producto_id, ci.nombre_libre,
        ci.unidad_base, ci.comercio, ci.cantidad, ci.precio_total,
        p.nombre AS producto_nombre, p.unidad_base AS producto_unidad';

    private readonly PDO $pdo;

    public function __construct(?PDO $pdo = null)
    {
        $this->pdo = $pdo ?? Database::connection();
    }

    public function create(int $usuarioId, string $fecha, ?string $comercio = null): int
    {
        $statement = $this->pdo->prepare(
            'INSERT INTO compras (usuario_id, fecha, comercio, total) VALUES (?, ?, ?, 0)'
        );
        $statement->execute([$usuarioId, $fecha, $comercio]);

        return (int) $this->pdo->lastInsertId();
    }

    public function findOwned(int $id, int $usuarioId): ?Compra
    {
        $statement = $this->pdo->prepare(
            'SELECT ' . self::COMPRA_COLUMNS . '
             FROM compras c
             WHERE c.id = ? AND c.usuario_id = ?
             LIMIT 1'
        );
        $statement->execute([$id, $usuarioId]);

        $row = $statement->fetch();

        return $row === false ? null : Compra::fromRow($row);
    }

    /**
     * @return array{items: array<int, array{compra: Compra, items_count: int}>, total: int}
     */
    public function listByUser(int $usuarioId, int $page, int $perPage): array
    {
        $count = $this->pdo->prepare('SELECT COUNT(*) FROM compras WHERE usuario_id = ?');
        $count->execute([$usuarioId]);
        $total = (int) $count->fetchColumn();

        $offset = ($page - 1) * $perPage;

        $statement = $this->pdo->prepare(
            'SELECT ' . self::COMPRA_COLUMNS . ',
                (SELECT COUNT(*) FROM compra_items ci WHERE ci.compra_id = c.id) AS items_count
             FROM compras c
             WHERE c.usuario_id = ?
             ORDER BY c.fecha DESC, c.id DESC
             LIMIT ? OFFSET ?'
        );
        $statement->bindValue(1, $usuarioId, PDO::PARAM_INT);
        $statement->bindValue(2, $perPage, PDO::PARAM_INT);
        $statement->bindValue(3, $offset, PDO::PARAM_INT);
        $statement->execute();

        $items = [];

        foreach ($statement->fetchAll() as $row) {
            $items[] = [
                'compra' => Compra::fromRow($row),
                'items_count' => (int) $row['items_count'],
            ];
        }

        return ['items' => $items, 'total' => $total];
    }

    public function updateFecha(int $id, int $usuarioId, string $fecha): void
    {
        $statement = $this->pdo->prepare(
            'UPDATE compras SET fecha = ? WHERE id = ? AND usuario_id = ?'
        );
        $statement->execute([$fecha, $id, $usuarioId]);
    }

    public function updateComercio(int $id, int $usuarioId, ?string $comercio): void
    {
        $statement = $this->pdo->prepare(
            'UPDATE compras SET comercio = ? WHERE id = ? AND usuario_id = ?'
        );
        $statement->execute([$comercio, $id, $usuarioId]);
    }

    public function delete(int $id, int $usuarioId): bool
    {
        $statement = $this->pdo->prepare(
            'DELETE FROM compras WHERE id = ? AND usuario_id = ?'
        );
        $statement->execute([$id, $usuarioId]);

        return $statement->rowCount() > 0;
    }

    public function countItems(int $compraId): int
    {
        $statement = $this->pdo->prepare(
            'SELECT COUNT(*) FROM compra_items WHERE compra_id = ?'
        );
        $statement->execute([$compraId]);

        return (int) $statement->fetchColumn();
    }

    /**
     * @return array<int, CompraItem>
     */
    public function items(int $compraId): array
    {
        $statement = $this->pdo->prepare(
            'SELECT ' . self::ITEM_COLUMNS . '
             FROM compra_items ci
             LEFT JOIN productos p ON p.id = ci.producto_id
             WHERE ci.compra_id = ?
             ORDER BY ci.id ASC'
        );
        $statement->execute([$compraId]);

        return array_map(
            static fn (array $row): CompraItem => CompraItem::fromRow($row),
            $statement->fetchAll()
        );
    }

    public function findItemWithProduct(int $itemId): ?CompraItem
    {
        $statement = $this->pdo->prepare(
            'SELECT ' . self::ITEM_COLUMNS . '
             FROM compra_items ci
             LEFT JOIN productos p ON p.id = ci.producto_id
             WHERE ci.id = ?
             LIMIT 1'
        );
        $statement->execute([$itemId]);

        $row = $statement->fetch();

        return $row === false ? null : CompraItem::fromRow($row);
    }

    public function findItemOwned(int $itemId, int $compraId, int $usuarioId): ?CompraItem
    {
        $statement = $this->pdo->prepare(
            'SELECT ' . self::ITEM_COLUMNS . '
             FROM compra_items ci
             INNER JOIN compras c ON c.id = ci.compra_id
             LEFT JOIN productos p ON p.id = ci.producto_id
             WHERE ci.id = ? AND ci.compra_id = ? AND c.usuario_id = ?
             LIMIT 1'
        );
        $statement->execute([$itemId, $compraId, $usuarioId]);

        $row = $statement->fetch();

        return $row === false ? null : CompraItem::fromRow($row);
    }

    public function addItem(
        int $compraId,
        ?int $productoId,
        ?string $nombreLibre,
        string $cantidad,
        string $precioTotal,
        ?string $unidadBase = null,
        ?string $comercio = null
    ): int {
        $statement = $this->pdo->prepare(
            'INSERT INTO compra_items
                (compra_id, producto_id, nombre_libre, unidad_base, comercio, cantidad, precio_total)
             VALUES (?, ?, ?, ?, ?, ?, ?)'
        );
        $statement->execute([
            $compraId,
            $productoId,
            $nombreLibre,
            $unidadBase,
            $comercio,
            $cantidad,
            $precioTotal,
        ]);

        return (int) $this->pdo->lastInsertId();
    }

    /**
     * @param array<string, mixed> $campos Claves permitidas: cantidad, precio_total, unidad_base, comercio.
     */
    public function updateItem(int $itemId, array $campos): void
    {
        $sets = [];
        $params = [];

        foreach (['cantidad', 'precio_total', 'unidad_base', 'comercio'] as $columna) {
            if (array_key_exists($columna, $campos)) {
                $sets[] = $columna . ' = ?';
                $params[] = $campos[$columna];
            }
        }

        if ($sets === []) {
            return;
        }

        $params[] = $itemId;

        $statement = $this->pdo->prepare(
            'UPDATE compra_items SET ' . implode(', ', $sets) . ' WHERE id = ?'
        );
        $statement->execute($params);
    }

    public function deleteItem(int $itemId): void
    {
        $statement = $this->pdo->prepare('DELETE FROM compra_items WHERE id = ?');
        $statement->execute([$itemId]);
    }

    /**
     * @return array{id: int, nombre: string, unidad_base: string}|null
     */
    public function productoActivo(int $id, ?int $usuarioId = null): ?array
    {
        $sql = "SELECT id, nombre, unidad_base FROM productos
                WHERE id = ? AND estado = 'activo'";
        $params = [$id];

        if ($usuarioId !== null) {
            $sql .= ' AND (usuario_id IS NULL OR usuario_id = ?)';
            $params[] = $usuarioId;
        }

        $sql .= ' LIMIT 1';

        $statement = $this->pdo->prepare($sql);
        $statement->execute($params);

        $row = $statement->fetch();

        if ($row === false) {
            return null;
        }

        return [
            'id' => (int) $row['id'],
            'nombre' => (string) $row['nombre'],
            'unidad_base' => (string) $row['unidad_base'],
        ];
    }

    /**
     * Productos que el usuario ha comprado con más frecuencia.
     *
     * @return array<int, array{id: int, nombre: string, categoria_id: int, unidad_base: string, imagen_url: string|null, veces_comprado: int, ultimo_precio: float|null}>
     */
    public function frecuentes(int $usuarioId, int $limit): array
    {
        $statement = $this->pdo->prepare(
            "SELECT p.id, p.nombre, p.categoria_id, p.unidad_base, p.imagen_url,
                    COUNT(*) AS veces_comprado,
                    MAX(ult.precio_unidad) AS ultimo_precio
             FROM compra_items ci
             INNER JOIN compras c ON c.id = ci.compra_id
             INNER JOIN productos p ON p.id = ci.producto_id
             LEFT JOIN (
                 SELECT ci2.producto_id,
                        ci2.precio_total / NULLIF(ci2.cantidad, 0) AS precio_unidad,
                        ROW_NUMBER() OVER (
                            PARTITION BY ci2.producto_id
                            ORDER BY c2.fecha DESC, ci2.id DESC
                        ) AS rn
                 FROM compra_items ci2
                 INNER JOIN compras c2 ON c2.id = ci2.compra_id
                 WHERE c2.usuario_id = ?
                   AND ci2.producto_id IS NOT NULL
                   AND ci2.cantidad > 0
             ) ult ON ult.producto_id = p.id AND ult.rn = 1
             WHERE c.usuario_id = ? AND p.estado = 'activo'
             GROUP BY p.id, p.nombre, p.categoria_id, p.unidad_base, p.imagen_url
             ORDER BY veces_comprado DESC, p.nombre ASC
             LIMIT ?"
        );
        $statement->bindValue(1, $usuarioId, PDO::PARAM_INT);
        $statement->bindValue(2, $usuarioId, PDO::PARAM_INT);
        $statement->bindValue(3, $limit, PDO::PARAM_INT);
        $statement->execute();

        $items = [];

        foreach ($statement->fetchAll() as $row) {
            $items[] = [
                'id' => (int) $row['id'],
                'nombre' => (string) $row['nombre'],
                'categoria_id' => (int) $row['categoria_id'],
                'unidad_base' => (string) $row['unidad_base'],
                'imagen_url' => isset($row['imagen_url']) ? (string) $row['imagen_url'] : null,
                'veces_comprado' => (int) $row['veces_comprado'],
                'ultimo_precio' => isset($row['ultimo_precio']) ? (float) $row['ultimo_precio'] : null,
            ];
        }

        return $items;
    }

    /**
     * Productos que el usuario ha comprado, agrupados por nombre de producto.
     * Es la base para la "despensa inferida" de las recetas.
     *
     * @param int|array<int, int>|null $compraIds Una compra o una selección de compras.
     * @return array<int, array{producto_id: int|null, nombre: string, unidad_base: string|null, categoria_nombre: string|null, veces: int, ultima_compra: string}>
     */
    public function despensa(int $usuarioId, ?int $dias = null, int|array|null $compraIds = null): array
    {
        $where = ['c.usuario_id = ?'];
        $params = [$usuarioId];

        $ids = [];

        if (is_array($compraIds)) {
            foreach ($compraIds as $compraId) {
                $compraId = (int) $compraId;

                if ($compraId > 0) {
                    $ids[$compraId] = $compraId;
                }
            }
        } elseif ($compraIds !== null && $compraIds > 0) {
            $ids[$compraIds] = $compraIds;
        }

        if ($ids !== []) {
            $ids = array_slice(array_values($ids), 0, 50);
            $where[] = 'c.id IN (' . implode(', ', array_fill(0, count($ids), '?')) . ')';
            array_push($params, ...$ids);
        }

        if ($dias !== null && $dias > 0) {
            $where[] = 'c.fecha >= DATE_SUB(CURDATE(), INTERVAL ? DAY)';
            $params[] = $dias;
        }

        $where[] = "(cat.nombre IS NULL OR cat.nombre NOT IN ('Limpieza', 'Hogar'))";

        $statement = $this->pdo->prepare(
            'SELECT COALESCE(p.nombre, ci.nombre_libre) AS nombre,
                    p.id AS producto_id,
                    p.unidad_base,
                    cat.nombre AS categoria_nombre,
                    COUNT(*) AS veces,
                    MAX(c.fecha) AS ultima_compra
             FROM compra_items ci
             INNER JOIN compras c ON c.id = ci.compra_id
             LEFT JOIN productos p ON p.id = ci.producto_id
             LEFT JOIN categorias cat ON cat.id = p.categoria_id
             WHERE ' . implode(' AND ', $where) . '
             GROUP BY COALESCE(p.nombre, ci.nombre_libre), p.id, p.unidad_base, cat.nombre
             ORDER BY veces DESC, nombre ASC'
        );

        $index = 1;

        foreach ($params as $param) {
            $statement->bindValue(
                $index++,
                $param,
                is_int($param) ? PDO::PARAM_INT : PDO::PARAM_STR
            );
        }

        $statement->execute();

        $items = [];

        foreach ($statement->fetchAll() as $row) {
            $items[] = [
                'producto_id' => $row['producto_id'] === null ? null : (int) $row['producto_id'],
                'nombre' => (string) $row['nombre'],
                'unidad_base' => isset($row['unidad_base']) ? (string) $row['unidad_base'] : null,
                'categoria_nombre' => isset($row['categoria_nombre']) ? (string) $row['categoria_nombre'] : null,
                'veces' => (int) $row['veces'],
                'ultima_compra' => (string) $row['ultima_compra'],
            ];
        }

        return $items;
    }

    /**
     * Compra más reciente del usuario, según la fecha de compra.
     *
     * @return array{id: int, fecha: string}|null
     */
    public function ultimaCompra(int $usuarioId): ?array
    {
        $statement = $this->pdo->prepare(
            'SELECT id, fecha
             FROM compras
             WHERE usuario_id = ?
             ORDER BY fecha DESC, id DESC
             LIMIT 1'
        );
        $statement->execute([$usuarioId]);

        $row = $statement->fetch();

        if ($row === false) {
            return null;
        }

        return [
            'id' => (int) $row['id'],
            'fecha' => (string) $row['fecha'],
        ];
    }

    /**
     * Resúmenes de compras concretas del usuario, ordenados de más reciente a más antigua.
     *
     * @param array<int, int> $compraIds
     * @return array<int, array{id: int, fecha: string, total: float, comercio: string|null, items_count: int}>
     */
    public function resumenes(int $usuarioId, array $compraIds): array
    {
        $ids = [];

        foreach ($compraIds as $compraId) {
            $compraId = (int) $compraId;

            if ($compraId > 0) {
                $ids[$compraId] = $compraId;
            }
        }

        if ($ids === []) {
            return [];
        }

        $ids = array_slice(array_values($ids), 0, 50);
        $statement = $this->pdo->prepare(
            'SELECT c.id, c.fecha, c.total, c.comercio,
                    (SELECT COUNT(*) FROM compra_items ci WHERE ci.compra_id = c.id) AS items_count
             FROM compras c
             WHERE c.usuario_id = ?
               AND c.id IN (' . implode(', ', array_fill(0, count($ids), '?')) . ')
             ORDER BY c.fecha DESC, c.id DESC'
        );
        $statement->execute([$usuarioId, ...$ids]);

        $resumenes = [];

        foreach ($statement->fetchAll() as $row) {
            $resumenes[] = [
                'id' => (int) $row['id'],
                'fecha' => (string) $row['fecha'],
                'total' => round((float) $row['total'], 2),
                'comercio' => isset($row['comercio']) && $row['comercio'] !== ''
                    ? (string) $row['comercio']
                    : null,
                'items_count' => (int) $row['items_count'],
            ];
        }

        return $resumenes;
    }

    /**
     * Búsqueda de productos activos sin paginación (máximo 10 por defecto).
     *
     * @return array<int, array<string, mixed>>
     */
    public function buscarActivos(string $q, ?int $categoriaId, int $limit, ?int $usuarioId = null): array
    {
        $where = ["p.estado = 'activo'"];
        $params = [];
        $join = '';
        $joinParams = [];

        if ($usuarioId !== null) {
            $where[] = '(p.usuario_id IS NULL OR p.usuario_id = ?)';
            $params[] = $usuarioId;

            $join = " LEFT JOIN (
                SELECT ci2.producto_id,
                       ci2.precio_total / NULLIF(ci2.cantidad, 0) AS precio_unidad,
                       ROW_NUMBER() OVER (
                           PARTITION BY ci2.producto_id
                           ORDER BY c2.fecha DESC, ci2.id DESC
                       ) AS rn
                FROM compra_items ci2
                INNER JOIN compras c2 ON c2.id = ci2.compra_id
                WHERE c2.usuario_id = ?
                  AND ci2.producto_id IS NOT NULL
                  AND ci2.cantidad > 0
            ) ult ON ult.producto_id = p.id AND ult.rn = 1";
            $joinParams[] = $usuarioId;
        } else {
            $where[] = 'p.usuario_id IS NULL';
        }

        if ($q !== '') {
            // La collation general_ci es insensible a mayúsculas y acentos.
            $where[] = "LOWER(p.nombre) COLLATE utf8mb4_general_ci LIKE ? ESCAPE '!'";
            $params[] = '%' . NormalizadorService::patronLike($q) . '%';
        }

        if ($categoriaId !== null) {
            $where[] = 'p.categoria_id = ?';
            $params[] = $categoriaId;
        }

        $selectPrecio = $usuarioId !== null
            ? 'ROUND(ult.precio_unidad, 4) AS ultimo_precio'
            : 'NULL AS ultimo_precio';

        $statement = $this->pdo->prepare(
            'SELECT p.id, p.nombre, p.categoria_id, c.nombre AS categoria_nombre,
                    p.unidad_base, p.imagen_url, p.estado, p.created_at, p.updated_at,
                    ' . $selectPrecio . '
             FROM productos p
             INNER JOIN categorias c ON c.id = p.categoria_id' . $join . '
             WHERE ' . implode(' AND ', $where) . '
             ORDER BY p.nombre ASC, p.id ASC
             LIMIT ?'
        );

        $index = 1;

        foreach (array_merge($joinParams, $params) as $param) {
            $statement->bindValue(
                $index++,
                $param,
                is_int($param) ? PDO::PARAM_INT : PDO::PARAM_STR
            );
        }

        $statement->bindValue($index, $limit, PDO::PARAM_INT);
        $statement->execute();

        return array_map(
            static function (array $row): array {
                $producto = Producto::fromRow($row)->toPublicArray();
                $producto['ultimo_precio'] = isset($row['ultimo_precio'])
                    ? (float) $row['ultimo_precio']
                    : null;

                return $producto;
            },
            $statement->fetchAll()
        );
    }
}
