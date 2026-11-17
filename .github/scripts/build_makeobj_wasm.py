#!/usr/bin/env python3
"""
Simutrans Standard 公式ソースから makeobj を Emscripten (WebAssembly) ビルドし、
Artistic License 1.0 準拠ファイルとバージョンメタデータを wasm/ へ出力するスクリプト。
"""

import datetime
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path


def run(cmd, cwd=None):
    print("+", " ".join(str(x) for x in cmd), flush=True)
    subprocess.run(cmd, cwd=cwd, check=True)


def capture(cmd, cwd=None):
    res = subprocess.run(cmd, cwd=cwd, text=True, capture_output=True)
    return res.returncode, (res.stdout or "") + (res.stderr or "")


def extract_cmake_sources(cmake_file: Path, base_dir: Path):
    """src/makeobj/CMakeLists.txt から .cc / .cpp / .c ソースパス一覧を抽出する"""
    text = cmake_file.read_text(encoding="utf-8", errors="replace")
    sources = []
    for token in re.findall(r"[^\s()\"']+\.(?:cc|cpp|c)\b", text):
        p = (cmake_file.parent / token).resolve()
        if not p.exists():
            p = (base_dir / token).resolve()
        if p.exists() and p not in sources:
            sources.append(p)
    return sources


def ensure_revision_header(src_dir: Path):
    """simversion.h が参照する revision.h を生成する"""
    rev_h = src_dir / "src" / "simutrans" / "revision.h"
    if not rev_h.exists():
        _, rev_count = capture(["git", "-C", str(src_dir), "rev-list", "--count", "HEAD"])
        rev_num = rev_count.strip().splitlines()[-1] if rev_count.strip().isdigit() else "0"
        rev_h.write_text(f"#define REVISION {rev_num}\n", encoding="utf-8")


def build_makeobj_emxx(src_dir: Path, out_js: Path):
    """Emscripten (em++) で src/makeobj/CMakeLists.txt のソース群から WASM を直接ビルドする"""
    run(["embuilder", "build", "zlib", "libpng"])
    ensure_revision_header(src_dir)

    makeobj_cmake = src_dir / "src" / "makeobj" / "CMakeLists.txt"
    if not makeobj_cmake.exists():
        makeobj_cmake = src_dir / "makeobj" / "CMakeLists.txt"
    sources = extract_cmake_sources(makeobj_cmake, src_dir)
    if not sources:
        raise RuntimeError(f"ソース一覧を抽出できませんでした: {makeobj_cmake}")

    out_js.parent.mkdir(parents=True, exist_ok=True)
    inc_sim = src_dir / "src" / "simutrans"
    inc_mk = src_dir / "src" / "makeobj"

    cmd = [
        "em++",
        "-std=c++14",
        "-O2",
        "-fexceptions",
        "-DMAKEOBJ=1",
        "-DCOLOUR_DEPTH=0",
        "-DMSG_LEVEL=3",
        "-DNDEBUG=1",
        f"-I{src_dir / 'src'}",
        f"-I{inc_sim if inc_sim.exists() else src_dir}",
        f"-I{inc_mk if inc_mk.exists() else src_dir}",
        "-sUSE_ZLIB=1",
        "-sUSE_LIBPNG=1",
        "-sMODULARIZE=1",
        "-sEXPORT_ES6=1",
        "-sEXPORT_NAME=createMakeobjModule",
        "-sINVOKE_RUN=0",
        "-sEXIT_RUNTIME=0",
        "-sALLOW_MEMORY_GROWTH=1",
        "-sEXPORTED_RUNTIME_METHODS=FS,callMain",
        *[str(s) for s in sources],
        "-o", str(out_js),
    ]
    run(cmd)


def parse_version_headers(src_dir: Path):
    """simversion.h からバージョン定数を補助抽出する"""
    makeobj_ver = ""
    sim_ver = ""
    ver_h = src_dir / "src" / "simutrans" / "simversion.h"
    if ver_h.exists():
        txt = ver_h.read_text(encoding="utf-8", errors="replace")
        m1 = re.search(r'#define\s+MAKEOBJ_VERSION\s+"([^"]+)"', txt)
        maj = re.search(r'#define\s+SIM_VERSION_MAJOR\s+(\d+)', txt)
        min_v = re.search(r'#define\s+SIM_VERSION_MINOR\s+(\d+)', txt)
        pat = re.search(r'#define\s+SIM_VERSION_PATCH\s+(\d+)', txt)
        if m1:
            makeobj_ver = m1.group(1)
        if maj and min_v:
            sim_ver = f"{maj.group(1)}.{min_v.group(1)}"
            if pat and pat.group(1) != "0":
                sim_ver += f".{pat.group(1)}"
    return makeobj_ver, sim_ver


def probe_wasm_banner(out_js: Path):
    """Node.js で生成した makeobj.js を実行してバナーと capabilities を検証する"""
    probe_code = (
        f"import createMakeobjModule from {json.dumps(out_js.resolve().as_uri())};\n"
        "const lines = [];\n"
        "const mod = await createMakeobjModule({ print: s => lines.push(s), printErr: s => lines.push(s) });\n"
        "try { mod.callMain(['capabilities']); } catch (e) {}\n"
        "console.log(lines.join('\\n'));\n"
    )
    res = subprocess.run(
        ["node", "--input-type=module", "-e", probe_code],
        text=True,
        capture_output=True,
        check=True,
    )
    output = (res.stdout or "") + (res.stderr or "")
    print(output, flush=True)
    banner = ""
    makeobj_ver = ""
    sim_ver = ""
    for line in output.splitlines():
        m = re.search(r"(Makeobj\s+version\s+([^\s]+)\s+for\s+Simutrans\s+(.+?)\s+and\s+higher.*)", line, re.I)
        if m:
            banner = m.group(1).strip()
            makeobj_ver = m.group(2).strip()
            sim_ver = m.group(3).strip()
            break
    if "vehicle" not in output.lower() or "way" not in output.lower():
        raise RuntimeError("makeobj capabilities 検証に失敗しました")
    return banner, makeobj_ver, sim_ver


def main():
    repo_root = Path.cwd()
    src_dir = Path(sys.argv[1]).resolve()
    source_ref = sys.argv[2] if len(sys.argv) > 2 else "master"
    out_dir = repo_root / "wasm"
    out_js = out_dir / "makeobj.js"

    build_makeobj_emxx(src_dir, out_js)

    banner, makeobj_ver, sim_ver = probe_wasm_banner(out_js)
    hdr_mver, hdr_sver = parse_version_headers(src_dir)
    makeobj_ver = makeobj_ver or hdr_mver or "unknown"
    sim_ver = sim_ver or hdr_sver or "unknown"
    banner = banner or f"Makeobj version {makeobj_ver} for Simutrans {sim_ver}"

    _, commit_out = capture(["git", "-C", str(src_dir), "rev-parse", "HEAD"])
    commit_sha = commit_out.strip().splitlines()[-1] if commit_out.strip() else "unknown"
    built_at = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    # Artistic License 1.0 準拠ファイル配置
    license_src = src_dir / "LICENSE.txt"
    if not license_src.exists():
        raise FileNotFoundError("Simutrans ソースに LICENSE.txt が見つかりません")
    shutil.copy2(license_src, out_dir / "LICENSE_SIMUTRANS.txt")

    notice = (
        "# Simutrans makeobj (WebAssembly ビルド) ライセンスおよび出典情報\n\n"
        "- **ソフトウェア名**: Simutrans `makeobj` (Standard)\n"
        f"- **バージョン**: {banner}\n"
        "- **ライセンス**: Artistic License 1.0（同梱の `LICENSE_SIMUTRANS.txt` を参照）\n"
        "- **公式ソースコード**: https://github.com/simutrans/simutrans\n"
        f"- **取得リファレンス / コミット**: `{source_ref}` (`{commit_sha}`)\n"
        f"- **ビルド日時 (UTC)**: `{built_at}`\n\n"
        "## 変更点・ビルド方法 (Artistic License 1.0 第3条・第4条に基づく明記)\n"
        "本リポジトリの `wasm/makeobj.js` および `wasm/makeobj.wasm` は、上記公式 Simutrans Standard の\n"
        "`makeobj` C++ ソースコードを改変せず Emscripten により WebAssembly へコンパイルした非公式 Web ビルドです。\n"
        "ビルド手順および自動化スクリプトは同リポジトリ内の `.github/workflows/build-makeobj-wasm.yml` および\n"
        "`.github/scripts/build_makeobj_wasm.py` に公開しています。\n"
    )
    (out_dir / "NOTICE.md").write_text(notice, encoding="utf-8")

    meta = {
        "available": True,
        "edition": "Standard",
        "version": makeobj_ver,
        "simutransVersion": sim_ver,
        "banner": banner,
        "sourceRepo": "https://github.com/simutrans/simutrans",
        "sourceRef": source_ref,
        "commit": commit_sha,
        "license": "Artistic License 1.0",
        "licenseFile": "./wasm/LICENSE_SIMUTRANS.txt",
        "noticeFile": "./wasm/NOTICE.md",
        "builtAt": built_at,
    }
    (out_dir / "makeobj-meta.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print("完了:", json.dumps(meta, ensure_ascii=False))


if __name__ == "__main__":
    main()
