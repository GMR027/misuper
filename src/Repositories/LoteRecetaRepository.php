<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Support\Database;
use PDO;

/**
 * Lotes de recetas importadas desde un libro.
 */
final class LoteRecetaRepository
{
    private readonly PDO $pdo;

    public function __construct(?PDO $pdo = null)
    {
        $this->pdo = $pdo ?? Database::connection();
    }

    public function crear(
        string $id,
        string $nombre,
        ?string $autor,
        ?string $archivo,
        ?int $creadoPor
    ): void {
        $statement = $this->pdo->prepare(
            'INSERT INTO lotes_recetas (id, nombre, autor, archivo, total, estado, creado_por)
             VALUES (?, ?, ?, ?, 0, "borrador", ?)'
        );
        $statement->execute([$id, $nombre, $autor, $archivo, $creadoPor]);
    }

    public function asignar(int $recetaId, string $loteId, ?string $origen): void
    {
        $statement = $this->pdo->prepare(
            'UPDATE recetas
             SET lote_id = ?, origen = ?, pasos_reescritos = 1
             WHERE id = ?'
        );
        $statement->execute([$loteId, $origen, $recetaId]);

        $this->actualizarTotal($loteId);
    }

    public function publicar(string $loteId): bool
    {
        $this->pdo->beginTransaction();

        try {
            $recetas = $this->pdo->prepare(
                "UPDATE recetas SET estado = 'publicada' WHERE lote_id = ?"
            );
            $recetas->execute([$loteId]);

            $lote = $this->pdo->prepare(
                "UPDATE lotes_recetas SET estado = 'publicado' WHERE id = ?"
            );
            $lote->execute([$loteId]);

            $this->pdo->commit();

            return $lote->rowCount() > 0;
        } catch (\Throwable $error) {
            $this->pdo->rollBack();

            throw $error;
        }
    }

    public function descartar(string $loteId): bool
    {
        $this->pdo->beginTransaction();

        try {
            $recetas = $this->pdo->prepare('DELETE FROM recetas WHERE lote_id = ?');
            $recetas->execute([$loteId]);

            $lote = $this->pdo->prepare('DELETE FROM lotes_recetas WHERE id = ?');
            $lote->execute([$loteId]);

            $this->pdo->commit();

            return $lote->rowCount() > 0;
        } catch (\Throwable $error) {
            $this->pdo->rollBack();

            throw $error;
        }
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function all(): array
    {
        $statement = $this->pdo->query(
            'SELECT l.*, u.nombre AS creador_nombre,
                    (SELECT COUNT(*) FROM recetas r WHERE r.lote_id = l.id) AS recetas_actuales,
                    (SELECT COUNT(*) FROM recetas r WHERE r.lote_id = l.id AND r.estado = "publicada") AS publicadas
             FROM lotes_recetas l
             LEFT JOIN usuarios u ON u.id = l.creado_por
             ORDER BY l.created_at DESC'
        );

        return $statement->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * @return array<string, mixed>|null
     */
    public function find(string $loteId): ?array
    {
        $statement = $this->pdo->prepare(
            'SELECT * FROM lotes_recetas WHERE id = ? LIMIT 1'
        );
        $statement->execute([$loteId]);
        $fila = $statement->fetch(PDO::FETCH_ASSOC);

        return $fila === false ? null : $fila;
    }

    private function actualizarTotal(string $loteId): void
    {
        $statement = $this->pdo->prepare(
            'UPDATE lotes_recetas
             SET total = (SELECT COUNT(*) FROM recetas WHERE lote_id = ?)
             WHERE id = ?'
        );
        $statement->execute([$loteId, $loteId]);
    }
}
