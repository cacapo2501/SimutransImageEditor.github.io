// makeobj (WASM) のメタデータ読込・メイン画面バージョン表示・ライセンスモーダル・実行サービス

const META_URL = './wasm/makeobj-meta.json';
const LICENSE_URL = './wasm/LICENSE_SIMUTRANS.txt';
const NOTICE_URL = './wasm/NOTICE.md';

let cachedMeta = null;
let jobSeq = 1;

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function loadMakeobjMeta(force = false) {
  if (cachedMeta && !force) return cachedMeta;
  try {
    const res = await fetch(META_URL, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    cachedMeta = await res.json();
  } catch (err) {
    cachedMeta = {
      available: false,
      edition: 'Standard',
      version: '',
      simutransVersion: '',
      banner: '',
      sourceRepo: 'https://github.com/simutrans/simutrans',
      license: 'Artistic License 1.0'
    };
  }
  return cachedMeta;
}

export function renderMakeobjVersionBadge(meta) {
  const el = document.getElementById('makeobj-version');
  if (!el) return;
  if (meta && meta.available && meta.version) {
    const simPart = meta.simutransVersion ? ` / Simutrans ${meta.simutransVersion}` : '';
    el.textContent = `makeobj ${meta.version} (Standard)`;
    el.title = `${meta.banner || `makeobj ${meta.version}${simPart}`} | ${meta.license || 'Artistic License 1.0'} (クリックで詳細・ライセンス表示)`;
    el.classList.remove('unbuilt');
  } else {
    el.textContent = 'makeobj: 未ビルド (Standard)';
    el.title = 'makeobj WASM は未ビルドです（クリックで詳細・Artistic License 1.0 情報を表示）';
    el.classList.add('unbuilt');
  }
}

export async function initMakeobjStatus() {
  const meta = await loadMakeobjMeta();
  renderMakeobjVersionBadge(meta);
  document.getElementById('makeobj-version')?.addEventListener('click', () => {
    openMakeobjLicenseModal();
  });
  return meta;
}

function ensureLicenseModal() {
  let modal = document.getElementById('modal-makeobj-license');
  if (modal) return modal;
  const container = document.getElementById('modal-container') || document.body;
  container.insertAdjacentHTML('beforeend', `
    <dialog id="modal-makeobj-license">
      <div class="makeobj-lic-box">
        <header class="dat-header">
          <h3>⚙️ Simutrans makeobj (Standard) バージョン ＆ ライセンス情報</h3>
          <button type="button" id="btn-makeobj-lic-close-top" style="margin-left:auto;">✕ 閉じる</button>
        </header>
        <div class="makeobj-lic-body">
          <div id="makeobj-lic-summary" class="makeobj-lic-summary"></div>
          <div class="makeobj-lic-section">
            <div class="makeobj-lic-label">出典・変更点の明記 (Artistic License 1.0 準拠)</div>
            <pre id="pre-makeobj-notice" class="makeobj-lic-pre">読込中...</pre>
          </div>
          <div class="makeobj-lic-section">
            <div class="makeobj-lic-label">Simutrans ライセンス本文 (LICENSE_SIMUTRANS.txt)</div>
            <pre id="pre-makeobj-license-txt" class="makeobj-lic-pre">読込中...</pre>
          </div>
        </div>
        <footer class="dat-footer">
          <a href="https://github.com/simutrans/simutrans" target="_blank" rel="noopener noreferrer" style="color:#79d8ff; font-size:11px;">🔗 Simutrans 公式 GitHub リポジトリ</a>
          <button type="button" id="btn-makeobj-lic-close" class="btn-primary" style="margin-left:auto;">閉じる</button>
        </footer>
      </div>
    </dialog>
  `);
  modal = document.getElementById('modal-makeobj-license');
  const close = () => modal.close();
  document.getElementById('btn-makeobj-lic-close-top')?.addEventListener('click', close);
  document.getElementById('btn-makeobj-lic-close')?.addEventListener('click', close);
  return modal;
}

async function fetchTextOrFallback(url, fallback) {
  try {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) return fallback;
    return await res.text();
  } catch (e) {
    return fallback;
  }
}

export async function openMakeobjLicenseModal() {
  const modal = ensureLicenseModal();
  const meta = await loadMakeobjMeta(true);
  renderMakeobjVersionBadge(meta);

  const sumEl = document.getElementById('makeobj-lic-summary');
  if (sumEl) {
    const statusText = meta.available
      ? `<span style="color:#7ce38b; font-weight:bold;">利用可能</span> (${escapeHtml(meta.banner || `makeobj ${meta.version}`)})`
      : '<span style="color:#ffcc66; font-weight:bold;">未ビルド</span> (GitHub Actions「Build Simutrans Standard makeobj (WASM)」を実行すると wasm/ に生成されます)';
    sumEl.innerHTML = [
      `<div><b>エディション:</b> Simutrans ${escapeHtml(meta.edition || 'Standard')}</div>`,
      `<div><b>makeobj バージョン:</b> ${escapeHtml(meta.version || '未取得')} (対象 Simutrans: ${escapeHtml(meta.simutransVersion || '未取得')})</div>`,
      `<div><b>状態:</b> ${statusText}</div>`,
      `<div><b>ライセンス:</b> ${escapeHtml(meta.license || 'Artistic License 1.0')}</div>`,
      `<div><b>取得リファレンス / Commit:</b> <code>${escapeHtml(meta.sourceRef || '-')}</code> / <code>${escapeHtml(meta.commit || '-')}</code></div>`,
      `<div><b>ビルド日時 (UTC):</b> ${escapeHtml(meta.builtAt || '-')}</div>`
    ].join('');
  }

  if (typeof modal.showModal === 'function') modal.showModal();
  else modal.setAttribute('open', '');

  const [noticeTxt, licTxt] = await Promise.all([
    fetchTextOrFallback(NOTICE_URL, 'wasm/NOTICE.md が見つかりません。'),
    fetchTextOrFallback(
      LICENSE_URL,
      'wasm/LICENSE_SIMUTRANS.txt は GitHub Actions の makeobj WASM ビルド実行時に公式リポジトリの LICENSE.txt (Artistic License 1.0) から自動配置されます。\n公式ライセンス: https://github.com/simutrans/simutrans/blob/master/LICENSE.txt'
    )
  ]);

  const noticeEl = document.getElementById('pre-makeobj-notice');
  const licEl = document.getElementById('pre-makeobj-license-txt');
  if (noticeEl) noticeEl.textContent = noticeTxt;
  if (licEl) licEl.textContent = licTxt;
}

/**
 * Web Worker で makeobj WASM を実行して .pak バイナリを生成する
 */
export async function runMakeobjCompile({ pakArg = 'pak', pakFilename = 'addon.pak', datFilename = 'addon.dat', datText = '', files = [] }) {
  const meta = await loadMakeobjMeta(true);
  if (!meta.available) {
    throw new Error(
      'makeobj WASM バイナリ (wasm/makeobj.js, wasm/makeobj.wasm) が未生成です。\n' +
      'GitHub リポジトリの Actions タブから「Build Simutrans Standard makeobj (WASM)」を実行してください。'
    );
  }

  const encoder = new TextEncoder();
  const workerFiles = [
    { name: datFilename, data: encoder.encode(datText) },
    ...files.map(f => ({ name: f.name, data: f.data instanceof Uint8Array ? f.data : new Uint8Array(f.data) }))
  ];
  const args = [pakArg || 'pak', pakFilename, datFilename];

  return new Promise((resolve, reject) => {
    const worker = new Worker('./js/makeobj-worker.js', { type: 'module' });
    const id = jobSeq++;
    const timer = setTimeout(() => {
      worker.terminate();
      reject(new Error('makeobj の実行がタイムアウトしました (60秒)。'));
    }, 60000);

    worker.onmessage = (e) => {
      if (e.data?.id !== id) return;
      clearTimeout(timer);
      worker.terminate();
      const { ok, exitCode, stdout, stderr, pakBytes } = e.data;
      const log = [stdout, stderr].filter(Boolean).join('\n').trim();
      const pakBlob = pakBytes ? new Blob([pakBytes], { type: 'application/octet-stream' }) : null;
      resolve({ ok, exitCode, log, pakBlob, pakFilename });
    };

    worker.onerror = (err) => {
      clearTimeout(timer);
      worker.terminate();
      reject(new Error('makeobj Worker エラー: ' + (err.message || 'unknown')));
    };

    worker.postMessage({ id, args, files: workerFiles, pakFilename });
  });
}
