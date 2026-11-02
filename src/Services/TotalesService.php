<?php

declare(strict_types=1);

namespace App\Services;

use App\Support\Database;
use PDO;

/**
 * Recalcula y persiste la caché compras.total a partir de sus ítems.
 */
final class TotalesService
{
    private readonly PDO $pdo;

    public function __construct(?PDO $pdo = null)
    {
        $this->pdo = $pdo ?? Database::connection();
    }

    public function recalcular(int $compraId): void
    {
        $statement = $this->pdo->prepare(
            'UPDATE compras
             SET total = (
                 SELECT COALESCE(SUM(precio_total), 0)
                 FROM compra_items
                 WHERE compra_id = ?
             )
             WHERE id = ?'
        );
        $statement->execute([$compraId, $compraId]);
    }
}
