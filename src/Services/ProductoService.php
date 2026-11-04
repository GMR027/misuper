<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Producto;
use App\Repositories\ProductoRepository;
use App\Validators\ProductoValidator;

/**
 * Reglas de negocio del catálogo: búsqueda, alta, edición y baja lógica.
 */
final class ProductoService
{
    public const PER_PAGE = 20;

    private const ESTADOS = ['activo', 'inactivo'];

    private const FILTROS_IMAGEN = ['sin_foto', 'vencida'];

    private readonly ProductoRepository $productos;

    public function __construct(?ProductoRepository $productos = null)
    {
        $this->productos = $productos ?? new ProductoRepository();
    }

    /**
     * Catálogo público: solo productos activos.
     *
     * @return array{items: array<int, array<string, mixed>>, total: int, page: int, per_page: int}
     */
    public function listarPublicos(?string $q, ?int $categoriaId, int $page): array
    {
        $page = max(1, $page);
        $resultado = $this->productos->searchPublic(
            NormalizadorService::normalizar((string) $q),
            $categoriaId,
            $page,
            self::PER_PAGE
        );

        return [
            'items' => array_map(
                static fn (Producto $producto): array => $producto->toPublicArray(),
                $resultado['items']
            ),
            'total' => $resultado['total'],
            'page' => $page,
            'per_page' => self::PER_PAGE,
        ];
    }

    /**
     * Catálogo del panel Admin: activos e inactivos según el filtro.
     *
     * @return array{items: array<int, array<string, mixed>>, total: int, page: int, per_page: int}
     */
    public function listarAdmin(
        ?string $q,
        ?int $categoriaId,
        ?string $estado,
        int $page,
        ?string $imagen = null
    ): array {
        $page = max(1, $page);
        $estado = in_array($estado, self::ESTADOS, true) ? $estado : null;
        $imagen = in_array($imagen, self::FILTROS_IMAGEN, true) ? $imagen : null;

        $resultado = $this->productos->searchAdmin(
            NormalizadorService::normalizar((string) $q),
            $categoriaId,
            $estado,
            $page,
            self::PER_PAGE,
            $imagen
        );

        return [
            'items' => array_map(
                static fn (Producto $producto): array => $producto->toAdminArray(),
                $resultado['items']
            ),
            'total' => $resultado['total'],
            'page' => $page,
            'per_page' => self::PER_PAGE,
        ];
    }

    /**
     * Validación de POST: reglas de campo + existencia real de la categoría.
     *
     * @param array<string, mixed> $data
     * @return array<string, string>
     */
    public function validarCreacion(array $data): array
    {
        $errors = ProductoValidator::crear($data);

        if (!isset($errors['categoria_id'])) {
            $categoriaId = self::enteroPositivo($data['categoria_id'] ?? null);

            if ($categoriaId === null || !$this->productos->categoriaExists($categoriaId)) {
                $errors['categoria_id'] = 'La categoría no existe.';
            }
        }

        return $errors;
    }

    /**
     * Validación de PUT: reglas de campo + existencia real de la categoría.
     *
     * @param array<string, mixed> $data
     * @return array<string, string>
     */
    public function validarActualizacion(array $data): array
    {
        $errors = ProductoValidator::actualizar($data);

        if (array_key_exists('categoria_id', $data) && !isset($errors['categoria_id'])) {
            $categoriaId = self::enteroPositivo($data['categoria_id']);

            if ($categoriaId === null || !$this->productos->categoriaExists($categoriaId)) {
                $errors['categoria_id'] = 'La categoría no existe.';
            }
        }

        return $errors;
    }

    /**
     * @param array<string, mixed> $data Ya validado por validarCreacion().
     */
    public function crear(array $data, ?int $usuarioId = null): Producto
    {
        return $this->productos->create(
            trim((string) $data['nombre']),
            (int) $data['categoria_id'],
            (string) $data['unidad_base'],
            self::normalizarImagen($data['imagen_url'] ?? null),
            $usuarioId
        );
    }

    /**
     * Alta de un producto propio del usuario (no visible para otros usuarios
     * ni para el panel Admin).
     *
     * @param array<string, mixed> $data Ya validado por validarCreacion().
     */
    public function crearPersonal(int $usuarioId, array $data): Producto
    {
        return $this->productos->create(
            trim((string) $data['nombre']),
            (int) $data['categoria_id'],
            (string) $data['unidad_base'],
            null,
            $usuarioId
        );
    }

    /**
     * @param array<string, mixed> $data Ya validado por validarActualizacion().
     * @return Producto|null null si el producto no existe.
     */
    public function actualizar(int $id, array $data): ?Producto
    {
        if ($this->productos->findGlobalById($id) === null) {
            return null;
        }

        $campos = [];

        if (array_key_exists('nombre', $data)) {
            $campos['nombre'] = trim((string) $data['nombre']);
        }

        if (array_key_exists('categoria_id', $data)) {
            $campos['categoria_id'] = (int) $data['categoria_id'];
        }

        if (array_key_exists('unidad_base', $data)) {
            $campos['unidad_base'] = (string) $data['unidad_base'];
        }

        if (array_key_exists('imagen_url', $data)) {
            $campos['imagen_url'] = self::normalizarImagen($data['imagen_url']);
        }

        if ($campos !== []) {
            $this->productos->update($id, $campos);
        }

        return $this->productos->findGlobalById($id);
    }

    /**
     * Soft delete. Idempotente: desactivar un producto ya inactivo no falla.
     *
     * @return bool false si el producto no existe.
     */
    public function desactivar(int $id): bool
    {
        if ($this->productos->findGlobalById($id) === null) {
            return false;
        }

        $this->productos->deactivate($id);

        return true;
    }

    public function obtenerParaAdmin(int $id): ?Producto
    {
        return $this->productos->findGlobalById($id);
    }

    /**
     * @return array<int, array{id: int, nombre: string}>
     */
    public function categorias(): array
    {
        return $this->productos->categorias();
    }

    /**
     * Crea una categoría del catálogo global.
     *
     * @return array{status: 'ok', categoria: array{id: int, nombre: string}}|array{status: 'invalida', errors: array<string, string>}
     */
    public function crearCategoria(mixed $nombre): array
    {
        if (!is_string($nombre)) {
            return [
                'status' => 'invalida',
                'errors' => ['nombre' => 'El nombre de la categoría es obligatorio.'],
            ];
        }

        $nombre = trim(preg_replace('/\s+/u', ' ', $nombre) ?? $nombre);

        if (mb_strlen($nombre) < 2) {
            return [
                'status' => 'invalida',
                'errors' => ['nombre' => 'El nombre debe tener al menos 2 caracteres.'],
            ];
        }

        if (mb_strlen($nombre) > 80) {
            return [
                'status' => 'invalida',
                'errors' => ['nombre' => 'El nombre debe tener como máximo 80 caracteres.'],
            ];
        }

        if ($this->productos->categoriaNombreExists($nombre)) {
            return [
                'status' => 'invalida',
                'errors' => ['nombre' => 'Ya existe una categoría con ese nombre.'],
            ];
        }

        try {
            $categoria = $this->productos->createCategoria($nombre);
        } catch (\PDOException $error) {
            // Carrera con otra creación simultánea: el UNIQUE de la tabla gana.
            if ((string) $error->getCode() === '23000') {
                return [
                    'status' => 'invalida',
                    'errors' => ['nombre' => 'Ya existe una categoría con ese nombre.'],
                ];
            }

            throw $error;
        }

        return [
            'status' => 'ok',
            'categoria' => $categoria,
        ];
    }

    /**
     * Convierte un valor de query string en entero positivo, o null.
     */
    public static function enteroPositivo(mixed $valor): ?int
    {
        if (is_int($valor)) {
            return $valor > 0 ? $valor : null;
        }

        if (!is_string($valor) || $valor === '' || !ctype_digit($valor)) {
            return null;
        }

        $numero = (int) $valor;

        return $numero > 0 ? $numero : null;
    }

    private static function normalizarImagen(mixed $imagen): ?string
    {
        if (!is_string($imagen)) {
            return null;
        }

        $imagen = trim($imagen);

        return $imagen === '' ? null : $imagen;
    }
}
