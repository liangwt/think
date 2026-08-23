'use strict';

const root = hexo.config.root.endsWith('/') ? hexo.config.root : `${hexo.config.root}/`;

hexo.extend.injector.register(
    'head_end',
    `<link rel="stylesheet" href="${root}css/wechat-qrcode.css">`,
    'default'
);

hexo.extend.injector.register(
    'body_end',
    `<dialog class="wechat-qrcode-dialog" id="wechat-qrcode" aria-labelledby="wechat-qrcode-title">
        <div class="wechat-qrcode-card">
            <button class="wechat-qrcode-close" type="button" aria-label="关闭微信公众号二维码">&times;</button>
            <h2 id="wechat-qrcode-title">微信公众号</h2>
            <img src="${root}img/wechat-qrcode.jpg" alt="微信公众号二维码" width="430" height="430">
            <p>使用微信扫一扫关注公众号</p>
        </div>
    </dialog>
    <script src="${root}js/wechat-qrcode.js" defer></script>`,
    'default'
);
