<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Ticket;
use App\Repositories\ProductoRepository;
use App\Repositories\TicketRepository;
use DomainException;
use Throwable;

/**
 * Subida, OCR, revisión y confirmación de tickets de compra.
 *
 * La imagen se guarda en public/uploads/tickets. El OCR propone artículos,
 * pero la compra solo se crea cuando el usuario confirma la revisión.
 */
final class TicketService
{
    public const MAX_POR_HORA = 20;

    public const MAX_BYTES = 8 * 1024 * 1024;

    private const MAX_SIDE = 9000;

    private const UPLOAD_DIR = '/public/uploads/tickets';
    private const UPLOAD_URL = '/uploads/tickets';

    /** @var array<string, string> */
    private const MIME_EXT = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
    ];

    private readonly TicketRepository $tickets;

    private readonly CompraService $compras;

    private readonly TicketOcrService $ocr;

    private readonly TicketParserService $parser;

    private readonly ProductoMatcherService $matcher;

    private readonly ProductoRepository $productos;

    private readonly TicketImagePreprocessor $preprocesador;

    public function __construct(
        ?TicketRepository $tickets = null,
        ?CompraService $compras = null,
        ?TicketOcrService $ocr = null,
        ?TicketParserService $parser = null,
        ?ProductoMatcherService $matcher = null,
        ?ProductoRepository $productos = null,
        ?TicketImagePreprocessor $preprocesador = null
    ) {
        $this->tickets = $tickets ?? new TicketRepository();
        $this->compras = $compras ?? new CompraService();
        $this->ocr = $ocr ?? new TicketOcrService();
        $this->parser = $parser ?? new TicketParserService();
        $this->matcher = $matcher ?? new ProductoMatcherService();
        $this->productos = $productos ?? new ProductoRepository();
        $this->preprocesador = $preprocesador ?? new TicketImagePreprocessor();
    }

    /**
     * Sube la imagen, ejecuta OCR y devuelve la propuesta editable.
     *
     * @param array<string, mixed> $file Entrada de $_FILES['foto'].
     * @return array<string, mixed>
     */
    public function procesar(int $usuarioId, array $file, ?string $titulo = null): array
    {
        if ($this->tickets->countRecent($usuarioId, 3600) >= self::MAX_POR_HORA) {
            throw new DomainException(
                'Has subido demasiados tickets en la última hora. Inténtalo más tarde.',
                429
            );
        }

        $extension = $this->validarArchivo($file);
        $directorio = $this->uploadPath();

        if (!is_dir($directorio) && !mkdir($directorio, 0775, true) && !is_dir($directorio)) {
            throw new DomainException('No se pudo preparar la carpeta de tickets.', 500);
        }

        $nombre = sprintf('t%d-%s.%s', $usuarioId, bin2hex(random_bytes(8)), $extension);
        $destino = $directorio . '/' . $nombre;

        if (!move_uploaded_file((string) $file['tmp_name'], $destino)) {
            throw new DomainException('No se pudo guardar la imagen del ticket.', 500);
        }

        $ticketCreado = null;
        $procesado = $this->preprocesador->preparar($destino);
        $archivoOcr = $procesado ?? $destino;

        try {
            // Modo principal: Tesseract en TSV para conocer la posición de la
            // columna de precios y delimitar el bloque de artículos.
            $estructura = $this->ocr->extraerEstructura($archivoOcr, 6);
            $texto = $estructura['texto'];
            $propuesta = $this->parser->parsearEstructura($estructura);

            // El parser de texto endurecido suele ayudar cuando el layout
            // quedó partido por el OCR.
            $propuestaTexto = $this->parser->parsear($texto);

            if ($this->puntuarPropuesta($propuestaTexto) > $this->puntuarPropuesta($propuesta)) {
                $propuesta = $propuestaTexto;
            }

            // Segundo intento con segmentación por columnas si no hubo nada.
            if ($propuesta['items'] === []) {
                $alternativaEstructura = $this->ocr->extraerEstructura($archivoOcr, 4);
                $alternativa = $this->parser->parsearEstructura($alternativaEstructura);
                $alternativaTexto = $this->parser->parsear($alternativaEstructura['texto']);

                if ($this->puntuarPropuesta($alternativaTexto) > $this->puntuarPropuesta($alternativa)) {
                    $alternativa = $alternativaTexto;
                }

                if ($this->puntuarPropuesta($alternativa) > $this->puntuarPropuesta($propuesta)) {
                    $texto = $alternativaEstructura['texto'];
                    $propuesta = $alternativa;
                }
            }

            $totalDetectado = $propuesta['total'] === null
                ? null
                : number_format((float) $propuesta['total'], 2, '.', '');

            $tituloSugerido = $this->parser->sugerirTitulo($texto, $propuesta['fecha']);
            $tituloFinal = $this->tituloValido($titulo) ?? $tituloSugerido;

            $ticket = $this->tickets->create(
                $usuarioId,
                $tituloFinal,
                self::UPLOAD_URL . '/' . $nombre,
                $texto,
                $totalDetectado
            );
            $ticketCreado = $ticket;
            $catalogo = $this->productos->activosParaMatch($usuarioId);
            $items = [];

            foreach ($propuesta['items'] as $item) {
                $coincidencia = $this->matcher->coincidir(
                    (string) $item['nombre'],
                    $catalogo,
                    (float) $item['cantidad'],
                    $item['medida'] ?? null,
                    (bool) ($item['cantidad_explicita'] ?? false)
                );

                $items[] = [
                    'nombre' => $item['nombre'],
                    'cantidad' => $coincidencia['cantidad'],
                    'precio_total' => round((float) $item['precio_total'], 2),
                    'producto_id' => $coincidencia['producto_id'],
                    'producto_nombre' => $coincidencia['producto_nombre'],
                    'unidad_base' => $coincidencia['unidad_base'],
                    'confianza' => $coincidencia['confianza'],
                ];
            }

            $suma = 0.0;

            foreach ($items as $item) {
                $suma += (float) $item['precio_total'];
            }

            return [
                'ticket' => $ticket->toArray(),
                'titulo' => $ticket->titulo,
                'fecha' => $propuesta['fecha'] ?? (new \DateTimeImmutable('today'))->format('Y-m-d'),
                'total_detectado' => $propuesta['total'],
                'total_suma' => round($suma, 2),
                'items' => $items,
                'productos' => $catalogo,
                'texto' => $texto,
            ];
        } catch (Throwable $error) {
            @unlink($destino);

            if ($ticketCreado !== null) {
                $this->tickets->delete($ticketCreado->id, $usuarioId);
            }

            throw $error;
        } finally {
            if ($procesado !== null) {
                @unlink($procesado);
            }
        }
    }

    /**
     * @param array<string, mixed> $data
     * @return array<string, string>
     */
    public function validarConfirmacion(int $usuarioId, array $data): array
    {
        // Los ítems libres de un ticket no piden unidad al usuario porque el
        // esquema de compra_items no la persiste. Se usa 'pza' solo para
        // satisfacer la validación compartida con la captura manual.
        if (isset($data['items']) && is_array($data['items'])) {
            foreach ($data['items'] as $index => $item) {
                if (!is_array($item)) {
                    continue;
                }

                $productoId = $item['producto_id'] ?? null;
                $tieneLibre = is_string($item['nombre_libre'] ?? null)
                    && trim((string) $item['nombre_libre']) !== '';

                if (($productoId === null || $productoId === '') && $tieneLibre) {
                    if (empty($item['unidad_base'])) {
                        $data['items'][$index]['unidad_base'] = 'pza';
                    }
                }
            }
        }

        $errors = $this->compras->validarCreacion($data, $usuarioId);

        if (isset($data['titulo']) && is_string($data['titulo']) && trim($data['titulo']) !== '') {
            $titulo = trim($data['titulo']);
            $longitud = mb_strlen($titulo, 'UTF-8');

            if ($longitud < 2 || $longitud > 150) {
                $errors['titulo'] = 'El nombre del ticket debe tener entre 2 y 150 caracteres.';
            }
        }

        return $errors;
    }

    /**
     * @param array<string, mixed> $data Ya validado.
     * @return array{id: int, fecha: string, total: float, items_count: int, ticket_id: int|null}
     */
    public function confirmar(int $usuarioId, int $ticketId, array $data): array
    {
        $ticket = $this->tickets->findOwned($ticketId, $usuarioId);

        if ($ticket === null) {
            throw new DomainException('El ticket no existe.', 404);
        }

        if ($ticket->estado !== 'procesado' || $ticket->compraId !== null) {
            throw new DomainException('Este ticket ya fue confirmado.', 409);
        }

        $titulo = isset($data['titulo']) && is_string($data['titulo'])
            ? $this->tituloValido($data['titulo'])
            : null;

        return $this->compras->crearDesdeTicket($usuarioId, $data, $ticketId, $titulo);
    }

    public function obtener(int $usuarioId, int $ticketId): ?Ticket
    {
        return $this->tickets->findOwned($ticketId, $usuarioId);
    }

    /**
     * Descarta un ticket que todavía no generó una compra.
     */
    public function descartar(int $usuarioId, int $ticketId): bool
    {
        $ticket = $this->tickets->findOwned($ticketId, $usuarioId);

        if ($ticket === null || $ticket->estado !== 'procesado' || $ticket->compraId !== null) {
            return false;
        }

        if (!$this->tickets->delete($ticketId, $usuarioId)) {
            return false;
        }

        $archivo = $this->rutaAbsoluta($ticket->ruta);

        if ($archivo !== null) {
            @unlink($archivo);
        }

        return true;
    }

    /**
     * Ruta absoluta de la foto de un ticket, solo si pertenece a /uploads/tickets.
     */
    public function rutaAbsoluta(string $ruta): ?string
    {
        if (!str_starts_with($ruta, self::UPLOAD_URL . '/')) {
            return null;
        }

        $archivo = $this->uploadPath() . '/' . basename($ruta);

        return is_file($archivo) ? $archivo : null;
    }

    /**
     * Borra del disco las fotos de todos los tickets de un usuario.
     * Se llama antes de eliminar la cuenta.
     */
    public function eliminarArchivosDeUsuario(int $usuarioId): void
    {
        foreach ($this->tickets->rutasDeUsuario($usuarioId) as $ruta) {
            $archivo = $this->rutaAbsoluta($ruta);

            if ($archivo !== null) {
                @unlink($archivo);
            }
        }
    }

    /**
     * Puntúa una propuesta para elegir entre dos lecturas del mismo ticket.
     * Prioriza tener artículos y que la suma cuadre con el total detectado.
     *
     * @param array<string, mixed> $propuesta
     */
    private function puntuarPropuesta(array $propuesta): float
    {
        $items = is_array($propuesta['items'] ?? null) ? count($propuesta['items']) : 0;
        $puntaje = $items * 10.0;

        if ($items > 0 && ($propuesta['total'] ?? null) !== null) {
            $diferencia = abs((float) $propuesta['total'] - (float) ($propuesta['total_suma'] ?? 0));
            $puntaje += max(0.0, 5.0 - $diferencia);

            if ($diferencia <= 0.05) {
                $puntaje += 5.0;
            }
        }

        return $puntaje;
    }

    private function tituloValido(?string $titulo): ?string
    {
        if ($titulo === null) {
            return null;
        }

        $titulo = trim($titulo);
        $longitud = mb_strlen($titulo, 'UTF-8');

        if ($longitud < 2 || $longitud > 150) {
            return null;
        }

        return $titulo;
    }

    /**
     * @param array<string, mixed> $file
     */
    private function validarArchivo(array $file): string
    {
        $error = (int) ($file['error'] ?? UPLOAD_ERR_NO_FILE);

        if ($error === UPLOAD_ERR_NO_FILE) {
            throw new DomainException('Selecciona una foto del ticket.', 422);
        }

        if (in_array($error, [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true)) {
            throw new DomainException('La imagen puede pesar como máximo 8 MB.', 422);
        }

        if ($error !== UPLOAD_ERR_OK) {
            throw new DomainException('No se pudo recibir la imagen. Inténtalo de nuevo.', 422);
        }

        $tmp = $file['tmp_name'] ?? null;

        if (!is_string($tmp) || $tmp === '' || !is_uploaded_file($tmp)) {
            throw new DomainException('No se pudo recibir la imagen. Inténtalo de nuevo.', 422);
        }

        $size = (int) ($file['size'] ?? 0);

        if ($size <= 0 || $size > self::MAX_BYTES) {
            throw new DomainException('La imagen puede pesar como máximo 8 MB.', 422);
        }

        $mime = $this->detectMime($tmp);
        $extension = self::MIME_EXT[$mime] ?? null;

        if ($extension === null) {
            throw new DomainException('Formato no permitido. Usa una imagen JPG, PNG o WebP.', 422);
        }

        $dimensiones = @getimagesize($tmp);

        if ($dimensiones === false) {
            throw new DomainException('El archivo no parece una imagen válida.', 422);
        }

        if ($dimensiones[0] > self::MAX_SIDE || $dimensiones[1] > self::MAX_SIDE) {
            throw new DomainException('La imagen es demasiado grande. Máximo 9000 px por lado.', 422);
        }

        return $extension;
    }

    private function detectMime(string $tmp): string
    {
        $finfo = finfo_open(FILEINFO_MIME_TYPE);

        if ($finfo === false) {
            return '';
        }

        $mime = finfo_file($finfo, $tmp);
        finfo_close($finfo);

        return is_string($mime) ? strtolower($mime) : '';
    }

    private function uploadPath(): string
    {
        return $this->basePath() . self::UPLOAD_DIR;
    }

    private function basePath(): string
    {
        if (defined('BASE_PATH')) {
            return (string) BASE_PATH;
        }

        return dirname(__DIR__, 2);
    }
}
