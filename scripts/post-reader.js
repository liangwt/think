'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = hexo.config.root.endsWith('/') ? hexo.config.root : `${hexo.config.root}/`;
const assetVersion = file => Math.trunc(
    fs.statSync(path.join(hexo.base_dir, 'source', file)).mtimeMs
).toString(36);
const navbarVersion = assetVersion('css/site-navbar.css');
const postReaderVersion = assetVersion('css/post-reader.css');
const postListVersion = assetVersion('css/post-list.css');
const postListScriptVersion = assetVersion('js/post-list-layout.js');

hexo.extend.injector.register(
    'head_end',
    `<link rel="stylesheet" href="${root}css/site-navbar.css?v=${navbarVersion}">`,
    'default'
);

hexo.extend.injector.register(
    'head_end',
    `<link rel="stylesheet" href="${root}css/post-reader.css?v=${postReaderVersion}">`,
    'post'
);

for (const pageType of ['home', 'category', 'tag']) {
    hexo.extend.injector.register(
        'head_end',
        `<link rel="stylesheet" href="${root}css/post-list.css?v=${postListVersion}">`,
        pageType
    );
    hexo.extend.injector.register(
        'body_end',
        `<script src="${root}js/post-list-layout.js?v=${postListScriptVersion}" defer></script>`,
        pageType
    );
}
