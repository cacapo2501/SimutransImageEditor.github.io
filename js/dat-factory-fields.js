// 工場 (factory) から任意の field 定義を読み込み・設定するパネル

// .dat テキストから obj=field の name および既存 fields[i] 参照名を抽出する
export function parseFieldNamesFromDatText(rawText) {
  const names = [];
  const pushUnique = (val) => {
    const clean = String(val || '').trim();
    if (clean && !names.includes(clean)) names.push(clean);
  };

  const blocks = String(rawText || '').split(/^\s*---+\s*$/m);
  blocks.forEach((block) => {
    const lines = block.split(/\r?\n/);
    let curObj = '';
    let curName = '';
    lines.forEach((line) => {
      const clean = line.split('#')[0].trim();
      if (!clean) return;
      const mObj = clean.match(/^obj\s*=\s*(.+)$/i);
      if (mObj) {
        if (curObj === 'field' && curName) pushUnique(curName);
        curObj = mObj[1].trim().toLowerCase();
        curName = '';
        return;
      }
      const mName = clean.match(/^name\s*=\s*(.+)$/i);
      if (mName) curName = mName[1].trim();
      const mField = clean.match(/^fields(?:\[\d+\])?\s*=\s*(.+)$/i);
      if (mField) pushUnique(mField[1].trim());
    });
    if (curObj === 'field' && curName) pushUnique(curName);
  });
  return names;
}

// 工場のフィールド設定パネルを描画する
export function renderFactoryFieldsPanel(container, gen, state, onChanged) {
  if (!container) return;
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
  header.textContent = '🌾 周辺フィールド連携 (fields[i] — 任意fieldの読込・追加)';
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
    state.fieldRefs.push({ name: '', production: '1', weight: '50', capacity: '' });
    renderFactoryFieldsPanel(container, gen, state, onChanged);
    onChanged();
  });

  addBtn('📂 .datから読込', 'obj=field を含む .dat ファイルからフィールド名を取り込みます', async () => {
    if (!gen.pickFileFn) return;
    const f = await gen.pickFileFn('.dat,.txt');
    if (!f) return;
    const text = await f.text();
    const found = parseFieldNamesFromDatText(text);
    if (found.length === 0) {
      alert('選択されたファイル内に obj=field の name= または fields= が見つかりませんでした。');
      return;
    }
    found.forEach((fname) => {
      if (!state.fieldRefs.some(r => r.name === fname)) {
        state.fieldRefs.push({ name: fname, production: '1', weight: '50', capacity: '' });
      }
    });
    renderFactoryFieldsPanel(container, gen, state, onChanged);
    onChanged();
  });

  addBtn('📥 編集中のfieldを追加', 'このツール内で設定中の obj=field 名を取り込みます', () => {
    const candidates = [];
    const curField = gen.stateByObj?.field?.name;
    if (curField) candidates.push(curField);
    (gen.collectionMgr?.items || []).forEach(it => {
      if (it.objType === 'field' && it.common?.name) candidates.push(it.common.name);
    });
    const added = candidates.filter(n => n && !state.fieldRefs.some(r => r.name === n));
    if (added.length === 0) {
      alert('取り込める未登録の field 名がありません（先に種別「field」で名前を設定してください）。');
      return;
    }
    added.forEach(n => state.fieldRefs.push({ name: n, production: '1', weight: '50', capacity: '' }));
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

    const inpName = mkInp(ref.name, `fields[${idx}] 名`, '42%', 'name');
    inpName.style.flex = '1';
    row.appendChild(inpName);
    row.appendChild(mkInp(ref.production, '生産+', '56px', 'production', true));
    row.appendChild(mkInp(ref.weight, '重み', '54px', 'weight', true));
    row.appendChild(mkInp(ref.capacity, '容量+', '56px', 'capacity', true));

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
    ? '各行: field名 / production_per_field / spawn_weight / storage_capacity'
    : '任意: 畑や牧場などの field 名を手入力または .dat から読み込んで紐付けられます。';
  container.appendChild(hint);
}
