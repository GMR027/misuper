<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Support\Database;
use PDO;

/**
 * Consultas de precios por usuario.
 *
 * Los precios salen de compra_items (incluye compras capturadas y tickets).
 * Las muestras se limitan por producto y se ordenan de la compra más reciente
 * a la más antigua.
 */
final class PrecioRepository
{
    private readonly PDO $pdo;

    public function __construct(?PDO $pdo = null)
    {
        $this->pdo = $pdo ?? Database::connection();
    }

    /**
     * @return array<int, array{
     *     producto_id: int,
     *     cantidad: float,
     *     precio_total: float,
     *     unidad: string|null,
     *     comercio: string|null,
     *     fecha: string,
     *     item_id: int
     * }>
     */
    public function muestras(int $usuarioId, int $limite = 5): array
    {
        $limite = max(1, min(50, $limite));

        $statement = $this->pdo->prepare(
            'SELECT t.producto_id, t.cantidad, t.precio_total, t.unidad, t.comercio,
                    t.fecha, t.item_id
             FROM (
                 SELECT ci.producto_id,
                        ci.cantidad,
                        ci.precio_total,
                        COALESCE(ci.unidad_base, p.unidad_base) AS unidad,
                        COALESCE(ci.comercio, c.comercio) AS comercio,
                        c.fecha,
                        ci.id AS item_id,
                        ROW_NUMBER() OVER (
                            PARTITION BY ci.producto_id
                            ORDER BY c.fecha DESC, ci.id DESC
                        ) AS rn
                 FROM compra_items ci
                 INNER JOIN compras c ON c.id = ci.compra_id
                 INNER JOIN productos p ON p.id = ci.producto_id
                 WHERE c.usuario_id = ?
                   AND ci.producto_id IS NOT NULL
                   AND ci.cantidad > 0
                   AND ci.precio_total > 0
             ) t
             WHERE t.rn <= ?
             ORDER BY t.producto_id ASC, t.rn ASC'
        );
        $statement->bindValue(1, $usuarioId, PDO::PARAM_INT);
        $statement->bindValue(2, $limite, PDO::PARAM_INT);
        $statement->execute();

        return array_map(
            static fn (array $row): array => [
                'producto_id' => (int) $row['producto_id'],
                'cantidad' => (float) $row['cantidad'],
                'precio_total' => (float) $row['precio_total'],
                'unidad' => $row['unidad'] !== null ? (string) $row['unidad'] : null,
                'comercio' => $row['comercio'] !== null ? (string) $row['comercio'] : null,
                'fecha' => (string) $row['fecha'],
                'item_id' => (int) $row['item_id'],
            ],
            $statement->fetchAll()
        );
    }

    /**
     * @return array<int, array{
     *     cantidad: float,
     *     precio_total: float,
     *     unidad: string|null,
     *     comercio: string|null,
     *     fecha: string,
     *     item_id: int
     * }>
     */
    public function historial(int $usuarioId, int $productoId, int $limite = 12): array
    {
        $limite = max(1, min(100, $limite));

        $statement = $this->pdo->prepare(
            'SELECT ci.cantidad, ci.precio_total,
                    COALESCE(ci.unidad_base, p.unidad_base) AS unidad,
                    COALESCE(ci.comercio, c.comercio) AS comercio,
                    c.fecha, ci.id AS item_id
             FROM compra_items ci
             INNER JOIN compras c ON c.id = ci.compra_id
             INNER JOIN productos p ON p.id = ci.producto_id
             WHERE c.usuario_id = ?
               AND ci.producto_id = ?
               AND ci.cantidad > 0
               AND ci.precio_total > 0
             ORDER BY c.fecha DESC, ci.id DESC
             LIMIT ?'
        );
        $statement->bindValue(1, $usuarioId, PDO::PARAM_INT);
        $statement->bindValue(2, $productoId, PDO::PARAM_INT);
        $statement->bindValue(3, $limite, PDO::PARAM_INT);
        $statement->execute();

        return array_map(
            static fn (array $row): array => [
                'cantidad' => (float) $row['cantidad'],
                'precio_total' => (float) $row['precio_total'],
                'unidad' => $row['unidad'] !== null ? (string) $row['unidad'] : null,
                'comercio' => $row['comercio'] !== null ? (string) $row['comercio'] : null,
                'fecha' => (string) $row['fecha'],
                'item_id' => (int) $row['item_id'],
            ],
            $statement->fetchAll()
        );
    }

    /**
     * @return array<int, array{precio_unidad: float, updated_at: string}>
     */
    public function manuales(int $usuarioId): array
    {
        $statement = $this->pdo->prepare(
            'SELECT producto_id, precio_unidad, updated_at
             FROM precios_manuales
             WHERE usuario_id = ?'
        );
        $statement->execute([$usuarioId]);

        $items = [];

        foreach ($statement->fetchAll() as $row) {
            $items[(int) $row['producto_id']] = [
                'precio_unidad' => (float) $row['precio_unidad'],
                'updated_at' => (string) $row['updated_at'],
            ];
        }

        return $items;
    }

    public function guardarManual(int $usuarioId, int $productoId, string $precio): void
    {
        $statement = $this->pdo->prepare(
            'INSERT INTO precios_manuales (usuario_id, producto_id, precio_unidad)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE precio_unidad = ?, updated_at = CURRENT_TIMESTAMP'
        );
        $statement->execute([$usuarioId, $productoId, $precio, $precio]);
    }

    public function eliminarManual(int $usuarioId, int $productoId): bool
    {
        $statement = $this->pdo->prepare(
            'DELETE FROM precios_manuales WHERE usuario_id = ? AND producto_id = ?'
        );
        $statement->execute([$usuarioId, $productoId]);

        return $statement->rowCount() > 0;
    }

    /**
     * @return array<int, string>
     */
    public function comercios(int $usuarioId, int $limite = 20): array
    {
        $limite = max(1, min(100, $limite));

        $statement = $this->pdo->prepare(
            "SELECT comercio
             FROM (
                 SELECT c.comercio
                 FROM compras c
                 WHERE c.usuario_id = ? AND c.comercio IS NOT NULL AND c.comercio <> ''
                 UNION
                 SELECT ci.comercio
                 FROM compra_items ci
                 INNER JOIN compras c2 ON c2.id = ci.compra_id
                 WHERE c2.usuario_id = ? AND ci.comercio IS NOT NULL AND ci.comercio <> ''
             ) t
             GROUP BY comercio
             ORDER BY COUNT(*) DESC, comercio ASC
             LIMIT ?"
        );
        $statement->bindValue(1, $usuarioId, PDO::PARAM_INT);
        $statement->bindValue(2, $usuarioId, PDO::PARAM_INT);
        $statement->bindValue(3, $limite, PDO::PARAM_INT);
        $statement->execute();

        return array_map('strval', $statement->fetchAll(PDO::FETCH_COLUMN));
    }
}
