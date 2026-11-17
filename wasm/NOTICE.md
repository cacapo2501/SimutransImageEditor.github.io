# Simutrans makeobj (WebAssembly ビルド) ライセンスおよび出典情報

- **ソフトウェア名**: Simutrans `makeobj` (Standard)
- **バージョン**: Makeobj version 60.12 for Simutrans 125.0.2 Nightly and higher
- **ライセンス**: Artistic License 1.0（同梱の `LICENSE_SIMUTRANS.txt` を参照）
- **公式ソースコード**: https://github.com/simutrans/simutrans
- **取得リファレンス / コミット**: `master` (`cbd2e2b5fcf046c13cff8df9403e9892b8ce0a14`)
- **ビルド日時 (UTC)**: `2026-11-17T07:58:08Z`

## 変更点・ビルド方法 (Artistic License 1.0 第3条・第4条に基づく明記)
本リポジトリの `wasm/makeobj.js` および `wasm/makeobj.wasm` は、上記公式 Simutrans Standard の
`makeobj` C++ ソースコードを改変せず Emscripten により WebAssembly へコンパイルした非公式 Web ビルドです。
ビルド手順および自動化スクリプトは同リポジトリ内の `.github/workflows/build-makeobj-wasm.yml` および
`.github/scripts/build_makeobj_wasm.py` に公開しています。
