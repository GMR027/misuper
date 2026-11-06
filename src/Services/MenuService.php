<?php

declare(strict_types=1);

namespace App\Services;

use App\Repositories\MenuRepository;
use App\Repositories\RecetaRepository;
use DateTimeImmutable;
use InvalidArgumentException;

/**
 * Menú semanal: días, tiempos de comida, costos y puente a la lista.
 *
 * Las recetas se guardan por id, pero también se conserva su nombre para que
 * un menú viejo siga siendo legible si la receta se despublica o se elimina.
 */
final class MenuService
{
    public const DIAS = [
        1 => 'Lunes',
        2 => 'Martes',
        3 => 'Miércoles',
        4 => 'Jueves',
        5 => 'Viernes',
        6 => 'Sábado',
        7 => 'Domingo',
    ];

    public const MOMENTOS = ['desayuno', 'comida', 'cena', 'colacion', 'otro'];

    public const MAX_ITEMS = 200;

    private readonly MenuRepository $menus;
    private readonly RecetaRepository $recetas;
    private readonly PrecioService $precios;
    private readonly RecetaService $recetario;
    private readonly ListaCompraService $listas;

    public function __construct(
        ?MenuRepository $menus = null,
        ?RecetaRepository $recetas = null,
        ?PrecioService $precios = null,
        ?RecetaService $recetario = null,
        ?ListaCompraService $listas = null
    ) {
        $this->menus = $menus ?? new MenuRepository();
        $this->recetas = $recetas ?? new RecetaRepository();
        $this->precios = $precios ?? new PrecioService();
        $this->recetario = $recetario ?? new RecetaService();
        $this->listas = $listas ?? new ListaCompraService();
    }

    /**
     * Normaliza cualquier fecha a la semana que empieza en lunes.
     */
    public function normalizarSemana(?string $semana): string
    {
        if ($semana === null || trim($semana) === '') {
            return (new DateTimeImmutable('today'))->modify('monday this week')->format('Y-m-d');
        }

        $fecha = DateTimeImmutable::createFromFormat('!Y-m-d', trim($semana));
        $errores = DateTimeImmutable::getLastErrors();

        if (
            $fecha === false
            || ($errores !== false && ($errores['warning_count'] > 0 || $errores['error_count'] > 0))
        ) {
            throw new InvalidArgumentException('La semana no es una fecha válida.');
        }

        return $fecha->modify('monday this week')->format('Y-m-d');
    }

    /**
     * @return array<string, mixed>
     */
    public function obtener(int $usuarioId, ?string $semana): array
    {
        $semana = $this->normalizarSemana($semana);
        $menu = $this->menus->findMenu($usuarioId, $semana);
        $items = $menu === null ? [] : $this->menus->items((int) $menu['id']);

        $catalogo = [];

        foreach ($this->recetas->all() as $receta) {
            $catalogo[(int) $receta['id']] = $receta;
        }

        $entradas = [];

        foreach ($items as $item) {
            $recetaId = $item['receta_id'];
            $receta = $recetaId !== null ? ($catalogo[$recetaId] ?? null) : null;

            if ($item['tipo'] !== 'receta' || $receta === null || ($receta['estado'] ?? '') !== 'publicada') {
                continue;
            }

            $entradas[$item['id']] = [
                'receta' => $receta,
                'porciones' => (int) $item['porciones'],
            ];
        }

        $costos = $this->precios->costosRecetas($usuarioId, $entradas);
        $dias = [];
        $totalSemana = 0.0;
        $recetasSemana = 0;
        $itemsSemana = 0;
        $sinPrecioSemana = 0;
        $viejosSemana = 0;
        $noDisponiblesSemana = 0;
        $hoy = (new DateTimeImmutable('today'))->format('Y-m-d');
        $inicio = new DateTimeImmutable($semana);

        for ($dia = 1; $dia <= 7; $dia++) {
            $fecha = $inicio->modify('+' . ($dia - 1) . ' days')->format('Y-m-d');
            $itemsDia = [];
            $totalDia = 0.0;
            $sinPrecioDia = 0;
            $noDisponiblesDia = 0;

            foreach ($items as $item) {
                if ((int) $item['dia'] !== $dia) {
                    continue;
                }

                $itemsSemana++;
                $receta = $item['receta'];
                $disponible = $item['tipo'] === 'nota'
                    || ($receta !== null && ($receta['estado'] ?? '') === 'publicada');
                $costo = $costos[$item['id']] ?? null;

                if ($item['tipo'] === 'receta') {
                    $recetasSemana++;

                    if (!$disponible) {
                        $sinPrecioDia++;
                        $noDisponiblesDia++;
                    } elseif ($costo === null || !$costo['completo']) {
                        $sinPrecioDia++;
                    }
                }

                if ($costo !== null) {
                    $totalDia += $costo['total'];
                    $viejosSemana += (int) $costo['precios_viejos'];
                }

                $itemsDia[] = [
                    'id' => $item['id'],
                    'dia' => $item['dia'],
                    'momento' => $item['momento'],
                    'tipo' => $item['tipo'],
                    'etiqueta' => $item['etiqueta'],
                    'receta_id' => $item['receta_id'],
                    'nombre' => $item['nombre'] ?? $item['nombre_snapshot'],
                    'porciones' => $item['porciones'],
                    'orden' => $item['orden'],
                    'nota' => $item['nota'],
                    'slug' => $receta['slug'] ?? null,
                    'imagen_url' => $receta['imagen_url'] ?? null,
                    'tiempo_min' => $receta['tiempo_min'] ?? null,
                    'porciones_base' => $receta['porciones_base'] ?? null,
                    'tipos' => $receta['tipos'] ?? [],
                    'disponible' => $disponible,
                    'costo' => $costo === null
                        ? null
                        : [
                            'total' => $costo['total'],
                            'porcion' => $costo['porcion'],
                            'sin_precio' => $costo['items_sin_precio'],
                            'precios_viejos' => $costo['precios_viejos'],
                            'completo' => $costo['completo'],
                        ],
                ];
            }

            $totalSemana += $totalDia;
            $sinPrecioSemana += $sinPrecioDia;
            $noDisponiblesSemana += $noDisponiblesDia;

            $dias[] = [
                'dia' => $dia,
                'nombre' => self::DIAS[$dia],
                'fecha' => $fecha,
                'es_hoy' => $fecha === $hoy,
                'items' => $itemsDia,
                'total' => round($totalDia, 2),
                'sin_precio' => $sinPrecioDia,
                'completo' => $sinPrecioDia === 0,
            ];
        }

        $recetasDelMenu = array_filter(
            $items,
            static fn (array $item): bool => $item['tipo'] === 'receta'
        );

        return [
            'semana' => $semana,
            'semana_fin' => $inicio->modify('+6 days')->format('Y-m-d'),
            'menu' => [
                'id' => $menu['id'] ?? null,
                'nombre' => $menu['nombre'] ?? null,
            ],
            'dias' => $dias,
            'resumen' => [
                'items' => $itemsSemana,
                'recetas' => $recetasSemana,
                'total' => round($totalSemana, 2),
                'sin_precio' => $sinPrecioSemana,
                'no_disponibles' => $noDisponiblesSemana,
                'precios_viejos' => $viejosSemana,
                'completo' => $recetasDelMenu !== []
                    && $sinPrecioSemana === 0
                    && $noDisponiblesSemana === 0,
            ],
            'momentos' => self::MOMENTOS,
        ];
    }

    /**
     * Semanas con menú guardado, incluida siempre la semana actual.
     *
     * @return array<int, array{
     *     semana: string,
     *     semana_fin: string,
     *     items: int,
     *     es_actual: bool,
     *     es_pasada: bool,
     *     es_futura: bool
     * }>
     */
    public function semanas(int $usuarioId): array
    {
        $hoy = new DateTimeImmutable('today');
        $semanaActual = $hoy->modify('monday this week')->format('Y-m-d');
        $semanas = [];

        foreach ($this->menus->semanas($usuarioId) as $fila) {
            $semana = $fila['semana'];
            $semanas[$semana] = $this->resumenSemana($semana, $fila['items'], $semanaActual);
        }

        if (!isset($semanas[$semanaActual])) {
            $semanas[$semanaActual] = $this->resumenSemana($semanaActual, 0, $semanaActual);
        }

        ksort($semanas);

        return array_values($semanas);
    }

    /**
     * @return array{
     *     semana: string,
     *     semana_fin: string,
     *     items: int,
     *     es_actual: bool,
     *     es_pasada: bool,
     *     es_futura: bool
     * }
     */
    private function resumenSemana(string $semana, int $items, string $semanaActual): array
    {
        $inicio = new DateTimeImmutable($semana);

        return [
            'semana' => $semana,
            'semana_fin' => $inicio->modify('+6 days')->format('Y-m-d'),
            'items' => $items,
            'es_actual' => $semana === $semanaActual,
            'es_pasada' => $semana < $semanaActual,
            'es_futura' => $semana > $semanaActual,
        ];
    }

    /**
     * @param array<string, mixed> $data
     * @return array<string, mixed>
     */
    public function agregar(int $usuarioId, array $data): array
    {
        $semana = $this->normalizarSemana(isset($data['semana']) ? (string) $data['semana'] : null);
        $tipo = (string) ($data['tipo'] ?? 'receta');
        $dia = $this->dia($data['dia'] ?? null);
        $momento = $this->momento($data['momento'] ?? null);
        $etiqueta = $this->etiqueta($data['etiqueta'] ?? null, $momento);
        $nota = $this->textoOpcional($data['nota'] ?? null, 160, 'La nota');
        $recetaId = null;
        $nombre = '';
        $porciones = 1;

        if ($tipo === 'nota') {
            if ($nota === null || mb_strlen($nota) < 2) {
                throw new InvalidArgumentException('Escribe una nota de al menos 2 caracteres.');
            }

            $nombre = mb_substr($nota, 0, 150);
        } elseif ($tipo === 'receta') {
            $recetaId = (int) ($data['receta_id'] ?? 0);
            $receta = $recetaId > 0 ? $this->recetas->findById($recetaId) : null;

            if ($receta === null || ($receta['estado'] ?? '') !== 'publicada') {
                throw new InvalidArgumentException('La receta no existe o no está publicada.');
            }

            $nombre = (string) $receta['nombre'];
            $porciones = $this->porciones(
                $data['porciones'] ?? null,
                (int) ($receta['porciones_base'] ?? 4)
            );
        } else {
            throw new InvalidArgumentException('El tipo de elemento no es válido.');
        }

        $menu = $this->menus->ensureMenu($usuarioId, $semana);

        if ($this->menus->countItems((int) $menu['id']) >= self::MAX_ITEMS) {
            throw new InvalidArgumentException('El menú de la semana ya llegó a su límite de platillos.');
        }

        $orden = isset($data['orden']) && is_numeric($data['orden'])
            ? max(0, (int) $data['orden'])
            : $this->menus->nextOrder((int) $menu['id'], $dia, $momento);

        $this->menus->addItem((int) $menu['id'], [
            'dia' => $dia,
            'momento' => $momento,
            'tipo' => $tipo,
            'etiqueta' => $etiqueta,
            'receta_id' => $recetaId,
            'nombre_snapshot' => $nombre,
            'porciones' => $porciones,
            'orden' => $orden,
            'nota' => $nota,
        ]);

        return $this->obtener($usuarioId, $semana);
    }

    /**
     * @param array<string, mixed> $data
     * @return array<string, mixed>|null
     */
    public function actualizar(int $usuarioId, int $itemId, array $data): ?array
    {
        $item = $this->menus->findItemOwned($itemId, $usuarioId);

        if ($item === null) {
            return null;
        }

        $menu = $this->menus->findMenuById((int) $item['menu_id'], $usuarioId);

        if ($menu === null) {
            return null;
        }

        $campos = [];

        if (array_key_exists('dia', $data)) {
            $campos['dia'] = $this->dia($data['dia']);
        }

        if (array_key_exists('momento', $data)) {
            $momento = $this->momento($data['momento']);
            $campos['momento'] = $momento;
        } else {
            $momento = (string) $item['momento'];
        }

        if (array_key_exists('etiqueta', $data)) {
            $campos['etiqueta'] = $this->etiqueta($data['etiqueta'], $momento);
        }

        if (array_key_exists('orden', $data)) {
            if (!is_numeric($data['orden'])) {
                throw new InvalidArgumentException('El orden no es válido.');
            }

            $campos['orden'] = max(0, (int) $data['orden']);
        }

        if (array_key_exists('porciones', $data)) {
            $campos['porciones'] = $this->porciones($data['porciones'], (int) $item['porciones']);
        }

        if (array_key_exists('nota', $data)) {
            $nota = $this->textoOpcional($data['nota'], 160, 'La nota');

            if ($item['tipo'] === 'nota' && ($nota === null || mb_strlen($nota) < 2)) {
                throw new InvalidArgumentException('La nota no puede quedar vacía.');
            }

            $campos['nota'] = $nota;

            if ($item['tipo'] === 'nota' && $nota !== null) {
                $campos['nombre_snapshot'] = mb_substr($nota, 0, 150);
            }
        }

        if ($item['tipo'] === 'receta' && array_key_exists('receta_id', $data)) {
            $recetaId = (int) $data['receta_id'];
            $receta = $recetaId > 0 ? $this->recetas->findById($recetaId) : null;

            if ($receta === null || ($receta['estado'] ?? '') !== 'publicada') {
                throw new InvalidArgumentException('La receta no existe o no está publicada.');
            }

            $campos['receta_id'] = $recetaId;
            $campos['nombre_snapshot'] = (string) $receta['nombre'];

            if (!array_key_exists('porciones', $data)) {
                $campos['porciones'] = max(1, min(50, (int) $receta['porciones_base']));
            }
        }

        $this->menus->updateItem($itemId, $campos);

        return $this->obtener($usuarioId, (string) $menu['semana']);
    }

    /**
     * @return array<string, mixed>|null
     */
    public function eliminar(int $usuarioId, int $itemId): ?array
    {
        $item = $this->menus->findItemOwned($itemId, $usuarioId);

        if ($item === null) {
            return null;
        }

        $menu = $this->menus->findMenuById((int) $item['menu_id'], $usuarioId);
        $this->menus->deleteItem($itemId, $usuarioId);

        return $menu === null ? null : $this->obtener($usuarioId, (string) $menu['semana']);
    }

    /**
     * @return array<string, mixed>
     */
    public function vaciar(int $usuarioId, ?string $semana, ?int $dia = null): array
    {
        $semana = $this->normalizarSemana($semana);

        if ($dia !== null) {
            $dia = $this->dia($dia);
        }

        $menu = $this->menus->findMenu($usuarioId, $semana);

        if ($menu !== null) {
            $this->menus->clear((int) $menu['id'], $dia);
        }

        return $this->obtener($usuarioId, $semana);
    }

    /**
     * Copia una semana o un día. Si `reemplazar` es verdadero, vacía el
     * destino antes de copiar.
     *
     * @param array<string, mixed> $data
     * @return array<string, mixed>
     */
    public function copiar(int $usuarioId, array $data): array
    {
        $origenSemana = $this->normalizarSemana(
            isset($data['origen_semana']) ? (string) $data['origen_semana'] : null
        );
        $destinoSemana = $this->normalizarSemana(
            isset($data['destino_semana']) ? (string) $data['destino_semana'] : $origenSemana
        );
        $dia = isset($data['dia']) && $data['dia'] !== null && $data['dia'] !== ''
            ? $this->dia($data['dia'])
            : null;
        $reemplazar = filter_var($data['reemplazar'] ?? false, FILTER_VALIDATE_BOOL);

        $origen = $this->menus->findMenu($usuarioId, $origenSemana);

        if ($origen === null) {
            throw new InvalidArgumentException('La semana de origen está vacía.');
        }

        $items = $this->menus->items((int) $origen['id']);
        $items = array_values(array_filter(
            $items,
            static fn (array $item): bool => $dia === null || (int) $item['dia'] === $dia
        ));

        if ($items === []) {
            throw new InvalidArgumentException('La semana de origen no tiene platillos que copiar.');
        }

        $destino = $this->menus->ensureMenu($usuarioId, $destinoSemana);

        if ($reemplazar) {
            $this->menus->clear((int) $destino['id'], $dia);
        }

        $ordenes = [];
        $copias = [];

        foreach ($items as $item) {
            $clave = $item['dia'] . '|' . $item['momento'];

            if (!isset($ordenes[$clave])) {
                $ordenes[$clave] = $reemplazar
                    ? 0
                    : $this->menus->nextOrder((int) $destino['id'], (int) $item['dia'], (string) $item['momento']);
            }

            $copias[] = [
                'dia' => $item['dia'],
                'momento' => $item['momento'],
                'tipo' => $item['tipo'],
                'etiqueta' => $item['etiqueta'],
                'receta_id' => $item['receta_id'],
                'nombre_snapshot' => $item['nombre'] ?? $item['nombre_snapshot'],
                'porciones' => $item['porciones'],
                'orden' => $ordenes[$clave]++,
                'nota' => $item['nota'],
            ];
        }

        $this->menus->addMany((int) $destino['id'], $copias);

        return $this->obtener($usuarioId, $destinoSemana);
    }

    /**
     * Aplica sugerencias ya validadas (por ejemplo, las de la IA).
     *
     * @param array<int, array<string, mixed>> $sugerencias
     * @return array<string, mixed>
     */
    public function aplicarSugerencias(int $usuarioId, ?string $semana, array $sugerencias, bool $reemplazar): array
    {
        $semana = $this->normalizarSemana($semana);
        $menu = $this->menus->ensureMenu($usuarioId, $semana);
        $actuales = $this->menus->items((int) $menu['id']);
        $ocupados = [];

        foreach ($actuales as $item) {
            if ($item['tipo'] === 'receta') {
                $ocupados[$item['dia'] . '|' . $item['momento']] = true;
            }
        }

        if ($reemplazar) {
            $this->menus->clear((int) $menu['id']);
            $ocupados = [];
        }

        $items = [];
        $usados = [];
        $ordenes = [];

        foreach (array_slice($sugerencias, 0, 100) as $sugerencia) {
            if (!is_array($sugerencia)) {
                continue;
            }

            try {
                $dia = $this->dia($sugerencia['dia'] ?? null);
                $momento = $this->momento($sugerencia['momento'] ?? null);

                if (!in_array($momento, ['desayuno', 'comida', 'cena'], true)) {
                    continue;
                }

                $slug = trim((string) ($sugerencia['slug'] ?? ''));
                $receta = $slug === '' ? null : $this->recetas->findPublicBySlug($slug);

                if ($receta === null) {
                    continue;
                }

                $clave = $dia . '|' . $momento;

                if (isset($ocupados[$clave]) || isset($usados[$clave])) {
                    continue;
                }

                $usados[$clave] = true;

                if (!isset($ordenes[$clave])) {
                    $ordenes[$clave] = 0;
                }

                $items[] = [
                    'dia' => $dia,
                    'momento' => $momento,
                    'tipo' => 'receta',
                    'etiqueta' => null,
                    'receta_id' => (int) $receta['id'],
                    'nombre_snapshot' => (string) $receta['nombre'],
                    'porciones' => $this->porciones(
                        $sugerencia['porciones'] ?? null,
                        (int) ($receta['porciones_base'] ?? 4)
                    ),
                    'orden' => $ordenes[$clave]++,
                    'nota' => null,
                ];
            } catch (InvalidArgumentException) {
                continue;
            }
        }

        if ($items === []) {
            throw new InvalidArgumentException('No hay sugerencias válidas para aplicar.');
        }

        $disponibles = max(0, self::MAX_ITEMS - $this->menus->countItems((int) $menu['id']));

        if ($disponibles === 0) {
            throw new InvalidArgumentException('El menú de la semana ya llegó a su límite de platillos.');
        }

        $this->menus->addMany((int) $menu['id'], array_slice($items, 0, $disponibles));

        return $this->obtener($usuarioId, $semana);
    }

    /**
     * @param array<int, string> $excluir Claves de ingredientes que no se quieren comprar.
     * @return array<string, mixed>
     */
    public function previewLista(int $usuarioId, ?string $semana, array $excluir = []): array
    {
        $semana = $this->normalizarSemana($semana);
        $menu = $this->menus->findMenu($usuarioId, $semana);
        $items = $menu === null ? [] : $this->menus->items((int) $menu['id']);
        $seleccion = [];

        foreach ($items as $item) {
            $receta = $item['receta'];

            if (
                $item['tipo'] === 'receta'
                && $receta !== null
                && ($receta['estado'] ?? '') === 'publicada'
            ) {
                $seleccion[] = [
                    'slug' => (string) $receta['slug'],
                    'porciones' => (int) $item['porciones'],
                ];
            }
        }

        if (count($seleccion) > RecetaService::MAX_RECETAS_PREVIEW) {
            throw new InvalidArgumentException(
                'La semana tiene demasiadas recetas para calcular la lista. Quita algunas e inténtalo de nuevo.'
            );
        }

        $preview = $this->recetario->previewLista($usuarioId, $seleccion);
        $excluidas = [];

        foreach ($excluir as $clave) {
            if (is_string($clave) && $clave !== '') {
                $excluidas[$clave] = true;
            }
        }

        $itemsPreview = array_values(array_filter(
            $preview['items'],
            static fn (array $item): bool => !isset($excluidas[(string) ($item['clave'] ?? '')])
        ));

        $costo = $this->precios->costoItems($usuarioId, $itemsPreview);

        foreach ($itemsPreview as $indice => &$item) {
            $detalle = $costo['items'][$indice] ?? null;
            $item['costo'] = $detalle['costo'] ?? null;
            $item['faltante'] = $detalle['faltante'] ?? false;
            $item['motivo'] = $detalle['motivo'] ?? null;
        }

        unset($item);

        return [
            'semana' => $semana,
            'items' => $itemsPreview,
            'recetas' => $preview['recetas'],
            'total' => count($itemsPreview),
            'costo' => $costo,
        ];
    }

    /**
     * @param array<string, mixed> $data
     * @return array<string, mixed>|null null si la lista indicada no es del usuario.
     */
    public function crearLista(int $usuarioId, array $data): ?array
    {
        $semana = $this->normalizarSemana(isset($data['semana']) ? (string) $data['semana'] : null);
        $excluir = isset($data['excluir']) && is_array($data['excluir']) ? $data['excluir'] : [];
        $preview = $this->previewLista($usuarioId, $semana, $excluir);

        if ($preview['items'] === []) {
            throw new InvalidArgumentException('El menú no tiene ingredientes para agregar a la lista.');
        }

        $listaId = isset($data['lista_id']) && is_numeric($data['lista_id'])
            ? (int) $data['lista_id']
            : 0;

        if ($listaId > 0) {
            $existente = $this->listas->items($usuarioId, $listaId);

            if ($existente === null) {
                return null;
            }

            $lista = $existente['lista'];
        } else {
            $nombre = trim((string) ($data['nombre'] ?? ''));

            if ($nombre === '') {
                $nombre = 'Menú ' . $semana;
            }

            $lista = $this->listas->crearLista($usuarioId, ['nombre' => $nombre]);
        }

        $origen = mb_substr('Menú semanal ' . $semana, 0, 255);
        $productos = [];

        foreach ($preview['items'] as $item) {
            $productos[] = [
                'producto_id' => $item['producto_id'] ?? null,
                'nombre' => (string) ($item['nombre'] ?? ''),
                'cantidad' => (float) ($item['cantidad'] ?? 0),
                'unidad_base' => (string) ($item['unidad_base'] ?? ''),
                'origen' => $origen,
            ];
        }

        foreach (array_chunk($productos, ListaCompraService::MAX_ITEMS) as $parte) {
            $this->listas->agregarItems($usuarioId, (int) $lista['id'], ['items' => $parte]);
        }

        return [
            'lista' => $lista,
            'agregados' => count($productos),
            'semana' => $semana,
        ];
    }

    private function dia(mixed $valor): int
    {
        if (!is_numeric($valor)) {
            throw new InvalidArgumentException('El día no es válido.');
        }

        $dia = (int) $valor;

        if ($dia < 1 || $dia > 7) {
            throw new InvalidArgumentException('El día debe estar entre lunes y domingo.');
        }

        return $dia;
    }

    private function momento(mixed $valor): string
    {
        $momento = is_string($valor) ? trim($valor) : '';

        if (!in_array($momento, self::MOMENTOS, true)) {
            throw new InvalidArgumentException('El tiempo de comida no es válido.');
        }

        return $momento;
    }

    private function etiqueta(mixed $valor, string $momento): ?string
    {
        if (!is_string($valor)) {
            return null;
        }

        $texto = trim($valor);

        if ($texto === '') {
            return null;
        }

        if (mb_strlen($texto) > 30) {
            throw new InvalidArgumentException('La etiqueta no puede superar 30 caracteres.');
        }

        if (!in_array($momento, ['colacion', 'otro'], true)) {
            throw new InvalidArgumentException('La etiqueta solo se usa en tiempos extra.');
        }

        return $texto;
    }

    private function textoOpcional(mixed $valor, int $limite, string $campo): ?string
    {
        if ($valor === null || $valor === '') {
            return null;
        }

        if (!is_string($valor)) {
            throw new InvalidArgumentException($campo . ' no es válida.');
        }

        $texto = trim($valor);

        if ($texto === '') {
            return null;
        }

        if (mb_strlen($texto) > $limite) {
            throw new InvalidArgumentException($campo . ' no puede superar ' . $limite . ' caracteres.');
        }

        return $texto;
    }

    private function porciones(mixed $valor, int $defecto): int
    {
        if ($valor === null || $valor === '') {
            return max(1, min(50, $defecto));
        }

        if (!is_numeric($valor)) {
            throw new InvalidArgumentException('Las porciones no son válidas.');
        }

        return max(1, min(50, (int) $valor));
    }
}
