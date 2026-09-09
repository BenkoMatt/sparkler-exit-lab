import asyncio, json, time
from playwright.async_api import async_playwright

BASE = "http://127.0.0.1:8123/index.html"

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        page = await (await b.new_context(viewport={"width":1440,"height":900})).new_page()
        await page.goto(BASE, wait_until="networkidle")
        await page.click("header#topnav a[href='#s5gallery']"); await page.wait_for_timeout(300)
        await page.click("button.sample-open >> nth=0"); await page.wait_for_timeout(1000)
        await page.click("#sendToEditor")
        # poll state every 300ms for 3s
        states = []
        for i in range(10):
            s = await page.evaluate("""() => {
                const se = document.getElementById('stageEmpty');
                const c = document.getElementById('editorCanvas');
                return {emptyHidden: se.hidden, emptyTxt: (se.hidden ? '' : se.innerText.slice(0,50)),
                        canvasHidden: c.hidden, layers: window.__sparklerEditor ? window.__sparklerEditor.state().length : -1};
            }""")
            states.append(s)
            await page.wait_for_timeout(300)
        print(json.dumps(states, indent=0))
        # place head via correct hook
        box = await page.eval_on_selector("#editorCanvas", "el => {const r=el.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height}}")
        await page.mouse.click(box["x"]+box["w"]*0.5, box["y"]+box["h"]*0.5)
        await page.wait_for_timeout(500)
        print("layers after click:", await page.evaluate("() => window.__sparklerEditor.state().length"))
        await b.close()

asyncio.run(main())