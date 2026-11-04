<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\CompraItem;
use App\Repositories\CompraRepository;
use App\Repositories\TicketRepository;
use App\Support\Database;
use App\Validators\CompraValidator;
use DomainException;
use InvalidArgumentException;
use PDO;
use Throwable;

/**
 * Reglas de negocio de compras e ítems.
 *
 * Cada operación que modifica ítems y su recálculo de total se ejecuta en
 * una sola transacción.
 */
final class CompraService
{
    public const PER_PAGE = 20;

    private const MAX_FRECUENTES = 8;

    private const MAX_BUSQUEDA = 10;

    private readonly PDO $pdo;

    private readonly CompraRepository $compras;

    private readonly TotalesService $totales;

    private readonly TicketRepository $tickets;

    public function __construct(
        ?CompraRepository $compras = null,
        ?TotalesService $totales = null,
        ?PDO $pdo = null,
        ?TicketRepository $tickets = null
    ) {
        $this->pdo = $pdo ?? Database::connection();
        $this->compras = $compras ?? new CompraRepository($this->pdo);
        $this->totales = $totales ?? new TotalesService($this->pdo);
        $this->tickets = $tickets ?? new TicketRepository($this->pdo);
    }

    /**
     * Valida POST /api/compras, incluida la existencia de cada producto.
     *
     * @param array<string, mixed> $data
     * @return array<string, string>
     */
    public function validarCreacion(array $data, ?int $usuarioId = null): array
    {
        $errors = CompraValidator::crear($data);
        $items = $data['items'] ?? null;

        if (!is_array($items)) {
            return $errors;
        }

        foreach ($items as $index => $item) {
            if (!is_array($item)) {
                continue;
            }

            $prefix = "items.{$index}.";

            if (isset($errors[$prefix . 'producto_id']) || isset($errors[$prefix . '_general'])) {
                continue;
            }

            $productoId = $this->productoId($item);

            if ($productoId !== null && $this->compras->productoActivo($productoId, $usuarioId) === null) {
                $errors[$prefix . 'producto_id'] = 'El producto no existe o está inactivo.';
            }
        }

        return $errors;
    }

    /**
     * Valida un ítem nuevo, incluida la existencia del producto.
     *
     * @param array<string, mixed> $data
     * @return array<string, string>
     */
    public function validarItem(array $data, ?int $usuarioId = null): array
    {
        $errors = CompraValidator::item($data);

        if (isset($errors['producto_id']) || isset($errors['_general'])) {
            return $errors;
        }

        $productoId = $this->productoId($data);

        if ($productoId !== null && $this->compras->productoActivo($productoId, $usuarioId) === null) {
            $errors['producto_id'] = 'El producto no existe o está inactivo.';
        }

        return $errors;
    }

    /**
     * @param array<string, mixed> $data Ya validado.
     * @return array{id: int, fecha: string, total: float, items_count: int, ticket_id: int|null}
     */
    public function crear(int $usuarioId, array $data): array
    {
        return $this->crearInterno($usuarioId, $data, null, null);
    }

    /**
     * Crea la compra y marca el ticket como confirmado en la misma transacción.
     * Si la compra falla, el ticket permanece pendiente para reintentar.
     *
     * @param array<string, mixed> $data Ya validado.
     * @return array{id: int, fecha: string, total: float, items_count: int, ticket_id: int|null}
     */
    public function crearDesdeTicket(
        int $usuarioId,
        array $data,
        int $ticketId,
        ?string $titulo = null
    ): array {
        return $this->crearInterno($usuarioId, $data, $ticketId, $titulo);
    }

    /**
     * @param array<string, mixed> $data Ya validado.
     * @return array{id: int, fecha: string, total: float, items_count: int, ticket_id: int|null}
     */
    private function crearInterno(
        int $usuarioId,
        array $data,
        ?int $ticketId,
        ?string $titulo = null
    ): array {
        $this->pdo->beginTransaction();

        try {
            $compraId = $this->compras->create($usuarioId, (string) $data['fecha']);

            foreach ($data['items'] as $item) {
                if (!is_array($item)) {
                    throw new InvalidArgumentException('Ítem inválido.');
                }

                $this->persistirItem($compraId, $item, $usuarioId);
            }

            $this->totales->recalcular($compraId);

            if ($ticketId !== null && !$this->tickets->marcarConfirmado($ticketId, $usuarioId, $compraId, $titulo)) {
                throw new DomainException('El ticket ya fue confirmado o no está disponible.', 409);
            }

            $compra = $this->compras->findOwned($compraId, $usuarioId);

            if ($compra === null) {
                throw new InvalidArgumentException('No se pudo leer la compra recién creada.');
            }

            $itemsCount = $this->compras->countItems($compraId);
            $this->pdo->commit();

            return $compra->toSummaryArray($itemsCount);
        } catch (Throwable $error) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }

            throw $error;
        }
    }

    /**
     * @return array{items: array<int, array<string, mixed>>, total: int, page: int, per_page: int}
     */
    public function listar(int $usuarioId, int $page): array
    {
        $page = max(1, $page);
        $resultado = $this->compras->listByUser($usuarioId, $page, self::PER_PAGE);

        return [
            'items' => array_map(
                static fn (array $fila): array => $fila['compra']->toSummaryArray($fila['items_count']),
                $resultado['items']
            ),
            'total' => $resultado['total'],
            'page' => $page,
            'per_page' => self::PER_PAGE,
        ];
    }

    /**
     * @return array{id: int, fecha: string, total: float, items: array<int, array<string, mixed>>}|null
     */
    public function obtener(int $usuarioId, int $compraId): ?array
    {
        $compra = $this->compras->findOwned($compraId, $usuarioId);

        if ($compra === null) {
            return null;
        }

        $items = array_map(
            static fn (CompraItem $item): array => $item->toArray(),
            $this->compras->items($compra->id)
        );

        return $compra->toDetailArray($items);
    }

    /**
     * @return array{id: int, fecha: string, total: float, items_count: int}|null
     */
    public function actualizarFecha(int $usuarioId, int $compraId, string $fecha): ?array
    {
        $compra = $this->compras->findOwned($compraId, $usuarioId);

        if ($compra === null) {
            return null;
        }

        $this->compras->updateFecha($compraId, $usuarioId, $fecha);
        $actualizada = $this->compras->findOwned($compraId, $usuarioId);

        if ($actualizada === null) {
            return null;
        }

        return $actualizada->toSummaryArray($this->compras->countItems($compraId));
    }

    public function eliminar(int $usuarioId, int $compraId): bool
    {
        if ($this->compras->findOwned($compraId, $usuarioId) === null) {
            return false;
        }

        return $this->compras->delete($compraId, $usuarioId);
    }

    /**
     * @param array<string, mixed> $data Ya validado.
     * @return array<string, mixed>|null null si la compra no es del usuario.
     */
    public function agregarItem(int $usuarioId, int $compraId, array $data): ?array
    {
        $this->pdo->beginTransaction();

        try {
            if ($this->compras->findOwned($compraId, $usuarioId) === null) {
                $this->pdo->rollBack();

                return null;
            }

            $itemId = $this->persistirItem($compraId, $data, $usuarioId);
            $this->totales->recalcular($compraId);

            $item = $this->compras->findItemWithProduct($itemId);
            $this->pdo->commit();

            return $item?->toArray();
        } catch (Throwable $error) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }

            throw $error;
        }
    }

    /**
     * @param array<string, mixed> $data Ya validado.
     * @return array<string, mixed>|null null si la compra o el ítem no son del usuario.
     */
    public function actualizarItem(int $usuarioId, int $compraId, int $itemId, array $data): ?array
    {
        $this->pdo->beginTransaction();

        try {
            if ($this->compras->findOwned($compraId, $usuarioId) === null) {
                $this->pdo->rollBack();

                return null;
            }

            if ($this->compras->findItemOwned($itemId, $compraId, $usuarioId) === null) {
                $this->pdo->rollBack();

                return null;
            }

            $campos = [];

            if (array_key_exists('cantidad', $data)) {
                $campos['cantidad'] = $data['cantidad'];
            }

            if (array_key_exists('precio_total', $data)) {
                $campos['precio_total'] = $data['precio_total'];
            }

            $this->compras->updateItem($itemId, $campos);
            $this->totales->recalcular($compraId);

            $item = $this->compras->findItemWithProduct($itemId);
            $this->pdo->commit();

            return $item?->toArray();
        } catch (Throwable $error) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }

            throw $error;
        }
    }

    public function eliminarItem(int $usuarioId, int $compraId, int $itemId): bool
    {
        $this->pdo->beginTransaction();

        try {
            if ($this->compras->findOwned($compraId, $usuarioId) === null) {
                $this->pdo->rollBack();

                return false;
            }

            if ($this->compras->findItemOwned($itemId, $compraId, $usuarioId) === null) {
                $this->pdo->rollBack();

                return false;
            }

            $this->compras->deleteItem($itemId);
            $this->totales->recalcular($compraId);
            $this->pdo->commit();

            return true;
        } catch (Throwable $error) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }

            throw $error;
        }
    }

    /**
     * @return array<int, array{id: int, nombre: string, categoria_id: int, unidad_base: string, imagen_url: string|null, veces_comprado: int, ultimo_precio: float|null}>
     */
    public function frecuentes(int $usuarioId): array
    {
        return $this->compras->frecuentes($usuarioId, self::MAX_FRECUENTES);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function buscarProductos(int $usuarioId, string $q, ?int $categoriaId): array
    {
        return $this->compras->buscarActivos(
            NormalizadorService::normalizar($q),
            $categoriaId,
            self::MAX_BUSQUEDA,
            $usuarioId
        );
    }

    /**
     * @param array<string, mixed> $item
     */
    private function persistirItem(int $compraId, array $item, ?int $usuarioId = null): int
    {
        $productoId = $this->productoId($item);
        $nombreLibre = null;

        if ($productoId !== null) {
            if ($this->compras->productoActivo($productoId, $usuarioId) === null) {
                throw new InvalidArgumentException('El producto no existe o está inactivo.');
            }
        } else {
            $nombreLibre = trim((string) ($item['nombre_libre'] ?? ''));
        }

        return $this->compras->addItem(
            $compraId,
            $productoId,
            $nombreLibre,
            (string) $item['cantidad'],
            (string) $item['precio_total']
        );
    }

    /**
     * @param array<string, mixed> $item
     */
    private function productoId(array $item): ?int
    {
        $valor = $item['producto_id'] ?? null;

        if ($valor === null || $valor === '') {
            return null;
        }

        return (int) $valor;
    }
}
