/* AeroFusion AI - inline SVG icon set (24px grid, 1.8 stroke, round caps). AF.icon(name, size) returns markup. */
(function () {
  'use strict';
  const AF = (window.AF = window.AF || {});
  const P = {
    dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18"/>',
    map: '<path d="M3 6.5l6-2.5 6 2.5 6-2.5v13.5l-6 2.5-6-2.5-6 2.5z"/><path d="M9 4v13.5M15 6.5V20"/>',
    cube: '<path d="M12 2.5l8.5 4.8v9.4L12 21.5l-8.5-4.8V7.3z"/><path d="M3.5 7.3L12 12l8.5-4.7M12 12v9.5"/>',
    briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3 13h18"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><circle cx="17" cy="9" r="2.5"/><path d="M17.5 14.2c2.4.4 4 2.3 4 5.3"/>',
    car: '<path d="M5 16l1.6-5.2a2 2 0 0 1 1.9-1.4h7a2 2 0 0 1 1.9 1.4L19 16"/><rect x="3" y="16" width="18" height="4" rx="1.5"/><path d="M6.5 20v1.5M17.5 20v1.5"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
    video: '<rect x="2.5" y="6" width="13" height="12" rx="2"/><path d="M15.5 10.5L21.5 7v10l-6-3.5z"/>',
    film: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/>',
    scan: '<path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16"/><path d="M4 12h16"/>',
    layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 12.5l9 5 9-5M3 17l9 5 9-5"/>',
    crosshair: '<circle cx="12" cy="12" r="7.5"/><path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4"/><circle cx="12" cy="12" r="1.5"/>',
    alert: '<path d="M12 3.5l10 17.5H2z"/><path d="M12 10v5M12 18v.4"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M2.5 20.5h19"/>',
    bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l2 2H4z"/><path d="M10 21a2 2 0 0 0 4 0"/>',
    route: '<circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M8 19h6.5a3 3 0 0 0 0-6h-5a3 3 0 0 1 0-6H16"/>',
    shield: '<path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6z"/><path d="M9 12l2.2 2.2L15.5 10"/>',
    menu: '<path d="M4 6.5h16M4 12h16M4 17.5h16"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
    maximize: '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>',
    reset: '<path d="M3.5 12a8.5 8.5 0 1 0 2.7-6.2"/><path d="M3.5 4v4.5H8"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    play: '<path d="M8 5l11 7-11 7z"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    sparkles: '<path d="M11 3l1.8 5.2L18 10l-5.2 1.8L11 17l-1.8-5.2L4 10l5.2-1.8z"/><path d="M19 15l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
    moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
    radio: '<circle cx="12" cy="12" r="2"/><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M4.9 4.9a10 10 0 0 0 0 14.2M19.1 4.9a10 10 0 0 1 0 14.2"/>',
    plane: '<path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z"/>',
    check: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.7 2.7L16 9.5"/>',
    activity: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
    cpu: '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2.5v3.5M15 2.5v3.5M9 18v3.5M15 18v3.5M2.5 9H6M2.5 15H6M18 9h3.5M18 15h3.5"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6"/>',
    chevron: '<path d="M6 9l6 6 6-6"/>',
    flag: '<path d="M5 21V4M5 4h11l-1.5 4L16 12H5"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',
    wrench: '<path d="M14.5 6.5a4 4 0 0 0 5 5l-1.4 1.4-1.6-1.6-7.6 7.6a2 2 0 0 1-2.8-2.8l7.6-7.6L11.9 7z"/>',
    tower: '<path d="M9 21l1.5-9h3L15 21M7 12h10l1-4H6zM12 8V3"/>',
    lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    logout: '<path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M15 8l4 4-4 4M19 12H9"/>',
    dot: '<circle cx="12" cy="12" r="3"/>',
  };
  AF.icon = function (name, size, cls) {
    const body = P[name] || P.dot, s = size || 18;
    return `<svg class="ic ${cls || ''}" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
  };
  AF.iconNames = Object.keys(P);
})();
