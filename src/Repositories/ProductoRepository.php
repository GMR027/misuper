<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Models\Producto;
use App\Services\NormalizadorService;
use App\Support\Database;
use PDO;

/**
 * Acceso a las tablas productos y categorias. Siempre con prepared statements.
 *
 * Categorías: solo lectura (seed fijo, sin CRUD).
 */
final class ProductoRepository
{
    private const COLUMNS = 'p.id, p.nombre, p.categoria_id, c.nombre AS categoria_nombre,
        p.unidad_base, p.imagen_url, p.estado, p.created_at, p.updated_at';

    private const FROM = ' FROM productos p INNER JOIN categorias c ON c.id = p.categoria_id';

    private readonly PDO $pdo;

    public function __construct(?PDO $pdo = null)
    {
        $this->pdo = $pdo ?? Database::connection();
    }

    /**
     * Búsqueda paginada de productos activos.
     *
     * @return array{items: array<int, Producto>, total: int}
     */
    public function searchPublic(string $q, ?int $categoriaId, int $page, int $perPage): array
    {
        return $this->search($q, $categoriaId, 'activo', $page, $perPage);
    }

    /**
     * Búsqueda paginada para el panel Admin.
     *
     * @return array{items: array<int, Producto>, total: int}
     */
    public function searchAdmin(string $q, ?int $categoriaId, ?string $estado, int $page, int $perPage): array
    {
        return $this->search($q, $categoriaId, $estado, $page, $perPage);
    }

    /**
     * @return array{items: array<int, Producto>, total: int}
     */
    private function search(
        string $q,
        ?int $categoriaId,
        ?string $estado,
        int $page,
        int $perPage
    ): array {
        $where = [];
        $params = [];

        if ($q !== '') {
            // La collation general_ci es insensible a mayúsculas y acentos.
            $where[] = "LOWER(p.nombre) COLLATE utf8mb4_general_ci LIKE ? ESCAPE '!'";
            $params[] = '%' . NormalizadorService::patronLike($q) . '%';
        }

        if ($categoriaId !== null) {
            $where[] = 'p.categoria_id = ?';
            $params[] = $categoriaId;
        }

        if ($estado !== null) {
            $where[] = 'p.estado = ?';
            $params[] = $estado;
        }

        $whereSql = $where === [] ? '' : ' WHERE ' . implode(' AND ', $where);

        $count = $this->pdo->prepare('SELECT COUNT(*)' . self::FROM . $whereSql);
        $count->execute($params);
        $total = (int) $count->fetchColumn();

        $offset = ($page - 1) * $perPage;

        $statement = $this->pdo->prepare(
            'SELECT ' . self::COLUMNS . self::FROM . $whereSql
            . ' ORDER BY p.nombre ASC, p.id ASC LIMIT ? OFFSET ?'
        );

        $index = 1;

        foreach ($params as $param) {
            $statement->bindValue(
                $index++,
                $param,
                is_int($param) ? PDO::PARAM_INT : PDO::PARAM_STR
            );
        }

        $statement->bindValue($index++, $perPage, PDO::PARAM_INT);
        $statement->bindValue($index, $offset, PDO::PARAM_INT);
        $statement->execute();

        $items = [];

        foreach ($statement->fetchAll() as $row) {
            $items[] = Producto::fromRow($row);
        }

        return ['items' => $items, 'total' => $total];
    }

    public function findById(int $id): ?Producto
    {
        $statement = $this->pdo->prepare(
            'SELECT ' . self::COLUMNS . self::FROM . ' WHERE p.id = ? LIMIT 1'
        );
        $statement->execute([$id]);

        $row = $statement->fetch();

        return $row === false ? null : Producto::fromRow($row);
    }

    public function create(
        string $nombre,
        int $categoriaId,
        string $unidadBase,
        ?string $imagenUrl
    ): Producto {
        $statement = $this->pdo->prepare(
            'INSERT INTO productos (nombre, categoria_id, unidad_base, imagen_url)
             VALUES (?, ?, ?, ?)'
        );
        $statement->execute([$nombre, $categoriaId, $unidadBase, $imagenUrl]);

        $producto = $this->findById((int) $this->pdo->lastInsertId());

        if ($producto === null) {
            throw new \RuntimeException('No se pudo leer el producto recién creado.');
        }

        return $producto;
    }

    /**
     * Actualiza solo los campos presentes en $campos. Las claves se validan
     * contra una lista blanca para no interpolar columnas arbitrarias.
     *
     * @param array<string, mixed> $campos
     */
    public function update(int $id, array $campos): void
    {
        $columnas = ['nombre', 'categoria_id', 'unidad_base', 'imagen_url'];
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

        $params[] = $id;

        $statement = $this->pdo->prepare(
            'UPDATE productos SET ' . implode(', ', $sets) . ' WHERE id = ?'
        );
        $statement->execute($params);
    }

    public function deactivate(int $id): void
    {
        $statement = $this->pdo->prepare(
            "UPDATE productos SET estado = 'inactivo' WHERE id = ?"
        );
        $statement->execute([$id]);
    }

    public function categoriaExists(int $id): bool
    {
        $statement = $this->pdo->prepare('SELECT 1 FROM categorias WHERE id = ? LIMIT 1');
        $statement->execute([$id]);

        return $statement->fetchColumn() !== false;
    }

    /**
     * Categorías fijas ordenadas alfabéticamente.
     *
     * @return array<int, array{id: int, nombre: string}>
     */
    public function categorias(): array
    {
        $statement = $this->pdo->query('SELECT id, nombre FROM categorias ORDER BY nombre ASC');

        $categorias = [];

        foreach ($statement->fetchAll() as $row) {
            $categorias[] = [
                'id' => (int) $row['id'],
                'nombre' => (string) $row['nombre'],
            ];
        }

        return $categorias;
    }
}
