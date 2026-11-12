<?php

declare(strict_types=1);

namespace App\Validators;

use DateTimeImmutable;

/**
 * Validación de compras, fechas e ítems.
 *
 * Devuelve mapas campo => mensaje para responder 422.
 */
final class CompraValidator
{
    public const UNIDADES = ['kg', 'gr', 'L', 'ml', 'pza'];

    public const MAX_ITEMS = 100;

    /**
     * @param array<string, mixed> $data
     * @return array<string, string>
     */
    public static function crear(array $data): array
    {
        $errors = [];

        $fechaError = self::validarFechaValor($data['fecha'] ?? null);

        if ($fechaError !== null) {
            $errors['fecha'] = $fechaError;
        }

        $comercioError = self::validarComercio($data['comercio'] ?? null);

        if ($comercioError !== null) {
            $errors['comercio'] = $comercioError;
        }

        $uuidError = self::validarClienteUuid($data['cliente_uuid'] ?? null);

        if ($uuidError !== null) {
            $errors['cliente_uuid'] = $uuidError;
        }

        $items = $data['items'] ?? null;

        if (!is_array($items) || !array_is_list($items)) {
            $errors['items'] = 'Los ítems deben ser una lista.';

            return $errors;
        }

        if (count($items) < 1) {
            $errors['items'] = 'Agrega al menos un ítem a la compra.';
        } elseif (count($items) > self::MAX_ITEMS) {
            $errors['items'] = 'La compra admite como máximo ' . self::MAX_ITEMS . ' ítems.';
        } else {
            foreach ($items as $index => $item) {
                if (!is_array($item)) {
                    $errors["items.{$index}._general"] = 'El ítem no tiene un formato válido.';

                    continue;
                }

                foreach (self::validarItem($item, false) as $campo => $mensaje) {
                    $errors["items.{$index}.{$campo}"] = $mensaje;
                }
            }
        }

        return $errors;
    }

    /**
     * Validación de PUT /api/compras/{id}: fecha y/o comercio.
     *
     * @param array<string, mixed> $data
     * @return array<string, string>
     */
    public static function fecha(array $data): array
    {
        return self::compraParcial($data);
    }

    /**
     * @param array<string, mixed> $data
     * @return array<string, string>
     */
    public static function compraParcial(array $data): array
    {
        $errors = [];

        if (!array_key_exists('fecha', $data) && !array_key_exists('comercio', $data)) {
            $errors['_general'] = 'Envía fecha o comercio para actualizar la compra.';
        }

        if (array_key_exists('fecha', $data)) {
            $fechaError = self::validarFechaValor($data['fecha'] ?? null);

            if ($fechaError !== null) {
                $errors['fecha'] = $fechaError;
            }
        }

        if (array_key_exists('comercio', $data)) {
            $comercioError = self::validarComercio($data['comercio'] ?? null);

            if ($comercioError !== null) {
                $errors['comercio'] = $comercioError;
            }
        }

        return $errors;
    }

    /**
     * Validación de un ítem nuevo.
     *
     * @param array<string, mixed> $data
     * @return array<string, string>
     */
    public static function item(array $data): array
    {
        return self::validarItem($data, false);
    }

    /**
     * Validación de un ítem editado: cantidad y/o precio_total.
     *
     * @param array<string, mixed> $data
     * @return array<string, string>
     */
    public static function itemParcial(array $data): array
    {
        return self::validarItem($data, true);
    }

    /**
     * @param array<string, mixed> $data
     * @return array<string, string>
     */
    private static function validarItem(array $data, bool $parcial): array
    {
        $errors = [];

        if ($parcial) {
            $campos = ['cantidad', 'precio_total', 'unidad_base', 'comercio'];
            $enviados = array_filter($campos, static fn (string $campo): bool => array_key_exists($campo, $data));

            if ($enviados === []) {
                $errors['_general'] = 'Envía cantidad, precio_total, unidad_base o comercio para actualizar el ítem.';
            }

            if (array_key_exists('cantidad', $data)) {
                $error = self::validarDecimal($data['cantidad'], 3, true);

                if ($error !== null) {
                    $errors['cantidad'] = $error;
                }
            }

            if (array_key_exists('precio_total', $data)) {
                $error = self::validarDecimal($data['precio_total'], 2, false);

                if ($error !== null) {
                    $errors['precio_total'] = $error;
                }
            }

            if (array_key_exists('unidad_base', $data)) {
                $unidad = $data['unidad_base'];

                if (!is_string($unidad) || !in_array($unidad, self::UNIDADES, true)) {
                    $errors['unidad_base'] = 'Selecciona una unidad base válida (kg, gr, L, ml o pza).';
                }
            }

            if (array_key_exists('comercio', $data)) {
                $comercioError = self::validarComercio($data['comercio']);

                if ($comercioError !== null) {
                    $errors['comercio'] = $comercioError;
                }
            }

            return $errors;
        }

        $productoId = $data['producto_id'] ?? null;
        $nombreLibre = $data['nombre_libre'] ?? null;
        $tieneProducto = $productoId !== null && $productoId !== '';
        $tieneLibre = is_string($nombreLibre) && trim($nombreLibre) !== '';

        if ($tieneProducto === $tieneLibre) {
            $errors['_general'] = 'Indica un producto_id o un nombre_libre, pero no ambos.';
        }

        if ($tieneProducto) {
            if (is_int($productoId) && $productoId > 0) {
                // válido
            } elseif (is_string($productoId) && ctype_digit($productoId) && (int) $productoId > 0) {
                // válido
            } else {
                $errors['producto_id'] = 'El producto_id no es válido.';
            }
        }

        if ($tieneLibre) {
            $texto = trim((string) $nombreLibre);
            $longitud = mb_strlen($texto, 'UTF-8');

            if ($longitud < 2 || $longitud > 150) {
                $errors['nombre_libre'] = 'El nombre libre debe tener entre 2 y 150 caracteres.';
            }
        }

        if (array_key_exists('unidad_base', $data)) {
            $unidad = $data['unidad_base'];

            if (!is_string($unidad) || !in_array($unidad, self::UNIDADES, true)) {
                $errors['unidad_base'] = 'Selecciona una unidad base válida (kg, gr, L, ml o pza).';
            }
        } elseif ($tieneLibre && !$tieneProducto) {
            $errors['unidad_base'] = 'Selecciona una unidad base válida (kg, gr, L, ml o pza).';
        }

        $comercioError = self::validarComercio($data['comercio'] ?? null);

        if ($comercioError !== null) {
            $errors['comercio'] = $comercioError;
        }

        $errorCantidad = self::validarDecimal($data['cantidad'] ?? null, 3, true);

        if ($errorCantidad !== null) {
            $errors['cantidad'] = $errorCantidad;
        }

        $errorPrecio = self::validarDecimal($data['precio_total'] ?? null, 2, false);

        if ($errorPrecio !== null) {
            $errors['precio_total'] = $errorPrecio;
        }

        return $errors;
    }

    /**
     * UUID que envía la app móvil para reintentar un guardado sin duplicarlo.
     * Ausente o null = operación normal, sin idempotencia.
     */
    public static function validarClienteUuid(mixed $valor): ?string
    {
        if ($valor === null) {
            return null;
        }

        if (
            !is_string($valor)
            || preg_match(
                '/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i',
                trim($valor)
            ) !== 1
        ) {
            return 'El identificador de reintento no es válido.';
        }

        return null;
    }

    private static function validarComercio(mixed $valor): ?string
    {
        if ($valor === null || $valor === '') {
            return null;
        }

        if (!is_string($valor)) {
            return 'El comercio no es válido.';
        }

        if (mb_strlen(trim($valor), 'UTF-8') > 120) {
            return 'El comercio no puede superar 120 caracteres.';
        }

        return null;
    }

    private static function validarFechaValor(mixed $valor): ?string
    {
        if (!is_string($valor) || preg_match('/^\d{4}-\d{2}-\d{2}$/', $valor) !== 1) {
            return 'La fecha debe tener formato YYYY-MM-DD.';
        }

        $fecha = DateTimeImmutable::createFromFormat('!Y-m-d', $valor);

        if ($fecha === false || $fecha->format('Y-m-d') !== $valor) {
            return 'La fecha no es válida.';
        }

        $hoy = new DateTimeImmutable('today');

        if ($fecha > $hoy) {
            return 'La fecha no puede ser futura.';
        }

        if ($fecha < $hoy->modify('-2 years')) {
            return 'La fecha no puede ser anterior a 2 años.';
        }

        return null;
    }

    private static function validarDecimal(mixed $valor, int $decimales, bool $mayorQueCero): ?string
    {
        if (!is_int($valor) && !is_float($valor) && !is_string($valor)) {
            return $mayorQueCero
                ? 'La cantidad debe ser mayor que 0.'
                : 'El precio total debe ser mayor o igual a 0.';
        }

        $texto = trim((string) $valor);
        $enteroMaximo = $mayorQueCero ? 9 : 10;

        if (
            $texto === ''
            || preg_match('/^\d{1,' . $enteroMaximo . '}(?:\.\d{1,' . $decimales . '})?$/', $texto) !== 1
        ) {
            return $mayorQueCero
                ? 'La cantidad debe ser un número mayor que 0 con hasta 3 decimales.'
                : 'El precio total debe ser un número mayor o igual a 0 con hasta 2 decimales.';
        }

        $numero = (float) $texto;

        if ($mayorQueCero && $numero <= 0) {
            return 'La cantidad debe ser mayor que 0.';
        }

        if (!$mayorQueCero && $numero < 0) {
            return 'El precio total debe ser mayor o igual a 0.';
        }

        return null;
    }
}
