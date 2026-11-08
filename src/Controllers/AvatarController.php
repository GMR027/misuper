<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Support\AvatarCatalog;
use App\Support\Response;

/**
 * Catálogo de avatares predefinidos para la app Android. Es público y de
 * solo lectura: solo devuelve emoji y etiqueta, no datos de usuarios.
 */
final class AvatarController
{
    /**
     * GET /api/avatars
     */
    public function index(): void
    {
        $items = [];

        foreach (AvatarCatalog::all() as $id => $avatar) {
            $items[] = [
                'id' => $id,
                'emoji' => $avatar['emoji'],
                'label' => $avatar['label'],
            ];
        }

        Response::ok(['items' => $items]);
    }
}
