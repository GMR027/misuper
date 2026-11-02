<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Usuario;
use App\Repositories\UsuarioRepository;
use App\Support\AvatarCatalog;
use DomainException;
use Throwable;

/**
 * Guarda la foto subida o el avatar predefinido del usuario.
 *
 * Las fotos se guardan en public/uploads/avatars con un nombre aleatorio.
 * En avatar_valor se conserva la ruta pública ("/uploads/avatars/...").
 */
final class AvatarService
{
    private const MAX_BYTES = 2 * 1024 * 1024;
    private const MAX_SIDE = 6000;
    private const UPLOAD_DIR = '/public/uploads/avatars';
    private const UPLOAD_URL = '/uploads/avatars';

    /** @var array<string, string> */
    private const MIME_EXT = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
    ];

    private readonly UsuarioRepository $usuarios;

    public function __construct(?UsuarioRepository $usuarios = null)
    {
        $this->usuarios = $usuarios ?? new UsuarioRepository();
    }

    public function savePreset(int $id, string $preset): Usuario
    {
        if (!AvatarCatalog::has($preset)) {
            throw new DomainException('El avatar seleccionado no es válido.');
        }

        $anterior = $this->usuarios->findById($id);
        $this->usuarios->updateAvatar($id, 'preset', $preset);
        $this->deleteStoredPhoto($anterior?->avatarTipo === 'foto' ? $anterior->avatarValor : null);

        return $this->requireUser($id);
    }

    /**
     * @param array<string, mixed> $file Entrada de $_FILES['foto'].
     */
    public function savePhoto(int $id, array $file): Usuario
    {
        $error = (int) ($file['error'] ?? UPLOAD_ERR_NO_FILE);

        if ($error === UPLOAD_ERR_NO_FILE) {
            throw new DomainException('Selecciona una imagen para tu foto de perfil.');
        }

        if (in_array($error, [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true)) {
            throw new DomainException('La imagen supera el tamaño máximo de 2 MB.');
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
            throw new DomainException('La imagen supera el tamaño máximo de 2 MB.');
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

        $directorio = $this->uploadPath();

        if (!is_dir($directorio) && !mkdir($directorio, 0775, true) && !is_dir($directorio)) {
            throw new DomainException('No se pudo preparar la carpeta de imágenes.');
        }

        $nombre = sprintf(
            'u%d-%s.%s',
            $id,
            bin2hex(random_bytes(8)),
            $extension
        );
        $destino = $directorio . '/' . $nombre;

        if (!move_uploaded_file($tmp, $destino)) {
            throw new DomainException('No se pudo guardar la imagen.');
        }

        $ruta = self::UPLOAD_URL . '/' . $nombre;
        $anterior = $this->usuarios->findById($id);

        try {
            $this->usuarios->updateAvatar($id, 'foto', $ruta);
        } catch (Throwable $error) {
            @unlink($destino);

            throw $error;
        }

        $this->deleteStoredPhoto($anterior?->avatarTipo === 'foto' ? $anterior->avatarValor : null);

        return $this->requireUser($id);
    }

    public function remove(int $id): Usuario
    {
        $anterior = $this->usuarios->findById($id);
        $this->usuarios->updateAvatar($id, null, null);
        $this->deleteStoredPhoto($anterior?->avatarTipo === 'foto' ? $anterior->avatarValor : null);

        return $this->requireUser($id);
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
     * Borra únicamente archivos dentro de /uploads/avatars.
     */
    public function deleteStoredPhoto(?string $url): void
    {
        if ($url === null || $url === '' || !str_starts_with($url, self::UPLOAD_URL . '/')) {
            return;
        }

        $nombre = basename($url);
        $archivo = $this->uploadPath() . '/' . $nombre;

        if (is_file($archivo)) {
            @unlink($archivo);
        }
    }

    private function requireUser(int $id): Usuario
    {
        $usuario = $this->usuarios->findById($id);

        if ($usuario === null) {
            throw new DomainException('La cuenta ya no existe.');
        }

        return $usuario;
    }
}
