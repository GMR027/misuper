<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Middleware\AuthMiddleware;
use App\Middleware\CsrfMiddleware;
use App\Services\NotaService;
use App\Support\Response;
use DomainException;

/**
 * Notas personales: vista web y endpoints CRUD con fotos.
 *
 * Cada nota pertenece al usuario de la sesión. Ni el listado ni las
 * mutaciones permiten tocar notas de otras cuentas.
 */
final class NotaController
{
    private readonly NotaService $notas;

    public function __construct(?NotaService $notas = null)
    {
        $this->notas = $notas ?? new NotaService();
    }

    /**
     * GET /notas — pantalla de notas.
     */
    public function vista(): void
    {
        $usuario = $this->usuarioWeb();

        if ($usuario === null) {
            return;
        }

        header('Content-Type: text/html; charset=utf-8');
        require BASE_PATH . '/src/Views/usuario/notas.php';
    }

    /**
     * GET /api/notas
     */
    public function index(): void
    {
        $usuario = AuthMiddleware::require();
        $notas = $this->notas->listar($usuario['id']);

        Response::ok([
            'items' => array_map(static fn ($nota): array => $nota->toArray(), $notas),
            'total' => count($notas),
        ]);
    }

    /**
     * POST /api/notas
     */
    public function store(): void
    {
        $usuario = AuthMiddleware::require();
        CsrfMiddleware::enforce();

        $data = $this->jsonBody();
        $errors = $this->notas->validar($data);

        if ($errors !== []) {
            Response::fail('VALIDATION_ERROR', 'Revisa los datos enviados.', 422, $errors);
        }

        Response::ok($this->notas->crear($usuario['id'], $data)->toArray(), 201);
    }

    /**
     * PUT /api/notas/{id}
     */
    public function update(int $id): void
    {
        $usuario = AuthMiddleware::require();
        CsrfMiddleware::enforce();

        $data = $this->jsonBody();
        $errors = $this->notas->validar($data);

        if ($errors !== []) {
            Response::fail('VALIDATION_ERROR', 'Revisa los datos enviados.', 422, $errors);
        }

        $nota = $this->notas->actualizar($usuario['id'], $id, $data);

        if ($nota === null) {
            Response::fail('NOT_FOUND', 'Nota no encontrada.', 404);
        }

        Response::ok($nota->toArray());
    }

    /**
     * DELETE /api/notas/{id}
     */
    public function destroy(int $id): void
    {
        $usuario = AuthMiddleware::require();
        CsrfMiddleware::enforce();

        if (!$this->notas->eliminar($usuario['id'], $id)) {
            Response::fail('NOT_FOUND', 'Nota no encontrada.', 404);
        }

        Response::ok(['deleted' => true]);
    }

    /**
     * POST /api/notas/{id}/fotos — adjunta una foto (multipart, campo "foto").
     */
    public function storeFoto(int $id): void
    {
        $usuario = AuthMiddleware::require();
        CsrfMiddleware::enforce();

        try {
            $foto = $this->notas->agregarFoto(
                $usuario['id'],
                $id,
                is_array($_FILES['foto'] ?? null) ? $_FILES['foto'] : []
            );
        } catch (DomainException $error) {
            Response::fail('FOTO_INVALID', $error->getMessage(), 422);
        }

        Response::ok($foto, 201);
    }

    /**
     * DELETE /api/notas/{id}/fotos/{fotoId}
     */
    public function destroyFoto(int $id, int $fotoId): void
    {
        $usuario = AuthMiddleware::require();
        CsrfMiddleware::enforce();

        if (!$this->notas->eliminarFoto($usuario['id'], $id, $fotoId)) {
            Response::fail('NOT_FOUND', 'Foto no encontrada.', 404);
        }

        Response::ok(['deleted' => true]);
    }

    /**
     * @return array{id: int, nombre: string, email: string, rol: string, debe_cambiar_password: bool}|null
     */
    private function usuarioWeb(): ?array
    {
        $usuario = AuthMiddleware::usuario();

        if ($usuario === null) {
            header('Location: /login', true, 302);

            return null;
        }

        if (($usuario['debe_cambiar_password'] ?? false) === true) {
            header('Location: /cambiar-password-forzado', true, 302);

            return null;
        }

        return $usuario;
    }

    /**
     * Cuerpo JSON de la petición. 400 si el JSON es inválido.
     *
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
