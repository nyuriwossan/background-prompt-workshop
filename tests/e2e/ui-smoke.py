"""
画面の通しテスト（スマートフォン幅とPC幅）。

  npm run build:pages
  （gh-pages/ を /background-prompt-workshop/ で配信した状態で）
  python3 tests/e2e/ui-smoke.py http://localhost:8765/background-prompt-workshop/ [スクリーンショット保存先]

確認すること
- v1 の下書き・保存一覧を入れた状態で開いても、エラーなく読み込めて控えが作られる
- スマホ幅で「場所を検索 → 見え方 → 生成先 → コピー」が完結し、横スクロールが出ない
- 屋内の舞台で空中の視点が非活性になり、理由が表示される
- 非活性になった値（高度など）がプロンプトに混ざらない
"""
import json
import pathlib
import sys

from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8765/background-prompt-workshop/"
OUT = pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else pathlib.Path("e2e-shots")
OUT.mkdir(parents=True, exist_ok=True)
FIXTURE = json.loads((pathlib.Path(__file__).parent.parent / "fixtures" / "v1-saved-data.json").read_text())
failures = []


def check(cond, message):
    print(("ok   " if cond else "FAIL ") + message)
    if not cond:
        failures.append(message)


def prompt_text(page):
    return page.locator(".output-card .prompt-box p").first.inner_text()


with sync_playwright() as p:
    browser = p.chromium.launch()

    # ---------------- スマートフォン（iPhone 相当） ----------------
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    ctx.grant_permissions(["clipboard-read", "clipboard-write"])
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    # アプリより先に v1 の保存データを置く（最初の1回だけ）
    page.add_init_script("""(() => {
        if (sessionStorage.getItem('seeded')) return;
        sessionStorage.setItem('seeded', '1');
        localStorage.clear();
        localStorage.setItem('background_prompt_workshop_draft_v1', %s);
        localStorage.setItem('background_prompt_workshop_saved_v1', %s);
    })()""" % (json.dumps(json.dumps(FIXTURE["design"]["state"])), json.dumps(json.dumps(FIXTURE["library"]["saved"]))))
    page.goto(URL)
    page.wait_for_selector(".output-card")
    check("Moonlit" in prompt_text(page) or "sacred temple" in prompt_text(page), "v1 の下書きが読み込まれる")
    check(page.evaluate("localStorage.getItem('background_prompt_workshop_backup_before_v2') !== null"), "移行前の控えが保存される")
    check(page.evaluate("JSON.parse(localStorage.getItem('background_prompt_workshop_draft_v1')).version") == 2, "下書きが v2 で保存し直される")
    page.get_by_role("button", name="保存一覧").click()
    check(page.locator(".saved-list article").count() == 4, "v1 の保存一覧4件が表示される")
    page.locator(".modal-close").click()
    page.screenshot(path=str(OUT / "mobile-1-top.png"))

    # 場所を検索して選ぶ
    page.get_by_label("場所を検索").fill("じんじゃ")
    page.locator(".search-results .chip", has_text="神社").first.click()
    check("Shinto shrine" in prompt_text(page), "ひらがな検索で神社を選べる")

    # 見え方を細かく指定 → ひな形「見上げる」
    page.get_by_role("button", name="細かく指定する").click()
    page.locator(".recipes button:has(strong:text-is(\"見上げる\"))").click()
    check(page.locator(".view-diagram").is_visible(), "見え方の模式図が出る")
    page.screenshot(path=str(OUT / "mobile-2-view.png"), full_page=False)
    page.locator(".step").nth(1).screenshot(path=str(OUT / "mobile-2-view-step.png"))

    # 生成先：PIXAI（Tsubaki系）
    page.locator(".output-card .chip", has_text="PIXAI").first.click()
    text = prompt_text(page)
    check(text.startswith("A view from street level, looking up at"), "Tsubaki系では見え方が1文目に来る")
    check(page.locator(".negative-block").count() == 0, "Tsubaki（Lite/Standard）ではネガティブ欄を出さない")

    # NovelAI に切り替えても設計は保たれる
    page.locator(".output-card .chip", has_text="NovelAI").click()
    check("Shinto shrine" in prompt_text(page) and "from below" in prompt_text(page), "NovelAI へ切り替えても場所と見え方が残る")
    check(page.locator(".negative-block .prompt-box").count() == 1, "NovelAI では Undesired Content を出せる")

    # 下部の操作でコピー
    page.locator(".mobile-dock .dock-primary").click()
    clip = page.evaluate("navigator.clipboard.readText()")
    check(clip == prompt_text(page), "下部のコピーでプロンプトがコピーされる")
    page.locator(".mobile-dock button", has_text="出力を見る").click()
    page.wait_for_timeout(700)
    check(page.locator("#output").bounding_box()["y"] < 200, "「出力を見る」で出力欄へ移動する")
    page.screenshot(path=str(OUT / "mobile-3-output.png"))

    # 横スクロールが出ない
    check(page.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"), "スマホ幅で横スクロールが出ない")

    # 屋内の舞台では空中の視点が非活性、理由が見える
    page.get_by_label("場所を検索").fill("おおひろま")
    page.locator(".search-results .chip", has_text="宮殿の大広間").first.click()
    sky = page.locator(".step").nth(1).locator(".chip", has_text="上空")
    check(sky.is_disabled(), "屋内の舞台で「上空」が押せない")
    check(page.locator(".disabled-reason", has_text="屋内の舞台です").count() >= 1, "非活性の理由が日本語で出る")

    # 上空＋高度を選んでから地上に戻すと、高度は出力に混ざらない
    page.get_by_label("場所を検索").fill("みなとまち")
    page.locator(".search-results .chip", has_text="港町").first.click()
    page.locator(".recipes button:has(strong:text-is(\"上空から\"))").click()
    check("high altitude" in prompt_text(page), "上空では高度が出力される")
    page.locator(".step").nth(1).locator(".chip", has_text="地上").first.click()
    check("high altitude" not in prompt_text(page) and "aerial" not in prompt_text(page), "地上へ戻すと高度・空中の語が出力から消える")
    check(page.locator(".view-notices .ignored").count() >= 1, "外した理由が表示される")
    page.locator(".step").nth(1).screenshot(path=str(OUT / "mobile-4-notices.png"))

    check(not errors, "ページエラーなし " + "; ".join(errors))
    ctx.close()

    # ---------------- PC ----------------
    ctx = browser.new_context(viewport={"width": 1440, "height": 960})
    page = ctx.new_page()
    page.goto(URL)
    page.evaluate("localStorage.clear()")
    page.reload()
    page.wait_for_selector(".output-card")
    page.locator(".preset-groups button", has_text="見え方の例").click()
    page.locator(".preset-list button", has_text="城のバルコニー").click()
    page.screenshot(path=str(OUT / "desktop-1.png"))
    check(page.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"), "PCで横スクロールが出ない")
    page.get_by_role("button", name="シンプル背景").first.click()
    page.locator(".preset-groups button", has_text="柄・質感").click()
    page.locator(".preset-list button", has_text="ミントの格子柄").click()
    check("geometric grid" in prompt_text(page), "シンプル背景の柄が出力される")
    page.screenshot(path=str(OUT / "desktop-2-simple.png"))
    ctx.close()
    browser.close()

print("\n%d failure(s)" % len(failures))
sys.exit(1 if failures else 0)
