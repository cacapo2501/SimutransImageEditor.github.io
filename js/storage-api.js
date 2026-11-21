// ローカルファイルシステム (File System Access API / フォールバック) & Google Drive 連携

export class StorageAPI {
  constructor() {
    this.lastProjectHandle = null;
    this.currentProjectName = null;
  }

  // 現在のプロジェクト保存先ハンドルを解除する（別プロジェクトへの無断上書きを防止）
  clearProjectHandle() {
    this.lastProjectHandle = null;
    this.currentProjectName = null;
  }

  // JSONファイルの保存（プロジェクト保存 / 別名保存対応・iPad Safari フォールバック付き）
  async saveJsonFile(jsonStr, defaultName = 'project.proj.json', { saveAs = false } = {}) {
    const blob = new Blob([jsonStr], { type: 'application/json' });

    // 1. File System Access API (PC Chrome / Edge 等) が利用可能な場合
    if (typeof window.showSaveFilePicker === 'function') {
      try {
        let handle = (!saveAs && this.lastProjectHandle) ? this.lastProjectHandle : null;
        if (!handle) {
          handle = await window.showSaveFilePicker({
            suggestedName: defaultName,
            types: [
              {
                description: 'Simutrans Project JSON (*.proj.json)',
                accept: { 'application/json': ['.json'] }
              }
            ]
          });
          this.lastProjectHandle = handle;
        }
        this.currentProjectName = handle.name || defaultName;
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return this.currentProjectName;
      } catch (err) {
        if (err && err.name === 'AbortError') {
          return false; // ユーザーによるキャンセル
        }
      }
    }

    // 2. iPadOS / Safari / モバイルブラウザ用ダウンロード保存
    let filename = defaultName;
    if (saveAs) {
      const inputName = prompt('保存するプロジェクトファイル名を入力してください:', defaultName);
      if (!inputName) return false;
      filename = inputName.trim();
      if (!filename.toLowerCase().endsWith('.json')) {
        filename += '.proj.json';
      }
    }

    this.currentProjectName = filename;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return filename;
  }

  // ローカルフォルダ選択
  async pickLocalDirectory() {
    if (typeof window.showDirectoryPicker === 'function') {
      try {
        const dirHandle = await window.showDirectoryPicker();
        const files = [];
        for await (const entry of dirHandle.values()) {
          if (entry.kind === 'file' && entry.name.toLowerCase().endsWith('.png')) {
            files.push(await entry.getFile());
          }
        }
        return files;
      } catch (err) {
        if (err && err.name === 'AbortError') return [];
      }
    }

    return new Promise((resolve) => {
      const inp = document.createElement('input');
      inp.type = 'file';
      inp.webkitdirectory = true;
      inp.multiple = true;
      inp.style.position = 'fixed';
      inp.style.left = '-9999px';
      document.body.appendChild(inp);

      inp.onchange = () => {
        const list = Array.from(inp.files || []).filter(f => f.name.toLowerCase().endsWith('.png'));
        if (inp.parentNode) document.body.removeChild(inp);
        resolve(list);
      };

      window.addEventListener('focus', () => {
        setTimeout(() => {
          if (inp.parentNode) {
            document.body.removeChild(inp);
            resolve([]);
          }
        }, 500);
      }, { once: true });

      inp.click();
    });
  }

  // Google Drive ピッカー連携
  async openGoogleDrivePicker(apiKey, clientId) {
    if (!apiKey || !clientId) {
      alert('Google Drive連携には「API Key」と「Client ID」の入力が必要です。');
      return null;
    }

    try {
      await this._loadGoogleApis();
      const token = await this._requestAccessToken(clientId);
      if (!token) return null;

      return await new Promise((resolve) => {
        const view = new window.google.picker.DocsView(window.google.picker.ViewId.DOCS)
          .setIncludeFolders(true)
          .setMimeTypes('image/png,application/json');

        const picker = new window.google.picker.PickerBuilder()
          .addView(view)
          .setOAuthToken(token)
          .setDeveloperKey(apiKey)
          .setCallback(async (data) => {
            if (data.action === window.google.picker.Action.PICKED) {
              const doc = data.docs[0];
              const res = await fetch(`https://www.googleapis.com/drive/v3/files/${doc.id}?alt=media`, {
                headers: { Authorization: `Bearer ${token}` }
              });
              const blob = await res.blob();
              resolve({ blob, name: doc.name });
            } else if (data.action === window.google.picker.Action.CANCEL) {
              resolve(null);
            }
          })
          .build();
        picker.setVisible(true);
      });
    } catch (err) {
      alert('Google Drive 連携エラー: ' + (err.message || err));
      return null;
    }
  }

  _loadGoogleApis() {
    return new Promise((resolve, reject) => {
      if (window.gapi && window.google?.accounts?.oauth2) {
        window.gapi.load('picker', { callback: resolve, onerror: reject });
        return;
      }
      const s1 = document.createElement('script');
      s1.src = 'https://apis.google.com/js/api.js';
      s1.onload = () => {
        window.gapi.load('picker', {
          callback: () => {
            const s2 = document.createElement('script');
            s2.src = 'https://accounts.google.com/gsi/client';
            s2.onload = resolve;
            s2.onerror = reject;
            document.head.appendChild(s2);
          },
          onerror: reject
        });
      };
      s1.onerror = reject;
      document.head.appendChild(s1);
    });
  }

  _requestAccessToken(clientId) {
    return new Promise((resolve) => {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/drive.readonly',
        callback: (resp) => resolve(resp && resp.access_token ? resp.access_token : null)
      });
      client.requestAccessToken();
    });
  }
}
