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
- シンプル背景で季節イベントを選ぶと、関連モチーフが優先表示され、装飾の有無・テイスト・プリセット・保存→再読込が正しく動く
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
    page.locator(".output-settings .chip", has_text="PIXAI").first.click()
    text = prompt_text(page)
    check(text.startswith("A view from street level, looking up at"), "Tsubaki系では見え方が1文目に来る")
    check(page.locator(".negative-block").count() == 0, "Tsubaki（Lite/Standard）ではネガティブ欄を出さない")

    # NovelAI に切り替えても設計は保たれる
    page.locator(".output-settings .chip", has_text="NovelAI").click()
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

    # ---------------- リセット（選択をクリア／初期設定に戻す） ----------------
    ctx = browser.new_context(viewport={"width": 1280, "height": 900})
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.add_init_script("""(() => { if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1'); localStorage.clear(); })()""")
    page.goto(URL)
    page.wait_for_selector(".output-card")
    step3 = page.locator(".step").nth(2)

    def selected_in_step3():
        texts = step3.locator(".chip.is-selected:not(.is-unset)").all_inner_texts()
        return [t.replace("✓", "").strip() for t in texts if t.replace("✓", "").strip() not in ("指定なし", "なし")]

    # 保存一覧に1件入れておく（リセットで消えないことの確認用）
    page.locator(".output-secondary button", has_text="この設計を保存").click()
    page.locator(".modal input").fill("リセット前の保存")
    page.locator(".modal .primary-button").click()

    # STEP3で複数選び、セクションを閉じる
    for title, chip in [("建物や周囲のもの", "落ち葉"), ("光・色・雰囲気", "壮大"), ("奥行き・幻想演出", "浮遊する光")]:
        section = step3.locator("details.section-card", has_text=title)
        section.locator("summary").click()
        section.locator(".chip", has_text=chip).first.click()
        section.locator("summary").click()
    page.get_by_label("構成物を探す").count()  # 閉じた状態でも存在しない入力は問題にしない
    before = selected_in_step3()
    check(len(before) >= 10, "クリア前はSTEP3に多くの選択がある（%d件）" % len(before))

    # キャンセルでは何も変わらない
    prompt_before = prompt_text(page)
    page.once("dialog", lambda d: d.dismiss())
    page.locator(".reset-tools button", has_text="選択をクリア").click()
    check(prompt_text(page) == prompt_before, "確認でキャンセルすると何も変わらない")

    page.once("dialog", lambda d: d.accept())
    page.locator(".reset-tools button", has_text="選択をクリア").click()
    check(step3.locator("details.section-card[open]").count() == 0, "クリア後はセクションが閉じた状態に戻る")
    for summary in step3.locator("details.section-card > summary").all():
        summary.click()
    after = selected_in_step3()
    check(after == [], "セクションを開き直しても任意の選択が残っていない " + "、".join(after))
    cleared_prompt = prompt_text(page)
    check(cleared_prompt.startswith("a narrow back alley") and "rain" not in cleared_prompt and "neon" not in cleared_prompt and "leaves" not in cleared_prompt, "プロンプトに場所以外の設定が残らない：" + cleared_prompt)
    check(page.locator(".step").nth(1).locator(".segmented button.active").inner_text() == "標準の見え方", "見え方は標準に戻る")
    page.reload()
    page.wait_for_selector(".output-card")
    check(prompt_text(page) == cleared_prompt, "再読み込み後もクリアした状態が保たれる")
    for summary in page.locator(".step").nth(2).locator("details.section-card > summary").all():
        summary.click()
    check(selected_in_step3() == [], "再読み込み後もSTEP3の選択は解除されたまま")
    page.get_by_role("button", name="保存一覧").click()
    check(page.locator(".saved-list article", has_text="リセット前の保存").count() == 1, "保存一覧の設計は消えない")
    page.locator(".modal-close").click()

    # 初期設定に戻す（作例の状態に戻る）
    page.once("dialog", lambda d: d.accept())
    page.locator(".reset-tools button", has_text="初期設定に戻す").click()
    check(prompt_text(page).startswith("a rain-soaked narrow back alley"), "「初期設定に戻す」で作例の状態に戻る")

    # シンプル背景
    page.get_by_role("button", name="シンプル背景").first.click()
    page.locator(".preset-groups button", has_text="プリクラ風").click()
    page.locator(".preset-list button", has_text="レースとリボン").click()
    page.once("dialog", lambda d: d.accept())
    page.locator(".reset-tools button", has_text="選択をクリア").click()
    for summary in page.locator(".step").nth(2).locator("details.section-card > summary").all():
        summary.click()
    simple_selected = [t.replace("✓", "").strip() for t in page.locator(".step").nth(2).locator(".chip.is-selected:not(.is-unset)").all_inner_texts()]
    check(simple_selected == ["なし"], "シンプル背景のクリア後は質感なし・装飾なし " + "、".join(simple_selected))
    simple_prompt = prompt_text(page)
    check(all(word not in simple_prompt for word in ("lace", "ribbon", "glow", "radial", "white")), "シンプル背景のプロンプトに装飾・質感が残らない：" + simple_prompt)
    page.reload()
    page.wait_for_selector(".output-card")
    check(prompt_text(page) == simple_prompt, "シンプル背景も再読み込み後にクリア状態が保たれる")
    check(not errors, "リセット操作中のページエラーなし " + "; ".join(errors))
    ctx.close()

    # ---------------- 動きのある見え方（スマホ） ----------------
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    page = ctx.new_page()
    page.goto(URL)
    page.evaluate("localStorage.clear()")
    page.reload()
    page.wait_for_selector(".output-card")
    page.locator(".preset-groups button", has_text="見え方の例").click()
    page.locator(".preset-list button", has_text="空から都市へ落下").click()
    page.locator(".output-settings .chip", has_text="PIXAI").first.click()
    fall = prompt_text(page)
    check(fall.startswith("A view from midair at a moderate altitude, as the viewpoint plunges straight down"), "落下プリセットは移動の向きが先頭に来る")
    check("falling" not in fall.lower(), "落下プリセットに falling を使わない")
    effects = page.locator(".step").nth(1).locator("fieldset", has_text="動きの演出")
    check(effects.locator(".chip").first.inner_text().startswith("奥へ収束する建物"), "動きに合う演出が先頭に並ぶ")
    page.locator(".step").nth(1).screenshot(path=str(OUT / "mobile-5-falling.png"))
    # 静的な構図を読み込むと、動きや演出は引き継がれない
    page.locator(".preset-list button", has_text="上空から城全体を見る").click()
    check("as the viewpoint" not in prompt_text(page) and "foreshortening" not in prompt_text(page), "静的な構図に動きが混ざらない")
    check(page.locator(".step").nth(1).locator("fieldset", has_text="動きの演出").count() == 0, "静止の構図では演出欄を出さない")
    ctx.close()

    # ---------------- 季節イベント（シンプル背景・スマホ） ----------------
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True, accept_downloads=True)
    ctx.grant_permissions(["clipboard-read", "clipboard-write"])
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(URL)
    page.evaluate("localStorage.clear()")
    page.reload()
    page.wait_for_selector(".output-card")
    page.get_by_role("button", name="シンプル背景").first.click()
    base_prompt = prompt_text(page)
    step1 = page.locator(".step").nth(0)
    step3 = page.locator(".step").nth(2)
    event_section = step1.locator("details.event-section")
    check(event_section.get_attribute("open") is None, "季節・イベントは最初は閉じている")
    check("選ばない" in event_section.locator("summary").inner_text(), "イベント未選択が見出しで分かる")
    event_section.locator("summary").click()
    event_section.locator(".event-row .chip", has_text="クリスマス").click()
    text = prompt_text(page)
    check("holly" in text and "bauble" in text, "クリスマスを選ぶとおすすめのモチーフが入る：" + text)
    check("along the upper border of the background" in text and "sparse" in text and "open central space for the character" in text, "上側・まばら・中央を空ける指定が入る")
    check("クリスマス" in event_section.locator("summary").inner_text(), "見出しの要約にイベント名が出る")
    deco = step3.locator("details.section-card", has_text="装飾")
    deco.locator("summary").click()
    legend = deco.locator("fieldset", has_text="おすすめ").first
    chips = [t.replace("✓", "").strip() for t in legend.locator(".chip").all_inner_texts()]
    check(chips[:3] == ["ヒイラギ", "オーナメント", "雪の結晶"], "関連モチーフが先頭に並ぶ：" + "、".join(chips))
    check("ジャック・オ・ランタン" not in chips, "別のイベントのモチーフは最初は並ばない")
    deco.locator(".motif-more").click()
    check(deco.locator(".motif-more-groups .chip", has_text="ジャック・オ・ランタン").count() == 1, "「ほかのモチーフも見る」で全モチーフを選べる")
    deco.locator(".motif-more").click()
    # 装飾なし → イベントのモチーフは出力されない
    deco.locator(".chip", has_text="なし").first.click()
    off = prompt_text(page)
    check("holly" not in off and "bauble" not in off and "central space" not in off and "apart from" not in off, "装飾なしではイベントのモチーフと分離の文が出力されない")
    check(deco.locator("fieldset", has_text="おすすめ").count() == 0, "装飾なしではモチーフ選択を閉じる")
    deco.locator(".chip", has_text="入れる").first.click()
    check("holly" in prompt_text(page), "入れるに戻すとモチーフが戻る")
    # テイスト：イベントを保ったまま見た目だけ変わる
    profile = step1.locator("details.profile-section")
    profile.locator("summary").click()
    check(profile.locator(".profile-card").nth(1).inner_text().find("クラシックホリデー") >= 0, "イベントに合うテイストが先頭に並ぶ")
    profile.locator(".profile-card", has_text="ゆめかわ").click()
    dreamy = prompt_text(page)
    check("lavender" in dreamy and "holly" in dreamy and "iridescent" in dreamy, "テイストで色が変わり、イベントのモチーフは残る")
    page.screenshot(path=str(OUT / "mobile-6-seasonal.png"), full_page=True)
    check(page.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"), "季節イベントの画面でも横スクロールが出ない")
    # イベントを外しても、モチーフと色は残る
    event_section.locator(".chip", has_text="選ばない").click()
    check(prompt_text(page) == dreamy, "イベントを外しても選んだモチーフと色は残る")
    # 保存 → 再読み込みで保持
    event_section.locator(".event-row .chip", has_text="お月見").click()
    moon = prompt_text(page)
    page.reload()
    page.wait_for_selector(".output-card")
    check(prompt_text(page) == moon and "moon" in moon, "再読み込み後もイベントの設計が残る")
    page.locator(".mobile-dock button", has_text="保存").click()
    page.locator(".modal input").fill("お月見テスト")
    page.locator(".modal .primary-button").click()
    page.once("dialog", lambda d: d.accept())
    page.locator(".reset-tools button", has_text="選択をクリア").click()
    check("moon" not in prompt_text(page), "クリアするとイベントのモチーフも外れる")
    page.get_by_role("button", name="保存一覧").click()
    page.locator(".saved-list article", has_text="お月見テスト").locator("button", has_text="開く").click()
    check(prompt_text(page) == moon, "保存した設計を開くとイベントの設計が戻る")
    page.locator(".step").nth(0).locator("details.event-section summary").click()
    check(page.locator(".step").nth(0).locator(".event-row .chip.is-selected", has_text="お月見").count() == 1, "開いた設計でイベントが選択状態になる")
    # プリセット
    page.locator(".preset-groups button", has_text="行事・記念日").click()
    page.locator(".preset-list button", has_text="七夕の笹飾り").click()
    tanabata = prompt_text(page)
    check("tanzaku" in tanabata and "bamboo" in tanabata, "季節プリセットで選択が反映される")
    page.locator(".step").nth(0).locator("details.event-section summary").click()
    check(page.locator(".step").nth(0).locator(".event-row .chip.is-selected", has_text="七夕").count() == 1, "プリセットのイベントが選択状態になる")
    page.locator(".output-settings .chip", has_text="NovelAI").click()
    check("tanzaku" in prompt_text(page) and "sparse decorations" in prompt_text(page), "NovelAI短縮版にも配置と量が入る")
    check(page.locator(".negative-block .prompt-box", has_text="text").count() == 1, "文字が入りやすいモチーフでも文字・ロゴを除外できる")
    # 従来のシンプル背景はイベントなしでそのまま
    page.locator(".preset-groups button", has_text="おすすめ").click()
    page.locator(".preset-list button", has_text="プリクラ風ピンク").click()
    page.locator(".output-settings .chip", has_text="汎用").click()
    check("center open" not in prompt_text(page) and "heart" in prompt_text(page), "イベントなしの従来プリセットは従来どおり")
    # v2.3 人物と装飾を分ける（人物と混ざりやすいモチーフのときだけ出る）
    page.locator(".preset-groups button", has_text="行事・記念日").click()
    page.locator(".preset-list button", has_text="パステルハロウィン").click()
    page.locator(".output-settings .chip", has_text="NovelAI").click()
    deco = page.locator(".step").nth(2).locator("details.section-card", has_text="装飾")
    if deco.get_attribute("open") is None:
        deco.locator("summary").click()
    sep = deco.locator(".separation-option")
    check(sep.count() == 1 and "ジャック・オ・ランタン（頭や顔・髪飾り・衣装）" in sep.inner_text(), "混ざりやすいモチーフのときだけ「人物と装飾を分ける」が出る")
    check(sep.locator("input").is_checked(), "プリセットでは最初から分けている")
    nai = prompt_text(page)
    check("jack-o'-lantern stickers" in nai and "decorations in the corners" in nai, "NovelAIでは装飾の役割が分かるタグになる：" + nai)
    sep.locator("label.toggle").click()
    plain = prompt_text(page)
    check("jack-o'-lantern stickers" not in plain and "jack-o'-lantern" in plain, "オフにすると従来の描き方に戻る")
    fusion = page.locator(".advice", has_text="人物に混ざるかも")
    check(fusion.count() == 1, "オフのときだけ融合のアドバイスが1件出る")
    fusion.locator("button", has_text="人物と装飾を分ける").click()
    check(prompt_text(page) == nai and sep.locator("input").is_checked(), "アドバイスのワンタップで分ける設定に戻る")
    page.locator(".output-settings .chip", has_text="背景だけで使う").click()
    check(deco.locator(".separation-option").count() == 0 and "sticker" not in prompt_text(page), "背景だけで使うときは分離の設定も文も出ない")
    page.locator(".output-settings .chip", has_text="人物を目立たせる").click()
    deco.screenshot(path=str(OUT / "mobile-7-separation.png"))
    check(page.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"), "分離オプションを出しても横スクロールが出ない")
    # v2.4 試験機能：背景キーワードの比較と検証メモ
    page.locator(".output-settings .chip", has_text="NovelAI").click()
    default_prompt = prompt_text(page)
    help_box = page.locator(".combine-help")
    check(help_box.count() == 1, "季節の人物向け背景で、人物プロンプトとの組み合わせ方が出る")
    help_box.locator("summary").click()
    help_text = help_box.inner_text()
    check("NovelAIで人物と背景を組み合わせるコツ" in help_text and help_box.locator(".slot-box").count() == 2, "NovelAIではキャラクター欄とベースプロンプトの入れ分けを案内する")
    check("boy, male focus, upper body, portrait" in help_text and "1boy" in help_text and "限りません" in help_text, "1boyだけの不安定さと具体例を、断定せずに案内する")
    help_box.locator(".slot-box", has_text="キャラクタープロンプト欄").locator("button").click()
    check(page.evaluate("navigator.clipboard.readText()") == "boy, male focus, upper body, portrait", "キャラクター欄の例をコピーできる")
    check("male focus" not in prompt_text(page) and prompt_text(page) == default_prompt, "人物の例は背景プロンプトに入らない")
    lab = page.locator(".lab-panel")
    lab.locator("summary").click()
    rows = lab.locator(".variant-list li")
    check(rows.count() == 5, "方式A〜Eが並ぶ")
    texts = [rows.nth(i).locator("p").inner_text() for i in range(5)]
    check(texts[0] == default_prompt, "方式Aは既定の出力と同じ")
    check(not texts[1].startswith("simple background") and texts[2].startswith("decorative background") and texts[3].startswith("portrait backdrop"), "B〜Dで背景キーワードだけが変わる")
    check(prompt_text(page) == default_prompt, "比較を開いても既定の出力は変わらない")
    lab.locator("fieldset", has_text="位置の書き方").locator(".chip", has_text="border を使わない").click()
    check("border" not in rows.nth(2).locator("p").inner_text() and prompt_text(page) == default_prompt, "位置の書き方は比較欄だけに効く")
    rows.nth(2).locator("button", has_text="コピー").click()
    clip = page.evaluate("navigator.clipboard.readText()")
    check(clip.startswith("decorative background") and "border" not in clip, "比較欄から方式Cをコピーできる")
    form = lab.locator(".lab-form")
    check(form.locator("fieldset", has_text="方式").locator(".chip.is-selected").inner_text().startswith("C"), "コピーした方式が記録欄に入る")
    form.locator("fieldset", has_text="人物指定の入力先").locator(".chip", has_text="キャラクター欄に分けた").click()
    form.locator("input").first.fill("101")
    for label in ["人物がいる", "顔・頭部が正常", "背景に季節装飾がある", "季節感がある"]:
        form.locator(".chip", has_text=label).click()
    form.locator("button", has_text="この1枚を記録する").click()
    check(lab.locator(".lab-summary tbody tr").count() == 1, "記録が集計に出る")
    check("×衣装・髪・顔・目に混ざっていない" in lab.locator(".lab-records li").first.inner_text(), "満たさなかった項目が一覧に出る")
    page.screenshot(path=str(OUT / "mobile-8-lab.png"), full_page=True)
    check(page.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"), "試験機能を開いても横スクロールが出ない")
    with page.expect_download() as download:
        lab.locator("button", has_text="CSVで書き出す").click()
    csv_text = pathlib.Path(download.value.path()).read_text(encoding="utf-8-sig")
    check("decorative" not in csv_text and ",キャラクター欄に分けた,C,default,edge,ハロウィン,101," in csv_text, "検証メモをCSVで書き出せる（入力先つき）")
    check("キャラ欄" in lab.locator(".lab-summary tbody tr").first.inner_text(), "集計で入力先が分かる")
    # v2.4 の記録（入力先なし）を混ぜても読める
    page.evaluate("""(() => { const key = 'background_prompt_workshop_lab_log_v1'; const list = JSON.parse(localStorage.getItem(key) || '[]'); list.push({ id: 'old-v24', createdAt: '2026-10-30T03:00:00.000Z', model: 'novelai', person: 'thin', variant: 'A', seed: '7', eventTheme: 'halloween', checks: { person: true } }); localStorage.setItem(key, JSON.stringify(list)); })()""")
    page.reload()
    page.wait_for_selector(".output-card")
    page.locator(".lab-panel summary").click()
    check(page.locator(".lab-summary tbody tr").count() == 2, "再読み込み後も検証メモが残り、旧形式の記録も読める")
    check(page.locator(".lab-summary tbody tr", has_text="不明").count() == 1, "旧形式の記録は入力先「不明」として集計される")
    page.locator(".output-settings .chip", has_text="PIXAI").first.click()
    page.locator(".output-settings .chip", has_text="Tsubaki系").click()
    check(page.locator(".lab-panel .variant-list").count() == 0 and "Tsubaki系は自然文" in page.locator(".lab-panel").inner_text(), "Tsubaki系では比較を出さず、別方式として案内する")
    page.locator(".combine-help summary").click()
    check("キャラクタープロンプト" not in page.locator(".combine-help").inner_text() and "Tsubaki系" in page.locator(".combine-help").inner_text(), "NovelAI以外ではNovelAI専用の説明を出さない")
    page.locator(".output-settings .chip", has_text="背景だけで使う").click()
    check(page.locator(".lab-panel").count() == 0 and page.locator(".combine-help").count() == 0, "背景だけで使うときは案内も試験機能も出ない")
    page.locator(".output-settings .chip", has_text="人物を目立たせる").click()
    page.once("dialog", lambda d: d.accept())
    page.locator(".reset-tools button", has_text="選択をクリア").click()
    page.get_by_role("button", name="保存一覧").click()
    check(page.locator(".saved-list article", has_text="お月見テスト").count() == 1, "リセットしても保存一覧は残る")
    page.locator(".modal-close").click()
    check(not errors, "季節イベント操作中のページエラーなし " + "; ".join(errors))
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
