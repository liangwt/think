document.addEventListener('click', event => {
    const dialog = document.getElementById('wechat-qrcode');
    if (!dialog) return;

    const trigger = event.target.closest('a[title="WeChat"], a[href$="#wechat-qrcode"]');
    if (trigger) {
        event.preventDefault();
        const image = dialog.querySelector('img[data-src]');
        if (image) {
            image.src = image.dataset.src;
            image.removeAttribute('data-src');
        }
        if (!dialog.open) dialog.showModal();
        return;
    }

    if (event.target.closest('.wechat-qrcode-close') || event.target === dialog) {
        dialog.close();
    }
});
