<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Middleware\AuthMiddleware;
use App\Middleware\CsrfMiddleware;
use App\Services\TicketService;
use App\Support\Response;
use App\Validators\CompraValidator;
use DomainException;

/**
 * Pantalla y endpoints de tickets de compra.
 *
 * La subida y el OCR son síncronos: la respuesta incluye la propuesta de
 * artículos para que el usuario la revise antes de crear la compra.
 */
final class TicketController
{
    private readonly TicketService $tickets;

    public function __construct(?TicketService $tickets = null)
    {
        $this->tickets = $tickets ?? new TicketService();
    }

    /**
     * GET /ticket — pantalla de carga y revisión.
     */
    public function vista(): void
    {
        $usuario = $this->usuarioWeb();

        if ($usuario === null) {
            return;
        }

        header('Content-Type: text/html; charset=utf-8');
        require BASE_PATH . '/src/Views/usuario/ticket.php';
    }

    /**
     * POST /api/tickets — multipart, campo "foto".
     */
    public function store(): void
    {
        $usuario = AuthMiddleware::require();
        CsrfMiddleware::enforce();

        // El OCR puede tardar más que una petición normal.
        @set_time_limit(120);

        $clienteUuid = isset($_POST['cliente_uuid']) && is_string($_POST['cliente_uuid'])
            ? trim($_POST['cliente_uuid'])
            : '';
        $uuidError = CompraValidator::validarClienteUuid(
            $clienteUuid === '' ? null : $clienteUuid
        );

        if ($uuidError !== null) {
            Response::fail(
                'VALIDATION_ERROR',
                'Revisa los datos enviados.',
                422,
                ['cliente_uuid' => $uuidError]
            );
        }

        try {
            $data = $this->tickets->procesar(
                $usuario['id'],
                is_array($_FILES['foto'] ?? null) ? $_FILES['foto'] : [],
                isset($_POST['titulo']) && is_string($_POST['titulo']) ? $_POST['titulo'] : null,
                $clienteUuid === '' ? null : $clienteUuid
            );
        } catch (DomainException $error) {
            $this->responderError($error);
        }

        Response::ok($data, 201);
    }

    /**
     * POST /api/tickets/{id}/confirm
     */
    public function confirmar(int $id): void
    {
        $usuario = AuthMiddleware::require();
        CsrfMiddleware::enforce();

        $data = $this->jsonBody();
        $errors = $this->tickets->validarConfirmacion($usuario['id'], $data);

        if ($errors !== []) {
            Response::fail('VALIDATION_ERROR', 'Revisa los artículos del ticket.', 422, $errors);
        }

        try {
            $compra = $this->tickets->confirmar($usuario['id'], $id, $data);
        } catch (DomainException $error) {
            $this->responderError($error);
        }

        Response::ok($compra, 201);
    }

    /**
     * DELETE /api/tickets/{id} — descarta un ticket no confirmado.
     */
    public function destroy(int $id): void
    {
        $usuario = AuthMiddleware::require();
        CsrfMiddleware::enforce();

        if (!$this->tickets->descartar($usuario['id'], $id)) {
            Response::fail('NOT_FOUND', 'El ticket no existe o ya fue confirmado.', 404);
        }

        Response::ok(['deleted' => true]);
    }

    /**
     * GET /api/tickets/{id}/foto — imagen original como data URL, para la app.
     */
    public function fotoApi(int $id): void
    {
        $usuario = AuthMiddleware::require();
        $ticket = $this->tickets->obtener($usuario['id'], $id);

        if ($ticket === null) {
            Response::fail('NOT_FOUND', 'Ticket no encontrado.', 404);
        }

        $archivo = $this->tickets->rutaAbsoluta($ticket->ruta);

        if ($archivo === null) {
            Response::fail('NOT_FOUND', 'La imagen del ticket no está disponible.', 404);
        }

        $datos = file_get_contents($archivo);

        if ($datos === false) {
            Response::fail('READ_ERROR', 'No se pudo leer la imagen del ticket.', 500);
        }

        $mime = mime_content_type($archivo);
        $mime = is_string($mime) && str_starts_with($mime, 'image/') ? $mime : 'image/jpeg';

        Response::ok([
            'data_url' => 'data:' . $mime . ';base64,' . base64_encode($datos),
        ]);
    }

    /**
     * GET /ticket/{id}/foto — imagen original, solo para el dueño.
     */
    public function foto(int $id): void
    {
        $usuario = $this->usuarioWeb();

        if ($usuario === null) {
            return;
        }

        $ticket = $this->tickets->obtener($usuario['id'], $id);

        if ($ticket === null) {
            http_response_code(404);
            header('Content-Type: text/plain; charset=utf-8');
            echo "Ticket no encontrado.\n";

            return;
        }

        $archivo = $this->tickets->rutaAbsoluta($ticket->ruta);

        if ($archivo === null) {
            http_response_code(404);
            header('Content-Type: text/plain; charset=utf-8');
            echo "La imagen del ticket no está disponible.\n";

            return;
        }

        $mime = mime_content_type($archivo);
        $tamano = filesize($archivo);

        header('Content-Type: ' . (is_string($mime) ? $mime : 'application/octet-stream'));
        header('Content-Length: ' . (string) ($tamano === false ? 0 : $tamano));
        header('Content-Disposition: inline; filename="ticket-' . $id . '.' . pathinfo($archivo, PATHINFO_EXTENSION) . '"');
        header('Cache-Control: private, max-age=3600');
        header('X-Content-Type-Options: nosniff');

        readfile($archivo);
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

    private function responderError(DomainException $error): never
    {
        $status = (int) $error->getCode();

        if (!in_array($status, [400, 404, 409, 422, 429, 500, 503], true)) {
            $status = 422;
        }

        $codigo = match ($status) {
            404 => 'NOT_FOUND',
            409 => 'TICKET_ALREADY_CONFIRMED',
            429 => 'RATE_LIMITED',
            500 => 'SERVER_ERROR',
            503 => 'OCR_UNAVAILABLE',
            default => 'TICKET_INVALID',
        };

        Response::fail($codigo, $error->getMessage(), $status);
    }
}
