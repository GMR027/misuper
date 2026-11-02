<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Models\Ticket;
use App\Support\Database;
use PDO;

/**
 * Acceso a la tabla tickets. Todas las consultas se limitan al dueño.
 */
final class TicketRepository
{
    private const COLUMNS = 't.id, t.usuario_id, t.compra_id, t.ruta, t.texto_ocr,
        t.total_detectado, t.estado, t.created_at';

    private readonly PDO $pdo;

    public function __construct(?PDO $pdo = null)
    {
        $this->pdo = $pdo ?? Database::connection();
    }

    public function create(
        int $usuarioId,
        string $ruta,
        string $textoOcr,
        ?string $totalDetectado
    ): Ticket {
        $statement = $this->pdo->prepare(
            'INSERT INTO tickets (usuario_id, ruta, texto_ocr, total_detectado)
             VALUES (?, ?, ?, ?)'
        );
        $statement->execute([$usuarioId, $ruta, $textoOcr, $totalDetectado]);

        $ticket = $this->findOwned((int) $this->pdo->lastInsertId(), $usuarioId);

        if ($ticket === null) {
            throw new \RuntimeException('No se pudo leer el ticket recién creado.');
        }

        return $ticket;
    }

    public function findOwned(int $id, int $usuarioId): ?Ticket
    {
        $statement = $this->pdo->prepare(
            'SELECT ' . self::COLUMNS . '
             FROM tickets t
             WHERE t.id = ? AND t.usuario_id = ?
             LIMIT 1'
        );
        $statement->execute([$id, $usuarioId]);

        $row = $statement->fetch();

        return $row === false ? null : Ticket::fromRow($row);
    }

    /**
     * Confirma un ticket solo si sigue pendiente. Evita compras duplicadas
     * cuando dos peticiones intentan confirmar el mismo ticket.
     */
    public function marcarConfirmado(int $id, int $usuarioId, int $compraId): bool
    {
        $statement = $this->pdo->prepare(
            "UPDATE tickets
             SET compra_id = ?, estado = 'confirmado'
             WHERE id = ? AND usuario_id = ? AND compra_id IS NULL AND estado = 'procesado'"
        );
        $statement->execute([$compraId, $id, $usuarioId]);

        return $statement->rowCount() > 0;
    }

    public function countRecent(int $usuarioId, int $segundos): int
    {
        $desde = (new \DateTimeImmutable())
            ->modify(sprintf('-%d seconds', max(1, $segundos)))
            ->format('Y-m-d H:i:s');

        $statement = $this->pdo->prepare(
            'SELECT COUNT(*) FROM tickets WHERE usuario_id = ? AND created_at >= ?'
        );
        $statement->execute([$usuarioId, $desde]);

        return (int) $statement->fetchColumn();
    }

    /**
     * @return array<int, string>
     */
    public function rutasDeUsuario(int $usuarioId): array
    {
        $statement = $this->pdo->prepare('SELECT ruta FROM tickets WHERE usuario_id = ?');
        $statement->execute([$usuarioId]);

        return array_map('strval', $statement->fetchAll(PDO::FETCH_COLUMN));
    }

    public function delete(int $id, int $usuarioId): bool
    {
        $statement = $this->pdo->prepare(
            'DELETE FROM tickets WHERE id = ? AND usuario_id = ?'
        );
        $statement->execute([$id, $usuarioId]);

        return $statement->rowCount() > 0;
    }
}
