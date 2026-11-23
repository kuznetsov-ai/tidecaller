function layoutCheck() {
  const vw = window.innerWidth;
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

