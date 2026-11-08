/**
 * ローカルフォルダ (File System Access API) および Google Drive Picker 連携
 */
export class StorageAPI {
  constructor() {
    this.googleAuthToken = null;
  }

  // ローカル単一ファイル選択 (フォールバック対応)
  async pickLocalFile(accept = '.png') {
    if (window.showOpenFilePicker) {
      try {
        const [handle] = await window.showOpenFilePicker({
          types: [{ description: 'Files', accept: { 'image/*': ['.png', '.jpg', '.jpeg'] } }]
        });
        const file = await handle.getFile();
        return file;
      } catch (err) {
        if (err.name !== 'AbortError') console.error(err);
        return null;
      }
    } else {
      return new Promise(resolve => {
        const input = document.getElementById('input-file-hidden');
        input.accept = accept;
        input.onchange = () => resolve(input.files[0] || null);
        input.click();
      });
    }
  }

  // ローカルフォルダ選択 (File System Access API)
  async pickLocalDirectory() {
    if (!window.showDirectoryPicker) {
      alert('お使いのブラウザはローカルフォルダ直接アクセス(File System Access API)に非対応です。ファイル個別選択をご利用ください。');
      return [];
    }
    try {
      const dirHandle = await window.showDirectoryPicker();
      const files = [];
      for await (const entry of dirHandle.values()) {
        if (entry.kind === 'file' && entry.name.toLowerCase().endsWith('.png')) {
          const file = await entry.getFile();
          files.push(file);
        }
      }
      return files;
    } catch (err) {
      if (err.name !== 'AbortError') console.error(err);
      return [];
    }
  }

  // Google Drive Picker 認証・ファイル選択
  async openGoogleDrivePicker(apiKey, clientId) {
    if (!apiKey || !clientId) {
      alert('「特殊色・設定」タブで Google Drive API Key と Client ID を入力してください。');
      return null;
    }

    return new Promise((resolve, reject) => {
      const tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/drive.readonly',
        callback: async (response) => {
          if (response.error) {
            reject(response);
            return;
          }
          this.googleAuthToken = response.access_token;
          this._createPicker(apiKey, this.googleAuthToken, resolve);
        }
      });
      tokenClient.requestAccessToken({ prompt: 'consent' });
    });
  }

  _createPicker(apiKey, token, resolve) {
    gapi.load('picker', () => {
      const view = new google.picker.View(google.picker.ViewId.DOCS_IMAGES);
      view.setMimeTypes('image/png,application/json');

      const picker = new google.picker.PickerBuilder()
        .addView(view)
        .setOAuthToken(token)
        .setDeveloperKey(apiKey)
        .setCallback(async (data) => {
          if (data.action === google.picker.Action.PICKED) {
            const doc = data.docs[0];
            const fileData = await this._downloadDriveFile(doc.id, token);
            resolve({ name: doc.name, blob: fileData });
          } else if (data.action === google.picker.Action.CANCEL) {
            resolve(null);
          }
        })
        .build();
      picker.setVisible(true);
    });
  }

  async _downloadDriveFile(fileId, token) {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return await res.blob();
  }
}