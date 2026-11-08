"use strict";
/* ============================== answer matching ==============================
   Forgive accents, plurals,
   British/American spelling, phonetic equivalents and small typos, but never
   "correct" a short input into a different answer. Every rule is applied to both
   the stored answers and the player's input, so it can only ever merge spellings. */
const STOP_LEAD = /^(the|a|an) /;
const TOKEN_SUB = {st:'saint', ste:'sainte', mt:'mount', ft:'fort', n:'and', dr:'doctor', mr:'mister', mrs:'missus', vs:'versus', '1st':'first', '2nd':'second', '3rd':'third'};
const GENERIC = new Set(['river','lake','loch','mount','mountain','mountains','island','islands','isle','sea','ocean','desert','city','town','fc','cf','afc','club','national','park','falls','fall','waterfall','volcano','battle','of','the','and','band','group','dog','cat','breed','tree','plant','flower','fish','bird','shark','whale','dolphin','snake','beetle','moth','butterfly','sauce','soup','cake','bread','pie','tea','beer','pose','style','language','dance','game','film','movie','show','series','king','queen','saint','sir','lord','lady','emperor','president']);
function norm(s){
  s = String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  s = s.replace(/ß/g, 'ss').replace(/æ/g, 'ae').replace(/œ/g, 'oe').replace(/ø/g, 'o').replace(/ð/g, 'd').replace(/þ/g, 'th').replace(/ł/g, 'l').replace(/ı/g, 'i');
  s = s.replace(/&/g, ' and ').replace(/\+/g, ' plus ').replace(/['’`‘´]/g, '');
  s = s.replace(/[^a-z0-9]+/g, ' ').trim();
  s = s.split(' ').map(w => TOKEN_SUB[w] || w).join(' ').replace(STOP_LEAD, '');
  return s.replace(/ /g, '');
}
function tokens(s){
  s = String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/&/g, ' and ').replace(/['’`]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  return s ? s.split(' ').map(w => TOKEN_SUB[w] || w) : [];
}
/* phonetic / regional spelling canon: colour=color, centre=center, analyse=analyze,
   Tchaikovsky=Chaikovski, Lamborgini=Lamborghini, Kirgizstan=Kyrgyzstan, broccoli=brocoli */
function canon(k){
  let s = k;
  s = s.replace(/ph/g, 'f').replace(/ck/g, 'k').replace(/q/g, 'k').replace(/x/g, 'ks');
  s = s.replace(/ae/g, 'e').replace(/oe/g, 'e').replace(/our/g, 'or');
  s = s.replace(/gue$/, 'g').replace(/re$/, 'er').replace(/res$/, 'ers');
  s = s.replace(/y/g, 'i').replace(/z/g, 's').replace(/ei/g, 'ie');
  s = s.replace(/c(?=[eis])/g, 's').replace(/c/g, 'k');
  s = s.replace(/([kgtrdbsw])h/g, '$1');
  s = s.replace(/w(?=[r])/g, '');
  s = s.replace(/(.)\1+/g, '$1');
  return s;
}
function singulars(k){
  const out = [];
  if (k.length > 4 && k.endsWith('ies')) out.push(k.slice(0, -3) + 'y');
  if (k.length > 4 && k.endsWith('ves')) out.push(k.slice(0, -3) + 'f', k.slice(0, -3) + 'fe');
  if (k.length > 4 && /(ses|xes|zes|ches|shes|oes)$/.test(k)) out.push(k.slice(0, -2));
  if (k.length > 3 && k.endsWith('s') && !k.endsWith('ss')) out.push(k.slice(0, -1));
  if (k.length > 4 && k.endsWith('i')) out.push(k.slice(0, -1) + 'us');
  if (k.length > 4 && k.endsWith('ae')) out.push(k.slice(0, -1));
  if (k.length > 4 && k.endsWith('men')) out.push(k.slice(0, -3) + 'man');
  return out;
}
/* weighted Damerau-Levenshtein: a slip onto a neighbouring key, a vowel swap or two
   swapped letters costs less than an unrelated letter */
const KB = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
const ADJ = {};
(function(){
  const pos = {};
  KB.forEach((row, r) => [...row].forEach((ch, c) => pos[ch] = [r, c + r * .5]));
  for (const a in pos) { ADJ[a] = new Set(); for (const b in pos) { if (a === b) continue; const dr = Math.abs(pos[a][0] - pos[b][0]), dc = Math.abs(pos[a][1] - pos[b][1]); if (dr <= 1 && dc <= 1.01) ADJ[a].add(b); } }
})();
const VOW = new Set(['a','e','i','o','u','y']);
function subCost(a, b){
  if (a === b) return 0;
  if (VOW.has(a) && VOW.has(b)) return .5;
  if (ADJ[a] && ADJ[a].has(b)) return .6;
  return 1;
}
function indelCost(s, i){
  const ch = s[i];
  if (i > 0 && s[i - 1] === ch) return .4;                 // doubled letter
  if (i + 1 < s.length && s[i + 1] === ch) return .4;
  if (VOW.has(ch)) return .8;
  if (ch === 'h') return .7;
  return 1;
}
function wdist(a, b, max){
  if (Math.abs(a.length - b.length) > max + 1) return max + 1;
  const m = a.length, n = b.length;
  let pp = null, p = new Array(n + 1), c;
  p[0] = 0; for (let j = 1; j <= n; j++) p[j] = p[j - 1] + indelCost(b, j - 1);
  for (let i = 1; i <= m; i++){
    c = new Array(n + 1); c[0] = p[0] + indelCost(a, i - 1); let best = c[0];
    for (let j = 1; j <= n; j++){
      let v = Math.min(p[j] + indelCost(a, i - 1), c[j - 1] + indelCost(b, j - 1), p[j - 1] + subCost(a[i - 1], b[j - 1]));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, pp[j - 2] + .6);
      c[j] = v; if (v < best) best = v;
    }
    if (best > max) return max + 1;
    pp = p; p = c;
  }
  return p[n];
}
/* how many slips we forgive, by length; word puzzles are stricter */
function budget(len, strict){
  if (strict) return len <= 4 ? 0 : len <= 7 ? .8 : len <= 11 ? 1.2 : 1.8;
  return len <= 3 ? 0 : len === 4 ? .6 : len <= 6 ? 1 : len <= 9 ? 1.6 : len <= 13 ? 2.2 : 2.8;
}
const TIER_RANK = {P:0, T:1, S:2, R:3, D:4, G:5};
/* a real, common English word that isn't on the list was probably meant as itself,
   so it only gets the lightest forgiveness (one slipped key or vowel) */
let COMMON = new Set();
function setCommon(str){ COMMON = new Set(String(str || '').split(' ')); }
const MINDEX = {};
function matchIndex(p){
  if (MINDEX[p.id]) return MINDEX[p.id];
  const exact = new Map(), canonMap = new Map(), keys = [];
  const add = (map, k, ref) => { if (!k) return; let a = map.get(k); if (!a) map.set(k, a = []); if (!a.some(r => r.t === ref.t && r.i === ref.i)) a.push(ref); };
  for (const t of ['P','T','S','R','D','G']){
    (p.t[t] || []).forEach((ans, i) => {
      const ref = {t, i};
      for (const name of ans.split('|')){
        const k = norm(name); if (!k) continue;
        add(exact, k, ref);
        if (!p.strict){
          add(canonMap, canon(k), ref);
          for (const s of singulars(k)) add(exact, s, Object.assign({soft:true}, ref));
          const tk = tokens(name), core = tk.filter(w => !GENERIC.has(w));
          if (core.length && core.length < tk.length){ const ck = core.join(''); if (ck.length >= 4) add(exact, ck, Object.assign({soft:true, core:true}, ref)); }
        } else {
          for (const s of singulars(k)) add(exact, s, Object.assign({soft:true}, ref));
        }
        keys.push({k, c: p.strict ? k : canon(k), ref});
      }
    });
  }
  return MINDEX[p.id] = {exact, canonMap, keys};
}
function pickRef(list, prefer){
  if (!list || !list.length) return null;
  const hard = list.filter(r => !r.soft); const pool = hard.length ? hard : list;
  if (pool.length === 1) return pool[0];
  // several answers share this spelling: the more familiar one wins, so garbling can never earn points
  return pool.slice().sort((a, b) => TIER_RANK[a.t] - TIER_RANK[b.t])[0];
}
function judge(p, input){
  const raw = String(input || '').trim();
  const k = norm(raw);
  if (k.length < 2) return null;
  const ix = matchIndex(p);
  let ref = pickRef(ix.exact.get(k)), how = 'exact';
  if (!ref) for (const s of singulars(k)){ ref = pickRef(ix.exact.get(s)); if (ref){ how = 'plural'; break; } }
  if (!ref){ const r2 = ix.exact.get(k + 's') || ix.exact.get(k + 'es'); if (r2){ ref = pickRef(r2.filter(r => !r.soft)); if (ref) how = 'plural'; } }
  if (!ref && !p.strict){
    const tk = tokens(raw), core = tk.filter(w => !GENERIC.has(w)).join('');
    if (core.length >= 4 && core !== k){ ref = pickRef(ix.exact.get(core)); if (ref) how = 'core'; }
  }
  if (!ref && !p.strict && k.length >= 4){
    // a phonetic twin still has to look like what was typed
    if (COMMON.has(k) && k.length < 7) { /* skip phonetic twins for everyday words */ } else {
    const near = list => (list || []).filter(r => p.t[r.t][r.i].split('|').some(n => wdist(k, norm(n), 9) <= budget(k.length) + .8));
    ref = pickRef(near(ix.canonMap.get(canon(k)))); if (ref) how = 'spelling';
    if (!ref) for (const s of singulars(k)){ ref = pickRef(near(ix.canonMap.get(canon(s)))); if (ref){ how = 'spelling'; break; } }
    }
  }
  if (!ref){
    const isWord = COMMON.has(k);
    const max = isWord ? (k.length >= 5 ? .6 : 0) : budget(k.length, p.strict);
    if (max > 0){
      const kc = p.strict ? k : canon(k);
      let best = null, bd = max + .001;
      for (const e of ix.keys){
        if (Math.abs(e.k.length - k.length) > max + 2) continue;
        const lead = e.k[0] === k[0] ? 0 : .3;   // typos rarely hit the first letter
        let d = wdist(k, e.k, Math.min(bd, max)) + lead;
        if (!p.strict && d > lead){ const d2 = wdist(kc, e.c, Math.min(bd, max)) + .15 + (e.c[0] === kc[0] ? 0 : .3); if (d2 < d) d = d2; }
        if (d < bd - 1e-9 || (Math.abs(d - bd) < 1e-9 && best && TIER_RANK[e.ref.t] < TIER_RANK[best.t])){ bd = d; best = e.ref; }
      }
      if (best && bd <= max){ ref = best; how = 'typo'; }
    }
  }
  if (!ref) return null;
  const ans = p.t[ref.t][ref.i], name = ans.split('|')[0];
  return {t:ref.t, i:ref.i, ans, name, how, fuzzy: how === 'typo' || how === 'spelling', renamed: norm(name) !== k};
}
if (typeof module !== 'undefined') module.exports = {norm, canon, judge, wdist, budget, matchIndex, setCommon};

/* ============================== icon set ==============================
   One field-guide line style: 64-unit grid, 1.8 stroke, round joins, a faint same-colour fill
   for body mass. Tiers are creatures that live deeper as the tier rises. */
const ICON_PATHS = {
  P: c => `<g fill="${c}" fill-opacity=".14"><circle cx="22" cy="24" r="5.5"/><circle cx="40" cy="19" r="3.6"/><circle cx="36" cy="38" r="7"/><circle cx="19" cy="43" r="3"/><circle cx="49" cy="33" r="2.4"/></g>
      <g><circle cx="22" cy="24" r="5.5"/><circle cx="40" cy="19" r="3.6"/><circle cx="36" cy="38" r="7"/><circle cx="19" cy="43" r="3"/><circle cx="49" cy="33" r="2.4"/><circle cx="36" cy="38" r="2" fill="${c}"/><circle cx="22" cy="24" r="1.4" fill="${c}"/><path d="M33 33 l-3 -4 M41 35 l4 -3 M39 44 l3 4 M31 43 l-4 3"/><circle cx="29" cy="52" r=".9" fill="${c}"/><circle cx="51" cy="47" r=".9" fill="${c}"/><circle cx="12" cy="31" r=".9" fill="${c}"/></g>`,
  T: c => `<path d="M17 32 C17 22 25 16 32 16 C41 16 47 23 47 32 C47 41 41 48 32 48 C25 48 17 42 17 32Z" fill="${c}" fill-opacity=".14"/>
      <path d="M17 32 C17 22 25 16 32 16 C41 16 47 23 47 32 C47 41 41 48 32 48 C25 48 17 42 17 32Z"/><path d="M47 32 L56 25 L54 32 L56 39Z"/><circle cx="24" cy="28" r="2.4"/><circle cx="24.6" cy="27.4" r=".8" fill="${c}"/><path d="M18.5 35 q2 2 4.5 0"/>
      <path d="M23 18 l-2.5 -4 M32 16 v-4.5 M41 18 l2.5 -4 M46 24 l4 -2 M17.5 25 l-4 -2 M16.5 38 l-4 2 M22 46 l-2.5 4 M32 48 v4.5 M41 46 l2.5 4"/><path d="M30 26 l1.2 1.2 M37 24 l1.2 1.2 M35 33 l1.2 1.2 M28 38 l1.2 1.2 M40 39 l1.2 1.2"/>`,
  S: c => { const f = (x, y, s) => `<path d="M${x} ${y} c${5*s} ${-5*s} ${13*s} ${-5*s} ${18*s} 0 c${-5*s} ${5*s} ${-13*s} ${5*s} ${-18*s} 0Z" fill="${c}" fill-opacity=".16"/><path d="M${x} ${y} c${5*s} ${-5*s} ${13*s} ${-5*s} ${18*s} 0 c${-5*s} ${5*s} ${-13*s} ${5*s} ${-18*s} 0Z M${x + 18*s} ${y} l${5*s} ${-4*s} v${8*s}Z"/><circle cx="${x + 4.2*s}" cy="${y - .6*s}" r="${.9*s}" fill="${c}"/>`; return f(10, 22, 1) + f(28, 34, 1) + f(8, 46, .9); },
  R: c => `<path d="M19 31 C19 21 25 14 32 14 C39 14 45 21 45 31 C45 35 43 37 40 38 L24 38 C21 37 19 35 19 31Z" fill="${c}" fill-opacity=".14"/>
      <path d="M19 31 C19 21 25 14 32 14 C39 14 45 21 45 31 C45 35 43 37 40 38 L24 38 C21 37 19 35 19 31Z"/><circle cx="27" cy="29" r="2.4"/><circle cx="37" cy="29" r="2.4"/><path d="M27 29 h0.1 M37 29 h0.1" stroke-width="2.4"/>
      <path d="M23 38 C19 44 15 45 11 44 M27 38 C25 46 22 51 18 53 M32 38 C32 46 31 51 28 55 M37 38 C39 46 42 51 46 53 M41 38 C45 44 49 45 53 44"/><circle cx="12" cy="48" r=".9" fill="${c}"/><circle cx="51" cy="48" r=".9" fill="${c}"/>`,
  D: c => `<path d="M10 37 C12 26 22 22 32 23 C43 24 51 30 53 38 C46 45 36 48 26 46 C18 45 12 42 10 37Z" fill="${c}" fill-opacity=".14"/>
      <path d="M10 37 C12 26 22 22 32 23 C43 24 51 30 53 38 C46 45 36 48 26 46 C18 45 12 42 10 37Z"/><path d="M53 38 L60 31 L59 39 L60 46Z"/>
      <path d="M12 37 l3 4 l3 -4.5 l3 4.5 l3 -4.5 l3 4" /><circle cx="36" cy="31" r="2.6"/><circle cx="36" cy="31" r=".9" fill="${c}"/>
      <path d="M28 23 C27 14 33 9 40 10" /><circle cx="41.5" cy="10.5" r="3.2" fill="#E0313D" stroke="#E0313D"/><circle cx="41.5" cy="10.5" r="6.5" fill="#E0313D" fill-opacity=".18" stroke="none"/>`,
  G: c => { const leaf = (x, y, a, l) => { const r = a * Math.PI / 180, ex = x + Math.cos(r) * l, ey = y + Math.sin(r) * l, nx = -Math.sin(r) * l * .32, ny = Math.cos(r) * l * .32; return `<path d="M${x} ${y} Q${(x + ex) / 2 + nx} ${(y + ey) / 2 + ny} ${ex.toFixed(1)} ${ey.toFixed(1)} Q${(x + ex) / 2 - nx} ${(y + ey) / 2 - ny} ${x} ${y}Z" fill="${c}" fill-opacity=".22"/>`; };
      return `<path d="M5 21 L15 23.5" stroke-width="2.2"/>
      <path d="M15 23.5 C17 19.5 22 19 25 21.5 C29 25 33 25 37 24 C44 22.5 50 27 50 35 C50 43 44 48 39 46 C35 44.5 36 40 39.5 40.5" stroke-width="2"/>
      <path d="M15 23.5 C18 27.5 22 28 26 27.5 C31 27 34 28.5 37 30 C42 32.5 44 36 43 39" stroke-width="1.6" stroke-opacity=".7"/>
      ${leaf(22, 20.5, -100, 9)}${leaf(28, 23.5, -70, 11)}${leaf(36, 23.5, -95, 10)}${leaf(44, 25, -40, 10)}${leaf(49, 33, 0, 9)}${leaf(27, 27.5, 110, 9)}${leaf(36, 29.5, 80, 10)}${leaf(46, 44, 60, 8)}
      <circle cx="18.5" cy="22.5" r="1.6" fill="#E0313D" stroke="#E0313D"/>`; },
  X: c => `<path d="M14 46 v-5 M22 46 v-10 M30 46 v-5 M38 46 v-3"/><path d="M14 46 h28" stroke-opacity=".4"/><path d="M45 18 l12 12 M57 18 l-12 12" stroke="#E0313D"/>`,
  daily: c => `<circle cx="32" cy="32" r="19"/><circle cx="32" cy="32" r="14" stroke-opacity=".35"/><path d="M32 10 v5 M32 49 v5 M10 32 h5 M49 32 h5"/><path d="M32 19 L37 32 L32 45 L27 32Z" fill="${c}" fill-opacity=".18"/><path d="M32 19 L37 32 L27 32Z" fill="#E0313D" stroke="#E0313D" fill-opacity=".85"/><circle cx="32" cy="32" r="1.6" fill="${c}"/>`,
  unlimited: c => `<path d="M32 32 C27 23 13 22 13 32 C13 42 27 41 32 32 C37 23 51 22 51 32 C51 42 37 41 32 32Z"/><path d="M18 28 l2 2 M23 26 l1 3 M28 28 l0 3 M36 36 l0 -3 M41 38 l-1 -3 M46 36 l-2 -2" stroke-opacity=".5"/><path d="M51 32 h7 M58 32 l-2 -2 M58 32 l-2 2"/>`,
  endless: c => `<rect x="23" y="18" width="18" height="36" rx="8" fill="${c}" fill-opacity=".14"/><rect x="23" y="18" width="18" height="36" rx="8"/><path d="M28 18 v-6 h8 v6 M36 13 h7 v4"/><path d="M26 36 h12 M26 42 h12" stroke-opacity=".6"/><path d="M32 24 v6" stroke="#6E9DB8"/><circle cx="48" cy="22" r="1.8"/><circle cx="51" cy="14" r="1.2"/><circle cx="46" cy="9" r=".9" fill="${c}"/>`,
  packs: c => `<path d="M12 22 h24 v28 h-24Z" fill="${c}" fill-opacity=".14"/><path d="M12 22 h24 v28 h-24Z"/><path d="M18 16 h24 v28"/><path d="M24 10 h24 v28"/><path d="M17 30 c4 -3 9 -3 13 0 c-4 3 -9 3 -13 0Z M30 30 l3 -2 v4Z"/><path d="M17 42 h14" stroke-opacity=".5"/>`,
  archive: c => `<path d="M17 12 h29 a2 2 0 0 1 2 2 v36 a2 2 0 0 1 -2 2 h-29Z" fill="${c}" fill-opacity=".14"/><path d="M17 12 h29 a2 2 0 0 1 2 2 v36 a2 2 0 0 1 -2 2 h-29Z"/><path d="M22 12 v40"/><path d="M28 22 h14 M28 28 h14 M28 34 h10"/><path d="M38 52 v6 l3 -2 l3 2 v-6" stroke="#E0313D"/>`,
  settings: c => `<circle cx="32" cy="32" r="13"/><circle cx="32" cy="32" r="4.5" fill="${c}" fill-opacity=".25"/><path d="M32 8 v11 M32 45 v11 M8 32 h11 M45 32 h11 M15 15 l8 8 M41 41 l8 8 M49 15 l-8 8 M15 49 l8 -8"/><circle cx="32" cy="7" r="2.2"/><circle cx="32" cy="57" r="2.2"/><circle cx="7" cy="32" r="2.2"/><circle cx="57" cy="32" r="2.2"/>`,
  help: c => `<circle cx="32" cy="32" r="20"/><path d="M10 32 a22 22 0 0 0 44 0" stroke-opacity=".35"/><path d="M6 32 a26 26 0 0 0 52 0" stroke-opacity=".18"/><path d="M26 27 c0 -5 3 -7 6 -7 c4 0 6 2.5 6 5.5 c0 4 -6 5 -6 9 v2"/><circle cx="32" cy="42.5" r="1.4" fill="${c}"/>`,
  stats: c => `<path d="M14 50 h36"/><path d="M18 50 v-10 M26 50 v-18 M34 50 v-12 M42 50 v-24" stroke-width="4"/><path d="M16 30 L26 22 L34 28 L46 14" stroke="#E0313D"/><circle cx="46" cy="14" r="2" fill="#E0313D" stroke="#E0313D"/>`,
  codex: c => `<path d="M32 16 C26 12 17 11 9 13 V50 C17 48 26 49 32 53 C38 49 47 48 55 50 V13 C47 11 38 12 32 16Z" fill="${c}" fill-opacity=".12"/><path d="M32 16 C26 12 17 11 9 13 V50 C17 48 26 49 32 53 C38 49 47 48 55 50 V13 C47 11 38 12 32 16Z M32 16 V53"/><path d="M14 22 C18 21 23 21 27 23 M14 29 C18 28 23 28 27 30 M14 36 C18 35 22 35 27 37" stroke-opacity=".55"/><path d="M37 30 C40 25 48 25 51 30 C48 35 40 35 37 30Z"/><circle cx="44" cy="30" r="2.2" fill="#E0313D" stroke="#E0313D"/>`,
  record: c => `<path d="M32 8 v48 M20 18 l12 -10 l12 10" /><path d="M14 30 h36" stroke-opacity=".35"/><path d="M18 42 h28" stroke-opacity=".55"/><path d="M22 54 h20"/><circle cx="32" cy="56" r="3" fill="#E0313D" stroke="#E0313D"/>`
};
const ICON_COL = {P:'#7F96A3', T:'#A9B6BE', S:'#6E9DB8', R:'#4C86C6', D:'#5B6EE0', G:'#E0313D', X:'#46525c'};
function icon(name, size, color, cls){
  const c = color || ICON_COL[name] || '#C9D6DC';
  return `<svg class="ico ${cls || ''}" viewBox="0 0 64 64" width="${size}" height="${size}" fill="none" stroke="${c}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name](c)}</svg>`;
}
const tierIcon = (t, size, cls) => icon(t || 'X', size, null, cls);

"use strict";
/* ============================== data ============================== */
let DB = [], BYID = {}, SCHED = [];
const TIERS = {
  P:{k:'P',name:'Surface Foam',code:'SF',lvl:1,pts:10,air:8,glyph:'▁',desc:'The first thing anyone says. It floats right on top.'},
  T:{k:'T',name:'Fool’s Pearl',code:'FP',lvl:2,pts:15,air:8,glyph:'▂',desc:'Looks rare, shines like a find. Every clever diver grabs it.'},
  S:{k:'S',name:'Shoal',code:'SH',lvl:3,pts:30,air:9,glyph:'▃',desc:'Known, but you have to swim out for it.'},
  R:{k:'R',name:'Shipwreck',code:'SW',lvl:4,pts:60,air:10,glyph:'▅',desc:'Few divers ever find this one.'},
  D:{k:'D',name:'Abyssal',code:'AB',lvl:5,pts:85,air:12,glyph:'▆',desc:'Properly obscure. Almost nobody gets down here.'},
  G:{k:'G',name:'One in a Leafy Seadragon',code:'✦',lvl:6,pts:100,air:16,glyph:'█',desc:'A hidden gem of this prompt.'}
};
const TIER_ORDER = ['P','T','S','R','D','G'];
const PACKS = {
  nature:{name:'Nature & Sea',blurb:'Fish, seabirds, breeds, beasts, deep-sea things'},
  food:{name:'Food & Drink',blurb:'Dishes of every coast, cheeses, teas, beers, sauces'},
  geo:{name:'Geography',blurb:'Countries, capitals, volcanoes, waterfalls, cities'},
  science:{name:'Science',blurb:'Elements, particles, clouds, bones, maths, fonts'},
  culture:{name:'History & Culture',blurb:'Gods, ships, operas, musicals, festivals, battles'},
  pop:{name:'Pop Culture',blurb:'Villains, detectives, anime, K-pop, bands, rappers'},
  sport:{name:'Sports & Games',blurb:'Sports, clubs, fighters, players, yoga, card games'},
  everyday:{name:'Everyday Things',blurb:'Colours, fabrics, hairstyles, knots, sailing terms'},
  slang:{name:'Slang & Speech',blurb:'Street slang, internet speak, untranslatable words'},
  words:{name:'Wordplay',blurb:'Spelling puzzles, scored by how rare the word is in print'}
};
const FACTS = [
  'Leafy seadragons live only in the cool waters off southern Australia.',
  'Those leaves are not for swimming. They are camouflage among the kelp.',
  'Male seadragons carry the eggs on the underside of their tails.',
  'Seadragons steer with near-transparent fins on the neck and back.',
  'A seadragon has no teeth and no stomach. It sucks up tiny shrimp like a straw.',
  'Seadragons can change colour depending on age, diet and stress.',
  'The leafy seadragon is the marine emblem of South Australia.'
];
const ROUND_MS = 25000, WRONG_MS = 3000, AIR_START = 45000, AIR_WRONG = 2000, AIR_PASS = 5000;
const LAUNCH = Date.UTC(2026, 10, 1);
const M_PER_PT = 10, MAX_M = 7000;
const ZONES = [
  {n:1, key:'shallows', name:'The Shallows', from:0, to:1200, sub:'EPIPELAGIC // GREY LIGHT', note:'Cold grey light still reaches you. So does everyone else.', top:'#24404f', bot:'#152c3a'},
  {n:2, key:'seagrass', name:'Seagrass Meadow', from:1200, to:2400, sub:'THE MERIDIAN BEDS // SWAYING', note:'The grass hides small things. Tonight, you are one of them.', top:'#16312f', bot:'#0d2023'},
  {n:3, key:'kelp', name:'Kelp Forest', from:2400, to:3600, sub:'PHYLLOPTERYX TERRITORY', note:'Seadragon country. The canopy closes over your head.', top:'#0d2226', bot:'#08161b'},
  {n:4, key:'thermo', name:'Thermocline', from:3600, to:4800, sub:'THE COLD LINE // SOUND BENDS', note:'Warm water gives up here. Signals warp. Nothing is certain.', top:'#0a1626', bot:'#060c16'},
  {n:5, key:'trench', name:'The Trench', from:4800, to:MAX_M + 1, sub:'HADAL // NO LIGHT // NO RETURN', note:'Pressure beyond reason. Whatever lives down here has already seen you.', top:'#07060b', bot:'#020203'}
];
function zoneOf(m){ return ZONES.find(z => m >= z.from && m < z.to) || ZONES[ZONES.length - 1]; }
const pressure = m => 1 + m / 10;
const waterTemp = m => 1.8 + 9.6 * Math.exp(-m / 950);
const lightPct = m => 100 * Math.exp(-m / 85);

/* ============================== storage ============================== */
/* Saves live in this browser's localStorage under "olsd:". Every read goes through a
   memory cache, so the game still works (for this visit) if the browser blocks storage,
   and a second open tab drops its cache whenever the first one writes.                 */
const PFX = 'olsd:', MEM = new Map();
const STORAGE_OK = (() => { try{ localStorage.setItem(PFX + '__t', '1'); localStorage.removeItem(PFX + '__t'); return true; }catch(e){ return false; } })();
let saveWarned = false;
const store = {
  raw(k){ if (MEM.has(k)) return MEM.get(k); let v = null; if (STORAGE_OK) try{ v = localStorage.getItem(PFX + k); }catch(e){} MEM.set(k, v); return v; },
  get(k, d){ const v = store.raw(k); if (v == null) return d; try{ return JSON.parse(v); }catch(e){ return d; } },
  set(k, v){ const s = JSON.stringify(v); MEM.set(k, s); if (!STORAGE_OK) return;
    try{ localStorage.setItem(PFX + k, s); }catch(e){ if (!saveWarned){ saveWarned = true; setTimeout(() => typeof toast === 'function' && toast('Your browser refused to save. Back up with a save code in Settings.'), 50); } } },
  del(k){ MEM.delete(k); if (STORAGE_OK) try{ localStorage.removeItem(PFX + k); }catch(e){} },
  keys(){ const out = new Set(); if (STORAGE_OK) try{ for (let i = 0; i < localStorage.length; i++){ const k = localStorage.key(i); if (k && k.startsWith(PFX) && k !== PFX + '__t') out.add(k.slice(PFX.length)); } }catch(e){}
    for (const [k, v] of MEM) if (v != null) out.add(k); return [...out]; }
};
addEventListener('storage', e => { if (!e.key) MEM.clear(); else if (e.key.startsWith(PFX)) MEM.delete(e.key.slice(PFX.length)); });
let settings = Object.assign({sound:true, music:true, calm:false, relaxed:false}, store.get('settings', {}));
function saveSettings(){ store.set('settings', settings); document.body.classList.toggle('calm', !!settings.calm); ambience(); }

/* ============================== utils ============================== */
function shuffle(arr, r){ const a = arr.slice(); for (let i = a.length - 1; i > 0; i--){ const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = n => Math.round(n).toLocaleString('en-US');
const display = a => a.split('|')[0];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const calm = () => settings.calm || matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const band = (m, a, b, f) => smooth(a - f, a, m) * (1 - smooth(b, b + f, m));
/* time dilation: every animation runs about 3x the old pacing, and drags longer the deeper you are */
const dil = m => calm() ? .25 : 1 + clamp(m / MAX_M, 0, 1) * .8;
function sig(t, big){ const size = big >= 60 ? 104 : big >= 30 ? 58 : 22; return `<span class="tic tier-${t || 'X'}${big >= 60 ? ' big' : ''}">${tierIcon(t, size)}</span>`; }
function spaced(n){ return fmt(n); }

/* ============================== dive selection ============================== */
function okFor(game, p, packOnly){
  const fam = game.filter(x => x.fam === p.fam).length;
  if (p.fam === 'city' && fam >= (packOnly ? 2 : 1)) return false;
  if (p.fam === 'words' && !packOnly && fam >= 1) return false;
  if (!packOnly && game.filter(x => x.pack === p.pack).length >= 2) return false;
  return true;
}
const CYCLES = {};
function cycleGames(prefix, pool, cycle, packOnly){
  const key = prefix + ':' + cycle;
  if (CYCLES[key]) return CYCLES[key];
  const perm = shuffle(pool, rng(key));
  const G = Math.max(1, Math.floor(pool.length / 7));
  const games = Array.from({length:G}, () => []);
  const left = [];
  for (const p of perm){ const g = games.find(g => g.length < 7 && okFor(g, p, packOnly)); if (g) g.push(p); else left.push(p); }
  for (const p of left){ const g = games.find(g => g.length < 7 && !g.includes(p)); if (g) g.push(p); }
  const r = rng(key + 'fill');
  for (const g of games) while (g.length < 7){ const p = pool[Math.floor(r() * pool.length)]; if (!g.includes(p)) g.push(p); }
  return CYCLES[key] = games.map(g => shuffle(g, rng(key + g[0].id)).map(p => p.id));
}
function diveFor(prefix, pool, n, packOnly){
  const G = Math.max(1, Math.floor(pool.length / 7));
  return cycleGames(prefix, pool, Math.floor((n - 1) / G), packOnly)[(n - 1) % G];
}
const poolPack = k => DB.filter(p => p.pack === k);
function todayNum(){ const now = new Date(); const d = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()); return Math.floor((d - LAUNCH) / 864e5) + 1; }
function dateOf(n){ return new Date(LAUNCH + (n - 1) * 864e5).toLocaleDateString('en-GB', {day:'2-digit', month:'short', year:'numeric', timeZone:'UTC'}).toUpperCase(); }
function promptsFor(mode, num, pack){
  if (mode === 'daily'){ const f = SCHED[num - 1]; if (f && f.every(id => BYID[id])) return f.slice(); return diveFor('daily-v3', DB, num, false); }
  if (mode === 'unlimited') return diveFor('unlimited-v3', DB, num, false);
  if (mode === 'pack') return diveFor('pack-v3-' + pack, poolPack(pack), num, true);
}

/* ============================== audio (synthesised) ============================== */
let AC = null, master = null, amb = null;
let gestured = false;
['pointerdown', 'keydown', 'touchstart'].forEach(ev => addEventListener(ev, () => { gestured = true; }, {capture:true, once:true, passive:true}));
function ac(){
  if (!AC){ if (!(gestured || (navigator.userActivation && navigator.userActivation.hasBeenActive))) return null; try{ AC = new (window.AudioContext || window.webkitAudioContext)(); master = AC.createGain(); master.gain.value = .9; master.connect(AC.destination); }catch(e){ return null; } }
  if (AC.state === 'suspended') AC.resume().catch(() => {});
  return AC;
}
const NB = {};
function noiseBuf(sec, brown){
  const key = sec + ':' + brown; if (NB[key]) return NB[key];
  const a = ac(); const b = a.createBuffer(1, a.sampleRate * sec, a.sampleRate); const d = b.getChannelData(0); let last = 0;
  for (let i = 0; i < d.length; i++){ const w = Math.random() * 2 - 1; if (brown){ last = (last + .02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w; }
  return NB[key] = b;
}
function tone(freq, dur, type, vol, slide, delay){
  if (!settings.sound || !ac()) return;
  const o = AC.createOscillator(), g = AC.createGain(), t = AC.currentTime + (delay || 0);
  o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
  g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol || .12, t + Math.min(.4, dur * .2)); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g).connect(master); o.start(t); o.stop(t + dur + .05);
}
function noise(dur, f1, f2, vol, q, delay){
  if (!settings.sound || !ac()) return;
  const s = AC.createBufferSource(); s.buffer = noiseBuf(Math.max(.2, Math.ceil(dur)), false);
  const f = AC.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = q || 1.2;
  const g = AC.createGain(), t = AC.currentTime + (delay || 0);
  f.frequency.setValueAtTime(f1, t); f.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + dur * .25); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  s.connect(f).connect(g).connect(master); s.start(t); s.stop(t + dur + .05);
}
function ambience(){
  if (!AC) return;
  if (settings.sound && settings.music){
    if (amb) return;
    const s = AC.createBufferSource(); s.buffer = noiseBuf(6, true); s.loop = true;
    const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700;
    const g = AC.createGain(); g.gain.value = 0;
    const lfo = AC.createOscillator(), lg = AC.createGain(); lfo.frequency.value = .08; lg.gain.value = .025; lfo.connect(lg).connect(g.gain); lfo.start();
    const drone = AC.createOscillator(), dg = AC.createGain(); drone.type = 'sine'; drone.frequency.value = 46; dg.gain.value = 0; drone.connect(dg).connect(master); drone.start();
    s.connect(f).connect(g).connect(master); s.start();
    g.gain.linearRampToValueAtTime(.065, AC.currentTime + 4);
    amb = {s, f, g, lfo, drone, dg, lastPing:0};
  } else if (amb){ amb.g.gain.linearRampToValueAtTime(0, AC.currentTime + .8); amb.dg.gain.linearRampToValueAtTime(0, AC.currentTime + .8); const a = amb; setTimeout(() => { try{ a.s.stop(); a.lfo.stop(); a.drone.stop(); }catch(e){} }, 1000); amb = null; }
}
function setAmbDepth(m, now){
  if (!amb || !AC) return;
  const c = clamp(m / MAX_M, 0, 1);
  amb.f.frequency.setTargetAtTime(700 - c * 560, AC.currentTime, .8);
  amb.dg.gain.setTargetAtTime(.012 + c * .05, AC.currentTime, 1.2);
  amb.drone.frequency.setTargetAtTime(46 - c * 14, AC.currentTime, 1.5);
  if (settings.sound && now - amb.lastPing > 9000 + Math.random() * 6000){ amb.lastPing = now; tone(1180 - c * 300, 2.6, 'sine', .018 + c * .02, 1150 - c * 300); }
}
const sfx = {
  click(){ tone(520, .08, 'triangle', .045, 780); },
  wrong(){ tone(150, .32, 'square', .05, 80); noise(.25, 700, 220, .07); },
  tick(){ tone(880, .05, 'square', .03); },
  hit(t){ const base = {P:220,T:247,S:294,R:349,D:392,G:440}[t]; tone(base, .9, 'triangle', .12, base * 1.5); tone(base * 1.5, 1.2, 'sine', .08, base * 2, .2); if ('RDG'.includes(t)) tone(base * 2, 1.6, 'sine', .06, base * 3, .45); if (t === 'G'){ [0,1,2,3,4].forEach(i => tone(440 + i * 110, 1, 'triangle', .05, null, .6 + i * .16)); tone(55, 3, 'sawtooth', .06, 41); } noise(1.2, 2600, 400, .04); },
  bubble(){ tone(380 + Math.random() * 400, .18, 'sine', .05, 1300); },
  descend(d){ d = d / 1000; noise(d, 1200, 90, .2, .8); tone(70, d, 'sawtooth', .06, 32); tone(140, d * .8, 'sine', .05, 50, .2); tone(30, d, 'sine', .12, 24); },
  ascend(d){ d = d / 1000; noise(d, 120, 1600, .16, .8); tone(48, d, 'sine', .06, 150); [0, 1, 2].forEach(i => tone(660, .5, 'sine', .03, 620, d * (.3 + i * .22))); },
  sink(d){ d = d / 1000; noise(d, 800, 120, .09, .9); tone(96, d, 'sine', .05, 52); },
  hurt(){ tone(85, .7, 'square', .16, 38); tone(55, .9, 'sawtooth', .13, 26); noise(.5, 2200, 160, .32, .6); },
  count(){ tone(1100 + Math.random() * 250, .03, 'square', .02); },
  stamp(){ tone(80, .6, 'square', .12, 40); noise(.4, 1400, 200, .16); },
  zone(){ tone(41, 3.4, 'sawtooth', .09, 30); tone(82, 2.6, 'sine', .07, 61, .1); noise(2.6, 300, 60, .12, .7); },
  type(){ tone(1800 + Math.random() * 600, .015, 'square', .012); },
  sonar(){ tone(1240, 2.2, 'sine', .05, 1210); },
  record(){ tone(36, 3.6, 'sawtooth', .1, 28); noise(2.4, 200, 4200, .14, .7); [220, 277, 330, 440, 554, 660, 880].forEach((f, i) => tone(f, 1.6, i % 2 ? 'sine' : 'triangle', .07, f * 1.01, .25 + i * .13)); tone(1320, 2.6, 'sine', .04, 1318, 1.3); }
};
function buzz(p){ try{ if (navigator.vibrate) navigator.vibrate(p); }catch(e){} }

/* ============================== the living ocean (canvas) ==============================
   One camera, five territories. Each zone has its own layer that fades in by depth:
   Shallows (grey shafts, fish silhouettes) · Seagrass Meadow (swaying beds) ·
   Kelp Forest (canopy + drifting seadragons) · Thermocline (refraction bands, cold mist) ·
   The Trench (rock walls, red bioluminescence, a lure in the dark).                      */
const cv = document.getElementById('world'), cx = cv.getContext('2d');
let VW = 0, VH = 0, DPR = 1;
const world = {s:0, dark:0, t:0, anim:null, lastS:0, shakeMag:0, shakeEnd:0, shakeDur:1, lastNow:0};
function resize(){ DPR = Math.min(2, window.devicePixelRatio || 1); VW = innerWidth; VH = innerHeight; cv.width = VW * DPR; cv.height = VH * DPR; seedScene(); buildGauge(); }
function hexRgb(h){ const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function mixHex(a, b, t){ const A = hexRgb(a), B = hexRgb(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`; }
function waterAt(m, which){
  const mids = ZONES.map(z => (z.from + Math.min(z.to, MAX_M)) / 2);
  if (m <= mids[0]) return ZONES[0][which];
  for (let i = 1; i < ZONES.length; i++) if (m <= mids[i]) return mixHex(ZONES[i - 1][which], ZONES[i][which], (m - mids[i - 1]) / (mids[i] - mids[i - 1]));
  return ZONES[ZONES.length - 1][which];
}
const easeIO = p => p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
const easeOut = p => 1 - Math.pow(1 - p, 3);
function tween(to, dur, ease){ return new Promise(res => { world.anim = {from:{s:world.s, dark:world.dark}, to, t0:performance.now(), dur:calm() ? Math.min(dur, 400) : dur, ease:ease || easeIO, res}; }); }
function shake(mag, dur){ if (calm()) mag *= .25; world.shakeMag = Math.max(world.shakeMag * Math.max(0, (world.shakeEnd - performance.now()) / world.shakeDur), mag); world.shakeDur = dur; world.shakeEnd = performance.now() + dur; }
let P = [], fish = [], kelp = [], grass = [], jellies = [], clouds = [], burstP = [], biolum = [], dragons = [], walls = {l:[], r:[]}, eyes = [], rain = [];
function seedScene(){
  const r = rng('scene' + VW);
  const n = calm() ? 80 : Math.round(Math.min(320, 150 + VW * VH / 7000));
  P = [];
  for (let i = 0; i < n; i++){
    const bubble = r() < .3, z = .25 + r() * 1.1;
    P.push({x:r() * VW, y:r() * VH, z, bubble, size: bubble ? (.7 + Math.pow(r(), 2.4) * 6) * z : (.35 + r() * 1.5) * z, sp: bubble ? 10 + r() * 34 : 2 + r() * 6, ph:r() * 6.28, a: bubble ? .25 + r() * .4 : .12 + r() * .45});
  }
  fish = [];
  for (let sIdx = 0; sIdx < 5; sIdx++){
    const dir = r() < .5 ? -1 : 1, depth = .1 + r() * .55, count = 6 + Math.floor(r() * 10), sz = 6 + r() * 9, speed = 18 + r() * 30;
    const school = {x:r() * VW, depth, dir, speed, members:[]};
    for (let k = 0; k < count; k++) school.members.push({ox:(r() - .5) * 130, oy:(r() - .5) * 50, ph:r() * 6.28, sz:sz * (.8 + r() * .4)});
    fish.push(school);
  }
  kelp = [];
  const kn = Math.ceil(VW / 64) + 2;
  for (let i = 0; i < kn; i++) kelp.push({x:i * 64 + r() * 50 - 30, h:VH * (.45 + r() * .5), w:4 + r() * 6, ph:r() * 6.28, sp:.35 + r() * .4, front:r() < .3});
  grass = [];
  const gn = Math.ceil(VW / 5);
  for (let i = 0; i < gn; i++) grass.push({x:i * 5 + r() * 4, h:30 + Math.pow(r(), 1.6) * 150, ph:r() * 6.28, w:1.5 + r() * 2.5, back:r() < .5});
  jellies = [];
  for (let i = 0; i < 8; i++) jellies.push({x:r() * VW, y:r() * VH, r:9 + r() * 22, ph:r() * 6.28, red:r() < .3, vx:(r() - .5) * 6});
  clouds = [];
  for (let i = 0; i < 6; i++) clouds.push({x:r() * VW, y:.15 + r() * .65, w:160 + r() * 260, sp:3 + r() * 6, a:.25 + r() * .3});
  biolum = [];
  for (let i = 0; i < 70; i++) biolum.push({x:r() * VW, y:r() * VH, r:.6 + r() * 1.8, ph:r() * 6.28, sp:.6 + r() * 2.4, red:r() < .55, z:.3 + r()});
  dragons = [];
  for (let i = 0; i < 3; i++) dragons.push({x:r() * VW, y:VH * (.25 + r() * .5), dir:r() < .5 ? -1 : 1, sc:.5 + r() * .7, ph:r() * 6.28, sp:5 + r() * 7});
  walls = {l:[], r:[]};
  for (let i = 0; i <= 40; i++){ walls.l.push(.06 + r() * .1 + Math.sin(i * .7) * .03); walls.r.push(.06 + r() * .1 + Math.cos(i * .9) * .03); }
  eyes = [];
  for (let i = 0; i < 5; i++) eyes.push({x:r() < .5 ? VW * (.05 + r() * .15) : VW * (.8 + r() * .15), y:VH * (.2 + r() * .6), ph:r() * 20, gap:3 + r() * 5});
  rain = [];
  for (let i = 0; i < 90; i++) rain.push({x:r() * VW, y:r(), l:8 + r() * 14, sp:.5 + r() * .8});
  if (typeof seedSky === 'function') seedSky();
}
function burst(x, y, n, color){
  for (let i = 0; i < (calm() ? n / 4 : n); i++){ const a = Math.random() * 6.28, sp = 40 + Math.random() * 220; burstP.push({x, y, vx:Math.cos(a) * sp, vy:Math.sin(a) * sp - 100, r:1.2 + Math.random() * 4.5, life:1, col:color}); }
}
function waveY(x, t, base){ return base + Math.sin(x * .011 + t * .9) * 7 + Math.sin(x * .025 - t * 1.4) * 4 + Math.sin(x * .004 + t * .5) * 6; }
function drawBoat(bx, by, ang, sc, t){
  cx.save(); cx.translate(bx, by); cx.rotate(ang); cx.scale(sc, sc);
  cx.strokeStyle = 'rgba(201,214,220,.35)'; cx.lineWidth = .8 / sc;
  cx.beginPath(); cx.moveTo(-80, -60); cx.quadraticCurveTo(-112, -20, -114, 44 + Math.sin(t * 1.1) * 4); cx.stroke();
  cx.fillStyle = '#020305'; cx.strokeStyle = '#020305'; cx.lineWidth = 2.2;
  cx.beginPath(); cx.moveTo(-40, -14); cx.lineTo(-80, -60); cx.stroke();
  cx.lineWidth = 3; cx.beginPath(); cx.moveTo(10, -14); cx.lineTo(10, -84); cx.stroke();
  cx.lineWidth = 1; cx.beginPath(); cx.moveTo(10, -84); cx.lineTo(-56, -14); cx.moveTo(10, -84); cx.lineTo(56, -14); cx.stroke();
  cx.fillRect(-10, -42, 42, 30); cx.fillRect(-14, -47, 50, 6);
  cx.beginPath(); cx.moveTo(-64, -14); cx.lineTo(62, -14); cx.quadraticCurveTo(60, 10, 38, 20); cx.lineTo(-42, 20); cx.quadraticCurveTo(-60, 8, -64, -14); cx.fill();
  cx.fillRect(-37, -32, 9, 18); cx.beginPath(); cx.arc(-32.5, -36, 5, 0, 6.28); cx.fill(); cx.fillRect(-40, -43, 15, 4);
  // cabin window glow, swinging lantern, running lights
  cx.fillStyle = 'rgba(255,190,120,.5)'; cx.fillRect(-2, -36, 10, 8); cx.fillRect(16, -36, 10, 8);
  const lx = 34 + Math.sin(t * 1.7) * 3, ly = -50;
  const lg = cx.createRadialGradient(lx, ly, 0, lx, ly, 34); lg.addColorStop(0, 'rgba(255,200,130,.5)'); lg.addColorStop(1, 'rgba(255,200,130,0)');
  cx.fillStyle = lg; cx.beginPath(); cx.arc(lx, ly, 34, 0, 6.28); cx.fill();
  cx.fillStyle = '#ffd59a'; cx.beginPath(); cx.arc(lx, ly, 2.2, 0, 6.28); cx.fill();
  const blink = (Math.sin(t * 2.4) > .2) ? 1 : .25;
  cx.fillStyle = `rgba(224,49,61,${blink})`; cx.beginPath(); cx.arc(10, -86, 2.4, 0, 6.28); cx.fill();
  cx.fillStyle = 'rgba(224,49,61,.9)'; cx.beginPath(); cx.arc(-60, -16, 1.8, 0, 6.28); cx.fill();
  cx.fillStyle = 'rgba(90,220,150,.85)'; cx.beginPath(); cx.arc(58, -16, 1.8, 0, 6.28); cx.fill();
  cx.restore();
}
function drawFish(fx, fy, s2, dir, wag, col){
  cx.save(); cx.translate(fx, fy); cx.scale(dir, 1); cx.fillStyle = col;
  cx.beginPath(); cx.ellipse(0, 0, s2, s2 * .38, 0, 0, 6.28); cx.fill();
  cx.beginPath(); cx.moveTo(-s2 * .85, 0); cx.lineTo(-s2 * 1.6, -s2 * (.42 + wag)); cx.lineTo(-s2 * 1.6, s2 * (.42 - wag)); cx.closePath(); cx.fill();
  cx.restore();
}
function drawDragon(d, t, alpha){
  const x = d.x, y = d.y + Math.sin(t * .4 + d.ph) * 10, s = d.sc;
  cx.save(); cx.translate(x, y); cx.scale(d.dir * s, s); cx.globalAlpha = alpha; cx.fillStyle = '#04100f'; cx.strokeStyle = 'rgba(127,150,163,.25)'; cx.lineWidth = 1;
  cx.beginPath(); cx.moveTo(-60, 0); cx.quadraticCurveTo(-30, -10, 0, -4); cx.quadraticCurveTo(25, 4, 40, 18); cx.quadraticCurveTo(46, 30, 36, 34); cx.quadraticCurveTo(30, 30, 34, 26); cx.quadraticCurveTo(20, 10, 0, 6); cx.quadraticCurveTo(-30, 4, -60, 6); cx.closePath(); cx.fill(); cx.stroke();
  cx.beginPath(); cx.moveTo(-60, 2); cx.lineTo(-84, 6); cx.lineTo(-60, 6); cx.fill();
  for (let i = 0; i < 6; i++){ const lx = -44 + i * 14, side = i % 2 ? 1 : -1, sw = Math.sin(t * 1.2 + i + d.ph) * 3; cx.beginPath(); cx.moveTo(lx, 0); cx.quadraticCurveTo(lx + 6 + sw, side * 18, lx + 2 + sw, side * 28); cx.quadraticCurveTo(lx - 4, side * 14, lx, 0); cx.fill(); }
  cx.fillStyle = 'rgba(224,49,61,.8)'; cx.beginPath(); cx.arc(-50, -1, 1.4, 0, 6.28); cx.fill();
  cx.restore(); cx.globalAlpha = 1;
}
function frame(now){
  const dt = Math.min(.05, (now - (world.lastNow || now)) / 1000); world.lastNow = now; world.t += dt;
  if (world.anim){ const a = world.anim, p = Math.min(1, (now - a.t0) / a.dur), e = a.ease(p);
    if (a.to.s != null) world.s = a.from.s + (a.to.s - a.from.s) * e;
    if (a.to.dark != null) world.dark = a.from.dark + (a.to.dark - a.from.dark) * e;
    if (p >= 1){ world.anim = null; a.res(); } }
  const t = world.t, dS = (world.s - world.lastS) * VH; world.lastS = world.s;
  const m = clamp(world.dark * MAX_M, 0, MAX_M);   // depth the scenery shows
  setAmbDepth(m, now); updateGauge(m);
  let sx = 0, sy = 0;
  if (now < world.shakeEnd){ const k = (world.shakeEnd - now) / world.shakeDur; sx = (Math.random() - .5) * 2 * world.shakeMag * k; sy = (Math.random() - .5) * 2 * world.shakeMag * k; }
  const appEl = document.getElementById('app'); appEl.style.transform = (sx || sy) ? `translate(${sx.toFixed(1)}px,${sy.toFixed(1)}px)` : '';
  cx.setTransform(DPR, 0, 0, DPR, 0, 0);
  cx.save(); cx.translate(sx * .6, sy * .6);
  const yw = VH * .24 - world.s * VH;
  const surf = clamp(1 - world.s / 1.4, 0, 1);   // brighter water just under the surface
  // water
  const top = waterAt(m, 'top'), bot = waterAt(m, 'bot');
  const g2 = cx.createLinearGradient(0, 0, 0, VH); g2.addColorStop(0, top); g2.addColorStop(1, bot);
  cx.fillStyle = g2; cx.fillRect(-30, -30, VW + 60, VH + 60);
  const SK = skyNow();
  if (surf > 0){ const sg = cx.createLinearGradient(0, Math.max(yw, 0), 0, VH); sg.addColorStop(0, `rgba(${SK.surf},${(SK.surfA * surf).toFixed(3)})`); sg.addColorStop(1, `rgba(${SK.surf},0)`); cx.fillStyle = sg; cx.fillRect(-30, -30, VW + 60, VH + 60); }
  document.body.style.background = bot;
  // grey light shafts (Shallows, fading through the meadow)
  const shaft = (1 - smooth(300, 2600, m)) * .9 * (m < 1500 ? SK.shaft : 1);
  if (shaft > .01){
    cx.save(); cx.globalCompositeOperation = 'lighter';
    const y0 = Math.max(yw, -VH * .2);
    for (let i = 0; i < 8; i++){
      const x0 = (i / 8) * VW * 1.3 - VW * .1 + Math.sin(t * .18 + i) * 34, w0 = 24 + (i % 3) * 20;
      const rg = cx.createLinearGradient(0, y0, 0, y0 + VH * 1.15); rg.addColorStop(0, `rgba(${SK.shaftCol},${(shaft * .12).toFixed(3)})`); rg.addColorStop(1, `rgba(${SK.shaftCol},0)`);
      cx.fillStyle = rg; cx.beginPath(); cx.moveTo(x0, y0); cx.lineTo(x0 + w0, y0); cx.lineTo(x0 + w0 * 3 + 140, y0 + VH * 1.15); cx.lineTo(x0 + 70, y0 + VH * 1.15); cx.fill();
    }
    cx.restore();
  }
  // thermocline: refraction bands and cold mist
  const th = band(m, 3500, 4900, 600);
  if (th > .01){
    cx.save(); cx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 6; i++){
      const by = ((i / 6) * VH + t * (6 + i * 2) - dS * .4 * (i + 1)) % (VH + 120) - 60;
      cx.strokeStyle = `rgba(120,165,200,${(th * (.022 + (i % 3) * .012)).toFixed(3)})`; cx.lineWidth = 10 + (i * 37 % 5) * 14;
      cx.beginPath();
      for (let x = -40; x <= VW + 40; x += 20){ const y = by + Math.sin(x * (.004 + i * .0017) + t * .5 + i) * (18 + i * 5) + Math.sin(x * .019 - t * .4 + i * 2) * 7; x === -40 ? cx.moveTo(x, y) : cx.lineTo(x, y); }
      cx.stroke();
    }
    for (let i = 0; i < 3; i++){ const mx = (t * 10 * (i + 1) + i * VW / 3) % (VW + 400) - 200, my = VH * (.3 + i * .22); const mg = cx.createRadialGradient(mx, my, 0, mx, my, 260); mg.addColorStop(0, `rgba(110,157,184,${(th * .06).toFixed(3)})`); mg.addColorStop(1, 'rgba(110,157,184,0)'); cx.fillStyle = mg; cx.fillRect(mx - 260, my - 260, 520, 520); }
    cx.restore();
  }
  // jellies (thermocline into trench)
  const jw = band(m, 3600, 6400, 450);
  if (jw > .01){
    for (const j of jellies){
      j.y -= dS * .3; j.y += Math.sin(t * .6 + j.ph) * .25; j.x += j.vx * dt; if (j.y < -60) j.y += VH + 120; if (j.y > VH + 60) j.y -= VH + 120; if (j.x < -50) j.x = VW + 40; if (j.x > VW + 50) j.x = -40;
      const pulse = 1 + Math.sin(t * 1.6 + j.ph) * .12, col = j.red && m > 4600 ? '224,49,61' : '150,190,215';
      const rg = cx.createRadialGradient(j.x, j.y, 0, j.x, j.y, j.r * 3); rg.addColorStop(0, `rgba(${col},${(.22 * jw).toFixed(2)})`); rg.addColorStop(1, `rgba(${col},0)`);
      cx.fillStyle = rg; cx.beginPath(); cx.arc(j.x, j.y, j.r * 3, 0, 6.28); cx.fill();
      cx.fillStyle = `rgba(${col},${(.32 * jw).toFixed(2)})`; cx.beginPath(); cx.ellipse(j.x, j.y, j.r * pulse, j.r * .7 / pulse, 0, Math.PI, 0); cx.fill();
      cx.strokeStyle = `rgba(${col},${(.22 * jw).toFixed(2)})`; cx.lineWidth = .8;
      for (let k = -2; k <= 2; k++){ cx.beginPath(); cx.moveTo(j.x + k * j.r * .3, j.y); cx.quadraticCurveTo(j.x + k * j.r * .3 + Math.sin(t * 1.6 + k) * 6, j.y + j.r * 1.3, j.x + k * j.r * .35, j.y + j.r * 2.6); cx.stroke(); }
    }
  }
  // trench walls
  const tw = smooth(4300, 5300, m);
  if (tw > .01){
    const seg = VH / 12, off = ((world.s * VH * .7) % seg + seg) % seg;
    for (const side of ['l', 'r']){
      cx.fillStyle = `rgba(1,1,2,${(.96 * tw).toFixed(2)})`; cx.strokeStyle = `rgba(179,19,31,${(.22 * tw).toFixed(2)})`; cx.lineWidth = 1;
      cx.beginPath();
      const pts = [];
      for (let i = 0; i <= 14; i++){ const yy = i * seg - off; const k = walls[side][(i + Math.floor(world.s * VH * .7 / seg)) % walls[side].length] || .1; pts.push([(side === 'l' ? k : 1 - k) * VW * (VW < 600 ? .8 : 1), yy]); }
      cx.moveTo(side === 'l' ? -40 : VW + 40, -40);
      for (const [x, y] of pts) cx.lineTo(x, y);
      cx.lineTo(side === 'l' ? -40 : VW + 40, VH + 40); cx.closePath(); cx.fill();
      cx.beginPath(); pts.forEach(([x, y], i) => i ? cx.lineTo(x, y) : cx.moveTo(x, y)); cx.stroke();
    }
  }
  // seagrass beds
  const gw = band(m, 900, 2700, 500);
  const drawGrass = back => {
    if (gw < .01) return;
    cx.strokeStyle = back ? `rgba(18,48,44,${(gw * .8).toFixed(2)})` : `rgba(6,20,18,${(gw * .95).toFixed(2)})`; cx.lineCap = 'round';
    const base = VH + 10 - (back ? 30 : 0);
    for (const b of grass){ if (b.back !== back) continue; const h = b.h * (back ? .8 : 1), sw = Math.sin(t * .9 + b.ph + b.x * .01) * 16 * (h / 150);
      cx.lineWidth = b.w; cx.beginPath(); cx.moveTo(b.x, base); cx.quadraticCurveTo(b.x + sw * .3, base - h * .5, b.x + sw, base - h); cx.stroke(); }
  };
  drawGrass(true);
  // kelp forest
  const kw = band(m, 2350, 3900, 450);
  const drawKelp = front => {
    if (kw < .01) return;
    const bed = VH + 30;
    cx.globalAlpha = kw * (front ? 1 : .7);
    for (const k of kelp){ if (k.front !== front) continue;
      const col = front ? '#020a0c' : '#071a1d'; cx.strokeStyle = col; cx.fillStyle = col; cx.lineWidth = k.w; cx.lineCap = 'round';
      const segs = 10; let px = k.x, py = bed; cx.beginPath(); cx.moveTo(px, py);
      const pts = [];
      for (let s = 1; s <= segs; s++){ const u = s / segs; const nx = k.x + Math.sin(t * k.sp + k.ph + u * 2.2) * 30 * u; const ny = bed - k.h * u; cx.quadraticCurveTo(px + (nx - px) * .5 + Math.sin(u * 5 + k.ph) * 6, (py + ny) / 2, nx, ny); pts.push([nx, ny, u]); px = nx; py = ny; }
      cx.stroke();
      pts.forEach(([lx, ly, u], i) => { const side = i % 2 ? 1 : -1, L = 30 * (1 - u * .4); cx.beginPath(); cx.moveTo(lx, ly); cx.quadraticCurveTo(lx + side * L * .6, ly - L * .7 + Math.sin(t * 1.1 + i) * 3, lx + side * L, ly - L * .2); cx.quadraticCurveTo(lx + side * L * .5, ly + 2, lx, ly); cx.fill(); if (i % 3 === 1){ cx.beginPath(); cx.arc(lx + side * 3, ly + 3, 2.6, 0, 6.28); cx.fill(); } });
    }
    cx.globalAlpha = 1;
  };
  drawKelp(false);
  if (kw > .05) for (const d of dragons){ d.x += d.dir * d.sp * dt; if (d.x > VW + 120) d.x = -120; if (d.x < -120) d.x = VW + 120; drawDragon(d, t, kw * .85); }
  // fish schools: dark silhouettes, shallows and meadow
  const fw = 1 - smooth(1600, 3200, m);
  if (fw > .02){
    const fc = `rgba(4,10,14,${(.85 * fw).toFixed(2)})`;
    for (const sc of fish){
      sc.x += sc.dir * sc.speed * dt; if (sc.x > VW + 160) sc.x = -160; if (sc.x < -160) sc.x = VW + 160;
      const cy0 = (yw > 0 ? yw : 0) + VH * sc.depth + Math.sin(t * .4 + sc.depth * 10) * 16;
      if (cy0 < -60 || cy0 > VH + 60) continue;
      for (const mm of sc.members) drawFish(sc.x + mm.ox + Math.sin(t * 1.1 + mm.ph) * 6, cy0 + mm.oy + Math.sin(t * 1.7 + mm.ph) * 4, mm.sz, sc.dir, Math.sin(t * 10 + mm.ph) * .3, fc);
    }
  }
  // marine snow + bubbles, streaking when the camera moves
  const streak = Math.abs(dS) > 1.2, snowBoost = .5 + m / MAX_M * .7, bubFade = 1 - smooth(2500, 6000, m) * .8;
  for (const p of P){
    p.y -= dS * p.z;
    if (p.bubble){ p.y -= p.sp * dt * (1 + p.z * .4); p.x += Math.sin(t * 2 + p.ph) * .3 * p.z; }
    else { p.y += p.sp * dt * .4; p.x += Math.sin(t * .4 + p.ph) * .1; }
    if (p.y < -30){ p.y += VH + 60; p.x = Math.random() * VW; } else if (p.y > VH + 30){ p.y -= VH + 60; p.x = Math.random() * VW; }
    if (p.y < yw) continue;
    const alpha = p.a * (p.bubble ? bubFade : snowBoost);
    if (streak){ cx.strokeStyle = `rgba(201,214,220,${(alpha * .6).toFixed(2)})`; cx.lineWidth = Math.max(.5, p.size * (p.bubble ? .45 : .75)); cx.beginPath(); cx.moveTo(p.x, p.y); cx.lineTo(p.x, p.y + clamp(dS * p.z * 3.2, -80, 80)); cx.stroke(); continue; }
    if (p.bubble){
      cx.strokeStyle = `rgba(201,214,220,${alpha.toFixed(2)})`; cx.lineWidth = Math.max(.5, p.size * .16);
      cx.beginPath(); cx.arc(p.x, p.y, p.size, 0, 6.28); cx.stroke();
      cx.fillStyle = `rgba(232,238,241,${(alpha * .5).toFixed(2)})`; cx.beginPath(); cx.arc(p.x - p.size * .35, p.y - p.size * .35, p.size * .26, 0, 6.28); cx.fill();
    } else { cx.fillStyle = `rgba(201,214,220,${alpha.toFixed(2)})`; cx.beginPath(); cx.arc(p.x, p.y, p.size, 0, 6.28); cx.fill(); }
  }
  // trench: bioluminescence, a lure, eyes that blink
  const bw = smooth(4500, 5600, m);
  if (bw > .01){
    cx.save(); cx.globalCompositeOperation = 'lighter';
    for (const b of biolum){ b.y -= dS * b.z * .6; if (b.y < -10) b.y += VH + 20; if (b.y > VH + 10) b.y -= VH + 20;
      const a = bw * (.25 + .75 * Math.max(0, Math.sin(t * b.sp + b.ph))) * .7; const col = b.red ? '224,49,61' : '110,190,220';
      cx.fillStyle = `rgba(${col},${a.toFixed(2)})`; cx.beginPath(); cx.arc(b.x, b.y, b.r, 0, 6.28); cx.fill(); }
    const lx = VW * (.5 + Math.sin(t * .07) * .32), ly = VH * (.62 + Math.sin(t * .11) * .14), la = bw * (.55 + Math.sin(t * 1.3) * .25);
    const lg = cx.createRadialGradient(lx, ly, 0, lx, ly, 90); lg.addColorStop(0, `rgba(255,120,90,${(la * .55).toFixed(2)})`); lg.addColorStop(1, 'rgba(255,120,90,0)');
    cx.fillStyle = lg; cx.beginPath(); cx.arc(lx, ly, 90, 0, 6.28); cx.fill();
    cx.fillStyle = `rgba(255,190,160,${la.toFixed(2)})`; cx.beginPath(); cx.arc(lx, ly, 3, 0, 6.28); cx.fill();
    cx.restore();
    cx.strokeStyle = `rgba(127,150,163,${(bw * .12).toFixed(2)})`; cx.lineWidth = 1; cx.beginPath(); cx.moveTo(lx, ly); cx.quadraticCurveTo(lx - 30, ly - 50, lx - 60, ly - 34); cx.stroke();
    for (const e of eyes){ const cyc = (t + e.ph) % 11; if (cyc > 1.2) continue; const a = bw * Math.sin(cyc / 1.2 * Math.PI) * .9; cx.fillStyle = `rgba(232,238,241,${a.toFixed(2)})`; cx.beginPath(); cx.arc(e.x, e.y, 1.6, 0, 6.28); cx.arc(e.x + e.gap * 2, e.y, 1.6, 0, 6.28); cx.fill(); }
  }
  for (let i = burstP.length - 1; i >= 0; i--){ const b = burstP[i]; b.life -= dt * .45; if (b.life <= 0){ burstP.splice(i, 1); continue; } b.vx *= .97; b.vy = b.vy * .97 - 22 * dt; b.x += b.vx * dt; b.y += b.vy * dt;
    cx.strokeStyle = b.col || `rgba(201,214,220,${b.life.toFixed(2)})`; cx.globalAlpha = b.life; cx.lineWidth = 1.2; cx.beginPath(); cx.arc(b.x, b.y, b.r, 0, 6.28); cx.stroke(); cx.globalAlpha = 1; }
  // the surface: one of five skies, cross-fading when the cycle moves on
  if (yw > -60) drawSurface(yw, t, dt);
  drawGrass(false);
  drawKelp(true);
  // vignette tightens with depth; the trench breathes
  const press = m > 4800 ? (Math.sin(t * .9) * .5 + .5) * .12 : 0;
  const vg = cx.createRadialGradient(VW / 2, VH * .45, Math.min(VW, VH) * .22, VW / 2, VH * .5, Math.max(VW, VH) * .78);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(0,0,0,${(.45 + m / MAX_M * .4 + press).toFixed(2)})`);
  cx.fillStyle = vg; cx.fillRect(-30, -30, VW + 60, VH + 60);
  cx.restore();
  requestAnimationFrame(frame);
}
/* ---------- depth gauge on the right edge ---------- */
let gaugeMark = null, gaugeVal = null;
function buildGauge(){
  const el = document.getElementById('gauge'); if (!el) return;
  let h = '<div class="gl"></div>';
  for (let d = 0; d <= MAX_M; d += 500){ const pct = d / MAX_M * 100; const zb = ZONES.some(z => z.from === d); h += `<div class="gt${zb ? ' z' : ''}" style="top:${pct}%"></div>`; }
  ZONES.forEach(z => { const mid = (z.from + Math.min(z.to, MAX_M)) / 2 / MAX_M * 100; h += `<div class="gz" style="top:${mid}%">${String(z.n).padStart(2, '0')}</div>`; });
  h += '<div class="gm" id="gm"><span class="gv" id="gv">0 M</span></div>';
  el.innerHTML = h; gaugeMark = document.getElementById('gm'); gaugeVal = document.getElementById('gv');
}
let lastGauge = -1;
function updateGauge(m){
  if (!gaugeMark) return;
  const r = Math.round(m); if (r === lastGauge) return; lastGauge = r;
  gaugeMark.style.top = (m / MAX_M * 100) + '%'; gaugeVal.textContent = fmt(m) + ' M';
}

/* ============================== the surface: five skies ==============================
   Order (advances one step after every completed dive):
   rainy early night → sunrise → midday → sunset → deep night → rainy early night …
   The water under the line stays dark in every sky, so every font and panel keeps its contrast. */
const SKIES = [
  {k:'rain', label:'RAIN', clock:'19:40', stops:['#070b10', '#1a2a35', '#3a4d58'], clouds:'rgba(10,16,21,A)', cloudA:1, rain:true, moonGlow:.35, lantern:1, windows:.5, beam:1, shaft:1, shaftCol:'200,220,228', surf:'90,120,135', surfA:.35, foam:'rgba(201,214,220,.45)', swell:'rgba(12,24,32,.75)', pose:'rod', bright:false},
  {k:'dawn', label:'SUNRISE', clock:'05:52', stops:['#16222f', '#4a4756', '#b9806a', '#f0c49a'], clouds:'rgba(70,56,70,A)', cloudA:.8, rimCol:'rgba(242,170,130,.5)', sun:{x:.38, lift:-6, r:34, core:'#fff1dc', col:'#f2c79a', glow:'242,199,154', glowR:260}, rays:'242,199,154', rayA:.45, lantern:.35, windows:.2, beam:.25, shaft:1.1, shaftCol:'240,205,175', surf:'120,105,105', surfA:.32, foam:'rgba(245,215,190,.5)', swell:'rgba(20,28,36,.78)', reflect:'242,199,154', pose:'rod', bright:true},
  {k:'noon', label:'CLEAR', clock:'11:30', stops:['#4f6c7e', '#7f99a8', '#aebfc8'], clouds:'rgba(214,224,229,A)', cloudA:.62, sun:{x:.5, high:.15, r:15, core:'#ffffff', col:'#f4f6f2', glow:'244,246,242', glowR:120}, gulls:true, lantern:0, windows:0, beam:0, shaft:1.5, shaftCol:'225,238,242', surf:'120,150,165', surfA:.45, foam:'rgba(240,245,247,.7)', swell:'rgba(26,50,63,.72)', reflect:'240,245,247', pose:'fishing', bright:true},
  {k:'dusk', label:'SUNSET', clock:'17:48', stops:['#18293a', '#4d3c4c', '#a9533b', '#efa067'], clouds:'rgba(42,28,40,A)', cloudA:.9, rimCol:'rgba(240,140,90,.55)', sun:{x:.3, lift:10, r:30, core:'#ffd8a8', col:'#f0a36a', glow:'240,140,90', glowR:280}, rays:'240,150,100', rayA:.35, lantern:.7, windows:.35, beam:.5, shaft:.8, shaftCol:'235,170,130', surf:'110,80,75', surfA:.28, foam:'rgba(240,190,150,.45)', swell:'rgba(16,22,30,.8)', reflect:'240,140,90', pose:'smoking', bright:false},
  {k:'deep', label:'DEEP NIGHT', clock:'02:14', stops:['#010206', '#04070d', '#0b141d'], clouds:'rgba(6,10,14,A)', cloudA:.35, stars:1, moon:{x:.38, high:.13, r:11}, lantern:1, windows:.6, beam:1.3, shaft:.25, shaftCol:'190,205,215', surf:'40,60,75', surfA:.12, foam:'rgba(170,190,200,.28)', swell:'rgba(4,9,14,.85)', reflect:'200,215,225', pose:'rod', bright:false}
];
const skyIdx = () => ((store.get('sky', 0) | 0) % SKIES.length + SKIES.length) % SKIES.length;
function advanceSky(){ store.set('sky', (skyIdx() + 1) % SKIES.length); }
world.sky = {from:0, to:0, t0:0, dur:1};
function initSky(){ const i = skyIdx(); world.sky = {from:i, to:i, t0:0, dur:1}; document.body.classList.toggle('sky-bright', SKIES[i].bright); }
function syncSky(dur){ const i = skyIdx(); if (world.sky.to === i) return; world.sky = {from:world.sky.to, to:i, t0:performance.now(), dur:Math.max(800, dur)}; document.body.classList.toggle('sky-bright', SKIES[i].bright); }
let stars = [], gulls = [], smoke = [], smokeT = 0;
function seedSky(){
  const r = rng('sky' + VW);
  stars = []; for (let i = 0; i < 170; i++) stars.push({x:r() * VW, y:r(), s:.4 + Math.pow(r(), 3) * 1.6, ph:r() * 6.28, sp:.5 + r() * 2});
  gulls = []; for (let i = 0; i < 4; i++) gulls.push({x:r() * VW, y:.35 + r() * .4, sp:12 + r() * 14, ph:r() * 6.28, s:.7 + r() * .6});
}
function drawSky(sk, alpha, yw, t, dt){
  if (alpha <= 0) return;
  cx.save(); cx.globalAlpha = alpha;
  const top = yw - VH * .34;
  const g = cx.createLinearGradient(0, top, 0, yw);
  sk.stops.forEach((c, i) => g.addColorStop(i / (sk.stops.length - 1), c));
  cx.fillStyle = g; cx.fillRect(-30, -30, VW + 60, yw + 60);
  if (sk.stars){
    for (const s of stars){ const sy = top + (yw - top) * s.y * .92; if (sy > yw - 8) continue; const a = (.35 + .65 * Math.max(0, Math.sin(t * s.sp + s.ph))) * sk.stars * (1 - s.y * .6);
      cx.fillStyle = `rgba(220,230,236,${a.toFixed(2)})`; cx.beginPath(); cx.arc(s.x, sy, s.s, 0, 6.28); cx.fill(); }
  }
  if (sk.moon){
    const mx = VW * sk.moon.x, my = yw - VH * sk.moon.high, r = sk.moon.r;
    const mg = cx.createRadialGradient(mx, my, 0, mx, my, r * 9); mg.addColorStop(0, 'rgba(201,214,220,.22)'); mg.addColorStop(1, 'rgba(201,214,220,0)');
    cx.fillStyle = mg; cx.fillRect(mx - r * 9, my - r * 9, r * 18, r * 18);
    cx.fillStyle = '#d6e0e5'; cx.beginPath(); cx.arc(mx, my, r, 0, 6.28); cx.fill();
    cx.fillStyle = sk.stops[1]; cx.beginPath(); cx.arc(mx + r * .55, my - r * .2, r * .92, 0, 6.28); cx.fill();
  }
  if (sk.moonGlow){ const mx = VW * .24, my = yw - VH * .17; const mg = cx.createRadialGradient(mx, my, 0, mx, my, 180); mg.addColorStop(0, `rgba(201,214,220,${sk.moonGlow})`); mg.addColorStop(.12, `rgba(201,214,220,${sk.moonGlow * .45})`); mg.addColorStop(1, 'rgba(201,214,220,0)'); cx.fillStyle = mg; cx.fillRect(-30, -30, VW + 60, yw + 60); }
  if (sk.sun){
    const S = sk.sun, sx = VW * S.x, sy = S.high ? yw - VH * S.high : yw + S.lift;
    const gg = cx.createRadialGradient(sx, sy, 0, sx, sy, S.glowR); gg.addColorStop(0, `rgba(${S.glow},.55)`); gg.addColorStop(.25, `rgba(${S.glow},.2)`); gg.addColorStop(1, `rgba(${S.glow},0)`);
    cx.fillStyle = gg; cx.fillRect(sx - S.glowR, sy - S.glowR, S.glowR * 2, S.glowR * 2);
    if (sk.rays){ cx.save(); cx.globalCompositeOperation = 'lighter'; for (let i = 0; i < 9; i++){ const a = -Math.PI + (i + .5) / 9 * Math.PI + Math.sin(t * .1 + i) * .03, L = S.glowR * (1.1 + (i % 3) * .25); cx.strokeStyle = `rgba(${sk.rays},${((.05 + (i % 2) * .03) * (sk.rayA || 1)).toFixed(3)})`; cx.lineWidth = 10 + (i % 3) * 8; cx.beginPath(); cx.moveTo(sx + Math.cos(a) * S.r * 1.6, sy + Math.sin(a) * S.r * 1.6); cx.lineTo(sx + Math.cos(a) * L, sy + Math.sin(a) * L); cx.stroke(); } cx.restore(); }
    const dg = cx.createRadialGradient(sx, sy, S.r * .2, sx, sy, S.r); dg.addColorStop(0, S.core); dg.addColorStop(1, S.col);
    cx.fillStyle = dg; cx.beginPath(); cx.arc(sx, sy, S.r, 0, 6.28); cx.fill();
  }
  for (const cl of clouds){ const cy2 = yw - (yw + 30) * cl.y; const a = cl.a * sk.cloudA;
    cx.fillStyle = sk.clouds.replace('A', a.toFixed(2)); cx.beginPath(); cx.ellipse(cl.x, cy2, cl.w * .55, cl.w * .09, 0, 0, 6.28); cx.ellipse(cl.x + cl.w * .2, cy2 - cl.w * .05, cl.w * .3, cl.w * .08, 0, 0, 6.28); cx.fill();
    if (sk.rimCol){ cx.strokeStyle = sk.rimCol; cx.lineWidth = 1.2; cx.beginPath(); cx.ellipse(cl.x, cy2 + 1.5, cl.w * .5, cl.w * .07, 0, .15, Math.PI - .15); cx.stroke(); } }
  if (sk.gulls){ cx.strokeStyle = 'rgba(14,22,28,.75)'; cx.lineWidth = 1.4; cx.lineCap = 'round';
    for (const b of gulls){ const gy = yw - (yw + 20) * b.y + Math.sin(t * .6 + b.ph) * 6, f = Math.sin(t * 5 + b.ph) * 3 * b.s, w = 7 * b.s; cx.beginPath(); cx.moveTo(b.x - w, gy - f * .3); cx.quadraticCurveTo(b.x - w * .45, gy - 3 * b.s - f, b.x, gy); cx.quadraticCurveTo(b.x + w * .45, gy - 3 * b.s - f, b.x + w, gy - f * .3); cx.stroke(); } }
  if (sk.rain){ cx.strokeStyle = 'rgba(160,180,190,.12)'; cx.lineWidth = 1; for (const r of rain){ const ry = (yw + 20) * r.y - 20; cx.beginPath(); cx.moveTo(r.x, ry); cx.lineTo(r.x - r.l * .25, ry + r.l); cx.stroke(); } }
  // distant spit and lighthouse
  const hx = VW * .07, hy = yw - 6; cx.fillStyle = sk.bright ? 'rgba(20,30,38,.85)' : '#05080c'; cx.fillRect(hx - 2, hy - 22, 4, 22); cx.beginPath(); cx.moveTo(-30, hy + 4); cx.lineTo(hx + 40, hy + 2); cx.lineTo(hx + 60, hy + 8); cx.lineTo(-30, hy + 8); cx.fill();
  if (sk.beam){ const beam = Math.max(0, Math.sin(t * .9)); if (beam > .6){ const bgr = cx.createRadialGradient(hx, hy - 22, 0, hx, hy - 22, 60 * sk.beam); bgr.addColorStop(0, `rgba(240,230,200,${((beam - .6) * 2 * Math.min(1, sk.beam)).toFixed(2)})`); bgr.addColorStop(1, 'rgba(240,230,200,0)'); cx.fillStyle = bgr; cx.fillRect(hx - 80, hy - 102, 160, 160); } }
  cx.restore();
}
/* sun or moon path glittering on the swell, just under the waterline */
function drawReflection(sk, alpha, yw, t){
  if (!sk.reflect || alpha <= 0) return;
  const x0 = sk.sun ? VW * sk.sun.x : VW * (sk.moon ? sk.moon.x : .24);
  cx.save(); cx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 22; i++){
    const yy = yw + 4 + i * 4.2, spread = 10 + i * 5, w = (18 - i * .55) * (sk.sun ? 1 : .5);
    const x = x0 + Math.sin(t * 1.3 + i * 1.7) * spread * .45;
    const a = alpha * (.4 - i * .016) * (.55 + .45 * Math.sin(t * 3 + i * 2.1));
    if (a <= 0 || w <= 0) continue;
    cx.fillStyle = `rgba(${sk.reflect},${a.toFixed(3)})`; cx.fillRect(x - w / 2, yy, w, 1.6);
  }
  cx.restore();
}
/* the fisherman: one silhouette, one cap, three poses */
function figure(pose, t, smokeOut){
  const k = '#020305'; cx.fillStyle = k; cx.strokeStyle = k; cx.lineCap = 'round'; cx.lineJoin = 'round';
  const cap = (hx, hy) => { // dome, band and a long bill facing out to sea (left)
    cx.beginPath(); cx.ellipse(hx + .3, hy - 1.6, 4.5, 4.2, 0, Math.PI, 0); cx.closePath(); cx.fill();
    cx.beginPath(); cx.moveTo(hx - 3.6, hy - 1.9); cx.quadraticCurveTo(hx - 7.4, hy - 1.7, hx - 8.6, hy - .6); cx.lineTo(hx - 3.4, hy - .7); cx.closePath(); cx.fill();
    cx.beginPath(); cx.arc(hx + .3, hy - 5.9, .8, 0, 6.28); cx.fill();
  };
  const limb = (pts, w) => { cx.lineWidth = w; cx.beginPath(); pts.forEach((p, i) => i ? cx.lineTo(p[0], p[1]) : cx.moveTo(p[0], p[1])); cx.stroke(); };
  if (pose === 'fishing'){
    // seated on a crate at the stern rail, rod out over the water
    const fx = -34; cx.fillRect(fx - 3, -22, 11, 8);
    limb([[fx - 1, -24], [fx - 8, -23], [fx - 9.5, -14.5]], 3.2);
    cx.beginPath(); cx.moveTo(fx - 3.5, -23); cx.lineTo(fx + 4, -23); cx.lineTo(fx + 2.5, -36); cx.lineTo(fx - 5, -35); cx.closePath(); cx.fill();
    cx.beginPath(); cx.arc(fx - 2.6, -39.5, 3.8, 0, 6.28); cx.fill(); cap(fx - 2.6, -39.5);
    limb([[fx - 2, -34], [fx - 7, -29], [fx - 12, -30]], 2.4);
    const bob = Math.sin(t * 1.4) * 1.5;
    cx.lineWidth = 1.6; cx.beginPath(); cx.moveTo(fx - 4, -25); cx.lineTo(fx - 62, -66 + bob); cx.stroke();
    return {tip:[fx - 62, -66 + bob]};
  }
  if (pose === 'smoking'){
    // standing at the rail, looking out to sea, cigarette at the lips
    const fx = -40;
    limb([[fx - 1.5, -14], [fx - 1.5, -27]], 3); limb([[fx + 2, -14], [fx + 2.5, -27]], 3);
    cx.beginPath(); cx.moveTo(fx - 3.5, -27); cx.lineTo(fx + 4.5, -27); cx.lineTo(fx + 5, -40); cx.lineTo(fx - 4.5, -40.5); cx.closePath(); cx.fill();
    cx.beginPath(); cx.arc(fx - .3, -45, 3.9, 0, 6.28); cx.fill(); cap(fx - .3, -45);
    limb([[fx + 3, -38], [fx - 5, -31], [fx - 10, -29]], 2.4);             // forearm on the rail
    const drag = (t % 7) < 1.4;                                           // every few seconds, a drag
    const hand = drag ? [fx - 5.2, -44] : [fx - 7, -35];
    limb([[fx - 3, -39], [fx - 5.5, -36.5], hand], 2.4);
    const tipX = hand[0] - (drag ? 2.6 : 3.2), tipY = hand[1] - (drag ? .4 : 1.2);
    cx.strokeStyle = 'rgba(201,214,220,.55)'; cx.lineWidth = .8; cx.beginPath(); cx.moveTo(hand[0] - .4, hand[1]); cx.lineTo(tipX, tipY); cx.stroke();
    const glow = drag ? .95 : .55 + Math.sin(t * 2.2) * .1;
    cx.fillStyle = `rgba(255,120,70,${glow.toFixed(2)})`; cx.beginPath(); cx.arc(tipX, tipY, drag ? 1.1 : .8, 0, 6.28); cx.fill();
    smokeOut.ember = [tipX, tipY]; smokeOut.mouth = [fx - 4.2, -44]; smokeOut.exhale = (t % 7) > 1.5 && (t % 7) < 2.6;
    // rod left propped against the cabin, line slack into the water
    cx.strokeStyle = k; cx.lineWidth = 1.6; cx.beginPath(); cx.moveTo(30, -14); cx.lineTo(66, -70); cx.stroke();
    return {tip:[66, -70], slack:true};
  }
  // standing at the rod
  const fx = -32;
  limb([[fx - 1.5, -14], [fx - 1.5, -27]], 3); limb([[fx + 2, -14], [fx + 2.5, -27]], 3);
  cx.beginPath(); cx.moveTo(fx - 3.5, -27); cx.lineTo(fx + 4.5, -27); cx.lineTo(fx + 5, -40); cx.lineTo(fx - 4.5, -40.5); cx.closePath(); cx.fill();
  cx.beginPath(); cx.arc(fx - .3, -45, 3.9, 0, 6.28); cx.fill(); cap(fx - .3, -45);
  limb([[fx - 3, -38], [fx - 8, -33], [fx - 13, -31]], 2.4); limb([[fx + 3, -38], [fx - 2, -30], [fx - 9, -27]], 2.4);
  cx.lineWidth = 2.2; cx.beginPath(); cx.moveTo(fx - 6, -22); cx.lineTo(fx - 50, -64); cx.stroke();
  return {tip:[fx - 50, -64]};
}
function drawBoatSky(bx, by, ang, sc, t, dt, sk, yw){
  cx.save(); cx.translate(bx, by); cx.rotate(ang); cx.scale(sc, sc);
  const k = '#020305'; cx.fillStyle = k; cx.strokeStyle = k;
  cx.lineWidth = 3; cx.beginPath(); cx.moveTo(10, -14); cx.lineTo(10, -84); cx.stroke();
  cx.lineWidth = 1; cx.beginPath(); cx.moveTo(10, -84); cx.lineTo(-56, -14); cx.moveTo(10, -84); cx.lineTo(56, -14); cx.stroke();
  cx.fillRect(-4, -42, 42, 30); cx.fillRect(-8, -47, 50, 6);
  cx.beginPath(); cx.moveTo(-64, -14); cx.lineTo(62, -14); cx.quadraticCurveTo(60, 10, 38, 20); cx.lineTo(-42, 20); cx.quadraticCurveTo(-60, 8, -64, -14); cx.fill();
  cx.fillRect(-64, -19, 126, 2);                                     // rail
  if (sk.windows > 0){ cx.fillStyle = `rgba(255,190,120,${sk.windows})`; cx.fillRect(4, -36, 10, 8); cx.fillRect(22, -36, 10, 8); }
  if (sk.lantern > 0){ const lx = 40 + Math.sin(t * 1.7) * 3, ly = -50, L = sk.lantern;
    const lg = cx.createRadialGradient(lx, ly, 0, lx, ly, 34); lg.addColorStop(0, `rgba(255,200,130,${(.5 * L).toFixed(2)})`); lg.addColorStop(1, 'rgba(255,200,130,0)');
    cx.fillStyle = lg; cx.beginPath(); cx.arc(lx, ly, 34, 0, 6.28); cx.fill(); cx.fillStyle = `rgba(255,213,154,${L})`; cx.beginPath(); cx.arc(lx, ly, 2.2, 0, 6.28); cx.fill(); }
  const blink = (Math.sin(t * 2.4) > .2) ? 1 : .25;
  cx.fillStyle = `rgba(224,49,61,${blink})`; cx.beginPath(); cx.arc(10, -86, 2.4, 0, 6.28); cx.fill();
  cx.fillStyle = 'rgba(224,49,61,.9)'; cx.beginPath(); cx.arc(-60, -16, 1.8, 0, 6.28); cx.fill();
  cx.fillStyle = 'rgba(90,220,150,.85)'; cx.beginPath(); cx.arc(58, -16, 1.8, 0, 6.28); cx.fill();
  const sm = {}; const f = figure(sk.pose, t, sm);
  const toWorld = (x, y) => { const c = Math.cos(ang), s = Math.sin(ang); return [bx + (x * c - y * s) * sc, by + (x * s + y * c) * sc]; };
  cx.restore();
  // fishing line, in world space so it can meet the real water
  const tip = toWorld(f.tip[0], f.tip[1]);
  const lx = tip[0] + (f.slack ? 14 : -26) * sc, ly = waveY(lx, t, yw) + 1;
  cx.strokeStyle = sk.bright ? 'rgba(20,30,38,.6)' : 'rgba(201,214,220,.35)'; cx.lineWidth = .8;
  cx.beginPath(); cx.moveTo(tip[0], tip[1]); cx.quadraticCurveTo(tip[0] + (lx - tip[0]) * .5 + (f.slack ? 6 : -4), tip[1] + (ly - tip[1]) * (f.slack ? .85 : .55), lx, ly); cx.stroke();
  if (sk.pose === 'fishing'){
    cx.fillStyle = '#E0313D'; cx.beginPath(); cx.arc(lx, ly - 1, 2.2 * sc, 0, 6.28); cx.fill();
    cx.fillStyle = '#e8eef1'; cx.beginPath(); cx.arc(lx, ly - 2.2 * sc, 1.1 * sc, 0, 6.28); cx.fill();
    const rp = (t * .6) % 1; cx.strokeStyle = `rgba(240,245,247,${((1 - rp) * .5).toFixed(2)})`; cx.lineWidth = .8; cx.beginPath(); cx.ellipse(lx, ly + 1, 4 + rp * 16, 1 + rp * 3, 0, 0, 6.28); cx.stroke();
  }
  // cigarette smoke: thin, slow, and gone quickly
  if (sm.ember){
    smokeT += dt;
    const em = toWorld(sm.ember[0], sm.ember[1]);
    if (smokeT > .32){ smokeT = 0; smoke.push({x:em[0], y:em[1], vx:4 + Math.random() * 3, vy:-7 - Math.random() * 4, r:.9 * sc, life:1, a:.16}); }
    if (sm.exhale && Math.random() < .35){ const mo = toWorld(sm.mouth[0], sm.mouth[1]); smoke.push({x:mo[0], y:mo[1], vx:-6 - Math.random() * 4, vy:-3 - Math.random() * 3, r:1.6 * sc, life:1, a:.2}); }
  }
  for (let i = smoke.length - 1; i >= 0; i--){ const p = smoke[i]; p.life -= dt / 3.4; if (p.life <= 0){ smoke.splice(i, 1); continue; }
    p.x += (p.vx + Math.sin(t * 1.3 + i) * 2) * dt; p.y += p.vy * dt; p.vx += 3 * dt; p.r += 2.4 * dt;
    cx.fillStyle = `rgba(214,222,226,${(p.a * p.life).toFixed(3)})`; cx.beginPath(); cx.arc(p.x, p.y, p.r, 0, 6.28); cx.fill(); }
}
function drawSurface(yw, t, dt){
  const W = world.sky, now = performance.now(), mix = W.from === W.to ? 1 : clamp((now - W.t0) / W.dur, 0, 1);
  if (mix >= 1 && W.from !== W.to) W.from = W.to;
  const A = SKIES[W.from], B = SKIES[W.to];
  for (const cl of clouds){ cl.x += cl.sp * dt; if (cl.x > VW + cl.w) cl.x = -cl.w; }
  for (const r of rain){ r.y += r.sp * dt; if (r.y > 1) r.y -= 1; }
  for (const b of gulls){ b.x += b.sp * dt; if (b.x > VW + 30) b.x = -30; }
  cx.save(); cx.beginPath(); cx.moveTo(-30, -30); cx.lineTo(VW + 30, -30);
  for (let x = VW + 30; x >= -30; x -= 10) cx.lineTo(x, waveY(x, t, yw));
  cx.closePath(); cx.clip();
  if (mix < 1) drawSky(A, 1, yw, t, dt);
  drawSky(B, mix < 1 ? easeIO(mix) : 1, yw, t, dt);
  cx.restore();
  const sk = mix < .5 ? A : B;
  if (mix < 1) drawReflection(A, 1 - mix, yw, t);
  drawReflection(B, mix, yw, t);
  const bxp = VW * .7 + Math.sin(t * .12) * 26, sc2 = clamp(VW / 640, .6, 1.1);
  const y1 = waveY(bxp - 30, t, yw), y2 = waveY(bxp + 30, t, yw);
  drawBoatSky(bxp, (y1 + y2) / 2 - 2, Math.atan2(y2 - y1, 60) * .9, sc2, t, dt, sk, yw);
  cx.fillStyle = sk.swell; cx.beginPath(); cx.moveTo(-30, VH + 30);
  for (let x = -30; x <= VW + 30; x += 10) cx.lineTo(x, waveY(x + 40, t * 1.15, yw + 6));
  cx.lineTo(VW + 30, VH + 30); cx.closePath(); cx.fill();
  cx.strokeStyle = sk.foam; cx.lineWidth = 1.5; cx.beginPath();
  for (let x = -30; x <= VW + 30; x += 10){ const y = waveY(x, t, yw); x === -30 ? cx.moveTo(x, y) : cx.lineTo(x, y); }
  cx.stroke();
  // bright skies: a quiet scrim keeps the top bar and gauge readable
  const bright = (A.bright ? 1 - mix : 0) + (B.bright ? mix : 0);
  if (bright > .01){ const sg = cx.createLinearGradient(0, 0, 0, 130); sg.addColorStop(0, `rgba(3,5,8,${(.55 * bright).toFixed(2)})`); sg.addColorStop(1, 'rgba(3,5,8,0)'); cx.fillStyle = sg; cx.fillRect(-30, -30, VW + 60, 160); }
}
function skyNow(){ return SKIES[world.sky.to]; }

/* ============================== the Codex ==============================
   Every answer a diver has ever brought up, with an encyclopedia entry that grows with its tier:
   Surface Foam gets a line, a gem gets the whole story plus a hand-written field note.
   Unfound answers stay sealed, so the Codex never spoils the game.                        */
const CODEX_NOTES = {"instrument": "A violin that thinks it is a machine. You turn a crank, a rosin wheel bows the strings, and a drone hums underneath like a ship's engine. Medieval monks played it; folk bands still do. Almost nobody types it.", "greekgod": "The blind prophet of Thebes, who lived seven years as a woman and told Oedipus the truth no one wanted. Even in the underworld he kept his mind. Divers who name him have read past the famous myths.", "norse": "A squirrel who runs up and down the world tree carrying insults between the eagle at the top and the dragon gnawing the roots. Norse cosmology has a gossip. You found him.", "egyptgod": "Part hippopotamus, part crocodile, part lion, and wholly protective. Taweret guarded mothers and babies in childbirth, and her amulets were in homes all over Egypt. Fierce-looking, gentle-minded, rarely remembered.", "romanemperor": "Emperor for 87 days in 193 AD. He tried to restore discipline to the Praetorian Guard, so the Guard killed him and auctioned the throne to the highest bidder. A short reign with a long shadow.", "president": "Delivered the longest inaugural address in American history, in cold rain, without a coat. He died 31 days later, the shortest presidency ever. A gem because almost nobody counts him.", "ukpm": "The only British prime minister ever assassinated, shot in the lobby of the House of Commons in 1812. A quiz-night legend that few remember under pressure.", "shakespeare": "Shipwrecks, pirates, a brothel and a long-lost daughter: Pericles is Shakespeare at his most fairy-tale and least performed. Probably co-written, rarely staged, almost never named.", "bible": "One short letter, a single chapter, from Paul about a runaway named Onesimus. One of the smallest books in the Bible, and one of the hardest to pull out of memory.", "painter": "A Baroque master who painted Judith beheading Holofernes with a violence that still stops people in museums. Overlooked for centuries, now rightly famous, still rarely the first name anyone says.", "composer": "Finland's national voice. Finlandia was written in protest, his symphonies sound like ice moving, and then he went almost silent for his last thirty years. A cold-water answer for a cold-water game.", "language": "Europe's great linguistic orphan. Basque is related to no other living language and was spoken in the Pyrenees before Indo-European languages arrived. Few divers think of it, and fewer can explain it.", "currency": "The money of Bhutan, pegged one-to-one to the Indian rupee, in a kingdom that measures Gross National Happiness. You knew this. That is unusual.", "philosopher": "The man who argued that motion is impossible: an arrow in flight is always at rest, and fast Achilles can never catch the tortoise. His paradoxes kept mathematicians busy for two thousand years.", "civilization": "Desert traders who carved Petra out of rose-red cliffs and ran the incense routes of Arabia. Everyone knows their city. Almost no one remembers their name.", "dance": "Born in the ballrooms of Harlem in the late 1920s, wild and joyful, the grandmother of swing dancing. Named, so the story goes, after Lindbergh's flight: the Lindy hopped the Atlantic.", "myth": "The sea monster of the Hebrew Bible, so vast that its name became a word for anything enormous and unstoppable. Hobbes named his theory of the state after it. A deep-water answer in every sense.", "author": "Italian fabulist of invisible cities and impossible books. If on a Winter's Night a Traveller is a novel about trying to read a novel. A writer's writer, rarely a quick answer.", "genre": "Accordion and washboard music from Creole Louisiana, blending blues, R&B and French folk. It sounds like a party on a porch. Divers almost never reach it.", "empire_hist": "In 1571, the last great battle fought between oared galleys, off the coast of Greece. The Holy League broke Ottoman naval power for a generation, and a young Cervantes lost the use of his left hand.", "author2": "Disney's strangest, funniest film: an emperor turned into a llama, rescued by a peasant he wronged. It was born from a troubled epic production and became a cult favourite. Pull the lever, Kronk.", "pixar": "A summer on the Italian Riviera, two sea monsters who look like boys, and a Vespa they dream of. Pixar's gentlest film, released straight to streaming and quietly loved.", "pokemon": "A duck that carries a leek it uses as a weapon. Rare in the original games, impossible to evolve until years later, and impossible to spell. Exactly the kind of answer this game exists for.", "superhero": "A legacy hero passed from one person to the next, powered in the modern version by an alien scarab fused to a teenager's spine. A cult favourite that rarely gets named first.", "hpchar": "Harry's batty neighbour on Privet Drive, smelling of cabbage, who was a Squib in Dumbledore's service all along. One of the series' best hidden reveals.", "starwars": "The only X-wing pilot to survive both Death Star attacks and the Battle of Endor. He never gets a lightsaber or a destiny. He just keeps flying, and keeps living.", "videogame": "You play the sun goddess Amaterasu as a white wolf, painting the world back to life with a celestial brush. Gorgeous, overlooked at launch, now a cult classic.", "appsocial": "Google's first social network, huge in Brazil and India, shut down in 2014. Ask anyone from São Paulo about scraps and communities. The rest of the world forgot it existed.", "carbrand": "The Soviet car that refused to die. The boxy Lada Riva, licensed from a Fiat, ran on Russian roads for decades. Easy to mock, very hard to kill.", "fashion": "Simon Porte Jacquemus, from a village in Provence, turned tiny handbags and sun-baked minimalism into one of Paris's most talked-about labels. Fashion people know it. Divers rarely do.", "techco": "Named after the seeing-stones in The Lord of the Rings, Palantir builds data-analysis software for governments and militaries. Powerful, secretive and controversial, it rarely comes up in casual answers.", "beatles": "Lyrics lifted almost word for word from a Victorian circus poster John Lennon bought in an antique shop. George Martin built its whirling fairground from tape loops cut up and thrown in the air.", "simpsons": "Grimey: the one man in Springfield who sees how absurd Homer's life is, and it destroys him. One of the darkest and most beloved characters, in a single episode.", "bondfilm": "George Lazenby's only outing as Bond: he falls in love, marries, and loses everything in the final scene. Long underrated, now often called the best of them all.", "sitcom": "Two flatmates in Croydon whose inner monologues are funnier and worse than anything they say aloud. British, painful and brilliant. Few divers reach it.", "sport": "Tag meets wrestling, played holding your breath while chanting 'kabaddi'. Ancient in South Asia, now a professional league sport. A strong gem if you knew it.", "martialart": "A Victorian gentleman's martial art mixing jujutsu, boxing and cane fighting. Sherlock Holmes used 'baritsu' to survive Reichenbach Falls. Almost no one types it.", "cardgame": "A trick-taking game from Bavaria where queens and jacks outrank aces, partners change every hand, and Wisconsin plays it in taverns. Fiercely local, wonderfully obscure.", "boardgame": "The Viking board game: a king and his defenders in the centre, attackers on every side, and the king must escape to a corner. It was played across Scandinavia long before chess arrived.", "footclub": "A club from a small Arctic town above the Arctic Circle that rose from the second tier to beating Roma 6-1 in Europe. The best underdog story in modern football.", "footballer": "Brazil's philosopher-captain: a qualified doctor, a smoker, a political activist, and the most elegant midfielder of the 1982 World Cup. A name divers rarely reach.", "tennisplayer": "Runner-up three times, then in 2001 he won Wimbledon as a wildcard ranked 125th in the world, crying on Centre Court. Tennis's greatest fairy tale.", "f1driver": "Japan's fearless overtaker, who earned a podium at his home Grand Prix in Suzuka and a crowd that chanted his name. Remembered by fans, rarely by divers.", "color": "The deep sky-blue of a clear afternoon, named from the Latin for sky. Painters prized it for its stability. Less famous than azure, and more beautiful.", "clothing": "The leather pouch worn at the front of a Scottish kilt, because kilts have no pockets. Practical, ceremonial, and almost never named.", "kitchen": "A curved blade with a handle at each end, rocked back and forth to mince herbs. Its name means 'half moon' in Italian. A chef's answer.", "tool": "An ancient tool like an axe with its blade turned sideways, for shaping timber and hollowing out canoes. It is older than the Bronze Age and still used by shipwrights.", "job": "The craftsperson who trims and shoes horses' hooves. One of the oldest trades still practised, part blacksmith and part vet. A rare and honest answer.", "furniture": "A low sideboard for the dining room, with Italian roots and a mid-century revival. You know one when you see one. Almost nobody remembers the word.", "vehicle": "A cable railway climbing a steep slope, two cars balanced against each other like weights on a pulley. A bit of gentle engineering that few divers name.", "shape": "A quadrilateral with two pairs of equal adjacent sides, shaped like the toy flying overhead. Geometry hides it behind the word deltoid.", "weather": "Bright spots of light on either side of a low sun, made by ice crystals acting as prisms. Ancient sailors took them as omens. A cold-weather gem.", "hat": "A fur hat with ear flaps that tie up or down: Russia's ushanka, or the trapper's hat of the northern woods. It is built for winds that hurt.", "knot": "A climber's knot that forms a secure loop in the middle of a rope and takes load in any direction. Mountaineers trust their lives to it. Few others know it.", "footwear": "Japanese wooden sandals raised on two teeth, clacking on stone streets. They are worn with yukata at summer festivals. An answer from far down the list.", "emotion": "A Portuguese longing for something or someone loved and lost, that may never return, sweet and painful at once. It is the soul of fado. Untranslatable, and you reached it.", "fruit": "A green egg-shaped fruit from South America that became New Zealand's autumn obsession. It tastes like pineapple, guava and mint arguing politely. Most of the world has never tried it.", "vegetable": "A long, thin root known as the oyster plant, because cooked it supposedly tastes of oysters. Victorian kitchens loved it. Modern ones forgot it.", "cheese": "The squeaky, grillable cheese of Cyprus, which holds its shape in a hot pan when other cheeses melt. Everyone has eaten it. Few name it here.", "pasta": "Short twisted rolls of pasta from Sicily, shaped to cradle sauce in their grooves. Its name means 'homemade'. A connoisseur's answer.", "spice": "Peppery, citrusy seeds from West Africa, once traded at a premium in medieval Europe as a pepper substitute. The name alone sells it.", "bread": "Dense, dark rye bread from Westphalia, baked low and slow for up to a day until it turns nearly black. A northern loaf for northern water.", "cocktail": "A modern classic invented in New York in 2005: blended Scotch, honey-ginger syrup and lemon, with a smoky Islay whisky floated on top. Bartenders worship it.", "dessert": "A cloud of meringue crowned with cream and fruit, named after the ballerina Anna Pavlova. Australia and New Zealand still argue over who made it first.", "japdish": "A silky savoury egg custard steamed in a cup, hiding shrimp, ginkgo nuts and mushrooms. Quiet, delicate and very Japanese. Rarely named.", "soup": "A creamy soup of smoked haddock, potatoes and onions from the fishing village of Cullen in Scotland. A northern-sea dish for a northern-sea game.", "nut": "Not a nut at all but a tuber, sweet and nutty. It is the base of Valencian horchata and was cultivated in ancient Egypt. A trick answer you got right.", "candy": "Australia's chocolate biscuit, best eaten through the 'Tim Tam slam': bite off opposite corners, use it as a straw for hot drinks, and eat it fast.", "coffee": "Mexican pot coffee, brewed in clay with cinnamon and piloncillo sugar. The clay pot is part of the flavour. A warm, deep answer.", "fastfood": "Guatemala's fried-chicken chain, so loved that emigrants carry buckets of it onto flights to the United States. A cult brand few outside Central America know.", "italdish": "Fried rice balls from Sicily, stuffed with ragù or cheese and named after little oranges. Street food with centuries of history.", "mexdish": "Yucatán pork marinated in sour orange and annatto, wrapped in banana leaves and slow-roasted underground. Mayan in origin and rich in flavour.", "indiandish": "A Gujarati winter dish of mixed vegetables, traditionally cooked upside down in earthen pots buried in a fire. Its name comes from the word for 'upside down'.", "country": "Two volcanic islands on the equator in the Gulf of Guinea, Africa's second-smallest country, once among the world's largest cocoa producers. Easy to forget, wonderful to remember.", "capital": "Bhutan's capital had no traffic lights for decades. One was installed, and people found it so impersonal it was removed, leaving a white-gloved policeman directing traffic by hand.", "usstate": "Corn, plains, and the Sandhills: the state everyone forgets on a map test. That is exactly why it is a gem here.", "river": "Venezuela's great river, running from the Guiana Highlands to a vast delta on the Atlantic. River dolphins and the Casiquiare connect it to the Amazon.", "mountain": "The southernmost active volcano on Earth, on Ross Island in Antarctica, with a permanent lava lake in its crater. It is named after the ship of the same name.", "island": "An Arctic archipelago halfway between Norway and the North Pole, with more polar bears than people in some counts. Home to the Global Seed Vault. Deep north, deep cut.", "desert": "The red parallel dunes of central Australia, among the longest in the world. Remote, beautiful, and rarely named.", "lake": "One of Africa's Great Lakes, home to hundreds of cichlid fish species found nowhere else. Its clear water and colourful fish make it a living laboratory of evolution.", "sea": "A frozen sea off Antarctica, where the Endurance was crushed by ice in 1915 and finally found on the seabed in 2022. One of the coldest and cleanest waters on Earth.", "afcountry": "Volcanic islands between Mozambique and Madagascar, famous for ylang-ylang perfume and the coelacanth, a fish thought extinct for 66 million years.", "ascountry": "A tiny sultanate on the island of Borneo, rich in oil, with a royal palace among the largest residential buildings in the world.", "eucountry": "One of the world's oldest republics, claiming a founding in 301 AD, perched on Mount Titano inside Italy. Small country, long memory.", "landlocked": "The 'Kingdom in the Sky', entirely surrounded by South Africa, with its lowest point higher than any other country's. Few divers think of it.", "auscity": "A gold-rush city in Western Australia's interior, built beside the Super Pit, an open-cut gold mine so large it is visible from space. Hard to reach, harder to forget.", "japcity": "A castle town on the Sea of Japan with one of the country's three great gardens, Kenroku-en, and a long tradition of gold leaf. It escaped wartime bombing and kept its old streets.", "ukcity": "A Victorian seaside town on the north Welsh coast, with a pier, a tramway up the Great Orme, and a link to the girl who inspired Alice in Wonderland.", "uscity": "The city in the shadow of Mount Rainier, a port across Puget Sound from Seattle, with its own famous collapsed bridge, Galloping Gertie.", "incity": "A temple city in Tamil Nadu that has been continuously inhabited for well over two thousand years, built around the towering gopurams of the Meenakshi Temple.", "brcity": "A baroque gold-rush town in the mountains of Minas Gerais, its churches heavy with gold and carved by the sculptor Aleijadinho. A UNESCO World Heritage Site.", "itcity": "A city of cave dwellings carved into a ravine in Basilicata, once called the shame of Italy and later a European Capital of Culture. One of the oldest continuously inhabited places on Earth.", "decity": "A Bavarian town built on seven hills like Rome, with a town hall standing on an island in the river and a famous smoked beer.", "frcity": "An Alsatian town of timber-framed houses and little canals, so storybook-pretty it is often said to have inspired the village in Beauty and the Beast.", "escity": "A medieval town in Castile where the 'hanging houses' lean out over a gorge, and a museum of abstract art sits inside one of them.", "cacity": "A lake town in British Columbia's Okanagan Valley, among vineyards and orchards, with its own lake monster, the Ogopogo.", "mxcity": "A colourful colonial silver town in a ravine, with underground streets for traffic. Its mummy museum is one of the strangest places in Mexico.", "cncity": "Limestone karst peaks rising out of the Li River like teeth. This landscape is printed on China's 20-yuan note and has been painted for a thousand years.", "bigcity": "Once the most dangerous city in the world, Medellín rebuilt itself around cable cars, escalators and libraries in its poorest hillside neighbourhoods. A city of reinvention.", "krcity": "The heart of Korea's Confucian tradition, home to Hahoe Folk Village, wooden masks and a famous braised chicken dish.", "trcity": "An Ottoman town of wooden mansions on the Black Sea route, so well preserved it is a UNESCO World Heritage Site. Saffron once grew here, which gave the town its name.", "secity": "A small town above the Arctic Circle in Swedish Lapland, home of a winter Sámi market that has been held every February since 1605.", "nocity": "The northernmost town in the world with over a thousand people, on Svalbard. The sun does not rise for months in winter, and you are not supposed to walk out of town without protection from polar bears.", "ngcity": "A Yoruba city in Nigeria built around the sacred grove of the river goddess Osun, a forest filled with sculptures and shrines and recognised by UNESCO.", "arcity": "A high-desert village in the Quebrada de Humahuaca in northwest Argentina, below mountains striped in seven colours, with a pre-Inca fortress above town.", "plcity": "Poland's ideal Renaissance town, designed in the 16th century around a perfectly proportioned market square. It is sometimes called the Padua of the North.", "nlcity": "A Dutch village with no roads in its old centre, only canals, footpaths and more than 170 wooden bridges. Locals get around by boat.", "iecity": "A planned town on Clew Bay in County Mayo, beneath Croagh Patrick, the holy mountain Irish pilgrims climb barefoot.", "nzcity": "A New Zealand town built from white limestone, with a steampunk museum and a colony of little blue penguins that waddle ashore every evening.", "rucity": "The northernmost city in the world with more than 100,000 people, built over nickel mines above the Arctic Circle. It has no road connection to the rest of Russia.", "indodish": "Jackfruit stewed for hours in palm sugar and coconut milk until it turns sweet and brown. Gudeg is the soul food of Yogyakarta and is often eaten for breakfast.", "indoisland": "A small volcanic island off the tip of Sumatra, Indonesia's westernmost point, where Kilometre Zero marks the start of the country. It is famous among divers for its reefs.", "indocity": "A city on Borneo that sits right on the Equator, marked by a monument where the sun stands directly overhead twice a year and casts no shadow.", "fish": "The game's namesake. Its leafy appendages are pure camouflage, it lives only off southern Australia, and the males carry the eggs. You found the one in a leafy seadragon.", "seacreature": "A deep-sea cucumber that walks across the abyssal plain on water-filled legs, plump and pink. It lives miles down, where few things this cute should live.", "bird": "An Australian night bird with a huge gaping mouth and feathers like tree bark. By day it freezes on a branch and becomes the branch.", "dog": "The only dog breed named after a fictional character, a farmer in a Walter Scott novel. A small Scottish terrier with a topknot of silky hair.", "cat": "The swimming cat: a white cat with coloured markings only on the head and tail, from the Lake Van region of eastern Turkey, known for enjoying water.", "dino": "A giant plant-eating dinosaur with claws up to a metre long, perhaps the longest claws of any animal ever. It looked like a nightmare and ate leaves.", "insect": "One of the heaviest insects on Earth, an African beetle as large as a child's hand. Its grubs can weigh as much as a hamster.", "ausanimal": "The game's own creature, native to the kelp off southern Australia. If you name it for Australia, you understood the whole game.", "snake": "The snake with the longest fangs and one of the largest venom yields of any snake, camouflaged like dead leaves on the floor of an African forest. Beautiful and very slow, until it strikes.", "shark": "A carpet shark with a fringed beard that lies flat on the reef looking like a rug, then strikes upward. Its name comes from an Australian Aboriginal language and is said to mean 'shaggy beard'.", "cetacean": "A round-headed river and coastal dolphin of Southeast Asia. In Myanmar it is known for cooperative fishing with humans, herding fish toward the nets. It is critically threatened.", "flower": "South Africa's national flower, the king protea, an artichoke-like bloom with an ancient lineage. Its family was already flowering when the continents were joined.", "tree": "A 'living fossil' conifer known only from fossils until a park officer found a grove in a hidden canyon near Sydney in 1994. Its location is still kept secret.", "mammal": "The only mammal covered in scales, which curls into an armoured ball when threatened. It is also the most trafficked mammal in the world. A gem with a warning attached.", "horse": "The last truly wild horse, saved from extinction by a few dozen animals in zoos and returned to the steppes of Mongolia. Stocky, dun-coloured and untamed.", "houseplant": "A succulent that trails down in strands of tiny green beads. It is beloved by plant collectors and easy to drown with too much water.", "mushroom": "A shaggy white fungus that hangs from trees like a frozen waterfall of icicles, and tastes like crab when fried.", "element": "Element 83, which grows iridescent stair-stepped crystals in rainbow colours. It is the active ingredient in some stomach remedies, and is almost, but not quite, stable.", "moon": "A small moon of Uranus with a patchwork surface of cliffs up to about 20 km high, among the tallest known in the solar system. It looks as if it had been broken and glued back together.", "bone": "A pea-sized bone in the wrist, named after the Latin for pea. It sits inside a tendon, so you can feel it under your skin right now.", "organ": "A gland behind the breastbone that trains the immune system's T cells and then quietly shrinks as you age. It does vital work early in life and then fades into fat.", "constellation": "The unicorn: a faint constellation between Orion and Canis Minor, full of nebulae and invisible to the naked eye in most cities.", "unit": "A unit of length based on the height of Oliver Smoot, an MIT student who was laid end to end across the Harvard Bridge in 1958. The bridge measures 364.4 smoots, plus or minus an ear.", "gem": "A feldspar that flashes blue and green fire when it catches the light, an effect called labradorescence. It looks dull until you turn it.", "proglang": "A purely functional language named after the logician Haskell Curry. Programmers either love it or fear it.", "scientist": "The mathematician whose theorem links every symmetry in physics to a conservation law. Einstein called her a creative mathematical genius, yet she was long denied a paid post because she was a woman.", "rock": "A banded metamorphic rock, its stripes formed under immense heat and pressure deep in the crust. Some gneiss is among the oldest rock on Earth. It is pronounced 'nice', which is half the fun.", "muscle": "The cheek muscle that keeps food between your teeth and gives a trumpet player's puffed-out cheeks their strength. Its name comes from the Latin for trumpeter.", "s_drunk": "Gently, genteelly drunk. A charmingly British word for the stage after two glasses of sherry, when everything is a little lopsided.", "s_money": "British slang for cash, especially the quick, borrowed kind. Old London street talk that later lent its name to a payday lender.", "s_net": "On social media, getting a reply with more likes than the post it answers, a public verdict that you lost the argument. One word, total humiliation.", "s_brit": "A splendidly impressive person or thing, a real stunner. It is an old, cheerful bit of British slang.", "s_aus": "Aussie for an ambulance, or the paramedic in it. Australians shorten every word they can, and this one survived.", "s_genz": "The 'tax' a friend takes when they steal a bite of your food, named after a streamer's friend. It shows how fast internet slang can spread worldwide.", "s_cool": "Surfer-speak for excellent, made immortal by Bill and Ted. Originally an old word meaning 'bold', revived in the 1980s.", "s_nonsense": "Pompous, empty talk. Few English words sound more like what they mean.", "s_toilet": "The medieval castle toilet: a seat over a shaft that dropped straight down the outer wall. Clothes were said to be hung there, because the ammonia kept moths away.", "s_untrans": "Japanese for buying books and letting them pile up unread. Every reader knows the feeling. Few know the word.", "seadish": "A rich Filipino stew of oxtail and vegetables in a thick peanut sauce, served with salty shrimp paste on the side. It is a fixture at family celebrations.", "kordish": "Korean blood sausage, stuffed with glass noodles and barley, steamed and sliced on the street. It is not the ice cream dessert, and that is the gem.", "chndish": "Giant, tender pork meatballs from Yangzhou, braised with cabbage leaves that look like a lion's mane. The name sounds fierce; the dish is soft.", "frdish": "Potatoes, bacon, onions and a whole wheel of Reblochon cheese, baked until it bubbles. It is the mountain dish of the Savoie Alps, created in the 1980s to sell more cheese.", "mideast": "Eggs poached in a spiced tomato and pepper sauce, served straight from the pan. It is popular across North Africa and Israel, and its name is said to mean 'mixed up'.", "dumpling": "Georgian soup dumplings pleated into a twisted topknot. You hold them by the knot, bite, and drink the broth inside before eating the rest.", "sauce": "Parsley, lemon zest and garlic, chopped together and scattered over osso buco. It is a sharp Milanese finishing touch that wakes up a heavy dish.", "tea": "A Chinese black tea smoked over pinewood fires until it tastes like a campfire. You either love it or you think someone burned the kettle.", "beer": "Bamberg's smoked beer, made from malt dried over beechwood fires. It tastes like bacon in a glass. Your first sip is a shock and your third is a revelation.", "grape": "The grape of Barolo and Barbaresco, named after the fog (nebbia) of the Piedmont hills. It makes pale-coloured wines that are tough when young and age for decades.", "pastry": "Portugal's custard tart, with a scorched top and flaky shell, perfected by monks at the Jerónimos Monastery in Lisbon. The original recipe is still kept secret.", "icecream": "Milk gelato threaded with fine shards of chocolate. It was invented in Bergamo in 1961 and is named after an egg-drop soup.", "pizzatop": "A soft, spreadable pork sausage from Calabria, fiery red with chilli. It melts into a pizza like hot butter.", "cake": "The Swedish princess cake, a dome of sponge, jam and custard under a smooth green marzipan coat with a pink rose on top. It was named for three princesses who loved it.", "seafood": "The wing of a ray, sweet and ribbed. It is classically served with black butter and capers. It looks strange and tastes clean, and the northern seas are full of it.", "volcano": "Iceland's most famous volcano, said in medieval Europe to be a gateway to hell. It still erupts every few decades.", "waterfall": "One of the most powerful waterfalls in Europe, thundering glacial grey water into a canyon in northern Iceland. It appears in the opening scene of Prometheus.", "landmark": "The world's largest Buddhist temple, built in central Java in the 9th century, then buried under volcanic ash and jungle for centuries. Its stone terraces climb toward enlightenment.", "cloud": "The highest clouds in Earth's atmosphere, glowing electric blue after sunset at polar latitudes. They form at the edge of space, around 80 km up.", "seabird": "A grey-and-white gull look-alike that is really a petrel. It can spit a foul oil at intruders and glides stiff-winged over the North Atlantic.", "deepsea": "A deep-sea fish with a transparent head, its tubular green eyes looking up through a clear dome of jelly. It was barely understood until filmed alive in 2009.", "primate": "A wide-eyed, slow-moving primate that looks like a soft toy and is the only venomous primate. Its toxic bite makes it a gem with teeth.", "particle": "The heaviest lepton, a heavyweight cousin of the electron that decays in less than a trillionth of a second. Physicists name it; almost nobody else does.", "invention": "An ancient handheld model of the sky, used to tell time, find stars and navigate. Astronomers across the medieval Islamic world perfected it.", "font": "Eric Gill's 1928 sans-serif, set in posters, the London and North Eastern Railway and decades of Penguin book covers. It looks British without trying.", "mathsbranch": "The mathematics of tangled loops that cannot be undone without cutting. It began with a failed theory of atoms and now helps explain DNA.", "mathematician": "The mathematician whose theorem links every symmetry in physics to a conservation law. Einstein called her a genius, and it took decades for the world to catch up.", "ship": "The flagship of Franklin's lost 1845 Arctic expedition, which vanished searching for the Northwest Passage. Its wreck was found on the seabed in 2014, almost perfectly preserved.", "villain": "From Cormac McCarthy's Blood Meridian: a huge, hairless, erudite man who dances, fiddles and kills, and claims he will never die. One of the darkest villains in literature.", "detective": "A Welsh monk solving murders in 12th-century Shrewsbury Abbey during a civil war, using herbs, patience and a soldier's past. Ellis Peters created him; Derek Jacobi played him.", "anime": "A wandering doctor treats people afflicted by mushi, primordial spirits of nature. It is quiet, melancholic and visually breathtaking. Few divers reach it.", "kpop": "SM Entertainment's experimental girl group: angular, electronic, years ahead of the trend. Fans still campaign for a comeback.", "band": "A Cologne collective that played hypnotic, endless grooves and invented much of what later became post-rock. They recorded in a castle and were known for marathon improvisations.", "rapper": "Rodney Smith from South London, whose album Run Come Save Me shaped British hip-hop. Deep, dubby and proudly local.", "hindugod": "The river Ganges as a goddess, who fell from heaven onto Shiva's hair so her force would not shatter the Earth. Bathing in her waters is believed to wash away sins.", "romangod": "The god of boundary stones, so stubborn he refused to move even for Jupiter when the Capitol was built. His shrine stayed open to the sky on top of the hill.", "holiday": "Lerwick, Shetland, on the last Tuesday in January: a thousand torchbearers march behind a full-size Viking longship, then set it on fire. The deepest northern festival there is.", "musical": "The demon barber of Fleet Street, his razors and Mrs Lovett's meat pies. Sondheim's darkest masterpiece. Most people never name it first.", "opera": "Berg's atonal opera about a poor soldier driven to madness and murder. A landmark of 20th-century music, and a very deep answer.", "yogapose": "An arm balance where your legs extend forward over your arms like wings, hips lifted off the floor. Hard to do, and even harder to name under pressure.", "combatsport": "Hands of Stone: the Panamanian who fought across five decades, won world titles in four weight classes and beat Sugar Ray Leonard in Montreal in 1980. A boxing deep cut for those who know.", "fabric": "Hand-woven by islanders in the Outer Hebrides of Scotland, from pure virgin wool. It is the only fabric protected by its own Act of Parliament.", "hairstyle": "Hair parted in the centre, falling to either side like stage curtains. It was the haircut of the 1990s boy band and has come back for Gen Z.", "nautical": "A curved timber in a ship's frame, or the shrouds below a mast's top. The most ridiculous-sounding word on the dock, and completely real.", "collective": "The collective noun for larks: an exaltation, because the birds rise singing into the sky. English has more poetic group names, but few as joyful.", "phobiaobj": "The ironic gem: hippopotomonstrosesquippedaliophobia, the fear of long words, which is itself one of the longest words around.", "w_zz": "The low floor tucked between two others, from the Italian 'mezzano', middle. A building's in-between level, and a rare answer.", "w_ology": "The scientific study of caves. Cavers call themselves spelunkers; scientists call themselves speleologists.", "w_aeiou": "Contains all five vowels and leaves no room for doubt. A strong word to pull out under time pressure.", "w_kn": "A cloth or leather bag carried on the back. The silent K survives from an old German word for 'a bite to eat'.", "w_ps": "A medieval stringed instrument plucked like a zither. The silent P belongs to the Greek 'psalterion'.", "w_endx": "A banded gemstone, a variety of chalcedony, from the Greek for fingernail. Short, dark and rarely played.", "w_toprow": "Lasting forever. A long word you can type entirely with the top row of letters.", "w_palin": "One who redivides. A ten-letter palindrome, rarely found under pressure.", "w_ight": "The soft light between day and night. It fits the game's surface at dusk.", "w_esque": "Tall, dignified and beautiful, like a statue. The rarest of the common '-esque' words.", "w_ism": "A form of reasoning: all men are mortal; Socrates is a man; therefore Socrates is mortal. Logic's oldest trick.", "w_qu": "A bog, a swamp, or a situation you cannot climb out of. You avoided it.", "w_j4": "The loose skin under a jaw, as in a bulldog's. A four-letter J word nobody reaches for.", "w_oo": "A bird famous for laying its eggs in other birds' nests. Also a word for slightly mad.", "w_phobia": "The fear of peanut butter sticking to the roof of your mouth. Probably a joke, but real enough to be a gem.", "w_startx": "A fragment of foreign rock trapped inside an igneous rock, a stranger caught in stone. A geologist's X.", "w_ough": "A long, narrow open container for animals to eat or drink from. It is pronounced to rhyme with 'off'.", "w_qnou": "Slang for a tranquilliser, and a word where the Q stands without its U. Rare and allowed.", "w_cide": "The killing of a god, or of a divine being. A heavy, ancient word.", "w_sch": "A sailing ship with two or more masts, rigged fore and aft. Also a large glass for beer. Fittingly nautical.", "w_ful": "Threatening harm, full of menace. An old word with a dark tone.", "w_gn": "The pointer on a sundial whose shadow tells the time. The G is silent and the word is old.", "w_mania": "The Dutch tulip craze of the 1630s, when a single bulb could reportedly sell for more than a house. History's first famous financial bubble."};
const CODEX_CACHE = {};
const found = () => store.get('found', {});
function markFound(pid, res, label){
  if (!res || res.i == null) return false;
  const f = found(), k = res.t + ':' + res.i; f[pid] = f[pid] || {};
  if (f[pid][k]) return false;
  f[pid][k] = {at:Date.now(), d:label || ''}; store.set('found', f); return true;
}
function backfillFound(){
  if (store.get('foundBackfill', 0)) return;
  try{
    const f = found();
    for (let n = 1; n <= todayNum(); n++){ const s = store.get('daily-' + n, null); if (!s) continue;
      for (const r of s.results){ if (!r.t || !BYID[r.pid]) continue; const arr = BYID[r.pid].t[r.t]; const i = arr.findIndex(a => display(a) === r.name); if (i < 0) continue;
        f[r.pid] = f[r.pid] || {}; const k = r.t + ':' + i; if (!f[r.pid][k]) f[r.pid][k] = {at:Date.now(), d:'DAILY #' + n}; } }
    store.set('found', f); store.set('foundBackfill', 1);
  }catch(e){}
}
function diveLabel(){ return S.screen === 'endless' ? 'ENDLESS AIR' : diveTitle(); }
async function codexPack(pack){
  if (CODEX_CACHE[pack]) return CODEX_CACHE[pack];
  try{ const r = await fetch('' + pack + '.json'); if (!r.ok) throw new Error(r.status); const j = await r.json(); const m = {};
    for (const pid in j){ m[pid] = {}; for (const [t, i, txt, src] of j[pid]) m[pid][t + ':' + i] = [txt, src]; }
    return CODEX_CACHE[pack] = m; }catch(e){ return null; }
}
const promptTotal = p => TIER_ORDER.reduce((a, t) => a + p.t[t].length, 0);
function codexTotals(){ const f = found(); let n = 0, g = 0; for (const pid in f) for (const k in f[pid]){ n++; if (k[0] === 'G') g++; } return {n, g, prompts:Object.keys(f).filter(k => Object.keys(f[k]).length).length}; }
let codexFilter = {pack:'', q:''};
function renderCodex(){
  stopTimer(); setHash('codex'); S = {screen:'codex'};
  const f = found(), tot = codexTotals(), all = totalAnswers();
  const pct = tot.n / all * 100;
  const packs = Object.keys(PACKS);
  const rows = DB.filter(p => !codexFilter.pack || p.pack === codexFilter.pack).map(p => ({p, n:Object.keys(f[p.id] || {}).length, tot:promptTotal(p)}))
    .sort((a, b) => (b.n > 0) - (a.n > 0) || b.n / b.tot - a.n / a.tot || a.p.q.localeCompare(b.p.q));
  paint(topbar() + `<main class="wrap codex">
    <span class="eyebrow">ARCHIVE <b>//</b> EVERYTHING YOU HAVE BROUGHT UP</span>
    <div class="cxhead">${icon('codex', 64)}<div><h1>The Codex</h1><p class="dim small caps">A field guide to the world, written one answer at a time. Unfound entries stay sealed.</p></div></div>
    <div class="statgrid cxstats"><div><span class="k">ENTRIES RECOVERED</span><span class="v num">${fmt(tot.n)}</span><span class="s">OF ${fmt(all)}</span></div><div><span class="k">OF THE WORLD</span><span class="v num">${pct < .1 && tot.n ? '<0.1' : pct.toFixed(1)}%</span><span class="s">DOCUMENTED</span></div><div><span class="k">GEMS</span><span class="v num">${tot.g}</span><span class="s">ONE IN A LEAFY SEADRAGON</span></div></div>
    <div class="cxbar"><input id="cxq" class="filter" type="search" placeholder="SEARCH WHAT YOU HAVE FOUND" value="${esc(codexFilter.q)}" autocomplete="off"></div>
    <div class="chips"><button class="chip ${codexFilter.pack ? '' : 'on'}" data-act="cxpack" data-k="">All</button>${packs.map(k => `<button class="chip ${codexFilter.pack === k ? 'on' : ''}" data-act="cxpack" data-k="${k}">${esc(PACKS[k].name)}</button>`).join('')}</div>
    <div id="cxres"></div>
    <div class="list" id="cxlist">${rows.map(({p, n, tot}) => `<button class="litem cxrow ${n ? '' : 'sealed'}" data-act="cxprompt" data-id="${p.id}"><span style="flex:1;min-width:0"><span class="lt">${esc(p.q)}</span><span class="cxprog"><i style="width:${Math.max(n ? 1.5 : 0, n / tot * 100)}%"></i></span></span><span class="lr">${n ? `${n} / ${tot}` : 'SEALED'}<br>${n ? TIER_ORDER.slice().reverse().filter(t => Object.keys(f[p.id] || {}).some(k => k[0] === t)).map(t => `<span class="tier-${t}" style="color:var(--tc)">${TIERS[t].code}</span>`).join(' ') : `${tot} entries`}</span></button>`).join('')}</div>
    <div><button class="btn ghost small" data-act="home">Back</button></div>
  </main>`);
  const q = document.getElementById('cxq'); q.addEventListener('input', () => { codexFilter.q = q.value; codexSearch(); }); codexSearch();
}
function codexSearch(){
  const q = norm(codexFilter.q), out = document.getElementById('cxres'); if (!out) return;
  if (q.length < 2){ out.innerHTML = ''; return; }
  const f = found(), hits = [];
  for (const pid in f){ const p = BYID[pid]; if (!p) continue; for (const k in f[pid]){ const [t, i] = k.split(':'); const a = p.t[t] && p.t[t][+i]; if (a && norm(display(a)).includes(q)) hits.push({pid, t, i:+i, name:display(a)}); if (hits.length > 60) break; } }
  out.innerHTML = hits.length ? `<div class="tiles">${hits.map(h => `<button class="ctile tier-${h.t}" data-act="cxentry" data-id="${h.pid}" data-k="${h.t}:${h.i}">${sig(h.t, 12)}<span>${esc(h.name)}</span><small>${esc(BYID[h.pid].q)}</small></button>`).join('')}</div>` : `<p class="dim small caps">Nothing you have found matches. The answer may still be sealed.</p>`;
}
function renderCodexPrompt(pid){
  const p = BYID[pid]; if (!p) return renderCodex();
  stopTimer(); setHash('codex-' + pid); S = {screen:'codex', pid};
  const f = found()[pid] || {}, n = Object.keys(f).length, tot = promptTotal(p);
  const sec = ['G','D','R','S','T','P'].map(t => {
    const arr = p.t[t], got = arr.map((a, i) => ({a, i})).filter(x => f[t + ':' + x.i]);
    const sealed = arr.length - got.length;
    return `<section class="sec cxsec tier-${t}"><div class="sech"><h3 style="color:var(--tc)">${sig(t, 13)} ${TIERS[t].name}</h3><span>${got.length} / ${arr.length} · ${TIERS[t].pts} PTS</span></div>
      <div class="tiles">${got.map(x => `<button class="ctile tier-${t}" data-act="cxentry" data-id="${pid}" data-k="${t}:${x.i}"><span>${esc(display(x.a))}</span><small>${esc(f[t + ':' + x.i].d || '')}</small></button>`).join('')}${sealed ? `<span class="csealed">${'▮'.repeat(Math.min(12, sealed))} ${fmt(sealed)} still sealed</span>` : ''}</div></section>`;
  }).join('');
  paint(topbar() + `<main class="wrap codex">
    <span class="eyebrow">THE CODEX <b>//</b> ${esc(PACKS[p.pack].name.toUpperCase())}</span>
    <h2 class="prompt" style="font-size:clamp(30px,7vw,44px)">${esc(p.q)}</h2>
    <div class="cxprog big"><i style="width:${n / tot * 100}%"></i></div>
    <span class="eyebrow">${n} OF ${tot} ENTRIES RECOVERED <b>//</b> ${(n / tot * 100).toFixed(1)}%</span>
    ${sec}
    <div class="row"><button class="btn ghost small" data-act="codex">All prompts</button><button class="btn ghost small" data-act="home">Ascend</button></div>
  </main>`);
}
/* the entry: deeper tiers type out slower and longer, like a decrypted file */
async function openEntry(pid, k){
  const p = BYID[pid]; const [t, i] = k.split(':'); const a = p.t[t][+i]; const name = display(a), alts = a.split('|').slice(1, 5);
  const meta = (found()[pid] || {})[k] || {};
  const m = document.createElement('div'); m.className = 'modal';
  const curated = t === 'G' && +i === 0 && CODEX_NOTES[pid];
  m.innerHTML = `<div class="panel cxentry tier-${t} ${t === 'G' ? 'red' : ''}" role="dialog" aria-modal="true">
    <span class="eyebrow">CODEX ENTRY <b>//</b> ${esc(p.q)}</span>
    <div class="cxe-head">${sig(t, 70)}<div><span class="cxe-tier" style="color:var(--tc)">${TIERS[t].name} · ${TIERS[t].pts} PTS</span><h1 class="cxe-name">${esc(name)}</h1>${alts.length ? `<span class="dim small caps">Also accepted: ${esc(alts.join(' · '))}</span>` : ''}</div></div>
    <span class="eyebrow">FIRST RECOVERED <b>//</b> ${esc(meta.d || '—')}${meta.at ? ' · ' + new Date(meta.at).toLocaleDateString('en-GB', {day:'2-digit', month:'short', year:'numeric'}).toUpperCase() : ''}</span>
    <div class="cxe-body" id="cxebody"><span class="dim small caps">Decrypting entry<span class="ldots"><span></span><span></span><span></span></span></span></div>
    ${curated ? `<div class="cxnote"><span class="eyebrow"><b>FIELD NOTE</b> // HAND-WRITTEN</span><p id="cxnote"></p></div>` : ''}
    <div class="cxe-src" id="cxesrc"></div>
    <div class="row"><button class="btn" data-act="closeModal">Close</button></div></div>`;
  m.addEventListener('click', e => { if (e.target === m) m.remove(); });
  document.body.appendChild(m); sfx.sonar();
  const data = await codexPack(p.pack), ent = data && data[pid] && data[pid][k];
  const body = m.querySelector('#cxebody'), src = m.querySelector('#cxesrc');
  if (!body) return;
  if (!data){ body.textContent = 'The archive could not be reached. Check your connection and open this entry again.'; body.classList.add('dim'); if (curated) await typeOut(m.querySelector('#cxnote'), CODEX_NOTES[pid], 6, m); return; }
  const text = ent ? ent[0] : `No archive record has surfaced for this one yet. ${TIERS[t].desc} The water keeps some things to itself.`;
  const speed = {P:9, T:9, S:7, R:6, D:5, G:4}[t];
  if (!ent && curated) body.remove(); else await typeOut(body, text, speed, m);
  if (curated){ await typeOut(m.querySelector('#cxnote'), CODEX_NOTES[pid], 6, m); }
  if (ent && ent[1] !== undefined){
    if (ent[1]){ const simple = ent[1].startsWith('s:'), title = simple ? ent[1].slice(2) : ent[1], host = simple ? 'simple.wikipedia.org' : 'en.wikipedia.org';
      src.innerHTML = `SOURCE // <a href="https://${host}/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}" target="_blank" rel="noopener">${esc(title)}</a> · ${simple ? 'Simple English ' : ''}Wikipedia · CC BY-SA 4.0`; }
    else src.textContent = 'SOURCE // Open English WordNet';
  }
}
function typeOut(el, text, msPerChar, modalEl){
  return new Promise(res => {
    if (!el) return res();
    if (calm()){ el.textContent = text; return res(); }
    el.textContent = ''; let i = 0, last = 0; const cur = document.createElement('span'); cur.className = 'cursor'; el.appendChild(cur);
    const step = now => {
      if (!document.body.contains(modalEl)) return res();
      const n = Math.min(text.length, i + Math.max(1, Math.round((now - (last || now)) / msPerChar) || 1)); last = now;
      if (n !== i){ cur.before(text.slice(i, n)); i = n; if (Math.random() < .25) sfx.type(); }
      if (i < text.length) requestAnimationFrame(step); else { cur.remove(); res(); }
    };
    requestAnimationFrame(step);
    modalEl.addEventListener('click', e => { if (e.target.closest('.cxe-body,.cxnote') && i < text.length){ cur.before(text.slice(i)); i = text.length; } });
  });
}

/* ============================== save codes ==============================
   Progress lives in this browser. A save code is the whole save, compressed, with a
   checksum, so players can back up or move to another device without an account.
   Anything loaded from a code is rebuilt field by field: unknown keys, unknown prompts,
   bad tiers and oversized strings are dropped, so a tampered code cannot break the game. */
const BUILD = '2026-11-08-e18dd75360';
const CONTACT = '';
const SAVE_KEYS = k => /^(settings|stats|unl|sky|found|foundBackfill|tipShown|daily-\d{1,5}|pack-[a-z]{1,20})$/.test(k);
const TIERSET = new Set([...TIER_ORDER, 'X']);
const isNum = v => typeof v === 'number' && isFinite(v);
const int = (v, lo, hi, d) => isNum(v) ? clamp(Math.round(v), lo, hi) : d;
const str = (v, n) => typeof v === 'string' ? v.slice(0, n || 120) : null;
const strs = (a, n, m) => Array.isArray(a) ? a.slice(0, n).map(x => str(x, m)).filter(x => x != null) : [];
function cleanResult(r){
  if (!r || typeof r !== 'object' || !BYID[r.pid]) return null;
  const t = TIER_ORDER.includes(r.t) ? r.t : null;
  return {pid:r.pid, t, name: t ? str(r.name) : null, input:str(r.input) || '', misses:strs(r.misses, 30), why: t ? undefined : (str(r.why, 12) || 'pass'),
    ms:int(r.ms, 0, 600000, 0), renamed:!!r.renamed, fuzzy:!!r.fuzzy, how:str(r.how, 20) || undefined, isNew:!!r.isNew || undefined};
}
const CLEAN = {
  settings: v => { const o = {}; for (const k of ['sound','music','calm','relaxed']) if (typeof v[k] === 'boolean') o[k] = v[k]; return o; },
  stats: v => ({
    games: (Array.isArray(v.games) ? v.games.slice(-400) : []).filter(g => g && typeof g === 'object').map(g => ({mode:['daily','unlimited','pack'].includes(g.mode) ? g.mode : 'unlimited', num:int(g.num, 1, 1e6, 1), pack:PACKS[g.pack] ? g.pack : null, pts:int(g.pts, 0, 700, 0), tiers:strs(g.tiers, 7, 1).filter(t => TIERSET.has(t)), at:int(g.at, 0, 4e12, 0)})),
    tiers: Object.fromEntries([...TIERSET].map(t => [t, int(v.tiers && v.tiers[t], 0, 1e7, 0)])),
    gems: (Array.isArray(v.gems) ? v.gems.slice(-500) : []).filter(g => g && typeof g === 'object').map(g => ({q:str(g.q, 160) || '', a:str(g.a) || ''})),
    endlessBest:int(v.endlessBest, 0, 1e6, 0), endlessRuns:int(v.endlessRuns, 0, 1e7, 0), streak:int(v.streak, 0, 1e5, 0), lastDaily:int(v.lastDaily, 0, 1e5, 0), bestStreak:int(v.bestStreak, 0, 1e5, 0)}),
  unl: v => ({next:int(v.next, 1, 1e6, 1)}),
  pack: v => ({next:int(v.next, 1, 1e6, 1)}),
  sky: v => int(v, 0, 99, 0),
  foundBackfill: v => v ? 1 : 0,
  tipShown: v => v ? 1 : 0,
  found: v => { const o = {}; for (const pid in v){ if (!BYID[pid] || !v[pid] || typeof v[pid] !== 'object') continue; const e = {};
      for (const k in v[pid]){ const m = /^([PTSRDG]):(\d{1,5})$/.exec(k); if (!m || !BYID[pid].t[m[1]] || +m[2] >= BYID[pid].t[m[1]].length) continue;
        const x = v[pid][k] || {}; e[k] = {at:int(x.at, 0, 4e12, 0), d:str(x.d, 40) || ''}; }
      if (Object.keys(e).length) o[pid] = e; } return o; },
  daily: v => { const pids = strs(v.pids, 7, 40).filter(id => BYID[id]); if (pids.length !== 7) return null;
    const results = (Array.isArray(v.results) ? v.results.slice(0, 7) : []).map(cleanResult);
    if (results.some(r => !r)) return null; return {pids, results, done: results.length >= 7}; }
};
function cleanKey(k, v){
  if (!SAVE_KEYS(k) || v == null) return undefined;
  if (k.startsWith('daily-')){ const n = +k.slice(6); if (n < 1 || n > todayNum() + 1 || typeof v !== 'object') return undefined; return CLEAN.daily(v) || undefined; }
  if (k.startsWith('pack-')) return PACKS[k.slice(5)] && typeof v === 'object' ? CLEAN.pack(v) : undefined;
  if (k === 'sky' || k === 'foundBackfill' || k === 'tipShown') return CLEAN[k](v);
  return typeof v === 'object' && !Array.isArray(v) ? CLEAN[k](v) : undefined;
}
function snapshot(){ const keys = {}; for (const k of store.keys()) if (SAVE_KEYS(k)){ const v = store.get(k, null); if (v != null) keys[k] = v; } return {app:'olsd', v:1, at:Date.now(), keys}; }
/* checksum: FNV-1a over the JSON text */
const fnv = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
const b64u = bytes => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64u = s => { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; const b = atob(s), out = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i); return out; };
async function pipe(bytes, Stream, mode){ const r = new Response(new Blob([bytes]).stream().pipeThrough(new Stream(mode))); return new Uint8Array(await r.arrayBuffer()); }
async function makeCode(){
  const json = JSON.stringify(snapshot()), bytes = new TextEncoder().encode(json);
  if (typeof CompressionStream === 'function'){ try{ return 'OLSD1.' + b64u(await pipe(bytes, CompressionStream, 'gzip')) + '.' + fnv(json); }catch(e){} }
  return 'OLSD0.' + b64u(bytes) + '.' + fnv(json);
}
async function readCode(code){
  const m = /^OLSD([01])\.([A-Za-z0-9_-]+)\.([0-9a-z]+)$/.exec(String(code || '').replace(/\s+/g, ''));
  if (!m) throw new Error('That does not look like a save code. It should start with OLSD.');
  let bytes = unb64u(m[2]);
  if (bytes.length > 4e6) throw new Error('That save code is too large.');
  if (m[1] === '1'){ if (typeof DecompressionStream !== 'function') throw new Error('This browser is too old to open that save code.'); bytes = await pipe(bytes, DecompressionStream, 'gzip'); }
  const json = new TextDecoder().decode(bytes);
  if (fnv(json) !== m[3]) throw new Error('The save code is damaged or incomplete. Copy the whole thing and try again.');
  const data = JSON.parse(json);
  if (!data || data.app !== 'olsd' || typeof data.keys !== 'object') throw new Error('That save code is not from this game.');
  const keys = {}; let dropped = 0;
  for (const k in data.keys){ const v = cleanKey(k, data.keys[k]); if (v === undefined) dropped++; else keys[k] = v; }
  return {keys, dropped, at:int(data.at, 0, 4e12, 0)};
}
function applySave(keys){
  for (const k of store.keys()) if (SAVE_KEYS(k)) store.del(k);
  for (const k in keys) store.set(k, keys[k]);
  settings = Object.assign({sound:true, music:true, calm:false, relaxed:false}, store.get('settings', {})); saveSettings(); if (typeof syncSky === 'function') syncSky(1200);
}
/* run once at boot: repair anything already in this browser the same way */
function repairSave(){
  try{ for (const k of store.keys()){ if (!SAVE_KEYS(k)) continue; const raw = store.get(k, null); if (raw == null) continue; const v = cleanKey(k, raw);
      if (v === undefined) store.del(k); else if (JSON.stringify(v) !== JSON.stringify(raw)) store.set(k, v); } }catch(e){}
}
function afterDive(){
  try{ if (navigator.storage && navigator.storage.persist && !/Firefox/.test(navigator.userAgent)) navigator.storage.persist().catch(() => {}); }catch(e){}
  const done = stats().games.length + stats().endlessRuns;
  if (done >= 3 && !store.get('tipShown', 0)){ store.set('tipShown', 1); setTimeout(() => toast('Tip: back up your progress with a save code in Settings'), 4000); }
}
function saveSectionHTML(){
  const backup = store.raw('__backup');
  return `<h3 style="margin-top:22px">Your save</h3>
  ${STORAGE_OK ? `<p class="dim small">Progress saves automatically in this browser. No account needed. Clearing your browsing data, private windows and some phones (Safari, after a week away) can erase it, so keep a save code if it matters to you.</p>`
    : `<p class="small" style="color:var(--blood-hi)">This browser is blocking storage (private window or strict settings). Progress will be lost when you close the tab. Copy a save code before you leave.</p>`}
  <div class="savebtns">
    <button class="btn small" data-act="saveCopy">Copy save code</button>
    <button class="btn ghost small" data-act="saveDownload">Download save file</button>
    <button class="btn ghost small" data-act="saveLoad">Load a save</button>
    ${backup ? `<button class="btn ghost small" data-act="saveUndo">Undo last load</button>` : ''}
    <button class="btn ghost small danger" data-act="saveErase">Erase all progress</button>
  </div>`;
}
function loadModal(){
  document.querySelectorAll('.modal').forEach(m => m.remove());
  modal(`<span class="eyebrow">SAVE // LOAD</span><h2>Load a save</h2>
  <p class="dim small">Paste a save code, or pick a save file. This replaces the progress in this browser. Your current progress is kept as a backup until the next load.</p>
  <textarea id="saveIn" rows="5" spellcheck="false" autocomplete="off" placeholder="OLSD1.…" style="width:100%;background:rgba(0,0,0,.4);color:var(--bone);border:1px solid var(--line, #2a3a40);font:12px var(--mono);padding:10px;resize:vertical"></textarea>
  <div class="row wrap" style="gap:8px;justify-content:flex-start;margin-top:8px">
    <button class="btn small" data-act="saveApply">Load this save</button>
    <label class="btn ghost small" style="cursor:pointer">Choose file<input type="file" id="saveFile" accept=".txt,text/plain" hidden></label>
  </div><p id="saveMsg" class="small" aria-live="polite"></p>`);
  document.getElementById('saveFile').onchange = async e => { const f = e.target.files[0]; if (!f) return; if (f.size > 6e6) return saveMsg('That file is too large.', true); document.getElementById('saveIn').value = (await f.text()).trim(); saveMsg('File read. Press “Load this save”.'); };
}
function saveMsg(t, bad){ const el = document.getElementById('saveMsg'); if (el){ el.textContent = t; el.style.color = bad ? 'var(--blood-hi)' : 'var(--bone)'; } }
async function saveAction(a, el){
  try{
    if (a === 'saveCopy') return copy(await makeCode());
    if (a === 'saveDownload'){ const code = await makeCode(), u = URL.createObjectURL(new Blob([code + '\n'], {type:'text/plain'})); const l = document.createElement('a');
      l.href = u; l.download = 'oneinaleafysedragon-save-' + new Date().toISOString().slice(0, 10) + '.txt'; document.body.appendChild(l); l.click(); l.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); return toast('Save file downloaded'); }
    if (a === 'saveLoad') return loadModal();
    if (a === 'saveApply'){ const res = await readCode(document.getElementById('saveIn').value);
      const n = Object.keys(res.keys).length; if (!n) return saveMsg('That save code is empty.', true);
      const cur = await makeCode(); store.set('__backup', cur);
      applySave(res.keys); document.querySelectorAll('.modal').forEach(m => m.remove());
      toast('Save loaded' + (res.dropped ? ` (${res.dropped} broken item${res.dropped > 1 ? 's' : ''} skipped)` : '')); return renderHome(); }
    if (a === 'saveUndo'){ const prev = store.get('__backup', null); if (!prev) return; const res = await readCode(prev); applySave(res.keys); store.del('__backup');
      document.querySelectorAll('.modal').forEach(m => m.remove()); toast('Previous progress restored'); return renderHome(); }
    if (a === 'saveErase'){ if (!el.dataset.sure){ el.dataset.sure = '1'; el.textContent = 'Tap again to erase everything'; return; }
      store.set('__backup', await makeCode()); applySave({}); document.querySelectorAll('.modal').forEach(m => m.remove()); toast('Progress erased. “Undo last load” in Settings brings it back.'); return renderHome(); }
  }catch(e){ if (document.getElementById('saveMsg')) saveMsg(e.message || 'Could not read that save.', true); else toast(e.message || 'Something went wrong with the save'); }
}

/* ============================== crash screen ==============================
   If something breaks, say so plainly, keep the save, and give a way to report it. */
let crashShown = false;
function crash(msg, stack){
  if (crashShown) return; crashShown = true;
  const details = `oneinaleafysedragon ${BUILD}\n${new Date().toISOString()}\n${location.href}\n${navigator.userAgent}\n${msg}\n${(stack || '').slice(0, 1500)}`;
  const d = document.createElement('div'); d.className = 'crashbar'; d.setAttribute('role', 'alert');
  d.innerHTML = `<b>Something went wrong.</b> <span>Your progress is saved. Reloading usually fixes it.</span>
    <span class="row wrap" style="gap:8px"><button class="btn small" id="crReload">Reload</button><button class="btn ghost small" id="crCopy">Copy error details</button>
    ${CONTACT ? `<a class="btn ghost small" href="mailto:${esc(CONTACT)}?subject=${encodeURIComponent('Bug report ' + BUILD)}&body=${encodeURIComponent(details)}">Report it</a>` : ''}
    <button class="btn ghost small" id="crClose" aria-label="Dismiss">✕</button></span>`;
  document.body.appendChild(d);
  d.querySelector('#crReload').onclick = () => location.reload();
  d.querySelector('#crCopy').onclick = () => copy(details);
  d.querySelector('#crClose').onclick = () => { d.remove(); busy = false; };
}
addEventListener('error', e => { if (e.filename && !e.filename.startsWith(location.origin)) return; if (!e.message) return; crash(e.message, e.error && e.error.stack); });
addEventListener('unhandledrejection', e => { const r = e.reason || {}; crash(String(r.message || r), r.stack); });

/* ============================== stats ============================== */
function stats(){ return Object.assign({games:[], tiers:{P:0,T:0,S:0,R:0,D:0,G:0,X:0}, gems:[], endlessBest:0, endlessRuns:0, streak:0, lastDaily:0, bestStreak:0}, store.get('stats', {})); }
const ptsOf = rs => rs.reduce((a, r) => a + (r.t ? TIERS[r.t].pts : 0), 0);
function recordGame(dive){
  const st = stats(), pts = ptsOf(dive.results);
  st.games.push({mode:dive.mode, num:dive.num, pack:dive.pack || null, pts, tiers:dive.results.map(r => r.t || 'X'), at:Date.now()});
  if (st.games.length > 400) st.games = st.games.slice(-400);
  for (const r of dive.results){ st.tiers[r.t || 'X']++; if (r.t === 'G' && BYID[r.pid]) st.gems.push({q:BYID[r.pid].q, a:r.name}); }
  if (st.gems.length > 500) st.gems = st.gems.slice(-500);
  if (dive.mode === 'daily'){ if (st.lastDaily === dive.num - 1) st.streak++; else if (st.lastDaily !== dive.num) st.streak = 1; st.lastDaily = dive.num; st.bestStreak = Math.max(st.bestStreak, st.streak); }
  store.set('stats', st); afterDive();
}
function recordEndless(run){
  const st = stats(); st.endlessRuns++; st.endlessBest = Math.max(st.endlessBest, ptsOf(run.results));
  for (const r of run.results){ st.tiers[r.t || 'X']++; if (r.t === 'G' && BYID[r.pid]) st.gems.push({q:BYID[r.pid].q, a:r.name}); }
  if (st.gems.length > 500) st.gems = st.gems.slice(-500);
  store.set('stats', st); afterDive();
}

/* ============================== screens & motion ============================== */
const app = document.getElementById('app');
let S = {screen:'home'};
let timerRAF = null, busy = false, skipFn = null;
function stopTimer(){ if (timerRAF) cancelAnimationFrame(timerRAF); timerRAF = null; }
function toast(msg){ const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 2400); }
function topbar(){ return `<header class="top"><button class="brand" data-act="home" aria-label="Back to the surface">OLSD <i>//</i> <b>ONE IN A LEAFY SEDRAGON</b></button><div class="row"><button class="iconbtn" data-act="help" aria-label="How to play">${icon('help', 22)}</button><button class="iconbtn" data-act="settings" aria-label="Settings">${icon('settings', 22)}</button></div></header>`; }
function setHash(h){ try{ if (location.hash !== '#' + h) history.replaceState(null, '', h ? '#' + h : location.pathname + location.search); }catch(e){} }
let revealObs = null;
function paint(html, cls){
  app.innerHTML = html; const m = app.querySelector('main'); if (m && !calm()) m.classList.add(cls || 'enter'); window.scrollTo(0, 0);
  if (revealObs) revealObs.disconnect();
  const els = app.querySelectorAll('.reveal');
  if (!els.length) return;
  if (calm() || !('IntersectionObserver' in window)){ els.forEach(e => { e.classList.add('in'); e.dispatchEvent(new Event('shown')); }); return; }
  revealObs = new IntersectionObserver(ents => ents.forEach(en => { if (en.isIntersecting){ en.target.classList.add('in'); en.target.dispatchEvent(new Event('shown')); revealObs.unobserve(en.target); } }), {threshold:.18});
  els.forEach(e => revealObs.observe(e));
}
async function leave(dir, dur){
  const m = app.querySelector('main'); if (!m || calm()) return;
  m.style.transition = `transform ${dur}ms cubic-bezier(.55,0,.6,1), opacity ${dur}ms ease-in, filter ${dur}ms ease-in`;
  m.style.transform = dir === 'up' ? 'translateY(-80vh)' : dir === 'down' ? 'translateY(85vh)' : 'translateY(-24px)';
  m.style.opacity = '0'; m.style.filter = 'blur(8px)';
  await sleep(dir === 'fade' ? dur : Math.min(dur, 1400));
}
/* a skippable pause: tap, Enter or Space ends it early */
function hold(ms, el){
  return new Promise(res => {
    let done = false; const fin = () => { if (done) return; done = true; clearTimeout(tm); skipFn = null; if (el) el.removeEventListener('click', fin); res(); };
    const tm = setTimeout(fin, calm() ? Math.min(ms, 700) : ms); skipFn = fin; if (el) el.addEventListener('click', fin);
  });
}
/* ---------- HUD overlay loader ---------- */
function hudRun(o){
  const host = document.getElementById('hud');
  const dots = '<span class="ldots"><span></span><span></span><span></span></span>';
  host.innerHTML = `<div class="hudbox"><span class="eyebrow">${o.kicker || ''}</span><div class="ht">${o.title}${dots}</div>${o.value != null ? `<div class="hv" id="hudv">0<small>${o.unit || ''}</small></div>` : ''}<div class="bar"><i id="hudbar"></i></div><div class="hl" id="hudl"></div></div>`;
  const dur = calm() ? 350 : o.dur, t0 = performance.now(), bar = document.getElementById('hudbar'), hv = document.getElementById('hudv'), hl = document.getElementById('hudl');
  let lastType = 0, shown = 0;
  return new Promise(res => {
    const step = now => {
      const p = Math.min(1, (now - t0) / dur), e = easeIO(p);
      if (bar) bar.style.width = (e * 100) + '%';
      if (hv){ const v = o.from + (o.to - o.from) * e; hv.firstChild.textContent = o.fmt ? o.fmt(v) : fmt(v); }
      const lines = o.lines.filter(l => l[0] <= p);
      if (lines.length !== shown){ shown = lines.length; hl.innerHTML = lines.slice(-6).map(l => typeof l[1] === 'function' ? l[1]() : l[1]).join('\n'); sfx.type(); }
      if (o.scramble && now - lastType > 90){ lastType = now; const sp = hl.querySelector('.scr'); if (sp) sp.textContent = scramble(18); }
      if (p < 1) requestAnimationFrame(step); else { const b = host.firstElementChild; if (b) b.classList.add('out'); setTimeout(() => { host.innerHTML = ''; }, calm() ? 0 : 650); res(); }
    };
    requestAnimationFrame(step);
  });
}
const HEX = '0123456789ABCDEF';
function scramble(n){ let s = ''; for (let i = 0; i < n; i++){ s += HEX[Math.random() * 16 | 0]; if (i % 4 === 3 && i < n - 1) s += ' '; } return s; }
async function descendTo(fn){
  if (busy) return; busy = true;
  const D = calm() ? 400 : 4600;
  sfx.descend(D); buzz([30, 60, 30]); shake(4, D);
  leave('up', 1400);
  await Promise.all([
    tween({s:world.s < 1 ? 1.45 : world.s + .9, dark:world.dark}, D, easeIO),
    hudRun({kicker:'DIVE SYSTEM // ENGAGED', title:'DESCENDING', value:true, unit:'% LOCK', from:0, to:100, dur:D - 300,
      lines:[[0, '> HATCH ................ <b>SEALED</b>'], [.16, '> BALLAST .............. <b>FLOODING</b>'], [.34, '> TRIM ................. <b>NOSE DOWN</b>'], [.52, '> SURFACE LIGHT ........ <em>LOST</em>'], [.7, '> SONAR ................ <b>CONTACT</b>'], [.88, '> SIGNAL ............... <b>ACQUIRED</b>']]})
  ]);
  busy = false; fn();
}
async function ascendTo(fn){
  if (busy) return; busy = true;
  stopTimer();
  const m0 = world.dark * MAX_M, D = calm() ? 400 : 4200 + clamp(m0 / MAX_M, 0, 1) * 2600;
  sfx.ascend(D); leave('down', 1300); syncSky(D * 1.6);
  await Promise.all([
    tween({s:0, dark:0}, D, easeIO),
    hudRun({kicker:'DIVE SYSTEM // RECALL', title:'ASCENDING', value:true, unit:'M', from:m0, to:0, dur:D - 300,
      lines:[[0, '> BALLAST .............. <b>BLOWING</b>'], [.25, '> DECOMPRESSION STOP ... <b>1 / 3</b>'], [.5, '> DECOMPRESSION STOP ... <b>2 / 3</b>'], [.72, '> DECOMPRESSION STOP ... <b>3 / 3</b>'], [.9, '> SURFACE .............. <b>BREACHED</b>']]})
  ]);
  busy = false; fn('enter-down');
}
async function slide(fn){ if (busy) return; sfx.click(); await leave('fade', 540); fn(); }

/* ---------- home ---------- */
function totalAnswers(){ return DB.reduce((a, p) => a + TIER_ORDER.reduce((b, t) => b + p.t[t].length, 0), 0); }
function renderHome(cls){
  stopTimer(); setHash(''); S = {screen:'home'};
  const n = todayNum();
  const daily = store.get('daily-' + n, null), dailyDone = daily && daily.done;
  const unl = store.get('unl', {next:1});
  const st = stats();
  const target = dailyDone ? {act:'startUnl', sub:`UNLIMITED // GAME #${unl.next}`, hint:'Today’s daily dive is logged. The water is still open.'} : {act:'startDaily', sub:`DAILY DESCENT #${n} // ${dateOf(n)}`, hint: daily ? 'Resume where you left off' : 'Seven signals · 25 seconds each · same water for everyone'};
  paint(topbar() + `<main class="wrap">
    <section class="hero">
      <span class="eyebrow">SURFACE <b>//</b> ${skyNow().label} · ${skyNow().clock} <b>//</b> ${DB.length} PROMPTS · ${fmt(totalAnswers())} ANSWERS</span>
      <div class="wordmark flicker">ONEINA<span class="ld">LEAFY</span>SEDRAGON</div>
      ${seadragonSVG({cls:'mascot', id:'hero', leaves:Math.min(15, 9 + Math.floor(st.gems.length / 2))})}
      <p class="tag">Obvious answers keep you shallow. Rare ones drag you down. How deep can you go?</p>
    </section>
    <button class="descend" data-act="${target.act}"><span class="sub">${esc(target.sub)}</span><span class="word" aria-label="Descend">${[...'DESCEND'].map(ch => `<span>${ch}</span>`).join('')}</span><span class="hint">${esc(target.hint)}</span></button>
    <div class="modes">
      ${dailyDone ? `<button class="mode" data-act="startDaily"><span class="mk">M-01</span><span class="mi">${icon('daily', 40)}</span><span class="eyebrow">DAILY #${n}</span><span class="mt">Dive Log</span><span class="md">${fmt(ptsOf(daily.results) * M_PER_PT)} m today</span></button>` : `<button class="mode" data-act="startUnl"><span class="mk">M-01</span><span class="mi">${icon('unlimited', 40)}</span><span class="eyebrow">GAME #${unl.next}</span><span class="mt">Unlimited</span><span class="md">Numbered dives. Forever.</span></button>`}
      <button class="mode" data-act="startEndless"><span class="mk">M-02</span><span class="mi">${icon('endless', 40)}</span><span class="eyebrow">${st.endlessBest ? 'BEST ' + fmt(st.endlessBest * M_PER_PT) + ' M' : 'ONE TANK'}</span><span class="mt">Endless Air</span><span class="md">Rare answers refill your air</span></button>
      <button class="mode" data-act="packs"><span class="mk">M-03</span><span class="mi">${icon('packs', 40)}</span><span class="eyebrow">${Object.keys(PACKS).length} PACKS</span><span class="mt">Themed</span><span class="md">One subject per dive</span></button>
      <button class="mode" data-act="archive"><span class="mk">M-04</span><span class="mi">${icon('archive', 40)}</span><span class="eyebrow">${n} DIVES</span><span class="mt">Archive</span><span class="md">Every past daily dive</span></button>
    </div>
    <button class="mode cxmode" data-act="codex"><span class="mk">M-05</span><span class="mi">${icon('codex', 44)}</span><span><span class="eyebrow">${fmt(codexTotals().n)} / ${fmt(totalAnswers())} RECOVERED</span><br><span class="mt">The Codex</span><br><span class="md">Every answer you have found, explained</span></span></button>
    <div class="links"><button class="btn ghost small" data-act="stats">My Seadragon</button><button class="btn ghost small" data-act="help">How to play</button><button class="btn ghost small" data-act="faq">FAQ</button></div>
    ${STORAGE_OK ? '' : `<p class="small" style="color:var(--blood-hi);text-align:center">This browser is blocking storage, so progress will not be kept. <button class="btn ghost small" data-act="settings">Save options</button></p>`}
    <footer class="sitefoot"><a href="about.html">About &amp; credits</a><span>·</span><a href="privacy.html">Privacy</a><span>·</span><a href="terms.html">Terms</a></footer>
  </main>`, cls);
}

/* ---------- classic dive ---------- */
function startDive(mode, num, pack, instant){
  const key = mode === 'daily' ? 'daily-' + num : null;
  const saved = key ? store.get(key, null) : null;
  const pids = promptsFor(mode, num, pack);
  const go = () => {
    S = {screen:'dive', mode, num, pack, pids, idx:0, results:[], phase:'ready'};
    if (saved && saved.pids && saved.pids.join() === pids.join()){
      S.results = saved.results; S.idx = saved.results.length;
      if (saved.done || S.idx >= 7){ S.phase = 'done'; world.dark = curDepth() / MAX_M; return renderResults(); }
    }
    world.dark = curDepth() / MAX_M;
    setHash(mode === 'daily' ? (num === todayNum() ? 'daily' : 'archive-' + num) : mode === 'unlimited' ? 'game-' + num : 'pack-' + pack + '-' + num);
    beginRound();
  };
  if (instant) return go();
  if (saved && saved.done) return slide(go);
  descendTo(go);
}
function diveTitle(){
  if (S.mode === 'daily') return `DAILY #${S.num}`;
  if (S.mode === 'unlimited') return `UNLIMITED #${S.num}`;
  return `${PACKS[S.pack].name.toUpperCase()} #${S.num}`;
}
function curDepth(){ return ptsOf(S.results) * M_PER_PT; }
function dotsHTML(popIdx){
  let h = '';
  for (let i = 0; i < 7; i++){ const r = S.results[i]; h += `<span class="dot ${r ? 'tier-' + (r.t || 'X') : ''} ${i === S.idx && S.phase === 'answering' ? 'cur' : ''} ${i === popIdx ? 'dpop' : ''}" title="Signal ${i + 1}" style="${r ? 'color:var(--tc);border-color:var(--tc)' : ''}">${r ? (r.t ? TIERS[r.t].code : '··') : String(i + 1).padStart(2, '0')}</span>`; }
  return h;
}
function persist(){ if (S.mode === 'daily') store.set('daily-' + S.num, {pids:S.pids, results:S.results, done:S.results.length >= 7}); }
function inputBlock(){ return `<form class="answerrow" id="af" autocomplete="off"><input class="answer" id="ans" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="TYPE AN ANSWER" aria-label="Your answer" enterkeyhint="go"><button class="btn" type="submit">Go</button></form><div class="flash" id="flash" aria-live="polite"></div><div class="misses" id="misses"></div>`; }
function beginRound(){
  const p = BYID[S.pids[S.idx]];
  S.phase = 'answering'; S.misses = []; S.deadline = performance.now() + ROUND_MS; S.lastTick = 99; S.t0 = performance.now();
  const z = zoneOf(curDepth());
  paint(topbar() + `<main class="wrap">
    <div class="divebar"><div class="dots">${dotsHTML()}</div><span class="depthpill" id="dp">${fmt(curDepth())} M</span></div>
    <section class="panel" id="card" style="display:flex;flex-direction:column;gap:18px">
      <span class="eyebrow">${esc(diveTitle())} <b>//</b> SIGNAL ${String(S.idx + 1).padStart(2, '0')} / 07 <b>//</b> ZONE ${String(z.n).padStart(2, '0')}</span>
      <div class="prompt">${esc(p.q)}</div>
      ${settings.relaxed ? '' : `<div class="row" style="gap:12px;flex-wrap:nowrap;position:relative"><div class="timerwrap" style="flex:1"><div class="timerfill" id="tf" style="width:100%"></div></div><span class="timetext" id="tt">25.0</span></div>`}
      ${inputBlock()}
      <div class="row spread"><span class="dim small caps">Wrong costs ${WRONG_MS / 1000} sec · typos forgiven</span><button class="btn ghost small" data-act="pass">Give up</button></div>
    </section></main>`);
  const inp = document.getElementById('ans'); setTimeout(() => inp.focus(), 60);
  document.getElementById('af').addEventListener('submit', e => { e.preventDefault(); submit(inp.value); });
  if (!settings.relaxed) tickClassic();
}
function tickClassic(){
  const loop = () => {
    if (S.screen !== 'dive' || S.phase !== 'answering') return;
    const left = Math.max(0, S.deadline - performance.now());
    const tf = document.getElementById('tf'), tt = document.getElementById('tt');
    if (tf){ tf.style.width = (left / ROUND_MS * 100) + '%'; tf.classList.toggle('low', left < 5000); }
    if (tt){ tt.textContent = (left / 1000).toFixed(1); tt.classList.toggle('low', left < 5000); }
    const sec = Math.ceil(left / 1000); if (sec <= 5 && sec !== S.lastTick && sec > 0){ S.lastTick = sec; sfx.tick(); if (sec <= 3) shake(3, 160); }
    if (left <= 0) return endRound(null, '', 'timeout');
    timerRAF = requestAnimationFrame(loop);
  };
  stopTimer(); timerRAF = requestAnimationFrame(loop);
}
function missFeedback(val, airCost){
  const inp = document.getElementById('ans'), flash = document.getElementById('flash');
  if (S.misses.some(m => norm(m) === norm(val))){ flash.textContent = 'Already tried that one.'; }
  else {
    S.misses.push(val);
    flash.textContent = `“${val}” // not on the list`;
    const tt = document.getElementById('tt') || document.getElementById('at');
    if (tt && (!settings.relaxed || airCost)){ const pen = document.createElement('span'); pen.className = 'penalty'; pen.textContent = `−${(airCost || WRONG_MS) / 1000}s`; tt.parentElement.appendChild(pen); setTimeout(() => pen.remove(), 1200); }
    document.getElementById('misses').innerHTML = S.misses.map(m => `<span class="miss">${esc(m)}</span>`).join('');
  }
  sfx.wrong(); shake(5, 220); buzz(40);
  inp.classList.remove('shake'); void inp.offsetWidth; inp.classList.add('shake');
  inp.value = ''; inp.focus();
}
function submit(val){
  val = val.trim(); if (!val || S.phase !== 'answering') return;
  const res = judge(BYID[S.pids[S.idx]], val);
  if (res) return endRound(res, val);
  if (!S.misses.some(m => norm(m) === norm(val)) && !settings.relaxed) S.deadline -= WRONG_MS;
  missFeedback(val);
}
async function hurtFx(){
  sfx.hurt(); buzz([120, 60, 220]); shake(26, 900);
  const h = document.getElementById('hurt'); h.classList.remove('on'); void h.offsetWidth; h.classList.add('on');
  await sleep(calm() ? 0 : 750);
}
function popupHTML(r, extra, idx){
  const k = `SIGNAL ${String((idx || 0) + 1).padStart(2, '0')} // ${r.t ? 'CLASSIFIED' : 'LOST'}`;
  if (!r.t) return `<div class="pop tier-X"><span class="pk">${k}</span>${sig(null, 70)}<span class="pn">${r.why === 'timeout' ? 'Time’s up' : r.why === 'air' ? 'Out of air' : 'No signal'}</span><span class="pp">+0 PTS · +0 M</span><span class="skip">Tap to continue</span></div>`;
  const T = TIERS[r.t];
  return `<div class="pop tier-${r.t}"><span class="pk">${k}</span>${sig(r.t, 70)}<span class="pn">${T.name}</span><span class="pp">+${T.pts} PTS · +${fmt(T.pts * M_PER_PT)} M${extra || ''}</span><span class="pa">${esc(r.name)}</span><span class="skip">Tap to continue</span></div>`;
}
async function showPopup(html, ms){
  const host = document.getElementById('popup'); host.innerHTML = html;
  const el = host.firstElementChild;
  await hold(ms, el);
  el.classList.add('out'); await sleep(calm() ? 0 : 620); host.innerHTML = '';
}
async function zoneBanner(z){
  const host = document.getElementById('zone');
  host.innerHTML = `<div class="zb"><span class="zk">ENTERING ZONE ${String(z.n).padStart(2, '0')} / 05</span><span class="zn">${esc(z.name)}</span><span class="zs">${esc(z.sub)}</span></div>`;
  sfx.zone(); shake(8, 1400); buzz([60, 80, 60]);
  const el = host.firstElementChild;
  await hold(3600 * dil(z.from), el);
  el.classList.add('out'); await sleep(calm() ? 0 : 760); host.innerHTML = '';
}
function countPill(from, to, ms){
  const el = document.getElementById('dp'); if (!el) return;
  const t0 = performance.now(); let lastSnd = 0; ms = calm() ? 300 : ms;
  const step = now => { const p = Math.min(1, (now - t0) / ms), v = from + (to - from) * easeIO(p); el.textContent = fmt(v) + ' M'; if (now - lastSnd > 90 && p < 1 && to > from){ sfx.count(); lastSnd = now; } if (p < 1) requestAnimationFrame(step); else { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); } };
  requestAnimationFrame(step);
}
/* answer submitted → the card sinks, the camera falls, the depth rolls, then the verdict */
async function sinkSequence(r, fromM, toM, extraPop, idx){
  busy = true;
  const card = document.getElementById('card'); if (card) card.classList.add('sinking');
  const D = (r.t ? 3600 : 2000) * dil(toM);
  sfx.sink(D); if (r.t) burst(VW / 2, VH * .45, 46);
  countPill(fromM, toM, D * .92);
  await tween({s:world.s + (r.t ? .55 + TIERS[r.t].pts / 160 : .2), dark:clamp(toM / MAX_M, 0, 1)}, D, easeIO);
  if (r.t){ sfx.hit(r.t); burst(VW / 2, VH * .5, r.t === 'G' ? 110 : 50, r.t === 'G' ? 'rgba(224,49,61,.85)' : null); if (r.t === 'G') shake(9, 900); }
  await showPopup(popupHTML(r, extraPop, idx), (r.t === 'G' ? 5200 : 3800) * dil(toM));
  const z0 = zoneOf(fromM), z1 = zoneOf(toM);
  if (z1.n > z0.n) await zoneBanner(z1);
  busy = false;
}
async function endRound(res, input, why){
  if (S.phase !== 'answering') return;
  stopTimer(); S.phase = 'sinking';
  const inp = document.getElementById('ans'); if (inp) inp.disabled = true;
  const pid = S.pids[S.idx], before = curDepth();
  const ms = Math.min(ROUND_MS, performance.now() - S.t0);
  const r = res ? {pid, t:res.t, name:res.name, input, renamed:res.renamed, fuzzy:res.fuzzy, how:res.how, misses:S.misses.slice(), ms} : {pid, t:null, name:null, input, misses:S.misses.slice(), why:why || 'pass', ms};
  if (res) r.isNew = markFound(pid, res, diveLabel());
  S.results.push(r); persist();
  if (why === 'timeout') await hurtFx();
  await sinkSequence(r, before, curDepth(), '', S.idx);
  S.phase = 'reveal'; renderReveal();
}
function badgeHTML(r, airText){
  if (!r.t) return `<div class="badge tier-X"><span class="bi">${sig(null, 40)}</span><span><span class="bn">${r.why === 'timeout' ? 'Time’s up' : r.why === 'air' ? 'Out of air' : 'No answer'}</span><br><span class="bd">The signal died before it reached you.</span></span><span class="bp">0<small>+0 M</small></span></div>`;
  const T = TIERS[r.t];
  return `<div class="badge tier-${r.t}"><span class="bi">${sig(r.t, 40)}</span><span><span class="bn">${T.name}</span><br><span class="bd">${esc(T.desc)}</span></span><span class="bp">+${T.pts}<small>+${fmt(T.pts * M_PER_PT)} M${airText || ''}</small></span></div>`;
}
function readAsHTML(r){
  if (!r.t || !r.renamed) return '';
  const why = r.how === 'typo' ? 'typo forgiven' : r.how === 'spelling' ? 'spelling variant' : r.how === 'plural' ? 'plural' : r.how === 'core' ? 'short form' : 'alias';
  return `<div class="readas">You typed “${esc(r.input)}” <b>//</b> read as <b>${esc(r.name)}</b> <span class="dim">(${why})</span></div>`;
}
function renderReveal(){
  const p = BYID[S.pids[S.idx]], r = S.results[S.idx];
  const last = S.idx >= 6;
  paint(topbar() + `<main class="wrap">
    <div class="divebar"><div class="dots">${dotsHTML(S.idx)}</div><span class="depthpill" id="dp">${fmt(curDepth())} M</span></div>
    <section class="panel ${r.t === 'G' ? 'red' : ''}" style="display:flex;flex-direction:column;gap:16px">
      <span class="eyebrow">SIGNAL ${String(S.idx + 1).padStart(2, '0')} / 07 <b>//</b> ${r.ms ? (r.ms / 1000).toFixed(1) + 'S' : ''} <b>//</b> ZONE ${String(zoneOf(curDepth()).n).padStart(2, '0')}</span>
      <div class="dim caps small">${esc(p.q)}</div>
      ${r.t ? `<div class="prompt">${esc(r.name)}</div>` : ''}
      ${badgeHTML(r)}
      ${readAsHTML(r)}
      ${r.isNew ? `<div class="newentry">${icon('codex', 22)} <b>NEW CODEX ENTRY</b> // ${esc(r.name)} added to your field guide</div>` : ''}
      ${r.misses.length ? `<div class="misses">${r.misses.map(m => `<span class="miss">${esc(m)}</span>`).join('')}</div>` : ''}
      ${autoHTML(last ? 'Surfacing · decrypting log' : 'Next signal')}
    </section></main>`);
  autoAdvance(REVEAL_MS, nextRound);
}
/* the after-signal screen holds for a few seconds, then the dive moves on by itself */
const REVEAL_MS = 4200;
function autoHTML(label){ return `<div class="autobar" id="auto" title="Tap to skip"><div class="bar"><i id="autoi"></i></div><span><b>${esc(label)}</b> in a moment · tap to skip</span></div>`; }
function autoAdvance(ms, fn){
  const tok = S.tok = Math.random(), el = document.getElementById('auto'), bar = document.getElementById('autoi');
  const d = calm() ? Math.min(ms, 1200) : ms;
  if (bar){ bar.style.transition = 'none'; bar.style.width = '0'; bar.getBoundingClientRect(); bar.style.transition = `width ${d}ms linear`; bar.style.width = '100%'; }
  hold(d, el).then(() => { if (S.tok === tok && !busy){ S.tok = null; fn(); } });
}
async function nextRound(){
  if (busy) return;
  S.idx++;
  if (S.idx >= 7){
    const prevBest = Math.max(0, ...stats().games.map(x => x.pts)), hadDives = stats().games.length > 0;
    S.phase = 'done'; recordGame(S); advanceSky();
    if (S.mode === 'unlimited'){ const u = store.get('unl', {next:1}); u.next = Math.max(u.next, S.num + 1); store.set('unl', u); }
    if (S.mode === 'pack'){ const pk = store.get('pack-' + S.pack, {next:1}); pk.next = Math.max(pk.next, S.num + 1); store.set('pack-' + S.pack, pk); }
    sfx.click(); busy = true; await leave('fade', 700);
    app.innerHTML = '';
    await decryptLog(curDepth(), S.results.length);
    const pts = ptsOf(S.results);
    if (pts > prevBest) await recordScreen(prevBest * M_PER_PT, pts * M_PER_PT, !hadDives);
    busy = false; return renderResults();
  }
  sfx.click(); await leave('fade', 540); beginRound();
}
function decryptLog(m, n){
  const D = 3200 * (1 + clamp(m / MAX_M, 0, 1) * .6), z = zoneOf(m);
  sfx.sonar();
  return hudRun({kicker:'TRANSMISSION RECEIVED', title:'DECRYPTING', value:true, unit:'% LOG', from:0, to:100, dur:D, scramble:true,
    lines:[[0, '> PACKET <span class="scr"></span>'], [.15, `> ${n} SIGNALS ............ <b>RECOVERED</b>`], [.32, '> RECONSTRUCTING DEPTH PROFILE'], [.5, `> CROSS-REFERENCING ${fmt(totalAnswers())} ANSWERS`], [.7, '> CLASSIFYING TERRITORY .... <b>ZONE ' + String(z.n).padStart(2, '0') + '</b>'], [.88, '> DIVE LOG ................. <b>OPEN</b>']]});
}

/* ============================== dive log (results) ============================== */
const TCOL = {P:'#7F96A3', T:'#A9B6BE', S:'#6E9DB8', R:'#4C86C6', D:'#5B6EE0', G:'#E0313D', X:'#46525c'};
function profileSVG(rs, maxM, opt){
  opt = opt || {};
  const W = 640, H = 340, L = 44, R = 150, T = 16, B = 34, n = Math.max(1, rs.length);
  const x = i => L + (W - L - R) * i / n, y = mm => T + (H - T - B) * clamp(mm / maxM, 0, 1);
  let h = '';
  ZONES.forEach((z, i) => { if (z.from >= maxM) return; const y0 = y(z.from), y1 = y(Math.min(z.to, maxM)); h += `<rect x="${L}" y="${y0}" width="${W - L - R}" height="${y1 - y0}" fill="rgba(127,150,163,${i % 2 ? .07 : .03})"/><line x1="${L}" x2="${W - R + 8}" y1="${y0}" y2="${y0}" stroke="rgba(127,150,163,.25)" stroke-dasharray="2 4"/><text x="${W - R + 14}" y="${(y0 + y1) / 2 + 4}" fill="#7F96A3" font-size="9.5" letter-spacing="1.2">${String(z.n).padStart(2, '0')} ${esc(z.name.replace(/^The /, '').toUpperCase())}</text>`; });
  for (let d = 0; d <= maxM; d += maxM > 8000 ? 2000 : 1000) h += `<text x="${L - 8}" y="${y(d) + 3}" fill="#46525c" font-size="10" text-anchor="end">${d / 1000}K</text>`;
  let cum = 0; const pts = [[x(0), y(0)]];
  rs.forEach((r, i) => { cum += r.t ? TIERS[r.t].pts * M_PER_PT : 0; pts.push([x(i + 1), y(cum)]); });
  const line = pts.map(p => p.map(v => v.toFixed(1)).join(',')).join(' ');
  h += `<polygon points="${line} ${x(n).toFixed(1)},${y(0)} ${x(0)},${y(0)}" fill="rgba(224,49,61,.07)"/>`;
  h += `<polyline class="drawline" points="${line}" fill="none" stroke="#C9D6DC" stroke-width="1.6" stroke-linejoin="round"/>`;
  if (opt.air){ const amax = Math.max(...opt.air, AIR_START); const ay = a => T + (H - T - B) * (1 - a / amax); const al = [[x(0), ay(AIR_START)]].concat(opt.air.map((a, i) => [x(i + 1), ay(Math.max(0, a))])); h += `<polyline points="${al.map(p => p.map(v => v.toFixed(1)).join(',')).join(' ')}" fill="none" stroke="#6E9DB8" stroke-width="1" stroke-dasharray="3 3" opacity=".8"/>`; }
  rs.forEach((r, i) => { const [px, py] = pts[i + 1]; const c = TCOL[r.t || 'X']; h += r.t ? `<rect x="${px - 4.5}" y="${py - 4.5}" width="9" height="9" fill="${c}" class="pt" style="animation-delay:${(.4 + i * .25).toFixed(2)}s"><title>${esc(BYID[r.pid].q)}: ${esc(r.name)} (${TIERS[r.t].name})</title></rect>` : `<path d="M${px - 5},${py - 5}L${px + 5},${py + 5}M${px + 5},${py - 5}L${px - 5},${py + 5}" stroke="#E0313D" stroke-width="1.6" class="pt"/>`;
    if (n <= 14) h += `<text x="${px}" y="${H - B + 18}" fill="#7F96A3" font-size="10" text-anchor="middle">${String(i + 1).padStart(2, '0')}</text>`; });
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Dive profile: depth after each signal">${h}</svg>`;
}
function barsSVG(rs, key){
  const W = 640, H = 210, L = 44, R = 18, T = 14, B = 34, n = Math.max(1, rs.length), bw = (W - L - R) / n;
  const vals = rs.map(r => key === 'time' ? (r.ms || 0) / 1000 : (r.t ? TIERS[r.t].pts : 0));
  const max = key === 'time' ? 25 : 100, y = v => T + (H - T - B) * (1 - v / max);
  let h = '';
  for (let g = 0; g <= max; g += key === 'time' ? 5 : 25) h += `<line x1="${L}" x2="${W - R}" y1="${y(g)}" y2="${y(g)}" stroke="rgba(127,150,163,.12)"/><text x="${L - 8}" y="${y(g) + 3}" fill="#46525c" font-size="10" text-anchor="end">${g}${key === 'time' ? 's' : ''}</text>`;
  const avg = vals.reduce((a, b) => a + b, 0) / n;
  rs.forEach((r, i) => { const v = vals[i], x0 = L + i * bw + bw * .2, w = bw * .6; const c = key === 'time' ? (r.t ? '#7F96A3' : '#E0313D') : TCOL[r.t || 'X'];
    h += `<rect class="bar-g" x="${x0.toFixed(1)}" y="${y(v).toFixed(1)}" width="${w.toFixed(1)}" height="${(y(0) - y(v)).toFixed(1)}" fill="${c}" style="transform-origin:${(x0 + w / 2).toFixed(1)}px ${y(0)}px;animation-delay:${(.2 + i * .12).toFixed(2)}s"/>`;
    if (n <= 14) h += `<text x="${(x0 + w / 2).toFixed(1)}" y="${H - B + 16}" fill="${c}" font-size="10" text-anchor="middle">${key === 'time' ? v.toFixed(1) : (r.t ? TIERS[r.t].code : '··')}</text><text x="${(x0 + w / 2).toFixed(1)}" y="${H - B + 28}" fill="#46525c" font-size="9" text-anchor="middle">${String(i + 1).padStart(2, '0')}</text>`; });
  h += `<line x1="${L}" x2="${W - R}" y1="${y(avg)}" y2="${y(avg)}" stroke="#E0313D" stroke-dasharray="4 4" stroke-width="1"/><text x="${W - R}" y="${y(avg) - 5}" fill="#E0313D" font-size="10" text-anchor="end">AVG ${key === 'time' ? avg.toFixed(1) + 'S' : avg.toFixed(1)}</text>`;
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${key === 'time' ? 'Seconds used per signal' : 'Points per signal'}">${h}</svg>`;
}
function stripSVG(rs){
  const W = 640, H = 46, n = rs.length || 1; const counts = {}; rs.forEach(r => counts[r.t || 'X'] = (counts[r.t || 'X'] || 0) + 1);
  let x = 0, h = '';
  ['G','D','R','S','T','P','X'].forEach(t => { const c = counts[t]; if (!c) return; const w = W * c / n; h += `<rect x="${x.toFixed(1)}" y="0" width="${(w - 2).toFixed(1)}" height="26" fill="${TCOL[t]}"/><text x="${(x + 4).toFixed(1)}" y="42" fill="${TCOL[t]}" font-size="10">${t === 'X' ? 'LOST' : TIERS[t].code} ×${c}</text>`; x += w; });
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Tier distribution">${h}</svg>`;
}
function readoutsHTML(m){
  const lp = lightPct(m);
  return `<div class="readouts"><div><span class="k">PRESSURE</span><span class="v num">${fmt(pressure(m))}</span><span class="k">ATM</span></div><div><span class="k">WATER</span><span class="v num">${waterTemp(m).toFixed(1)}°</span><span class="k">CELSIUS</span></div><div><span class="k">LIGHT</span><span class="v num">${lp >= .01 ? lp.toFixed(lp >= 10 ? 0 : 2) : '0.00'}</span><span class="k">% OF SURFACE</span></div><div><span class="k">OF THE ABYSS</span><span class="v num">${(m / MAX_M * 100).toFixed(1)}</span><span class="k">PERCENT</span></div></div>`;
}
function territoryHTML(m, kicker){
  const z = zoneOf(m);
  return `<div class="territory stamp"><span class="tk">${kicker || 'TERRITORY REACHED'} // ZONE ${String(z.n).padStart(2, '0')} / 05</span><span class="tv flicker">${esc(z.name)}</span><span class="ts">${esc(z.sub)}</span><span class="tn">${esc(z.note)}</span></div>`;
}
function logRows(rs){
  return rs.map((r, i) => { const T = r.t ? TIERS[r.t] : null;
    return `<div class="lrow tier-${r.t || 'X'}"><span class="li">${String(i + 1).padStart(2, '0')}</span><span><span class="lq">${esc(BYID[r.pid].q)}</span><br><span class="la ${r.t ? '' : 'none'}">${r.t ? esc(r.name) : (r.why === 'timeout' ? 'Time ran out' : r.why === 'air' ? 'Air ran out' : 'Given up')}</span><span class="lm"><span style="color:var(--tc)">${sig(r.t, 12)} ${T ? T.name : 'LOST'}</span>${r.ms ? `<span>${(r.ms / 1000).toFixed(1)} SEC</span>` : ''}${r.misses && r.misses.length ? `<span>${r.misses.length} WRONG</span>` : ''}${r.renamed && r.fuzzy ? '<span>TYPO FORGIVEN</span>' : ''}</span></span><span class="lp">${T ? '+' + T.pts : '0'}<small style="color:var(--tc)">${T ? fmt(T.pts * M_PER_PT) : '0'} M</small></span></div>`; }).join('');
}
function diveStats(rs, extra){
  const answered = rs.filter(r => r.t), times = rs.filter(r => r.t && r.ms).map(r => r.ms / 1000);
  const pts = ptsOf(rs), wrong = rs.reduce((a, r) => a + (r.misses ? r.misses.length : 0), 0);
  const rarest = answered.slice().sort((a, b) => TIER_ORDER.indexOf(b.t) - TIER_ORDER.indexOf(a.t))[0];
  const total = rs.reduce((a, r) => a + (r.ms || 0), 0) / 1000;
  const mmss = s => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
  const cells = [
    ['POINTS', `${pts}`, `OF ${rs.length * 100} POSSIBLE`],
    ['RARITY INDEX', `${Math.round(pts / (rs.length * 100 || 1) * 100)}%`, 'POINTS ÷ MAXIMUM'],
    ['MEAN / SIGNAL', (pts / (rs.length || 1)).toFixed(1), 'POINTS PER PROMPT'],
    ['SIGNALS HELD', `${answered.length}/${rs.length}`, `${rs.length - answered.length} LOST`],
    ['WRONG GUESSES', `${wrong}`, wrong ? `−${wrong * (extra && extra.endless ? AIR_WRONG : WRONG_MS) / 1000} SEC PAID` : 'CLEAN'],
    ['TIME UNDER', mmss(total), 'ANSWERING ONLY'],
    ['FASTEST', times.length ? Math.min(...times).toFixed(1) + 'S' : '—', 'QUICKEST CATCH'],
    ['SLOWEST', times.length ? Math.max(...times).toFixed(1) + 'S' : '—', 'LONGEST HUNT'],
    ['MEAN RESPONSE', times.length ? (times.reduce((a, b) => a + b, 0) / times.length).toFixed(1) + 'S' : '—', 'PER ANSWER'],
    ['RAREST CATCH', rarest ? esc(rarest.name) : '—', rarest ? TIERS[rarest.t].name : 'NOTHING HELD', true],
    ['GEMS', `${rs.filter(r => r.t === 'G').length}`, 'ONE IN A LEAFY SEADRAGON']
  ];
  if (extra && extra.vs) cells.push(extra.vs);
  return `<div class="statgrid">${cells.map(c => `<div><span class="k">${c[0]}</span><span class="v ${c[3] ? 'sm' : ''} ${c[4] || ''}">${c[1]}</span><span class="s">${c[2]}</span></div>`).join('')}</div>`;
}
function shareText(){
  const m = curDepth(), z = zoneOf(m);
  const title = S.mode === 'daily' ? `DAILY #${S.num}` : S.mode === 'unlimited' ? `UNLIMITED #${S.num}` : `${PACKS[S.pack].name.toUpperCase()} #${S.num}`;
  return `ONEINALEAFYSEDRAGON // ${title}\n${S.results.map(r => r.t ? TIERS[r.t].glyph : '·').join(' ')}\n${fmt(m)} M // ZONE ${String(z.n).padStart(2, '0')} ${z.name.toUpperCase()}`;
}
function countUp(el, to, ms, spacedOut){
  if (!el) return;
  const t0 = performance.now(); let last = 0; ms = calm() ? 200 : ms;
  const step = now => { const p = Math.min(1, (now - t0) / ms); el.textContent = fmt(to * easeOut(p)); if (now - last > 70 && p < 1){ sfx.count(); last = now; } if (p < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
function wireCharts(){
  app.querySelectorAll('.reveal').forEach(sec => sec.addEventListener('shown', () => {
    sec.querySelectorAll('.drawline').forEach(pl => { try{ const len = pl.getTotalLength(); pl.style.strokeDasharray = len; pl.style.strokeDashoffset = len; pl.getBoundingClientRect(); pl.style.transition = calm() ? 'none' : 'stroke-dashoffset 3.2s cubic-bezier(.4,0,.2,1)'; pl.style.strokeDashoffset = 0; }catch(e){} });
    sec.querySelectorAll('.pt').forEach(p => { p.style.opacity = 0; p.style.transition = 'opacity .6s'; setTimeout(() => p.style.opacity = 1, calm() ? 0 : 900 + Math.random() * 1800); });
    sec.querySelectorAll('.bar-g').forEach((b, i) => { b.style.transform = 'scaleY(0)'; b.style.transition = calm() ? 'none' : `transform 1.4s cubic-bezier(.16,.9,.24,1) ${(.2 + i * .12).toFixed(2)}s`; b.getBoundingClientRect(); b.style.transform = 'scaleY(1)'; });
    sec.querySelectorAll('[data-count]').forEach(el => countUp(el, +el.dataset.count, 3600));
  }, {once:true}));
}
function renderResults(){
  stopTimer();
  const rs = S.results, pts = ptsOf(rs), m = pts * M_PER_PT;
  if (Math.abs(world.dark - m / MAX_M) > .01) tween({dark:m / MAX_M}, 2400);
  const st = stats(), prev = st.games.filter(g => !(g.mode === S.mode && g.num === S.num && g.pack === (S.pack || null)));
  const avg = prev.length ? prev.reduce((a, g) => a + g.pts, 0) / prev.length : null;
  const vs = avg == null ? ['VS YOUR AVERAGE', 'FIRST', 'NO EARLIER DIVES'] : (() => { const d = (pts - avg) * M_PER_PT; return ['VS YOUR AVERAGE', `${d >= 0 ? '+' : '−'}${fmt(Math.abs(d))}`, `M · AVG ${fmt(avg * M_PER_PT)} M`, false, d >= 0 ? 'up' : 'down']; })();
  const code = 'LOG-' + (hashStr(S.mode + S.num + (S.pack || ''))() % 65536).toString(16).toUpperCase().padStart(4, '0') + '-' + String(S.num).padStart(4, '0');
  paint(topbar() + `<main class="wrap">
    <div class="row spread"><span class="eyebrow">DIVE LOG <b>//</b> ${esc(diveTitle())}</span><span class="eyebrow">${code}</span></div>
    <section class="hero-depth"><span class="eyebrow">MAXIMUM DEPTH REACHED</span><span class="v" id="bigm">0</span><span class="u">METRES BELOW THE BOAT</span></section>
    ${territoryHTML(m)}
    ${readoutsHTML(m)}
    <section class="sec reveal"><div class="sech"><h3>Dive profile</h3><span>DEPTH AFTER EACH SIGNAL</span></div>${profileSVG(rs, MAX_M)}</section>
    <section class="sec reveal"><div class="sech"><h3>Rarity by signal</h3><span>POINTS · RED LINE = MEAN</span></div>${barsSVG(rs, 'pts')}${stripSVG(rs)}</section>
    <section class="sec reveal"><div class="sech"><h3>Time per signal</h3><span>SECONDS OF 25 · RED BAR = LOST</span></div>${barsSVG(rs, 'time')}</section>
    <section class="sec reveal"><div class="sech"><h3>Readings</h3><span>${rs.length} SIGNALS ANALYSED</span></div>${diveStats(rs, {vs})}</section>
    <section class="sec reveal"><div class="sech"><h3>Signal log</h3><span>WHAT YOU BROUGHT UP</span></div><div class="log">${logRows(rs)}</div></section>
    <section class="sec reveal"><div class="sech"><h3>Transmit</h3><span>SPOILER-FREE</span></div><div class="sharebox" id="share">${esc(shareText())}</div>
      <div class="row">
        <button class="btn" data-act="copyShare">Copy</button>
        ${S.mode === 'unlimited' ? `<button class="btn steel" data-act="nextUnl">Descend again · #${S.num + 1}</button>` : ''}
        ${S.mode === 'pack' ? `<button class="btn steel" data-act="nextPack">Next ${esc(PACKS[S.pack].name)} dive</button>` : ''}
        ${S.mode === 'daily' ? `<button class="btn steel" data-act="startUnl">Keep diving · Unlimited</button>` : ''}
        <button class="btn ghost" data-act="home">Ascend</button>
      </div></section>
  </main>`);
  wireCharts();
  countUp(document.getElementById('bigm'), m, 3900);
  setTimeout(() => { sfx.stamp(); shake(9, 500); }, calm() ? 0 : 1300);
}

/* ---------- new record: the euphoria moment ---------- */
async function recordScreen(oldM, newM, first, mode){
  const host = document.getElementById('record');
  host.innerHTML = `<div class="rec"><span class="rk">${first ? 'FIRST DIVE LOGGED' : 'PERSONAL BEST BROKEN'}${mode ? ' // ' + mode : ''}</span>${icon('record', 76, '#E8EEF1', 'tic big')}<span class="rt">New depth record</span><span class="rv" id="recv">${fmt(oldM)}</span><span class="ru">METRES BELOW THE BOAT</span>${first ? '' : `<span class="rold">PREVIOUS ${fmt(oldM)} M</span>`}<span class="rd">+${fmt(newM - oldM)} M DEEPER THAN EVER</span><span class="rs">TAP TO CONTINUE</span></div>`;
  const el = host.firstElementChild;
  sfx.record(); shake(18, 1600); buzz([90, 40, 90, 40, 260]);
  [0, 500, 1100, 1900].forEach((d, i) => setTimeout(() => burst(VW / 2, VH * .46, i % 2 ? 90 : 130, i % 2 ? 'rgba(232,238,241,.9)' : 'rgba(224,49,61,.9)'), calm() ? 0 : d));
  const v = document.getElementById('recv'), t0 = performance.now() + (calm() ? 0 : 1000), dur = calm() ? 200 : 2600; let last = 0;
  const step = now => { const p = clamp((now - t0) / dur, 0, 1), val = oldM + (newM - oldM) * easeOut(p); if (v) v.textContent = fmt(val); if (p > 0 && p < 1 && now - last > 60){ sfx.count(); last = now; } if (p < 1) requestAnimationFrame(step); else { sfx.stamp(); shake(10, 500); } };
  requestAnimationFrame(step);
  await hold(7200, el);
  el.classList.add('out'); await sleep(calm() ? 0 : 850); host.innerHTML = '';
}

/* ---------- endless air ---------- */
function startEndless(){
  const order = shuffle(DB, Math.random), seq = []; let last = null; const rest = order.slice();
  while (rest.length){ let i = rest.findIndex(p => !(last && last.fam === p.fam && (p.fam === 'city' || p.fam === 'words'))); if (i < 0) i = 0; last = rest.splice(i, 1)[0]; seq.push(last.id); }
  descendTo(() => { S = {screen:'endless', seq, idx:0, air:AIR_START, results:[], airLog:[], phase:'ready'}; setHash('endless'); world.dark = 0; endlessRound(); });
}
const endlessPts = () => ptsOf(S.results);
function airHTML(){ return `<div class="airgauge" style="position:relative"><span class="lbl">AIR</span><div class="timerwrap" style="flex:1"><div class="timerfill air" id="af2" style="width:${Math.min(100, S.air / AIR_START * 100)}%"></div></div><span class="timetext" id="at">${(Math.max(0, S.air) / 1000).toFixed(1)}</span></div>`; }
function endlessRound(){
  if (S.idx >= S.seq.length) S.seq = S.seq.concat(shuffle(DB, Math.random).map(p => p.id));
  const p = BYID[S.seq[S.idx]];
  S.phase = 'answering'; S.misses = []; S.lastT = performance.now(); S.lastTick = 99; S.t0 = performance.now();
  paint(topbar() + `<main class="wrap">
    <div class="divebar"><span class="eyebrow">ENDLESS AIR <b>//</b> SIGNAL ${String(S.idx + 1).padStart(2, '0')}</span><span class="depthpill" id="dp">${fmt(endlessPts() * M_PER_PT)} M</span></div>
    <section class="panel" id="card" style="display:flex;flex-direction:column;gap:18px">
      ${airHTML()}
      <div class="prompt">${esc(p.q)}</div>
      ${inputBlock()}
      <div class="row spread"><span class="dim small caps">Wrong −${AIR_WRONG / 1000} sec air · give up −${AIR_PASS / 1000} sec</span><button class="btn ghost small" data-act="ePass">Give up</button></div>
    </section></main>`);
  const inp = document.getElementById('ans'); setTimeout(() => inp.focus(), 60);
  document.getElementById('af').addEventListener('submit', e => { e.preventDefault(); eSubmit(inp.value); });
  const loop = () => {
    if (S.screen !== 'endless' || S.phase !== 'answering') return;
    const now = performance.now(); S.air -= now - S.lastT; S.lastT = now;
    const f = document.getElementById('af2'), t = document.getElementById('at');
    if (f){ f.style.width = clamp(S.air / AIR_START * 100, 0, 100) + '%'; f.classList.toggle('low', S.air < 6000); f.classList.toggle('air', S.air >= 6000); }
    if (t){ t.textContent = Math.max(0, S.air / 1000).toFixed(1); t.classList.toggle('low', S.air < 6000); }
    const sec = Math.ceil(S.air / 1000); if (sec <= 5 && sec !== S.lastTick && sec > 0){ S.lastTick = sec; sfx.tick(); if (sec <= 3) shake(3, 160); }
    if (S.air <= 0){ S.air = 0; return eEnd(null, '', 'air'); }
    timerRAF = requestAnimationFrame(loop);
  };
  stopTimer(); timerRAF = requestAnimationFrame(loop);
}
function eSubmit(val){
  val = val.trim(); if (!val || S.phase !== 'answering') return;
  const res = judge(BYID[S.seq[S.idx]], val);
  if (res) return eEnd(res, val);
  if (!S.misses.some(m => norm(m) === norm(val))) S.air -= AIR_WRONG;
  missFeedback(val, AIR_WRONG);
}
async function eEnd(res, input, why){
  if (S.phase !== 'answering') return;
  stopTimer(); S.phase = 'sinking';
  const inp = document.getElementById('ans'); if (inp) inp.disabled = true;
  const pid = S.seq[S.idx], before = endlessPts() * M_PER_PT, ms = performance.now() - S.t0;
  const r = res ? {pid, t:res.t, name:res.name, input, renamed:res.renamed, fuzzy:res.fuzzy, how:res.how, misses:S.misses.slice(), ms} : {pid, t:null, input, misses:S.misses.slice(), why, ms};
  if (why === 'pass') S.air -= AIR_PASS;
  if (res) r.isNew = markFound(pid, res, 'ENDLESS AIR');
  S.results.push(r);
  if (res) S.air += TIERS[res.t].air * 1000;
  S.airLog.push(S.air);
  if (why === 'air' || S.air <= 0) await hurtFx();
  await sinkSequence(r, before, endlessPts() * M_PER_PT, r.t ? ` · +${TIERS[r.t].air}S AIR` : '', S.idx);
  S.phase = 'reveal';
  const dead = S.air <= 0, p = BYID[pid];
  paint(topbar() + `<main class="wrap">
    <div class="divebar"><span class="eyebrow">ENDLESS AIR <b>//</b> SIGNAL ${String(S.idx + 1).padStart(2, '0')}</span><span class="depthpill" id="dp">${fmt(endlessPts() * M_PER_PT)} M</span></div>
    <section class="panel ${r.t === 'G' ? 'red' : ''}" style="display:flex;flex-direction:column;gap:16px">
      ${airHTML()}
      <div class="dim caps small">${esc(p.q)}</div>
      ${r.t ? `<div class="prompt">${esc(r.name)}</div>` : ''}
      ${badgeHTML(r, r.t ? ` · +${TIERS[r.t].air}S AIR` : '')}
      ${readAsHTML(r)}
      ${r.isNew ? `<div class="newentry">${icon('codex', 22)} <b>NEW CODEX ENTRY</b> // ${esc(r.name)} added to your field guide</div>` : ''}
      ${autoHTML(dead ? 'Out of air · decrypting log' : 'Next signal')}
      ${dead ? '' : '<div class="row"><button class="btn ghost small" data-act="eResults">Surface now</button></div>'}
    </section></main>`);
  autoAdvance(REVEAL_MS, dead ? endlessToResults : () => { S.idx++; sfx.click(); leave('fade', 540).then(endlessRound); });
}
async function endlessToResults(){
  if (busy) return; S.tok = null; busy = true; sfx.click(); await leave('fade', 700); app.innerHTML = '';
  const prevBest = stats().endlessBest, hadRuns = stats().endlessRuns > 0;
  if (!S.recorded){ recordEndless(S); S.recorded = true; advanceSky(); }
  await decryptLog(endlessPts() * M_PER_PT, S.results.length);
  if (endlessPts() > prevBest) await recordScreen(prevBest * M_PER_PT, endlessPts() * M_PER_PT, !hadRuns, 'ENDLESS AIR');
  busy = false; renderEndlessResults();
}
function renderEndlessResults(){
  stopTimer();
  const rs = S.results, pts = endlessPts(), m = pts * M_PER_PT, st = stats(), answered = rs.filter(r => r.t).length;
  const best = pts >= st.endlessBest && pts > 0;
  S.share = `ONEINALEAFYSEDRAGON // ENDLESS AIR\n${rs.map(r => r.t ? TIERS[r.t].glyph : '·').join(' ')}\n${answered} SIGNALS // ${fmt(m)} M`;
  const maxM = Math.max(MAX_M, Math.ceil(m / 1000) * 1000);
  paint(topbar() + `<main class="wrap">
    <div class="row spread"><span class="eyebrow">DIVE LOG <b>//</b> ENDLESS AIR</span><span class="eyebrow">${best ? '<b>NEW RECORD</b>' : 'RECORD ' + fmt(st.endlessBest * M_PER_PT) + ' M'}</span></div>
    <section class="hero-depth"><span class="eyebrow">${S.air <= 0 ? "DEPTH WHEN THE AIR RAN OUT" : "FINAL DEPTH"}</span><span class="v" id="bigm">0</span><span class="u">METRES · ${answered} SIGNAL${answered === 1 ? "" : "S"} HELD</span></section>
    ${territoryHTML(Math.min(m, MAX_M), best ? 'NEW PERSONAL RECORD' : 'FINAL TERRITORY')}
    ${readoutsHTML(Math.min(m, MAX_M))}
    <section class="sec reveal"><div class="sech"><h3>Dive profile</h3><span>DEPTH · DASHED = AIR LEFT</span></div>${profileSVG(rs, maxM, {air:S.airLog})}</section>
    <section class="sec reveal"><div class="sech"><h3>Rarity by signal</h3><span>POINTS · RED LINE = MEAN</span></div>${barsSVG(rs, 'pts')}${stripSVG(rs)}</section>
    <section class="sec reveal"><div class="sech"><h3>Readings</h3><span>${rs.length} SIGNALS ANALYSED</span></div>${diveStats(rs, {endless:true, vs:['RUNS LOGGED', `${st.endlessRuns}`, 'ENDLESS AIR DIVES']})}</section>
    <section class="sec reveal"><div class="sech"><h3>Signal log</h3><span>WHAT YOU BROUGHT UP</span></div><div class="log">${logRows(rs)}</div></section>
    <section class="sec reveal"><div class="sech"><h3>Transmit</h3><span>SPOILER-FREE</span></div><div class="sharebox">${esc(S.share)}</div>
    <div class="row"><button class="btn" data-act="copyEndless">Copy</button><button class="btn steel" data-act="startEndless">New run</button><button class="btn ghost" data-act="home">Ascend</button></div></section>
  </main>`);
  S.screen = 'endlessResults';
  wireCharts();
  countUp(document.getElementById('bigm'), m, 3900);
  setTimeout(() => { sfx.stamp(); shake(9, 500); }, calm() ? 0 : 1300);
}

/* ---------- packs, archive, stats ---------- */
function renderPacks(){
  stopTimer(); setHash('packs');
  paint(topbar() + `<main class="wrap"><span class="eyebrow">M-03 <b>//</b> THEMED WATER</span><h2>Themed packs</h2><p class="dim small caps">Seven signals from one subject. Every pack is unlimited and numbered, so you and a friend can dive the same water.</p><div class="list">` +
    Object.entries(PACKS).map(([k, v]) => `<button class="litem" data-act="pack" data-k="${k}"><span><span class="lt">${esc(v.name)}</span><br><span class="dim small caps">${esc(v.blurb)}</span></span><span class="lr">${poolPack(k).length} prompts<br>next #${store.get('pack-' + k, {next:1}).next}</span></button>`).join('') + `</div><div><button class="btn ghost small" data-act="home">Back</button></div></main>`);
}
function renderArchive(){
  stopTimer(); setHash('archive');
  const n = todayNum(); let items = '';
  for (let i = n; i >= 1; i--){
    const s = store.get('daily-' + i, null);
    const status = s && s.done ? `${fmt(ptsOf(s.results) * M_PER_PT)} M · ${s.results.map(r => r.t ? TIERS[r.t].glyph : '·').join('')}` : s ? 'in progress' : 'unexplored';
    items += `<button class="litem" data-act="arch" data-n="${i}"><span><span class="lt">Daily #${i}${i === n ? ' · today' : ''}</span><br><span class="dim small">${dateOf(i)}</span></span><span class="lr">${status}</span></button>`;
  }
  paint(topbar() + `<main class="wrap"><span class="eyebrow">M-04 <b>//</b> RECORDS</span><h2>Archive</h2><p class="dim small caps">Every daily dive since #1. Each one can be logged once.</p>
  <div class="row"><label for="jump" class="dim small caps">Jump to unlimited game</label><input id="jump" class="filter num" type="number" min="1" placeholder="#" style="width:110px"><button class="btn small" data-act="jumpUnl">Descend</button></div>
  <div class="list">${items}</div><div><button class="btn ghost small" data-act="home">Back</button></div></main>`);
}
function renderStats(){
  stopTimer(); setHash('my-seadragon');
  const st = stats(), total = st.games.length;
  const best = total ? Math.max(...st.games.map(g => g.pts)) : 0, avg = total ? Math.round(st.games.reduce((a, g) => a + g.pts, 0) / total) : 0;
  const tierTotal = Object.values(st.tiers).reduce((a, b) => a + b, 0) || 1, leaves = Math.min(15, 9 + Math.floor(st.gems.length / 2));
  paint(topbar() + `<main class="wrap">
    <section class="panel" style="display:flex;flex-direction:column;gap:12px;align-items:center;text-align:center">${seadragonSVG({id:'me', w:300, leaves})}<span class="eyebrow">SPECIMEN FILE</span><h2>My seadragon</h2><p class="dim small caps">It grows a new leaf cluster for every two gems you find. ${st.gems.length ? `${leaves} clusters so far.` : 'Find your first gem to start growing it.'}</p></section>
    <section class="panel" style="display:flex;flex-direction:column;gap:14px">
      <div class="grid2">
        <div class="stat"><span class="k">Dives</span><span class="v">${total}</span></div>
        <div class="stat"><span class="k">Deepest</span><span class="v">${fmt(best * M_PER_PT)}</span></div>
        <div class="stat"><span class="k">Average</span><span class="v">${fmt(avg * M_PER_PT)}</span></div>
        <div class="stat"><span class="k">Daily streak</span><span class="v">${st.streak} <span class="dim small">/ ${st.bestStreak}</span></span></div>
        <div class="stat"><span class="k">Endless best</span><span class="v">${fmt(st.endlessBest * M_PER_PT)}</span></div>
        <div class="stat"><span class="k">Gems</span><span class="v">${st.gems.length}</span></div>
      </div>
      <h3>Answers by tier</h3>
      <table class="table"><tbody>${['G','D','R','S','T','P','X'].map(t => `<tr class="tier-${t}"><td style="color:var(--tc)">${sig(t === 'X' ? null : t, 13)} ${t === 'X' ? 'Lost' : TIERS[t].name}</td><td class="r">${st.tiers[t] || 0}</td><td class="r dim">${Math.round((st.tiers[t] || 0) / tierTotal * 100)}%</td></tr>`).join('')}</tbody></table>
      ${st.gems.length ? `<h3>Gem file</h3><div class="list">${st.gems.slice().reverse().slice(0, 40).map(g => `<div class="litem tier-G" style="cursor:default"><span>${icon('G', 30)}</span><span><span class="lt">${esc(g.a)}</span><br><span class="dim small caps">${esc(g.q)}</span></span></div>`).join('')}</div>` : ''}
      <div class="row"><button class="btn ghost small" data-act="home">Back</button><button class="btn ghost small" data-act="resetStats">Reset my stats</button></div>
    </section></main>`);
}

/* ---------- modals ---------- */
function modal(html){ sfx.click(); const m = document.createElement('div'); m.className = 'modal'; m.innerHTML = `<div class="panel" role="dialog" aria-modal="true">${html}<div class="row"><button class="btn" data-act="closeModal">Understood</button></div></div>`; m.addEventListener('click', e => { if (e.target === m) m.remove(); }); document.body.appendChild(m); m.querySelector('[data-act=closeModal]').focus(); }
function helpModal(){
  modal(`<span class="eyebrow">BRIEFING</span><h2>How to play</h2>
  <p>Each dive has <b>seven signals</b>, prompts like “Name a fish”. Type one answer that fits. Every answer on the list counts, but the less familiar it is, the more it scores and the deeper you sink.</p>
  <p class="dim">You get <b>25 seconds</b> per signal. A wrong guess costs ${WRONG_MS / 1000} seconds and you can try again.</p>
  <table class="table"><thead><tr><th>Tier</th><th class="r">Pts</th><th class="r">Depth</th><th class="r">Air*</th></tr></thead><tbody>${TIER_ORDER.map(t => `<tr class="tier-${t}"><td style="color:var(--tc)">${sig(t, 13)} ${TIERS[t].name}<br><span class="dim small">${TIERS[t].desc}</span></td><td class="r">${TIERS[t].pts}</td><td class="r">${TIERS[t].pts * M_PER_PT} M</td><td class="r">+${TIERS[t].air}S</td></tr>`).join('')}</tbody></table>
  <p class="dim">Each point is 10 metres; a perfect dive reaches 7,000 m and the Trench. Every prompt hides a few <b>One in a Leafy Seadragon</b> answers. Nobody is told what they are.</p>
  <p class="dim small">*Endless Air: one ${AIR_START / 1000}s tank that drains only while a signal is up. Answers refill it. Wrong −${AIR_WRONG / 1000}s, give up −${AIR_PASS / 1000}s.</p>`);
}
function faqModal(){
  modal(`<span class="eyebrow">FIELD NOTES</span><h2>FAQ</h2>
  <h3>How is rarity decided?</h3><p class="dim">By how familiar each answer is: how often it appears in written English, blended with curated ordering (and population for cities).</p>
  <h3>What are the gems?</h3><p class="dim">Each prompt has a hand-picked gem plus a couple of the most findable deep cuts. Rare, but an answer a well-read diver could land.</p>
  <h3>How forgiving is spelling?</h3><p class="dim">Very. Accents, plurals, British and American spellings, phonetic spellings (Tchaikovski, Lamborgini), swapped letters, a slipped key, a missing or doubled letter, and short forms (Nile for Nile River) all count. Very short words must be exact, and an everyday English word that isn't on the list only gets one slipped key, so a typo can never turn into a different answer.</p>
  <h3>My answer should count!</h3><p class="dim">There are ${fmt(totalAnswers())} answers, but no list is complete. Try the full name or the most common spelling.</p>
  <h3>Do I need an account?</h3><p class="dim">No. Progress saves automatically in this browser. Nothing about you is sent anywhere.</p>
  <h3>How do I keep my progress safe?</h3><p class="dim">Open Settings and copy a save code or download a save file. Load it on any device to carry on. Clearing your browsing data or using a private window erases progress. On iPhone and iPad, Safari can clear sites you have not opened for about a week; adding this game to your Home Screen avoids that.</p>`);
}
function settingsModal(){
  modal(`<span class="eyebrow">SYSTEM</span><h2>Settings</h2>
  <label class="toggle"><span>Sound effects<br><span class="dim small">Hits, misses, the dive itself</span></span><input type="checkbox" id="setSound" ${settings.sound ? 'checked' : ''}></label>
  <label class="toggle"><span>Ocean ambience<br><span class="dim small">A low hum and distant sonar, muffled by depth</span></span><input type="checkbox" id="setMusic" ${settings.music ? 'checked' : ''}></label>
  <label class="toggle"><span>Relaxed mode<br><span class="dim small">No timer in classic dives</span></span><input type="checkbox" id="setRelax" ${settings.relaxed ? 'checked' : ''}></label>
  <label class="toggle"><span>Calm visuals<br><span class="dim small">Less shaking, short transitions, no grain</span></span><input type="checkbox" id="setCalm" ${settings.calm ? 'checked' : ''}></label>
  ${saveSectionHTML()}`);
  document.getElementById('setSound').onchange = e => { settings.sound = e.target.checked; saveSettings(); };
  document.getElementById('setMusic').onchange = e => { settings.music = e.target.checked; saveSettings(); };
  document.getElementById('setRelax').onchange = e => { settings.relaxed = e.target.checked; saveSettings(); };
  document.getElementById('setCalm').onchange = e => { settings.calm = e.target.checked; saveSettings(); seedScene(); };
}

/* ============================== events ============================== */
async function copy(text){ try{ await navigator.clipboard.writeText(text); toast('Copied'); }catch(e){ toast('Select the text to copy it'); } }
let leaveArmed = 0;
document.addEventListener('pointerdown', () => { if (ac()) ambience(); }, {once:true});
document.addEventListener('keydown', () => { if (ac()) ambience(); }, {once:true});
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const a = el.dataset.act;
  if (a.startsWith('save')) return saveAction(a, el);
  if (busy && !['closeModal','help','settings','faq'].includes(a)) return;
  if (S.phase === 'answering' && a === 'home'){ if (Date.now() - leaveArmed > 2500){ leaveArmed = Date.now(); toast('Tap again to abandon the dive'); return; } }
  const deep = S.screen === 'dive' || S.screen === 'endless' || S.screen === 'endlessResults' || world.s > .5;
  switch (a){
    case 'home': return deep ? ascendTo(renderHome) : slide(renderHome);
    case 'help': return helpModal();
    case 'faq': return faqModal();
    case 'settings': return settingsModal();
    case 'closeModal': sfx.click(); return el.closest('.modal').remove();
    case 'startDaily': return startDive('daily', todayNum());
    case 'startUnl': return startDive('unlimited', store.get('unl', {next:1}).next);
    case 'nextUnl': return startDive('unlimited', S.num + 1);
    case 'jumpUnl': { const v = parseInt(document.getElementById('jump').value, 10); if (v > 0) return startDive('unlimited', v); return toast('Enter a game number'); }
    case 'packs': return slide(renderPacks);
    case 'pack': return startDive('pack', store.get('pack-' + el.dataset.k, {next:1}).next, el.dataset.k);
    case 'nextPack': return startDive('pack', S.num + 1, S.pack);
    case 'archive': return slide(renderArchive);
    case 'arch': return startDive('daily', parseInt(el.dataset.n, 10));
    case 'stats': return slide(renderStats);
    case 'codex': return deep ? ascendTo(renderCodex) : slide(renderCodex);
    case 'cxpack': codexFilter.pack = el.dataset.k; sfx.click(); return renderCodex();
    case 'cxprompt': return slide(() => renderCodexPrompt(el.dataset.id));
    case 'cxentry': sfx.click(); return openEntry(el.dataset.id, el.dataset.k);
    case 'pass': return S.screen === 'dive' && endRound(null, '', 'pass');
    case 'next': return nextRound();
    case 'copyShare': return copy(shareText());
    case 'startEndless': return startEndless();
    case 'ePass': return eEnd(null, '', 'pass');
    case 'eNext': if (busy) return; S.idx++; sfx.click(); return leave('fade', 540).then(endlessRound);
    case 'eResults': return endlessToResults();
    case 'copyEndless': return copy(S.share);
    case 'resetStats': { if (el.dataset.sure){ store.set('stats', {}); toast('Stats reset'); return renderStats(); } el.dataset.sure = '1'; el.textContent = 'Tap again to confirm'; return; }
  }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape'){ const m = document.querySelector('.modal'); if (m) return m.remove(); }
  if (skipFn && (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape')){ e.preventDefault(); skipFn(); }
});

/* ============================== boot ============================== */
function route(){
  const h = location.hash.replace('#', ''); let m;
  const deepStart = () => { world.s = 1.45; world.lastS = 1.45; };
  if (h === 'daily'){ deepStart(); return startDive('daily', todayNum(), null, true); }
  if ((m = h.match(/^game-(\d+)$/))){ deepStart(); return startDive('unlimited', +m[1], null, true); }
  if ((m = h.match(/^archive-(\d+)$/)) && +m[1] >= 1 && +m[1] <= todayNum()){ deepStart(); return startDive('daily', +m[1], null, true); }
  if ((m = h.match(/^pack-([a-z]+)-(\d+)$/)) && PACKS[m[1]]){ deepStart(); return startDive('pack', +m[2], m[1], true); }
  if (h === 'packs') return renderPacks();
  if (h === 'archive') return renderArchive();
  if (h === 'my-seadragon') return renderStats();
  if (h === 'codex') return renderCodex();
  if ((m = h.match(/^codex-(.+)$/)) && BYID[m[1]]) return renderCodexPrompt(m[1]);
  renderHome();
}
function boot(){
  DB = JSON.parse(document.getElementById('db').textContent);
  BYID = Object.fromEntries(DB.map(p => [p.id, p]));
  try{ SCHED = JSON.parse(document.getElementById('sched').textContent); }catch(e){ SCHED = []; }
  setCommon(document.getElementById('common').textContent);
  repairSave(); initSky(); backfillFound(); saveSettings(); resize(); addEventListener('resize', resize);
  requestAnimationFrame(frame);
  const wait = Math.max(0, (calm() ? 600 : BOOT_MS) - (performance.now() - BOOT_T0));
  setTimeout(() => { route(); document.getElementById('loader').classList.add('gone'); setTimeout(() => { const l = document.getElementById('loader'); if (l) l.remove(); }, 1700); }, wait);
}
document.getElementById('loaderFact').textContent = FACTS[Math.floor(Math.random() * FACTS.length)];
setTimeout(boot, 30);
