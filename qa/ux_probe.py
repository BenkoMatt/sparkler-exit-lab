import asyncio, time, json
from playwright.async_api import async_playwright

BASE = "http://127.0.0.1:8123/index.html"
SHOTS = "/root/sparkler-lab/qa/shots/"
log = []

def stamp(t0, label):
    log.append(f"{time.time()-t0:6.1f}s  {label}")

async def main():
    t0 = time.time()
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={"width":1440,"height":900})
        console_msgs = []
        page.on("console", lambda m: console_msgs.append(f"{m.type}: {m.text[:200]}"))
        page.on("pageerror", lambda e: console_msgs.append(f"PAGEERROR: {str(e)[:300]}"))

        await page.goto(BASE, wait_until="networkidle")
        stamp(t0, "land")

        # 5-second comprehension: capture hero text
        hero = await page.evaluate("""() => {
            const h1 = document.querySelector('h1');
            const firstSection = document.querySelector('section, .hero, header');
            return {h1: h1 ? h1.innerText.slice(0,300) : null,
                    heroText: firstSection ? firstSection.innerText.slice(0,600) : document.body.innerText.slice(0,600)};
        }""")
        await page.screenshot(path=SHOTS+"ux-01-desktop-hero.png")
        stamp(t0, "hero shot")

        # inventory of page structure
        inv = await page.evaluate("""() => {
            const out = [];
            document.querySelectorAll('button, a[href], input, select, textarea, [role=button], [onclick]').forEach(el => {
                const r = el.getBoundingClientRect();
                if (r.width>0 && r.height>0) out.push({
                    tag: el.tagName, txt: (el.innerText||el.value||el.placeholder||el.getAttribute('aria-label')||'').slice(0,60).replace(/\\n/g,' | '),
                    id: el.id||'', cls: (el.className||'').toString().slice(0,40),
                    x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height)
                });
            });
            return out;
        }""")
        with open("/root/sparkler-lab/qa/desktop-inventory.json","w") as f: json.dump(inv,f,indent=1)
        print(f"HERO H1: {hero['h1']}")
        print(f"HERO TEXT: {hero['heroText'][:400]}")
        print(f"INTERACTIVE ELEMENTS: {len(inv)}")
        for el in inv[:40]: print(f"  [{el['tag']}] {el['txt'][:50]} @({el['x']},{el['y']}) {el['w']}x{el['h']} id={el['id']}")
        print("CONSOLE:", console_msgs[:5] if console_msgs else "clean")
        with open("/root/sparkler-lab/qa/desktop-log.json","w") as f: json.dump({"log":log,"console":console_msgs},f,indent=1)
        await browser.close()

asyncio.run(main())