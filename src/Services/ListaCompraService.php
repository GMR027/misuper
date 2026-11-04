<?php

declare(strict_types=1);

namespace App\Services;

use App\Repositories\ListaCompraRepository;
use App\Repositories\ProductoRepository;
use InvalidArgumentException;

/**
 * Reglas de las listas personales «Productos por comprar».
 */
final class ListaCompraService
{
    public const MAX_ITEMS = 100;

    private const UNIDADES = ['kg', 'gr', 'L', 'ml', 'pza'];

    private readonly ListaCompraRepository $lista;
    private readonly ProductoRepository $productos;

    public function __construct(
        ?ListaCompraRepository $lista = null,
        ?ProductoRepository $productos = null
    ) {
        $this->lista = $lista ?? new ListaCompraRepository();
        $this->productos = $productos ?? new ProductoRepository();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function listas(int $usuarioId): array
    {
        return $this->lista->listsByUser($usuarioId);
    }

    /**
     * @param array<string, mixed> $data
     * @return array<string, mixed>
     */
    public function crearLista(int $usuarioId, array $data): array
    {
        $nombre = trim((string) ($data['nombre'] ?? ''));

        if ($nombre === '' || mb_strlen($nombre) > 100) {
            throw new InvalidArgumentException('El nombre de la lista debe tener entre 1 y 100 caracteres.');
        }

        return $this->lista->createList($usuarioId, $nombre);
    }

    /**
     * @param array<string, mixed> $data
     * @return array<string, mixed>|null
     */
    public function renombrarLista(int $usuarioId, int $listId, array $data): ?array
    {
        $nombre = trim((string) ($data['nombre'] ?? ''));

        if ($nombre === '' || mb_strlen($nombre) > 100) {
            throw new InvalidArgumentException('El nombre de la lista debe tener entre 1 y 100 caracteres.');
        }

        return $this->lista->updateList($listId, $usuarioId, $nombre);
    }

    public function eliminarLista(int $usuarioId, int $listId): bool
    {
        return $this->lista->deleteList($listId, $usuarioId);
    }

    /**
     * @return array{lista: array<string, mixed>, items: array<int, array<string, mixed>>}|null
     */
    public function items(int $usuarioId, int $listId): ?array
    {
        $lista = $this->lista->findListOwned($listId, $usuarioId);

        if ($lista === null) {
            return null;
        }

        return [
            'lista' => $lista,
            'items' => $this->lista->itemsByList($listId, $usuarioId),
        ];
    }

    /**
     * Acepta un ítem o un arreglo {items: [...]}. Devuelve los ítems de la lista.
     *
     * @param array<string, mixed> $data
     * @return array<int, array<string, mixed>>|null
     */
    public function agregarItems(int $usuarioId, int $listId, array $data): ?array
    {
        if ($this->lista->findListOwned($listId, $usuarioId) === null) {
            return null;
        }

        $items = isset($data['items']) && is_array($data['items'])
            ? $data['items']
            : [$data];

        if ($items === []) {
            throw new InvalidArgumentException('No hay productos para agregar.');
        }

        if (count($items) > self::MAX_ITEMS) {
            throw new InvalidArgumentException('La lista admite como máximo 100 productos por operación.');
        }

        $normalizados = [];

        foreach ($items as $item) {
            if (!is_array($item)) {
                continue;
            }

            $normalizados[] = $this->normalizarItem($usuarioId, $item);
        }

        if ($normalizados === []) {
            throw new InvalidArgumentException('No hay productos válidos para agregar.');
        }

        return $this->lista->createMany($usuarioId, $listId, $normalizados);
    }

    /**
     * @param array<string, mixed> $data
     * @return array<string, mixed>|null
     */
    public function actualizarItem(int $usuarioId, int $itemId, array $data): ?array
    {
        $campos = [];

        if (array_key_exists('nombre', $data)) {
            $nombre = trim((string) $data['nombre']);

            if ($nombre === '' || mb_strlen($nombre) > 150) {
                throw new InvalidArgumentException('El nombre debe tener entre 1 y 150 caracteres.');
            }

            $campos['nombre'] = $nombre;
        }

        if (array_key_exists('cantidad', $data)) {
            $campos['cantidad'] = $this->cantidad($data['cantidad']);
        }

        if (array_key_exists('unidad_base', $data)) {
            $unidad = (string) $data['unidad_base'];

            if (!in_array($unidad, self::UNIDADES, true)) {
                throw new InvalidArgumentException('La unidad no es válida.');
            }

            $campos['unidad_base'] = $unidad;
        }

        return $this->lista->updateItem($itemId, $usuarioId, $campos);
    }

    public function eliminarItem(int $usuarioId, int $itemId): bool
    {
        return $this->lista->deleteItem($itemId, $usuarioId);
    }

    public function vaciarLista(int $usuarioId, int $listId): int
    {
        return $this->lista->clearList($listId, $usuarioId);
    }

    public function enviarLista(int $usuarioId, int $listId): int
    {
        return $this->lista->markEnviado($listId, $usuarioId);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function consumir(int $usuarioId): array
    {
        return $this->lista->consume($usuarioId);
    }

    public function contarPendientes(int $usuarioId): int
    {
        return $this->lista->countPendientes($usuarioId);
    }

    /**
     * @param array<string, mixed> $item
     * @return array{producto_id: int|null, nombre: string, cantidad: float, unidad_base: string, origen: string|null}
     */
    private function normalizarItem(int $usuarioId, array $item): array
    {
        $nombre = trim((string) ($item['nombre'] ?? ''));

        if ($nombre === '' || mb_strlen($nombre) > 150) {
            throw new InvalidArgumentException('Cada producto necesita un nombre de 1 a 150 caracteres.');
        }

        $cantidad = $this->cantidad($item['cantidad'] ?? null);
        $unidad = (string) ($item['unidad_base'] ?? '');

        if (!in_array($unidad, self::UNIDADES, true)) {
            throw new InvalidArgumentException('La unidad de un producto no es válida.');
        }

        $productoId = isset($item['producto_id']) && $item['producto_id'] !== null
            ? (int) $item['producto_id']
            : null;

        if ($productoId !== null) {
            $producto = $this->productos->findById($productoId);

            if (
                $producto === null
                || $producto->estado !== 'activo'
                || ($producto->usuarioId !== null && $producto->usuarioId !== $usuarioId)
            ) {
                $productoId = null;
            }
        }

        $origen = isset($item['origen']) ? trim((string) $item['origen']) : null;
        $origen = $origen === '' ? null : mb_substr($origen, 0, 255);

        return [
            'producto_id' => $productoId,
            'nombre' => $nombre,
            'cantidad' => $cantidad,
            'unidad_base' => $unidad,
            'origen' => $origen,
        ];
    }

    private function cantidad(mixed $value): float
    {
        if (!is_numeric($value)) {
            throw new InvalidArgumentException('La cantidad debe ser un número.');
        }

        $cantidad = round((float) $value, 3);

        if ($cantidad <= 0 || $cantidad > 999999) {
            throw new InvalidArgumentException('La cantidad debe ser mayor que 0.');
        }

        return $cantidad;
    }
}
