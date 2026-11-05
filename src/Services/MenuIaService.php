<?php

declare(strict_types=1);

namespace App\Services;

use App\Repositories\MenuRepository;
use App\Repositories\RecetaRepository;
use InvalidArgumentException;

/**
 * Preparación y validación de menús sugeridos por IA.
 *
 * El modelo solo puede elegir recetas existentes y llenar huecos válidos. El
 * servidor vuelve a validar todo antes de mostrar o guardar una sugerencia.
 */
final class MenuIaService
{
    private const MODOS = ['completar', 'reemplazar'];

    private const MAX_RESPUESTA = 200_000;

    private readonly MenuRepository $menus;
    private readonly RecetaRepository $recetas;
    private readonly MenuService $menu;

    public function __construct(
        ?MenuRepository $menus = null,
        ?RecetaRepository $recetas = null,
        ?MenuService $menu = null
    ) {
        $this->menus = $menus ?? new MenuRepository();
        $this->recetas = $recetas ?? new RecetaRepository();
        $this->menu = $menu ?? new MenuService();
    }

    /**
     * @param array<string, mixed> $data
     * @return array<string, mixed>
     */
    public function preparar(int $usuarioId, array $data): array
    {
        $semana = $this->menu->normalizarSemana(isset($data['semana']) ? (string) $data['semana'] : null);
        $modo = $this->modo($data['modo'] ?? null);
        $filtros = $this->filtros($data);
        $opciones = $this->opciones($usuarioId, $semana, $modo, $filtros);

        if ($opciones['recetas'] === []) {
            throw new InvalidArgumentException(
                'No hay recetas que cumplan esos filtros. Prueba con menos restricciones.'
            );
        }

        if ($opciones['huecos'] === []) {
            throw new InvalidArgumentException('Ya tienes todos los tiempos de comida ocupados en esta semana.');
        }

        $prompt = $this->prompt($opciones, $modo, $filtros);

        return [
            'semana' => $semana,
            'modo' => $modo,
            'filtros' => $filtros,
            'huecos' => count($opciones['huecos']),
            'recetas' => count($opciones['recetas']),
            'prompt' => $prompt,
        ];
    }

    /**
     * @param array<string, mixed> $data
     * @return array<string, mixed>
     */
    public function validar(int $usuarioId, array $data): array
    {
        $semana = $this->menu->normalizarSemana(isset($data['semana']) ? (string) $data['semana'] : null);
        $modo = $this->modo($data['modo'] ?? null);
        $filtros = $this->filtros(isset($data['filtros']) && is_array($data['filtros']) ? $data['filtros'] : []);
        $respuesta = $data['respuesta'] ?? null;

        if (!is_string($respuesta) || trim($respuesta) === '') {
            throw new InvalidArgumentException('La IA no devolvió una respuesta.');
        }

        if (strlen($respuesta) > self::MAX_RESPUESTA) {
            throw new InvalidArgumentException('La respuesta de la IA es demasiado grande.');
        }

        $opciones = $this->opciones($usuarioId, $semana, $modo, $filtros);
        $json = $this->extraerJson($respuesta);

        if ($json === null) {
            throw new InvalidArgumentException('La IA no devolvió un JSON válido. Inténtalo de nuevo.');
        }

        $entradas = $this->entradas($json);
        $catalogo = [];

        foreach ($opciones['recetas'] as $receta) {
            $catalogo[(string) $receta['slug']] = $receta;
        }

        $huecos = [];

        foreach ($opciones['huecos'] as $hueco) {
            $huecos[$hueco['dia'] . '|' . $hueco['momento']] = true;
        }

        $sugerencias = [];
        $usados = [];
        $vistos = [];
        $motivos = [];

        foreach ($entradas as $entrada) {
            if (!is_array($entrada)) {
                $this->contarMotivo($motivos, 'formato');

                continue;
            }

            $dia = filter_var($entrada['dia'] ?? null, FILTER_VALIDATE_INT);
            $momento = is_string($entrada['momento'] ?? null) ? trim($entrada['momento']) : '';
            $slug = is_string($entrada['slug'] ?? null) ? trim($entrada['slug']) : '';
            $clave = $dia . '|' . $momento;

            if (
                $dia === false
                || $dia < 1
                || $dia > 7
                || !in_array($momento, ['desayuno', 'comida', 'cena'], true)
            ) {
                $this->contarMotivo($motivos, 'dia_momento');

                continue;
            }

            if (!isset($huecos[$clave]) || isset($usados[$clave])) {
                $this->contarMotivo($motivos, 'hueco');

                continue;
            }

            $receta = $catalogo[$slug] ?? null;

            if ($receta === null) {
                $this->contarMotivo($motivos, 'receta');

                continue;
            }

            if ($filtros['evitar_repetir'] && isset($vistos[$slug])) {
                $this->contarMotivo($motivos, 'repetida');

                continue;
            }

            $porciones = filter_var($entrada['porciones'] ?? null, FILTER_VALIDATE_INT);
            $porciones = $porciones === false
                ? $filtros['personas']
                : max(1, min(50, (int) $porciones));

            $usados[$clave] = true;
            $vistos[$slug] = true;
            $sugerencias[] = [
                'dia' => (int) $dia,
                'dia_nombre' => MenuService::DIAS[(int) $dia],
                'momento' => $momento,
                'momento_nombre' => $this->nombreMomento($momento),
                'slug' => (string) $receta['slug'],
                'nombre' => (string) $receta['nombre'],
                'porciones' => $porciones,
                'tiempo_min' => (int) ($receta['tiempo_min'] ?? 0),
                'imagen_url' => $receta['imagen_url'] ?? null,
                'tipos' => array_values($receta['tipos'] ?? []),
            ];
        }

        if ($sugerencias === []) {
            throw new InvalidArgumentException(
                'La IA no propuso ningún platillo válido. Inténtalo de nuevo o ajusta las restricciones.'
            );
        }

        usort(
            $sugerencias,
            static function (array $a, array $b): int {
                $porDia = $a['dia'] <=> $b['dia'];

                if ($porDia !== 0) {
                    return $porDia;
                }

                $orden = ['desayuno' => 0, 'comida' => 1, 'cena' => 2];

                return ($orden[$a['momento']] ?? 9) <=> ($orden[$b['momento']] ?? 9);
            }
        );

        return [
            'semana' => $semana,
            'modo' => $modo,
            'sugerencias' => $sugerencias,
            'descartadas' => array_sum($motivos),
            'motivos' => $motivos,
            'resumen' => [
                'sugerencias' => count($sugerencias),
                'huecos' => count($opciones['huecos']),
                'personas' => $filtros['personas'],
            ],
        ];
    }

    /**
     * @param array<string, mixed> $data
     * @return array<string, mixed>
     */
    public function aplicar(int $usuarioId, array $data): array
    {
        $semana = $this->menu->normalizarSemana(isset($data['semana']) ? (string) $data['semana'] : null);
        $modo = $this->modo($data['modo'] ?? null);
        $sugerencias = $data['sugerencias'] ?? null;

        if (!is_array($sugerencias) || $sugerencias === []) {
            throw new InvalidArgumentException('No hay sugerencias para aplicar.');
        }

        return $this->menu->aplicarSugerencias(
            $usuarioId,
            $semana,
            $sugerencias,
            $modo === 'reemplazar'
        );
    }

    /**
     * @param array<string, mixed> $filtros
     * @return array{recetas: array<int, array<string, mixed>>, huecos: array<int, array{dia: int, momento: string}>, filtros: array<string, mixed>}
     */
    private function opciones(int $usuarioId, string $semana, string $modo, array $filtros): array
    {
        $favoritos = $filtros['favoritas'] ? array_flip($this->recetas->favoritos($usuarioId)) : [];
        $recetas = [];

        foreach ($this->recetas->allPublic() as $receta) {
            if ($filtros['tiempo'] > 0 && (int) ($receta['tiempo_min'] ?? 0) > $filtros['tiempo']) {
                continue;
            }

            if ($filtros['favoritas'] && !isset($favoritos[(int) $receta['id']])) {
                continue;
            }

            $recetas[] = $receta;
        }

        $menu = $this->menus->findMenu($usuarioId, $semana);
        $items = $menu === null ? [] : $this->menus->items((int) $menu['id']);
        $ocupados = [];

        foreach ($items as $item) {
            if ($item['tipo'] === 'receta') {
                $ocupados[$item['dia'] . '|' . $item['momento']] = true;
            }
        }

        $huecos = [];

        if ($modo === 'reemplazar') {
            foreach (MenuService::DIAS as $dia => $_) {
                foreach (['desayuno', 'comida', 'cena'] as $momento) {
                    $huecos[] = ['dia' => $dia, 'momento' => $momento];
                }
            }
        } else {
            foreach (MenuService::DIAS as $dia => $_) {
                foreach (['desayuno', 'comida', 'cena'] as $momento) {
                    if (!isset($ocupados[$dia . '|' . $momento])) {
                        $huecos[] = ['dia' => $dia, 'momento' => $momento];
                    }
                }
            }
        }

        return [
            'recetas' => $recetas,
            'huecos' => $huecos,
            'filtros' => $filtros,
        ];
    }

    /**
     * @param array{recetas: array<int, array<string, mixed>>, huecos: array<int, array{dia: int, momento: string}>, filtros: array<string, mixed>} $opciones
     * @param array<string, mixed> $filtros
     */
    private function prompt(array $opciones, string $modo, array $filtros): string
    {
        $lineas = [
            'Eres un asistente que organiza un menú semanal casero.',
            'Devuelve SOLO un objeto JSON válido, sin markdown, sin explicaciones y sin texto adicional.',
            'Usa únicamente los slugs del catálogo. No inventes recetas, ingredientes ni precios.',
            'Formato exacto: {"comidas":[{"dia":1,"momento":"desayuno","slug":"slug-de-receta","porciones":4}]}',
            'dia debe ser 1 (lunes) a 7 (domingo). momento debe ser desayuno, comida o cena.',
            'Cada combinación de día y momento debe aparecer una sola vez.',
            'Las porciones deben ser un número entero entre 1 y 50.',
            $modo === 'reemplazar'
                ? 'Llena todos los huecos indicados; se reemplazará el menú actual.'
                : 'Llena únicamente los huecos indicados; no toques los tiempos que ya tienen platillo.',
            'Porciones sugeridas por platillo: ' . $filtros['personas'] . '.',
            $filtros['evitar_repetir']
                ? 'No repitas la misma receta en la semana.'
                : 'Puedes repetir recetas si hace falta.',
            'Si no hay suficientes recetas para todos los huecos, usa las que haya; no inventes slugs.',
            '',
            'CATÁLOGO:',
        ];

        foreach ($opciones['recetas'] as $receta) {
            $tipos = implode(',', array_values(array_filter(
                $receta['tipos'] ?? [],
                'is_string'
            )));
            $lineas[] = sprintf(
                '- %s | %s | %d min | %d porciones base | %s',
                (string) $receta['slug'],
                (string) $receta['nombre'],
                (int) ($receta['tiempo_min'] ?? 0),
                (int) ($receta['porciones_base'] ?? 4),
                $tipos === '' ? 'general' : $tipos
            );
        }

        $lineas[] = '';
        $lineas[] = 'HUECOS A LLENAR:';

        foreach ($opciones['huecos'] as $hueco) {
            $lineas[] = sprintf(
                '- dia %d (%s), %s',
                $hueco['dia'],
                MenuService::DIAS[$hueco['dia']],
                $hueco['momento']
            );
        }

        return implode("\n", $lineas);
    }

    /**
     * @param array<string, mixed> $data
     * @return array<string, mixed>
     */
    private function filtros(array $data): array
    {
        $personas = filter_var($data['personas'] ?? 4, FILTER_VALIDATE_INT);
        $tiempo = filter_var($data['tiempo'] ?? 0, FILTER_VALIDATE_INT);

        return [
            'personas' => $personas === false ? 4 : max(1, min(12, (int) $personas)),
            'tiempo' => $tiempo === false ? 0 : max(0, min(180, (int) $tiempo)),
            'favoritas' => filter_var($data['favoritas'] ?? false, FILTER_VALIDATE_BOOL),
            'evitar_repetir' => filter_var($data['evitar_repetir'] ?? true, FILTER_VALIDATE_BOOL),
        ];
    }

    private function modo(mixed $valor): string
    {
        $modo = is_string($valor) ? trim($valor) : 'completar';

        if (!in_array($modo, self::MODOS, true)) {
            throw new InvalidArgumentException('El modo de generación no es válido.');
        }

        return $modo;
    }

    /**
     * @return array<string, mixed>|null
     */
    private function extraerJson(string $texto): ?array
    {
        $texto = trim($texto);

        if (preg_match('/```(?:json)?\s*(.*?)```/is', $texto, $coincidencia) === 1) {
            $texto = trim($coincidencia[1]);
        }

        $inicio = strpos($texto, '{');
        $fin = strrpos($texto, '}');

        if ($inicio === false || $fin === false || $fin <= $inicio) {
            return null;
        }

        $json = json_decode(substr($texto, $inicio, $fin - $inicio + 1), true);

        return is_array($json) ? $json : null;
    }

    /**
     * @param array<string, mixed> $json
     * @return array<int, mixed>
     */
    private function entradas(array $json): array
    {
        if (isset($json['comidas']) && is_array($json['comidas'])) {
            return array_values($json['comidas']);
        }

        return array_is_list($json) ? $json : [];
    }

    /**
     * @param array<string, int> $motivos
     */
    private function contarMotivo(array &$motivos, string $motivo): void
    {
        $motivos[$motivo] = ($motivos[$motivo] ?? 0) + 1;
    }

    private function nombreMomento(string $momento): string
    {
        return match ($momento) {
            'desayuno' => 'Desayuno',
            'comida' => 'Comida',
            'cena' => 'Cena',
            default => $momento,
        };
    }
}
