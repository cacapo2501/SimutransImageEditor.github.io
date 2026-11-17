# Simutrans makeobj (WebAssembly ビルド) ライセンスおよび出典情報

- **ソフトウェア名**: Simutrans `makeobj` (Standard)
- **ライセンス**: Artistic License 1.0
- **公式ソースコード**: https://github.com/simutrans/simutrans
- **状態**: 未ビルド（`.github/workflows/build-makeobj-wasm.yml` を GitHub Actions で実行すると、`wasm/makeobj.js` / `wasm/makeobj.wasm` / `wasm/LICENSE_SIMUTRANS.txt` / `wasm/makeobj-meta.json` が生成されます）

## Artistic License 1.0 準拠について
- 本ディレクトリに配置される `makeobj` WebAssembly ビルドは、公式 Simutrans Standard ソースコードから無改変で Emscripten によりコンパイルされた非公式 Web ビルドです。
- ビルド時に公式リポジトリの `LICENSE.txt` を `wasm/LICENSE_SIMUTRANS.txt` としてそのまま同梱し、取得元のリファレンス・コミットハッシュを `wasm/makeobj-meta.json` と本ファイルへ明記します。
- ビルド手順および自動化スクリプトは `.github/workflows/build-makeobj-wasm.yml` と `.github/scripts/build_makeobj_wasm.py` に公開しています。
