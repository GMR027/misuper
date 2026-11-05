<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Support\Database;
use PDO;
use Throwable;

/**
 * Menús semanales por usuario y sus platillos.
 *
 * Todas las consultas de escritura comprueban la propiedad del menú para que
 * un usuario no pueda modificar el de otra persona.
 */
final class MenuRepository
{
    private const ITEM_COLUMNS = 'mi.id, mi.menu_id, mi.dia, mi.momento, mi.tipo, mi.etiqueta,
        mi.receta_id, mi.nombre_snapshot, mi.porciones, mi.orden, mi.nota,
        mi.created_at, mi.updated_at,
        r.slug AS receta_slug, r.nombre AS receta_nombre, r.estado AS receta_estado,
        r.tiempo_min, r.porciones_base, r.imagen_url, r.tipos AS receta_tipos';

    private const ITEM_FROM = ' FROM menu_semanal_items mi
        INNER JOIN menus_semanales m ON m.id = mi.menu_id
        LEFT JOIN recetas r ON r.id = mi.receta_id';

    private readonly PDO $pdo;

    public function __construct(?PDO $pdo = null)
    {
        $this->pdo = $pdo ?? Database::connection();
    }

    /**
     * @return array{id: int, usuario_id: int, semana: string, nombre: string|null}|null
     */
    public function findMenu(int $usuarioId, string $semana): ?array
    {
        $statement = $this->pdo->prepare(
            'SELECT id, usuario_id, semana, nombre
             FROM menus_semanales
             WHERE usuario_id = ? AND semana = ?
             LIMIT 1'
        );
        $statement->execute([$usuarioId, $semana]);

        $row = $statement->fetch();

        return $row === false ? null : $this->normalizarMenu($row);
    }

    /**
     * Crea la semana si no existe y devuelve siempre el menú resultante.
     *
     * @return array{id: int, usuario_id: int, semana: string, nombre: string|null}
     */
    public function ensureMenu(int $usuarioId, string $semana): array
    {
        $statement = $this->pdo->prepare(
            'INSERT INTO menus_semanales (usuario_id, semana)
             VALUES (?, ?)
             ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)'
        );
        $statement->execute([$usuarioId, $semana]);

        $menu = $this->findMenuById((int) $this->pdo->lastInsertId(), $usuarioId);

        if ($menu === null) {
            throw new \RuntimeException('No se pudo leer el menú recién creado.');
        }

        return $menu;
    }

    /**
     * @return array{id: int, usuario_id: int, semana: string, nombre: string|null}|null
     */
    public function findMenuById(int $menuId, int $usuarioId): ?array
    {
        $statement = $this->pdo->prepare(
            'SELECT id, usuario_id, semana, nombre
             FROM menus_semanales
             WHERE id = ? AND usuario_id = ?
             LIMIT 1'
        );
        $statement->execute([$menuId, $usuarioId]);

        $row = $statement->fetch();

        return $row === false ? null : $this->normalizarMenu($row);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function items(int $menuId): array
    {
        $statement = $this->pdo->prepare(
            'SELECT ' . self::ITEM_COLUMNS . self::ITEM_FROM
            . ' WHERE mi.menu_id = ?
                ORDER BY mi.dia ASC,
                         FIELD(mi.momento, \'desayuno\', \'comida\', \'cena\', \'colacion\', \'otro\'),
                         mi.orden ASC, mi.id ASC'
        );
        $statement->execute([$menuId]);

        return array_map([$this, 'normalizarItem'], $statement->fetchAll());
    }

    /**
     * @return array<string, mixed>|null
     */
    public function findItemOwned(int $itemId, int $usuarioId): ?array
    {
        $statement = $this->pdo->prepare(
            'SELECT ' . self::ITEM_COLUMNS . self::ITEM_FROM
            . ' WHERE mi.id = ? AND m.usuario_id = ?
                LIMIT 1'
        );
        $statement->execute([$itemId, $usuarioId]);

        $row = $statement->fetch();

        return $row === false ? null : $this->normalizarItem($row);
    }

    public function countItems(int $menuId): int
    {
        $statement = $this->pdo->prepare(
            'SELECT COUNT(*) FROM menu_semanal_items WHERE menu_id = ?'
        );
        $statement->execute([$menuId]);

        return (int) $statement->fetchColumn();
    }

    public function nextOrder(int $menuId, int $dia, string $momento): int
    {
        $statement = $this->pdo->prepare(
            'SELECT COALESCE(MAX(orden), -1) + 1
             FROM menu_semanal_items
             WHERE menu_id = ? AND dia = ? AND momento = ?'
        );
        $statement->execute([$menuId, $dia, $momento]);

        return (int) $statement->fetchColumn();
    }

    /**
     * @param array<string, mixed> $item
     */
    public function addItem(int $menuId, array $item): int
    {
        $statement = $this->pdo->prepare(
            'INSERT INTO menu_semanal_items
                (menu_id, dia, momento, tipo, etiqueta, receta_id, nombre_snapshot,
                 porciones, orden, nota)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $statement->execute([
            $menuId,
            $item['dia'],
            $item['momento'],
            $item['tipo'],
            $item['etiqueta'],
            $item['receta_id'],
            $item['nombre_snapshot'],
            $item['porciones'],
            $item['orden'],
            $item['nota'],
        ]);

        return (int) $this->pdo->lastInsertId();
    }

    /**
     * @param array<int, array<string, mixed>> $items
     */
    public function addMany(int $menuId, array $items): void
    {
        if ($items === []) {
            return;
        }

        $statement = $this->pdo->prepare(
            'INSERT INTO menu_semanal_items
                (menu_id, dia, momento, tipo, etiqueta, receta_id, nombre_snapshot,
                 porciones, orden, nota)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );

        $this->pdo->beginTransaction();

        try {
            foreach ($items as $item) {
                $statement->execute([
                    $menuId,
                    $item['dia'],
                    $item['momento'],
                    $item['tipo'],
                    $item['etiqueta'],
                    $item['receta_id'],
                    $item['nombre_snapshot'],
                    $item['porciones'],
                    $item['orden'],
                    $item['nota'],
                ]);
            }

            $this->pdo->commit();
        } catch (Throwable $error) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }

            throw $error;
        }
    }

    /**
     * @param array<string, mixed> $campos Claves permitidas: dia, momento,
     *     etiqueta, receta_id, nombre_snapshot, porciones, orden, nota.
     */
    public function updateItem(int $itemId, array $campos): void
    {
        $columnas = ['dia', 'momento', 'tipo', 'etiqueta', 'receta_id', 'nombre_snapshot', 'porciones', 'orden', 'nota'];
        $sets = [];
        $params = [];

        foreach ($columnas as $columna) {
            if (array_key_exists($columna, $campos)) {
                $sets[] = $columna . ' = ?';
                $params[] = $campos[$columna];
            }
        }

        if ($sets === []) {
            return;
        }

        $params[] = $itemId;
        $statement = $this->pdo->prepare(
            'UPDATE menu_semanal_items SET ' . implode(', ', $sets) . ' WHERE id = ?'
        );
        $statement->execute($params);
    }

    public function deleteItem(int $itemId, int $usuarioId): bool
    {
        $statement = $this->pdo->prepare(
            'DELETE mi FROM menu_semanal_items mi
             INNER JOIN menus_semanales m ON m.id = mi.menu_id
             WHERE mi.id = ? AND m.usuario_id = ?'
        );
        $statement->execute([$itemId, $usuarioId]);

        return $statement->rowCount() > 0;
    }

    /**
     * @param int|null $dia null vacía la semana completa.
     */
    public function clear(int $menuId, ?int $dia = null, ?string $momento = null): int
    {
        $where = ['menu_id = ?'];
        $params = [$menuId];

        if ($dia !== null) {
            $where[] = 'dia = ?';
            $params[] = $dia;
        }

        if ($momento !== null) {
            $where[] = 'momento = ?';
            $params[] = $momento;
        }

        $statement = $this->pdo->prepare(
            'DELETE FROM menu_semanal_items WHERE ' . implode(' AND ', $where)
        );
        $statement->execute($params);

        return $statement->rowCount();
    }

    /**
     * @param array<string, mixed> $row
     * @return array{id: int, usuario_id: int, semana: string, nombre: string|null}
     */
    private function normalizarMenu(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'usuario_id' => (int) $row['usuario_id'],
            'semana' => (string) $row['semana'],
            'nombre' => $row['nombre'] !== null && $row['nombre'] !== '' ? (string) $row['nombre'] : null,
        ];
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function normalizarItem(array $row): array
    {
        $tipos = [];

        if (isset($row['receta_tipos']) && is_string($row['receta_tipos']) && $row['receta_tipos'] !== '') {
            $decoded = json_decode($row['receta_tipos'], true);

            if (is_array($decoded)) {
                $tipos = array_values(array_filter($decoded, 'is_string'));
            }
        }

        $nombre = $row['receta_nombre'] !== null && $row['receta_nombre'] !== ''
            ? (string) $row['receta_nombre']
            : (string) $row['nombre_snapshot'];

        return [
            'id' => (int) $row['id'],
            'menu_id' => (int) $row['menu_id'],
            'dia' => (int) $row['dia'],
            'momento' => (string) $row['momento'],
            'tipo' => (string) $row['tipo'],
            'etiqueta' => $row['etiqueta'] !== null && $row['etiqueta'] !== '' ? (string) $row['etiqueta'] : null,
            'receta_id' => $row['receta_id'] !== null ? (int) $row['receta_id'] : null,
            'nombre_snapshot' => (string) $row['nombre_snapshot'],
            'nombre' => $nombre,
            'porciones' => (int) $row['porciones'],
            'orden' => (int) $row['orden'],
            'nota' => $row['nota'] !== null && $row['nota'] !== '' ? (string) $row['nota'] : null,
            'receta' => $row['receta_id'] !== null && $row['receta_slug'] !== null
                ? [
                    'id' => (int) $row['receta_id'],
                    'slug' => (string) $row['receta_slug'],
                    'nombre' => $nombre,
                    'estado' => (string) $row['receta_estado'],
                    'tiempo_min' => (int) $row['tiempo_min'],
                    'porciones_base' => (int) $row['porciones_base'],
                    'imagen_url' => $row['imagen_url'] !== null ? (string) $row['imagen_url'] : null,
                    'tipos' => $tipos,
                ]
                : null,
        ];
    }
}
