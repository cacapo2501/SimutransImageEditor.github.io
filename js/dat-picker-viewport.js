// DAT画像ピッカーのキャンバス描画・ズーム・パン操作ヘルパー

export function buildPickerSourceCanvas(app, objType = null) {
  if (!app || !app.baseImage || !app.baseW || !app.baseH) return null;
  const c = document.createElement('canvas');
  c.width = app.baseW;
  c.height = app.baseH;
  const ctx = c.getContext('2d');
  const pixels = app.computeFinalImage();
  if (pixels) {
    ctx.putImageData(new ImageData(new Uint8ClampedArray(pixels), app.baseW, app.baseH), 0, 0);
  } else {
    ctx.drawImage(app.baseImage, 0, 0, app.baseW, app.baseH);
  }
  const isBld = objType === 'building' || objType === 'factory';
  if (isBld && app.tileCutter?.shouldCutOnExport?.()) {
    return app.tileCutter.cutCanvas(c);
  }
  return c;
}

export function guessInitialTileSize(w, h, objType, tileCutter = null) {
  const isBld = objType === 'building' || objType === 'factory';
  if (isBld && tileCutter?.shouldCutOnExport?.()) {
    return [tileCutter.tileSize, tileCutter.tileSize];
  }
  if (w === 768 && h % 96 === 0) return [96, 96];
  if (w >= 1024 && w % 128 === 0 && h % 128 === 0) return [128, 128];
  if (w % 64 === 0 && h % 64 === 0) return [64, 64];
  if (objType === 'building' && w % 4 === 0 && w >= 64) {
    const unit = Math.round(w / 4);
    if (unit >= 16 && unit <= 512) return [unit, unit];
  }
  return [64, 64];
}

export function bindPickerViewportEvents(picker, modal) {
  document.getElementById('btn-dat-picker-z-in')?.addEventListener('click', () => {
    picker.zoom = Math.min(16, picker.zoom * 1.25);
    picker._renderCanvas();
  });
  document.getElementById('btn-dat-picker-z-out')?.addEventListener('click', () => {
    picker.zoom = Math.max(0.2, picker.zoom * 0.8);
    picker._renderCanvas();
  });
  document.getElementById('btn-dat-picker-z-fit')?.addEventListener('click', () => picker.zoomFit());

  const canvas = document.getElementById('dat-picker-canvas');
  if (canvas) {
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const nextZ = Math.max(0.2, Math.min(16, picker.zoom * (e.deltaY < 0 ? 1.25 : 0.8)));
      picker.panX = cx - ((cx - picker.panX) / picker.zoom) * nextZ;
      picker.panY = cy - ((cy - picker.panY) / picker.zoom) * nextZ;
      picker.zoom = nextZ;
      picker._renderCanvas();
    }, { passive: false });

    canvas.addEventListener('mousedown', (e) => {
      picker.isPanning = true;
      picker.panMoved = false;
      picker.panStart = [e.clientX - picker.panX, e.clientY - picker.panY];
    });
    canvas.addEventListener('mouseleave', () => {
      if (picker.hoverCell) {
        picker.hoverCell = null;
        picker._renderCanvas();
      }
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  window.addEventListener('mousemove', (e) => {
    if (!modal?.open) return;
    if (picker.isPanning) {
      const nx = e.clientX - picker.panStart[0];
      const ny = e.clientY - picker.panStart[1];
      if (Math.hypot(nx - picker.panX, ny - picker.panY) > 4) picker.panMoved = true;
      if (e.buttons !== 1 || picker.panMoved) {
        picker.panX = nx;
        picker.panY = ny;
        picker._renderCanvas();
      }
      return;
    }
    if (e.target === canvas && picker.srcCanvas) {
      const rect = canvas.getBoundingClientRect();
      const ix = (e.clientX - rect.left - picker.panX) / picker.zoom;
      const iy = (e.clientY - rect.top - picker.panY) / picker.zoom;
      const next = (ix >= 0 && iy >= 0 && ix < picker.srcCanvas.width && iy < picker.srcCanvas.height)
        ? { row: Math.floor(iy / picker.tileH), col: Math.floor(ix / picker.tileW) }
        : null;
      const prev = picker.hoverCell;
      if ((prev?.row !== next?.row) || (prev?.col !== next?.col)) {
        picker.hoverCell = next;
        picker._renderCanvas();
      }
    }
  });

  window.addEventListener('mouseup', (e) => {
    if (!picker.isPanning) return;
    const wasClick = e.button === 0 && !picker.panMoved && modal?.open;
    picker.isPanning = false;
    if (wasClick && e.target === canvas) picker._handleCanvasClick(e.clientX, e.clientY);
  });
}

function shortenKeyTag(key) {
  const m = key.match(/^([A-Za-z0-9]+)(.*)$/);
  if (!m) return key;
  const head = m[1].startsWith('Empty') ? 'Emp' : m[1].startsWith('Freight') ? 'Frt' : m[1].startsWith('Back') ? 'Bk' : m[1].startsWith('Front') ? 'Fr' : m[1].slice(0, 4);
  return `${head}${m[2]}`;
}

// ピッカーキャンバス上のグリッド線・座標ラベル・割当セル・ホバー枠を描画する
export function drawDatPickerOverlay(ctx, { srcW, srcH, tileW, tileH, zoom, panX, panY, entries, otherEntries = [], mode, selectedKeyIdx, hoverCell }) {
  const cols = Math.max(1, Math.ceil(srcW / tileW));
  const rows = Math.max(1, Math.ceil(srcH / tileH));

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = 1;
  ctx.font = '10px Consolas, monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  for (let r = 0; r <= rows; r++) {
    const y = Math.round(panY + r * tileH * zoom) + 0.5;
    ctx.beginPath(); ctx.moveTo(panX, y); ctx.lineTo(panX + cols * tileW * zoom, y); ctx.stroke();
  }
  for (let c = 0; c <= cols; c++) {
    const x = Math.round(panX + c * tileW * zoom) + 0.5;
    ctx.beginPath(); ctx.moveTo(x, panY); ctx.lineTo(x, panY + rows * tileH * zoom); ctx.stroke();
  }

  if (tileW * zoom >= 26 && tileH * zoom >= 16) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        ctx.fillText(`${r}.${c}`, panX + c * tileW * zoom + 3, panY + r * tileH * zoom + 2);
      }
    }
  }

  // 非選択アイテムの割当セルを薄紫で同時プレビューする
  otherEntries.forEach((entry) => {
    const rx = panX + entry.col * tileW * zoom;
    const ry = panY + entry.row * tileH * zoom;
    const rw = tileW * zoom;
    const rh = tileH * zoom;
    ctx.fillStyle = 'rgba(180, 140, 255, 0.12)';
    ctx.fillRect(rx, ry, rw, rh);
    ctx.strokeStyle = 'rgba(195, 160, 255, 0.55)';
    ctx.lineWidth = 1;
    ctx.strokeRect(rx + 1, ry + 1, Math.max(1, rw - 2), Math.max(1, rh - 2));
    if (rw >= 24 && rh >= 18) {
      ctx.font = 'bold 10px Consolas, monospace';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = 'rgba(210, 185, 255, 0.85)';
      ctx.fillText(`#${entry.itemIdx + 1}`, rx + 3, ry + rh - 2);
      ctx.textBaseline = 'top';
    }
  });

  entries.forEach((entry, idx) => {
    const rx = panX + entry.col * tileW * zoom;
    const ry = panY + entry.row * tileH * zoom;
    const rw = tileW * zoom;
    const rh = tileH * zoom;
    const isFocused = mode === 'per_key' && idx === selectedKeyIdx;
    const isFreight = entry.key.startsWith('FreightImage');

    ctx.fillStyle = isFocused ? 'rgba(255, 210, 0, 0.28)' : (isFreight ? 'rgba(255, 153, 0, 0.16)' : 'rgba(0, 229, 255, 0.16)');
    ctx.fillRect(rx, ry, rw, rh);
    ctx.strokeStyle = isFocused ? '#FFD200' : (isFreight ? '#FF9900' : '#00E5FF');
    ctx.lineWidth = isFocused ? 2.5 : 1.5;
    ctx.strokeRect(rx + 1, ry + 1, Math.max(1, rw - 2), Math.max(1, rh - 2));

    if (rw >= 34 && rh >= 24) {
      ctx.font = isFocused ? 'bold 10px Consolas, monospace' : '10px Consolas, monospace';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = isFocused ? '#FFE875' : (isFreight ? '#FFC266' : '#80F2FF');
      ctx.fillText(shortenKeyTag(entry.key), rx + 3, ry + rh - 2);
      ctx.textBaseline = 'top';
    }
  });

  if (hoverCell) {
    const hx = panX + hoverCell.col * tileW * zoom;
    const hy = panY + hoverCell.row * tileH * zoom;
    ctx.save();
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(hx + 1, hy + 1, Math.max(1, tileW * zoom - 2), Math.max(1, tileH * zoom - 2));
    ctx.restore();
  }
}

// ピッカー内の個別キー指定・全キー固定・解除イベントをバインドする
export function bindPickerCustomKeyEvents(picker) {
  document.querySelectorAll('.dat-picker-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      picker.setMode(btn.dataset.mode);
      picker.refreshAll();
    });
  });

  const onPerKeyInput = () => {
    const active = picker._activeItem();
    const target = picker._getCurrentEntries()[picker.selectedKeyIdx];
    if (!active || !target) return;
    const r = Math.max(0, parseInt(document.getElementById('inp-dat-picker-key-row')?.value, 10) || 0);
    const c = Math.max(0, parseInt(document.getElementById('inp-dat-picker-key-col')?.value, 10) || 0);
    if (!active.common.customImageCoords) active.common.customImageCoords = {};
    active.common.customImageCoords[target.key] = { row: r, col: c };
    picker.setMode('per_key');
    picker.refreshAll();
  };
  document.getElementById('inp-dat-picker-key-row')?.addEventListener('input', onPerKeyInput);
  document.getElementById('inp-dat-picker-key-col')?.addEventListener('input', onPerKeyInput);

  document.getElementById('btn-dat-picker-key-clear')?.addEventListener('click', () => {
    const active = picker._activeItem();
    const target = picker._getCurrentEntries()[picker.selectedKeyIdx];
    if (active?.common?.customImageCoords && target) {
      delete active.common.customImageCoords[target.key];
      if (Object.keys(active.common.customImageCoords).length === 0) active.common.customImageCoords = null;
      picker.refreshAll();
    }
  });

  document.getElementById('btn-dat-picker-pin-all')?.addEventListener('click', () => {
    const active = picker._activeItem();
    if (!active) return;
    const entries = picker._getCurrentEntries();
    if (!active.common.customImageCoords) active.common.customImageCoords = {};
    entries.forEach(e => { active.common.customImageCoords[e.key] = { row: e.row, col: e.col }; });
    picker.setMode('per_key');
    picker.refreshAll();
  });

  document.getElementById('btn-dat-picker-reset-custom')?.addEventListener('click', () => {
    const active = picker._activeItem();
    if (active) active.common.customImageCoords = null;
    picker.refreshAll();
  });
}
