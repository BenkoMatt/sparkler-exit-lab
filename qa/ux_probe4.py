import asyncio, json
from playwright.async_api import async_playwright

BASE = "http://127.0.0.1:8123/index.html"
SHOTS = "/root/sparkler-lab/qa/shots/"

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        # ---- MOBILE, done properly: scroll editor into view before tapping ----
        mp = await (await b.new_context(viewport={"width":390,"height":844}, is_mobile=True, has_touch=True)).new_page()
        await mp.goto(BASE, wait_until="networkidle")
        await mp.click("header#topnav a[href='#s5gallery']"); await mp.wait_for_timeout(300)
        await mp.click("button.sample-open >> nth=0")
        await mp.wait_for_timeout(2500)  # let editor.js's own scroll settle
        vis = await mp.evaluate("""() => {
            const c = document.getElementById('editorCanvas');
            const r = c.getBoundingClientRect();
            return {canvasTop: Math.round(r.top), canvasH: Math.round(r.height),
                    fullyVisible: r.top >= 0 && r.bottom <= 844};
        }""")
        print("mobile canvas visibility after sample auto-scroll:", vis)
        # scroll canvas into view, then tap
        await mp.eval_on_selector("#editorCanvas", "el => el.scrollIntoView({block:'center'})")
        await mp.wait_for_timeout(600)
        cbox = await mp.eval_on_selector("#editorCanvas", "el => {const r=el.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height}}")
        print("canvas box after centering:", cbox)
        await mp.touchscreen.tap(cbox["x"]+cbox["w"]*0.55, cbox["y"]+cbox["h"]*0.45)
        await mp.wait_for_timeout(700)
        st = await mp.evaluate("() => window.__sparklerEditor ? {layers: window.__sparklerEditor.state().length, base: window.__sparklerEditor.baseSize()} : null")
        print("MOBILE head placed (proper scroll):", st)
        await mp.screenshot(path=SHOTS+"ux-13-mobile-editor-head-placed.png")
        # second tap same spot => should select, not duplicate
        await mp.touchscreen.tap(cbox["x"]+cbox["w"]*0.55, cbox["y"]+cbox["h"]*0.45)
        await mp.wait_for_timeout(500)
        st2 = await mp.evaluate("() => window.__sparklerEditor.state().length")
        print("MOBILE after 2nd tap same spot (expect still 1):", st2)
        # long-press delete
        await mp.evaluate("""() => {
            const c = document.getElementById('editorCanvas');
            const r = c.getBoundingClientRect();
            window.__lp = {x: r.x + r.width*0.55, y: r.y + r.height*0.45};
        }""")
        lp = await mp.evaluate("() => window.__lp")
        # use mouse with down-hold-up via CDP-ish: playwright touchscreen has no long press; use mouse
        await mp.mouse.move(lp["x"], lp["y"])
        await mp.mouse.down()
        await mp.wait_for_timeout(900)
        await mp.mouse.up()
        await mp.wait_for_timeout(500)
        st3 = await mp.evaluate("() => window.__sparklerEditor.state().length")
        print("MOBILE after long-press 900ms (expect 0 if delete works):", st3)

        # ---- DESKTOP: measure where 'Open in lab' lands the user, precisely ----
        page = await (await b.new_context(viewport={"width":1440,"height":900})).new_page()
        await page.goto(BASE, wait_until="networkidle")
        await page.click("header#topnav a[href='#s5gallery']"); await page.wait_for_timeout(300)
        await page.click("button.sample-open >> nth=0")
        # sample positions over time
        for delay in (600, 1200, 2000, 3000):
            await page.wait_for_timeout(delay if delay==600 else delay-600)
            pos = await page.evaluate("""() => {
                const ed = document.getElementById('s4editor').getBoundingClientRect();
                const c = document.getElementById('editorCanvas');
                const cr = c.getBoundingClientRect();
                return {scrollY, edTop: Math.round(ed.top), canvasTop: Math.round(cr.top), canvasHidden: c.hidden};
            }""")
            print(f"desktop t≈{delay}ms:", pos)
        await b.close()

asyncio.run(main())