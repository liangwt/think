'use strict';

// Icarus always renders a web-font stylesheet link. Remove Google Fonts links
// so browsers use the theme's system-font fallbacks without making overseas
// requests to fonts.googleapis.com or fonts.gstatic.com.
const googleFontsStylesheet = /\s*<link\b(?=[^>]*\brel=["']stylesheet["'])(?=[^>]*\bhref=["']https:\/\/fonts\.googleapis\.com\/[^"']*["'])[^>]*>\s*/gi;
const momentScript = /\s*<script\b[^>]*\bsrc=["'][^"']*\/moment(?:\.js)?\/[^"']*\/moment-with-locales\.min\.js["'][^>]*><\/script>\s*/gi;
const momentLocaleScript = /\s*<script>\s*moment\.locale\([^)]*\);\s*<\/script>\s*/gi;

const root = hexo.config.root.endsWith('/') ? hexo.config.root : `${hexo.config.root}/`;

hexo.extend.injector.register(
    'body_end',
    `<script src="${root}js/relative-time.js" defer></script>`,
    'default'
);

hexo.extend.filter.register('after_render:html', html => (
    html
        .replace(googleFontsStylesheet, '\n')
        .replace(momentScript, '\n')
        .replace(momentLocaleScript, '\n')
));
