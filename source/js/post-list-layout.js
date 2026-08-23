(function () {
    'use strict';

    function updatePostCards() {
        const cards = document.querySelectorAll('.column-main > .card');

        cards.forEach(card => {
            const cover = card.querySelector(':scope > .card-image');
            const title = card.querySelector(':scope > article.article > .title > a');
            if (!cover || !title) {
                return;
            }

            card.classList.remove('is-long-title');
            if (title.scrollWidth > title.clientWidth + 1) {
                card.classList.add('is-long-title');
                return;
            }

            const image = cover.querySelector('img[data-src]');
            if (image) {
                image.src = image.dataset.src;
                image.removeAttribute('data-src');
            }
        });
    }

    let resizeTimer;
    function scheduleUpdate() {
        window.clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(updatePostCards, 80);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', updatePostCards, { once: true });
    } else {
        updatePostCards();
    }

    window.addEventListener('resize', scheduleUpdate);
    document.addEventListener('pjax:complete', updatePostCards);
}());
