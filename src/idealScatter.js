/**
 * Shared Ideal Point scatter (notebook axes).
 * X = gauche → droite · Y élevé (RDPI / loin) en haut du canvas.
 */

import { t, onLangChange, getLang } from './i18n.js';

export const PARTY_ORDER = ['CRC', 'GEST', 'SOC', 'RDSE', 'LREM', 'NI', 'UC', 'RTLI', 'UMP'];

export const PARTY_SHORT = {
  CRC: 'CRCE-K',
  GEST: 'GEST',
  SOC: 'SER',
  RDSE: 'RDSE',
  LREM: 'RDPI',
  NI: 'NI',
  UC: 'UC',
  RTLI: 'Indép.',
  UMP: 'LR',
};

export function partyKey(senator) {
  if (senator?.groupe_code) return senator.groupe_code;
  if (PARTY_ORDER.includes(senator?.party)) return senator.party;
  return senator?.party || '';
}

function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, rr);
    return;
  }
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function normalizeSenator(raw) {
  const party =
    raw.groupe_libelle ||
    raw.party ||
    raw.parti ||
    raw.groupe ||
    raw.groupe_code ||
    'Groupe inconnu';
  return {
    ...raw,
    id: raw.id ?? '',
    name: raw.name || [raw.prenom, raw.nom].filter(Boolean).join(' ') || 'Sans nom',
    party,
    partyColor: raw.partyColor || raw.party_color || '#8c1a28',
    idealX: Number(raw.idealX),
    idealY: Number(raw.idealY),
  };
}

/**
 * Load `/assets/senators.json` (same source as the live app).
 * @returns {Promise<{ senators: object[], groupColors: Record<string,string>, meta: object|null }>}
 */
export async function loadScatterSenators(url = '/assets/senators.json') {
  const res = await fetch(`${url}?t=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Impossible de charger ${url}`);
  const data = await res.json();
  const list = Array.isArray(data) ? data : data.senators;
  if (!Array.isArray(list) || !list.length) throw new Error('senators.json vide');
  return {
    senators: list.map(normalizeSenator),
    groupColors: data.groupColors || {},
    meta: data.meta || null,
  };
}

/**
 * Fill an optional HTML legend (`<ul>`) with party swatches.
 */
export function fillIdealLegend(legendEl, senators, groupColors = {}) {
  if (!legendEl || !senators?.length) return;
  const parties = PARTY_ORDER.filter((p) => senators.some((s) => partyKey(s) === p));
  legendEl.innerHTML = parties
    .map((p) => {
      const sample = senators.find((s) => partyKey(s) === p);
      const color = groupColors[p] || sample?.partyColor || '#888';
      const label = PARTY_SHORT[p] || sample?.partyLabel || p;
      return `<li><span class="swatch" style="background:${color}"></span>${label}</li>`;
    })
    .join('');
}

/**
 * Draw the Ideal Point cloud onto a canvas.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {object[]} senators
 * @param {object} [opts]
 * @param {object|null} [opts.selected] — highlight a senator (panel)
 * @param {Record<string,string>} [opts.groupColors]
 * @param {HTMLElement|null} [opts.legendEl]
 * @param {boolean} [opts.compact] — denser padding / smaller dots (intro)
 * @param {number} [opts.aspect] — height/width ratio (default 0.75)
 * @param {number} [opts.pointRadius]
 * @param {number} [opts.cornerRadius]
 * @param {boolean} [opts.drawBackground]
 */
export function drawIdealScatter(canvas, senators, opts = {}) {
  if (!canvas || !senators?.length) return;

  const {
    selected = null,
    groupColors = {},
    legendEl = null,
    compact = false,
    aspect = 0.75,
    pointRadius = compact ? 2.35 : 3.2,
    cornerRadius = compact ? 6 : 8,
    drawBackground = true,
  } = opts;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  /* Layout width only — never use canvas.width / getAttribute('width').
     Those are *bitmap* pixels (× dpr). Math.max’ing them with ResizeObserver
     causes exponential size runaway on Retina and a blank intro canvas. */
  const parentW = canvas.parentElement?.clientWidth || 0;
  const cssW =
    canvas.clientWidth ||
    parentW ||
    (compact ? 240 : 280);
  const cssH = Math.round(cssW * aspect);
  canvas.style.width = '100%';
  canvas.style.height = `${cssH}px`;
  const bw = Math.round(cssW * dpr);
  const bh = Math.round(cssH * dpr);
  if (canvas.width !== bw) canvas.width = bw;
  if (canvas.height !== bh) canvas.height = bh;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const W = cssW;
  const H = cssH;

  const pad = compact
    ? { l: 30, r: 10, t: 12, b: 26 }
    : { l: 42, r: 16, t: 18, b: 36 };
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;

  const xs = senators.map((s) => Number(s.idealX) || 0);
  const ys = senators.map((s) => Number(s.idealY) || 0);
  let minX = Math.min(...xs);
  let maxX = Math.max(...xs);
  let minY = Math.min(...ys);
  let maxY = Math.max(...ys);
  const dx = maxX - minX || 1;
  const dy = maxY - minY || 1;
  minX -= dx * 0.06;
  maxX += dx * 0.06;
  minY -= dy * 0.08;
  maxY += dy * 0.08;

  /* Axes UI: X gauche→droite ; Y élevé (RDPI / loin) en HAUT */
  const xOf = (x) => pad.l + ((x - minX) / (maxX - minX)) * plotW;
  const yOf = (y) => pad.t + ((maxY - y) / (maxY - minY)) * plotH;

  ctx.clearRect(0, 0, W, H);

  if (drawBackground) {
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, 'rgba(22, 22, 25, 0.96)');
    bg.addColorStop(1, 'rgba(8, 8, 10, 0.99)');
    ctx.fillStyle = bg;
    roundRectPath(ctx, 0, 0, W, H, cornerRadius);
    ctx.fill();
  }

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.075)';
  ctx.lineWidth = 1;
  const gridN = compact ? 3 : 4;
  for (let i = 0; i <= gridN; i++) {
    const gx = pad.l + (plotW * i) / gridN;
    const gy = pad.t + (plotH * i) / gridN;
    ctx.beginPath();
    ctx.moveTo(gx, pad.t);
    ctx.lineTo(gx, pad.t + plotH);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(pad.l, gy);
    ctx.lineTo(pad.l + plotW, gy);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.beginPath();
  ctx.moveTo(pad.l, pad.t);
  ctx.lineTo(pad.l, pad.t + plotH);
  ctx.lineTo(pad.l + plotW, pad.t + plotH);
  ctx.stroke();

  const labelSize = compact ? 8.5 : 10;
  const sideSize = compact ? 8 : 9;
  ctx.fillStyle = 'rgba(245, 245, 247, 0.5)';
  ctx.font = `500 ${labelSize}px -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(t('scatter.left'), pad.l + (compact ? 22 : 28), H - (compact ? 8 : 10));
  ctx.fillText(t('scatter.right'), pad.l + plotW - (compact ? 22 : 28), H - (compact ? 8 : 10));
  if (!compact) {
    ctx.fillText('Ideal X', pad.l + plotW / 2, H - 10);
  }
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(143, 199, 232, 0.72)';
  ctx.font = `500 ${sideSize}px -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif`;
  ctx.fillText(compact ? t('scatter.top') : t('scatter.topFull'), pad.l + 4, pad.t + (compact ? 9 : 11));
  ctx.fillText(compact ? t('scatter.bottom') : t('scatter.bottomFull'), pad.l + 4, pad.t + plotH - (compact ? 3 : 4));

  const selectedId = selected?.id;
  const others = selectedId ? senators.filter((s) => s.id !== selectedId) : senators;
  for (const s of others) {
    const px = xOf(Number(s.idealX) || 0);
    const py = yOf(Number(s.idealY) || 0);
    ctx.beginPath();
    ctx.fillStyle = s.partyColor || '#888';
    ctx.globalAlpha = compact ? 0.82 : 0.78;
    ctx.arc(px, py, pointRadius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  if (selected) {
    const px = xOf(Number(selected.idealX) || 0);
    const py = yOf(Number(selected.idealY) || 0);
    const col = selected.partyColor || '#c9a27a';

    ctx.beginPath();
    ctx.strokeStyle = 'rgba(245, 245, 247, 0.95)';
    ctx.lineWidth = 2.5;
    ctx.arc(px, py, 11, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.strokeStyle = col;
    ctx.lineWidth = 2;
    ctx.arc(px, py, 14.5, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.fillStyle = col;
    ctx.arc(px, py, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.fillStyle = '#f5f5f7';
    ctx.arc(px, py, 2.2, 0, Math.PI * 2);
    ctx.fill();

    const label = selected.name || t('scatter.senator');
    ctx.font = '600 12px -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif';
    const tw = ctx.measureText(label).width;
    let lx = px + 16;
    let ly = py - 10;
    if (lx + tw + 10 > W - 8) lx = px - tw - 16;
    if (ly < pad.t + 14) ly = py + 22;
    ctx.fillStyle = 'rgba(8, 8, 10, 0.9)';
    roundRectPath(ctx, lx - 6, ly - 13, tw + 12, 20, 4);
    ctx.fill();
    ctx.fillStyle = '#f5f5f7';
    ctx.textAlign = 'left';
    ctx.fillText(label, lx, ly);
  }

  if (legendEl) fillIdealLegend(legendEl, senators, groupColors);
}

/**
 * Bind a canvas to live senator data: draw after layout + on resize.
 * Returns a cleanup function.
 */
export function mountIdealScatter(canvas, senators, opts = {}) {
  if (!canvas || !senators?.length) return () => {};

  let cancelled = false;
  let lastKey = '';
  const draw = (force = false) => {
    if (cancelled) return;
    const w =
      canvas.clientWidth ||
      canvas.parentElement?.clientWidth ||
      0;
    const key = `${w}x${opts.aspect ?? 0.75}x${senators.length}x${getLang()}`;
    if (!force && w > 0 && key === lastKey && canvas.height > 0) return;
    drawIdealScatter(canvas, senators, opts);
    lastKey = `${canvas.clientWidth || w}x${opts.aspect ?? 0.75}x${senators.length}x${getLang()}`;
  };

  /* Layout may still be settling (intro animation) — paint, then repaint. */
  draw(true);
  requestAnimationFrame(() => {
    draw(true);
    requestAnimationFrame(() => draw(true));
  });

  let raf = 0;
  const schedule = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => draw(false));
  };
  const onWinResize = () => {
    lastKey = '';
    schedule();
  };
  window.addEventListener('resize', onWinResize);
  const unsubLang = onLangChange(() => {
    lastKey = '';
    draw(true);
  });
  const ro =
    typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => schedule())
      : null;
  /* Observe parent only — observing the canvas loops when we set style.height. */
  if (canvas.parentElement) ro?.observe(canvas.parentElement);
  else ro?.observe(canvas);

  return () => {
    cancelled = true;
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', onWinResize);
    unsubLang?.();
    ro?.disconnect();
  };
}
