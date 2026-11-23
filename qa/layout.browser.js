// Mobile emulation zooms out to fit wide content (innerWidth grows), so measure against the device width.
function VW() { return Math.min(window.innerWidth, (window.screen && window.screen.width) || window.innerWidth); }
function VH() { return Math.min(window.innerHeight, (window.screen && window.screen.height) || window.innerHeight); }
function layoutCheck() {
  const vw = VW();
  const issues = [];
  const desc = (el) => {
    const h = el;
    const t = (h.innerText || h.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim().slice(0, 40);
    const cls = typeof h.className === "string" ? h.className.split(" ").filter(Boolean).slice(0, 2).join(".") : "";
    return `${el.tagName.toLowerCase()}${cls ? "." + cls : ""}${h.dataset?.testid ? `[${h.dataset.testid}]` : ""} "${t}"`;
  };
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    for (let p = el; p; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) === 0) return false;
    }
    return true;
  };
  const clipRect = (el) => {
    const r = el.getBoundingClientRect();
    let x1 = r.left, y1 = r.top, x2 = r.right, y2 = r.bottom;
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (/(auto|scroll|hidden|clip)/.test(cs.overflowX + " " + cs.overflowY)) {
        const pr = p.getBoundingClientRect();
        if (/(auto|scroll|hidden|clip)/.test(cs.overflowX)) {
          x1 = Math.max(x1, pr.left);
          x2 = Math.min(x2, pr.right);
        }
        if (/(auto|scroll|hidden|clip)/.test(cs.overflowY)) {
          y1 = Math.max(y1, pr.top);
          y2 = Math.min(y2, pr.bottom);
        }
      }
    }
    return { x1, y1, x2, y2, w: x2 - x1, h: y2 - y1 };
  };
  const modals = [...document.querySelectorAll(".modal")];
  const scope = modals.length ? modals[modals.length - 1] : document;
  const inter = [...scope.querySelectorAll("button, a[href], input, select, [role=button], .relic[tabindex], .card")].filter(visible).map((el) => ({ el, r: clipRect(el) })).filter((x) => x.r.w > 1 && x.r.h > 1);
  for (let i = 0; i < inter.length; i++) {
    for (let j = i + 1; j < inter.length; j++) {
      const a = inter[i], b = inter[j];
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
      const w = Math.min(a.r.x2, b.r.x2) - Math.max(a.r.x1, b.r.x1);
      const h = Math.min(a.r.y2, b.r.y2) - Math.max(a.r.y1, b.r.y1);
      if (w > 2 && h > 2) issues.push({ type: "overlap", detail: `${desc(a.el)} \u2A2F ${desc(b.el)} (${Math.round(w)}x${Math.round(h)})` });
    }
  }
  const boxSel = "button, a, .card, .sheet, .enemy, .intent, .relic, .pills span, .node, .log, .gauge, article, .coach, .hp";
  const walker = document.createTreeWalker(scope === document ? document.body : scope, NodeFilter.SHOW_TEXT);
  const seen = /* @__PURE__ */ new Set();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.textContent || !n.textContent.trim()) continue;
    const parent = n.parentElement;
    if (!parent || !visible(parent) || parent.closest(".tip-bubble, svg")) continue;
    const range = document.createRange();
    range.selectNodeContents(n);
    const tr = range.getBoundingClientRect();
    if (tr.width < 1) continue;
    const box = parent.closest(boxSel);
    if (box && !seen.has(box) && !/(auto|scroll)/.test(getComputedStyle(box).overflowY + getComputedStyle(box).overflowX)) {
      const br = box.getBoundingClientRect();
      const out = Math.max(br.left - tr.left, tr.right - br.right, br.top - tr.top, tr.bottom - br.bottom);
      if (out > 2) {
        seen.add(box);
        issues.push({ type: "text-outside-box", detail: `${desc(box)} by ${Math.round(out)}px` });
      }
    }
    const holder = parent;
    const cs = getComputedStyle(holder);
    if (!seen.has(holder) && holder.clientWidth > 0 && holder.scrollWidth > holder.clientWidth + 1 && !/(auto|scroll)/.test(cs.overflowX)) {
      seen.add(holder);
      issues.push({ type: "text-overflow", detail: `${desc(holder)} scroll ${holder.scrollWidth} > ${holder.clientWidth}` });
    }
    const clip = clipRect(parent);
    const cut = tr.right > vw + 1 && clip.x2 >= vw - 1;
    if (cut) issues.push({ type: "text-offscreen", detail: `${desc(parent)} right=${Math.round(tr.right)}` });
  }
  const sw = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
  if (sw > vw + 1) {
    const culprits = [...document.querySelectorAll("body *")].filter((el) => visible(el) && el.getBoundingClientRect().right > vw + 1 && clipRect(el).x2 > vw + 1).slice(-3).map(desc);
    issues.push({ type: "h-scroll", detail: `page ${sw}px > ${vw}px; ${culprits.join(" | ")}` });
  }
  for (const { el, r } of inter) {
    if (r.x2 > vw + 1 || r.x1 < -1) issues.push({ type: "offscreen", detail: `${desc(el)} x=${Math.round(r.x1)}..${Math.round(r.x2)}` });
  }
  return issues;
}


function mapCheck() {
  const issues = [];
  const svg = document.querySelector('svg.map');
  if (!svg) return issues;
  const vb = svg.viewBox.baseVal; const r = svg.getBoundingClientRect();
  const sx = r.width / vb.width, sy = r.height / vb.height;
  for (const n of document.querySelectorAll('.node')) {
    const st = n.style; const x = st.left.endsWith('%') ? parseFloat(st.left) / 100 * vb.width : parseFloat(st.left); const y = parseFloat(st.top);
    const br = n.getBoundingClientRect();
    const cx = br.left + br.width / 2, cy = br.top + br.height / 2;
    const ex = r.left + x * sx, ey = r.top + y * sy;
    const d = Math.hypot(cx - ex, cy - ey);
    if (d > 6) { issues.push({ type: 'map-misaligned', detail: `node ${n.innerText.trim()} off its line end by ${Math.round(d)}px` }); break; }
  }
  return issues;
}
function cardCheck() {
  const issues = [];
  for (const c of document.querySelectorAll('.card')) {
    const r = c.getBoundingClientRect();
    if (r.width > 1 && r.width < 110) { issues.push({ type: 'card-squeezed', detail: `card ${c.dataset.card} width ${Math.round(r.width)}` }); break; }
  }
  return issues;
}


function hintCheck() {
  const issues = [];
  const b = document.querySelector('.coach-bubble');
  if (!b) return issues;
  const r = b.getBoundingClientRect();
  if (r.left < 0 || r.right > VW() + 1) issues.push({ type: 'hint-offscreen', detail: `bubble x=${Math.round(r.left)}..${Math.round(r.right)}` });
  for (const el of document.querySelectorAll('button, a[href], input, select, [role=button], .card, .relic, .node')) {
    if (b.contains(el)) continue;
    const e = el.getBoundingClientRect();
    if (e.width < 1 || e.height < 1) continue;
    const w = Math.min(r.right, e.right) - Math.max(r.left, e.left);
    const h = Math.min(r.bottom, e.bottom) - Math.max(r.top, e.top);
    if (w > 0 && h > 0) issues.push({ type: 'hint-overlap', detail: `bubble covers ${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} "${(el.innerText || '').trim().slice(0, 30)}"` });
  }
  const ring = document.querySelector('.coach-ring');
  if (ring) {
    const q = ring.getBoundingClientRect();
    const w = Math.min(r.right, q.right) - Math.max(r.left, q.left);
    const h = Math.min(r.bottom, q.bottom) - Math.max(r.top, q.top);
    if (w > 0 && h > 0) issues.push({ type: 'hint-overlap', detail: 'bubble covers the highlighted element' });
  }
  return issues;
}

function parseColor(s) {
  const m = /rgba?\(([^)]+)\)/.exec(s || '');
  if (!m) return null;
  const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number);
  return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
}
function blend(top, under) {
  const a = top.a;
  return { r: top.r * a + under.r * (1 - a), g: top.g * a + under.g * (1 - a), b: top.b * a + under.b * (1 - a), a: 1 };
}
function lum(c) {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
}
function bgOf(el) {
  const INK = { r: 7, g: 16, b: 20, a: 1 };
  const layers = [];
  let e = el;
  while (e && e !== document.body && e !== document.documentElement) {
    const cs = getComputedStyle(e);
    if (cs.backgroundImage && cs.backgroundImage !== 'none') return null; // gradients/art: not measurable here
    const c = parseColor(cs.backgroundColor);
    if (c && c.a >= 0.95) { layers.push(c); break; }
    if (c && c.a > 0.02) layers.push(c);
    e = e.parentElement;
  }
  let base = layers.length && layers[layers.length - 1].a >= 0.95 ? layers.pop() : INK;
  while (layers.length) base = blend(layers.pop(), base);
  return base;
}
/** WCAG AA text contrast on solid backgrounds (4.5:1, or 3:1 for large text). */
function contrastCheck() {
  const issues = [];
  const seen = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walker.nextNode())) {
    if (!n.textContent.trim()) continue;
    const el = n.parentElement;
    if (!el || seen.has(el)) continue;
    seen.add(el);
    if (el.closest('[aria-hidden=true], :disabled, .card, svg')) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || Number(cs.opacity) < 0.5) continue;
    const bg = bgOf(el);
    if (!bg) continue;
    let fg = parseColor(cs.color);
    if (!fg) continue;
    if (fg.a < 1) fg = blend(fg, bg);
    const L1 = lum(fg), L2 = lum(bg);
    const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const size = parseFloat(cs.fontSize);
    const large = size >= 24 || (size >= 18.6 && Number(cs.fontWeight) >= 700);
    if (ratio < (large ? 3 : 4.5)) {
      issues.push({ type: 'contrast', detail: `${ratio.toFixed(2)}:1 "${n.textContent.trim().slice(0, 30)}"` });
      if (issues.length >= 3) break;
    }
  }
  return issues;
}
/** Mobile combat: the hand and End turn must be on the first screen; the tide choice must not hide the gauge. */
function mobileCombatCheck() {
  const issues = [];
  if (VW() > 600) return issues;
  const app = document.querySelector('[data-screen=combat]');
  if (!app) return issues;
  const end = document.querySelector('[data-testid=end-turn]');
  if (end && !document.querySelector('.modal')) {
    const r = end.getBoundingClientRect();
    if (r.bottom > VH() + 1) issues.push({ type: 'combat-fold', detail: `End turn at y=${Math.round(r.top)} below the ${VH()}px screen` });
    const card = document.querySelector('.hand .card');
    if (card && card.getBoundingClientRect().top > VH()) issues.push({ type: 'combat-fold', detail: 'hand starts below the first screen' });
  }
  const choice = document.querySelector('[data-testid=tide-choice] .sheet');
  const gauge = document.querySelector('[data-testid=tide]');
  if (choice && gauge) {
    const a = choice.getBoundingClientRect(), b = gauge.getBoundingClientRect();
    const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
    const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    if (w > 0 && h > 0) issues.push({ type: 'modal-covers-gauge', detail: 'tide choice sheet covers the tide gauge' });
  }
  return issues;
}
