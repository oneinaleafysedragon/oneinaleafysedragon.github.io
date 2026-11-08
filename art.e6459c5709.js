"use strict";
/* ============================== art (runs first so the loader can paint) ============================== */
function hashStr(s){ let h = 1779033703 ^ s.length; for (let i = 0; i < s.length; i++){ h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; } return () => { h = Math.imul(h ^ h >>> 16, 2246822507); h = Math.imul(h ^ h >>> 13, 3266489909); return (h ^= h >>> 16) >>> 0; }; }
function rng(seed){ let a = hashStr(seed)(); return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function catmull(pts, steps){
  const out = [];
  for (let i = 0; i < pts.length - 1; i++){
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    for (let s = 0; s < steps; s++){
      const t = s / steps, t2 = t * t, t3 = t2 * t;
      out.push([.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2*p0[0] - 5*p1[0] + 4*p2[0] - p3[0]) * t2 + (-p0[0] + 3*p1[0] - 3*p2[0] + p3[0]) * t3),
                .5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2*p0[1] - 5*p1[1] + 4*p2[1] - p3[1]) * t2 + (-p0[1] + 3*p1[1] - 3*p2[1] + p3[1]) * t3)]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}
function interp(prof, s){ for (let i = 1; i < prof.length; i++){ if (s <= prof[i][0]){ const [a, ra] = prof[i-1], [b, rb] = prof[i]; return ra + (rb - ra) * (s - a) / (b - a); } } return prof[prof.length - 1][1]; }
function leafShape(x, y, ang, len, w, lobes, fill, stroke){
  const pts = [], N = lobes * 2 + 1;
  for (let i = 0; i <= N; i++){ const u = i / N, bump = (i % 2 ? 1 : .55); pts.push([len * u, -w * Math.sin(Math.PI * Math.pow(u, .85)) * bump]); }
  for (let i = N; i >= 0; i--){ const u = i / N, bump = (i % 2 ? .55 : 1); pts.push([len * u, w * .8 * Math.sin(Math.PI * Math.pow(u, .85)) * bump]); }
  const c = Math.cos(ang), s = Math.sin(ang);
  const P = pts.map(([px, py]) => [x + px * c - py * s, y + px * s + py * c]);
  let d = `M${P[0][0].toFixed(1)},${P[0][1].toFixed(1)}`;
  for (let i = 1; i < P.length - 1; i++){ const mx = (P[i][0] + P[i+1][0]) / 2, my = (P[i][1] + P[i+1][1]) / 2; d += `Q${P[i][0].toFixed(1)},${P[i][1].toFixed(1)} ${mx.toFixed(1)},${my.toFixed(1)}`; }
  d += 'Z';
  const vx = x + len * .92 * c, vy = y + len * .92 * s;
  return `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width=".6" stroke-linejoin="round"/><path d="M${x.toFixed(1)},${y.toFixed(1)}L${vx.toFixed(1)},${vy.toFixed(1)}" stroke="${stroke}" stroke-width=".5" opacity=".6"/>`;
}
/* the seadragon, recast as a cold specimen: steel body, bone rim light, one red eye */
function seadragonSVG(opts){
  opts = Object.assign({leaves:10, id:'sd', cls:'', w:420, anim:true}, opts || {});
  const ctrl = [[70,62],[88,70],[108,66],[132,74],[156,86],[180,90],[204,84],[226,88],[244,102],[254,120],[250,136],[237,141],[227,132],[231,123]];
  const sp = catmull(ctrl, 10);
  const L = [0]; for (let i = 1; i < sp.length; i++) L.push(L[i-1] + Math.hypot(sp[i][0] - sp[i-1][0], sp[i][1] - sp[i-1][1]));
  const total = L[L.length - 1];
  const prof = [[0,7],[.05,5.2],[.1,6.2],[.28,9.5],[.42,8],[.58,5],[.78,2.8],[1,1]];
  const at = s => { const target = s * total; let i = 1; while (i < L.length - 1 && L[i] < target) i++; const f = (target - L[i-1]) / Math.max(.001, L[i] - L[i-1]); const p = [sp[i-1][0] + (sp[i][0] - sp[i-1][0]) * f, sp[i-1][1] + (sp[i][1] - sp[i-1][1]) * f]; const dx = sp[i][0] - sp[i-1][0], dy = sp[i][1] - sp[i-1][1]; const m = Math.hypot(dx, dy) || 1; return {p, nx:dy/m, ny:-dx/m}; };
  const left = [], right = [];
  for (let i = 0; i <= 80; i++){ const s = i / 80, a = at(s), r = interp(prof, s); left.push([a.p[0] + a.nx * r, a.p[1] + a.ny * r]); right.push([a.p[0] - a.nx * r, a.p[1] - a.ny * r]); }
  const outline = 'M' + left.map(p => p.map(v => v.toFixed(1)).join(',')).join('L') + 'L' + right.reverse().map(p => p.map(v => v.toFixed(1)).join(',')).join('L') + 'Z';
  let bands = '';
  for (let i = 1; i < 26; i++){ const s = .07 + i * .034; if (s > .95) break; const a = at(s), r = interp(prof, s) * .95; bands += `<path d="M${(a.p[0] + a.nx * r).toFixed(1)},${(a.p[1] + a.ny * r).toFixed(1)}L${(a.p[0] - a.nx * r * .6).toFixed(1)},${(a.p[1] - a.ny * r * .6).toFixed(1)}" stroke="#0e1b26" stroke-width="${(r * .2).toFixed(2)}" stroke-linecap="round" opacity=".55"/>`; }
  let spots = ''; const sr = rng('spots');
  for (let i = 0; i < 18; i++){ const s = .06 + sr() * .6, a = at(s), r = interp(prof, s), o = (sr() - .5) * r * 1.2; spots += `<circle cx="${(a.p[0] + a.nx * o).toFixed(1)}" cy="${(a.p[1] + a.ny * o).toFixed(1)}" r="${(.5 + sr() * .9).toFixed(1)}" fill="#c9d6dc" opacity=".55"/>`; }
  const clusters = [[.06,1,9,2],[.15,1,15,3],[.2,-1,13,2],[.3,1,19,3],[.34,-1,17,3],[.45,1,16,3],[.5,-1,15,3],[.62,1,13,2],[.67,-1,12,2],[.78,1,10,2],[.86,-1,9,2],[.24,1,11,2],[.4,-1,11,2],[.55,1,10,2],[.72,-1,9,2]].slice(0, opts.leaves);
  const lr = rng('leaves'); let leaves = '';
  const fills = ['#2c4656','#36525f','#243f52','#3d5a68','#1d3442'];
  clusters.forEach(([s, side, len, n], ci) => {
    const a = at(s), r = interp(prof, s);
    const bx = a.p[0] + a.nx * r * side * .8, by = a.p[1] + a.ny * r * side * .8;
    const baseAng = Math.atan2(a.ny * side, a.nx * side) + (side > 0 ? .25 : -.2);
    const ex = bx + Math.cos(baseAng) * len * .55, ey = by + Math.sin(baseAng) * len * .55;
    let g = `<path d="M${bx.toFixed(1)},${by.toFixed(1)}Q${((bx + ex) / 2 + (lr() - .5) * 4).toFixed(1)},${((by + ey) / 2).toFixed(1)} ${ex.toFixed(1)},${ey.toFixed(1)}" stroke="#4a6372" stroke-width="1.4" fill="none" stroke-linecap="round"/>`;
    for (let k = 0; k < n; k++){ const ang = baseAng + (k - (n - 1) / 2) * .62 + (lr() - .5) * .2; g += leafShape(ex, ey, ang, len * (.75 + lr() * .45), len * .26, 2 + Math.floor(lr() * 2), fills[(ci + k) % fills.length], '#7f96a3'); }
    leaves += opts.anim ? `<g class="sway" style="transform-origin:${bx.toFixed(1)}px ${by.toFixed(1)}px;animation-delay:${(-ci * .7).toFixed(1)}s;animation-duration:${(5 + (ci % 3)).toFixed(1)}s">${g}</g>` : `<g>${g}</g>`;
  });
  const snout = `<path d="M66,60 C52,63 40,68 27,73 L25,71.2 C21,72 19,75 21,77 C24,78.5 27,77 28,75.5 C41,72 54,69 67,67 Z" fill="url(#${opts.id}b)" stroke="#a9bcc6" stroke-width=".6"/>`;
  const fin = `<path d="M196,82 C202,70 214,70 222,82" fill="rgba(201,214,220,.12)" stroke="rgba(201,214,220,.4)" stroke-width=".5"/><path d="M98,72 C94,80 99,85 104,82" fill="rgba(201,214,220,.14)" stroke="rgba(201,214,220,.4)" stroke-width=".5"/>`;
  const eye = `<circle cx="69" cy="61.5" r="3.4" fill="#05080c"/><circle cx="69" cy="61.5" r="2.2" fill="#b3131f"/><circle cx="68.2" cy="60.6" r=".7" fill="#ffd0d4"/><circle cx="69" cy="61.5" r="5" fill="none" stroke="rgba(224,49,61,.25)" stroke-width=".8"/>`;
  return `<svg class="${opts.cls}" viewBox="10 20 270 140" width="${opts.w}" role="img" aria-label="A leafy seadragon"><defs><linearGradient id="${opts.id}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a9bcc6"/><stop offset=".45" stop-color="#5d7684"/><stop offset="1" stop-color="#243f52"/></linearGradient><filter id="${opts.id}g"><feGaussianBlur stdDeviation="2.5"/></filter></defs><g class="${opts.anim ? 'bobsd' : ''}">${leaves}${fin}<path d="${outline}" fill="url(#${opts.id}b)" stroke="#a9bcc6" stroke-width=".7"/>${bands}${spots}${snout}${eye}</g></svg>`;
}
/* film grain tile, made once */
(function(){
  try{
    const c = document.createElement('canvas'); c.width = c.height = 160; const g = c.getContext('2d'); const d = g.createImageData(160, 160);
    for (let i = 0; i < d.data.length; i += 4){ const v = Math.random() * 255 | 0; d.data[i] = d.data[i+1] = d.data[i+2] = v; d.data[i+3] = 255; }
    g.putImageData(d, 0, 0); document.getElementById('grain').style.backgroundImage = `url(${c.toDataURL()})`;
  }catch(e){}
})();
/* ---------- boot loader: sonar sweep, boot log, progress ---------- */
const BOOT_T0 = performance.now();
const BOOT_MS = 4600;
const BOOT_TOTAL = 43781;
const BOOT_PROMPTS = 221;
document.getElementById('loaderIcon').innerHTML = seadragonSVG({id:'ld', w:260, leaves:12});
(function(){
  const son = document.getElementById('sonar');
  [.32, .56, .8].forEach(f => { const r = document.createElement('div'); r.className = 'ring'; r.style.inset = ((1 - f) * 50) + '%'; son.appendChild(r); });
  for (let i = 0; i < 7; i++){ const b = document.createElement('div'); b.className = 'blip'; const a = Math.random() * 6.28, d = 18 + Math.random() * 28; b.style.left = (50 + Math.cos(a) * d) + '%'; b.style.top = (50 + Math.sin(a) * d) + '%'; b.style.animationDelay = ((a / 6.28) * 3) + 's'; son.appendChild(b); }
  const fmtN = n => n.toLocaleString('en-US');
  const LOG = [
    [0, '> OLSD DIVE SYSTEM <b>v3.0</b> // COLD START'],
    [500, '> PRESSURE HULL ................ <b>SEALED</b>'],
    [1100, '> SONAR ARRAY .................. <b>ONLINE</b>'],
    [1700, `> INDEXING ${fmtN(BOOT_PROMPTS)} PROMPTS ......... <b>OK</b>`],
    [2400, `> LOADING ${fmtN(BOOT_TOTAL)} ANSWERS ...... <b>OK</b>`],
    [3100, '> TYPO FORGIVENESS ............. <b>ARMED</b>'],
    [3700, '> BALLAST ...................... <b>READY</b>'],
    [4200, '> AWAITING DIVER']
  ];
  const STAGES = ['INITIALISING', 'SEALING HULL', 'SONAR', 'INDEXING', 'LOADING ANSWERS', 'CALIBRATING', 'BALLAST', 'READY'];
  const log = document.getElementById('llog'), bar = document.getElementById('lbar'), pct = document.getElementById('lpct'), stage = document.getElementById('lstage'), clock = document.getElementById('lclock');
  const tick = () => {
    const el = document.getElementById('loader'); if (!el || el.classList.contains('gone')) return;
    const t = performance.now() - BOOT_T0, p = Math.min(1, t / BOOT_MS);
    const eased = p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
    bar.style.width = (eased * 100) + '%';
    pct.textContent = String(Math.round(eased * 100)).padStart(3, '0') + '%';
    const shown = LOG.filter(l => l[0] <= t);
    log.innerHTML = shown.slice(-6).map(l => l[1]).join('\n');
    stage.textContent = STAGES[Math.min(STAGES.length - 1, shown.length - 1)] || STAGES[0];
    const s = Math.floor(t / 1000); clock.textContent = 'T+00:' + String(s).padStart(2, '0') + '.' + String(Math.floor(t % 1000 / 10)).padStart(2, '0');
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
})();
