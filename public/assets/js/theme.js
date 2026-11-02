/*
 * theme.js — aplica la paleta y el modo de color antes de pintar la página.
 * Se carga en el <head> como script clásico para evitar el parpadeo.
 *
 * - data-theme: paleta (esmeralda, oceano, ...).
 * - data-mode: "light" | "dark" resuelto (lo que pintan las CSS).
 * - data-mode-pref: preferencia del usuario ("light" | "dark" | "auto").
 */
(function () {
    'use strict';

    var THEME_KEY = 'misuper.theme';
    var MODE_KEY = 'misuper.mode';
    var THEMES = [
        'esmeralda',
        'oceano',
        'indigo',
        'uva',
        'frambuesa',
        'terracota',
        'ambar',
        'citrico',
        'cielo',
        'grafito',
        'menta',
        'lavanda',
        'cereza',
        'durazno',
        'arena',
    ];
    var MODES = ['light', 'dark', 'auto'];

    var oscuro = window.matchMedia
        ? window.matchMedia('(prefers-color-scheme: dark)')
        : null;

    function normalizeTheme(value) {
        return THEMES.indexOf(value) === -1 ? 'esmeralda' : value;
    }

    function normalizeMode(value) {
        return MODES.indexOf(value) === -1 ? 'auto' : value;
    }

    function read(key) {
        try {
            return window.localStorage.getItem(key);
        } catch (error) {
            return null;
        }
    }

    function save(key, value) {
        try {
            window.localStorage.setItem(key, value);
        } catch (error) {
            // Sin persistencia: el ajuste se mantiene durante esta visita.
        }
    }

    function savedTheme() {
        return normalizeTheme(read(THEME_KEY));
    }

    function savedMode() {
        return normalizeMode(read(MODE_KEY));
    }

    function resolveMode(mode) {
        if (mode === 'auto') {
            return oscuro && oscuro.matches ? 'dark' : 'light';
        }

        return mode;
    }

    function syncThemes(theme) {
        var buttons = document.querySelectorAll('[data-theme-choice]');

        Array.prototype.forEach.call(buttons, function (button) {
            var selected = button.getAttribute('data-theme-choice') === theme;
            button.classList.toggle('is-selected', selected);
            button.setAttribute('aria-pressed', selected ? 'true' : 'false');
        });
    }

    function syncModes(pref) {
        var buttons = document.querySelectorAll('[data-mode-choice]');

        Array.prototype.forEach.call(buttons, function (button) {
            var selected = button.getAttribute('data-mode-choice') === pref;
            button.classList.toggle('is-selected', selected);
            button.setAttribute('aria-pressed', selected ? 'true' : 'false');
        });
    }

    function paintMode(pref) {
        var resolved = resolveMode(pref);

        document.documentElement.setAttribute('data-mode', resolved);
        document.documentElement.setAttribute('data-mode-pref', pref);
        syncModes(pref);

        return resolved;
    }

    function applyTheme(theme) {
        var next = normalizeTheme(theme);

        document.documentElement.setAttribute('data-theme', next);
        save(THEME_KEY, next);
        syncThemes(next);
        window.dispatchEvent(new CustomEvent('misuper:themechange', { detail: { theme: next } }));

        return next;
    }

    function applyMode(mode) {
        var pref = normalizeMode(mode);
        var resolved = paintMode(pref);

        save(MODE_KEY, pref);
        window.dispatchEvent(new CustomEvent('misuper:modechange', {
            detail: { mode: pref, resolved: resolved },
        }));

        return pref;
    }

    function init() {
        applyTheme(document.documentElement.getAttribute('data-theme') || savedTheme());
        applyMode(savedMode());

        Array.prototype.forEach.call(document.querySelectorAll('[data-theme-choice]'), function (button) {
            button.addEventListener('click', function () {
                applyTheme(button.getAttribute('data-theme-choice'));
            });
        });

        Array.prototype.forEach.call(document.querySelectorAll('[data-mode-choice]'), function (button) {
            button.addEventListener('click', function () {
                applyMode(button.getAttribute('data-mode-choice'));
            });
        });

        if (oscuro) {
            var onChange = function () {
                if (savedMode() !== 'auto') {
                    return;
                }

                var resolved = paintMode('auto');
                window.dispatchEvent(new CustomEvent('misuper:modechange', {
                    detail: { mode: 'auto', resolved: resolved },
                }));
            };

            if (typeof oscuro.addEventListener === 'function') {
                oscuro.addEventListener('change', onChange);
            } else if (typeof oscuro.addListener === 'function') {
                oscuro.addListener(onChange);
            }
        }
    }

    // Los atributos se fijan cuanto antes para que el CSS pinte ya resuelto.
    document.documentElement.setAttribute('data-theme', savedTheme());
    document.documentElement.setAttribute('data-mode-pref', savedMode());
    document.documentElement.setAttribute('data-mode', resolveMode(savedMode()));

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.MiSuperTheme = {
        apply: applyTheme,
        applyMode: applyMode,
        current: function () {
            return normalizeTheme(document.documentElement.getAttribute('data-theme'));
        },
        currentMode: function () {
            return normalizeMode(document.documentElement.getAttribute('data-mode-pref'));
        },
        resolvedMode: function () {
            return document.documentElement.getAttribute('data-mode') || 'light';
        },
        themes: THEMES.slice(),
        modes: MODES.slice(),
    };
}());
