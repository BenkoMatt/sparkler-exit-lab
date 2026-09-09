import asyncio, time, json
from playwright.async_api import async_playwright

BASE = "http://127.0.0.1:8123/index.html"
SHOTS = "/root/sparkler-lab/qa/shots/"
out = []

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        ctx = await browser.new_context(viewport={"width":1440,"height":900})
        page = await ctx.new_page()
        await page.goto(BASE, wait_until="networkidle")

        # (a) scroll position after sample click, settled
        await page.click("header#topnav a[href='#s5gallery']")
        await page.wait_for_timeout(400)
        await page.click("button.sample-open >> nth=0")
        await page.wait_for_timeout(2000)
        pos = await page.evaluate("() => {const ed = document.getElementById('s4editor').getBoundingClientRect(); return {scrollY, edTop: Math.round(ed.top), edVis: ed.top > -50 && ed.top < 900}}")
        out.append(("after 'Open in lab' +2s", pos))

        # (b) head placement via QA hook
        box = await page.eval_on_selector("#editorCanvas", "el => {const r = el.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height}}")
        await page.mouse.click(box["x"]+box["w"]*0.55, box["y"]+box["h"]*0.45)
        await page.wait_for_timeout(600)
        st = await page.evaluate("() => window.__sparklerEditor ? {layers: window.__sparklerEditor.state().length, sel: !!window.__sparklerEditor.selected(), base: window.__sparklerEditor.baseSize()} : null")
        out.append(("head placed on click", st))
        await page.screenshot(path=SHOTS+"ux-07-desktop-editor-head-placed.png")

        # (c) head library card click — wired or dead?
        await page.eval_on_selector("#s3heads", "el => el.scrollIntoView()")
        await page.wait_for_timeout(300)
        card = await page.eval_on_selector(".headCard", "el => {const r = el.getBoundingClientRect(); const before = window.__sparklerEditor ? window.__sparklerEditor.state().length : -1; el.click(); return {before, tag: el.tagName}}")
        await page.wait_for_timeout(400)
        after = await page.evaluate("() => window.__sparklerEditor ? window.__sparklerEditor.state().length : -1")
        selkind = await page.evaluate("() => document.getElementById('headSelect').value")
        out.append((f"headCard click: before={card['before']} after={after}, headSelect still='{selkind}'", "card click is DEAD (not wired)"))

        # (d) editor hint text verbatim (does it document delete gestures?)
        hint = await page.eval_on_selector(".editor-hint", "el => el.innerText")
        out.append(("editor hint verbatim", hint))

        # (e) undo enabled after place? redo? does undo work
        und = await page.eval_on_selector("#undoBtn", "el => {const d0 = el.disabled; el.click(); return d0}")
        await page.wait_for_timeout(300)
        layers_after_undo = await page.evaluate("() => window.__sparklerEditor.state().length")
        out.append((f"undo btn was disabled? {und}", f"layers after undo: {layers_after_undo}"))

        # (f) Clear heads with nothing placed
        await page.click("#resetBtn"); await page.wait_for_timeout(200)

        # (g) stage empty visibility semantics
        stageVis = await page.evaluate("() => {const se = document.getElementById('stageEmpty'); const c = document.getElementById('editorCanvas'); return {stageEmptyHidden: se.hidden, canvasHidden: c.hidden}}")
        out.append(("stage empty/canvas hidden flags", stageVis))

        # (h) 'Use camera' on desktop headless -> fallback message
        await page.click("header#topnav a[href='#s2lab']"); await page.wait_for_timeout(400)
        await page.click("#cameraBtn"); await page.wait_for_timeout(1200)
        cam = await page.evaluate("() => document.getElementById('exifCard').innerText")
        overlay_open = await page.evaluate("() => !!document.querySelector('[role=dialog]')")
        out.append(("camera click result (headless, perms granted)", {"exifCard": cam[:120], "dialog": overlay_open}))

        # (i) mobile sticky nav height + hero coverage
        mctx = await browser.new_context(viewport={"width":390,"height":844}, is_mobile=True, has_touch=True)
        mp = await mctx.new_page()
        await mp.goto(BASE, wait_until="networkidle")
        navh = await mp.evaluate("() => {const h = document.getElementById('topnav'); return {h: Math.round(h.getBoundingClientRect().height), top: h.getBoundingClientRect().top}}")
        out.append(("MOBILE sticky nav height (2 rows)", navh))
        hero5 = await mp.evaluate("() => {const s = document.getElementById('s1hero'); const r = s.getBoundingClientRect(); return {h1Visible: r.top < 300, heroText: s.innerText.slice(0,220)}}")
        out.append(("MOBILE hero", hero5))
        await mp.screenshot(path=SHOTS+"ux-09-mobile-hero.png")

        # mobile editor with head + export flow quickly
        await mp.click("header#topnav a[href='#s5gallery']"); await mp.wait_for_timeout(400)
        await mp.click("button.sample-open >> nth=0"); await mp.wait_for_timeout(1600)
        mob = await mp.evaluate("() => ({scrollY, edTop: Math.round(document.getElementById('s4editor').getBoundingClientRect().top)})")
        out.append(("MOBILE after sample click +1.6s", mob))
        await mp.screenshot(path=SHOTS+"ux-12-mobile-editor.png")
        cbox = await mp.eval_on_selector("#editorCanvas", "el => {const r = el.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height}}")
        await mp.touchscreen.tap(cbox["x"]+cbox["w"]*0.55, cbox["y"]+cbox["h"]*0.45)
        await mp.wait_for_timeout(600)
        mst = await mp.evaluate("() => window.__sparklerEditor ? {layers: window.__sparklerEditor.state().length, base: window.__sparklerEditor.baseSize()} : null")
        out.append(("MOBILE head placed via tap", mst))
        await mp.screenshot(path=SHOTS+"ux-12-mobile-editor-head.png")
        # long-press delete works?
        await mp.touchscreen.tap(cbox["x"]+cbox["w"]*0.55, cbox["y"]+cbox["h"]*0.45)  # tap same spot selects+drags not delete; long press needs hold
        await mp.wait_for_timeout(300)
        mst2 = await mp.evaluate("() => window.__sparklerEditor.state().length")
        out.append(("MOBILE second tap on same spot (should select not add)", mst2))

        await browser.close()

asyncio.run(main())
print(json.dumps(out, indent=1, default=str))