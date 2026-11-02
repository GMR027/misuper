<?php

declare(strict_types=1);

namespace App\Support;

/**
 * Catálogo de avatares predefinidos.
 *
 * Cada avatar es un emoji sobre un degradado definido en avatars.css.
 * El identificador se guarda en usuarios.avatar_valor cuando
 * avatar_tipo = 'preset'.
 */
final class AvatarCatalog
{
    /**
     * @var array<string, array{emoji: string, label: string}>
     */
    private const AVATARS = [
        'a01' => ['emoji' => '🦊', 'label' => 'Zorro'],
        'a02' => ['emoji' => '🐻', 'label' => 'Oso'],
        'a03' => ['emoji' => '🐼', 'label' => 'Panda'],
        'a04' => ['emoji' => '🐨', 'label' => 'Koala'],
        'a05' => ['emoji' => '🐯', 'label' => 'Tigre'],
        'a06' => ['emoji' => '🦁', 'label' => 'León'],
        'a07' => ['emoji' => '🐸', 'label' => 'Rana'],
        'a08' => ['emoji' => '🐙', 'label' => 'Pulpo'],
        'a09' => ['emoji' => '🐢', 'label' => 'Tortuga'],
        'a10' => ['emoji' => '🐧', 'label' => 'Pingüino'],
        'a11' => ['emoji' => '🦉', 'label' => 'Búho'],
        'a12' => ['emoji' => '🦜', 'label' => 'Loro'],
        'a13' => ['emoji' => '🐝', 'label' => 'Abeja'],
        'a14' => ['emoji' => '🦋', 'label' => 'Mariposa'],
        'a15' => ['emoji' => '🐳', 'label' => 'Ballena'],
        'a16' => ['emoji' => '🐬', 'label' => 'Delfín'],
        'a17' => ['emoji' => '🦄', 'label' => 'Unicornio'],
        'a18' => ['emoji' => '🐲', 'label' => 'Dragón'],
        'a19' => ['emoji' => '🍓', 'label' => 'Fresa'],
        'a20' => ['emoji' => '🍊', 'label' => 'Naranja'],
        'a21' => ['emoji' => '🥑', 'label' => 'Aguacate'],
        'a22' => ['emoji' => '🍕', 'label' => 'Pizza'],
        'a23' => ['emoji' => '🥐', 'label' => 'Croissant'],
        'a24' => ['emoji' => '☕', 'label' => 'Café'],
        'a25' => ['emoji' => '🌵', 'label' => 'Cactus'],
        'a26' => ['emoji' => '🌻', 'label' => 'Girasol'],
        'a27' => ['emoji' => '🌈', 'label' => 'Arcoíris'],
        'a28' => ['emoji' => '⭐', 'label' => 'Estrella'],
        'a29' => ['emoji' => '🚀', 'label' => 'Cohete'],
        'a30' => ['emoji' => '🎧', 'label' => 'Auriculares'],
        'a31' => ['emoji' => '🦒', 'label' => 'Jirafa'],
        'a32' => ['emoji' => '🦓', 'label' => 'Cebra'],
        'a33' => ['emoji' => '🐘', 'label' => 'Elefante'],
        'a34' => ['emoji' => '🦔', 'label' => 'Erizo'],
        'a35' => ['emoji' => '🦦', 'label' => 'Nutria'],
        'a36' => ['emoji' => '🐺', 'label' => 'Lobo'],
        'a37' => ['emoji' => '🐷', 'label' => 'Cerdito'],
        'a38' => ['emoji' => '🐮', 'label' => 'Vaca'],
        'a39' => ['emoji' => '🐔', 'label' => 'Gallina'],
        'a40' => ['emoji' => '🦆', 'label' => 'Pato'],
        'a41' => ['emoji' => '🐠', 'label' => 'Pez'],
        'a42' => ['emoji' => '🦈', 'label' => 'Tiburón'],
        'a43' => ['emoji' => '🐊', 'label' => 'Cocodrilo'],
        'a44' => ['emoji' => '🦩', 'label' => 'Flamenco'],
        'a45' => ['emoji' => '🌸', 'label' => 'Flor de cerezo'],
        'a46' => ['emoji' => '🍋', 'label' => 'Limón'],
        'a47' => ['emoji' => '🍇', 'label' => 'Uvas'],
        'a48' => ['emoji' => '🍩', 'label' => 'Dona'],
        'a49' => ['emoji' => '🎨', 'label' => 'Paleta de pintura'],
        'a50' => ['emoji' => '🏀', 'label' => 'Balón'],
    ];

    /**
     * @return array<string, array{emoji: string, label: string}>
     */
    public static function all(): array
    {
        return self::AVATARS;
    }

    public static function has(string $id): bool
    {
        return array_key_exists($id, self::AVATARS);
    }

    /**
     * @return array{emoji: string, label: string}|null
     */
    public static function get(string $id): ?array
    {
        return self::AVATARS[$id] ?? null;
    }

    /**
     * Iniciales de respaldo cuando el usuario no tiene foto ni avatar.
     */
    public static function initials(string $nombre): string
    {
        $partes = preg_split('/\s+/u', trim($nombre)) ?: [];
        $iniciales = '';

        foreach (array_slice($partes, 0, 2) as $parte) {
            if ($parte !== '') {
                $iniciales .= mb_strtoupper(mb_substr($parte, 0, 1));
            }
        }

        return $iniciales !== '' ? $iniciales : 'U';
    }
}
