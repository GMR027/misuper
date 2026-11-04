<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Services\NormalizadorService;
use App\Support\Database;
use PDO;

/**
 * Catálogo de recetas y favoritos por usuario.
 */
final class RecetaRepository
{
    private const COLUMNS = 'r.id, r.slug, r.nombre, r.descripcion, r.tipos,
        r.porciones_base, r.tiempo_min, r.dificultad, r.ingredientes, r.pasos,
        r.video_youtube_id, r.video_titulo, r.estado, r.creada_por,
        (SELECT u.nombre FROM usuarios u WHERE u.id = r.creada_por) AS creador_nombre,
        r.created_at, r.updated_at';

    private readonly PDO $pdo;

    public function __construct(?PDO $pdo = null)
    {
        $this->pdo = $pdo ?? Database::connection();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function allPublic(): array
    {
        $statement = $this->pdo->query(
            'SELECT ' . self::COLUMNS . " FROM recetas r
             WHERE r.estado = 'publicada'
             ORDER BY r.nombre ASC, r.id ASC"
        );

        return array_map([$this, 'normalizarFila'], $statement->fetchAll());
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function all(): array
    {
        $statement = $this->pdo->query(
            'SELECT ' . self::COLUMNS . " FROM recetas r
             ORDER BY FIELD(r.estado, 'pendiente', 'publicada', 'borrador'), r.nombre ASC, r.id ASC"
        );

        return array_map([$this, 'normalizarFila'], $statement->fetchAll());
    }

    public function findPublicBySlug(string $slug): ?array
    {
        $statement = $this->pdo->prepare(
            'SELECT ' . self::COLUMNS . " FROM recetas r
             WHERE r.slug = ? AND r.estado = 'publicada'
             LIMIT 1"
        );
        $statement->execute([$slug]);

        $row = $statement->fetch();

        return $row === false ? null : $this->normalizarFila($row);
    }

    public function findBySlug(string $slug): ?array
    {
        $statement = $this->pdo->prepare(
            'SELECT ' . self::COLUMNS . ' FROM recetas r WHERE r.slug = ? LIMIT 1'
        );
        $statement->execute([$slug]);

        $row = $statement->fetch();

        return $row === false ? null : $this->normalizarFila($row);
    }

    public function findById(int $id): ?array
    {
        $statement = $this->pdo->prepare(
            'SELECT ' . self::COLUMNS . ' FROM recetas r WHERE r.id = ? LIMIT 1'
        );
        $statement->execute([$id]);

        $row = $statement->fetch();

        return $row === false ? null : $this->normalizarFila($row);
    }

    /**
     * @param array<string, mixed> $data
     * @return array<string, mixed>
     */
    public function create(array $data, ?int $creadaPor, string $estado): array
    {
        $slug = $this->uniqueSlug((string) $data['nombre']);

        $statement = $this->pdo->prepare(
            'INSERT INTO recetas
                (slug, nombre, descripcion, tipos, porciones_base, tiempo_min,
                 dificultad, ingredientes, pasos, video_youtube_id, video_titulo,
                 estado, creada_por)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $statement->execute([
            $slug,
            $data['nombre'],
            $data['descripcion'],
            json_encode($data['tipos'], JSON_UNESCAPED_UNICODE),
            $data['porciones_base'],
            $data['tiempo_min'],
            $data['dificultad'],
            json_encode($data['ingredientes'], JSON_UNESCAPED_UNICODE),
            json_encode($data['pasos'], JSON_UNESCAPED_UNICODE),
            $data['video_youtube_id'],
            $data['video_titulo'],
            $estado,
            $creadaPor,
        ]);

        $receta = $this->findById((int) $this->pdo->lastInsertId());

        if ($receta === null) {
            throw new \RuntimeException('No se pudo leer la receta recién creada.');
        }

        return $receta;
    }

    /**
     * @param array<string, mixed> $campos
     */
    public function update(int $id, array $campos): ?array
    {
        $columnas = [
            'nombre' => null,
            'descripcion' => null,
            'tipos' => function (mixed $value): string {
                return json_encode($value, JSON_UNESCAPED_UNICODE);
            },
            'porciones_base' => null,
            'tiempo_min' => null,
            'dificultad' => null,
            'ingredientes' => function (mixed $value): string {
                return json_encode($value, JSON_UNESCAPED_UNICODE);
            },
            'pasos' => function (mixed $value): string {
                return json_encode($value, JSON_UNESCAPED_UNICODE);
            },
            'video_youtube_id' => null,
            'video_titulo' => null,
            'estado' => null,
        ];

        $sets = [];
        $params = [];

        foreach ($columnas as $columna => $transformar) {
            if (array_key_exists($columna, $campos)) {
                $sets[] = $columna . ' = ?';
                $params[] = $transformar === null ? $campos[$columna] : $transformar($campos[$columna]);
            }
        }

        if ($sets !== []) {
            $params[] = $id;
            $statement = $this->pdo->prepare(
                'UPDATE recetas SET ' . implode(', ', $sets) . ' WHERE id = ?'
            );
            $statement->execute($params);
        }

        return $this->findById($id);
    }

    public function delete(int $id): bool
    {
        $statement = $this->pdo->prepare('DELETE FROM recetas WHERE id = ?');
        $statement->execute([$id]);

        return $statement->rowCount() > 0;
    }

    /**
     * @return array<int, int>
     */
    public function favoritos(int $usuarioId): array
    {
        $statement = $this->pdo->prepare(
            'SELECT receta_id FROM receta_favoritos WHERE usuario_id = ?'
        );
        $statement->execute([$usuarioId]);

        return array_map('intval', $statement->fetchAll(PDO::FETCH_COLUMN));
    }

    public function esFavorito(int $usuarioId, int $recetaId): bool
    {
        $statement = $this->pdo->prepare(
            'SELECT 1 FROM receta_favoritos WHERE usuario_id = ? AND receta_id = ? LIMIT 1'
        );
        $statement->execute([$usuarioId, $recetaId]);

        return $statement->fetchColumn() !== false;
    }

    /**
     * Alterna el favorito y devuelve el estado final.
     */
    public function toggleFavorito(int $usuarioId, int $recetaId): bool
    {
        $statement = $this->pdo->prepare(
            'SELECT 1 FROM receta_favoritos WHERE usuario_id = ? AND receta_id = ? LIMIT 1'
        );
        $statement->execute([$usuarioId, $recetaId]);

        if ($statement->fetchColumn() !== false) {
            $delete = $this->pdo->prepare(
                'DELETE FROM receta_favoritos WHERE usuario_id = ? AND receta_id = ?'
            );
            $delete->execute([$usuarioId, $recetaId]);

            return false;
        }

        $insert = $this->pdo->prepare(
            'INSERT INTO receta_favoritos (usuario_id, receta_id) VALUES (?, ?)'
        );
        $insert->execute([$usuarioId, $recetaId]);

        return true;
    }

    public function uniqueSlug(string $nombre): string
    {
        $base = trim((string) preg_replace(
            '/[^a-z0-9]+/',
            '-',
            NormalizadorService::normalizar($nombre)
        ), '-');

        if ($base === '') {
            $base = 'receta';
        }

        $base = mb_substr($base, 0, 90);
        $slug = $base;
        $suffix = 2;

        while ($this->findBySlug($slug) !== null) {
            $slug = $base . '-' . $suffix;
            $suffix++;
        }

        return $slug;
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function normalizarFila(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'slug' => (string) $row['slug'],
            'nombre' => (string) $row['nombre'],
            'descripcion' => (string) $row['descripcion'],
            'tipos' => $this->decodificar($row['tipos']),
            'porciones_base' => (int) $row['porciones_base'],
            'tiempo_min' => (int) $row['tiempo_min'],
            'dificultad' => (string) $row['dificultad'],
            'ingredientes' => $this->decodificar($row['ingredientes']),
            'pasos' => $this->decodificar($row['pasos']),
            'video_youtube_id' => isset($row['video_youtube_id']) ? (string) $row['video_youtube_id'] : null,
            'video_titulo' => isset($row['video_titulo']) ? (string) $row['video_titulo'] : null,
            'estado' => (string) $row['estado'],
            'creada_por' => $row['creada_por'] === null ? null : (int) $row['creada_por'],
            'creador_nombre' => isset($row['creador_nombre']) ? (string) $row['creador_nombre'] : null,
            'created_at' => (string) $row['created_at'],
            'updated_at' => (string) $row['updated_at'],
        ];
    }

    /**
     * @return array<int, mixed>
     */
    private function decodificar(mixed $value): array
    {
        $data = json_decode((string) $value, true);

        return is_array($data) ? $data : [];
    }
}
