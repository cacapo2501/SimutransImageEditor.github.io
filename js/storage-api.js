export class StorageAPI {
  // ローカルファイル単体選択
  pickLocalFile(accept = '.png') {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = accept;
      input.style.display = 'none';
      document.body.appendChild(input);

      input.onchange = (e) => {
        const file = e.target.files && e.target.files[0];
        document.body.removeChild(input);
        resolve(file || null);
      };

      window.addEventListener('focus', () => {
        setTimeout(() => {
          if (input.parentNode) {
            document.body.removeChild(input);
            resolve(null);
          }
        }, 500);
      }, { once: true });

      input.click();
    });
  }

  // ローカルフォルダ選択 (PNGファイル一覧を取得)
  pickLocalDirectory() {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.webkitdirectory = true;
      input.multiple = true;
      input.style.display = 'none';
      document.body.appendChild(input);

      input.onchange = (e) => {
        const files = Array.from(e.target.files || []).filter(f => f.name.toLowerCase().endsWith('.png'));
        document.body.removeChild(input);
        resolve(files);
      };

      window.addEventListener('focus', () => {
        setTimeout(() => {
          if (input.parentNode) {
            document.body.removeChild(input);
            resolve([]);
          }
        }, 500);
      }, { once: true });

      input.click();
    });
  }

  // Google Drive Picker 連携
  async openGoogleDrivePicker(apiKey, clientId) {
    if (!apiKey || !clientId) {
      alert('「特殊色・外部連携設定」パネルで Google Drive の API Key と Client ID を入力してください。');
      return null;
    }

    if (!window.gapi || !window.google) {
      alert('Google API スクリプトの読み込みが完了していないか、オフライン環境です。');
      return null;
    }

    return new Promise((resolve) => {
      window.gapi.load('picker', () => {
        const tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: 'https://www.googleapis.com/auth/drive.readonly',
          callback: async (tokenResponse) => {
            if (tokenResponse && tokenResponse.access_token) {
              const oauthToken = tokenResponse.access_token;
              const picker = new window.google.picker.PickerBuilder()
                .addView(window.google.picker.ViewId.DOCS_IMAGES)
                .addView(window.google.picker.ViewId.DOCS)
                .setOAuthToken(oauthToken)
                .setDeveloperKey(apiKey)
                .setCallback(async (data) => {
                  if (data.action === window.google.picker.Action.PICKED) {
                    const doc = data.docs[0];
                    try {
                      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${doc.id}?alt=media`, {
                        headers: { Authorization: `Bearer ${oauthToken}` }
                      });
                      const blob = await res.blob();
                      resolve({ name: doc.name, blob });
                    } catch (err) {
                      alert('Google Drive からのダウンロードに失敗しました: ' + err);
                      resolve(null);
                    }
                  } else if (data.action === window.google.picker.Action.CANCEL) {
                    resolve(null);
                  }
                })
                .build();
              picker.setVisible(true);
            } else {
              resolve(null);
            }
          }
        });
        tokenClient.requestAccessToken({ prompt: '' });
      });
    });
  }
}
