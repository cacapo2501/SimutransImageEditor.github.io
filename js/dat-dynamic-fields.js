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
