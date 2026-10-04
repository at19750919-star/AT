"""百家3.0 無 HTML 批次生成器的 Python 入口。"""

from __future__ import annotations

import argparse
from pathlib import Path
import shutil
import subprocess
import sys


def positive_integer(value: str) -> int:
    number = int(value)
    if number <= 0:
        raise argparse.ArgumentTypeError("必須是正整數")
    return number


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="不開啟 HTML，自動生成、修復、導出並驗證百家樂牌靴。",
        epilog="範例：python 批次生成.py 10",
    )
    parser.add_argument("count", nargs="?", type=positive_integer, default=1, help="生成副數，預設 1")
    parser.add_argument("--output", help="本機輸出目錄，預設 Windows Downloads；仍會同步上傳 Google Drive")
    parser.add_argument("--max-attempts", type=positive_integer, help="每副牌最多重跑次數，預設 500")
    parser.add_argument("--seed", type=int, help="固定亂數種子，只用於重現與測試")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    project_root = Path(__file__).resolve().parent
    script_path = project_root / "scripts" / "batch-generate.mjs"
    node = shutil.which("node")
    if node is None:
        print("找不到 Node.js，無法啟動牌靴生成核心。", file=sys.stderr)
        return 1

    command = [node, str(script_path), "--count", str(args.count)]
    if args.output:
        command.extend(["--output", args.output])
    if args.max_attempts:
        command.extend(["--max-attempts", str(args.max_attempts)])
    if args.seed is not None:
        command.extend(["--seed", str(args.seed)])

    return subprocess.run(command, cwd=project_root, check=False).returncode


if __name__ == "__main__":
    raise SystemExit(main())
