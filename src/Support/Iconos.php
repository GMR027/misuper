<?php

declare(strict_types=1);

namespace App\Support;

/* Archivo generado por scripts/gen-iconos.mjs desde shared/iconos.json.
 * No editar a mano: cambia el catálogo y vuelve a ejecutar el generador. */

final class Iconos
{
    private const MAPA = [
    'navegacion' => [
        'inicio' => [
            'web' => 'bi-house-door-fill',
            'android' => 'home',
            'label' => 'Inicio',
        ],
        'por-comprar' => [
            'web' => 'bi-cart-check',
            'android' => 'shopping-cart',
            'label' => 'Por comprar',
        ],
        'ticket' => [
            'web' => 'bi-receipt-cutoff',
            'android' => 'receipt-long',
            'label' => 'Ticket',
        ],
        'historial' => [
            'web' => 'bi-clock-history',
            'android' => 'history',
            'label' => 'Historial',
        ],
        'menu-semanal' => [
            'web' => 'bi-calendar3-week-fill',
            'android' => 'calendar-month',
            'label' => 'Menú semanal',
        ],
        'recetas' => [
            'web' => 'bi-book',
            'android' => 'menu-book',
            'label' => 'Recetas',
        ],
        'productos-omision' => [
            'web' => 'bi-slash-circle',
            'android' => 'block',
            'label' => 'Productos por omisión',
        ],
        'chef' => [
            'web' => 'bi-stars',
            'android' => 'auto-awesome',
            'label' => 'Chef',
        ],
        'metricas' => [
            'web' => 'bi-bar-chart-line-fill',
            'android' => 'bar-chart',
            'label' => 'Métricas',
        ],
        'precios' => [
            'web' => 'bi-tags-fill',
            'android' => 'sell',
            'label' => 'Precios y costos',
        ],
        'notas' => [
            'web' => 'bi-journal-richtext',
            'android' => 'sticky-note-2',
            'label' => 'Notas',
        ],
        'ajustes' => [
            'web' => 'bi-sliders2',
            'android' => 'settings',
            'label' => 'Ajustes',
        ],
        'gastos' => [
            'web' => 'bi-graph-up-arrow',
            'android' => 'savings',
            'label' => 'Gastos',
        ],
        'admin-recetas' => [
            'web' => 'bi-journal-bookmark-fill',
            'android' => 'library-books',
            'label' => 'Catálogo de recetas',
        ],
        'admin-categorias' => [
            'web' => 'bi-grid-3x3-gap-fill',
            'android' => 'category',
            'label' => 'Categorías',
        ],
        'admin-tipos' => [
            'web' => 'bi-heart-pulse',
            'android' => 'eco',
            'label' => 'Tipos de dieta',
        ],
        'admin-productos' => [
            'web' => 'bi-box-seam',
            'android' => 'inventory-2',
            'label' => 'Productos',
        ],
        'admin-usuarios' => [
            'web' => 'bi-people-fill',
            'android' => 'group',
            'label' => 'Usuarios',
        ],
    ],
    'grupos' => [
        'compras' => [
            'web' => 'bi-bag-check-fill',
            'android' => 'shopping-cart',
            'label' => 'Compras',
        ],
        'cocina' => [
            'web' => 'bi-egg-fried',
            'android' => 'restaurant-menu',
            'label' => 'Cocina',
        ],
        'analisis' => [
            'web' => 'bi-graph-up-arrow',
            'android' => 'bar-chart',
            'label' => 'Análisis',
        ],
        'personal' => [
            'web' => 'bi-journal-richtext',
            'android' => 'sticky-note-2',
            'label' => 'Personal',
        ],
        'admin' => [
            'web' => 'bi-shield-lock-fill',
            'android' => 'settings',
            'label' => 'Administración',
        ],
    ],
    'acciones' => [
        'guardar' => [
            'web' => 'bi-check2',
            'android' => 'check',
            'label' => 'Guardar',
        ],
        'confirmar' => [
            'web' => 'bi-check2-circle',
            'android' => 'check-circle',
            'label' => 'Confirmar',
        ],
        'seleccionar' => [
            'web' => 'bi-plus-circle',
            'android' => 'add-circle',
            'label' => 'Seleccionar',
        ],
        'publicar' => [
            'web' => 'bi-check2-all',
            'android' => 'publish',
            'label' => 'Publicar',
        ],
        'editar' => [
            'web' => 'bi-pencil-square',
            'android' => 'edit',
            'label' => 'Editar',
        ],
        'eliminar' => [
            'web' => 'bi-trash3',
            'android' => 'delete',
            'label' => 'Eliminar',
        ],
        'quitar' => [
            'web' => 'bi-dash-circle',
            'android' => 'do-not-disturb-on',
            'label' => 'Quitar',
        ],
        'vaciar' => [
            'web' => 'bi-trash',
            'android' => 'delete-sweep',
            'label' => 'Vaciar',
        ],
        'descartar' => [
            'web' => 'bi-x-circle',
            'android' => 'cancel',
            'label' => 'Descartar',
        ],
        'reintentar' => [
            'web' => 'bi-arrow-repeat',
            'android' => 'refresh',
            'label' => 'Reintentar',
        ],
        'ver' => [
            'web' => 'bi-eye',
            'android' => 'visibility',
            'label' => 'Ver',
        ],
        'ocultar' => [
            'web' => 'bi-eye-slash',
            'android' => 'visibility-off',
            'label' => 'Ocultar',
        ],
        'buscar' => [
            'web' => 'bi-search',
            'android' => 'search',
            'label' => 'Buscar',
        ],
        'agregar' => [
            'web' => 'bi-plus-lg',
            'android' => 'add',
            'label' => 'Agregar',
        ],
        'nueva-lista' => [
            'web' => 'bi-plus-circle',
            'android' => 'playlist-add',
            'label' => 'Nueva lista',
        ],
        'filtrar' => [
            'web' => 'bi-funnel',
            'android' => 'filter-list',
            'label' => 'Filtrar',
        ],
        'mas' => [
            'web' => 'bi-three-dots-vertical',
            'android' => 'more-vert',
            'label' => 'Más acciones',
        ],
        'cerrar' => [
            'web' => 'bi-x-lg',
            'android' => 'close',
            'label' => 'Cerrar',
        ],
        'precio' => [
            'web' => 'bi-cash-coin',
            'android' => 'payments',
            'label' => 'Precio',
        ],
        'lista' => [
            'web' => 'bi-list-ul',
            'android' => 'view-list',
            'label' => 'Vista de lista',
        ],
        'cuadricula' => [
            'web' => 'bi-grid-3x3-gap',
            'android' => 'grid-view',
            'label' => 'Vista de cuadrícula',
        ],
        'actualizar' => [
            'web' => 'bi-arrow-clockwise',
            'android' => 'sync',
            'label' => 'Actualizar',
        ],
        'cargar-mas' => [
            'web' => 'bi-arrow-down-circle',
            'android' => 'expand-more',
            'label' => 'Cargar más',
        ],
        'resetear' => [
            'web' => 'bi-key-fill',
            'android' => 'key',
            'label' => 'Restablecer',
        ],
        'compartir' => [
            'web' => 'bi-share',
            'android' => 'share',
            'label' => 'Compartir',
        ],
        'descargar' => [
            'web' => 'bi-download',
            'android' => 'download',
            'label' => 'Descargar',
        ],
        'subir' => [
            'web' => 'bi-upload',
            'android' => 'upload-file',
            'label' => 'Subir',
        ],
        'camara' => [
            'web' => 'bi-camera',
            'android' => 'photo-camera',
            'label' => 'Cámara',
        ],
        'menu' => [
            'web' => 'bi-list',
            'android' => 'menu',
            'label' => 'Menú',
        ],
        'cuenta' => [
            'web' => 'bi-person-circle',
            'android' => 'account-circle',
            'label' => 'Cuenta',
        ],
        'salir' => [
            'web' => 'bi-box-arrow-right',
            'android' => 'logout',
            'label' => 'Cerrar sesión',
        ],
        'atras' => [
            'web' => 'bi-arrow-left',
            'android' => 'arrow-back',
            'label' => 'Volver',
        ],
        'adelante' => [
            'web' => 'bi-chevron-right',
            'android' => 'chevron-right',
            'label' => 'Continuar',
        ],
        'info' => [
            'web' => 'bi-info-circle',
            'android' => 'info',
            'label' => 'Información',
        ],
        'advertencia' => [
            'web' => 'bi-exclamation-triangle',
            'android' => 'warning',
            'label' => 'Advertencia',
        ],
        'exito' => [
            'web' => 'bi-check-circle',
            'android' => 'check-circle',
            'label' => 'Listo',
        ],
        'microfono' => [
            'web' => 'bi-mic',
            'android' => 'mic',
            'label' => 'Dictar',
        ],
        'modo-oscuro' => [
            'web' => 'bi-moon-stars',
            'android' => 'dark-mode',
            'label' => 'Modo oscuro',
        ],
        'modo-claro' => [
            'web' => 'bi-sun',
            'android' => 'light-mode',
            'label' => 'Modo claro',
        ],
        'idioma' => [
            'web' => 'bi-translate',
            'android' => 'language',
            'label' => 'Idioma',
        ],
        'contraste' => [
            'web' => 'bi-circle-half',
            'android' => 'contrast',
            'label' => 'Contraste',
        ],
        'calculadora' => [
            'web' => 'bi-calculator',
            'android' => 'calculate',
            'label' => 'Calculadora',
        ],
        'apps' => [
            'web' => 'bi-grid-3x3-gap',
            'android' => 'apps',
            'label' => 'Categorías',
        ],
        'wifi' => [
            'web' => 'bi-wifi',
            'android' => 'wifi',
            'label' => 'Conexión',
        ],
        'usb' => [
            'web' => 'bi-usb',
            'android' => 'usb',
            'label' => 'USB',
        ],
    ],
];

    /** La clase de Bootstrap Icons de una clave semántica. */
    public static function clase(string $grupo, string $clave): string
    {
        return self::MAPA[$grupo][$clave]['web'] ?? '';
    }

    /** El nombre Material Symbols de una clave semántica. */
    public static function android(string $grupo, string $clave): string
    {
        return self::MAPA[$grupo][$clave]['android'] ?? '';
    }

    /** La etiqueta humana de una clave semántica. */
    public static function etiqueta(string $grupo, string $clave): string
    {
        return self::MAPA[$grupo][$clave]['label'] ?? $clave;
    }

    /** Pinta el icono web; por defecto es decorativo y se oculta al lector. */
    public static function render(
        string $grupo,
        string $clave,
        string $extra = '',
        bool $decorativo = true,
    ): string {
        $clase = self::clase($grupo, $clave);

        if ($clase === '') {
            return '';
        }

        $clases = trim('bi ' . $clase . ' ' . $extra);
        $aria = $decorativo ? ' aria-hidden="true"' : '';

        return '<i class="' . htmlspecialchars($clases, ENT_QUOTES, 'UTF-8') . '"' . $aria . '></i>';
    }
}
