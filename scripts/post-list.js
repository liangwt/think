'use strict';

const { escapeHTML, stripHTML, unescapeHTML } = require('hexo-util');

const FALLBACK_SUMMARY_LENGTH = 200;
const TRANSPARENT_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
const listCoverImage = /(<div class="card-image">\s*<a\b[^>]*>\s*<img\b[^>]*?)\bsrc="([^"]+)"/gi;

function normalizeText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function createFallbackSummary(content) {
    const plainText = normalizeText(unescapeHTML(stripHTML(content || '')));
    const characters = Array.from(plainText);
    const truncated = characters.length > FALLBACK_SUMMARY_LENGTH;
    const summary = characters.slice(0, FALLBACK_SUMMARY_LENGTH).join('');

    return `${summary}${truncated ? '…' : ''}`;
}

hexo.extend.filter.register('after_post_render', data => {
    if (data.layout !== 'post') {
        return data;
    }

    const customSummary = normalizeText(data.summary);
    const summary = customSummary || createFallbackSummary(data.content);

    data.excerpt = summary
        ? `<p class="post-summary">${escapeHTML(summary)}</p>`
        : '';
    data.more = data.content;

    return data;
}, 20);

// Do not start downloading list-page covers until the browser has confirmed
// that the title is short enough for the cover to remain visible.
hexo.extend.filter.register('after_render:html', html => (
    html.replace(listCoverImage, (match, prefix, source) => (
        `${prefix}src="${TRANSPARENT_PIXEL}" data-src="${source}" loading="lazy" decoding="async"`
    ))
));
