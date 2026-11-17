// トンネル (tunnel) の way= を外部 .dat / .pak ファイルから読み込むモジュール

// .dat テキストから obj=way の name=（および既存 tunnel の way=）を抽出する
export function parseWayNamesFromDatText(rawText) {
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
    let curWayRef = '';
    lines.forEach((line) => {
      const clean = line.split('#')[0].trim();
      if (!clean) return;
      const mObj = clean.match(/^obj\s*=\s*(.+)$/i);
      if (mObj) {
        if (curObj === 'way' && curName) pushUnique(curName);
        if (curObj === 'tunnel' && curWayRef) pushUnique(curWayRef);
        curObj = mObj[1].trim().toLowerCase();
        curName = '';
        curWayRef = '';
        return;
      }
      const mName = clean.match(/^name\s*=\s*(.+)$/i);
      if (mName) curName = mName[1].trim();
      const mWay = clean.match(/^way\s*=\s*(.+)$/i);
      if (mWay) curWayRef = mWay[1].trim();
    });
    if (curObj === 'way' && curName) pushUnique(curName);
    if (curObj === 'tunnel' && curWayRef) pushUnique(curWayRef);
  });
  return names;
}

// Simutrans .pak バイナリから WAY ノードの最初の TEXT 子ノード（name）を抽出する
export function parseWayNamesFromPakBuffer(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  const len = bytes.length;
  if (len < 16) return [];

  // ヘッダ終端マーカー 0x1A (Ctrl+Z) の直後にある ROOT ノード位置を探す
  let markerIdx = -1;
  const searchLimit = Math.min(len, 512);
  for (let i = 0; i < searchLimit; i++) {
    if (bytes[i] === 0x1a) {
      markerIdx = i;
      break;
    }
  }
  if (markerIdx < 0) return [];

  let startOff = markerIdx + 5; // 0x1A(1byte) + version(4bytes)
  const readFourCC = (o) => (o + 4 <= len)
    ? String.fromCharCode(bytes[o], bytes[o + 1], bytes[o + 2], bytes[o + 3])
    : '';

  if (readFourCC(startOff) !== 'ROOT') {
    let found = -1;
    for (let o = markerIdx + 1; o <= Math.min(len - 8, markerIdx + 32); o++) {
      if (readFourCC(o) === 'ROOT') {
        found = o;
        break;
      }
    }
    if (found < 0) return [];
    startOff = found;
  }

  const dv = new DataView(arrayBuffer);
  const decoder = new TextDecoder('utf-8');
  const names = [];
  const stack = [{ type: '', remaining: 1, childIdx: 0 }];
  let off = startOff;

  while (off + 8 <= len && stack.length > 0) {
    const parent = stack[stack.length - 1];
    if (parent.remaining <= 0) {
      stack.pop();
      continue;
    }
    const myChildIdx = parent.childIdx++;
    parent.remaining -= 1;

    const nodeType = readFourCC(off);
    const nchildren = dv.getUint16(off + 4, true);
    let size = dv.getUint16(off + 6, true);
    let headerSize = 8;
    if (size === 0xffff) {
      if (off + 12 > len) break;
      size = dv.getUint32(off + 8, true);
      headerSize = 12;
    }

    const payloadStart = off + headerSize;
    const payloadEnd = payloadStart + size;
    if (payloadEnd > len) break;

    if (parent.type === 'WAY ' && myChildIdx === 0 && nodeType === 'TEXT' && size > 0) {
      const rawBytes = bytes.subarray(payloadStart, payloadEnd);
      const nul = rawBytes.indexOf(0);
      const slice = nul >= 0 ? rawBytes.subarray(0, nul) : rawBytes;
      const decoded = decoder.decode(slice).trim();
      if (decoded && !names.includes(decoded)) names.push(decoded);
    }

    off = payloadEnd;
    if (nchildren > 0) {
      stack.push({ type: nodeType, remaining: nchildren, childIdx: 0 });
    }
  }
  return names;
}

// トンネルの way= 外部ファイル読込UIを描画する
export function renderTunnelWayPanel(container, gen, state, onChanged) {
  if (!container) return;
  if (gen.currentObjType !== 'tunnel' || !state) {
    container.style.display = 'none';
    container.innerHTML = '';
    return;
  }

  container.style.display = '';
  container.innerHTML = '';

  const header = document.createElement('div');
  header.style.cssText = 'font-size:11px; font-weight:bold; color:#9cdcfe; margin-bottom:4px;';
  header.textContent = '🚇 トンネル内軌道 (way=) の外部読込';
  container.appendChild(header);

  const row = document.createElement('div');
  row.className = 'row';
  row.style.gap = '6px';

  const btnLoad = document.createElement('button');
  btnLoad.type = 'button';
  btnLoad.className = 'btn-sm';
  btnLoad.textContent = '📂 .dat / .pak から way= を読込';
  btnLoad.title = '外部の .dat または .pak ファイルから軌道名 (obj=way) を読み込んで設定します';

  const sel = document.createElement('select');
  sel.style.flex = '1';
  const candidates = Array.isArray(gen._loadedTunnelWays) ? gen._loadedTunnelWays : [];
  const syncSelectOptions = (list) => {
    sel.innerHTML = '';
    if (list.length === 0) {
      const o = document.createElement('option');
      o.value = '';
      o.textContent = '(外部ファイル未読込)';
      sel.appendChild(o);
      sel.disabled = true;
      return;
    }
    sel.disabled = false;
    list.forEach((wName) => {
      const o = document.createElement('option');
      o.value = wName;
      o.textContent = wName;
      sel.appendChild(o);
    });
    if (state.way && list.includes(state.way)) sel.value = state.way;
  };
  syncSelectOptions(candidates);

  sel.onchange = () => {
    if (!sel.value) return;
    state.way = sel.value;
    gen._renderDynamicFields();
    onChanged();
  };

  btnLoad.onclick = async () => {
    if (!gen.pickFileFn) return;
    const f = await gen.pickFileFn('.dat,.txt,.pak');
    if (!f) return;

    let found = [];
    if (/\.pak$/i.test(f.name)) {
      const buf = await f.arrayBuffer();
      found = parseWayNamesFromPakBuffer(buf);
    } else {
      const text = await f.text();
      found = parseWayNamesFromDatText(text);
    }

    if (found.length === 0) {
      alert('選択されたファイル内に軌道定義 (obj=way / WAYノード) が見つかりませんでした。');
      return;
    }

    gen._loadedTunnelWays = found;
    state.way = found[0];
    syncSelectOptions(found);
    sel.value = found[0];
    gen._renderDynamicFields();
    onChanged();
  };

  row.appendChild(btnLoad);
  row.appendChild(sel);
  container.appendChild(row);

  const hint = document.createElement('div');
  hint.className = 'info-text mt-05';
  hint.textContent = '※外部 .dat / .pak を読み込むと way= に軌道名を自動反映（複数ある場合は右の選択欄から切替）できます。';
  container.appendChild(hint);
}
