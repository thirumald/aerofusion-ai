/* AeroFusion AI - Real video library page. */
(function () {
  'use strict';
  const AF = window.AF, ui = AF.ui, { esc } = ui, Lib = AF.videoLibrary;
  const vid = (c, cls) => `<video class="${cls || ''}" controls muted loop playsinline preload="metadata"><source src="${c.file}.mp4" type="video/mp4"><source src="${c.file}.webm" type="video/webm"></video>`;
  AF.pages.library = function (view) {
    const q = { direct: ['ok', 'real, direct'], indicative: ['warn', 'real, similar setting'], none: ['crit', 'no real footage'] };
    const byId = Object.fromEntries(Lib.clips.map((c) => [c.id, c]));
    view.innerHTML = `<div class="page-h"><h2>Real video library</h2><p class="mut">Every clip here is real video kept in the <span class="mono">footage</span> folder. Each use case is matched to the closest real clip, and the cases with no real footage are listed with the reason.</p></div>
      <div class="grid g-3">${Lib.clips.map((c) => `<section class="card"><div class="cpv sm">${vid(c)}</div><div class="pad"><h3>${esc(c.title)}</h3><p class="sm mut">${esc(c.note)}</p><p class="sm"><b>Source:</b> ${esc(c.src)}<br><b>Licence:</b> ${esc(c.lic)}</p>${c.cam ? `<a class="btn sm" href="#/cameras/${c.cam}">Open as ${c.cam}</a>` : ''}</div></section>`).join('')}</div>
      <section class="card"><div class="card-h"><h3>Use cases and their footage</h3><span class="mut sm">${Lib.cases.filter((c) => c.q !== 'none').length} of ${Lib.cases.length} have real footage</span></div><div class="tscroll"><table class="t"><thead><tr><th>Use case</th><th>Blueprint rows</th><th>Real footage</th><th>Match</th></tr></thead><tbody>
        ${Lib.cases.map((c) => `<tr><td>${esc(c.uc)}</td><td class="mono sm">${esc(c.rows)}</td><td>${c.clip ? esc(byId[c.clip].title) : `<span class="sm mut">${esc(c.why)}</span>`}</td><td>${ui.badge(q[c.q][0], q[c.q][1])}</td></tr>`).join('')}</tbody></table></div></section>`;
  };
})();
