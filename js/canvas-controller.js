function pointInPolygon(point, vs) {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i][0], yi = vs[i][1];
    const xj = vs[j][0], yj = vs[j][1];
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

export class CanvasController {
  constructor(app) {
    this.app = app;
    this.viewport = app.viewport;
    this.canvas = app.canvas;

    this.touchStartDist = null;
    this.touchStartZoom = 1.0;
    this.touchStartPan = [0, 0];
    this.touchStartCenter = [0, 0];

    this._bindEvents();
  }

  _bindEvents() {
    this.viewport.onwheel = (e) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 1.25 : 0.8;
      this.app.setZoom(this.app.zoomLevel * delta, [
        e.clientX - this.viewport.offsetLeft,
        e.clientY - this.viewport.offsetTop
      ]);
    };

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        this.app.spacePressed = true;
        this.viewport.style.cursor = 'grab';
      }
      if (e.key === 'Escape' && this.app.isEyedropper) {
        this.app.toggleEyedropper();
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        this.app.spacePressed = false;
        this.viewport.style.cursor = 'default';
      }
    });

    this.viewport.onmousedown = (e) => {
      if (this.app.spacePressed || e.button === 1 || e.button === 2) {
        this.app.isPanning = true;
        this.app.panStart = [e.clientX - this.app.panX, e.clientY - this.app.panY];
        this.viewport.style.cursor = 'grabbing';
        return;
      }
      if (this.app.isEyedropper) {
        this.app.pickColorFromCoords(e.clientX, e.clientY);
        return;
      }
      this.handleInteractionStart(e.clientX, e.clientY, 8);
    };

    window.addEventListener('mousemove', (e) => {
      if (this.app.isPanning) {
        this.app.panX = e.clientX - this.app.panStart[0];
        this.app.panY = e.clientY - this.app.panStart[1];
        this.app.render();
        return;
      }
      if (this.app.dragMode && this.app.activeIdx >= 0) {
        this.handleInteractionMove(e.clientX, e.clientY);
        return;
      }
      this.updateCursor(e);
    });

    window.addEventListener('mouseup', () => {
      if (this.app.isPanning) {
        this.app.isPanning = false;
        this.viewport.style.cursor = this.app.spacePressed ? 'grab' : 'default';
      }
      if (this.app.dragMode) {
        this.app.dragMode = null;
        this.app.markDirty();
        this.app.render();
      }
    });

    this.viewport.addEventListener('touchstart', (e) => this._onTouchStart(e), { passive: false });
    window.addEventListener('touchmove', (e) => this._onTouchMove(e), { passive: false });
    window.addEventListener('touchend', (e) => this._onTouchEnd(e), { passive: false });
    window.addEventListener('touchcancel', (e) => this._onTouchEnd(e), { passive: false });
  }

  _onTouchStart(e) {
    if (e.target !== this.canvas && !this.viewport.contains(e.target)) return;
    e.preventDefault();

    if (e.touches.length === 1) {
      const t = e.touches[0];
      if (this.app.isEyedropper) {
        this.app.pickColorFromCoords(t.clientX, t.clientY);
        return;
      }
      this.handleInteractionStart(t.clientX, t.clientY, 16);
    } else if (e.touches.length === 2) {
      this.app.dragMode = null;
      this.app.isPanning = false;

      const t1 = e.touches[0], t2 = e.touches[1];
      this.touchStartDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      this.touchStartZoom = this.app.zoomLevel;

      const rect = this.viewport.getBoundingClientRect();
      this.touchStartCenter = [((t1.clientX + t2.clientX) / 2) - rect.left, ((t1.clientY + t2.clientY) / 2) - rect.top];
      this.touchStartPan = [this.app.panX, this.app.panY];
    }
  }

  _onTouchMove(e) {
    if (e.touches.length === 1) {
      const t = e.touches[0];
      if (this.app.isPanning) {
        this.app.panX = t.clientX - this.app.panStart[0];
        this.app.panY = t.clientY - this.app.panStart[1];
        this.app.render();
        return;
      }
      if (this.app.dragMode && this.app.activeIdx >= 0) {
        this.handleInteractionMove(t.clientX, t.clientY);
      }
    } else if (e.touches.length === 2 && this.touchStartDist) {
      e.preventDefault();
      const t1 = e.touches[0], t2 = e.touches[1];
      const curDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      const newZoom = Math.max(0.1, Math.min(32.0, this.touchStartZoom * (curDist / this.touchStartDist)));

      const rect = this.viewport.getBoundingClientRect();
      const curCenterX = ((t1.clientX + t2.clientX) / 2) - rect.left;
      const curCenterY = ((t1.clientY + t2.clientY) / 2) - rect.top;

      const imgX = (this.touchStartCenter[0] - this.touchStartPan[0]) / this.touchStartZoom;
      const imgY = (this.touchStartCenter[1] - this.touchStartPan[1]) / this.touchStartZoom;

      this.app.zoomLevel = newZoom;
      this.app.panX = curCenterX - imgX * newZoom;
      this.app.panY = curCenterY - imgY * newZoom;

      document.getElementById('lbl-zoom').textContent = `${Math.round(this.app.zoomLevel * 100)}%`;
      this.app.render();
    }
  }

  _onTouchEnd(e) {
    if (e.touches.length === 0) {
      if (this.app.isPanning) this.app.isPanning = false;
      if (this.app.dragMode) {
        this.app.dragMode = null;
        this.app.markDirty();
        this.app.render();
      }
      this.touchStartDist = null;
    } else if (e.touches.length === 1) {
      this.touchStartDist = null;
      this.app.dragMode = null;
      this.app.isPanning = false;
    }
  }

  handleInteractionStart(clientX, clientY, hitRadiusPx) {
    const rect = this.viewport.getBoundingClientRect();
    const mx = (clientX - rect.left - this.app.panX) / this.app.zoomLevel;
    const my = (clientY - rect.top - this.app.panY) / this.app.zoomLevel;

    if (this.app.activeIdx >= 0 && this.app.layers[this.app.activeIdx]) {
      const layer = this.app.layers[this.app.activeIdx];
      this.app.dragStartPos = [mx, my];
      this.app.dragStartCorners = layer.corners.map(([x, y]) => [x, y]);

      for (let i = 0; i < 4; i++) {
        if (Math.hypot(mx - layer.corners[i][0], my - layer.corners[i][1]) <= hitRadiusPx / this.app.zoomLevel) {
          this.app.dragMode = `corner_${i}`;
          return;
        }
      }

      if (pointInPolygon([mx, my], layer.corners)) {
        this.app.dragMode = 'move';
        return;
      }
    }

    this.app.isPanning = true;
    this.app.panStart = [clientX - this.app.panX, clientY - this.app.panY];
    this.viewport.style.cursor = 'grabbing';
  }

  handleInteractionMove(clientX, clientY) {
    const rect = this.viewport.getBoundingClientRect();
    const mx = (clientX - rect.left - this.app.panX) / this.app.zoomLevel;
    const my = (clientY - rect.top - this.app.panY) / this.app.zoomLevel;
    const dx = mx - this.app.dragStartPos[0], dy = my - this.app.dragStartPos[1];
    const layer = this.app.layers[this.app.activeIdx];

    if (this.app.dragMode === 'move') {
      let newCorners = this.app.dragStartCorners.map(([x, y]) => [x + dx, y + dy]);
      if (this.app.pixelSnap) newCorners = newCorners.map(([x, y]) => [Math.round(x), Math.round(y)]);
      layer.corners = newCorners;
      this.app.render();
      return;
    }

    const idx = parseInt(this.app.dragMode.split('_')[1]);
    if (layer.transformMode === 'free') {
      let nx = this.app.dragStartCorners[idx][0] + dx, ny = this.app.dragStartCorners[idx][1] + dy;
      if (this.app.pixelSnap) { nx = Math.round(nx); ny = Math.round(ny); }
      layer.corners[idx] = [nx, ny];
    } else if (layer.transformMode === 'affine') {
      let nx = this.app.dragStartCorners[idx][0] + dx, ny = this.app.dragStartCorners[idx][1] + dy;
      if (this.app.pixelSnap) { nx = Math.round(nx); ny = Math.round(ny); }
      const p = this.app.dragStartCorners.map(([x, y]) => [x, y]);
      if (idx === 0) { p[0] = [nx, ny]; p[2] = [p[1][0] + p[3][0] - nx, p[1][1] + p[3][1] - ny]; }
      else if (idx === 1) { p[1] = [nx, ny]; p[2] = [nx + p[3][0] - p[0][0], ny + p[3][1] - p[0][1]]; }
      else if (idx === 3) { p[3] = [nx, ny]; p[2] = [p[1][0] + nx - p[0][0], p[1][1] + ny - p[0][1]]; }
      else if (idx === 2) { p[2] = [nx, ny]; p[0] = [p[1][0] + p[3][0] - nx, p[1][1] + p[3][1] - ny]; }
      layer.corners = this.app.pixelSnap ? p.map(([x, y]) => [Math.round(x), Math.round(y)]) : p;
    } else {
      let curX = this.app.dragStartCorners[idx][0] + dx, curY = this.app.dragStartCorners[idx][1] + dy;
      const [oppX, oppY] = this.app.dragStartCorners[(idx + 2) % 4];
      let xMin = Math.min(oppX, curX), xMax = Math.max(oppX, curX);
      let yMin = Math.min(oppY, curY), yMax = Math.max(oppY, curY);
      if (this.app.pixelSnap) {
        xMin = Math.round(xMin); xMax = Math.round(xMax);
        yMin = Math.round(yMin); yMax = Math.round(yMax);
      }
      layer.corners = [[xMin, yMin], [xMax, yMin], [xMax, yMax], [xMin, yMax]];
    }
    this.app.render();
  }

  updateCursor(e) {
    if (this.app.spacePressed) { this.viewport.style.cursor = 'grab'; return; }
    if (this.app.isEyedropper) { this.viewport.style.cursor = 'crosshair'; return; }
    if (this.app.activeIdx < 0 || !this.app.layers[this.app.activeIdx]) {
      this.viewport.style.cursor = 'default';
      return;
    }

    const rect = this.viewport.getBoundingClientRect();
    const mx = (e.clientX - rect.left - this.app.panX) / this.app.zoomLevel;
    const my = (e.clientY - rect.top - this.app.panY) / this.app.zoomLevel;
    const layer = this.app.layers[this.app.activeIdx];

    for (let i = 0; i < 4; i++) {
      if (Math.hypot(mx - layer.corners[i][0], my - layer.corners[i][1]) <= 8 / this.app.zoomLevel) {
        this.viewport.style.cursor = 'crosshair';
        return;
      }
    }
    if (pointInPolygon([mx, my], layer.corners)) {
      this.viewport.style.cursor = 'move';
      return;
    }
    this.viewport.style.cursor = 'default';
  }
}
