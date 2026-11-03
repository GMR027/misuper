<?php

declare(strict_types=1);

namespace App\Services;

/**
 * Convierte el texto plano de Tesseract en una propuesta de artículos.
 *
 * Trabaja en dos modos:
 *  - parsearEstructura(): usa las coordenadas TSV para detectar la columna de
 *    precios y el bloque real de artículos. Es el modo preferido.
 *  - parsear(): modo de respaldo con texto plano; solo acepta rachas de líneas
 *    que terminan en un importe con decimales.
 *
 * En ambos modos se descartan encabezados (dirección, teléfono, RFC, folio,
 * cajero…) y pies (subtotal, IVA, total, pago, cambio…). Ante la duda se omite
 * la línea: el usuario siempre revisa y completa la propuesta.
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

    /** @var array<string, string> Clave normalizada => nombre visible. */
    private const COMERCIOS = [
        'bodega aurrera' => 'Bodega Aurrera',
        'la comer' => 'La Comer',
        'casa ley' => 'Casa Ley',
        'super del norte' => 'Super del Norte',
        'farmacias del ahorro' => 'Farmacias del Ahorro',
        'farmacia guadalajara' => 'Farmacia Guadalajara',
        'sams club' => "Sam's Club",
        'sam s club' => "Sam's Club",
        'seven eleven' => '7-Eleven',
        '7 eleven' => '7-Eleven',
        '7-eleven' => '7-Eleven',
        's mart' => 'S-Mart',
        's-mart' => 'S-Mart',
        'costco' => 'Costco',
        'costeo' => 'Costco',
        'costro' => 'Costco',
        'costc0' => 'Costco',
        'wholesale' => 'Costco',
        'walmart' => 'Walmart',
        'soriana' => 'Soriana',
        'chedraui' => 'Chedraui',
        'calimax' => 'Calimax',
        'merza' => 'Merza',
        'oxxo' => 'OXXO',
        'heb' => 'H-E-B',
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
        'descripcion', 'descripción', 'precio', 'inicio', 'fin', 'pagos',
        'carr', 'crr', 'whatsapp', 'celular', 'correo', 'email', 'aviso',
        'bienvenido', 'monedero', 'referencia', 'razon social', 'razón social',
    ];

    private const RUIDO_REGEX = '/^(?:\*+|-+|blvd\.?|boulevard|av\.?|avenida|calle|col\.?|colonia|cp\.?|rfc|sucursal|crr|carr|blvd|membresia|descripcion|descripción|precio|inicio|fin|sub-?total|descuento|cupon|cupón|pagos|articulos|artículos|cajero|caja|folio|terminal|operacion|operación|autorizacion|autorización|fecha|hora|ticket|recibo|factura)\b/iu';

    /**
     * Palabras que identifican metadatos del establecimiento o del pie. Se
     * buscan en cualquier posición porque un producto no suele contenerlas.
     */
    private const METADATA_REGEX = '/\b(?:rfc|regimen|razon social|telefono|tel|celular|whatsapp|correo|email|www|http|factura|ticket|folio|recibo|caja|cajero|turno|sucursal|terminal|autorizacion|operacion|referencia|cliente|vendedor|direccion|calle|avenida|blvd|boulevard|colonia|cp|municipio|pais|gracias|bienvenido|aviso|puntos|monedero|ahorro|descuento|subtotal|total|iva|ieps|impuesto|efectivo|cambio|tarjeta|debito|credito|pago|importe|propina|redondeo|saldo|abono|recargo|comision|promocion|donativo|articulos|unidades)\b/iu';

    private const PRECIO_REGEX = '/(?<![\d\-\/])(\$?\s?\d{1,3}(?:[.,]\d{3})*(?:[.,:]\d{1,2})?)(?![\d\-\/])/u';

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
        $lineas = $this->lineasDesdeTexto($texto);
        $fecha = $this->detectarFecha($texto);
        $total = $this->detectarTotal($lineas);
        $items = $this->extraerItemsTexto($lineas);

        return $this->resultado($fecha, $total, $items);
    }

    /**
     * Parser basado en layout: usa la columna de precios para delimitar el
     * bloque de artículos y descarta encabezado y pie por posición.
     *
     * @param array<string, mixed> $estructura Salida de TicketOcrService::extraerEstructura().
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
    public function parsearEstructura(array $estructura): array
    {
        $lineas = $this->normalizarLineasEstructura($estructura['lineas'] ?? []);
        $texto = (string) ($estructura['texto'] ?? implode("\n", array_map(
            static fn (array $linea): string => $linea['texto'],
            $lineas
        )));

        $fecha = $this->detectarFecha($texto);
        $total = $this->detectarTotal($lineas);
        $ancho = (int) ($estructura['ancho'] ?? 0);
        $items = $this->extraerItemsEstructura($lineas, $ancho);

        // Si el layout no encontró un bloque fiable, se intenta el modo texto.
        if ($items === []) {
            $items = $this->extraerItemsTexto($lineas);
        }

        return $this->resultado($fecha, $total, $items);
    }

    /**
     * Sugiere un nombre legible para identificar el ticket.
     *
     * Usa el comercio conocido y la fecha detectada. Si no reconoce el
     * comercio, genera un nombre genérico con la fecha. El usuario puede
     * cambiarlo después en la pantalla de revisión.
     */
    public function sugerirTitulo(string $texto, ?string $fecha): string
    {
        $normalizado = NormalizadorService::normalizar($texto);
        $comercio = null;

        foreach (self::COMERCIOS as $clave => $nombre) {
            if (str_contains($normalizado, $clave)) {
                $comercio = $nombre;

                break;
            }
        }

        $fechaTexto = null;

        if ($fecha !== null) {
            $fechaObjeto = \DateTimeImmutable::createFromFormat('!Y-m-d', $fecha);

            if ($fechaObjeto !== false && $fechaObjeto->format('Y-m-d') === $fecha) {
                $fechaTexto = $fechaObjeto->format('d/m/Y');
            }
        }

        if ($comercio !== null && $fechaTexto !== null) {
            return $comercio . ' · ' . $fechaTexto;
        }

        if ($comercio !== null) {
            return $comercio;
        }

        if ($fechaTexto !== null) {
            return 'Ticket del ' . $fechaTexto;
        }

        return 'Ticket de compra';
    }

    /**
     * @param array<int, array{
     *     nombre: string,
     *     cantidad: float,
     *     cantidad_explicita: bool,
     *     medida: array{valor: float, unidad: string}|null,
     *     precio_total: float
     * }> $items
     * @return array<string, mixed>
     */
    private function resultado(?string $fecha, ?float $total, array $items): array
    {
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

    /**
     * @return array<int, array{texto: string}>
     */
    private function lineasDesdeTexto(string $texto): array
    {
        $lineas = [];

        foreach (explode("\n", $texto) as $lineaOriginal) {
            foreach ($this->expandirLinea($lineaOriginal) as $segmento) {
                $linea = $this->limpiarLinea($segmento);

                if ($linea !== '') {
                    $lineas[] = ['texto' => $linea];
                }
            }
        }

        return $lineas;
    }

    /**
     * @param mixed $crudas
     * @return array<int, array{
     *     texto: string,
     *     left: int,
     *     top: int,
     *     right: int,
     *     bottom: int,
     *     height: int,
     *     palabras: array<int, array{texto: string, left: int, top: int, right: int, bottom: int, height: int, confianza: float}>
     * }>
     */
    private function normalizarLineasEstructura(mixed $crudas): array
    {
        if (!is_array($crudas)) {
            return [];
        }

        $lineas = [];

        foreach ($crudas as $cruda) {
            if (!is_array($cruda)) {
                continue;
            }

            $palabras = [];

            foreach (($cruda['palabras'] ?? []) as $palabra) {
                if (!is_array($palabra)) {
                    continue;
                }

                $texto = $this->limpiarLinea((string) ($palabra['texto'] ?? ''));

                if ($texto === '') {
                    continue;
                }

                $left = (int) ($palabra['left'] ?? 0);
                $top = (int) ($palabra['top'] ?? 0);
                $right = (int) ($palabra['right'] ?? $left);
                $height = max(1, (int) ($palabra['height'] ?? 1));

                $palabras[] = [
                    'texto' => $texto,
                    'left' => $left,
                    'top' => $top,
                    'right' => $right,
                    'bottom' => (int) ($palabra['bottom'] ?? ($top + $height)),
                    'height' => $height,
                    'confianza' => (float) ($palabra['confianza'] ?? 0),
                ];
            }

            if ($palabras === []) {
                $texto = $this->limpiarLinea((string) ($cruda['texto'] ?? ''));

                if ($texto === '') {
                    continue;
                }

                $lineas[] = [
                    'texto' => $texto,
                    'left' => 0,
                    'top' => 0,
                    'right' => 0,
                    'bottom' => 0,
                    'height' => 1,
                    'palabras' => [],
                ];

                continue;
            }

            usort(
                $palabras,
                static fn (array $a, array $b): int => $a['left'] <=> $b['left']
            );

            $lineas[] = [
                'texto' => trim(implode(' ', array_map(
                    static fn (array $palabra): string => $palabra['texto'],
                    $palabras
                ))),
                'left' => min(array_column($palabras, 'left')),
                'top' => min(array_column($palabras, 'top')),
                'right' => max(array_column($palabras, 'right')),
                'bottom' => max(array_column($palabras, 'bottom')),
                'height' => max(1, max(array_column($palabras, 'height'))),
                'palabras' => $palabras,
            ];
        }

        return $lineas;
    }

    /**
     * @param array<int, array{texto: string, left?: int, top?: int, right?: int, bottom?: int, height?: int, palabras?: array<int, array<string, mixed>>}> $lineas
     * @return array<int, array{
     *     nombre: string,
     *     cantidad: float,
     *     cantidad_explicita: bool,
     *     medida: array{valor: float, unidad: string}|null,
     *     precio_total: float
     * }>
     */
    private function extraerItemsTexto(array $lineas): array
    {
        $candidatos = [];

        foreach ($lineas as $indice => $linea) {
            $texto = (string) ($linea['texto'] ?? '');

            if ($this->esRuido($texto)) {
                continue;
            }

            $precio = $this->detectarImporteTexto($texto, true);

            if ($precio === null) {
                continue;
            }

            $nombre = substr($texto, 0, $precio['inicio']);

            if (!$this->pareceProducto($nombre)) {
                continue;
            }

            $candidatos[$indice] = $precio;
        }

        if ($candidatos === []) {
            return [];
        }

        $racha = $this->mejorRacha(array_keys($candidatos));
        $items = [];

        foreach ($racha as $indice) {
            $precio = $candidatos[$indice];
            $texto = (string) $lineas[$indice]['texto'];
            $nombre = substr($texto, 0, $precio['inicio']);

            // Nombre partido en dos líneas: se recupera la anterior si no
            // tenía precio y parece un producto.
            if ($indice > 0 && !isset($candidatos[$indice - 1])) {
                $anterior = (string) ($lineas[$indice - 1]['texto'] ?? '');

                if ($this->pareceProducto($anterior)) {
                    $nombre = trim($anterior . ' ' . $nombre);
                }
            }

            $item = $this->construirItem($nombre, $precio['valor']);

            if ($item !== null) {
                $items[] = $item;
            }

            if (count($items) >= self::MAX_ITEMS) {
                break;
            }
        }

        return $items;
    }

    /**
     * @param array<int, array{texto: string, left: int, top: int, right: int, bottom: int, height: int, palabras: array<int, array{texto: string, left: int, top: int, right: int, bottom: int, height: int, confianza: float}>}> $lineas
     * @return array<int, array{
     *     nombre: string,
     *     cantidad: float,
     *     cantidad_explicita: bool,
     *     medida: array{valor: float, unidad: string}|null,
     *     precio_total: float
     * }>
     */
    private function extraerItemsEstructura(array $lineas, int $ancho): array
    {
        if ($lineas === [] || $ancho <= 0) {
            return [];
        }

        $candidatos = [];

        foreach ($lineas as $indice => $linea) {
            if ($this->esRuido($linea['texto'])) {
                continue;
            }

            $precio = $this->detectarImportePalabras($linea['palabras'], true);

            if ($precio === null) {
                continue;
            }

            $nombre = trim(implode(' ', array_map(
                static fn (array $palabra): string => $palabra['texto'],
                array_slice($linea['palabras'], 0, $precio['indice'])
            )));

            if (!$this->pareceProducto($nombre)) {
                continue;
            }

            $candidatos[$indice] = $precio;
        }

        if ($candidatos === []) {
            return [];
        }

        // Columna de precios: agrupar por borde derecho en franjas del 5 %.
        $franjas = [];

        foreach ($candidatos as $indice => $precio) {
            $franja = (int) floor(($precio['right'] / $ancho) * 20);

            if ($franja < 9) {
                // Un precio de artículo debe estar en la mitad derecha.
                continue;
            }

            $franjas[$franja][] = $indice;
        }

        if ($franjas === []) {
            return [];
        }

        uksort($franjas, static fn (int $a, int $b): int => $b <=> $a);
        $mejorFranja = null;
        $mejorTotal = 0;

        foreach ($franjas as $franja => $indices) {
            if (count($indices) > $mejorTotal) {
                $mejorTotal = count($indices);
                $mejorFranja = $franja;
            }
        }

        if ($mejorFranja === null) {
            return [];
        }

        $indices = $franjas[$mejorFranja];
        sort($indices);
        $racha = $this->mejorRacha($indices);
        $items = [];

        foreach ($racha as $indice) {
            $linea = $lineas[$indice];
            $precio = $candidatos[$indice];
            $nombre = trim(implode(' ', array_map(
                static fn (array $palabra): string => $palabra['texto'],
                array_slice($linea['palabras'], 0, $precio['indice'])
            )));

            if ($indice > 0 && !isset($candidatos[$indice - 1])) {
                $anterior = $lineas[$indice - 1];
                $distancia = $linea['top'] - $anterior['bottom'];

                if (
                    $distancia >= -2
                    && $distancia <= max(12, $linea['height'] * 1.6)
                    && $this->pareceProducto($anterior['texto'])
                ) {
                    $nombre = trim($anterior['texto'] . ' ' . $nombre);
                }
            }

            $item = $this->construirItem($nombre, $precio['valor']);

            if ($item !== null) {
                $items[] = $item;
            }

            if (count($items) >= self::MAX_ITEMS) {
                break;
            }
        }

        return $items;
    }

    /**
     * @param string $nombre
     * @param float $precio
     * @return array{
     *     nombre: string,
     *     cantidad: float,
     *     cantidad_explicita: bool,
     *     medida: array{valor: float, unidad: string}|null,
     *     precio_total: float
     * }|null
     */
    private function construirItem(string $nombre, float $precio): ?array
    {
        $nombre = $this->limpiarNombre($nombre);
        // Columna de precio unitario que quedó pegada al nombre:
        // "2 LECHE 1L 25.50" + total 51.00 → "2 LECHE 1L".
        $nombre = preg_replace('/\s+\$?\d{1,4}(?:[.,]\d{2})\s*$/u', '', $nombre) ?? $nombre;
        $nombre = $this->limpiarNombre($nombre);

        if (!$this->nombreValido($nombre)) {
            return null;
        }

        [$nombre, $cantidad, $explicita, $medida] = $this->extraerCantidad($nombre);
        $nombre = $this->limpiarNombre($nombre);

        if (!$this->nombreValido($nombre)) {
            return null;
        }

        return [
            'nombre' => $nombre,
            'cantidad' => $cantidad,
            'cantidad_explicita' => $explicita,
            'medida' => $medida,
            'precio_total' => round($precio, 2),
        ];
    }

    /**
     * Devuelve la racha de índices consecutivos más larga. Se permite un
     * hueco de una línea para nombres partidos o una línea omitida por OCR.
     *
     * @param array<int, int> $indices
     * @return array<int, int>
     */
    private function mejorRacha(array $indices): array
    {
        sort($indices);
        $mejor = [];
        $actual = [];
        $anterior = null;

        foreach ($indices as $indice) {
            if ($anterior === null || $indice - $anterior <= 2) {
                $actual[] = $indice;
            } else {
                if (count($actual) > count($mejor)) {
                    $mejor = $actual;
                }

                $actual = [$indice];
            }

            $anterior = $indice;
        }

        if (count($actual) > count($mejor)) {
            $mejor = $actual;
        }

        return $mejor;
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

        if (preg_match(self::METADATA_REGEX, $linea) === 1) {
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
     * Devuelve el importe al final de la línea y dónde empieza.
     *
     * @return array{valor: float, inicio: int}|null
     */
    private function detectarImporteTexto(string $linea, bool $soloDecimales): ?array
    {
        if (preg_match_all(self::PRECIO_REGEX, $linea, $matches, PREG_OFFSET_CAPTURE) === false) {
            return null;
        }

        $candidatos = $matches[0] ?? [];

        for ($i = count($candidatos) - 1; $i >= 0; $i--) {
            [$token, $offset] = $candidatos[$i];
            $offset = (int) $offset;
            $prefijo = trim(substr($linea, 0, $offset));
            $sufijo = trim(substr($linea, $offset + strlen($token)));

            if (preg_match('/\p{L}/u', $prefijo) !== 1) {
                continue;
            }

            if (strlen($token) > 10) {
                continue;
            }

            if (preg_match('/\d/u', $sufijo) === 1) {
                continue;
            }

            if (strlen($sufijo) > 6) {
                continue;
            }

            if ($soloDecimales && preg_match('/[.,:]\d{1,2}$/u', $token) !== 1) {
                continue;
            }

            $valor = $this->parsearMonto($token);

            if ($valor === null || $valor <= 0) {
                continue;
            }

            return ['valor' => $valor, 'inicio' => $offset];
        }

        return null;
    }

    /**
     * Busca el importe dentro de las palabras TSV. Se toma el token de precio
     * más a la derecha que no sea una cantidad ni un código.
     *
     * @param array<int, array{texto: string, right: int}> $palabras
     * @return array{valor: float, indice: int, right: int}|null
     */
    private function detectarImportePalabras(array $palabras, bool $soloDecimales): ?array
    {
        for ($i = count($palabras) - 1; $i >= 0; $i--) {
            $token = trim($palabras[$i]['texto']);

            if (!preg_match('/^(?:\$)?\d{1,3}(?:[.,]\d{3})*(?:[.,:]\d{1,2})?$/u', $token)) {
                continue;
            }

            $nombre = trim(implode(' ', array_map(
                static fn (array $palabra): string => $palabra['texto'],
                array_slice($palabras, 0, $i)
            )));

            if (preg_match('/\p{L}/u', $nombre) !== 1) {
                continue;
            }

            if ($soloDecimales && preg_match('/[.,:]\d{1,2}$/u', $token) !== 1) {
                continue;
            }

            $valor = $this->parsearMonto($token);

            if ($valor === null || $valor <= 0) {
                continue;
            }

            return [
                'valor' => $valor,
                'indice' => $i,
                'right' => (int) $palabras[$i]['right'],
            ];
        }

        return null;
    }

    private function parsearMonto(string $monto): ?float
    {
        $monto = trim(str_replace(['$', ' ', 'MXN', 'mxn'], '', $monto));

        if ($monto === '' || preg_match('/\d/u', $monto) !== 1) {
            return null;
        }

        // El OCR confunde a veces el punto decimal con dos puntos.
        $monto = preg_replace('/(?<=\d):(?=\d{1,2}$)/u', '.', $monto) ?? $monto;

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

        // Cantidad embebida en el nombre: "HUEVO 12 PZAS", "BOLSA 1 PZA".
        if (
            !$explicita
            && $medida === null
            && preg_match(
                '/\b(\d{1,3})\s*(?:pza|pzas|pieza|piezas|unidad|unidades)\b\.?/iu',
                $resto,
                $m,
                PREG_OFFSET_CAPTURE
            ) === 1
        ) {
            $cantidad = (float) $m[1][0];
            $explicita = true;
            $resto = trim(substr_replace($resto, '', (int) $m[0][1], strlen($m[0][0])));
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

        if (preg_match(self::METADATA_REGEX, $nombre) === 1) {
            return false;
        }

        if (preg_match('/\b\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}\b/u', $nombre) === 1) {
            return false;
        }

        if (preg_match('/\b\d{1,2}:\d{2}(?::\d{2})?\b/u', $nombre) === 1) {
            return false;
        }

        if (preg_match('/\b[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}\b/u', $nombre) === 1) {
            return false;
        }

        if (preg_match('/\b(?:\+?52[\s.\-]?)?(?:\(?\d{2,4}\)?[\s.\-]+){2,4}\d{2,4}\b/u', $nombre) === 1) {
            return false;
        }

        $letras = preg_replace('/[^\p{L}]/u', '', $nombre) ?? '';
        $digitos = preg_replace('/[^\d]/u', '', $nombre) ?? '';

        if (mb_strlen($letras) < 3) {
            return false;
        }

        if (mb_strlen($digitos) > mb_strlen($letras)) {
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
     * @param array<int, array{texto: string}> $lineas
     */
    private function detectarTotal(array $lineas): ?float
    {
        $total = null;

        foreach ($lineas as $linea) {
            $texto = $this->limpiarLinea((string) ($linea['texto'] ?? ''));
            $normalizado = NormalizadorService::normalizar($texto);

            if (preg_match('/\btotal\b/u', $normalizado) !== 1) {
                continue;
            }

            if (preg_match('/\b(sub\s*total|subtotal|total\s+articulos?|total\s+unidades|puntos|ahorro|descuento)\b/u', $normalizado) === 1) {
                continue;
            }

            $monto = $this->detectarImporteTexto($texto, false);

            if ($monto !== null) {
                $total = $monto['valor'];
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
