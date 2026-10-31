# 由 src/pwa/icon.html 產生 PWA 圖示（需要 Python 版 Playwright，第一次會連網載入字型）
# 用法：python tools/make-icons.py
import io
import pathlib
from playwright.sync_api import sync_playwright
from PIL import Image

root = pathlib.Path(__file__).resolve().parent.parent
src = (root / 'src' / 'pwa' / 'icon.html').as_uri()
out = root / 'icons'
out.mkdir(exist_ok=True)

def render(page, query):
    page.goto(src + query)
    page.wait_for_load_state('networkidle')
    page.evaluate('document.fonts.ready')
    page.wait_for_timeout(300)
    return Image.open(io.BytesIO(page.locator('#icon').screenshot())).convert('RGB')

with sync_playwright() as p:
    b = p.chromium.launch()
    page = b.new_page(viewport={'width': 600, 'height': 600})
    normal = render(page, '')
    maskable = render(page, '?maskable')
    font = page.evaluate("document.fonts.check('900 100px \"Noto Serif TC\"')")
    b.close()

if not font:
    raise SystemExit('✘ Noto Serif TC 字型沒有載入（需要網路），圖示會變成系統字型，已中止')

targets = {
    'icon-512.png': (normal, 512),
    'icon-192.png': (normal, 192),
    'apple-touch-icon.png': (normal, 180),
    'favicon-32.png': (normal, 32),
    'icon-maskable-512.png': (maskable, 512),
}
for name, (img, size) in targets.items():
    img.resize((size, size), Image.LANCZOS).save(out / name, optimize=True)
    print('✔', 'icons/' + name, size, 'px')
