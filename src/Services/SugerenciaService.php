<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Sugerencia;
use App\Repositories\ProductoRepository;
use App\Repositories\SugerenciaRepository;
use App\Support\Database;
use App\Validators\SugerenciaValidator;
use PDO;
use PDOException;
use Throwable;

/**
 * Reglas de negocio de las sugerencias de productos no catalogados.
 *
 * Un usuario solo mantiene una sugerencia pendiente por nombre normalizado.
 * Aprobar o ignorar resuelve todas las pendientes de ese nombre.
 */
final class SugerenciaService
{
    public const ESTADOS = ['pendiente', 'aprobada', 'ignorada'];

    private readonly PDO $pdo;

    private readonly SugerenciaRepository $sugerencias;

    private readonly ProductoRepository $productos;

    public function __construct(
        ?SugerenciaRepository $sugerencias = null,
        ?ProductoRepository $productos = null,
        ?PDO $pdo = null
    ) {
        $this->pdo = $pdo ?? Database::connection();
        $this->sugerencias = $sugerencias ?? new SugerenciaRepository($this->pdo);
        $this->productos = $productos ?? new ProductoRepository($this->pdo);
    }

    /**
     * @param array<string, mixed> $data
     * @return array<string, string>
     */
    public function validarCreacion(array $data): array
    {
        return SugerenciaValidator::crear($data);
    }

    /**
     * @param array<string, mixed> $data
     * @return array<string, string>
     */
    public function validarAprobacion(array $data): array
    {
        $errors = SugerenciaValidator::aprobar($data);

        if (!isset($errors['categoria_id'])) {
            $categoriaId = ProductoService::enteroPositivo($data['categoria_id'] ?? null);

            if ($categoriaId === null || !$this->productos->categoriaExists($categoriaId)) {
                $errors['categoria_id'] = 'La categoría no existe.';
            }
        }

        return $errors;
    }

    /**
     * Registra una sugerencia pendiente de forma idempotente por usuario.
     *
     * @param array<string, mixed> $data Ya validado por validarCreacion().
     * @return array{creada: bool, sugerencia: Sugerencia}
     */
    public function registrar(int $usuarioId, array $data): array
    {
        $nombreOriginal = trim((string) $data['nombre']);
        $nombreNormalizado = NormalizadorService::normalizar($nombreOriginal);

        $existente = $this->sugerencias->findPendiente($usuarioId, $nombreNormalizado);

        if ($existente !== null) {
            return ['creada' => false, 'sugerencia' => $existente];
        }

        try {
            $sugerencia = $this->sugerencias->create($usuarioId, $nombreNormalizado, $nombreOriginal);
        } catch (PDOException $error) {
            // Dos peticiones simultáneas pueden chocar con el UNIQUE. En ese
            // caso devolvemos la pendiente que ganó la carrera.
            if ((string) $error->getCode() !== '23000') {
                throw $error;
            }

            $existente = $this->sugerencias->findPendiente($usuarioId, $nombreNormalizado);

            if ($existente === null) {
                throw $error;
            }

            return ['creada' => false, 'sugerencia' => $existente];
        }

        return ['creada' => true, 'sugerencia' => $sugerencia];
    }

    /**
     * @return array<int, array{
     *     nombre_normalizado: string,
     *     nombre_original: string,
     *     total: int,
     *     ids: array<int, int>,
     *     primera_fecha: string,
     *     ultima_fecha: string
     * }>
     */
    public function listarAgrupadas(string $estado): array
    {
        return $this->sugerencias->agruparPorEstado($estado);
    }

    /**
     * Crea el producto y resuelve todas las pendientes del grupo.
     *
     * @param array<string, mixed> $data Ya validado por validarAprobacion().
     * @return array{status: string, producto_id?: int, nombre?: string, sugerencias_resueltas?: int}
     */
    public function aprobar(int $id, array $data): array
    {
        $this->pdo->beginTransaction();

        try {
            $sugerencia = $this->sugerencias->findById($id);

            if ($sugerencia === null) {
                $this->pdo->rollBack();

                return ['status' => 'not_found'];
            }

            if ($sugerencia->estado !== 'pendiente') {
                $this->pdo->rollBack();

                return ['status' => 'not_pending'];
            }

            $producto = $this->productos->create(
                $sugerencia->nombreOriginal,
                (int) $data['categoria_id'],
                (string) $data['unidad_base'],
                self::normalizarImagen($data['imagen_url'] ?? null)
            );

            $resueltas = $this->sugerencias->resolverGrupo(
                $sugerencia->nombreNormalizado,
                'aprobada'
            );

            $this->pdo->commit();

            return [
                'status' => 'ok',
                'producto_id' => $producto->id,
                'nombre' => $producto->nombre,
                'sugerencias_resueltas' => $resueltas,
            ];
        } catch (Throwable $error) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }

            throw $error;
        }
    }

    /**
     * Marca como ignoradas todas las pendientes del grupo.
     *
     * @return array{status: string, sugerencias_resueltas?: int}
     */
    public function ignorar(int $id): array
    {
        $this->pdo->beginTransaction();

        try {
            $sugerencia = $this->sugerencias->findById($id);

            if ($sugerencia === null) {
                $this->pdo->rollBack();

                return ['status' => 'not_found'];
            }

            if ($sugerencia->estado !== 'pendiente') {
                $this->pdo->rollBack();

                return ['status' => 'not_pending'];
            }

            $resueltas = $this->sugerencias->resolverGrupo(
                $sugerencia->nombreNormalizado,
                'ignorada'
            );

            $this->pdo->commit();

            return [
                'status' => 'ok',
                'sugerencias_resueltas' => $resueltas,
            ];
        } catch (Throwable $error) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }

            throw $error;
        }
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
