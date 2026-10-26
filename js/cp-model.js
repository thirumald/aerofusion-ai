/* AeroFusion AI - turns the labelled checkpoint video (AF.cpLabels) into per-person and per-bag state over time,
 * including an illustrative multimodal fusion score. Pure functions of time; no DOM. */
(function () {
  'use strict';
  const AF = (window.AF = window.AF || {}), L = AF.cpLabels;
  if (!L) return;
  AF.cpSensors = [
    { k: 'mmw', name: 'Millimeter-wave body scanner', w: 0.3 },
    { k: 'xray', name: 'Dual-view X-ray (owner bag)', w: 0.35 },
    { k: 'optical', name: 'Optical and pose (localised check)', w: 0.15 },
    { k: 'trace', name: 'Trace detector', w: 0.1 },
    { k: 'behavior', name: 'Behaviour analytics', w: 0.1 },
  ];
  /* channel value appears at the time the video shows the evidence: [time, score]. Scores are illustrative. */
  const CH = {
    'ID 01': { mmw: [13, 80], xray: [22, 92], optical: [20, 85] },
    'ID 02': { mmw: [14, 6], xray: [5.5, 4] },
    'ID 03': { xray: [8, 95], mmw: [17, 78], optical: [26.5, 85] },
  };
  const FIRST = { 'ID 02': 0, 'ID 03': 1, 'ID 01': 11 };
  const STATUS = { track: 'Tracked', bag_on_belt: 'Bag on belt', scanner_alarm: 'Body scanner ALARM', scanner_clear: 'Cleared at scanner', secondary: 'Secondary screening', owner_link: 'Owner of flagged bag', owner_confirm: 'Bag owner confirmed', xray_flag: 'Owner of flagged bag', xray_clear: 'Bag cleared' };
  const verdict = (f) => (f < 35 ? ['CLEAR', 'ok'] : f < 60 ? ['TARGETED CHECK', 'warn'] : ['ESCALATE', 'crit']);
  AF.cpVerdict = verdict;

  function fuse(ch) {
    let sw = 0, sum = 0, agree = 0;
    for (const s of AF.cpSensors) { const v = ch[s.k]; if (v == null) continue; sw += s.w; sum += s.w * v; if (v >= 50) agree++; }
    if (!sw) return { score: 0, agree: 0, bonus: 0, raw: 0 };
    const raw = sum / sw, bonus = agree >= 3 ? 10 : 0;
    return { score: Math.min(100, Math.round(raw + bonus)), raw, agree, bonus };
  }

  AF.cpState = function (t) {
    const ev = L.events.filter((e) => e.t <= t);
    const people = L.people.map((p) => {
      const visible = t >= FIRST[p.id], mine = ev.filter((e) => e.entity === p.id);
      const last = mine.length ? mine[mine.length - 1] : null;
      const channels = {};
      AF.cpSensors.forEach((s) => { const c = (CH[p.id] || {})[s.k]; channels[s.k] = c && t >= c[0] ? c[1] : null; });
      const f = fuse(channels), sec = [...mine].reverse().find((e) => e.type === 'secondary');
      return { id: p.id, color: p.color, bag: p.bag, visible, status: sec ? 'Secondary screening' : last ? STATUS[last.type] || 'Tracked' : 'Tracked', where: sec ? sec.where : null, channels, fused: f.score, agree: f.agree, bonus: f.bonus, raw: f.raw, decision: Object.values(channels).some((v) => v != null) ? verdict(f.score) : null };
    });
    const bags = L.bags.map((b) => {
      const flag = ev.find((e) => e.bag === b.id && (e.type === 'xray_flag' || e.type === 'xray_clear'));
      const scanning = ev.some((e) => e.bag === b.id && e.type === 'xray_scan');
      const link = ev.find((e) => e.bag === b.id && (e.type === 'bag_on_belt' || e.type === 'owner_link'));
      const confirm = ev.find((e) => e.bag === b.id && e.type === 'owner_confirm');
      return { id: b.id, result: flag ? flag.result : null, scanning, owner: link ? link.entity : null, ownerAt: link ? link.t : null, confirmed: !!confirm, seen: ev.some((e) => e.bag === b.id) };
    });
    return { t, people, bags, events: ev };
  };
})();
