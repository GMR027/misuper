<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Support\Database;
use PDO;

/**
 * Acceso a api_tokens. Solo se guardan hashes; el token en claro nunca llega
 * a la base de datos.
 */
final class ApiTokenRepository
{
    private readonly PDO $pdo;

    public function __construct(?PDO $pdo = null)
    {
        $this->pdo = $pdo ?? Database::connection();
    }

    public function create(
        int $usuarioId,
        string $tokenHash,
        ?string $deviceName,
        string $expiresAt
    ): void {
        $statement = $this->pdo->prepare(
            'INSERT INTO api_tokens (usuario_id, token_hash, device_name, expires_at)
             VALUES (?, ?, ?, ?)'
        );
        $statement->execute([$usuarioId, $tokenHash, $deviceName, $expiresAt]);
    }

    /**
     * Token vigente, o null si no existe o ya expiró.
     *
     * @return array{id: int, usuario_id: int}|null
     */
    public function findValidByHash(string $tokenHash): ?array
    {
        $statement = $this->pdo->prepare(
            'SELECT id, usuario_id FROM api_tokens
             WHERE token_hash = ? AND expires_at > NOW()
             LIMIT 1'
        );
        $statement->execute([$tokenHash]);

        $row = $statement->fetch();

        if ($row === false) {
            return null;
        }

        return [
            'id' => (int) $row['id'],
            'usuario_id' => (int) $row['usuario_id'],
        ];
    }

    /**
     * Marca el token como usado, como máximo una vez por hora: escribir en
     * cada petición de la app sería ruido innecesario.
     */
    public function touch(int $id): void
    {
        $statement = $this->pdo->prepare(
            'UPDATE api_tokens SET last_used_at = NOW()
             WHERE id = ?
               AND (last_used_at IS NULL OR last_used_at < NOW() - INTERVAL 1 HOUR)'
        );
        $statement->execute([$id]);
    }

    public function deleteByHash(string $tokenHash): bool
    {
        $statement = $this->pdo->prepare('DELETE FROM api_tokens WHERE token_hash = ?');
        $statement->execute([$tokenHash]);

        return $statement->rowCount() > 0;
    }

    public function deleteExpiredForUser(int $usuarioId): void
    {
        $statement = $this->pdo->prepare(
            'DELETE FROM api_tokens WHERE usuario_id = ? AND expires_at <= NOW()'
        );
        $statement->execute([$usuarioId]);
    }

    /**
     * Revoca todos los tokens de una cuenta, opcionalmente conservando uno.
     * Se usa al cambiar la contraseña: las demás sesiones dejan de valer.
     */
    public function deleteAllForUser(int $usuarioId, ?string $exceptTokenHash = null): void
    {
        if ($exceptTokenHash === null) {
            $statement = $this->pdo->prepare('DELETE FROM api_tokens WHERE usuario_id = ?');
            $statement->execute([$usuarioId]);

            return;
        }

        $statement = $this->pdo->prepare(
            'DELETE FROM api_tokens WHERE usuario_id = ? AND token_hash <> ?'
        );
        $statement->execute([$usuarioId, $exceptTokenHash]);
    }
}
