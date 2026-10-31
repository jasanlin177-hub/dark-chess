# 用 Playwright 截網頁圖：
#   python tools/shot.py <html 路徑> <輸出 png> <寬> <高> [等待毫秒] [mobile|desktop] [截圖前執行的 JS]
import sys
import pathlib
from playwright.sync_api import sync_playwright

src, out, w, h = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
wait = int(sys.argv[5]) if len(sys.argv) > 5 else 1500
mobile = len(sys.argv) > 6 and sys.argv[6] == 'mobile'
script = sys.argv[7] if len(sys.argv) > 7 else None
# 路徑後面可以接 ?debug 之類的查詢字串
src_path, _, query = src.partition('?')
url = pathlib.Path(src_path).resolve().as_uri() + ('?' + query if query else '')
pathlib.Path(out).parent.mkdir(parents=True, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    page = browser.new_page(viewport={'width': w, 'height': h}, device_scale_factor=2 if mobile else 1,
                            is_mobile=mobile, has_touch=mobile)
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: errors.append(m.text) if m.type in ('error', 'warning') else None)
    page.goto(url)
    page.wait_for_timeout(800)
    if script:
        result = page.evaluate('async () => { ' + script + ' }')
        if result is not None:
            print('JS 結果：' + str(result))
    page.wait_for_timeout(wait)
    page.screenshot(path=out)
    browser.close()
    print('截圖完成：' + out)
    for e in errors:
        print('頁面訊息：' + e)
