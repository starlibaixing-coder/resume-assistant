#!/usr/bin/env python3
"""真机冒烟 runner:以 SMOKE=1 拉起 tauri dev,收集 [smoke] 日志,输出汇总报告。

覆盖 e2e 的盲区:真 Rust 二进制 + 真 SQLite + 真权限(驱动 feature / ACL / 磁盘故障)。
冒烟走独立的 smoke.db,不触碰用户数据 resume.db。

用法:
    cd desktop && python3 scripts/smoke.py
退出码 = 应用退出码(0 全过 / 1 有失败),可直接接 CI。
"""

import os
import re
import subprocess
import sys

# 日志经 tauri-plugin-log 输出,行首带时间戳([2026-..][..][app_lib][INFO]),不锚定行首
SMOKE_LINE = re.compile(r"\[smoke\] (PASS|FAIL)  (\S+)\s*(.*)$")
TIMEOUT_SECONDS = 900  # 首次 Rust 编译可能数分钟


def main() -> int:
    root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
    env = {**os.environ, "SMOKE": "1"}
    print("启动 tauri dev(冒烟模式;首次编译可能数分钟,输出已捕获,请稍候)…")
    try:
        proc = subprocess.run(
            ["npm", "run", "tauri", "dev"],
            cwd=root,
            env=env,
            capture_output=True,
            text=True,
            timeout=TIMEOUT_SECONDS,
        )
    except subprocess.TimeoutExpired:
        print(f"超时({TIMEOUT_SECONDS}s):编译过慢或应用未退出,原始输出已丢弃,请手动跑 SMOKE=1 npm run tauri dev 排查")
        return 2

    output = (proc.stdout or "") + (proc.stderr or "")
    rows = []
    for line in output.splitlines():
        m = SMOKE_LINE.search(line)
        if m:
            rows.append(m.groups())

    print("\n===== 冒烟报告 =====")
    if not rows:
        print("未捕获到任何 [smoke] 行 —— 应用可能没进冒烟模式或启动即崩。末尾输出:")
        for line in output.splitlines()[-20:]:
            print(f"  {line}")
        return 3
    for status, step, detail in rows:
        mark = "✓" if status == "PASS" else "✗"
        print(f" {mark} {step:<18} {detail}")
    passed = sum(1 for r in rows if r[0] == "PASS")
    print(f"\n结果: {passed}/{len(rows)} 步通过,应用退出码 {proc.returncode}")

    if proc.returncode != 0 and passed == len(rows):
        print("注意:全部步骤通过但退出码非 0,退出链路(smoke_finish)可能有问题")
    return proc.returncode


if __name__ == "__main__":
    sys.exit(main())
