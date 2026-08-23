'use strict';

// Icarus always renders a web-font stylesheet link. Remove Google Fonts links
// so browsers use the theme's system-font fallbacks without making overseas
// requests to fonts.googleapis.com or fonts.gstatic.com.
const googleFontsStylesheet = /\s*<link\b(?=[^>]*\brel=["']stylesheet["'])(?=[^>]*\bhref=["']https:\/\/fonts\.googleapis\.com\/[^"']*["'])[^>]*>\s*/gi;

hexo.extend.filter.register('after_render:html', html => (
    html.replace(googleFontsStylesheet, '\n')
));
