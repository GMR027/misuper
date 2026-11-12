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
    private const COLUMNS = 'p.id, p.nombre, p.usuario_id, p.categoria_id, c.nombre AS categoria_nombre,
        p.unidad_base, p.imagen_url, p.kcal_100, p.peso_pieza_g, p.fuente_nutricion,
        p.imagen_estado, p.imagen_verificada_at,
        p.estado, p.created_at, p.updated_at';

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
        return $this->search($q, $categoriaId, 'activo', $page, $perPage, null);
    }

    /**
     * Búsqueda paginada para el panel Admin.
     *
     * @return array{items: array<int, Producto>, total: int}
     */
    public function searchAdmin(
        string $q,
        ?int $categoriaId,
        ?string $estado,
        int $page,
        int $perPage,
        ?string $imagen = null
    ): array {
        return $this->search($q, $categoriaId, $estado, $page, $perPage, $imagen);
    }

    /**
     * @return array{items: array<int, Producto>, total: int}
     */
    private function search(
        string $q,
        ?int $categoriaId,
        ?string $estado,
        int $page,
        int $perPage,
        ?string $imagen
    ): array {
        $where = ['p.usuario_id IS NULL'];
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

        if ($imagen === 'sin_foto') {
            $where[] = "(p.imagen_url IS NULL OR p.imagen_url = '')";
        } elseif ($imagen === 'vencida') {
            $where[] = "p.imagen_url IS NOT NULL AND p.imagen_url <> '' AND p.imagen_estado = 'vencida'";
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

    /**
     * Producto del catálogo global (usuario_id NULL). El panel Admin no
     * administra productos personales.
     */
    public function findGlobalById(int $id): ?Producto
    {
        $statement = $this->pdo->prepare(
            'SELECT ' . self::COLUMNS . self::FROM . ' WHERE p.id = ? AND p.usuario_id IS NULL LIMIT 1'
        );
        $statement->execute([$id]);

        $row = $statement->fetch();

        return $row === false ? null : Producto::fromRow($row);
    }

    public function create(
        string $nombre,
        int $categoriaId,
        string $unidadBase,
        ?string $imagenUrl,
        ?int $usuarioId = null,
        ?float $kcal100 = null,
        ?float $pesoPiezaG = null,
        ?string $fuenteNutricion = null
    ): Producto {
        $statement = $this->pdo->prepare(
            'INSERT INTO productos
                (nombre, usuario_id, categoria_id, unidad_base, imagen_url,
                 kcal_100, peso_pieza_g, fuente_nutricion)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $statement->execute([
            $nombre,
            $usuarioId,
            $categoriaId,
            $unidadBase,
            $imagenUrl,
            $kcal100,
            $pesoPiezaG,
            $fuenteNutricion,
        ]);

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
        $columnas = ['nombre', 'categoria_id', 'unidad_base', 'imagen_url', 'kcal_100', 'peso_pieza_g', 'fuente_nutricion'];
        $sets = [];
        $params = [];

        foreach ($columnas as $columna) {
            if (array_key_exists($columna, $campos)) {
                $sets[] = $columna . ' = ?';
                $params[] = $campos[$columna];

                if ($columna === 'imagen_url') {
                    // Una URL nueva (o quitada) debe volver a verificarse.
                    $sets[] = 'imagen_estado = NULL';
                    $sets[] = 'imagen_verificada_at = NULL';
                }
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

    public function reactivate(int $id): void
    {
        $statement = $this->pdo->prepare(
            "UPDATE productos SET estado = 'activo' WHERE id = ?"
        );
        $statement->execute([$id]);
    }

    /**
     * Catálogo mínimo de productos activos para relacionar tickets:
     * productos globales más los propios del usuario.
     *
     * @return array<int, array{id: int, nombre: string, unidad_base: string}>
     */
    public function activosParaMatch(?int $usuarioId = null): array
    {
        if ($usuarioId === null) {
            $statement = $this->pdo->prepare(
                "SELECT id, nombre, unidad_base
                 FROM productos
                 WHERE estado = 'activo' AND usuario_id IS NULL
                 ORDER BY nombre ASC, id ASC"
            );
            $statement->execute();
        } else {
            $statement = $this->pdo->prepare(
                "SELECT id, nombre, unidad_base
                 FROM productos
                 WHERE estado = 'activo' AND (usuario_id IS NULL OR usuario_id = ?)
                 ORDER BY nombre ASC, id ASC"
            );
            $statement->execute([$usuarioId]);
        }

        $productos = [];

        foreach ($statement->fetchAll() as $row) {
            $productos[] = [
                'id' => (int) $row['id'],
                'nombre' => (string) $row['nombre'],
                'unidad_base' => (string) $row['unidad_base'],
            ];
        }

        return $productos;
    }

    /**
     * Catálogo activo con categoría para resolver ingredientes de recetas.
     *
     * @return array<int, array{id: int, nombre: string, unidad_base: string, categoria_nombre: string, imagen_url: string|null}>
     */
    public function catalogoActivo(?int $usuarioId = null): array
    {
        if ($usuarioId === null) {
            $statement = $this->pdo->prepare(
                "SELECT p.id, p.nombre, p.unidad_base, c.nombre AS categoria_nombre, p.imagen_url,
                        p.kcal_100, p.peso_pieza_g, p.fuente_nutricion
                 FROM productos p
                 INNER JOIN categorias c ON c.id = p.categoria_id
                 WHERE p.estado = 'activo' AND p.usuario_id IS NULL
                 ORDER BY p.nombre ASC, p.id ASC"
            );
            $statement->execute();
        } else {
            $statement = $this->pdo->prepare(
                "SELECT p.id, p.nombre, p.unidad_base, c.nombre AS categoria_nombre, p.imagen_url,
                        p.kcal_100, p.peso_pieza_g, p.fuente_nutricion
                 FROM productos p
                 INNER JOIN categorias c ON c.id = p.categoria_id
                 WHERE p.estado = 'activo' AND (p.usuario_id IS NULL OR p.usuario_id = ?)
                 ORDER BY p.nombre ASC, p.id ASC"
            );
            $statement->execute([$usuarioId]);
        }

        $productos = [];

        foreach ($statement->fetchAll() as $row) {
            $productos[] = [
                'id' => (int) $row['id'],
                'nombre' => (string) $row['nombre'],
                'unidad_base' => (string) $row['unidad_base'],
                'categoria_nombre' => (string) $row['categoria_nombre'],
                'imagen_url' => isset($row['imagen_url']) ? (string) $row['imagen_url'] : null,
                'kcal_100' => isset($row['kcal_100']) ? (float) $row['kcal_100'] : null,
                'peso_pieza_g' => isset($row['peso_pieza_g']) ? (float) $row['peso_pieza_g'] : null,
                'fuente_nutricion' => isset($row['fuente_nutricion'])
                    ? (string) $row['fuente_nutricion']
                    : null,
            ];
        }

        return $productos;
    }

    /**
     * Catálogo activo para la copia local de la app móvil.
     *
     * Incluye los productos compartidos y los personales del usuario, y el
     * nombre normalizado con el que el cliente busca sin conexión.
     *
     * @return array<int, array{
     *     id: int, nombre: string, nombre_normalizado: string, nombre_orden: string,
     *     categoria_id: int, unidad_base: string, imagen_url: string|null,
     *     kcal_100: float|null, peso_pieza_g: float|null
     * }>
     */
    public function catalogoParaMovil(int $usuarioId): array
    {
        $statement = $this->pdo->prepare(
            "SELECT p.id, p.nombre, p.categoria_id, p.unidad_base, p.imagen_url,
                    p.kcal_100, p.peso_pieza_g
             FROM productos p
             WHERE p.estado = 'activo' AND (p.usuario_id IS NULL OR p.usuario_id = ?)
             ORDER BY p.nombre ASC, p.id ASC"
        );
        $statement->execute([$usuarioId]);

        $productos = [];

        foreach ($statement->fetchAll() as $row) {
            $nombre = (string) $row['nombre'];

            $productos[] = [
                'id' => (int) $row['id'],
                'nombre' => $nombre,
                'nombre_normalizado' => NormalizadorService::paraBusqueda($nombre),
                // MySQL ordena sin acentos y con el espacio antes que las
                // letras; el cliente ordena por esta clave para dar el mismo
                // orden con la collation binaria de SQLite.
                'nombre_orden' => NormalizadorService::normalizar($nombre),
                'categoria_id' => (int) $row['categoria_id'],
                'unidad_base' => (string) $row['unidad_base'],
                'imagen_url' => isset($row['imagen_url']) ? (string) $row['imagen_url'] : null,
                'kcal_100' => isset($row['kcal_100']) ? (float) $row['kcal_100'] : null,
                'peso_pieza_g' => isset($row['peso_pieza_g']) ? (float) $row['peso_pieza_g'] : null,
            ];
        }

        return $productos;
    }

    /**
     * Huella del catálogo visible para el usuario.
     *
     * Cambia cuando se crea, edita, activa o desactiva un producto, y cuando
     * cambia el nombre de una categoría. El cliente la envía para evitar
     * descargar el snapshot completo sin necesidad.
     */
    public function versionCatalogo(int $usuarioId): string
    {
        $productos = $this->pdo->prepare(
            "SELECT COUNT(*) AS total, COALESCE(MAX(id), 0) AS ultimo_id,
                    COALESCE(MAX(updated_at), '') AS ultima_fecha
             FROM productos
             WHERE estado = 'activo' AND (usuario_id IS NULL OR usuario_id = ?)"
        );
        $productos->execute([$usuarioId]);
        $fila = $productos->fetch() ?: [];

        $categorias = $this->pdo
            ->query(
                "SELECT COUNT(*) AS total,
                        COALESCE(MD5(GROUP_CONCAT(CONCAT(id, ':', nombre) ORDER BY id)), '') AS huella
                 FROM categorias"
            )
            ->fetch() ?: [];

        return sha1(implode('|', [
            (int) ($fila['total'] ?? 0),
            (int) ($fila['ultimo_id'] ?? 0),
            (string) ($fila['ultima_fecha'] ?? ''),
            (int) ($categorias['total'] ?? 0),
            (string) ($categorias['huella'] ?? ''),
        ]));
    }

    /**
     * Datos nutricionales de varios productos en una sola consulta.
     *
     * @param array<int, int|string> $ids
     * @return array<int, array<string, mixed>>
     */
    public function nutricionPorIds(array $ids): array
    {
        $limpios = [];

        foreach ($ids as $id) {
            $id = (int) $id;

            if ($id > 0) {
                $limpios[$id] = $id;
            }
        }

        if ($limpios === []) {
            return [];
        }

        $marcadores = implode(',', array_fill(0, count($limpios), '?'));
        $statement = $this->pdo->prepare(
            "SELECT id, nombre, unidad_base, kcal_100, peso_pieza_g, fuente_nutricion
             FROM productos
             WHERE id IN ({$marcadores})"
        );
        $statement->execute(array_values($limpios));

        $resultado = [];

        foreach ($statement->fetchAll() as $row) {
            $resultado[(int) $row['id']] = $row;
        }

        return $resultado;
    }

    public function categoriaExists(int $id): bool
    {
        $statement = $this->pdo->prepare('SELECT 1 FROM categorias WHERE id = ? LIMIT 1');
        $statement->execute([$id]);

        return $statement->fetchColumn() !== false;
    }

    /**
     * Comprueba si ya existe una categoría con ese nombre (sin distinguir
     * mayúsculas ni acentos, según la collation de la tabla).
     */
    public function categoriaNombreExists(string $nombre): bool
    {
        $statement = $this->pdo->prepare('SELECT 1 FROM categorias WHERE nombre = ? LIMIT 1');
        $statement->execute([$nombre]);

        return $statement->fetchColumn() !== false;
    }

    /**
     * @return array{id: int, nombre: string}
     */
    public function createCategoria(string $nombre): array
    {
        $statement = $this->pdo->prepare('INSERT INTO categorias (nombre) VALUES (?)');
        $statement->execute([$nombre]);

        return [
            'id' => (int) $this->pdo->lastInsertId(),
            'nombre' => $nombre,
        ];
    }

    /**
     * Productos globales con imagen para verificar su disponibilidad.
     *
     * @return array<int, array{id: int, imagen_url: string}>
     */
    public function productosConImagen(): array
    {
        $statement = $this->pdo->query(
            "SELECT id, imagen_url
             FROM productos
             WHERE usuario_id IS NULL AND imagen_url IS NOT NULL AND imagen_url <> ''
             ORDER BY id ASC"
        );

        $productos = [];

        foreach ($statement->fetchAll() as $row) {
            $productos[] = [
                'id' => (int) $row['id'],
                'imagen_url' => (string) $row['imagen_url'],
            ];
        }

        return $productos;
    }

    public function setImagenEstado(int $id, string $estado): void
    {
        $statement = $this->pdo->prepare(
            'UPDATE productos
             SET imagen_estado = ?, imagen_verificada_at = NOW()
             WHERE id = ?'
        );
        $statement->execute([$estado, $id]);
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
