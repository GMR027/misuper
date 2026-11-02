<?php

declare(strict_types=1);

namespace App\Services;

/**
 * Relaciona el nombre leído en un ticket con productos del catálogo.
 *
 * No intenta adivinar categorías ni productos nuevos: solo devuelve las
 * mejores coincidencias para que el usuario las confirme en la revisión.
 */
final class ProductoMatcherService
{
    private const MIN_SUGERENCIA = 0.56;
    private const MIN_PRESELECCION = 0.72;

    private const STOPWORDS = [
        'de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'unos', 'unas',
        'con', 'para', 'por', 'y', 'en', 'al', 'sabor', 'original', 'clasico',
        'clasica', 'pack', 'pza', 'pzas', 'pieza', 'piezas', 'kg', 'kgs', 'g',
        'gr', 'grs', 'l', 'lt', 'lts', 'ml', 'x', 'mxn', 'iva', 'total',
    ];

    /**
     * @param array<int, array{id: int, nombre: string, unidad_base: string}> $productos
     * @return array{
     *     producto_id: int|null,
     *     producto_nombre: string|null,
     *     unidad_base: string|null,
     *     cantidad: float,
     *     confianza: float,
     *     sugerencias: array<int, array{producto_id: int, nombre: string, unidad_base: string, puntaje: float}>
     * }
     */
    public function coincidir(string $nombre, array $productos, float $cantidad, ?array $medida = null, bool $cantidadExplicita = false): array
    {
        $normalizado = $this->normalizar($nombre);
        $tokens = $this->tokens($nombre);
        $ranking = [];

        foreach ($productos as $producto) {
            $puntaje = $this->puntaje($normalizado, $tokens, $producto['nombre']);

            if ($puntaje < self::MIN_SUGERENCIA) {
                continue;
            }

            $ranking[] = [
                'producto_id' => $producto['id'],
                'nombre' => $producto['nombre'],
                'unidad_base' => $producto['unidad_base'],
                'puntaje' => round($puntaje, 3),
            ];
        }

        usort(
            $ranking,
            static fn (array $a, array $b): int => $b['puntaje'] <=> $a['puntaje']
                ?: strcmp($a['nombre'], $b['nombre'])
        );

        $sugerencias = array_slice($ranking, 0, 3);
        $mejor = $sugerencias[0] ?? null;
        $seleccionado = $mejor !== null && $mejor['puntaje'] >= self::MIN_PRESELECCION
            ? $mejor
            : null;

        $cantidadFinal = $this->ajustarCantidad(
            $cantidad,
            $medida,
            $cantidadExplicita,
            $seleccionado['unidad_base'] ?? null
        );

        return [
            'producto_id' => $seleccionado['producto_id'] ?? null,
            'producto_nombre' => $seleccionado['nombre'] ?? null,
            'unidad_base' => $seleccionado['unidad_base'] ?? null,
            'cantidad' => round($cantidadFinal, 3),
            'confianza' => $seleccionado['puntaje'] ?? 0.0,
            'sugerencias' => $sugerencias,
        ];
    }

    /**
     * Ajusta la cantidad cuando el ticket trae una medida (1.5 kg, 750 ml)
     * y la unidad del producto seleccionado es compatible.
     */
    private function ajustarCantidad(
        float $cantidad,
        ?array $medida,
        bool $cantidadExplicita,
        ?string $unidadProducto
    ): float {
        if ($cantidadExplicita || $medida === null || $unidadProducto === null) {
            return $cantidad;
        }

        $valor = (float) ($medida['valor'] ?? 0);
        $unidad = (string) ($medida['unidad'] ?? '');

        if ($valor <= 0 || $unidad === '') {
            return $cantidad;
        }

        if ($unidad === $unidadProducto) {
            return $valor;
        }

        $grupos = [
            'kg' => ['kg', 'g', 'gr'],
            'L' => ['L', 'ml'],
            'pza' => ['pza', 'pieza', 'piezas'],
        ];

        foreach ($grupos as $base => $unidades) {
            if (!in_array($unidadProducto, $unidades, true) || !in_array($unidad, $unidades, true)) {
                continue;
            }

            if ($base === 'kg') {
                if ($unidadProducto === 'kg' && in_array($unidad, ['g', 'gr'], true)) {
                    return $valor / 1000;
                }

                if (in_array($unidadProducto, ['g', 'gr'], true) && $unidad === 'kg') {
                    return $valor * 1000;
                }
            }

            if ($base === 'L') {
                if ($unidadProducto === 'L' && $unidad === 'ml') {
                    return $valor / 1000;
                }

                if ($unidadProducto === 'ml' && $unidad === 'L') {
                    return $valor * 1000;
                }
            }

            return $valor;
        }

        return $cantidad;
    }

    /**
     * @param array<int, string> $tokensTicket
     */
    private function puntaje(string $normalizado, array $tokensTicket, string $nombreProducto): float
    {
        $producto = $this->normalizar($nombreProducto);
        $tokensProducto = $this->tokens($nombreProducto);

        if ($normalizado === '' || $producto === '') {
            return 0.0;
        }

        if ($normalizado === $producto) {
            return 1.0;
        }

        $puntaje = 0.0;
        $corto = min(mb_strlen($normalizado), mb_strlen($producto));

        if (
            $corto >= 4
            && (str_contains($normalizado, $producto) || str_contains($producto, $normalizado))
        ) {
            $largo = max(mb_strlen($normalizado), mb_strlen($producto));
            $puntaje = 0.80 + 0.12 * ($largo > 0 ? $corto / $largo : 0);
        }

        if ($tokensTicket !== [] && $tokensProducto !== []) {
            $interseccion = array_intersect($tokensProducto, $tokensTicket);
            $union = array_unique(array_merge($tokensProducto, $tokensTicket));
            $jaccard = count($union) > 0 ? count($interseccion) / count($union) : 0.0;

            $puntaje = max($puntaje, 0.72 * $jaccard);

            $cobertura = count($interseccion) / count($tokensProducto);

            if ($cobertura >= 0.999) {
                $puntaje = max($puntaje, 0.78 + 0.10 * min(1.0, count($tokensProducto) / max(1, count($tokensTicket))));
            }

            $coberturaTicket = count($interseccion) / count($tokensTicket);

            if ($coberturaTicket >= 0.999) {
                // El ticket solo trae una parte del nombre del producto
                // ("ARROZ" frente a "Arroz blanco"). Se sugiere, pero no se
                // preselecciona para no adivinar entre variantes.
                $puntaje = max(
                    $puntaje,
                    0.62 + 0.10 * min(1.0, count($tokensTicket) / count($tokensProducto))
                );
            }
        }

        similar_text($normalizado, $producto, $porcentaje);
        $puntaje = max($puntaje, 0.55 * ($porcentaje / 100));

        return min(1.0, $puntaje);
    }

    private function normalizar(string $texto): string
    {
        $texto = NormalizadorService::normalizar($texto);
        $texto = preg_replace('/[^a-z0-9]+/u', ' ', $texto) ?? '';

        return trim(preg_replace('/\s+/u', ' ', $texto) ?? '');
    }

    /**
     * @return array<int, string>
     */
    private function tokens(string $texto): array
    {
        $normalizado = $this->normalizar($texto);

        if ($normalizado === '') {
            return [];
        }

        $tokens = preg_split('/\s+/u', $normalizado) ?: [];
        $limpios = [];

        foreach ($tokens as $token) {
            if ($token === '' || is_numeric($token) || mb_strlen($token) < 2) {
                continue;
            }

            if (in_array($token, self::STOPWORDS, true)) {
                continue;
            }

            $limpios[$token] = true;
        }

        return array_keys($limpios);
    }
}
