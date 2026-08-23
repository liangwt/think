'use strict';

const escapeHtml = value => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const brandText = escapeHtml(hexo.config.title);
const imageLogoLink = /(<a\b(?=[^>]*\bclass="[^"]*\b(?:navbar-logo|footer-logo)\b[^"]*")[^>]*>)\s*<img\b[^>]*>\s*(<\/a>)/g;

hexo.extend.filter.register('after_render:html', html => (
    html.replace(imageLogoLink, `$1${brandText}$2`)
));
