<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Models\Nota;
use App\Support\Database;
use PDO;

/**
 * Acceso a notas y sus fotos. Siempre con prepared statements.
 */
final class NotaRepository
{
    private const COLUMNS = 'id, usuario_id, titulo, contenido, created_at, updated_at,
        UNIX_TIMESTAMP(created_at) AS created_ts,
        UNIX_TIMESTAMP(updated_at) AS updated_ts';

    private readonly PDO $pdo;

    public function __construct(?PDO $pdo = null)
    {
        $this->pdo = $pdo ?? Database::connection();
    }

    /**
     * Notas de un usuario, de la más reciente a la más antigua.
     *
     * @return array<int, Nota>
     */
    public function listarPorUsuario(int $usuarioId): array
    {
        $statement = $this->pdo->prepare(
            'SELECT ' . self::COLUMNS . '
             FROM notas
             WHERE usuario_id = ?
             ORDER BY created_at DESC, id DESC'
        );
        $statement->execute([$usuarioId]);

        $notas = [];

        foreach ($statement->fetchAll() as $row) {
            $notas[] = Nota::fromRow($row);
        }

        return $this->conFotos($notas);
    }

    public function findByIdDeUsuario(int $notaId, int $usuarioId): ?Nota
    {
        $statement = $this->pdo->prepare(
            'SELECT ' . self::COLUMNS . '
             FROM notas
             WHERE id = ? AND usuario_id = ?
             LIMIT 1'
        );
        $statement->execute([$notaId, $usuarioId]);

        $row = $statement->fetch();

        if ($row === false) {
            return null;
        }

        $nota = Nota::fromRow($row);

        return $nota->withFotos($this->fotosDeNota($nota->id));
    }

    /**
     * @return array<int, array{id: int, ruta: string}>
     */
    public function fotosDeNota(int $notaId): array
    {
        $statement = $this->pdo->prepare(
            'SELECT id, ruta FROM nota_fotos WHERE nota_id = ? ORDER BY id ASC'
        );
        $statement->execute([$notaId]);

        return array_map(
            static fn (array $row): array => [
                'id' => (int) $row['id'],
                'ruta' => (string) $row['ruta'],
            ],
            $statement->fetchAll()
        );
    }

    public function create(int $usuarioId, string $titulo, string $contenido): Nota
    {
        $statement = $this->pdo->prepare(
            'INSERT INTO notas (usuario_id, titulo, contenido) VALUES (?, ?, ?)'
        );
        $statement->execute([$usuarioId, $titulo, $contenido]);

        $nota = $this->findByIdDeUsuario((int) $this->pdo->lastInsertId(), $usuarioId);

        if ($nota === null) {
            throw new \RuntimeException('No se pudo leer la nota recién creada.');
        }

        return $nota;
    }

    public function update(int $notaId, string $titulo, string $contenido): void
    {
        $statement = $this->pdo->prepare(
            'UPDATE notas SET titulo = ?, contenido = ? WHERE id = ?'
        );
        $statement->execute([$titulo, $contenido, $notaId]);
    }

    public function delete(int $notaId): void
    {
        $statement = $this->pdo->prepare('DELETE FROM notas WHERE id = ?');
        $statement->execute([$notaId]);
    }

    /**
     * @return array{id: int, ruta: string}
     */
    public function addFoto(int $notaId, string $ruta): array
    {
        $statement = $this->pdo->prepare(
            'INSERT INTO nota_fotos (nota_id, ruta) VALUES (?, ?)'
        );
        $statement->execute([$notaId, $ruta]);

        return ['id' => (int) $this->pdo->lastInsertId(), 'ruta' => $ruta];
    }

    public function countFotos(int $notaId): int
    {
        $statement = $this->pdo->prepare('SELECT COUNT(*) FROM nota_fotos WHERE nota_id = ?');
        $statement->execute([$notaId]);

        return (int) $statement->fetchColumn();
    }

    /**
     * Comprueba que la foto pertenece a una nota del usuario.
     *
     * @return array{id: int, ruta: string}|null
     */
    public function findFotoDeUsuario(int $fotoId, int $notaId, int $usuarioId): ?array
    {
        $statement = $this->pdo->prepare(
            'SELECT f.id, f.ruta
             FROM nota_fotos f
             INNER JOIN notas n ON n.id = f.nota_id
             WHERE f.id = ? AND f.nota_id = ? AND n.usuario_id = ?
             LIMIT 1'
        );
        $statement->execute([$fotoId, $notaId, $usuarioId]);

        $row = $statement->fetch();

        if ($row === false) {
            return null;
        }

        return ['id' => (int) $row['id'], 'ruta' => (string) $row['ruta']];
    }

    public function deleteFoto(int $fotoId): void
    {
        $statement = $this->pdo->prepare('DELETE FROM nota_fotos WHERE id = ?');
        $statement->execute([$fotoId]);
    }

    /**
     * Rutas de todas las fotos de un usuario (para limpiar archivos).
     *
     * @return array<int, string>
     */
    public function rutasDeUsuario(int $usuarioId): array
    {
        $statement = $this->pdo->prepare(
            'SELECT f.ruta
             FROM nota_fotos f
             INNER JOIN notas n ON n.id = f.nota_id
             WHERE n.usuario_id = ?'
        );
        $statement->execute([$usuarioId]);

        return array_map(static fn (array $row): string => (string) $row['ruta'], $statement->fetchAll());
    }

    /**
     * @param array<int, Nota> $notas
     * @return array<int, Nota>
     */
    private function conFotos(array $notas): array
    {
        if ($notas === []) {
            return [];
        }

        $ids = array_map(static fn (Nota $nota): int => $nota->id, $notas);
        $marcadores = implode(',', array_fill(0, count($ids), '?'));

        $statement = $this->pdo->prepare(
            "SELECT nota_id, id, ruta
             FROM nota_fotos
             WHERE nota_id IN ({$marcadores})
             ORDER BY id ASC"
        );
        $statement->execute($ids);

        $porNota = [];

        foreach ($statement->fetchAll() as $row) {
            $porNota[(int) $row['nota_id']][] = [
                'id' => (int) $row['id'],
                'ruta' => (string) $row['ruta'],
            ];
        }

        return array_map(
            static fn (Nota $nota): Nota => $nota->withFotos($porNota[$nota->id] ?? []),
            $notas
        );
    }
}
