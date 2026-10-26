/* Renders the six camera scenarios to MP4 sample footage plus a JSON file of person/bag boxes per frame.
 *   node tools/make-samples.js      (needs Playwright with Chromium, and ffmpeg)
 * The footage is synthetic: it is drawn by js/sim.js. Replace samples/CAM-0X.mp4 with your own clips if you have them. */
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path');
const W = 960, H = 540, FPS = 24, ROOT = path.resolve(__dirname, '..');
(async () => {
  fs.mkdirSync(path.join(ROOT, 'samples'), { recursive: true });
  const browser = await chromium.launch(); const page = await browser.newPage({ viewport: { width: 1000, height: 600 } });
  await page.goto('file://' + path.join(ROOT, 'index.html') + '#/overview'); await page.waitForTimeout(500);
  const cams = await page.evaluate(() => AF.cameras.map((c) => ({ id: c.id, sc: c.scenario, dur: Sim.scen[c.scenario].duration })));
  for (const cam of cams) {
    const out = path.join(ROOT, 'samples', cam.id + '.mp4');
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'slow', '-crf', '27', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
    await page.evaluate(({ sc, W, H }) => { const c = document.createElement('canvas'); c.id = 'gen'; document.body.appendChild(c); window.__p = new Sim.SimPlayer(c, Sim.scen[sc], { size: [W, H], autoplay: false, raw: true }); window.__p.playing = false; }, { sc: cam.sc, W, H });
    const n = Math.round(cam.dur * FPS);
    for (let i = 0; i < n; i += 24) {
      const batch = await page.evaluate(({ i, n, FPS }) => { const out = []; for (let k = i; k < Math.min(n, i + 24); k++) { window.__p.seek(k / FPS); out.push(window.__p.c.toDataURL('image/jpeg', 0.92).split(',')[1]); } return out; }, { i, n, FPS });
      for (const b of batch) if (!ff.stdin.write(Buffer.from(b, 'base64'))) await new Promise((r) => ff.stdin.once('drain', r));
    }
    ff.stdin.end(); await new Promise((r) => ff.on('close', r));
    const ann = await page.evaluate(({ sc, W, H, dur }) => { const frames = []; for (let t = 0; t <= dur; t += 0.1) frames.push({ t: +t.toFixed(2), d: Sim.boxes(Sim.scen[sc], t, W, H).map((b) => [b.cls, ...b.bbox.map(Math.round)]) }); document.getElementById('gen').remove(); return { w: W, h: H, fps: 10, frames }; }, { sc: cam.sc, W, H, dur: cam.dur });
    fs.writeFileSync(path.join(ROOT, 'samples', cam.id + '.json'), JSON.stringify(ann));
    // WebM copy for browsers without H.264 (e.g. open-source Chromium)
    await new Promise((r) => spawn('ffmpeg', ['-y', '-loglevel', 'error', '-i', out, '-c:v', 'libvpx-vp9', '-crf', '38', '-b:v', '0', '-deadline', 'good', '-cpu-used', '4', '-row-mt', '1', '-an', out.replace('.mp4', '.webm')], { stdio: 'inherit' }).on('close', r));
    console.log(cam.id, cam.sc, n + ' frames', (fs.statSync(out).size / 1024).toFixed(0) + ' KB');
  }
  await browser.close();
})();
