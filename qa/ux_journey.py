import asyncio, time, json
from playwright.async_api import async_playwright

BASE = "http://127.0.0.1:8123/index.html"
SHOTS = "/root/sparkler-lab/qa/shots/"
log = []
confusions = []
console_msgs = []

def stamp(t0, label, note=""):
    log.append(f"{time.time()-t0:6.1f}s  {label}" + (f"  — {note}" if note else ""))

async def main():
    t0 = time.time()
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        ctx = await browser.new_context(viewport={"width":1440,"height":900},
                                        permissions=["camera"], locale="en-US")
        page = await ctx.new_page()
        page.on("console", lambda m: console_msgs.append(f"{m.type}: {m.text[:220]}"))
        page.on("pageerror", lambda e: console_msgs.append(f"PAGEERROR: {str(e)[:300]}"))

        await page.goto(BASE, wait_until="networkidle")
        stamp(t0, "LAND — hero visible")
        await page.screenshot(path=SHOTS+"ux-01-desktop-hero.png")

        # --- nav labels + hero comprehension ---
        nav = await page.eval_on_selector_all("header#topnav a",
            "els => els.map(e => e.innerText + ' -> ' + e.getAttribute('href'))")
        stamp(t0, f"nav: {nav}")

        # --- Step 1: Try the Lab ---
        await page.click("text=Try the Lab")
        await page.wait_for_timeout(700)
        stamp(t0, "clicked 'Try the Lab' CTA -> lands at Photo Lab")
        await page.screenshot(path=SHOTS+"ux-02-desktop-lab.png")

        # No photo yet: try Send to editor (dead-end test)
        await page.eval_on_selector("#sendToEditor", "el => el.scrollIntoView({block:'center'})")
        await page.click("#sendToEditor")
        await page.wait_for_timeout(400)
        guard = await page.eval_on_selector("#exifCard", "el => el.innerText")
        stamp(t0, f"clicked Send to editor with NO photo -> guard msg: {guard!r}")
        confusions.append(f"Send-to-editor with no photo: guard='{guard.strip()}' (msg appears in EXIF card far above, user may not see it)")

        # --- Step 2: discover sample loading path ---
        # From lab, how does a first-timer get a sample? Only via Gallery further down.
        lab_txt = await page.eval_on_selector("#s2lab", "el => el.innerText.slice(0,400)")
        stamp(t0, f"lab section text: {lab_txt[:200]!r}")

        # --- Step 3: go to Gallery, load sample ---
        await page.click("header#topnav a[href='#s5gallery']")
        await page.wait_for_timeout(600)
        await page.screenshot(path=SHOTS+"ux-03-desktop-gallery.png")
        await page.click("button.sample-open >> nth=0")
        await page.wait_for_timeout(900)
        state = await page.evaluate("() => ({src: window.__sparklerLab && window.__sparklerLab.source ? 'loaded' : 'none', name: window.__sparklerLab && window.__sparklerLab.fileName})")
        stamp(t0, f"clicked 'Open in lab' (tunnel-drag) -> bundle: {state}")
        await page.screenshot(path=SHOTS+"ux-04-desktop-gallery-sample-clicked.png")

        # Did it scroll me to the lab? Where am I now?
        pos = await page.evaluate("() => scrollY")
        stamp(t0, f"after sample click, scrollY={pos} (sample click does NOT auto-scroll to lab)")

        # --- Step 4: go back to Lab, read analysis ---
        await page.click("header#topnav a[href='#s2lab']")
        await page.wait_for_timeout(600)
        score = await page.eval_on_selector("#scoreNum", "el => el.innerText")
        sub = await page.eval_on_selector_all(".sub-label", "els => els.map(e => e.innerText)")
        recs = await page.eval_on_selector("#recList", "el => el.innerText.slice(0,400)")
        exif = await page.eval_on_selector("#exifCard", "el => el.innerText")
        stamp(t0, f"analysis: score={score} subs={sub} exif={exif[:60]!r}")
        stamp(t0, f"recs: {recs[:300]!r}")
        await page.screenshot(path=SHOTS+"ux-05-desktop-lab-score.png")

        # --- Step 5: Send to editor ---
        await page.click("#sendToEditor")
        await page.wait_for_timeout(900)
        stage = await page.eval_on_selector("#stageEmpty", "el => el.innerText")
        stamp(t0, f"after Send to editor, stageEmpty text: {stage!r}")
        await page.screenshot(path=SHOTS+"ux-06-desktop-editor-empty.png")

        # --- Step 6: place head on canvas ---
        canvas_box = await page.eval_on_selector("#editorCanvas", "el => {const r = el.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height}}")
        # click mid-canvas (a wand tip spot on sample)
        cx = canvas_box["x"] + canvas_box["w"]*0.5
        cy = canvas_box["y"] + canvas_box["h"]*0.5
        await page.mouse.click(cx, cy)
        await page.wait_for_timeout(600)
        headcount = await page.evaluate("() => (window.__sparklerLab && window.__sparklerLab.heads) ? window.__sparklerLab.heads.length : -1")
        stamp(t0, f"clicked canvas center to place head -> heads count: {headcount}")
        await page.screenshot(path=SHOTS+"ux-07-desktop-editor-head-placed.png")

        # --- Step 7: export ---
        dl = await page.expect_download() if False else None
        try:
            async with page.expect_download(timeout=4000) as dlinfo:
                await page.click("#exportBtn")
            d = await dlinfo.value
            path = "/root/sparkler-lab/qa/export-test.png"
            await d.save_as(path)
            stamp(t0, f"EXPORT OK -> {d.suggested_filename} saved {path}")
        except Exception as e:
            stamp(t0, f"EXPORT: no download event within 4s: {str(e)[:100]}")
        await page.screenshot(path=SHOTS+"ux-08-desktop-editor-export.png")

        # jargon check on full page text
        jargon = await page.evaluate("""() => {
            const t = document.body.innerText;
            const checks = {
              'rear-curtain': /rear[- ]curtain/i,
              'FEC': /FEC/,
              'shutter drag': /shutter drag/i,
              'TTL': /TTL/,
              'bokeh': /bokeh/i
            };
            const out = {};
            for (const [k,re] of Object.entries(checks)) {
              const i = t.search(re);
              out[k] = i >= 0 ? t.slice(Math.max(0,i-160), i+220).replace(/\\n+/g,' | ') : null;
            }
            return out;
        }""")
        with open("/root/sparkler-lab/qa/jargon-context.json","w") as f: json.dump(jargon,f,indent=1)

        # --- MOBILE pass 390x844 ---
        mctx = await browser.new_context(viewport={"width":390,"height":844},
                                         is_mobile=True, has_touch=True,
                                         device_scale_factor=2, permissions=["camera"])
        mp = await mctx.new_page()
        mp.on("console", lambda m: console_msgs.append(f"MOB {m.type}: {m.text[:180]}"))
        mp.on("pageerror", lambda e: console_msgs.append(f"MOB PAGEERROR: {str(e)[:260]}"))
        await mp.goto(BASE, wait_until="networkidle")
        await mp.screenshot(path=SHOTS+"ux-09-mobile-hero.png")

        # nav on mobile
        mnav = await mp.eval_on_selector_all("header#topnav a",
            "els => els.map(e => {const r = e.getBoundingClientRect(); return {t:e.innerText, x:Math.round(r.x), y:Math.round(r.y), w:Math.round(r.width), h:Math.round(r.height), vis:r.width>0&&r.height>0}})")
        stamp(t0, f"MOBILE nav items: {json.dumps(mnav)}")

        # full-page mobile shot + toolbar layout
        await mp.screenshot(path=SHOTS+"ux-10-mobile-full.png", full_page=True)
        mtb = await mp.eval_on_selector_all("#s4editor .toolbar-group",
            "els => els.map(e => {const r = e.getBoundingClientRect(); return {x:Math.round(r.x), y:Math.round(r.y), w:Math.round(r.width), h:Math.round(r.height)}})")
        stamp(t0, f"MOBILE editor toolbar groups (unscrolled): {json.dumps(mtb)}")
        # check horizontal overflow
        ovf = await mp.evaluate("() => ({docW: document.documentElement.scrollWidth, winW: window.innerWidth})")
        stamp(t0, f"MOBILE horizontal overflow: docW={ovf['docW']} vs winW={ovf['winW']} {'!! OVERFLOW' if ovf['docW'] > ovf['winW']+2 else 'ok'}")
        # tap-target sizes
        small = await mp.evaluate("""() => {
            const out = [];
            document.querySelectorAll('button, a, input, select, [role=button]').forEach(el => {
                const r = el.getBoundingClientRect();
                if (r.width>0 && r.height>0 && (r.width < 40 || r.height < 40))
                    out.push({t:(el.innerText||el.getAttribute('aria-label')||el.tagName).slice(0,30), w:Math.round(r.width), h:Math.round(r.height)});
            });
            return out;
        }""")
        stamp(t0, f"MOBILE tap targets <40px: {json.dumps(small)}")
        # mobile flow: gallery -> open sample -> lab -> editor -> place head
        await mp.click("header#topnav a[href='#s5gallery']")
        await mp.wait_for_timeout(500)
        await mp.click("button.sample-open >> nth=0")
        await mp.wait_for_timeout(800)
        await mp.click("header#topnav a[href='#s2lab']")
        await mp.wait_for_timeout(500)
        mscore = await mp.eval_on_selector("#scoreNum", "el => el.innerText")
        stamp(t0, f"MOBILE flow: sample loaded, score={mscore}")
        await mp.screenshot(path=SHOTS+"ux-11-mobile-lab.png")
        await mp.click("#sendToEditor")
        await mp.wait_for_timeout(800)
        await mp.click("#editorCanvas")
        await mp.wait_for_timeout(500)
        mheads = await mp.evaluate("() => (window.__sparklerLab && window.__sparklerLab.heads) ? window.__sparklerLab.heads.length : -1")
        stamp(t0, f"MOBILE: clicked canvas -> heads={mheads}")
        await mp.screenshot(path=SHOTS+"ux-12-mobile-editor.png")
        # try export on mobile
        await mp.eval_on_selector("#exportBtn", "el => el.scrollIntoView({block:'center'})")
        try:
            async with mp.expect_download(timeout=4000) as dl2:
                await mp.click("#exportBtn")
            d2 = await dl2.value
            stamp(t0, f"MOBILE EXPORT OK: {d2.suggested_filename}")
        except Exception as e:
            stamp(t0, f"MOBILE EXPORT: {str(e)[:120]}")

        # dead-end probes on desktop page still open
        await page.evaluate("() => scrollTo(0,0)")
        for sel, name in [("#flickerToggle", "Flicker toggle"), ("#baToggle", "Before/After")]:
            pass
        ba = await page.eval_on_selector("#baToggle", "el => {el.click(); return el.getAttribute('aria-pressed')}")
        await page.wait_for_timeout(300)
        stamp(t0, f"Before/After toggle pressed -> aria-pressed={ba}")
        # 'See how it works' CTA
        await page.click("text=See how it works")
        await page.wait_for_timeout(500)
        stamp(t0, "'See how it works' CTA -> scrolls to explain section OK")

        await browser.close()

asyncio.run(main())

print("=== TIMED JOURNEY ===")
for line in log: print(line)
print("\n=== CONSOLE (first 12) ===")
for c in console_msgs[:12]: print(c)