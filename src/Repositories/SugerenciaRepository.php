<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Models\Sugerencia;
use App\Support\Database;
use PDO;

/**
 * Acceso a sugerencias_producto. Siempre con prepared statements.
 */
final class SugerenciaRepository
{
    private const COLUMNS = 'id, nombre_normalizado, nombre_original, estado, usuario_id, created_at';

    private readonly PDO $pdo;

    public function __construct(?PDO $pdo = null)
    {
        $this->pdo = $pdo ?? Database::connection();
    }

    public function findById(int $id): ?Sugerencia
    {
        $statement = $this->pdo->prepare(
            'SELECT ' . self::COLUMNS . ' FROM sugerencias_producto WHERE id = ? LIMIT 1'
        );
        $statement->execute([$id]);

        $row = $statement->fetch();

        return $row === false ? null : Sugerencia::fromRow($row);
    }

    public function findPendiente(int $usuarioId, string $nombreNormalizado): ?Sugerencia
    {
        $statement = $this->pdo->prepare(
            "SELECT " . self::COLUMNS . "
             FROM sugerencias_producto
             WHERE usuario_id = ? AND nombre_normalizado = ? AND estado = 'pendiente'
             LIMIT 1"
        );
        $statement->execute([$usuarioId, $nombreNormalizado]);

        $row = $statement->fetch();

        return $row === false ? null : Sugerencia::fromRow($row);
    }

    public function create(int $usuarioId, string $nombreNormalizado, string $nombreOriginal): Sugerencia
    {
        $statement = $this->pdo->prepare(
            "INSERT INTO sugerencias_producto (nombre_normalizado, nombre_original, estado, usuario_id)
             VALUES (?, ?, 'pendiente', ?)"
        );
        $statement->execute([$nombreNormalizado, $nombreOriginal, $usuarioId]);

        $sugerencia = $this->findById((int) $this->pdo->lastInsertId());

        if ($sugerencia === null) {
            throw new \RuntimeException('No se pudo leer la sugerencia recién creada.');
        }

        return $sugerencia;
    }

    /**
     * Agrupa las sugerencias de un estado por nombre_normalizado.
     *
     * nombre_original es el de la sugerencia más reciente del grupo.
     *
     * @return array<int, array{
     *     nombre_normalizado: string,
     *     nombre_original: string,
     *     total: int,
     *     ids: array<int, int>,
     *     primera_fecha: string,
     *     ultima_fecha: string
     * }>
     */
    public function agruparPorEstado(string $estado): array
    {
        $statement = $this->pdo->prepare(
            'SELECT ' . self::COLUMNS . '
             FROM sugerencias_producto
             WHERE estado = ?
             ORDER BY created_at DESC, id DESC'
        );
        $statement->execute([$estado]);

        $grupos = [];

        foreach ($statement->fetchAll() as $row) {
            $clave = (string) $row['nombre_normalizado'];
            $fecha = (string) $row['created_at'];

            if (!isset($grupos[$clave])) {
                $grupos[$clave] = [
                    'nombre_normalizado' => $clave,
                    'nombre_original' => (string) $row['nombre_original'],
                    'total' => 0,
                    'ids' => [],
                    'primera_fecha' => $fecha,
                    'ultima_fecha' => $fecha,
                ];
            }

            $grupos[$clave]['total']++;
            $grupos[$clave]['ids'][] = (int) $row['id'];
            // Las filas vienen de la más reciente a la más antigua.
            $grupos[$clave]['primera_fecha'] = $fecha;
        }

        $items = array_values($grupos);

        usort(
            $items,
            static function (array $a, array $b): int {
                $porTotal = $b['total'] <=> $a['total'];

                if ($porTotal !== 0) {
                    return $porTotal;
                }

                $porFecha = strcmp($a['primera_fecha'], $b['primera_fecha']);

                return $porFecha !== 0
                    ? $porFecha
                    : strcmp($a['nombre_normalizado'], $b['nombre_normalizado']);
            }
        );

        return $items;
    }

    /**
     * Resuelve todas las sugerencias pendientes de un nombre_normalizado.
     *
     * Si un usuario ya tiene una fila resuelta con el mismo nombre y estado,
     * la pendiente se elimina para respetar el UNIQUE
     * (nombre_normalizado, usuario_id, estado). El grupo queda resuelto.
     *
     * @return int Número de sugerencias pendientes procesadas.
     */
    public function resolverGrupo(string $nombreNormalizado, string $estadoDestino): int
    {
        $pendientes = $this->pdo->prepare(
            "SELECT id, usuario_id
             FROM sugerencias_producto
             WHERE nombre_normalizado = ? AND estado = 'pendiente'"
        );
        $pendientes->execute([$nombreNormalizado]);

        $existeResuelta = $this->pdo->prepare(
            'SELECT 1 FROM sugerencias_producto
             WHERE nombre_normalizado = ? AND usuario_id = ? AND estado = ?
             LIMIT 1'
        );
        $eliminar = $this->pdo->prepare('DELETE FROM sugerencias_producto WHERE id = ?');
        $actualizar = $this->pdo->prepare('UPDATE sugerencias_producto SET estado = ? WHERE id = ?');

        $resueltas = 0;

        foreach ($pendientes->fetchAll() as $row) {
            $usuarioId = (int) $row['usuario_id'];
            $existeResuelta->execute([$nombreNormalizado, $usuarioId, $estadoDestino]);

            if ($existeResuelta->fetchColumn() !== false) {
                $eliminar->execute([(int) $row['id']]);
            } else {
                $actualizar->execute([$estadoDestino, (int) $row['id']]);
            }

            $resueltas++;
        }

        return $resueltas;
    }
}
