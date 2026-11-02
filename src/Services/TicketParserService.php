<?php

declare(strict_types=1);

namespace App\Services;

/**
 * Convierte el texto plano de Tesseract en una propuesta de artículos.
 *
 * Los tickets varían mucho entre tiendas. El parser aplica heurísticas
 * conservadoras: prefiere dejar fuera una línea dudosa a inventar un artículo.
 * El usuario siempre revisa el resultado antes de guardar la compra.
 */
final class TicketParserService
{
    private const MAX_ITEMS = 100;

    private const MESES = [
        'ene' => 1,
        'feb' => 2,
        'mar' => 3,
        'abr' => 4,
        'may' => 5,
        'jun' => 6,
        'jul' => 7,
        'ago' => 8,
        'sep' => 9,
        'set' => 9,
        'oct' => 10,
        'nov' => 11,
        'dic' => 12,
    ];

    private const RUIDO = [
        'ticket', 'factura', 'recibo', 'nota de venta', 'comprobante',
        'rfc', 'regimen fiscal', 'telefono', 'teléfono', 'direccion', 'dirección',
        'calle', 'avenida', 'colonia', 'sucursal', 'caja', 'cajero', 'turno',
        'folio', 'fecha', 'hora', 'gracias', 'iva', 'subtotal', 'total',
        'cambio', 'efectivo', 'tarjeta', 'debito', 'débito', 'credito', 'crédito',
        'pago', 'importe', 'descuento', 'propina', 'articulos', 'artículos',
        'unidades', 'redondeo', 'ahorro', 'puntos', 'cliente', 'vendedor',
        'www', 'http', 'moneda', 'cajon', 'cajón', 'terminal', 'autorizacion',
        'autorización', 'operacion', 'operación', 'firma', 'recibí', 'recibi',
        'cupon', 'cupón', 'membresia', 'membresía', 'blvd', 'boulevard',
        'avenida', 'calle', 'colonia', 'sucursal', 'descripcion', 'descripción',
        'precio', 'inicio', 'fin', 'pagos', 'carr', 'crr',
    ];

    private const RUIDO_REGEX = '/^(?:\*+|-+|blvd\.?|boulevard|av\.?|avenida|calle|col\.?|colonia|cp\.?|rfc|sucursal|crr|carr|blvd|membresia|descripcion|descripción|precio|inicio|fin|sub-?total|descuento|cupon|cupón|pagos|articulos|artículos|cajero|caja|folio|terminal|operacion|operación|autorizacion|autorización)\b/iu';

    /**
     * @return array{
     *     fecha: string|null,
     *     total: float|null,
     *     total_suma: float,
     *     items: array<int, array{
     *         nombre: string,
     *         cantidad: float,
     *         cantidad_explicita: bool,
     *         medida: array{valor: float, unidad: string}|null,
     *         precio_total: float
     *     }>
     * }
     */
    public function parsear(string $texto): array
    {
        $texto = str_replace(["\r\n", "\r"], "\n", $texto);
        $fecha = $this->detectarFecha($texto);
        $lineas = explode("\n", $texto);
        $total = $this->detectarTotal($lineas);

        $items = [];
        $pendiente = '';
        $tieneCabecera = preg_match(
            '/\b(articulos?|descripcion|inicio\s+items)\b/u',
            NormalizadorService::normalizar($texto)
        ) === 1;
        $enItems = !$tieneCabecera;

        foreach ($lineas as $lineaOriginal) {
            foreach ($this->expandirLinea($lineaOriginal) as $segmento) {
                $linea = $this->limpiarLinea($segmento);

                if ($linea === '') {
                    continue;
                }

                if ($items !== [] && $this->esFinItems($linea)) {
                    $enItems = false;
                    $pendiente = '';

                    continue;
                }

                if (!$enItems) {
                    if ($this->esInicioItems($linea)) {
                        $enItems = true;
                    }

                    continue;
                }

                if ($this->esInicioItems($linea)) {
                    $enItems = true;
                    $pendiente = '';

                    continue;
                }

                if ($this->esRuido($linea)) {
                    $pendiente = '';

                    continue;
                }

                $monto = $this->detectarMontoFinal($linea);

                if ($monto === null) {
                    if ($this->pareceProducto($linea)) {
                        $pendiente = $linea;
                    }

                    continue;
                }

                $nombre = $this->limpiarNombre(substr($linea, 0, $monto['inicio']));

                if ($pendiente !== '' && $this->pareceProducto($pendiente)) {
                    $nombre = trim($pendiente . ' ' . $nombre);
                }

                $pendiente = '';
                $nombre = $this->limpiarNombre($nombre);

                if (!$this->nombreValido($nombre)) {
                    continue;
                }

                [$nombre, $cantidad, $explicita, $medida] = $this->extraerCantidad($nombre);
                $nombre = $this->limpiarNombre($nombre);

                if (!$this->nombreValido($nombre)) {
                    continue;
                }

                $items[] = [
                    'nombre' => $nombre,
                    'cantidad' => $cantidad,
                    'cantidad_explicita' => $explicita,
                    'medida' => $medida,
                    'precio_total' => $monto['valor'],
                ];

                if (count($items) >= self::MAX_ITEMS) {
                    break 2;
                }
            }
        }

        $items = $this->fusionarDuplicados($items);

        $suma = 0.0;

        foreach ($items as $item) {
            $suma += $item['precio_total'];
        }

        return [
            'fecha' => $fecha,
            'total' => $total,
            'total_suma' => round($suma, 2),
            'items' => $items,
        ];
    }

    private function limpiarLinea(string $linea): string
    {
        $linea = str_replace(["\t", "\u{00A0}"], ' ', $linea);
        $linea = preg_replace('/^\s*[|:;·•*]+\s*/u', '', $linea) ?? $linea;
        $linea = preg_replace('/\s*[|]+\s*/u', ' ', $linea) ?? $linea;
        $linea = preg_replace('/\s+/u', ' ', $linea) ?? $linea;

        return trim($linea);
    }

    private function esRuido(string $linea): bool
    {
        $normalizado = NormalizadorService::normalizar($linea);

        if (mb_strlen($normalizado) < 3) {
            return true;
        }

        if (preg_match('/^[\d\s\-\.\/#*]+$/u', $normalizado) === 1) {
            return true;
        }

        $sinLetras = preg_replace('/[^\p{L}]/u', '', $normalizado) ?? '';

        if (mb_strlen($sinLetras) < 2) {
            return true;
        }

        if (str_contains($normalizado, 'item')) {
            return true;
        }

        if (str_contains($normalizado, 'cupon') || str_contains($normalizado, 'descuento')) {
            return true;
        }

        if (preg_match(self::RUIDO_REGEX, $linea) === 1) {
            return true;
        }

        foreach (self::RUIDO as $palabra) {
            $palabra = NormalizadorService::normalizar($palabra);

            if (str_starts_with($normalizado, $palabra)) {
                return true;
            }
        }

        return false;
    }

    private function pareceProducto(string $linea): bool
    {
        if ($this->esRuido($linea)) {
            return false;
        }

        $normalizado = NormalizadorService::normalizar($linea);
        $letras = preg_replace('/[^\p{L}]/u', '', $normalizado) ?? '';

        if (mb_strlen($letras) < 3 || mb_strlen($linea) > 120) {
            return false;
        }

        if (preg_match('/[\[\]{}<>]/u', $linea) === 1) {
            return false;
        }

        foreach (['mexico', 'méxico', 'cp ', 'rfc', 'tel', 'www', 'http'] as $palabra) {
            if (str_contains($normalizado, $palabra)) {
                return false;
            }
        }

        return true;
    }

    /**
     * Devuelve el importe al final de la línea y dónde empieza, para separar
     * el nombre del producto. Ejemplos: "LECHE 1L $25.00", "ARROZ 24.50".
     *
     * @return array{valor: float, inicio: int}|null
     */
    private function detectarMontoFinal(string $linea): ?array
    {
        // Los tickets reales suelen traer ruido después del precio: una letra
        // de impuesto, dos puntos del OCR, una comilla o un dígito suelto.
        // Se buscan todos los números y se toma el último que parezca importe.
        $patron = '/(\d{1,3}(?:[.,]\d{3})*(?:[.,:]\d{1,3})|\d+(?:[.,:]\d{1,3})?)/u';

        if (preg_match_all($patron, $linea, $matches, PREG_OFFSET_CAPTURE) === false) {
            return null;
        }

        $candidatos = $matches[0] ?? [];
        $respaldo = null;

        for ($i = count($candidatos) - 1; $i >= 0; $i--) {
            [$token, $offset] = $candidatos[$i];
            $offset = (int) $offset;
            $prefijo = trim(substr($linea, 0, $offset));
            $sufijo = trim(substr($linea, $offset + strlen($token)));

            if (preg_match('/\p{L}/u', $prefijo) !== 1) {
                // Evita códigos de barras/PLU al inicio de la línea.
                continue;
            }

            if (strlen($token) > 9) {
                continue;
            }

            if (preg_match('/\d/u', $sufijo) === 1 && strlen(preg_replace('/\D/u', '', $sufijo) ?? '') > 1) {
                continue;
            }

            if (strlen($sufijo) > 8) {
                continue;
            }

            $valor = $this->parsearMonto($token);

            if ($valor === null) {
                continue;
            }

            $candidato = [
                'valor' => $valor,
                'inicio' => $offset,
            ];

            if (preg_match('/[.,:]\d{1,3}/u', $token) === 1) {
                return $candidato;
            }

            $respaldo ??= $candidato;
        }

        return $respaldo;
    }

    private function parsearMonto(string $monto): ?float
    {
        $monto = trim(str_replace(['$', ' ', 'MXN', 'mxn'], '', $monto));

        if ($monto === '' || preg_match('/\d/u', $monto) !== 1) {
            return null;
        }

        // El OCR confunde a veces el punto decimal con dos puntos.
        $monto = preg_replace('/(?<=\d):(?=\d{1,3}$)/u', '.', $monto) ?? $monto;

        if (str_contains($monto, ',') && str_contains($monto, '.')) {
            $ultimoComa = strrpos($monto, ',');
            $ultimoPunto = strrpos($monto, '.');

            if ($ultimoComa > $ultimoPunto) {
                $monto = str_replace('.', '', $monto);
                $monto = str_replace(',', '.', $monto);
            } else {
                $monto = str_replace(',', '', $monto);
            }
        } elseif (str_contains($monto, ',')) {
            $partes = explode(',', $monto);
            $decimales = end($partes);

            if ($decimales !== false && strlen($decimales) === 2) {
                $monto = str_replace(',', '.', implode('', array_slice($partes, 0, -1)) . '.' . $decimales);
            } else {
                $monto = str_replace(',', '', $monto);
            }
        }

        if (!is_numeric($monto)) {
            return null;
        }

        return round((float) $monto, 2);
    }

    /**
     * @return array{0: string, 1: float, 2: bool, 3: array{valor: float, unidad: string}|null}
     */
    private function extraerCantidad(string $nombre): array
    {
        $cantidad = 1.0;
        $explicita = false;
        $medida = null;
        $resto = $nombre;

        if (preg_match('/^(\d{1,3})\s*(?:x|pza|pzas|pieza|piezas|unidad|unidades)\b\.?\s*/iu', $resto, $m) === 1) {
            $cantidad = (float) $m[1];
            $explicita = true;
            $resto = ltrim(mb_substr($resto, strlen($m[0])));
        } elseif (
            preg_match('/\b(\d{1,3})\s*[xX]\s*\$?\s*\d+(?:[.,]\d{1,2})?\b/u', $resto, $m, PREG_OFFSET_CAPTURE) === 1
        ) {
            $cantidad = (float) $m[1][0];
            $explicita = true;
            $resto = trim(substr_replace($resto, '', (int) $m[0][1], strlen($m[0][0])));
        } elseif (
            preg_match('/^(\d+(?:[.,]\d+)?)\s*(kg|kgs|g|gr|grs|ml|l|lt|lts|pza|pzas|pieza|piezas)\b\.?\s*/iu', $resto, $m) === 1
        ) {
            $medida = [
                'valor' => (float) str_replace(',', '.', $m[1]),
                'unidad' => $this->unidadNormalizada($m[2]),
            ];
            $resto = ltrim(mb_substr($resto, strlen($m[0])));
        } elseif (preg_match('/^(\d{1,2})\s+(?=\p{L})/u', $resto, $m) === 1) {
            $cantidad = (float) $m[1];
            $explicita = true;
            $resto = ltrim(mb_substr($resto, strlen($m[0])));
        }

        if ($medida === null && preg_match('/\b(\d+(?:[.,]\d+)?)\s*(kg|kgs|g|gr|grs|ml|l|lt|lts)\b/iu', $resto, $m) === 1) {
            $medida = [
                'valor' => (float) str_replace(',', '.', $m[1]),
                'unidad' => $this->unidadNormalizada($m[2]),
            ];
        }

        return [$resto, $cantidad, $explicita, $medida];
    }

    private function unidadNormalizada(string $unidad): string
    {
        return match (mb_strtolower($unidad, 'UTF-8')) {
            'kg', 'kgs' => 'kg',
            'g', 'gr', 'grs' => 'g',
            'l', 'lt', 'lts' => 'L',
            'ml' => 'ml',
            'pza', 'pzas', 'pieza', 'piezas' => 'pza',
            default => mb_strtolower($unidad, 'UTF-8'),
        };
    }

    private function limpiarNombre(string $nombre): string
    {
        $nombre = trim($nombre);
        $nombre = preg_replace('/^[\s\-–—:;*#|$]+/u', '', $nombre) ?? $nombre;
        $nombre = preg_replace('/[\s\-–—:;*#|$]+$/u', '', $nombre) ?? $nombre;
        $nombre = preg_replace(
            '/^.{0,10}?\b\d{5,}\s*[\]\)\-\.:]*\s*\d{0,2}\s*(?=\p{L}{2,})/u',
            '',
            $nombre
        ) ?? $nombre;
        $nombre = preg_replace('/^\d{4,}(?=\p{L})/u', '', $nombre) ?? $nombre;
        $nombre = preg_replace('/^\d{4,}\s+/u', '', $nombre) ?? $nombre;
        $nombre = preg_replace('/\s+/u', ' ', $nombre) ?? $nombre;

        return trim($nombre);
    }

    private function nombreValido(string $nombre): bool
    {
        if (mb_strlen($nombre) < 3 || mb_strlen($nombre) > 150) {
            return false;
        }

        $letras = preg_replace('/[^\p{L}]/u', '', $nombre) ?? '';
        $digitos = preg_replace('/[^\d]/u', '', $nombre) ?? '';

        if (mb_strlen($letras) < 3) {
            return false;
        }

        if (mb_strlen($digitos) > mb_strlen($letras) * 2) {
            return false;
        }

        if (preg_match('/\b(19|20)\d{2}\b/u', $nombre) === 1) {
            return false;
        }

        if (
            preg_match(
                '/\b(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre|mexico|méxico|california|baja|cabo|colonia|sucursal|rfc|boulevard|blvd)\b/iu',
                $nombre
            ) === 1
        ) {
            return false;
        }

        return true;
    }

    /**
     * @param array<int, array{
     *     nombre: string,
     *     cantidad: float,
     *     cantidad_explicita: bool,
     *     medida: array{valor: float, unidad: string}|null,
     *     precio_total: float
     * }> $items
     * @return array<int, array{
     *     nombre: string,
     *     cantidad: float,
     *     cantidad_explicita: bool,
     *     medida: array{valor: float, unidad: string}|null,
     *     precio_total: float
     * }>
     */
    private function fusionarDuplicados(array $items): array
    {
        $resultado = [];

        foreach ($items as $item) {
            $clave = NormalizadorService::normalizar($item['nombre']);

            if (!isset($resultado[$clave])) {
                $resultado[$clave] = $item;

                continue;
            }

            $resultado[$clave]['cantidad'] = round(
                $resultado[$clave]['cantidad'] + $item['cantidad'],
                3
            );
            $resultado[$clave]['precio_total'] = round(
                $resultado[$clave]['precio_total'] + $item['precio_total'],
                2
            );
            $resultado[$clave]['cantidad_explicita'] = true;
            $resultado[$clave]['medida'] = null;
        }

        return array_values($resultado);
    }

    private function esInicioItems(string $linea): bool
    {
        $normalizado = NormalizadorService::normalizar($linea);

        return preg_match('/\b(articulos?|descripcion|inicio\s+items)\b/u', $normalizado) === 1;
    }

    private function esFinItems(string $linea): bool
    {
        // Un artículo suele traer un código PLU de 5+ dígitos; los encabezados
        // de totales/pagos no. Así se evita cortar por una palabra del nombre.
        if (preg_match('/(?<!\d)\d{5,}(?!\d)/u', $linea) === 1) {
            return false;
        }

        $normalizado = NormalizadorService::normalizar($linea);

        foreach (['sub', 'total', 'fotal', 'pagos', 'efectivo', 'cambio', 'cambid', 'iva', 'cajero', 'articulos'] as $palabra) {
            if (str_contains($normalizado, $palabra)) {
                return true;
            }
        }

        return preg_match('/^(\(dos mil|pesos\s+\d)/u', $normalizado) === 1;
    }

    /**
     * Separa una línea que el OCR pegó con el código PLU de otro artículo.
     * Ejemplo: "CUPON ... 644290 REXONA SPRAY" se divide en dos segmentos.
     *
     * @return array<int, string>
     */
    private function expandirLinea(string $linea): array
    {
        $partes = preg_split('/(?=(?<!\d)\d{5,}(?!\d)\s*(?=\p{L}))/u', $linea) ?: [$linea];
        $resultado = [];

        foreach ($partes as $parte) {
            $parte = trim($parte);

            if ($parte !== '') {
                $resultado[] = $parte;
            }
        }

        return $resultado === [] ? [$linea] : $resultado;
    }

    /**
     * @param array<int, string> $lineas
     */
    private function detectarTotal(array $lineas): ?float
    {
        $total = null;

        foreach ($lineas as $linea) {
            $linea = $this->limpiarLinea($linea);
            $normalizado = NormalizadorService::normalizar($linea);

            if (str_contains($normalizado, 'total') && !str_contains($normalizado, 'sub')) {
                $monto = $this->detectarMontoFinal($linea);

                if ($monto !== null) {
                    $total = $monto['valor'];
                }
            }
        }

        return $total;
    }

    private function detectarFecha(string $texto): ?string
    {
        if (
            preg_match('/\b(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})\b/u', $texto, $m) === 1
        ) {
            $fecha = $this->fechaValida((int) $m[1], (int) $m[2], (int) $m[3]);

            if ($fecha !== null) {
                return $fecha;
            }
        }

        if (
            preg_match('/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/u', $texto, $m) === 1
        ) {
            $primero = (int) $m[1];
            $segundo = (int) $m[2];
            $anio = $this->anioCompleto((int) $m[3]);

            if ($primero > 12 && $segundo <= 12) {
                $fecha = $this->fechaValida($anio, $segundo, $primero);
            } elseif ($segundo > 12 && $primero <= 12) {
                $fecha = $this->fechaValida($anio, $primero, $segundo);
            } else {
                $fecha = $this->fechaValida($anio, $segundo, $primero);
            }

            if ($fecha !== null) {
                return $fecha;
            }
        }

        if (
            preg_match('/\b(\d{1,2})\s+(?:de\s+)?([a-záéíóú]{3,10})\.?\s+(?:de\s+)?(\d{2,4})\b/iu', $texto, $m) === 1
        ) {
            $mes = self::MESES[mb_strtolower(mb_substr($m[2], 0, 3), 'UTF-8')] ?? null;

            if ($mes !== null) {
                $fecha = $this->fechaValida(
                    $this->anioCompleto((int) $m[3]),
                    $mes,
                    (int) $m[1]
                );

                if ($fecha !== null) {
                    return $fecha;
                }
            }
        }

        return null;
    }

    private function fechaValida(int $anio, int $mes, int $dia): ?string
    {
        if ($anio < 2000 || $anio > 2100 || !checkdate($mes, $dia, $anio)) {
            return null;
        }

        return sprintf('%04d-%02d-%02d', $anio, $mes, $dia);
    }

    private function anioCompleto(int $anio): int
    {
        return $anio < 100 ? 2000 + $anio : $anio;
    }
}
