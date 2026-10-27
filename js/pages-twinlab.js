/* AeroFusion AI - Terminal Twin Lab: one module for the live twin (what-if, heatmap, operator mode), the Terminal A (AUH) 3D model with live passengers
   and floor cutaway (formerly Indoor 3D), and the critical use cases (formerly the Digital twin scenarios). */
(function () {
  'use strict';
  const AF = window.AF;
  const TABS = [['live', 'Live twin', 'what-if, heatmap, operator mode'], ['3d', 'Terminal A · AUH 3D', 'levels, live passengers'], ['cases', 'Critical use cases', 'scripted scenarios']];

  AF.pages.twinlab = function (view, arg, ctx) {
    view.classList.add('geo');
    const isCase = AF.twinScenarios && AF.twinScenarios.some((s) => s.id === arg);
    let tab = TABS.some((t) => t[0] === arg) ? arg : isCase ? 'cases' : 'live', caseArg = isCase ? arg : null, teardown = [];
    view.innerHTML = `<div class="tl-tabs" role="tablist">${TABS.map((t) => `<button role="tab" data-tab="${t[0]}"><b>${t[1]}</b><span>${t[2]}</span></button>`).join('')}</div><div class="tl-pane" id="tl-pane"></div>`;
    const pane = view.querySelector('#tl-pane');
    const clear = () => { teardown.forEach((f) => { try { f(); } catch (e) { /* ignore */ } }); teardown = []; pane.innerHTML = ''; pane.className = 'tl-pane'; };
    function show(t) {
      clear(); tab = t;
      view.querySelectorAll('[data-tab]').forEach((b) => { b.classList.toggle('on', b.dataset.tab === t); b.setAttribute('aria-selected', b.dataset.tab === t); });
      try { history.replaceState(null, '', '#/twinlab/' + (t === 'cases' && caseArg ? caseArg : t)); } catch (e) { /* ignore */ }
      if (t === 'live') pane.innerHTML = '<iframe class="tl-frame" src="twin-lab/?embed=1" title="Terminal Twin Lab" allow="fullscreen"></iframe>';
      else if (t === '3d') {
        pane.classList.add('tl-3d');
        window.TerminalA3D.mount(pane, { level: 'all', autorotate: false }).then((a) => { if (tab === '3d') teardown.push(() => a.dispose()); else a.dispose(); }).catch(() => { pane.textContent = '3D model unavailable'; });
      } else {
        const subs = [], sub = { cleanup: (fn) => subs.push(fn), on: (tg, ev, fn) => { tg.addEventListener(ev, fn); subs.push(() => tg.removeEventListener(ev, fn)); } };
        pane.classList.add('tl-cases'); AF.twinCases(pane, caseArg, sub); caseArg = null; teardown.push(() => subs.forEach((f) => f()));
      }
    }
    view.querySelector('.tl-tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b && b.dataset.tab !== tab) show(b.dataset.tab); });
    ctx.cleanup(clear);
    show(tab);
  };
})();
