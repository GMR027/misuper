<?php

declare(strict_types=1);

namespace App\Services;

use App\Repositories\ProductoOmisionRepository;
use InvalidArgumentException;

/**
 * Ingredientes que el usuario decide omitir al comparar recetas con lo que
 * compró (sal, aceite, especias…). La lista es personal y se aplica tanto al
 * filtrado de recetas como a la lista de compras generada.
 */
final class ProductoOmisionService
{
    public const MAX_PRODUCTOS = 100;
    public const MAX_NOMBRE = 100;

    private readonly ProductoOmisionRepository $productos;

    public function __construct(?ProductoOmisionRepository $productos = null)
    {
        $this->productos = $productos ?? new ProductoOmisionRepository();
    }

    /**
     * @return array{items: array<int, array{id: int, nombre: string}>, total: int}
     */
    public function listar(int $usuarioId): array
    {
        $items = $this->productos->listarPorUsuario($usuarioId);

        return [
            'items' => $items,
            'total' => count($items),
        ];
    }

    /**
     * @return array{id: int, nombre: string}
     */
    public function crear(int $usuarioId, mixed $nombre): array
    {
        $nombre = is_string($nombre) ? trim($nombre) : '';

        if ($nombre === '' || mb_strlen($nombre, 'UTF-8') < 2 || mb_strlen($nombre, 'UTF-8') > self::MAX_NOMBRE) {
            throw new InvalidArgumentException(
                'Escribe un producto de entre 2 y ' . self::MAX_NOMBRE . ' caracteres.'
            );
        }

        if ($this->productos->contar($usuarioId) >= self::MAX_PRODUCTOS) {
            throw new InvalidArgumentException(
                'La lista llegó al límite de ' . self::MAX_PRODUCTOS . ' productos.'
            );
        }

        $normalizado = NormalizadorService::normalizar($nombre);

        if ($this->productos->existe($usuarioId, $normalizado)) {
            throw new InvalidArgumentException('Ese producto ya está en la lista.');
        }

        $id = $this->productos->crear($usuarioId, $nombre, $normalizado);

        return ['id' => $id, 'nombre' => $nombre];
    }

    public function eliminar(int $usuarioId, int $id): bool
    {
        return $this->productos->eliminar($id, $usuarioId);
    }

    /**
     * Tokens normalizados de cada producto omitido, para compararlos con los
     * nombres de los ingredientes de las recetas.
     *
     * @return array<int, array<int, string>>
     */
    public function tokens(int $usuarioId): array
    {
        $tokens = [];

        foreach ($this->productos->nombresPorUsuario($usuarioId) as $nombre) {
            $partes = NormalizadorService::tokensNombre($nombre);

            if ($partes !== []) {
                $tokens[] = $partes;
            }
        }

        return $tokens;
    }
}
