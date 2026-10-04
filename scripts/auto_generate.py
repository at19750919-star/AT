"""
自動跑「生成 → 檢查違規 → 不乾淨就重生成」迴圈。

範圍限定：只自動化生成與違規檢查，絕不自動點擊「導出」。
每湊到一副乾淨牌靴就暫停，等使用者在瀏覽器裡親手點「資料」→「導出」，
確認導出成功後回終端機按 Enter，才會繼續生成下一副。

用法：
    python scripts/auto_generate.py --count 10

前置需求：
    pip install playwright
    playwright install chrome
"""

import argparse
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

from playwright.sync_api import sync_playwright

# Windows 終端機預設非 UTF-8 codepage 時，中文 print 會變亂碼，強制改用 UTF-8 輸出
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

PROJECT_DIR = Path(__file__).resolve().parent.parent
URL = "http://localhost:8765/index.html"

VIOLATION_IDS = {
    "訊號牌違規": "signalViolationDetail",
    "連續5局4張": "fourCardViolationDetail",
    "連續莊閒": "streakViolationDetail",
    "無法對調": "cannotSwapViolationDetail",
    "其他違規": "otherViolationDetail",
}


def ensure_server():
    """確保本地 http server 在跑，不在就用專案目錄啟動一個。"""
    try:
        urllib.request.urlopen(URL, timeout=2)
        return None
    except Exception:
        pass
    print("本地伺服器未啟動，正在啟動 python -m http.server 8765 ...")
    proc = subprocess.Popen(
        [sys.executable, "-m", "http.server", "8765"],
        cwd=str(PROJECT_DIR),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    for _ in range(20):
        time.sleep(0.5)
        try:
            urllib.request.urlopen(URL, timeout=1)
            break
        except Exception:
            continue
    return proc


def read_violations(page):
    return {
        label: page.eval_on_selector(f"#{el_id}", "el => el.textContent.trim()")
        for label, el_id in VIOLATION_IDS.items()
    }


def is_clean(violations: dict) -> bool:
    return all(v == "無" for v in violations.values())


def wait_generation_done(page, timeout_s=180):
    """輪詢隱藏的真實生成按鈕 #generateBtn，disabled 消失代表這輪生成收斂完成。"""
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        disabled = page.eval_on_selector("#generateBtn", "el => el.disabled")
        if not disabled:
            return
        time.sleep(1)
    raise TimeoutError("生成逾時（超過 %ds），請人工檢查瀏覽器狀態" % timeout_s)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--count", type=int, default=1, help="要湊滿的乾淨牌靴副數")
    args = parser.parse_args()

    server_proc = ensure_server()
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(channel="chrome", headless=False)
            page = browser.new_page()
            page.goto(URL)
            page.wait_for_selector("#chipGen")

            clean_count = 0
            attempt = 0
            print(f"目標：{args.count} 副乾淨牌靴。導出一律由你手動點擊，腳本不會碰導出按鈕。\n")

            while clean_count < args.count:
                attempt += 1
                page.click("#chipGen")
                print(f"[第 {clean_count + 1}/{args.count} 副 / 第 {attempt} 次嘗試] 生成中...")
                wait_generation_done(page)

                v = read_violations(page)
                if is_clean(v):
                    clean_count += 1
                    print(f"✅ 第 {clean_count}/{args.count} 副乾淨。")
                    input("   請切到瀏覽器：點「資料」分類 → 點「導出」，確認雲端硬碟多了一個檔案後，回這裡按 Enter 繼續 >>> ")
                else:
                    bad = {k: val for k, val in v.items() if val != "無"}
                    print(f"   不乾淨，重新生成。違規：{bad}")

            print(f"\n共產出並經你手動確認導出 {clean_count} 副。瀏覽器保持開啟，關掉視窗即可結束。")
            input("按 Enter 關閉瀏覽器並結束腳本 >>> ")
            browser.close()
    finally:
        if server_proc:
            server_proc.terminate()


if __name__ == "__main__":
    main()
