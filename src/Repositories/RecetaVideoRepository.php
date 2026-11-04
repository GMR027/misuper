<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Support\Database;
use PDO;

/**
 * Videos de YouTube asociados a las recetas del catálogo local.
 */
final class RecetaVideoRepository
{
    private readonly PDO $pdo;

    public function __construct(?PDO $pdo = null)
    {
        $this->pdo = $pdo ?? Database::connection();
    }

    /**
     * @return array<string, array{youtube_id: string, titulo: string|null}>
     */
    public function all(): array
    {
        $statement = $this->pdo->query('SELECT receta_slug, youtube_id, titulo FROM recetas_videos');

        $videos = [];

        foreach ($statement->fetchAll() as $row) {
            $videos[(string) $row['receta_slug']] = [
                'youtube_id' => (string) $row['youtube_id'],
                'titulo' => isset($row['titulo']) ? (string) $row['titulo'] : null,
            ];
        }

        return $videos;
    }

    public function find(string $slug): ?array
    {
        $statement = $this->pdo->prepare(
            'SELECT receta_slug, youtube_id, titulo
             FROM recetas_videos
             WHERE receta_slug = ?
             LIMIT 1'
        );
        $statement->execute([$slug]);

        $row = $statement->fetch();

        if ($row === false) {
            return null;
        }

        return [
            'youtube_id' => (string) $row['youtube_id'],
            'titulo' => isset($row['titulo']) ? (string) $row['titulo'] : null,
        ];
    }

    public function upsert(string $slug, string $youtubeId, ?string $titulo, int $usuarioId): void
    {
        $statement = $this->pdo->prepare(
            'INSERT INTO recetas_videos (receta_slug, youtube_id, titulo, actualizado_por)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                youtube_id = VALUES(youtube_id),
                titulo = VALUES(titulo),
                actualizado_por = VALUES(actualizado_por)'
        );
        $statement->execute([$slug, $youtubeId, $titulo, $usuarioId]);
    }

    public function delete(string $slug): bool
    {
        $statement = $this->pdo->prepare('DELETE FROM recetas_videos WHERE receta_slug = ?');
        $statement->execute([$slug]);

        return $statement->rowCount() > 0;
    }
}
