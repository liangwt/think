'use strict';

const articlePattern = /<article\b[^>]*\bclass="[^"]*\barticle\b[^"]*"[^>]*>([\s\S]*?)<\/article>/i;
const galleryStylesheet = /\s*<link\b[^>]*\bhref="[^"]*\/(?:lightgallery|justifiedGallery)\/[^"#?]+\.css"[^>]*>\s*/gi;
const galleryScript = /\s*<script\b[^>]*\bsrc="[^"]*\/(?:lightgallery|justifiedGallery)\/[^"#?]+\.js"[^>]*><\/script>\s*/gi;

hexo.extend.filter.register('after_render:html', html => {
    const article = html.match(articlePattern);
    const needsGallery = article && /<div\b[^>]*\bclass="[^"]*\bcontent\b[^"]*"[^>]*>[\s\S]*?<img\b/i.test(article[1]);

    if (needsGallery) {
        return html;
    }

    return html
        .replace(galleryStylesheet, '\n')
        .replace(galleryScript, '\n');
});
