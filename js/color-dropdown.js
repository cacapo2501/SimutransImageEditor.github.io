let activeMenuEl = null;
let activeCloseHandler = null;

function closeActiveMenu() {
  if (activeMenuEl && activeMenuEl.parentNode) {
    activeMenuEl.parentNode.removeChild(activeMenuEl);
  }
  activeMenuEl = null;
  if (activeCloseHandler) {
    window.removeEventListener('pointerdown', activeCloseHandler, true);
    window.removeEventListener('keydown', activeCloseHandler, true);
    activeCloseHandler = null;
  }
}

export class ColorSwatchDropdown {
  constructor(mountEl, hiddenInputEl = null) {
    this.mountEl = mountEl;
    this.hiddenInputEl = hiddenInputEl;
    this.options = [];
    this.value = '';
    this.changeCallbacks = [];

    this.wrap = document.createElement('div');
    this.wrap.className = 'color-dd-wrap';

    this.trigger = document.createElement('button');
    this.trigger.type = 'button';
    this.trigger.className = 'color-dd-trigger';
    this.trigger.innerHTML = `
      <span class="color-dd-swatch"></span>
      <span class="color-dd-label">(選択してください)</span>
      <span class="color-dd-arrow">▼</span>
    `;

    this.wrap.appendChild(this.trigger);
    if (this.mountEl) {
      this.mountEl.innerHTML = '';
      this.mountEl.appendChild(this.wrap);
    }

    this.trigger.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (activeMenuEl && activeMenuEl.dataset.owner === this._uid) {
        closeActiveMenu();
      } else {
        this._openMenu();
      }
    };

    this._uid = Math.random().toString(36).slice(2);
  }

  onChange(fn) {
    if (typeof fn === 'function') this.changeCallbacks.push(fn);
  }

  setOptions(options) {
    this.options = Array.isArray(options) ? options : [];
    const exists = this.options.some(o => o.value === this.value && !o.disabled);
    if (!exists && this.options.length > 0) {
      const firstValid = this.options.find(o => !o.disabled);
      this.value = firstValid ? firstValid.value : '';
    }
    this._syncTriggerUI();
  }

  setValue(val) {
    this.value = val !== undefined && val !== null ? String(val) : '';
    if (this.hiddenInputEl) {
      this.hiddenInputEl.value = this.value;
    }
    this._syncTriggerUI();
  }

  getValue() {
    return this.value;
  }

  addOptionIfMissing(opt) {
    if (!this.options.some(o => o.value === opt.value)) {
      this.options.push(opt);
    }
    this.setValue(opt.value);
  }

  _syncTriggerUI() {
    if (this.hiddenInputEl) {
      this.hiddenInputEl.value = this.value;
    }
    const found = this.options.find(o => o.value === this.value);
    const swatchEl = this.trigger.querySelector('.color-dd-swatch');
    const labelEl = this.trigger.querySelector('.color-dd-label');

    if (found) {
      if (labelEl) labelEl.textContent = found.label;
      if (swatchEl) {
        if (found.colorHex) {
          swatchEl.style.background = found.colorHex;
        } else {
          swatchEl.style.background = 'linear-gradient(135deg, #333 45%, #888 50%, #333 55%)';
        }
      }
    } else {
      if (labelEl) labelEl.textContent = this.value || '(全体 / マスクなし)';
      if (swatchEl) {
        swatchEl.style.background = /^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/.test(this.value)
          ? this.value
          : 'linear-gradient(135deg, #333 45%, #888 50%, #333 55%)';
      }
    }
  }

  _openMenu() {
    closeActiveMenu();
    if (this.options.length === 0) return;

    const menu = document.createElement('div');
    menu.className = 'color-dd-menu';
    menu.dataset.owner = this._uid;

    this.options.forEach(opt => {
      const item = document.createElement('div');
      item.className = 'color-dd-item'
        + (opt.value === this.value ? ' selected' : '')
        + (opt.disabled ? ' disabled' : '');

      const sw = document.createElement('span');
      sw.className = 'color-dd-swatch';
      if (opt.colorHex) {
        sw.style.background = opt.colorHex;
      }

      const txt = document.createElement('span');
      txt.className = 'color-dd-label';
      txt.textContent = opt.label;

      item.appendChild(sw);
      item.appendChild(txt);

      if (!opt.disabled) {
        item.onclick = (e) => {
          e.stopPropagation();
          this.setValue(opt.value);
          closeActiveMenu();
          if (this.hiddenInputEl && typeof this.hiddenInputEl.onchange === 'function') {
            this.hiddenInputEl.onchange({ target: this.hiddenInputEl });
          }
          this.changeCallbacks.forEach(cb => cb(this.value));
        };
      }
      menu.appendChild(item);
    });

    const parentDialog = this.trigger.closest('dialog');
    const host = parentDialog || document.body;
    host.appendChild(menu);

    const rect = this.trigger.getBoundingClientRect();
    const menuW = Math.max(rect.width, 180);
    const spaceBelow = window.innerHeight - rect.bottom - 10;
    const menuH = Math.min(220, this.options.length * 30 + 8);

    menu.style.width = `${menuW}px`;
    menu.style.left = `${Math.max(6, Math.min(window.innerWidth - menuW - 6, rect.left))}px`;
    if (spaceBelow < menuH && rect.top > menuH) {
      menu.style.top = `${Math.max(6, rect.top - menuH - 2)}px`;
    } else {
      menu.style.top = `${rect.bottom + 2}px`;
    }

    const selItem = menu.querySelector('.selected');
    if (selItem) selItem.scrollIntoView({ block: 'nearest' });

    activeMenuEl = menu;
    activeCloseHandler = (ev) => {
      if (ev.type === 'keydown') {
        if (ev.code === 'Escape') {
          ev.stopPropagation();
          closeActiveMenu();
        }
        return;
      }
      if (!menu.contains(ev.target) && !this.trigger.contains(ev.target)) {
        closeActiveMenu();
      }
    };

    window.addEventListener('pointerdown', activeCloseHandler, true);
    window.addEventListener('keydown', activeCloseHandler, true);
  }
}
