// DAT画像ピッカーのキャンバス描画・ズーム・パン操作ヘルパー

export function buildPickerSourceCanvas(app) {
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
  return c;
}

export function guessInitialTileSize(w, h, objType) {
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
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  window.addEventListener('mousemove', (e) => {
    if (!picker.isPanning || !modal?.open) return;
    const nx = e.clientX - picker.panStart[0];
    const ny = e.clientY - picker.panStart[1];
    if (Math.hypot(nx - picker.panX, ny - picker.panY) > 4) picker.panMoved = true;
    if (e.buttons !== 1 || picker.panMoved) {
      picker.panX = nx;
      picker.panY = ny;
      picker._renderCanvas();
    }
  });

  window.addEventListener('mouseup', (e) => {
    if (!picker.isPanning) return;
    const wasClick = e.button === 0 && !picker.panMoved && modal?.open;
    picker.isPanning = false;
    if (wasClick && e.target === canvas) picker._handleCanvasClick(e.clientX, e.clientY);
  });
}
