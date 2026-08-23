'use strict';

const { escapeHTML, stripHTML, unescapeHTML } = require('hexo-util');

const FALLBACK_SUMMARY_LENGTH = 200;

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
