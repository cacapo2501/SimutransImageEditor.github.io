// テンプレート定義に従ってオブジェクト固有パラメータの入力欄を構築するモジュール
import { CLIMATE_OPTIONS } from './dat-templates.js';

export function renderDynamicDatFields(container, tpl, state, onChanged) {
  if (!container || !tpl) return;
  container.innerHTML = '';

  tpl.fields.forEach((field) => {
    const wrap = document.createElement('div');
    wrap.className = 'dat-field' + (field.fullWidth || field.type === 'checkbox' ? ' full-width' : '');

    if (field.type === 'checkbox') {
      const lbl = document.createElement('label');
      lbl.className = 'dat-check-item';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = Boolean(state[field.key]);
      cb.onchange = () => {
        state[field.key] = cb.checked;
        onChanged();
      };
      lbl.appendChild(cb);
      lbl.appendChild(document.createTextNode(field.label));
      wrap.appendChild(lbl);
      container.appendChild(wrap);
      return;
    }

    const lbl = document.createElement('label');
    lbl.textContent = field.label;
    wrap.appendChild(lbl);

    if (field.type === 'climates') {
      const grid = document.createElement('div');
      grid.className = 'dat-climate-grid';
      const selected = new Set(Array.isArray(state[field.key]) ? state[field.key] : []);
      CLIMATE_OPTIONS.forEach((opt) => {
        const item = document.createElement('label');
        item.className = 'dat-climate-item';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = selected.has(opt.value);
        cb.onchange = () => {
          if (cb.checked) selected.add(opt.value);
          else selected.delete(opt.value);
          state[field.key] = CLIMATE_OPTIONS.map(o => o.value).filter(v => selected.has(v));
          onChanged();
        };
        item.appendChild(cb);
        item.appendChild(document.createTextNode(opt.label));
        grid.appendChild(item);
      });
      wrap.appendChild(grid);
      container.appendChild(wrap);
      return;
    }

    let inputEl;
    if (field.type === 'number_presets') {
      const box = document.createElement('div');
      box.style.display = 'flex';
      box.style.flexDirection = 'column';
      box.style.gap = '4px';

      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.flexWrap = 'wrap';
      row.style.alignItems = 'center';
      row.style.gap = '4px';

      inputEl = document.createElement('input');
      inputEl.type = 'number';
      if (field.min !== undefined) inputEl.min = String(field.min);
      if (field.max !== undefined) inputEl.max = String(field.max);
      inputEl.style.width = '76px';
      inputEl.value = state[field.key] ?? '';

      const presetWrap = document.createElement('div');
      presetWrap.className = 'btn-group';
      presetWrap.style.flexWrap = 'wrap';
      presetWrap.style.flex = '1';

      const syncPresetActive = () => {
        const cur = String(state[field.key] ?? '').trim();
        presetWrap.querySelectorAll('button').forEach(b => {
          b.classList.toggle('btn-primary', b.dataset.val === cur);
        });
      };

      (field.presets || []).forEach((p) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn-sm';
        btn.dataset.val = String(p.value);
        btn.textContent = p.label;
        if (p.title) btn.title = p.title;
        btn.onclick = () => {
          state[field.key] = String(p.value);
          inputEl.value = String(p.value);
          syncPresetActive();
          onChanged();
        };
        presetWrap.appendChild(btn);
      });

      inputEl.oninput = () => {
        state[field.key] = inputEl.value;
        syncPresetActive();
        onChanged();
      };

      row.appendChild(inputEl);
      row.appendChild(presetWrap);
      box.appendChild(row);
      if (field.hint) {
        const hintEl = document.createElement('div');
        hintEl.className = 'info-text';
        hintEl.textContent = field.hint;
        box.appendChild(hintEl);
      }
      syncPresetActive();
      wrap.appendChild(box);
      container.appendChild(wrap);
      return;
    }

    if (field.type === 'select') {
      inputEl = document.createElement('select');
      (field.options || []).forEach((opt) => {
        const o = document.createElement('option');
        o.value = opt.value;
        o.textContent = opt.label;
        inputEl.appendChild(o);
      });
      inputEl.value = state[field.key] ?? '';
      inputEl.onchange = () => {
        state[field.key] = inputEl.value;
        onChanged();
      };
    } else if (field.type === 'textarea') {
      inputEl = document.createElement('textarea');
      inputEl.placeholder = field.placeholder || '';
      inputEl.value = state[field.key] ?? '';
      inputEl.oninput = () => {
        state[field.key] = inputEl.value;
        onChanged();
      };
    } else {
      inputEl = document.createElement('input');
      inputEl.type = field.type === 'number' ? 'number' : 'text';
      if (field.min !== undefined) inputEl.min = String(field.min);
      if (field.max !== undefined) inputEl.max = String(field.max);
      if (field.placeholder) inputEl.placeholder = field.placeholder;
      inputEl.value = state[field.key] ?? '';
      inputEl.oninput = () => {
        state[field.key] = inputEl.value;
        onChanged();
      };
    }

    wrap.appendChild(inputEl);
    container.appendChild(wrap);
  });
}
