import { serializeDatObject, downloadDatText } from './dat-serializer.js';
import { flipCustomImageCoords180 } from './dat-image-formats.js';

function addRevSuffixToName(rawName) {
  const s = String(rawName || 'obj').trim();
  const m = s.match(/^(.+?)(\([^()]+\))$/);
  if (m) return `${m[1]}_rev${m[2]}`;
  return `${s}_rev`;
}

function remapConstraintLines(rawText, nameMap) {
  return String(rawText || '')
    .split(/\r?\n/)
    .map(l => {
      const t = l.trim();
      if (!t || t === 'none') return t;
      return nameMap ? (nameMap.get(t) || t) : t;
    })
    .filter(Boolean)
    .join('\n');
}

function cloneCommon(c) {
  const copy = { ...(c || {}) };
  if (copy.customImageCoords) {
    copy.customImageCoords = JSON.parse(JSON.stringify(copy.customImageCoords));
  }
  return copy;
}

function cloneEntry(entry) {
  const values = { ...(entry.values || {}) };
  if (Array.isArray(values.climates)) values.climates = [...values.climates];
  return {
    objType: entry.objType,
    common: cloneCommon(entry.common),
    values
  };
}

export class DatCollectionManager {
  constructor(datGenerator) {
    this.gen = datGenerator;
    this.items = [];
    this.activeIndex = -1;
    this.exportAll = true;
  }

  hasCollection() {
    return this.items.length > 0;
  }

  bindEvents() {
    document.getElementById('sel-dat-active-object')?.addEventListener('change', (e) => {
      const idx = parseInt(e.target.value, 10);
      if (!Number.isNaN(idx)) this.selectItem(idx);
    });
    document.getElementById('btn-dat-obj-duplicate')?.addEventListener('click', () => this.duplicateActive());
    document.getElementById('btn-dat-obj-delete')?.addEventListener('click', () => this.deleteActive());
    document.getElementById('btn-dat-obj-reset-single')?.addEventListener('click', () => this.resetToSingle());
    document.getElementById('chk-dat-export-all-objects')?.addEventListener('change', (e) => {
      this.exportAll = e.target.checked;
      if (this.gen.autoSync) this.gen.regenerateOutput();
    });
    document.getElementById('btn-dat-reverse-inplace')?.addEventListener('click', () => {
      const flipImg = Boolean(document.getElementById('chk-dat-reverse-flip-img')?.checked);
      this.reverseFormation({ appendAsNew: false, flipDirections: flipImg });
    });
    document.getElementById('btn-dat-reverse-append')?.addEventListener('click', () => {
      const flipImg = Boolean(document.getElementById('chk-dat-reverse-flip-img')?.checked);
      this.reverseFormation({ appendAsNew: true, flipDirections: flipImg });
    });
  }

  // 生成AI等から得た複数オブジェクトをコレクションとしてセット
  setItems(rawItems) {
    this.items = (rawItems || []).map(cloneEntry);
    this.activeIndex = this.items.length > 0 ? 0 : -1;
    this.exportAll = true;
    const chk = document.getElementById('chk-dat-export-all-objects');
    if (chk) chk.checked = true;

    if (this.activeIndex >= 0) {
      this._loadItemIntoController(this.items[this.activeIndex]);
    }
    this.refreshUI();
  }

  saveActiveFromController() {
    if (this.activeIndex < 0 || this.activeIndex >= this.items.length) return;
    const objType = this.gen.currentObjType;
    const curState = this.gen._getObjState(objType);
    const values = { ...curState };
    if (Array.isArray(values.climates)) values.climates = [...values.climates];
    this.items[this.activeIndex] = {
      objType,
      common: cloneCommon(this.gen.common),
      values
    };
  }

  _loadItemIntoController(item) {
    this.gen.currentObjType = item.objType;
    this.gen.common = cloneCommon(item.common);
    const values = { ...item.values };
    if (Array.isArray(values.climates)) values.climates = [...values.climates];
    this.gen.stateByObj[item.objType] = values;
    this.gen._applyControllerStateToForm();
  }

  selectItem(idx) {
    if (idx < 0 || idx >= this.items.length || idx === this.activeIndex) return;
    this.saveActiveFromController();
    this.activeIndex = idx;
    this._loadItemIntoController(this.items[idx]);
    this.refreshUI();
    if (this.gen.autoSync) this.gen.regenerateOutput();
  }

  duplicateActive() {
    if (this.items.length === 0) return;
    this.saveActiveFromController();
    const cur = cloneEntry(this.items[this.activeIndex]);
    cur.common.name = `${cur.common.name || 'obj'}_copy`;
    const nextRow = parseInt(cur.common.startRow, 10);
    if (!Number.isNaN(nextRow)) cur.common.startRow = String(nextRow + 1);
    this.items.splice(this.activeIndex + 1, 0, cur);
    this.activeIndex += 1;
    this._loadItemIntoController(cur);
    this.refreshUI();
    if (this.gen.autoSync) this.gen.regenerateOutput();
  }

  deleteActive() {
    if (this.items.length <= 1) {
      this.resetToSingle();
      return;
    }
    this.items.splice(this.activeIndex, 1);
    this.activeIndex = Math.min(this.activeIndex, this.items.length - 1);
    this._loadItemIntoController(this.items[this.activeIndex]);
    this.refreshUI();
    if (this.gen.autoSync) this.gen.regenerateOutput();
  }

  resetToSingle() {
    this.saveActiveFromController();
    this.items = [];
    this.activeIndex = -1;
    this.refreshUI();
    if (this.gen.autoSync) this.gen.regenerateOutput();
  }

  // 編成反転（順序逆転 + constraint[prev/next] 入替 + 任意で画像向き180度反転）
  reverseFormation({ appendAsNew = false, flipDirections = true } = {}) {
    if (this.items.length === 0) return;
    this.saveActiveFromController();

    const revItems = [...this.items].reverse().map(cloneEntry);
    let nameMap = null;
    if (appendAsNew) {
      nameMap = new Map();
      revItems.forEach((it) => {
        const oldName = it.common.name;
        const newName = addRevSuffixToName(oldName);
        nameMap.set(oldName, newName);
        it.common.name = newName;
      });
    }

    revItems.forEach((it) => {
      if (it.objType === 'vehicle') {
        const oldPrev = it.values.constraintsPrev;
        const oldNext = it.values.constraintsNext;
        it.values.constraintsPrev = remapConstraintLines(oldNext, nameMap);
        it.values.constraintsNext = remapConstraintLines(oldPrev, nameMap);
      }
      if (flipDirections) {
        it.common.flipDirections = !Boolean(it.common.flipDirections);
        if (it.common.customImageCoords) {
          it.common.customImageCoords = flipCustomImageCoords180(it.common.customImageCoords);
        }
      }
    });

    if (appendAsNew) {
      const insertAt = this.items.length;
      this.items = [...this.items, ...revItems];
      this.activeIndex = insertAt;
    } else {
      this.items = revItems;
      this.activeIndex = 0;
    }

    this._loadItemIntoController(this.items[this.activeIndex]);
    this.refreshUI();
    this.gen.liveryMgr?.clearBaseNameCache();
    this.gen.autoSync = true;
    this.gen._updateSyncBadge();
    this.gen.regenerateOutput();
  }

  buildCombinedText() {
    if (!this.hasCollection() || !this.exportAll) {
      return null;
    }
    this.saveActiveFromController();
    return this.items
      .map(item => serializeDatObject(item.objType, item.values, item.common).trimEnd())
      .join('\n---\n') + '\n';
  }

  refreshUI() {
    const bar = document.getElementById('fs-dat-collection-bar');
    const sel = document.getElementById('sel-dat-active-object');
    if (!bar || !sel) return;

    if (!this.hasCollection()) {
      bar.style.display = 'none';
      sel.innerHTML = '';
      return;
    }

    bar.style.display = '';
    sel.innerHTML = this.items.map((item, idx) => {
      const selected = idx === this.activeIndex ? ' selected' : '';
      const name = item.common?.name || `obj_${idx + 1}`;
      return `<option value="${idx}"${selected}>[${idx + 1}/${this.items.length}] ${name} (${item.objType})</option>`;
    }).join('');
  }

  updateActiveOptionLabel() {
    if (!this.hasCollection() || this.activeIndex < 0) return;
    const sel = document.getElementById('sel-dat-active-object');
    const opt = sel?.options?.[this.activeIndex];
    if (opt) {
      const name = this.gen.common?.name || `obj_${this.activeIndex + 1}`;
      opt.textContent = `[${this.activeIndex + 1}/${this.items.length}] ${name} (${this.gen.currentObjType})`;
    }
  }
}

// datテキスト出力欄・ファイル読込・コピー・保存のイベントバインド
export function bindDatOutputActions(gen) {
  document.getElementById('inp-dat-filename').oninput = (e) => {
    e.target.dataset.userEdited = '1';
  };

  document.getElementById('chk-dat-auto-sync').onchange = (e) => {
    gen.autoSync = e.target.checked;
    gen._updateSyncBadge();
    if (gen.autoSync) gen.regenerateOutput();
  };

  document.getElementById('txt-dat-output').oninput = () => {
    if (gen.autoSync) {
      gen.autoSync = false;
      gen._updateSyncBadge();
    }
  };

  document.getElementById('btn-dat-regenerate').onclick = () => {
    gen.autoSync = true;
    gen._updateSyncBadge();
    gen.regenerateOutput();
  };

  document.getElementById('btn-dat-append').onclick = () => gen.appendCurrentObject();

  document.getElementById('btn-dat-clear').onclick = () => {
    const txt = document.getElementById('txt-dat-output');
    if (txt) txt.value = '';
    gen.autoSync = false;
    gen._updateSyncBadge('手動編集中 (空)');
  };

  document.getElementById('btn-dat-load-file').onclick = async () => {
    if (!gen.pickFileFn) return;
    const f = await gen.pickFileFn('.dat,.txt');
    if (!f) return;
    const content = await f.text();
    const txt = document.getElementById('txt-dat-output');
    if (txt) txt.value = content;
    const inpFilename = document.getElementById('inp-dat-filename');
    if (inpFilename) {
      inpFilename.value = f.name;
      inpFilename.dataset.userEdited = '1';
    }
    gen.autoSync = false;
    gen._updateSyncBadge('読込ファイル編集中');
  };

  document.getElementById('btn-dat-copy').onclick = async () => {
    const txt = document.getElementById('txt-dat-output');
    if (!txt || !txt.value) return;
    try {
      await navigator.clipboard.writeText(txt.value);
      gen._updateSyncBadge('コピーしました！');
      setTimeout(() => gen._updateSyncBadge(), 1500);
    } catch (err) {
      txt.select();
      document.execCommand('copy');
    }
  };

  document.getElementById('btn-dat-save-file').onclick = () => {
    const txt = document.getElementById('txt-dat-output')?.value || '';
    if (!txt.trim()) {
      alert('保存するdatテキストが空です。');
      return;
    }
    const filename = document.getElementById('inp-dat-filename')?.value || 'addon.dat';
    downloadDatText(txt, filename);
  };
}
