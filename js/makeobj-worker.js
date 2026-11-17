// Web Worker 上で Emscripten ビルド版 makeobj (WASM) を実行するモジュール

let cachedFactory = null;

async function getModuleFactory() {
  if (cachedFactory) return cachedFactory;
  const mod = await import('../wasm/makeobj.js');
  const factory = mod.default || mod.createMakeobjModule;
  if (typeof factory !== 'function') {
    throw new Error('wasm/makeobj.js から createMakeobjModule を読み込めませんでした。');
  }
  cachedFactory = factory;
  return cachedFactory;
}

self.onmessage = async (event) => {
  const { id, args, files, pakFilename } = event.data || {};
  const stdoutLines = [];
  const stderrLines = [];

  try {
    const createMakeobjModule = await getModuleFactory();
    const mod = await createMakeobjModule({
      locateFile: (path) => new URL(`../wasm/${path}`, import.meta.url).href,
      print: (txt) => stdoutLines.push(String(txt)),
      printErr: (txt) => stderrLines.push(String(txt))
    });

    const workDir = '/work';
    try {
      mod.FS.mkdir(workDir);
    } catch (e) {
      // 既存ディレクトリ時は無視
    }
    mod.FS.chdir(workDir);

    (files || []).forEach((f) => {
      const safeName = String(f.name || '').replace(/^[\\/]+/, '');
      if (!safeName) return;
      const parts = safeName.split('/').filter(Boolean);
      let cur = workDir;
      for (let i = 0; i < parts.length - 1; i++) {
        cur += '/' + parts[i];
        try { mod.FS.mkdir(cur); } catch (e) { /* ignore */ }
      }
      mod.FS.writeFile(`${workDir}/${parts.join('/')}`, new Uint8Array(f.data));
    });

    let exitCode = 0;
    try {
      const rc = mod.callMain(args || []);
      if (typeof rc === 'number') exitCode = rc;
    } catch (err) {
      if (err && typeof err.status === 'number') {
        exitCode = err.status;
      } else {
        throw err;
      }
    }

    let pakBytes = null;
    if (pakFilename) {
      try {
        const out = mod.FS.readFile(`${workDir}/${pakFilename}`);
        if (out && out.length > 0) {
          pakBytes = new Uint8Array(out);
        }
      } catch (e) {
        // .pak 生成失敗時は null のまま
      }
    }

    const ok = exitCode === 0 && Boolean(pakBytes && pakBytes.length > 0);
    const payload = {
      id,
      ok,
      exitCode,
      stdout: stdoutLines.join('\n'),
      stderr: stderrLines.join('\n'),
      pakFilename,
      pakBytes: pakBytes ? pakBytes.buffer : null
    };
    if (pakBytes) {
      self.postMessage(payload, [pakBytes.buffer]);
    } else {
      self.postMessage(payload);
    }
  } catch (err) {
    self.postMessage({
      id,
      ok: false,
      exitCode: -1,
      stdout: stdoutLines.join('\n'),
      stderr: [stderrLines.join('\n'), err?.message || String(err)].filter(Boolean).join('\n'),
      pakFilename,
      pakBytes: null
    });
  }
};
