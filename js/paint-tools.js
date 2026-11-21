import { rgbaToHex, parseHexColor, colorHexToCss } from './color-utils.js';
import { isAlphaSupportedTarget } from './paint-palette-ui.js';
import {
  drawLineContinuous,
  floodFill,
  magicWandMask,
  colorSelectMask,
  rasterizePolygonMask,
  drawSelectionOverlay,
  drawRectSelectionOverlay,
  drawGuidesOverlay
} from './paint-algorithms.js';

const SELECT_TOOLS = new Set(['rectSelect', 'polySelect', 'wand', 'colorSelect']);

export class PaintToolHandler {
  constructor(editor) {
    this.editor = editor;
  }

  // 指定ピクセルの色をスポイト採取する共通メソッド（32bitアルファ色にも対応）
  pickColorAt(px, py) {
    const ed = this.editor;
    if (px < 0 || px >= ed.width || py < 0 || py >= ed.height) return false;
    const p = ed.ctx.getImageData(px, py, 1, 1).data;
    const allowAlpha = isAlphaSupportedTarget(ed.targetType);
    if (!allowAlpha && p[3] === 0) return false;

    const hex = (allowAlpha && p[3] === 0)
      ? '#00000000'
      : rgbaToHex(p[0], p[1], p[2], allowAlpha ? p[3] : 255);
    ed.currentColor = hex;
    ed._updateCurrentColorUI();
    if (ed.targetType === 'mask') {
      ed.app.paletteManager.addColorToMaskPalette(hex);
      ed._renderPaletteUI();
    } else if (ed.targetType === 'base' && p[3] < 255) {
      ed.app.paletteManager.addColorToBasePalette(hex);
      ed._renderPaletteUI();
    }
    const alphaTag = p[3] < 255 ? ` (A:${p[3]})` : '';
    ed._showHint(`🎯 色を取得しました: ${hex}${alphaTag}`);
    return true;
  }

  handlePointerDown(px, py) {
    const ed = this.editor;
    if (ed.dialogs?.colorReplace?.handleCanvasPick(px, py)) return;
    if (ed.dialogs?.colorReplace?.isPicking()) return;
    if (ed.onionSkinMgr && ed.onionSkinMgr.handlePointerDown(px, py)) return;
    if (ed.clipMgr.handlePointerDown(px, py)) return;
    if (ed.currentTool === 'hand') return;
    if (ed.selMover && ed.selMover.handlePointerDown(px, py)) return;

    // 選択系ツール使用時かつ新規設定(replace)で既に選択範囲がある場合の挙動
    if (
      SELECT_TOOLS.has(ed.currentTool) &&
      ed.selectionMode === 'replace' &&
      ed.selectionMask &&
      !(ed.currentTool === 'polySelect' && ed.polyPoints.length > 0)
    ) {
      const inside = px >= 0 && px < ed.width && py >= 0 && py < ed.height && ed.selectionMask[py * ed.width + px] === 1;
      if (inside && ed.selMover) {
        // 範囲内クリック（ドラッグ）で選択範囲を移動
        ed.selMover._beginMove(px, py);
      } else {
        // 範囲外クリックで選択範囲を解除
        ed.selectionMask = null;
        ed.polyPoints = [];
        if (ed.selMover) ed.selMover.reset();
        ed._drawOverlay();
        ed._updateStatus();
      }
      return;
    }

    if (px < 0 || px >= ed.width || py < 0 || py >= ed.height) return;

    if (ed.currentTool === 'picker') {
      this.pickColorAt(px, py);
      // スポイト実行後は前に使っていたツールに自動復帰
      ed.selectTool(ed.previousTool || 'pencil');
      return;
    }

    const [spx, spy] = ed.gridSnap ? ed.gridSnap.snapForTool(ed.currentTool, px, py) : [px, py];

    ed.isDrawing = true;
    ed.lastDrawPos = [spx, spy];

    if (ed.currentTool === 'pencil') {
      ed._pushHistory();
      ed._drawPixel(spx, spy);
    } else if (ed.currentTool === 'line') {
      ed.lineStart = [spx, spy];
    } else if (ed.currentTool === 'rectFill') {
      ed.rectFillStart = [px, py];
      this.drawOverlay([px, py]);
    } else if (ed.currentTool === 'bucket') {
      ed._pushHistory();
      const before = ed.repeatMgr ? ed.repeatMgr.snapshotBefore() : null;
      floodFill(ed.ctx, ed.width, ed.height, px, py, ed.currentColor, ed.selectionMask);
      if (ed.repeatMgr && before) ed.repeatMgr.applyDiff(before);
      ed.isDrawing = false;
    } else if (ed.currentTool === 'rectSelect') {
      ed.selStart = [px, py];
      this.drawOverlay([px, py]);
    } else if (ed.currentTool === 'polySelect') {
      if (ed.polyPoints.length >= 3 && Math.hypot(spx - ed.polyPoints[0][0], spy - ed.polyPoints[0][1]) <= 1.5) {
        this.finalizePolySelect();
      } else {
        const last = ed.polyPoints[ed.polyPoints.length - 1];
        if (!last || last[0] !== spx || last[1] !== spy) ed.polyPoints.push([spx, spy]);
        this.drawOverlay([spx, spy]);
      }
      ed.isDrawing = false;
    } else if (ed.currentTool === 'wand') {
      ed.clipMgr.applySelectionMask(magicWandMask(ed.ctx, ed.width, ed.height, spx, spy));
      ed.isDrawing = false;
    } else if (ed.currentTool === 'colorSelect') {
      ed.clipMgr.applySelectionMask(colorSelectMask(ed.ctx, ed.width, ed.height, spx, spy));
      ed.isDrawing = false;
    } else if (ed.currentTool === 'text') {
      ed.isDrawing = false;
      ed.textCtrl.openForNew(spx, spy);
    }
  }

  handlePointerMove(px, py) {
    const ed = this.editor;
    if (ed.onionSkinMgr && ed.onionSkinMgr.handlePointerMove(px, py)) return;
    if (ed.clipMgr.handlePointerMove(px, py)) return;
    if (ed.selMover && ed.selMover.handlePointerMove(px, py)) return;

    const [spx, spy] = ed.gridSnap ? ed.gridSnap.snapForTool(ed.currentTool, px, py) : [px, py];

    if (ed.isDrawing) {
      if (ed.currentTool === 'pencil') {
        const [lx, ly] = ed.lastDrawPos;
        drawLineContinuous(lx, ly, spx, spy, (x, y) => ed._drawPixel(x, y));
        ed.lastDrawPos = [spx, spy];
      } else if (ed.currentTool === 'line') {
        this.drawOverlay([spx, spy]);
      } else if (ed.currentTool === 'rectFill' || ed.currentTool === 'rectSelect') {
        this.drawOverlay([px, py]);
      }
    } else if (ed.currentTool === 'polySelect' && ed.polyPoints.length > 0) {
      this.drawOverlay([spx, spy]);
    } else {
      if (ed.gridSnap && ed.gridSnap.isPointSnapTool(ed.currentTool)) {
        this.drawOverlay([spx, spy]);
      }
      ed.updateCursor(px, py);
    }
  }

  handlePointerUp(px, py) {
    const ed = this.editor;
    if (ed.onionSkinMgr && ed.onionSkinMgr.handlePointerUp()) return;
    if (ed.clipMgr.handlePointerUp()) return;
    if (ed.selMover && ed.selMover.handlePointerUp()) return;
    if (!ed.isDrawing) return;
    ed.isDrawing = false;

    const [spx, spy] = ed.gridSnap ? ed.gridSnap.snapForTool(ed.currentTool, px, py) : [px, py];

    if (ed.currentTool === 'line' && ed.lineStart) {
      ed._pushHistory();
      drawLineContinuous(ed.lineStart[0], ed.lineStart[1], spx, spy, (x, y) => ed._drawPixel(x, y));
      ed.lineStart = null;
      this.drawOverlay();
    } else if (ed.currentTool === 'rectFill' && ed.rectFillStart) {
      ed._pushHistory();
      const b = this._resolveRectBounds(ed.rectFillStart, [px, py]);
      if (ed.repeatMgr) {
        ed.repeatMgr.drawRect(b.x0, b.y0, b.x1, b.y1);
      } else {
        for (let y = b.y0; y <= b.y1; y++) {
          for (let x = b.x0; x <= b.x1; x++) ed._drawPixel(x, y);
        }
      }
      ed.rectFillStart = null;
      this.drawOverlay();
    } else if (ed.currentTool === 'rectSelect' && ed.selStart) {
      const b = this._resolveRectBounds(ed.selStart, [px, py]);
      const newMask = new Uint8Array(ed.width * ed.height);
      for (let sy = b.y0; sy <= b.y1; sy++) {
        for (let sx = b.x0; sx <= b.x1; sx++) newMask[sy * ed.width + sx] = 1;
      }
      ed.selStart = null;
      ed.clipMgr.applySelectionMask(newMask);
    }
  }

  // 矩形範囲をスナップ設定に応じて計算
  _resolveRectBounds(startPos, endPos) {
    const ed = this.editor;
    if (ed.gridSnap) return ed.gridSnap.computeRectBounds(startPos, endPos);
    return {
      x0: Math.max(0, Math.min(startPos[0], endPos[0])),
      x1: Math.min(ed.width - 1, Math.max(startPos[0], endPos[0])),
      y0: Math.max(0, Math.min(startPos[1], endPos[1])),
      y1: Math.min(ed.height - 1, Math.max(startPos[1], endPos[1]))
    };
  }

  finalizePolySelect() {
    const ed = this.editor;
    if (ed.polyPoints.length < 3) return;
    const newMask = rasterizePolygonMask(ed.width, ed.height, ed.polyPoints);
    ed.polyPoints = [];
    ed.clipMgr.applySelectionMask(newMask);
  }

  drawOverlay(curPos = null) {
    const ed = this.editor;
    const oCtx = ed.oCtx;
    oCtx.clearRect(0, 0, ed.width, ed.height);

    if (ed.onionSkinMgr) ed.onionSkinMgr.drawOverlay(oCtx, ed.zoomLevel);
    ed.clipMgr.drawFloatingOverlay(oCtx, ed.zoomLevel);

    if (ed.rectHandles && ed.rectHandles.isResizing && ed.rectHandles.previewBounds) {
      const b = ed.rectHandles.previewBounds;
      drawRectSelectionOverlay(oCtx, b.minX, b.minY, b.maxX, b.maxY);
    } else if (ed.selMover && ed.selMover.isMoving) {
      ed.selMover.drawMovingOverlay(oCtx);
    } else {
      drawSelectionOverlay(oCtx, ed.width, ed.height, ed.selectionMask);
    }
    if (ed.repeatMgr) ed.repeatMgr.drawOverlay(oCtx);

    if (ed.currentTool === 'line' && ed.lineStart && curPos) {
      const [, , , curA] = parseHexColor(ed.currentColor);
      oCtx.fillStyle = curA === 0 ? 'rgba(255, 80, 120, 0.75)' : colorHexToCss(ed.currentColor);
      drawLineContinuous(ed.lineStart[0], ed.lineStart[1], curPos[0], curPos[1], (x, y) => oCtx.fillRect(x, y, 1, 1));
    } else if (ed.currentTool === 'rectFill' && ed.rectFillStart && curPos) {
      const b = this._resolveRectBounds(ed.rectFillStart, curPos);
      const [, , , curA] = parseHexColor(ed.currentColor);
      if (curA === 0) {
        oCtx.fillStyle = 'rgba(255, 80, 120, 0.35)';
        oCtx.fillRect(b.x0, b.y0, b.x1 - b.x0 + 1, b.y1 - b.y0 + 1);
      } else {
        oCtx.fillStyle = colorHexToCss(ed.currentColor);
        oCtx.globalAlpha = 0.7;
        oCtx.fillRect(b.x0, b.y0, b.x1 - b.x0 + 1, b.y1 - b.y0 + 1);
        oCtx.globalAlpha = 1.0;
      }
    } else if (ed.currentTool === 'rectSelect' && ed.selStart && curPos) {
      const b = this._resolveRectBounds(ed.selStart, curPos);
      drawRectSelectionOverlay(oCtx, b.x0, b.y0, b.x1, b.y1);
    } else if (!ed.isDrawing && curPos && ed.gridSnap && ed.gridSnap.isPointSnapTool(ed.currentTool)) {
      oCtx.fillStyle = 'rgba(255, 235, 0, 0.85)';
      oCtx.fillRect(curPos[0], curPos[1], 1, 1);
    }

    if (ed.polyPoints.length > 0) {
      oCtx.lineWidth = 1 / Math.max(1, ed.zoomLevel * 0.5);
      oCtx.strokeStyle = '#00FF66';
      oCtx.beginPath();
      oCtx.moveTo(ed.polyPoints[0][0] + 0.5, ed.polyPoints[0][1] + 0.5);
      for (let i = 1; i < ed.polyPoints.length; i++) {
        oCtx.lineTo(ed.polyPoints[i][0] + 0.5, ed.polyPoints[i][1] + 0.5);
      }
      if (curPos) oCtx.lineTo(curPos[0] + 0.5, curPos[1] + 0.5);
      oCtx.stroke();

      if (curPos && ed.polyPoints.length >= 2) {
        oCtx.setLineDash([1, 1]);
        oCtx.strokeStyle = 'rgba(0, 255, 102, 0.55)';
        oCtx.beginPath();
        oCtx.moveTo(curPos[0] + 0.5, curPos[1] + 0.5);
        oCtx.lineTo(ed.polyPoints[0][0] + 0.5, ed.polyPoints[0][1] + 0.5);
        oCtx.stroke();
        oCtx.setLineDash([]);
      }

      ed.polyPoints.forEach(([vx, vy], idx) => {
        oCtx.fillStyle = idx === 0 ? '#00FF66' : '#FFFF00';
        oCtx.fillRect(vx, vy, 1, 1);
      });
    }

    drawGuidesOverlay(oCtx, ed.width, ed.height, ed.zoomLevel, {
      showGrid: ed.showGrid,
      gridStep: ed.gridStep,
      gridColor: ed.gridColor,
      showIsoTile: ed.showIsoTile,
      isoTileW: ed.isoTileW,
      isoTileH: ed.isoTileH,
      isoColor: ed.isoColor,
      snapGridEnabled: Boolean(ed.gridSnap && ed.gridSnap.enabled),
      snapGridW: ed.gridSnap ? ed.gridSnap.stepW : 16,
      snapGridH: ed.gridSnap ? ed.gridSnap.stepH : 16
    });
  }
}

// ペイントエディタ下部のツール状態・ヒント表示を更新
export function updatePaintStatus(ed) {
  ed.updateCursor();
  const modeNames = { replace: '新規', add: '＋追加', subtract: '－一部削除', intersect: '×乗算(交差)' };
  const toolLbl = document.getElementById('paint-lbl-tool');
  if (toolLbl) {
    const snapText = (ed.gridSnap && ed.gridSnap.enabled) ? ` | 🧲スナップ: ${ed.gridSnap.stepW}×${ed.gridSnap.stepH}` : '';
    toolLbl.textContent = `ツール: ${ed.currentTool} | 選択モード: ${modeNames[ed.selectionMode] || ed.selectionMode}${snapText} (${ed.width}×${ed.height}px)`;
  }

  if (ed.currentTool === 'hand') {
    ed._showHint('✋ ハンドスクロールモード: 1本指または左ドラッグでキャンバスをスクロール移動できます');
  } else if (ed.currentTool === 'picker') {
    ed._showHint(`🎯 スポイト: 色をクリックで取得し、自動的に「${ed.previousTool}」へ戻ります`);
  } else if (ed.currentTool === 'rectSelect' && ed.selectionMode === 'replace' && ed.selectionMask && ed.isTouchMode) {
    ed._showHint('矩形選択(新規): 四隅の制御点で範囲変更 / 範囲内ドラッグで移動 / 範囲外タップで解除');
  } else if (SELECT_TOOLS.has(ed.currentTool) && ed.selectionMode === 'replace' && ed.selectionMask) {
    ed._showHint('選択範囲(新規): 範囲内をドラッグで移動 / 範囲外をクリックで選択解除');
  } else if (ed.currentTool === 'moveSel') {
    if (ed.clipMgr && ed.clipMgr.floatingLayer) {
      ed._showHint(ed.clipMgr.floatingLayer.isText
        ? '↔️ 文字を移動中: ドラッグ/矢印キーで移動、「✏️ 文字編集」で再編集、Enterまたは「✓ 確定」で焼き込み'
        : '↔️ 貼り付け画像をドラッグまたは矢印キーで移動し、Enterまたは「✓ 確定」で確定します');
    } else {
      ed._showHint(ed.selectionMask ? '↔️ 選択範囲の移動: 範囲内ドラッグまたは矢印キーで移動' : '⚠️ 先に選択ツールで範囲を指定してください');
    }
  } else if (ed.repeatMgr && ed.repeatMgr.enabled && !ed.selectionMask) {
    ed._showHint('🔁 上方リピートON中: 先に選択範囲を指定してその中を描画すると上方へ反復されます');
  } else if (ed.repeatMgr && ed.repeatMgr.isActive()) {
    ed._showHint(`🔁 上方リピート有効: 選択範囲内の編集を上方 ${ed.repeatMgr.stepY}px おきに ${ed.repeatMgr.count} 回反復`);
  } else if (ed.currentTool === 'polySelect') {
    ed._showHint('クリックで頂点追加 / 始点クリック・ダブルクリック・Enterで確定 / Escで取消');
  } else if (ed.isDrawingTool()) {
    ed._showHint('ドラッグで描画 / 右クリックでスポイト(色取得)');
  } else {
    ed._showHint('');
  }
}
