<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Nota;
use App\Repositories\NotaRepository;
use App\Validators\NotaValidator;
use DomainException;
use Throwable;

/**
 * Reglas de negocio de las notas personales y sus fotos.
 *
 * Cada usuario solo ve y modifica sus propias notas. Las fotos se guardan en
 * public/uploads/notas con un nombre aleatorio y se borran al eliminar la
 * nota, la foto o la cuenta.
 */
final class NotaService
{
    public const MAX_FOTOS = 8;

    private const MAX_BYTES = 2 * 1024 * 1024;
    private const MAX_SIDE = 6000;
    private const UPLOAD_DIR = '/public/uploads/notas';
    private const UPLOAD_URL = '/uploads/notas';

    /** @var array<string, string> */
    private const MIME_EXT = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
    ];

    private readonly NotaRepository $notas;

    public function __construct(?NotaRepository $notas = null)
    {
        $this->notas = $notas ?? new NotaRepository();
    }

    /**
     * @return array<int, Nota>
     */
    public function listar(int $usuarioId): array
    {
        return $this->notas->listarPorUsuario($usuarioId);
    }

    public function obtener(int $usuarioId, int $notaId): ?Nota
    {
        return $this->notas->findByIdDeUsuario($notaId, $usuarioId);
    }

    /**
     * @param array<string, mixed> $data
     * @return array<string, string>
     */
    public function validar(array $data): array
    {
        return NotaValidator::datos($data);
    }

    /**
     * @param array<string, mixed> $data Ya validado.
     */
    public function crear(int $usuarioId, array $data): Nota
    {
        return $this->notas->create(
            $usuarioId,
            trim((string) $data['titulo']),
            trim((string) ($data['contenido'] ?? ''))
        );
    }

    /**
     * @param array<string, mixed> $data Ya validado.
     */
    public function actualizar(int $usuarioId, int $notaId, array $data): ?Nota
    {
        if ($this->notas->findByIdDeUsuario($notaId, $usuarioId) === null) {
            return null;
        }

        $this->notas->update(
            $notaId,
            trim((string) $data['titulo']),
            trim((string) ($data['contenido'] ?? ''))
        );

        return $this->notas->findByIdDeUsuario($notaId, $usuarioId);
    }

    /**
     * Borra la nota y los archivos de sus fotos.
     */
    public function eliminar(int $usuarioId, int $notaId): bool
    {
        $nota = $this->notas->findByIdDeUsuario($notaId, $usuarioId);

        if ($nota === null) {
            return false;
        }

        $this->notas->delete($notaId);

        foreach ($nota->fotos as $foto) {
            $this->deleteStoredPhoto($foto['ruta']);
        }

        return true;
    }

    /**
     * Valida y guarda una foto nueva para la nota.
     *
     * @param array<string, mixed> $file Entrada de $_FILES['foto'].
     * @return array{id: int, ruta: string}
     */
    public function agregarFoto(int $usuarioId, int $notaId, array $file): array
    {
        if ($this->notas->findByIdDeUsuario($notaId, $usuarioId) === null) {
            throw new DomainException('La nota no existe.');
        }

        if ($this->notas->countFotos($notaId) >= self::MAX_FOTOS) {
            throw new DomainException(
                'Cada nota admite como máximo ' . self::MAX_FOTOS . ' fotos.'
            );
        }

        $extension = $this->validarArchivo($file);
        $directorio = $this->uploadPath();

        if (!is_dir($directorio) && !mkdir($directorio, 0775, true) && !is_dir($directorio)) {
            throw new DomainException('No se pudo preparar la carpeta de imágenes.');
        }

        $nombre = sprintf('n%d-%s.%s', $notaId, bin2hex(random_bytes(8)), $extension);
        $destino = $directorio . '/' . $nombre;

        if (!move_uploaded_file((string) $file['tmp_name'], $destino)) {
            throw new DomainException('No se pudo guardar la imagen.');
        }

        try {
            return $this->notas->addFoto($notaId, self::UPLOAD_URL . '/' . $nombre);
        } catch (Throwable $error) {
            @unlink($destino);

            throw $error;
        }
    }

    /**
     * Borra una foto concreta si pertenece a una nota del usuario.
     */
    public function eliminarFoto(int $usuarioId, int $notaId, int $fotoId): bool
    {
        $foto = $this->notas->findFotoDeUsuario($fotoId, $notaId, $usuarioId);

        if ($foto === null) {
            return false;
        }

        $this->notas->deleteFoto($fotoId);
        $this->deleteStoredPhoto($foto['ruta']);

        return true;
    }

    /**
     * Elimina del disco las fotos de todas las notas de un usuario.
     * Se usa antes de borrar la cuenta (las filas caen por FK en cascada).
     */
    public function eliminarArchivosDeUsuario(int $usuarioId): void
    {
        foreach ($this->notas->rutasDeUsuario($usuarioId) as $ruta) {
            $this->deleteStoredPhoto($ruta);
        }
    }

    /**
     * Comprueba el archivo subido y devuelve su extensión segura.
     *
     * @param array<string, mixed> $file
     */
    private function validarArchivo(array $file): string
    {
        $error = (int) ($file['error'] ?? UPLOAD_ERR_NO_FILE);

        if ($error === UPLOAD_ERR_NO_FILE) {
            throw new DomainException('Selecciona una imagen para adjuntar.');
        }

        if (in_array($error, [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true)) {
            throw new DomainException('Cada imagen puede pesar como máximo 2 MB.');
        }

        if ($error !== UPLOAD_ERR_OK) {
            throw new DomainException('No se pudo recibir la imagen. Inténtalo de nuevo.');
        }

        $tmp = $file['tmp_name'] ?? null;

        if (!is_string($tmp) || $tmp === '' || !is_uploaded_file($tmp)) {
            throw new DomainException('No se pudo recibir la imagen. Inténtalo de nuevo.');
        }

        $size = (int) ($file['size'] ?? 0);

        if ($size <= 0 || $size > self::MAX_BYTES) {
            throw new DomainException('Cada imagen puede pesar como máximo 2 MB.');
        }

        $mime = $this->detectMime($tmp);
        $extension = self::MIME_EXT[$mime] ?? null;

        if ($extension === null) {
            throw new DomainException('Formato no permitido. Usa una imagen JPG, PNG o WebP.');
        }

        $dimensiones = @getimagesize($tmp);

        if ($dimensiones === false) {
            throw new DomainException('El archivo no parece una imagen válida.');
        }

        if ($dimensiones[0] > self::MAX_SIDE || $dimensiones[1] > self::MAX_SIDE) {
            throw new DomainException('La imagen es demasiado grande. Máximo 6000 px por lado.');
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

    /**
     * Borra únicamente archivos dentro de /uploads/notas.
     */
    private function deleteStoredPhoto(?string $url): void
    {
        if ($url === null || $url === '' || !str_starts_with($url, self::UPLOAD_URL . '/')) {
            return;
        }

        $archivo = $this->uploadPath() . '/' . basename($url);

        if (is_file($archivo)) {
            @unlink($archivo);
        }
    }
}
