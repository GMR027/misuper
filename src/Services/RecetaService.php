<?php

declare(strict_types=1);

namespace App\Services;

use App\Repositories\CategoriaRecetaRepository;
use App\Repositories\CompraRepository;
use App\Repositories\ProductoRepository;
use App\Repositories\RecetaRepository;
use App\Repositories\TipoRecetaRepository;
use InvalidArgumentException;
use RuntimeException;

/**
 * Catálogo de recetas, filtros por despensa, favoritos y escalado.
 *
 * Las recetas viven en la tabla `recetas`; los tipos son metadatos del
 * archivo data/tipos_recetas.json.
 */
final class RecetaService
{
    public const MAX_RECETAS_PREVIEW = 100;
    public const MAX_PORCIONES = 50;

    private const UNIDADES = ['g', 'ml', 'kg', 'L', 'pza', 'al_gusto'];
    private const DIFICULTADES = ['facil', 'media', 'dificil'];
    private const ESTADOS = ['publicada', 'pendiente', 'borrador'];

    private ?array $tiposCache = null;
    private ?array $categoriasCache = null;

    private readonly CompraRepository $compras;
    private readonly ProductoRepository $productos;
    private readonly RecetaRepository $recetas;
    private readonly TipoRecetaRepository $tiposRepo;
    private readonly CategoriaRecetaRepository $categoriasRepo;
    private readonly RecetaImagenService $imagenes;
    private readonly PrecioService $precios;
    private readonly NutricionService $nutricion;

    public function __construct(
        ?CompraRepository $compras = null,
        ?ProductoRepository $productos = null,
        ?RecetaRepository $recetas = null,
        ?TipoRecetaRepository $tiposRepo = null,
        ?CategoriaRecetaRepository $categoriasRepo = null,
        ?RecetaImagenService $imagenes = null,
        ?PrecioService $precios = null,
        ?NutricionService $nutricion = null
    ) {
        $this->compras = $compras ?? new CompraRepository();
        $this->productos = $productos ?? new ProductoRepository();
        $this->recetas = $recetas ?? new RecetaRepository();
        $this->tiposRepo = $tiposRepo ?? new TipoRecetaRepository();
        $this->categoriasRepo = $categoriasRepo ?? new CategoriaRecetaRepository();
        $this->imagenes = $imagenes ?? new RecetaImagenService();
        $this->precios = $precios ?? new PrecioService();
        $this->nutricion = $nutricion ?? new NutricionService();
    }

    /**
     * @return array<string, array<string, mixed>>
     */
    public function tipos(): array
    {
        if ($this->tiposCache !== null) {
            return $this->tiposCache;
        }

        $tipos = [];

        foreach ($this->tiposRepo->all() as $tipo) {
            $tipos[(string) $tipo['slug']] = $tipo;
        }

        $this->tiposCache = $tipos;

        return $tipos;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function categorias(): array
    {
        if ($this->categoriasCache !== null) {
            return $this->categoriasCache;
        }

        $this->categoriasCache = array_map(
            static fn (array $categoria): array => $categoria,
            $this->categoriasRepo->all()
        );

        return $this->categoriasCache;
    }

    /**
     * @param array<string, mixed> $receta
     * @return array<string, mixed>|null
     */
    private function categoriaDe(array $receta): ?array
    {
        $id = $receta['categoria_id'] ?? null;

        if ($id === null) {
            return null;
        }

        foreach ($this->categorias() as $categoria) {
            if ((int) $categoria['id'] === (int) $id) {
                return $categoria;
            }
        }

        return null;
    }

    /**
     * @param array{q?: string, categoria?: string, tipo?: string, tiempo?: string, solo_despensa?: bool|int|string, favoritas?: bool|int|string, compras?: string|array<int, int|string>} $filtros
     * @return array{items: array<int, array<string, mixed>>, total: int, despensa: array<string, mixed>, tipos: array<int, array<string, mixed>>}
     */
    public function listar(int $usuarioId, array $filtros): array
    {
        $q = NormalizadorService::normalizar((string) ($filtros['q'] ?? ''));
        $categoria = (string) ($filtros['categoria'] ?? '');
        $tipo = (string) ($filtros['tipo'] ?? '');
        $tiempo = (int) ($filtros['tiempo'] ?? 0);
        $soloDespensa = filter_var($filtros['solo_despensa'] ?? false, FILTER_VALIDATE_BOOL);
        $soloFavoritas = filter_var($filtros['favoritas'] ?? false, FILTER_VALIDATE_BOOL);

        $despensaSeleccionada = $this->resolverDespensa($usuarioId, $filtros['compras'] ?? null);
        $despensa = $despensaSeleccionada['despensa'];
        $pantry = $this->indiceDespensa($despensa);
        $sinCompras = $soloDespensa && $despensaSeleccionada['compras'] === [];
        $favoritos = array_flip($this->recetas->favoritos($usuarioId));
        $items = [];

        foreach ($this->recetas->allPublic() as $receta) {
            if ($sinCompras) {
                break;
            }

            if ($soloFavoritas && !isset($favoritos[$receta['id']])) {
                continue;
            }

            $categoriaReceta = $this->categoriaDe($receta);

            if ($categoria !== '' && ($categoriaReceta['slug'] ?? '') !== $categoria) {
                continue;
            }

            if ($tipo !== '' && !in_array($tipo, $receta['tipos'] ?? [], true)) {
                continue;
            }

            if ($tiempo > 0 && (int) ($receta['tiempo_min'] ?? 0) > $tiempo) {
                continue;
            }

            if ($q !== '') {
                $ingredientesTexto = implode(' ', array_map(
                    static fn (array $ingrediente): string => (string) ($ingrediente['nombre'] ?? ''),
                    $receta['ingredientes'] ?? []
                ));
                $texto = NormalizadorService::normalizar(
                    (string) ($receta['nombre'] ?? '') . ' '
                    . (string) ($receta['descripcion'] ?? '') . ' '
                    . $ingredientesTexto
                );

                if (!str_contains($texto, $q)) {
                    continue;
                }
            }

            $match = $this->matchReceta($receta, $pantry);

            if ($soloDespensa && $match['faltan_principales'] > 0) {
                continue;
            }

            $items[] = [
                'id' => (int) $receta['id'],
                'slug' => (string) $receta['slug'],
                'nombre' => (string) $receta['nombre'],
                'descripcion' => (string) ($receta['descripcion'] ?? ''),
                'imagen_url' => $receta['imagen_url'] ?? null,
                'fuente_nombre' => $receta['fuente_nombre'] ?? null,
                'fuente_url' => $receta['fuente_url'] ?? null,
                'referencia' => ($receta['fuente_url'] ?? null) !== null,
                'categoria' => $categoriaReceta,
                'tipos' => array_values($receta['tipos'] ?? []),
                'porciones_base' => (int) ($receta['porciones_base'] ?? 4),
                'tiempo_min' => (int) ($receta['tiempo_min'] ?? 0),
                'dificultad' => (string) ($receta['dificultad'] ?? 'facil'),
                'coincidencia' => $match['coincidencia'],
                'tiene_count' => $match['tiene_count'],
                'total_ingredientes' => $match['total'],
                'faltan' => $match['faltan'],
                'faltan_principales' => $match['faltan_principales'],
                'ingredientes_resumen' => $match['resumen'],
                'video' => $this->videoPublico($receta),
                'favorita' => isset($favoritos[$receta['id']]),
            ];
        }

        usort($items, static function (array $a, array $b): int {
            $cmp = $b['coincidencia'] <=> $a['coincidencia'];

            if ($cmp !== 0) {
                return $cmp;
            }

            $cmp = $a['faltan_principales'] <=> $b['faltan_principales'];

            return $cmp !== 0 ? $cmp : strcmp($a['nombre'], $b['nombre']);
        });

        return [
            'items' => $items,
            'total' => count($items),
            'despensa' => [
                'modo' => $despensaSeleccionada['modo'],
                'total_productos' => count($despensa),
                'compra_id' => $despensaSeleccionada['ultima']['id'] ?? null,
                'fecha' => $despensaSeleccionada['ultima']['fecha'] ?? null,
                'compra_ids' => $despensaSeleccionada['ids'],
                'compras' => $despensaSeleccionada['compras'],
            ],
            'tipos' => array_values($this->tipos()),
            'categorias' => array_values($this->categorias()),
        ];
    }

    /**
     * @param array{q?: string} $filtros
     * @return array<string, mixed>|null
     */
    public function detalle(int $usuarioId, string $slug, array $filtros = []): ?array
    {
        $receta = $this->recetas->findPublicBySlug($slug);

        if ($receta === null) {
            return null;
        }

        $despensaSeleccionada = $this->resolverDespensa($usuarioId, $filtros['compras'] ?? null);
        $pantry = $this->indiceDespensa($despensaSeleccionada['despensa']);
        $match = $this->matchReceta($receta, $pantry);

        $receta['coincidencia'] = $match['coincidencia'];
        $receta['tiene_count'] = $match['tiene_count'];
        $receta['total_ingredientes'] = $match['total'];
        $receta['faltan'] = $match['faltan'];
        $receta['faltan_principales'] = $match['faltan_principales'];
        $receta['video'] = $this->videoPublico($receta);
        $receta['categoria'] = $this->categoriaDe($receta);
        $receta['favorita'] = $this->recetas->esFavorito($usuarioId, (int) $receta['id']);
        $receta['costo'] = $this->precios->costoReceta($usuarioId, $receta);
        $receta['nutricion'] = $this->nutricion->receta($receta, null, $usuarioId);
        $receta['tipos_detalle'] = array_values(array_filter(
            array_map(
                fn (string $tipo): ?array => $this->tipos()[$tipo] ?? null,
                $receta['tipos'] ?? []
            )
        ));

        return $receta;
    }

    /**
     * Calorías orientativas de varias recetas por slug, para las tarjetas del
     * recetario. Se limita el lote para no recalcular el catálogo completo.
     *
     * @param array<int, string> $slugs
     * @return array{items: array<string, array{total: float, porcion: float, porciones_base: int, completo: bool, sin_dato: int}>}
     */
    public function nutricionPorSlugs(int $usuarioId, array $slugs): array
    {
        $slugs = array_slice(array_values(array_unique(array_filter(
            array_map(static fn (mixed $slug): string => trim((string) $slug), $slugs),
            static fn (string $slug): bool => $slug !== ''
        ))), 0, 30);

        if ($slugs === []) {
            return ['items' => []];
        }

        $recetas = $this->recetas->porSlugsPublicos($slugs);
        $entradas = [];

        foreach ($recetas as $slug => $receta) {
            $entradas[$slug] = ['receta' => $receta];
        }

        $calculadas = $this->nutricion->recetas($entradas, $usuarioId);
        $items = [];

        foreach ($calculadas as $slug => $datos) {
            $items[(string) $slug] = [
                'total' => $datos['total'],
                'porcion' => $datos['porcion'],
                'porciones_base' => $datos['porciones_base'],
                'completo' => $datos['completo'],
                'sin_dato' => $datos['sin_dato'],
            ];
        }

        return ['items' => $items];
    }

    /**
     * @param array<int, array{slug?: string, porciones?: int|string}> $seleccion
     * @return array{items: array<int, array<string, mixed>>, recetas: array<int, array<string, mixed>>, total: int}
     */
    public function previewLista(int $usuarioId, array $seleccion): array
    {
        $catalogo = [];

        foreach ($this->recetas->allPublic() as $receta) {
            $catalogo[(string) $receta['slug']] = $receta;
        }

        $productos = $this->productos->catalogoActivo($usuarioId);
        $productoIndex = [];

        foreach ($productos as $producto) {
            $productoIndex[NormalizadorService::normalizar($producto['nombre'])] = $producto;
        }

        $despensa = $this->compras->despensa($usuarioId);
        $pantry = $this->indiceDespensa($despensa);
        $agrupados = [];
        $recetasSeleccionadas = [];

        foreach (array_slice($seleccion, 0, self::MAX_RECETAS_PREVIEW) as $entrada) {
            if (!is_array($entrada)) {
                continue;
            }

            $slug = (string) ($entrada['slug'] ?? '');
            $receta = $catalogo[$slug] ?? null;

            if ($receta === null) {
                continue;
            }

            $porciones = (int) ($entrada['porciones'] ?? ($receta['porciones_base'] ?? 4));
            $porciones = max(1, min(self::MAX_PORCIONES, $porciones));
            $factor = $porciones / max(1, (int) ($receta['porciones_base'] ?? 4));
            $recetasSeleccionadas[] = [
                'slug' => $slug,
                'nombre' => (string) $receta['nombre'],
                'porciones' => $porciones,
                'porciones_base' => (int) ($receta['porciones_base'] ?? 4),
            ];

            foreach (($receta['ingredientes'] ?? []) as $ingrediente) {
                if (!is_array($ingrediente)) {
                    continue;
                }

                $unidad = (string) ($ingrediente['unidad'] ?? '');
                $cantidad = $ingrediente['cantidad'] ?? null;

                if ($unidad === 'al_gusto' || $cantidad === null || (float) $cantidad <= 0) {
                    continue;
                }

                $cantidadEscalada = round((float) $cantidad * $factor, 3);
                $nombreIngrediente = (string) ($ingrediente['nombre'] ?? '');
                $producto = $productoIndex[NormalizadorService::normalizar(
                    (string) ($ingrediente['producto'] ?? $nombreIngrediente)
                )] ?? null;

                if ($producto !== null) {
                    $cantidadBase = $this->convertirUnidad(
                        $cantidadEscalada,
                        $unidad,
                        (string) $producto['unidad_base']
                    );

                    if ($cantidadBase === null) {
                        // La unidad no se puede convertir: se conserva el
                        // ingrediente con su unidad original en lugar de
                        // inventar una cantidad en la unidad del producto.
                        $productoId = null;
                        $nombre = $nombreIngrediente !== ''
                            ? $nombreIngrediente
                            : (string) $producto['nombre'];
                        $unidadBase = $this->unidadCarrito($unidad);
                        $cantidadBase = $cantidadEscalada;
                        $categoria = null;
                    } else {
                        $unidadBase = (string) $producto['unidad_base'];
                        $productoId = (int) $producto['id'];
                        $nombre = (string) $producto['nombre'];
                        $categoria = (string) $producto['categoria_nombre'];
                    }
                } else {
                    $productoId = null;
                    $nombre = $nombreIngrediente;
                    $unidadBase = $this->unidadCarrito($unidad);
                    $cantidadBase = $cantidadEscalada;
                    $categoria = null;
                }

                $clave = $productoId !== null
                    ? 'p:' . $productoId
                    : 'n:' . NormalizadorService::normalizar($nombre) . '|' . $unidadBase;

                if (!isset($agrupados[$clave])) {
                    $agrupados[$clave] = [
                        'clave' => $clave,
                        'producto_id' => $productoId,
                        'nombre' => $nombre,
                        'cantidad' => 0.0,
                        'unidad_base' => $unidadBase,
                        'categoria_nombre' => $categoria,
                        'principal' => false,
                        'basico' => true,
                        'ya_comprado' => false,
                        'origenes' => [],
                    ];
                }

                $agrupados[$clave]['cantidad'] = round(
                    $agrupados[$clave]['cantidad'] + $cantidadBase,
                    3
                );
                $agrupados[$clave]['principal'] = $agrupados[$clave]['principal']
                    || (bool) ($ingrediente['principal'] ?? false);
                $agrupados[$clave]['basico'] = $agrupados[$clave]['basico']
                    && (bool) ($ingrediente['basico'] ?? false);
                $agrupados[$clave]['ya_comprado'] = $agrupados[$clave]['ya_comprado']
                    || $this->estaEnDespensa($pantry, $nombreIngrediente);

                $origen = sprintf('%s (%d porciones)', $receta['nombre'], $porciones);
                $agrupados[$clave]['origenes'][$origen] = $origen;
            }
        }

        $items = [];

        foreach ($agrupados as $item) {
            $origenes = array_values($item['origenes']);
            $item['origen'] = mb_substr(implode(', ', $origenes), 0, 255);
            unset($item['origenes']);
            $item['cantidad'] = round(max(0.001, (float) $item['cantidad']), 3);
            $items[] = $item;
        }

        usort($items, static function (array $a, array $b): int {
            $cmp = (int) $b['principal'] <=> (int) $a['principal'];

            return $cmp !== 0 ? $cmp : strcmp($a['nombre'], $b['nombre']);
        });

        return [
            'items' => $items,
            'recetas' => $recetasSeleccionadas,
            'total' => count($items),
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function listadoAdmin(): array
    {
        $tipos = $this->tipos();
        $items = [];

        foreach ($this->recetas->all() as $receta) {
            $items[] = [
                'id' => (int) $receta['id'],
                'slug' => (string) $receta['slug'],
                'nombre' => (string) $receta['nombre'],
                'descripcion' => (string) ($receta['descripcion'] ?? ''),
                'imagen_url' => $receta['imagen_url'] ?? null,
                'fuente_nombre' => $receta['fuente_nombre'] ?? null,
                'fuente_url' => $receta['fuente_url'] ?? null,
                'fuente_autor' => $receta['fuente_autor'] ?? null,
                'referencia' => ($receta['fuente_url'] ?? null) !== null,
                'categoria' => $this->categoriaDe($receta),
                'tipos' => array_values($receta['tipos'] ?? []),
                'tipos_nombres' => array_values(array_filter(array_map(
                    static fn (string $tipo): ?string => $tipos[$tipo]['nombre'] ?? null,
                    $receta['tipos'] ?? []
                ))),
                'estado' => (string) $receta['estado'],
                'creada_por' => $receta['creada_por'],
                'creador_nombre' => $receta['creador_nombre'],
                'ingredientes_count' => count($receta['ingredientes'] ?? []),
                'pasos_count' => count($receta['pasos'] ?? []),
                'video' => $this->videoPublico($receta),
            ];
        }

        return $items;
    }

    /**
     * @return array<string, mixed>|null
     */
    public function obtenerAdmin(int $id): ?array
    {
        $receta = $this->recetas->findById($id);

        if ($receta === null) {
            return null;
        }

        $receta['video'] = $this->videoPublico($receta);
        $receta['categoria'] = $this->categoriaDe($receta);
        $receta['tipos_detalle'] = array_values(array_filter(
            array_map(
                fn (string $tipo): ?array => $this->tipos()[$tipo] ?? null,
                $receta['tipos'] ?? []
            )
        ));

        return $receta;
    }

    /**
     * @param array<string, mixed> $data
     * @return array<string, mixed>
     */
    public function crearPropuesta(int $usuarioId, array $data): array
    {
        $normalizada = $this->normalizarReceta($data, false);
        $normalizada['video_youtube_id'] = null;
        $normalizada['video_titulo'] = null;

        return $this->recetas->create($normalizada, $usuarioId, 'pendiente');
    }

    /**
     * @param array<string, mixed> $data
     * @return array<string, mixed>
     */
    public function crearAdmin(array $data, int $usuarioId): array
    {
        $normalizada = $this->normalizarReceta($data, true);
        $estado = in_array($normalizada['estado'] ?? '', self::ESTADOS, true)
            ? (string) $normalizada['estado']
            : 'publicada';

        $receta = $this->recetas->create($normalizada, $usuarioId, $estado);

        return $this->obtenerAdmin((int) $receta['id']) ?? $receta;
    }

    /**
     * Crea una receta de referencia desde un proceso de importación.
     * Siempre queda en borrador y sin usuario creador.
     *
     * @param array<string, mixed> $data
     * @return array<string, mixed>
     */
    public function crearReferencia(array $data): array
    {
        $normalizada = $this->normalizarReceta($data, true);

        return $this->recetas->create($normalizada, null, 'borrador');
    }

    /**
     * Actualiza una receta de referencia importada, conservando su estado.
     *
     * @param array<string, mixed> $data
     * @return array<string, mixed>|null
     */
    public function actualizarReferencia(int $id, array $data): ?array
    {
        $anterior = $this->recetas->findById($id);

        if ($anterior === null) {
            return null;
        }

        $normalizada = $this->normalizarReceta($data, true);
        $normalizada['estado'] = (string) $anterior['estado'];

        return $this->recetas->update($id, $normalizada);
    }

    /**
     * @param array<string, mixed> $data
     * @return array<string, mixed>|null
     */
    public function actualizarAdmin(int $id, array $data): ?array
    {
        $anterior = $this->recetas->findById($id);

        if ($anterior === null) {
            return null;
        }

        $normalizada = $this->normalizarReceta($data, true);
        $actualizada = $this->recetas->update($id, $normalizada);

        if (
            $actualizada !== null
            && ($anterior['imagen_url'] ?? null) !== ($normalizada['imagen_url'] ?? null)
        ) {
            $this->imagenes->eliminar($anterior['imagen_url'] ?? null);
        }

        return $actualizada === null ? null : ($this->obtenerAdmin($id) ?? $actualizada);
    }

    public function eliminarAdmin(int $id): bool
    {
        $receta = $this->recetas->findById($id);

        if ($receta === null) {
            return false;
        }

        $eliminada = $this->recetas->delete($id);

        if ($eliminada) {
            $this->imagenes->eliminar($receta['imagen_url'] ?? null);
        }

        return $eliminada;
    }

    /**
     * @param array<string, mixed> $file Entrada de $_FILES['imagen'].
     */
    public function subirImagen(array $file): string
    {
        return $this->imagenes->guardar($file);
    }

    /**
     * @return array<string, mixed>|null
     */
    public function cambiarEstado(int $id, string $estado): ?array
    {
        if (!in_array($estado, self::ESTADOS, true) || $this->recetas->findById($id) === null) {
            return null;
        }

        return $this->recetas->update($id, ['estado' => $estado]);
    }

    /**
     * Publica en bloque las recetas seleccionadas desde el catálogo admin.
     *
     * @param array<int, mixed> $ids
     */
    public function publicarSeleccionadas(array $ids): int
    {
        if (count($ids) > 5000) {
            throw new InvalidArgumentException('Selecciona como máximo 5,000 recetas.');
        }

        return $this->recetas->publicarVarias($ids);
    }

    public function toggleFavorito(int $usuarioId, string $slug): ?bool
    {
        $receta = $this->recetas->findPublicBySlug($slug);

        if ($receta === null) {
            return null;
        }

        return $this->recetas->toggleFavorito($usuarioId, (int) $receta['id']);
    }

    /**
     * @return array<string, mixed>|null
     */
    public function videoPublico(array $receta): ?array
    {
        $id = (string) ($receta['video_youtube_id'] ?? '');

        if (preg_match('/^[A-Za-z0-9_-]{11}$/', $id) !== 1) {
            return null;
        }

        return [
            'youtube_id' => $id,
            'titulo' => $receta['video_titulo'] ?? null,
            'embed_url' => 'https://www.youtube-nocookie.com/embed/' . $id,
            'thumbnail_url' => 'https://i.ytimg.com/vi/' . $id . '/hqdefault.jpg',
        ];
    }

    public function extraerYoutubeId(string $url): ?string
    {
        $url = trim($url);

        if ($url === '') {
            return null;
        }

        if (preg_match('/^[A-Za-z0-9_-]{11}$/', $url) === 1) {
            return $url;
        }

        if (!str_contains($url, '://')) {
            $url = 'https://' . $url;
        }

        $parts = parse_url($url);

        if (!is_array($parts) || !isset($parts['host'])) {
            return null;
        }

        $host = strtolower((string) $parts['host']);
        $hosts = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'youtube-nocookie.com', 'www.youtube-nocookie.com'];

        if (!in_array($host, $hosts, true)) {
            return null;
        }

        $id = null;

        if ($host === 'youtu.be') {
            $path = trim((string) ($parts['path'] ?? ''), '/');
            $id = explode('/', $path)[0] ?? null;
        } else {
            $query = [];
            parse_str((string) ($parts['query'] ?? ''), $query);

            if (isset($query['v']) && is_string($query['v'])) {
                $id = $query['v'];
            } else {
                $path = trim((string) ($parts['path'] ?? ''), '/');
                $segmentos = explode('/', $path);

                if (count($segmentos) >= 2 && in_array($segmentos[0], ['embed', 'shorts', 'live', 'v'], true)) {
                    $id = $segmentos[1];
                }
            }
        }

        if (!is_string($id) || preg_match('/^[A-Za-z0-9_-]{11}$/', $id) !== 1) {
            return null;
        }

        return $id;
    }

    /**
     * @param array<string, mixed> $data
     * @return array<string, mixed>
     */
    private function normalizarReceta(array $data, bool $admin): array
    {
        $nombre = trim((string) ($data['nombre'] ?? ''));

        if (mb_strlen($nombre) < 2 || mb_strlen($nombre) > 150) {
            throw new InvalidArgumentException('El nombre debe tener entre 2 y 150 caracteres.');
        }

        $descripcion = trim((string) ($data['descripcion'] ?? ''));

        if (mb_strlen($descripcion) > 500) {
            throw new InvalidArgumentException('La descripción no puede superar 500 caracteres.');
        }

        $tipos = $data['tipos'] ?? [];

        if (is_string($tipos)) {
            $tipos = array_map('trim', explode(',', $tipos));
        }

        if (!is_array($tipos)) {
            $tipos = [];
        }

        $tipos = array_values(array_unique(array_filter(array_map('strval', $tipos))));
        $tiposValidos = array_keys($this->tipos());
        $tipos = array_values(array_intersect($tipos, $tiposValidos));

        if ($tipos === []) {
            throw new InvalidArgumentException('Selecciona al menos un tipo de receta.');
        }

        $porciones = (int) ($data['porciones_base'] ?? 4);

        if ($porciones < 1 || $porciones > self::MAX_PORCIONES) {
            throw new InvalidArgumentException('Las porciones deben estar entre 1 y 50.');
        }

        $tiempo = (int) ($data['tiempo_min'] ?? 30);

        if ($tiempo < 1 || $tiempo > 240) {
            throw new InvalidArgumentException('El tiempo debe estar entre 1 y 240 minutos.');
        }

        $dificultad = (string) ($data['dificultad'] ?? 'facil');

        if (!in_array($dificultad, self::DIFICULTADES, true)) {
            throw new InvalidArgumentException('La dificultad no es válida.');
        }

        $ingredientes = $data['ingredientes'] ?? [];

        if (!is_array($ingredientes) || $ingredientes === []) {
            throw new InvalidArgumentException('Agrega al menos un ingrediente.');
        }

        $ingredientesNormalizados = [];

        foreach ($ingredientes as $ingrediente) {
            if (!is_array($ingrediente)) {
                continue;
            }

            $ingNombre = trim((string) ($ingrediente['nombre'] ?? ''));
            $unidad = (string) ($ingrediente['unidad'] ?? '');

            if ($ingNombre === '' || mb_strlen($ingNombre) > 150) {
                throw new InvalidArgumentException('Cada ingrediente necesita un nombre de hasta 150 caracteres.');
            }

            if (!in_array($unidad, self::UNIDADES, true)) {
                throw new InvalidArgumentException('La unidad de un ingrediente no es válida.');
            }

            $cantidad = $ingrediente['cantidad'] ?? null;

            if ($unidad === 'al_gusto') {
                $cantidad = null;
            } else {
                if (!is_numeric($cantidad) || (float) $cantidad <= 0) {
                    throw new InvalidArgumentException('La cantidad de cada ingrediente debe ser mayor que 0.');
                }

                $cantidad = round((float) $cantidad, 3);
            }

            $producto = trim((string) ($ingrediente['producto'] ?? ''));
            $ingredientesNormalizados[] = [
                'nombre' => $ingNombre,
                'producto' => $producto === '' ? null : $producto,
                'cantidad' => $cantidad,
                'unidad' => $unidad,
                'principal' => (bool) ($ingrediente['principal'] ?? false),
                'basico' => (bool) ($ingrediente['basico'] ?? false),
            ];
        }

        if ($ingredientesNormalizados === []) {
            throw new InvalidArgumentException('Agrega al menos un ingrediente válido.');
        }

        $pasos = $data['pasos'] ?? [];

        if (is_string($pasos)) {
            $pasos = preg_split('/\R/', $pasos) ?: [];
        }

        if (!is_array($pasos)) {
            $pasos = [];
        }

        $pasosNormalizados = [];

        foreach ($pasos as $paso) {
            $texto = trim((string) $paso);

            if ($texto !== '') {
                $pasosNormalizados[] = mb_substr($texto, 0, 1000);
            }
        }

        if ($pasosNormalizados === []) {
            throw new InvalidArgumentException('Agrega al menos un paso de preparación.');
        }

        $imagenUrl = null;
        $imagen = trim((string) ($data['imagen_url'] ?? ''));

        if ($imagen !== '') {
            if (mb_strlen($imagen) > 500) {
                throw new InvalidArgumentException('La imagen no puede superar 500 caracteres.');
            }

            $esUrl = filter_var($imagen, FILTER_VALIDATE_URL) !== false
                && in_array(
                    strtolower((string) parse_url($imagen, PHP_URL_SCHEME)),
                    ['http', 'https'],
                    true
                );
            $esRutaLocal = preg_match(
                '#^/[A-Za-z0-9/_.\-]+\.(?:jpe?g|png|webp)$#i',
                $imagen
            ) === 1;

            if (!$esUrl && !$esRutaLocal) {
                throw new InvalidArgumentException('La imagen debe ser una URL http/https o una ruta interna válida.');
            }

            $imagenUrl = $imagen;
        }

        $categoriaId = null;
        $categoriaSlug = trim((string) ($data['categoria'] ?? ''));
        $categoriaIdBruto = $data['categoria_id'] ?? null;

        if ($categoriaSlug !== '' || ($categoriaIdBruto !== null && $categoriaIdBruto !== '')) {
            foreach ($this->categorias() as $categoria) {
                $coincideSlug = $categoriaSlug !== '' && (string) $categoria['slug'] === $categoriaSlug;
                $coincideId = $categoriaIdBruto !== null
                    && $categoriaIdBruto !== ''
                    && (int) $categoria['id'] === (int) $categoriaIdBruto;

                if ($coincideSlug || $coincideId) {
                    $categoriaId = (int) $categoria['id'];

                    break;
                }
            }
        }

        if ($categoriaId === null) {
            throw new InvalidArgumentException('Selecciona una categoría de platillo.');
        }

        $videoId = null;
        $videoTitulo = null;

        if ($admin) {
            $videoUrl = trim((string) ($data['video_url'] ?? ''));

            if ($videoUrl !== '') {
                $videoId = $this->extraerYoutubeId($videoUrl);

                if ($videoId === null) {
                    throw new InvalidArgumentException('El video debe ser un enlace válido de YouTube.');
                }
            }

            $videoTitulo = trim((string) ($data['video_titulo'] ?? ''));
            $videoTitulo = $videoTitulo === '' ? null : mb_substr($videoTitulo, 0, 150);
        }

        $estado = (string) ($data['estado'] ?? 'publicada');
        $estado = in_array($estado, self::ESTADOS, true) ? $estado : 'publicada';

        $fuenteNombre = null;
        $fuenteUrl = null;
        $fuenteAutor = null;

        if ($admin) {
            $fuenteNombre = trim((string) ($data['fuente_nombre'] ?? ''));

            if ($fuenteNombre !== '' && mb_strlen($fuenteNombre) > 150) {
                throw new InvalidArgumentException('El nombre de la fuente no puede superar 150 caracteres.');
            }

            $fuenteUrl = trim((string) ($data['fuente_url'] ?? ''));

            if ($fuenteUrl !== '') {
                if (mb_strlen($fuenteUrl) > 500) {
                    throw new InvalidArgumentException('La URL de la fuente no puede superar 500 caracteres.');
                }

                $esUrlValida = filter_var($fuenteUrl, FILTER_VALIDATE_URL) !== false
                    && in_array(
                        strtolower((string) parse_url($fuenteUrl, PHP_URL_SCHEME)),
                        ['http', 'https'],
                        true
                    );

                if (!$esUrlValida) {
                    throw new InvalidArgumentException('La URL de la fuente debe ser un enlace http/https válido.');
                }
            }

            $fuenteAutor = trim((string) ($data['fuente_autor'] ?? ''));

            if ($fuenteAutor !== '' && mb_strlen($fuenteAutor) > 150) {
                throw new InvalidArgumentException('El autor original no puede superar 150 caracteres.');
            }
        }

        return [
            'nombre' => $nombre,
            'descripcion' => $descripcion,
            'tipos' => $tipos,
            'categoria_id' => $categoriaId,
            'porciones_base' => $porciones,
            'tiempo_min' => $tiempo,
            'dificultad' => $dificultad,
            'ingredientes' => $ingredientesNormalizados,
            'pasos' => $pasosNormalizados,
            'imagen_url' => $imagenUrl,
            'fuente_nombre' => $fuenteNombre === '' ? null : $fuenteNombre,
            'fuente_url' => $fuenteUrl === '' ? null : $fuenteUrl,
            'fuente_autor' => $fuenteAutor === '' ? null : $fuenteAutor,
            'video_youtube_id' => $videoId,
            'video_titulo' => $videoTitulo,
            'estado' => $estado,
        ];
    }

    /**
     * @param array<int, array{nombre: string, tokens: array<int, string>, veces: int}> $pantry
     * @return array{coincidencia: float, tiene_count: int, total: int, faltan: array<int, string>, faltan_principales: int, resumen: array<int, string>}
     */
    private function matchReceta(array $receta, array $pantry): array
    {
        $totalPeso = 0.0;
        $matchPeso = 0.0;
        $tiene = 0;
        $total = 0;
        $faltan = [];
        $faltanPrincipales = 0;
        $resumen = [];

        foreach (($receta['ingredientes'] ?? []) as $ingrediente) {
            if (!is_array($ingrediente) || (bool) ($ingrediente['basico'] ?? false)) {
                continue;
            }

            if (($ingrediente['unidad'] ?? '') === 'al_gusto') {
                continue;
            }

            $nombre = (string) ($ingrediente['nombre'] ?? '');
            $principal = (bool) ($ingrediente['principal'] ?? false);
            $peso = $principal ? 3.0 : 1.0;
            $total++;
            $totalPeso += $peso;

            if (count($resumen) < 5) {
                $resumen[] = $nombre;
            }

            if ($this->estaEnDespensa($pantry, $nombre)) {
                $tiene++;
                $matchPeso += $peso;
            } else {
                $faltan[] = $nombre;

                if ($principal) {
                    $faltanPrincipales++;
                }
            }
        }

        return [
            'coincidencia' => $totalPeso > 0 ? round($matchPeso / $totalPeso, 3) : 0.0,
            'tiene_count' => $tiene,
            'total' => $total,
            'faltan' => $faltan,
            'faltan_principales' => $faltanPrincipales,
            'resumen' => $resumen,
        ];
    }

    /**
     * Resuelve la despensa de una selección explícita de compras o, si no
     * hay selección, la de la compra más reciente.
     *
     * @return array{
     *     despensa: array<int, array<string, mixed>>,
     *     modo: string,
     *     ids: array<int, int>,
     *     compras: array<int, array<string, mixed>>,
     *     ultima: array{id: int, fecha: string}|null
     * }
     */
    private function resolverDespensa(int $usuarioId, mixed $comprasFiltro): array
    {
        $ids = $this->normalizarIdsCompras($comprasFiltro);

        if ($ids !== []) {
            $resumenes = $this->compras->resumenes($usuarioId, $ids);
            $validos = array_map(
                static fn (array $compra): int => (int) $compra['id'],
                $resumenes
            );

            return [
                'despensa' => $validos === []
                    ? []
                    : $this->compras->despensa($usuarioId, null, $validos),
                'modo' => 'seleccion',
                'ids' => $validos,
                'compras' => $resumenes,
                'ultima' => null,
            ];
        }

        $ultima = $this->compras->ultimaCompra($usuarioId);

        return [
            'despensa' => $ultima === null
                ? []
                : $this->compras->despensa($usuarioId, null, $ultima['id']),
            'modo' => 'ultima',
            'ids' => [],
            'compras' => $ultima === null
                ? []
                : $this->compras->resumenes($usuarioId, [(int) $ultima['id']]),
            'ultima' => $ultima,
        ];
    }

    /**
     * @return array<int, int>
     */
    private function normalizarIdsCompras(mixed $valor): array
    {
        if (is_string($valor)) {
            $valor = trim($valor) === '' ? [] : explode(',', $valor);
        }

        if (!is_array($valor)) {
            return [];
        }

        $ids = [];

        foreach ($valor as $item) {
            if (!is_int($item) && !is_string($item)) {
                continue;
            }

            $id = (int) $item;

            if ($id > 0) {
                $ids[$id] = $id;
            }
        }

        return array_slice(array_values($ids), 0, 50);
    }

    /**
     * @param array<int, array{nombre: string, veces: int}> $despensa
     * @return array<int, array{nombre: string, tokens: array<int, string>, veces: int}>
     */
    private function indiceDespensa(array $despensa): array
    {
        $index = [];

        foreach ($despensa as $item) {
            $nombre = trim((string) ($item['nombre'] ?? ''));

            if ($nombre === '') {
                continue;
            }

            $index[] = [
                'nombre' => $nombre,
                'tokens' => NormalizadorService::tokensNombre($nombre),
                'veces' => (int) ($item['veces'] ?? 1),
            ];
        }

        return $index;
    }

    /**
     * @param array<int, array{nombre: string, tokens: array<int, string>, veces: int}> $pantry
     */
    private function estaEnDespensa(array $pantry, string $nombre): bool
    {
        $tokens = NormalizadorService::tokensNombre($nombre);

        if ($tokens === []) {
            return false;
        }

        foreach ($pantry as $item) {
            if (NormalizadorService::tokensCompatibles($item['tokens'], $tokens)) {
                return true;
            }
        }

        return false;
    }

    private function convertirUnidad(float $cantidad, string $origen, string $destino): ?float
    {
        $origen = strtolower($origen);
        $destino = strtolower($destino);

        if ($origen === $destino) {
            return round($cantidad, 3);
        }

        if ($origen === 'g' && $destino === 'kg') {
            return round($cantidad / 1000, 3);
        }

        if ($origen === 'kg' && $destino === 'g') {
            return round($cantidad * 1000, 3);
        }

        if ($origen === 'ml' && $destino === 'l') {
            return round($cantidad / 1000, 3);
        }

        if ($origen === 'l' && $destino === 'ml') {
            return round($cantidad * 1000, 3);
        }

        return null;
    }

    private function unidadCarrito(string $unidad): string
    {
        return match (strtolower($unidad)) {
            'g' => 'gr',
            'ml' => 'ml',
            'kg' => 'kg',
            'l' => 'L',
            default => 'pza',
        };
    }
}
