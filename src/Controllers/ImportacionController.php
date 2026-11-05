<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Middleware\AdminMiddleware;
use App\Middleware\CsrfMiddleware;
use App\Repositories\LoteRecetaRepository;
use App\Services\RecetaService;
use App\Support\Response;

/**
 * Importación de recetas desde libros (Chef).
 */
final class ImportacionController
{
    private readonly LoteRecetaRepository $lotes;
    private readonly RecetaService $recetas;

    public function __construct(
        ?LoteRecetaRepository $lotes = null,
        ?RecetaService $recetas = null
    ) {
        $this->lotes = $lotes ?? new LoteRecetaRepository();
        $this->recetas = $recetas ?? new RecetaService();
    }

    /**
     * POST /api/chef/lotes
     */
    public function guardarLote(): void
    {
        $usuario = AdminMiddleware::require();
        CsrfMiddleware::enforce();

        $data = $this->jsonBody();
        $recetas = $data['recetas'] ?? null;

        if (!is_array($recetas) || $recetas === []) {
            Response::fail('VALIDATION_ERROR', 'El lote no tiene recetas.', 422);
        }

        if (count($recetas) > 100) {
            Response::fail('VALIDATION_ERROR', 'El lote supera las 100 recetas.', 422);
        }

        $nombre = trim((string) ($data['nombre'] ?? 'Libro sin título'));
        $nombre = $nombre === '' ? 'Libro sin título' : mb_substr($nombre, 0, 150);
        $autor = trim((string) ($data['autor'] ?? ''));
        $archivo = trim((string) ($data['archivo'] ?? ''));

        $loteId = bin2hex(random_bytes(16));
        $this->lotes->crear(
            $loteId,
            $nombre,
            $autor === '' ? null : mb_substr($autor, 0, 150),
            $archivo === '' ? null : mb_substr($archivo, 0, 500),
            (int) $usuario['id']
        );

        $guardadas = 0;
        $errores = [];

        foreach ($recetas as $receta) {
            if (!is_array($receta)) {
                continue;
            }

            $nombreReceta = trim((string) ($receta['nombre'] ?? 'Receta sin título'));

            try {
                $categoria = trim((string) ($receta['categoria'] ?? 'guisados'));

                if ($categoria === '') {
                    $categoria = 'guisados';
                }

                $tipos = $receta['tipos'] ?? ['general'];

                if (!is_array($tipos) || $tipos === []) {
                    $tipos = ['general'];
                }

                $creada = $this->recetas->crearPropuesta((int) $usuario['id'], [
                    'nombre' => $receta['nombre'] ?? '',
                    'descripcion' => $receta['descripcion'] ?? '',
                    'porciones_base' => $receta['porciones_base'] ?? 4,
                    'tiempo_min' => $receta['tiempo_min'] ?? 30,
                    'dificultad' => $receta['dificultad'] ?? 'facil',
                    'categoria' => $categoria,
                    'tipos' => $tipos,
                    'ingredientes' => $receta['ingredientes'] ?? [],
                    'pasos' => $receta['pasos'] ?? [],
                ]);

                $this->lotes->asignar(
                    (int) $creada['id'],
                    $loteId,
                    isset($receta['origen']) && is_string($receta['origen'])
                        ? mb_substr($receta['origen'], 0, 255)
                        : null
                );

                $guardadas++;
            } catch (\InvalidArgumentException $error) {
                $errores[] = [
                    'nombre' => $nombreReceta,
                    'error' => $error->getMessage(),
                ];
            }
        }

        if ($guardadas === 0) {
            $this->lotes->descartar($loteId);

            Response::fail(
                'VALIDATION_ERROR',
                'Ninguna receta del lote se pudo guardar.',
                422,
                ['errores' => $errores]
            );
        }

        Response::ok([
            'lote_id' => $loteId,
            'guardadas' => $guardadas,
            'errores' => $errores,
        ], 201);
    }

    /**
     * POST /api/admin/lotes/{id}/publicar
     */
    public function publicarLote(string $loteId): void
    {
        AdminMiddleware::require();
        CsrfMiddleware::enforce();

        if ($this->lotes->find($loteId) === null) {
            Response::fail('NOT_FOUND', 'El lote no existe.', 404);
        }

        $this->lotes->publicar($loteId);
        Response::ok(['lote_id' => $loteId, 'estado' => 'publicado']);
    }

    /**
     * POST /api/admin/lotes/{id}/descartar
     */
    public function descartarLote(string $loteId): void
    {
        AdminMiddleware::require();
        CsrfMiddleware::enforce();

        if ($this->lotes->find($loteId) === null) {
            Response::fail('NOT_FOUND', 'El lote no existe.', 404);
        }

        $this->lotes->descartar($loteId);
        Response::ok(['lote_id' => $loteId, 'estado' => 'descartado']);
    }

    /**
     * GET /admin/recetas/lotes
     */
    public function vista(): void
    {
        $usuario = AdminMiddleware::usuarioWeb();

        if ($usuario === null) {
            return;
        }

        $lotes = $this->lotes->all();
        header('Content-Type: text/html; charset=utf-8');
        require BASE_PATH . '/src/Views/admin/recetas/lotes.php';
    }

    /**
     * @return array<string, mixed>
     */
    private function jsonBody(): array
    {
        $raw = file_get_contents('php://input');

        if ($raw === false || $raw === '') {
            return [];
        }

        $data = json_decode($raw, true);

        if (!is_array($data)) {
            Response::fail('INVALID_JSON', 'El cuerpo de la petición no es JSON válido.', 400);
        }

        return $data;
    }
}
