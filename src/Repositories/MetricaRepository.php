<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Support\Database;
use PDO;

/**
 * Consultas agregadas de métricas personales.
 *
 * Todas las consultas filtran por usuario_id y usan prepared statements.
 */
final class MetricaRepository
{
    private readonly PDO $pdo;

    public function __construct(?PDO $pdo = null)
    {
        $this->pdo = $pdo ?? Database::connection();
    }

    /**
     * Gasto total por mes de un año. Solo devuelve meses con compras.
     *
     * @return array<int, array{mes: int, total: float}>
     */
    public function gastoMensual(int $usuarioId, int $anio): array
    {
        $statement = $this->pdo->prepare(
            'SELECT MONTH(c.fecha) AS mes, SUM(c.total) AS total
             FROM compras c
             WHERE c.usuario_id = ? AND YEAR(c.fecha) = ?
             GROUP BY MONTH(c.fecha)
             ORDER BY mes ASC'
        );
        $statement->execute([$usuarioId, $anio]);

        $items = [];

        foreach ($statement->fetchAll() as $row) {
            $items[] = [
                'mes' => (int) $row['mes'],
                'total' => (float) $row['total'],
            ];
        }

        return $items;
    }

    /**
     * Top de productos por gasto en un mes concreto.
     *
     * Los ítems libres (producto_id NULL) se agrupan por nombre_libre.
     *
     * @return array<int, array{
     *     producto_id: int|null,
     *     nombre: string,
     *     imagen_url: string|null,
     *     gasto: float,
     *     cantidad_total: float
     * }>
     */
    public function topProductos(int $usuarioId, int $mes, int $anio): array
    {
        $statement = $this->pdo->prepare(
            "SELECT ci.producto_id,
                    COALESCE(p.nombre, ci.nombre_libre) AS nombre,
                    p.imagen_url,
                    SUM(ci.precio_total) AS gasto,
                    SUM(ci.cantidad) AS cantidad_total
             FROM compra_items ci
             INNER JOIN compras c ON c.id = ci.compra_id
             LEFT JOIN productos p ON p.id = ci.producto_id
             WHERE c.usuario_id = ? AND MONTH(c.fecha) = ? AND YEAR(c.fecha) = ?
             GROUP BY ci.producto_id, COALESCE(p.nombre, ci.nombre_libre), p.imagen_url
             ORDER BY gasto DESC, nombre ASC
             LIMIT 10"
        );
        $statement->execute([$usuarioId, $mes, $anio]);

        $items = [];

        foreach ($statement->fetchAll() as $row) {
            $items[] = [
                'producto_id' => $row['producto_id'] === null ? null : (int) $row['producto_id'],
                'nombre' => (string) $row['nombre'],
                'imagen_url' => $row['imagen_url'] === null ? null : (string) $row['imagen_url'],
                'gasto' => (float) $row['gasto'],
                'cantidad_total' => (float) $row['cantidad_total'],
            ];
        }

        return $items;
    }
}
