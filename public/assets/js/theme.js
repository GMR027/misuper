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
    var FOCUS_KEY = 'misuper.focus';
    var FOCUS_INTENSITY_KEY = 'misuper.focus-intensity';
    var FOCUS_INTENSITY_DEFAULT = 100;
    var FOCUS_INTENSITY_MAX = 200;
    var FOCUS_SPREAD_KEY = 'misuper.focus-spread';
    var FOCUS_SPREAD_DEFAULT = 100;
    var FOCUS_SPREAD_MIN = 50;
    var FOCUS_SPREAD_MAX = 250;
    var ACCENT_PROPS = [
        '--a-50', '--a-100', '--a-200', '--a-300', '--a-400',
        '--a-500', '--a-600', '--a-700', '--a-900', '--a-rgb',
        '--focus-color', '--focus-rgb'
    ];
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

    function normalizeFocus(value) {
        if (typeof value !== 'string') {
            return 'auto';
        }

        var hex = value.trim().toLowerCase();

        return /^#[0-9a-f]{6}$/.test(hex) ? hex : 'auto';
    }

    function normalizeIntensity(value) {
        var number = parseInt(value, 10);

        if (isNaN(number)) {
            return FOCUS_INTENSITY_DEFAULT;
        }

        return Math.max(0, Math.min(FOCUS_INTENSITY_MAX, number));
    }

    function normalizeSpread(value) {
        var number = parseInt(value, 10);

        if (isNaN(number)) {
            return FOCUS_SPREAD_DEFAULT;
        }

        return Math.max(FOCUS_SPREAD_MIN, Math.min(FOCUS_SPREAD_MAX, number));
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

    function savedFocus() {
        return normalizeFocus(read(FOCUS_KEY));
    }

    function savedIntensity() {
        return normalizeIntensity(read(FOCUS_INTENSITY_KEY));
    }

    function savedSpread() {
        return normalizeSpread(read(FOCUS_SPREAD_KEY));
    }

    function hexToRgb(hex) {
        var value = parseInt(hex.slice(1), 16);

        return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
    }

    function rgbToHex(rgb) {
        return '#' + rgb.map(function (channel) {
            var part = Math.max(0, Math.min(255, Math.round(channel))).toString(16);

            return part.length === 1 ? '0' + part : part;
        }).join('');
    }

    function mixHex(hex, target, amount) {
        var from = hexToRgb(hex);
        var to = hexToRgb(target);
        var mixed = from.map(function (channel, index) {
            return channel + (to[index] - channel) * amount;
        });

        return rgbToHex(mixed);
    }

    /* Genera la escala de acento a partir del color de enfoque. */
    function focusScale(hex, mode) {
        if (mode === 'dark') {
            return {
                '--a-50': mixHex(hex, '#000000', 0.55),
                '--a-100': mixHex(hex, '#000000', 0.42),
                '--a-200': mixHex(hex, '#000000', 0.28),
                '--a-300': mixHex(hex, '#ffffff', 0.55),
                '--a-400': mixHex(hex, '#ffffff', 0.28),
                '--a-500': hex,
                '--a-600': mixHex(hex, '#ffffff', 0.18),
                '--a-700': mixHex(hex, '#ffffff', 0.34),
                '--a-900': mixHex(hex, '#ffffff', 0.6)
            };
        }

        return {
            '--a-50': mixHex(hex, '#ffffff', 0.92),
            '--a-100': mixHex(hex, '#ffffff', 0.85),
            '--a-200': mixHex(hex, '#ffffff', 0.7),
            '--a-300': mixHex(hex, '#ffffff', 0.5),
            '--a-400': mixHex(hex, '#ffffff', 0.25),
            '--a-500': hex,
            '--a-600': mixHex(hex, '#000000', 0.14),
            '--a-700': mixHex(hex, '#000000', 0.3),
            '--a-900': mixHex(hex, '#000000', 0.55)
        };
    }

    function clearFocusStyles() {
        ACCENT_PROPS.forEach(function (prop) {
            document.documentElement.style.removeProperty(prop);
        });
    }

    function paintFocus(color, mode) {
        if (color === 'auto') {
            clearFocusStyles();
            document.documentElement.removeAttribute('data-focus');

            return;
        }

        var scale = focusScale(color, mode);
        var rgb = hexToRgb(color);

        Object.keys(scale).forEach(function (prop) {
            document.documentElement.style.setProperty(prop, scale[prop]);
        });

        document.documentElement.style.setProperty('--a-rgb', rgb.join(', '));
        document.documentElement.style.setProperty('--focus-color', color);
        document.documentElement.style.setProperty('--focus-rgb', rgb.join(', '));
        document.documentElement.setAttribute('data-focus', color);
    }

    function paintIntensity(value) {
        var factor = normalizeIntensity(value) / 100;
        var style = document.documentElement.style;

        style.setProperty('--focus-strength', String(factor));
        style.setProperty('--focus-alpha-1', (0.13 * factor).toFixed(3));
        style.setProperty('--focus-alpha-2', (0.15 * factor).toFixed(3));
        style.setProperty('--focus-alpha-3', (0.08 * factor).toFixed(3));
        style.setProperty('--focus-alpha-glow', (0.22 * factor).toFixed(3));
    }

    function syncIntensity(value) {
        Array.prototype.forEach.call(document.querySelectorAll('[data-focus-intensity]'), function (input) {
            input.value = String(value);
        });

        Array.prototype.forEach.call(document.querySelectorAll('[data-focus-intensity-value]'), function (output) {
            output.textContent = value + '%';
        });
    }

    function applyIntensity(value) {
        var next = normalizeIntensity(value);

        save(FOCUS_INTENSITY_KEY, String(next));
        paintIntensity(next);
        syncIntensity(next);
        window.dispatchEvent(new CustomEvent('misuper:focusintensity', { detail: { intensity: next } }));

        return next;
    }

    function paintSpread(value) {
        var factor = normalizeSpread(value) / 100;

        document.documentElement.style.setProperty('--focus-spread', String(factor));
    }

    function syncSpread(value) {
        Array.prototype.forEach.call(document.querySelectorAll('[data-focus-spread]'), function (input) {
            input.value = String(value);
        });

        Array.prototype.forEach.call(document.querySelectorAll('[data-focus-spread-value]'), function (output) {
            output.textContent = value + '%';
        });
    }

    function applySpread(value) {
        var next = normalizeSpread(value);

        save(FOCUS_SPREAD_KEY, String(next));
        paintSpread(next);
        syncSpread(next);
        window.dispatchEvent(new CustomEvent('misuper:focusspread', { detail: { spread: next } }));

        return next;
    }

    function syncFocus(color) {
        Array.prototype.forEach.call(document.querySelectorAll('[data-focus-choice]'), function (button) {
            var selected = button.getAttribute('data-focus-choice') === color;
            button.classList.toggle('is-selected', selected);
            button.setAttribute('aria-pressed', selected ? 'true' : 'false');
        });

        Array.prototype.forEach.call(document.querySelectorAll('[data-focus-custom]'), function (input) {
            var custom = color === 'auto' ? input.getAttribute('data-default') || '#14b8a6' : color;
            input.value = custom;
            input.classList.toggle('is-selected', color !== 'auto');
        });
    }

    function applyFocus(color) {
        var next = normalizeFocus(color);

        save(FOCUS_KEY, next);
        paintFocus(next, resolveMode(savedMode()));
        syncFocus(next);
        window.dispatchEvent(new CustomEvent('misuper:focuschange', { detail: { focus: next } }));

        return next;
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
        paintFocus(savedFocus(), resolved);
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
        applyFocus(savedFocus());
        applyIntensity(savedIntensity());
        applySpread(savedSpread());

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

        Array.prototype.forEach.call(document.querySelectorAll('[data-focus-choice]'), function (button) {
            button.addEventListener('click', function () {
                applyFocus(button.getAttribute('data-focus-choice'));
            });
        });

        Array.prototype.forEach.call(document.querySelectorAll('[data-focus-custom]'), function (input) {
            input.addEventListener('input', function () {
                applyFocus(input.value);
            });
        });

        Array.prototype.forEach.call(document.querySelectorAll('[data-focus-intensity]'), function (input) {
            input.addEventListener('input', function () {
                applyIntensity(input.value);
            });
        });

        Array.prototype.forEach.call(document.querySelectorAll('[data-focus-spread]'), function (input) {
            input.addEventListener('input', function () {
                applySpread(input.value);
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
    paintFocus(savedFocus(), resolveMode(savedMode()));
    paintIntensity(savedIntensity());
    paintSpread(savedSpread());

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
        applyFocus: applyFocus,
        applyIntensity: applyIntensity,
        applySpread: applySpread,
        currentFocus: function () {
            return normalizeFocus(read(FOCUS_KEY));
        },
        currentIntensity: function () {
            return normalizeIntensity(read(FOCUS_INTENSITY_KEY));
        },
        currentSpread: function () {
            return normalizeSpread(read(FOCUS_SPREAD_KEY));
        },
        resolvedMode: function () {
            return document.documentElement.getAttribute('data-mode') || 'light';
        },
        themes: THEMES.slice(),
        modes: MODES.slice(),
    };
}());
