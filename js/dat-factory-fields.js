// 工場 (factory) から任意の field 定義を読み込み・設定するパネル
import { renderTunnelWayPanel } from './dat-tunnel-way.js';

export function renderDatAuxPanels(gen, onChanged) {
  const state = gen._getObjState(gen.currentObjType);
  renderTunnelWayPanel(document.getElementById('dat-tunnel-way-box'), gen, state, onChanged);
  renderFactoryFieldsPanel(document.getElementById('dat-factory-fields-box'), gen, state, onChanged);
}

// .dat テキストから obj=field の定義（name, has_snow）および既存 fields[i] 参照名を抽出する
export function parseFieldDefsFromDatText(rawText) {
  const map = new Map();
  const upsert = (name, hasSnow = true) => {
    const clean = String(name || '').trim();
    if (!clean) return;
    if (!map.has(clean)) map.set(clean, { name: clean, has_snow: hasSnow });
  };

  const blocks = String(rawText || '').split(/^\s*---+\s*$/m);
  blocks.forEach((block) => {
    const lines = block.split(/\r?\n/);
    let curObj = '';
    let curName = '';
    let curSnow = true;
    lines.forEach((line) => {
      const clean = line.split('#')[0].trim();
      if (!clean) return;
      const mObj = clean.match(/^obj\s*=\s*(.+)$/i);
      if (mObj) {
        if (curObj === 'field' && curName) upsert(curName, curSnow);
        curObj = mObj[1].trim().toLowerCase();
        curName = '';
        curSnow = true;
        return;
      }
      const mName = clean.match(/^name\s*=\s*(.+)$/i);
      if (mName) curName = mName[1].trim();
      const mSnow = clean.match(/^has_snow\s*=\s*(\d+)/i);
      if (mSnow) curSnow = mSnow[1] !== '0';
      const mField = clean.match(/^fields(?:\[\d+\])?\s*=\s*(.+)$/i);
      if (mField) upsert(mField[1].trim(), true);
    });
    if (curObj === 'field' && curName) upsert(curName, curSnow);
  });
  return Array.from(map.values());
}

export function parseFieldNamesFromDatText(rawText) {
  return parseFieldDefsFromDatText(rawText).map(d => d.name);
}

// 工場のフィールド設定パネルを描画する
export function renderFactoryFieldsPanel(container, gen, state, onChanged) {
  if (!container) return;
  if (gen.currentObjType === 'field' && state) {
    renderFieldSyncHelper(container, gen, state, onChanged);
    return;
  }
  if (gen.currentObjType !== 'factory' || !state) {
    container.style.display = 'none';
    container.innerHTML = '';
    return;
  }

  if (!Array.isArray(state.fieldRefs)) state.fieldRefs = [];
  container.style.display = '';
  container.innerHTML = '';

  const header = document.createElement('div');
  header.style.cssText = 'font-size:11px; font-weight:bold; color:#9cdcfe; margin-bottom:4px;';
  header.textContent = '🌾 周辺フィールド連携 (fields[i] / makeobj51+ — 任意fieldの読込・追加)';
  container.appendChild(header);

  const btnRow = document.createElement('div');
  btnRow.className = 'btn-group';
  const addBtn = (text, title, onClick) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn-sm';
    b.textContent = text;
    b.title = title;
    b.onclick = onClick;
    btnRow.appendChild(b);
  };

  addBtn('＋ 手入力追加', '空の field 行を追加します', () => {
    state.fieldRefs.push({ name: '', production: '1', weight: '50', capacity: '', has_snow: true });
    renderFactoryFieldsPanel(container, gen, state, onChanged);
    onChanged();
  });

  addBtn('📂 .datから読込', 'obj=field を含む .dat ファイルからフィールド名を取り込みます', async () => {
    if (!gen.pickFileFn) return;
    const f = await gen.pickFileFn('.dat,.txt');
    if (!f) return;
    const text = await f.text();
    const found = parseFieldDefsFromDatText(text);
    if (found.length === 0) {
      alert('選択されたファイル内に obj=field の name= または fields= が見つかりませんでした。');
      return;
    }
    found.forEach((def) => {
      if (!state.fieldRefs.some(r => r.name === def.name)) {
        state.fieldRefs.push({ name: def.name, production: '1', weight: '50', capacity: '', has_snow: def.has_snow });
      }
    });
    renderFactoryFieldsPanel(container, gen, state, onChanged);
    onChanged();
  });

  addBtn('📥 編集中のfieldを追加', 'このツール内で設定中の obj=field 名と設定を取り込みます', () => {
    const candidates = [];
    const curFieldSt = gen.stateByObj?.field;
    const curFieldName = curFieldSt?.name || (gen.collectionMgr?.items || []).find(it => it.objType === 'field')?.common?.name;
    if (curFieldName) {
      candidates.push({
        name: curFieldName,
        production: curFieldSt?.production_per_field || '16',
        weight: curFieldSt?.spawn_weight || '100',
        capacity: curFieldSt?.storage_capacity || '0',
        has_snow: Boolean(curFieldSt?.has_snow)
      });
    }
    (gen.collectionMgr?.items || []).forEach(it => {
      if (it.objType === 'field' && it.common?.name && !candidates.some(c => c.name === it.common.name)) {
        candidates.push({
          name: it.common.name,
          production: it.values?.production_per_field || '16',
          weight: it.values?.spawn_weight || '100',
          capacity: it.values?.storage_capacity || '0',
          has_snow: Boolean(it.values?.has_snow)
        });
      }
    });
    const added = candidates.filter(c => c.name && !state.fieldRefs.some(r => r.name === c.name));
    if (added.length === 0) {
      alert('取り込める未登録の field 名がありません（先に種別「field」で名前を設定してください）。');
      return;
    }
    added.forEach(c => state.fieldRefs.push(c));
    if (curFieldSt) {
      ['min_fields', 'max_fields', 'start_fields', 'probability_to_spawn'].forEach(k => {
        if (!state[k] && curFieldSt[k]) state[k] = curFieldSt[k];
      });
      gen._renderDynamicFields();
    }
    renderFactoryFieldsPanel(container, gen, state, onChanged);
    onChanged();
  });

  container.appendChild(btnRow);

  state.fieldRefs.forEach((ref, idx) => {
    const row = document.createElement('div');
    row.className = 'row mt-05';
    row.style.gap = '4px';

    const mkInp = (val, ph, w, key, isNum = false) => {
      const el = document.createElement('input');
      el.type = isNum ? 'number' : 'text';
      el.value = val ?? '';
      el.placeholder = ph;
      el.style.width = w;
      el.oninput = () => { ref[key] = el.value; onChanged(); };
      return el;
    };

    const inpName = mkInp(ref.name, `fields[${idx}] 名`, '36%', 'name');
    inpName.style.flex = '1';
    row.appendChild(inpName);
    row.appendChild(mkInp(ref.production, '生産+', '50px', 'production', true));
    row.appendChild(mkInp(ref.weight, '重み', '48px', 'weight', true));
    row.appendChild(mkInp(ref.capacity, '容量+', '50px', 'capacity', true));

    const snowLbl = document.createElement('label');
    snowLbl.style.cssText = 'display:inline-flex; align-items:center; gap:2px; font-size:10px; color:#ccc; white-space:nowrap;';
    snowLbl.title = `has_snow[${idx}] (雪画像あり)`;
    const snowChk = document.createElement('input');
    snowChk.type = 'checkbox';
    snowChk.checked = ref.has_snow !== false;
    snowChk.onchange = () => { ref.has_snow = snowChk.checked; onChanged(); };
    snowLbl.appendChild(snowChk);
    snowLbl.appendChild(document.createTextNode('雪'));
    row.appendChild(snowLbl);

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'btn-sm';
    del.style.color = '#ff8888';
    del.textContent = '✕';
    del.onclick = () => {
      state.fieldRefs.splice(idx, 1);
      renderFactoryFieldsPanel(container, gen, state, onChanged);
      onChanged();
    };
    row.appendChild(del);
    container.appendChild(row);
  });

  const hint = document.createElement('div');
  hint.className = 'info-text mt-05';
  hint.textContent = state.fieldRefs.length > 0
    ? '各行: field名 / production_per_field / spawn_weight / storage_capacity / has_snow'
    : '任意: 畑や牧場などの field 名を手入力または .dat から読み込んで紐付けられます。';
  container.appendChild(hint);
}

// obj=field 編集時の季節/雪画像連動ガイドと factory 連携反映ボタンを描画する
function renderFieldSyncHelper(container, gen, state) {
  const seasons = Math.max(1, parseInt(state.seasons, 10) || 1);
  const hasSnow = Boolean(state.has_snow);
  const total = seasons + (hasSnow ? 1 : 0);
  container.style.display = '';
  container.innerHTML = '';

  const info = document.createElement('div');
  info.className = 'info-text';
  info.style.color = '#9cdcfe';
  info.textContent = hasSnow
    ? `❄️ 季節${seasons}パターン + 雪画像1枚 → 出力: Image[0..${total - 1}] (末尾 Image[${total - 1}] が雪画像 / has_snow=1)`
    : `🌾 季節${seasons}パターン (雪なし) → 出力: Image[0..${total - 1}] (has_snow=0)`;
  container.appendChild(info);

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn-sm mt-05';
  btn.textContent = '🏭 makeobj46/51/55 連携値を factory テンプレートへ反映';
  btn.onclick = () => {
    const fState = gen._getObjState('factory');
    ['min_fields', 'max_fields', 'start_fields', 'probability_to_spawn'].forEach(k => {
      if (state[k] !== undefined && String(state[k]).trim() !== '') fState[k] = state[k];
    });
    if (!Array.isArray(fState.fieldRefs)) fState.fieldRefs = [];
    const fname = (gen.common?.name || state.name || 'new_field').trim();
    const existing = fState.fieldRefs.find(r => r.name === fname);
    const entry = {
      name: fname,
      production: state.production_per_field || '16',
      weight: state.spawn_weight || '100',
      capacity: state.storage_capacity || '0',
      has_snow: hasSnow
    };
    if (existing) Object.assign(existing, entry);
    else fState.fieldRefs.push(entry);
    alert(`factory テンプレートへ "${fname}" と makeobj46/51/55 連携値を反映しました。`);
  };
  container.appendChild(btn);
}
