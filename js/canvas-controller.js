export class CanvasController {
  constructor(app) {
    this.app = app;
    this.panStart = [0, 0];
    this.dragCornerIdx = -1;
    this.dragStartPos = [0, 0];
    this.origCorners = null;
    this.touchStartDist = null;
    this.touchStartZoom = 1.0;
    this.touchStartPan = [0, 0];
    this.touchStartCenter = [0, 0];

    this._bindEvents();
  }

  _getCanvasPixel(clientX, clientY) {
    const rect = this.app.viewport.getBoundingClientRect();
    const ix = (clientX - rect.left - this.app.panX) / this.app.zoomLevel;
    const iy = (clientY - rect.top - this.app.panY) / this.app.zoomLevel;
    return [ix, iy];
  }

  _hitTestHandle(clientX, clientY) {
    const app = this.app;
    if (app.activeIdx < 0 || app.activeIdx >= app.layers.length) return -1;
    const layer = app.layers[app.activeIdx];
    const rect = app.viewport.getBoundingClientRect();
    const mx = clientX - rect.left;
    const my = clientY - rect.top;

    for (let i = 0; i < 4; i++) {
      const hx = layer.corners[i][0] * app.zoomLevel + app.panX;
      const hy = layer.corners[i][1] * app.zoomLevel + app.panY;
      if (Math.hypot(mx - hx, my - hy) <= 12) return i;
    }
    return -1;
  }

  _isInsideLayer(ix, iy) {
    const app = this.app;
    if (app.activeIdx < 0 || app.activeIdx >= app.layers.length) return false;
    const pts = app.layers[app.activeIdx].corners;
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i][0], yi = pts[i][1];
      const xj = pts[j][0], yj = pts[j][1];
      const intersect = ((yi > iy) !== (yj > iy)) && (ix < (xj - xi) * (iy - yi) / (yj - yi + 1e-9) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  _bindEvents() {
    const app = this.app;
    const vp = app.viewport;
    if (!vp) return;

    // キャンバス上での右クリックメニュー表示を禁止
    vp.addEventListener('contextmenu', (e) => e.preventDefault());
    if (app.canvas) {
      app.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    vp.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (!app.baseW) return;
      const rect = vp.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.25 : 0.8;
      app.setZoom(app.zoomLevel * factor, [cx, cy]);
    }, { passive: false });

    vp.addEventListener('mousedown', (e) => {
      if (app.isEyedropper) {
        if (e.button === 0) {
          app.pickColorFromCoords(e.clientX, e.clientY);
        } else if (e.button === 2) {
          app.toggleEyedropper();
        }
        return;
      }

      if (e.button === 1 || e.button === 2 || app.spacePressed) {
        app.isPanning = true;
        this.panStart = [e.clientX - app.panX, e.clientY - app.panY];
        vp.style.cursor = 'grabbing';
        return;
      }

      if (e.button !== 0 || !app.baseW) return;
      const [ix, iy] = this._getCanvasPixel(e.clientX, e.clientY);
      const hIdx = this._hitTestHandle(e.clientX, e.clientY);

      if (hIdx >= 0) {
        app.dragMode = 'corner';
        this.dragCornerIdx = hIdx;
        this.origCorners = app.layers[app.activeIdx].corners.map(p => [...p]);
        this.dragStartPos = [ix, iy];
      } else if (this._isInsideLayer(ix, iy)) {
        app.dragMode = 'move';
        this.origCorners = app.layers[app.activeIdx].corners.map(p => [...p]);
        this.dragStartPos = [ix, iy];
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (app.isEyedropper) {
        vp.style.cursor = 'crosshair';
        if (app.canvas) app.canvas.style.cursor = 'crosshair';
        return;
      }

      if (app.isPanning) {
        app.panX = e.clientX - this.panStart[0];
        app.panY = e.clientY - this.panStart[1];
        app.render();
        return;
      }

      if (!app.dragMode) {
        const hIdx = this._hitTestHandle(e.clientX, e.clientY);
        const [ix, iy] = this._getCanvasPixel(e.clientX, e.clientY);
        if (hIdx >= 0) vp.style.cursor = 'pointer';
        else if (this._isInsideLayer(ix, iy)) vp.style.cursor = 'move';
        else vp.style.cursor = app.spacePressed ? 'grab' : 'default';
        return;
      }

      const layer = app.layers[app.activeIdx];
      if (!layer || !this.origCorners) return;
      const [ix, iy] = this._getCanvasPixel(e.clientX, e.clientY);
      let dx = ix - this.dragStartPos[0];
      let dy = iy - this.dragStartPos[1];
      if (app.pixelSnap) {
        dx = Math.round(dx);
        dy = Math.round(dy);
      }

      if (app.dragMode === 'move') {
        layer.corners = this.origCorners.map(([ox, oy]) => [ox + dx, oy + dy]);
      } else if (app.dragMode === 'corner') {
        this._applyCornerDrag(layer, this.dragCornerIdx, dx, dy);
      }
      app.markDirty();
      app.render();
    });

    window.addEventListener('mouseup', () => {
      if (app.isPanning) {
        app.isPanning = false;
        vp.style.cursor = app.isEyedropper ? 'crosshair' : 'default';
      }
      if (app.dragMode) {
        app.dragMode = null;
        this.dragCornerIdx = -1;
        this.origCorners = null;
      }
    });

    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.code === 'Space') app.spacePressed = true;
      if (e.code === 'Escape' && app.isEyedropper) app.toggleEyedropper();
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') app.spacePressed = false;
    });

    vp.addEventListener('touchstart', (e) => {
      if (app.isEyedropper && e.touches.length === 1) {
        e.preventDefault();
        app.pickColorFromCoords(e.touches[0].clientX, e.touches[0].clientY);
        return;
      }
      if (e.touches.length === 1) {
        const t = e.touches[0];
        const [ix, iy] = this._getCanvasPixel(t.clientX, t.clientY);
        const hIdx = this._hitTestHandle(t.clientX, t.clientY);
        if (hIdx >= 0) {
          e.preventDefault();
          app.dragMode = 'corner';
          this.dragCornerIdx = hIdx;
          this.origCorners = app.layers[app.activeIdx].corners.map(p => [...p]);
          this.dragStartPos = [ix, iy];
        } else if (this._isInsideLayer(ix, iy)) {
          e.preventDefault();
          app.dragMode = 'move';
          this.origCorners = app.layers[app.activeIdx].corners.map(p => [...p]);
          this.dragStartPos = [ix, iy];
        }
      } else if (e.touches.length === 2) {
        e.preventDefault();
        app.dragMode = null;
        const t1 = e.touches[0], t2 = e.touches[1];
        this.touchStartDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        this.touchStartZoom = app.zoomLevel;
        const rect = vp.getBoundingClientRect();
        this.touchStartCenter = [((t1.clientX + t2.clientX) / 2) - rect.left, ((t1.clientY + t2.clientY) / 2) - rect.top];
        this.touchStartPan = [app.panX, app.panY];
      }
    }, { passive: false });

    vp.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1 && app.dragMode) {
        e.preventDefault();
        const t = e.touches[0];
        const layer = app.layers[app.activeIdx];
        if (!layer || !this.origCorners) return;
        const [ix, iy] = this._getCanvasPixel(t.clientX, t.clientY);
        let dx = ix - this.dragStartPos[0];
        let dy = iy - this.dragStartPos[1];
        if (app.pixelSnap) { dx = Math.round(dx); dy = Math.round(dy); }
        if (app.dragMode === 'move') {
          layer.corners = this.origCorners.map(([ox, oy]) => [ox + dx, oy + dy]);
        } else if (app.dragMode === 'corner') {
          this._applyCornerDrag(layer, this.dragCornerIdx, dx, dy);
        }
        app.markDirty();
        app.render();
      } else if (e.touches.length === 2 && this.touchStartDist) {
        e.preventDefault();
        const t1 = e.touches[0], t2 = e.touches[1];
        const curDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        const newZoom = Math.max(0.1, Math.min(32.0, this.touchStartZoom * (curDist / this.touchStartDist)));
        const rect = vp.getBoundingClientRect();
        const cx = ((t1.clientX + t2.clientX) / 2) - rect.left;
        const cy = ((t1.clientY + t2.clientY) / 2) - rect.top;
        const ix = (this.touchStartCenter[0] - this.touchStartPan[0]) / this.touchStartZoom;
        const iy = (this.touchStartCenter[1] - this.touchStartPan[1]) / this.touchStartZoom;
        app.zoomLevel = newZoom;
        app.panX = cx - ix * newZoom;
        app.panY = cy - iy * newZoom;
        document.getElementById('lbl-zoom').textContent = `${Math.round(newZoom * 100)}%`;
        app.render();
      }
    }, { passive: false });

    vp.addEventListener('touchend', () => {
      app.dragMode = null;
      this.dragCornerIdx = -1;
      this.origCorners = null;
      this.touchStartDist = null;
    });
  }

  _applyCornerDrag(layer, idx, dx, dy) {
    const o = this.origCorners;
    const nx = o[idx][0] + dx;
    const ny = o[idx][1] + dy;

    if (layer.transformMode === 'box') {
      const opp = (idx + 2) % 4;
      const ox = o[opp][0], oy = o[opp][1];
      const minX = Math.min(nx, ox), maxX = Math.max(nx, ox);
      const minY = Math.min(ny, oy), maxY = Math.max(ny, oy);
      layer.corners = [[minX, minY], [maxX, minY], [maxX, maxY], [minX, maxY]];
    } else if (layer.transformMode === 'affine') {
      const c = o.map(p => [...p]);
      c[idx] = [nx, ny];
      if (idx === 0) c[2] = [c[1][0] + c[3][0] - nx, c[1][1] + c[3][1] - ny];
      else if (idx === 1) c[3] = [c[0][0] + c[2][0] - nx, c[0][1] + c[2][1] - ny];
      else if (idx === 2) c[0] = [c[1][0] + c[3][0] - nx, c[1][1] + c[3][1] - ny];
      else if (idx === 3) c[1] = [c[0][0] + c[2][0] - nx, c[0][1] + c[2][1] - ny];
      layer.corners = c;
    } else {
      layer.corners[idx] = [nx, ny];
    }
  }
}
