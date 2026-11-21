// 複数枚のベース画像を取り込み、水平または垂直方向へ結合して1枚のベース画像にするモジュール
import { loadImageAsync } from './project-io.js';

// 各画像の配置座標と出力キャンバス全体の寸法を計算する（純粋関数）
export function computeMergeLayout(entries, {
  direction = 'horizontal',
  uniformCell = false,
  align = 'start',
  gap = 0
} = {}) {
  const list = Array.isArray(entries) ? entries.filter(Boolean) : [];
  if (list.length === 0) return { width: 0, height: 0, placements: [] };

  const safeGap = Math.max(0, Math.min(512, parseInt(gap, 10) || 0));
  const maxW = Math.max(1, ...list.map(e => Math.max(1, e.width || e.img?.naturalWidth || e.img?.width || 1)));
  const maxH = Math.max(1, ...list.map(e => Math.max(1, e.height || e.img?.naturalHeight || e.img?.height || 1)));
  const isVert = direction === 'vertical';

  let cursor = 0;
  const placements = list.map((e, idx) => {
    const w = Math.max(1, e.width || e.img?.naturalWidth || e.img?.width || 1);
    const h = Math.max(1, e.height || e.img?.naturalHeight || e.img?.height || 1);
    const slotW = isVert ? maxW : (uniformCell ? maxW : w);
    const slotH = isVert ? (uniformCell ? maxH : h) : maxH;
    const slotX = isVert ? 0 : cursor;
    const slotY = isVert ? cursor : 0;

    let dx = slotX;
    let dy = slotY;
    if (align === 'center') {
      dx = slotX + Math.floor((slotW - w) / 2);
      dy = slotY + Math.floor((slotH - h) / 2);
    } else if (align === 'end') {
      dx = slotX + (slotW - w);
      dy = slotY + (slotH - h);
    }

    cursor += (isVert ? slotH : slotW) + (idx < list.length - 1 ? safeGap : 0);
    return { entry: e, dx, dy, width: w, height: h, slotX, slotY, slotW, slotH };
  });

  const width = isVert ? maxW : cursor;
  const height = isVert ? cursor : maxH;
  return { width, height, placements };
}

function entryHasTransparency(entry, createCanvas) {
  const w = entry.width || entry.img?.naturalWidth || entry.img?.width || 0;
  const h = entry.height || entry.img?.naturalHeight || entry.img?.height || 0;
  if (!w || !h || !entry.img) return false;
  const c = createCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.drawImage(entry.img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 255) return true;
  }
  return false;
}

// 複数枚の画像を水平・垂直方向へ結合した Canvas を生成する
export function mergeBaseImages(entries, opts = {}, createCanvas = null) {
  const makeCanvas = createCanvas || ((w, h) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  });

  const layout = computeMergeLayout(entries, opts);
  if (layout.width <= 0 || layout.height <= 0) return null;

  const bgMode = opts.bgMode || 'auto';
  const useTransparentBg = bgMode === 'transparent'
    || (bgMode === 'auto' && entries.some(e => entryHasTransparency(e, makeCanvas)));

  const out = makeCanvas(layout.width, layout.height);
  const ctx = out.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  if (!useTransparentBg) {
    ctx.fillStyle = '#E7FFFF';
    ctx.fillRect(0, 0, layout.width, layout.height);
  }

  for (const p of layout.placements) {
    ctx.drawImage(p.entry.img, p.dx, p.dy, p.width, p.height);
  }
  return out;
}

export class BaseMergeController {
  constructor(app, pickFilesFn) {
    this.app = app;
    this.pickFilesFn = pickFilesFn;
    this.entries = [];
  }

  bindEvents() {
    document.getElementById('btn-merge-bases')?.addEventListener('click', () => this.open());
  }

  _ensureModal() {
    if (document.getElementById('modal-merge-bases')) return;
    const container = document.getElementById('modal-container') || document.body;
    container.insertAdjacentHTML('beforeend', `
      <dialog id="modal-merge-bases">
        <div class="picker-content" style="width:460px; max-width:90vw;">
          <h3 style="font-size:13px; margin-bottom:2px;">🧩 複数ベース画像の結合読込</h3>
          <p class="desc-text">複数枚のベースPNGを取り込み、水平方向または垂直方向に並べて1枚のベース画像として開きます。</p>
          <div class="btn-group">
            <button type="button" id="btn-mb-add-files" class="btn-primary">＋ 画像を選択 (複数可)</button>
            <button type="button" id="btn-mb-add-current">＋ 現在のベース</button>
            <button type="button" id="btn-mb-clear">🗑️ 空にする</button>
          </div>
          <div id="merge-base-list" class="merge-base-list"></div>
          <div class="row mt-05">
            <label style="width:82px;">結合方向:</label>
            <select id="sel-mb-direction">
              <option value="horizontal" selected>水平方向 (横並び →)</option>
              <option value="vertical">垂直方向 (縦並び ↓)</option>
            </select>
          </div>
          <div class="row">
            <label style="width:82px;">配置揃え:</label>
            <select id="sel-mb-align">
              <option value="start" selected>左上揃え (上 / 左端)</option>
              <option value="center">中央揃え</option>
              <option value="end">右下揃え (下 / 右端)</option>
            </select>
          </div>
          <div class="row">
            <label style="width:82px;">余白背景:</label>
            <select id="sel-mb-bg">
              <option value="auto" selected>自動 (#E7FFFF / 透過画像時は透明維持)</option>
              <option value="e7ffff">#E7FFFF (Simutrans透過色)</option>
              <option value="transparent">完全透明 (32bit RGBA α=0)</option>
            </select>
          </div>
          <div class="row">
            <label style="width:82px;">間隔 (px):</label>
            <input type="number" id="inp-mb-gap" value="0" min="0" max="512" style="width:65px; background:#1a1a1a; border:1px solid #444; color:#eee; padding:3px 5px; border-radius:3px;">
            <label style="display:flex; align-items:center; gap:4px; margin-left:8px; cursor:pointer;">
              <input type="checkbox" id="chk-mb-uniform"> 最大枠サイズで均等配置
            </label>
          </div>
          <div class="row">
            <label style="width:82px;">出力ベース名:</label>
            <input type="text" id="inp-mb-name" value="merged_base.png" placeholder="merged_base.png">
          </div>
          <div class="info-text" id="lbl-mb-summary" style="color:#8fd3ff; font-weight:bold;">結合対象: 0枚 (画像を選択してください)</div>
          <div class="btn-group mt-05">
            <button type="button" id="btn-mb-apply" class="btn-primary">✓ 結合してベース画像として開く</button>
            <button type="button" id="btn-mb-cancel">キャンセル</button>
          </div>
        </div>
      </dialog>
    `);
    this._bindModalEvents();
  }

  _bindModalEvents() {
    const modal = document.getElementById('modal-merge-bases');
    if (!modal || modal.dataset.bound === '1') return;
    modal.dataset.bound = '1';

    document.getElementById('btn-mb-add-files').onclick = async () => {
      const files = this.pickFilesFn ? await this.pickFilesFn('.png,image/*') : [];
      if (files.length > 0) await this.addFiles(files);
    };
    document.getElementById('btn-mb-add-current').onclick = () => this.addCurrentBase();
    document.getElementById('btn-mb-clear').onclick = () => { this.entries = []; this.refreshUI(); };

    ['sel-mb-direction', 'sel-mb-align', 'sel-mb-bg', 'inp-mb-gap', 'chk-mb-uniform'].forEach(id => {
      document.getElementById(id)?.addEventListener('change', () => this._updateSummary());
      document.getElementById(id)?.addEventListener('input', () => this._updateSummary());
    });
    document.getElementById('inp-mb-name')?.addEventListener('input', (e) => {
      e.target.dataset.userEdited = '1';
    });

    const listEl = document.getElementById('merge-base-list');
    listEl?.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
    listEl?.addEventListener('drop', async (e) => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer?.files || []).filter(f => f.type?.startsWith('image/') || /\.(png|bmp|gif|webp)$/i.test(f.name));
      if (files.length > 0) await this.addFiles(files);
    });

    document.getElementById('btn-mb-apply').onclick = () => this.applyMerge();
    document.getElementById('btn-mb-cancel').onclick = () => modal.close();
  }

  open() {
    this._ensureModal();
    this.refreshUI();
    const modal = document.getElementById('modal-merge-bases');
    if (typeof modal.showModal === 'function') modal.showModal();
    else modal.setAttribute('open', '');
  }

  async addFiles(files) {
    for (const file of files) {
      const url = URL.createObjectURL(file);
      try {
        const img = await loadImageAsync(url);
        this.entries.push({
          name: file.name,
          img,
          width: img.naturalWidth || img.width,
          height: img.naturalHeight || img.height
        });
      } finally {
        URL.revokeObjectURL(url);
      }
    }
    this._suggestOutputName();
    this.refreshUI();
  }

  addCurrentBase() {
    const app = this.app;
    if (!app.baseImage || !app.baseW || !app.baseH) {
      alert('現在開いているベース画像がありません。');
      return;
    }
    this.entries.push({
      name: app.baseName || 'base.png',
      img: app.baseImage,
      width: app.baseW,
      height: app.baseH
    });
    this._suggestOutputName();
    this.refreshUI();
  }

  _suggestOutputName() {
    const inp = document.getElementById('inp-mb-name');
    if (!inp || inp.dataset.userEdited || this.entries.length === 0) return;
    const head = (this.entries[0].name || 'base').replace(/\.png$/i, '');
    inp.value = `${head}_merged.png`;
  }

  _readOptions() {
    return {
      direction: document.getElementById('sel-mb-direction')?.value || 'horizontal',
      align: document.getElementById('sel-mb-align')?.value || 'start',
      bgMode: document.getElementById('sel-mb-bg')?.value || 'auto',
      gap: parseInt(document.getElementById('inp-mb-gap')?.value, 10) || 0,
      uniformCell: Boolean(document.getElementById('chk-mb-uniform')?.checked)
    };
  }

  _updateSummary() {
    const lbl = document.getElementById('lbl-mb-summary');
    if (!lbl) return;
    if (this.entries.length === 0) {
      lbl.textContent = '結合対象: 0枚 (画像を選択またはドラッグ＆ドロップしてください)';
      return;
    }
    const { width, height } = computeMergeLayout(this.entries, this._readOptions());
    lbl.textContent = `結合後サイズ: ${width} × ${height} px (${this.entries.length}枚)`;
  }

  refreshUI() {
    const listEl = document.getElementById('merge-base-list');
    if (listEl) {
      listEl.innerHTML = '';
      if (this.entries.length === 0) {
        listEl.innerHTML = '<div class="info-text" style="text-align:center; padding:12px 0;">ここに画像をドラッグ＆ドロップするか、「＋ 画像を選択」を押してください</div>';
      } else {
        this.entries.forEach((entry, idx) => {
          const row = document.createElement('div');
          row.className = 'merge-base-row';
          row.innerHTML = `<span class="mb-name" title="${entry.name}">${idx + 1}. ${entry.name}</span><span class="mb-size">${entry.width}×${entry.height}</span>`;
          const mkBtn = (txt, title, fn, disabled = false) => {
            const b = document.createElement('button');
            b.type = 'button'; b.textContent = txt; b.title = title; b.disabled = disabled;
            b.onclick = () => { fn(); this.refreshUI(); };
            return b;
          };
          row.appendChild(mkBtn('↑', '上へ', () => {
            [this.entries[idx - 1], this.entries[idx]] = [this.entries[idx], this.entries[idx - 1]];
          }, idx === 0));
          row.appendChild(mkBtn('↓', '下へ', () => {
            [this.entries[idx], this.entries[idx + 1]] = [this.entries[idx + 1], this.entries[idx]];
          }, idx === this.entries.length - 1));
          row.appendChild(mkBtn('✕', '削除', () => { this.entries.splice(idx, 1); }));
          listEl.appendChild(row);
        });
      }
    }
    const curBtn = document.getElementById('btn-mb-add-current');
    if (curBtn) curBtn.disabled = !this.app?.baseImage;
    this._updateSummary();
  }

  applyMerge() {
    if (this.entries.length === 0) {
      alert('結合するベース画像を1枚以上選択してください。');
      return;
    }
    const opts = this._readOptions();
    const out = mergeBaseImages(this.entries, opts);
    if (!out) return;

    const rawName = (document.getElementById('inp-mb-name')?.value || 'merged_base.png').trim();
    const outName = rawName.toLowerCase().endsWith('.png') ? rawName : `${rawName}.png`;
    const reset = !document.getElementById('chk-keep-state-on-base-load')?.checked;

    this.app.applyBaseImage(out, outName, {
      resetMask: reset,
      resetDat: reset,
      reason: `複数ベース結合 (${this.entries.length}枚)`
    });
    this.app.isDirty = true;
    this.app.zoomFit();
    this.app.render();
    document.getElementById('modal-merge-bases')?.close();
  }
}
