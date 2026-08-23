(function () {
    'use strict';

    if (typeof Intl === 'undefined' || typeof Intl.RelativeTimeFormat !== 'function') {
        return;
    }

    const locale = document.documentElement.lang || 'zh-CN';
    const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'always' });
    const units = [
        ['year', 365 * 24 * 60 * 60],
        ['month', 30 * 24 * 60 * 60],
        ['day', 24 * 60 * 60],
        ['hour', 60 * 60],
        ['minute', 60],
        ['second', 1]
    ];

    document.querySelectorAll('.article-meta time[datetime]').forEach(element => {
        const timestamp = Date.parse(element.getAttribute('datetime'));
        if (!Number.isFinite(timestamp)) {
            return;
        }

        const difference = (timestamp - Date.now()) / 1000;
        const [unit, seconds] = units.find(([, size]) => (
            Math.abs(difference) >= size
        )) || units[units.length - 1];
        element.textContent = formatter.format(Math.round(difference / seconds), unit);
    });
}());
