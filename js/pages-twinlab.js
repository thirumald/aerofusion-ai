/* AeroFusion AI - Terminal Twin Lab: embeds the self-contained twin-lab app (3D twin, what-if branching, operator mode) inside the console. */
(function () {
  'use strict';
  const AF = window.AF;
  AF.pages.twinlab = function (view) {
    view.classList.add('geo');
    view.innerHTML = '<iframe class="tl-frame" src="twin-lab/?embed=1" title="Terminal Twin Lab" allow="fullscreen" loading="eager"></iframe>';
  };
  AF.pages.auhlayout = function (view) {
    view.classList.add('geo');
    view.innerHTML = '<iframe class="tl-frame" src="twin-lab/auh-layout.html" title="AUH digital twin layout" loading="eager"></iframe>';
  };
})();
