// Renders every icon file from components/brand/BrixMark.tsx:
//   app/icon.svg, public/brix-mark.svg, app/favicon.ico, app/apple-icon.png,
//   public/icon-192.png, public/icon-512.png
//   app/opengraph-image.png (share image, uses the current phone screens)
// Run: npm run icons
import { readFileSync, writeFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { chromium } from "@playwright/test";
import { BrixMark } from "../components/brand/BrixMark";

const svg = (tile: boolean) =>
  renderToStaticMarkup(createElement(BrixMark, { tile })).replace(
    / aria-hidden="true" focusable="false"/,
    "",
  );

const tileSvg = svg(true);
writeFileSync("app/icon.svg", tileSvg + "\n");
writeFileSync("public/brix-mark.svg", svg(false) + "\n");

async function png(size: number) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${tileSvg}`,
  );
  const buf = await page.screenshot({ omitBackground: true });
  await browser.close();
  return buf;
}

// ICO with embedded PNGs (supported by every current browser).
function ico(images: { size: number; data: Buffer }[]) {
  const head = Buffer.alloc(6 + images.length * 16);
  head.writeUInt16LE(0, 0);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(images.length, 4);
  let offset = head.length;
  images.forEach(({ size, data }, i) => {
    const o = 6 + i * 16;
    head.writeUInt8(size >= 256 ? 0 : size, o);
    head.writeUInt8(size >= 256 ? 0 : size, o + 1);
    head.writeUInt16LE(1, o + 4);
    head.writeUInt16LE(32, o + 6);
    head.writeUInt32LE(data.length, o + 8);
    head.writeUInt32LE(offset, o + 12);
    offset += data.length;
  });
  return Buffer.concat([head, ...images.map((i) => i.data)]);
}


// Share image: 1200x630, the same mark, headline and phone proportions as the site.
function phone(src: string, width: number, style: string) {
  const bezel = width * 0.026;
  return `<div class="ph" style="width:${width}px;padding:${bezel}px;border-radius:${width * 0.155}px;${style}">
    <div class="sc" style="border-radius:${width * 0.129}px">
      <img src="data:image/webp;base64,${readFileSync(`public/screens/${src}`).toString("base64")}">
      <span class="is" style="top:${width * 0.0265}px;width:${width * 0.3}px;height:${width * 0.087}px"></span>
      <span class="sb" style="height:${width * 0.13}px;font-size:${width * 0.04}px;padding:0 ${width * 0.08}px 0 ${width * 0.115}px">9:41<b></b></span>
    </div></div>`;
}

async function shareImage() {
  const mark = svg(false);
  const html = `<!doctype html><html><head><style>
@import url('https://fonts.googleapis.com/css2?family=Figtree:wght@500;650;800;900&display=block');
*{box-sizing:border-box;margin:0}
body{width:1200px;height:630px;background:#f7f5ef;font-family:Figtree,sans-serif;color:#292920;overflow:hidden;position:relative}
.l{position:absolute;left:72px;top:64px;width:580px}
.wm{display:flex;align-items:center;gap:8px;font-weight:900;font-size:44px;letter-spacing:-.06em}
.wm svg{width:46px;height:42px}.wm b{color:#c8462a}
h1{margin-top:64px;font-size:74px;line-height:.98;letter-spacing:-.045em;font-weight:800}
h1 em{font-style:normal;color:#b13c22}
p{margin-top:26px;font-size:24px;color:#4a493f;line-height:1.4;font-weight:500}
.ph{position:absolute;background:linear-gradient(150deg,#45453d,#1d1d18 38%,#2f2f29);box-shadow:inset 0 0 0 1px #6a6a5e,0 30px 60px -20px #29292066}
.sc{position:relative;overflow:hidden;aspect-ratio:393/852;background:#f7f5ef}
.sc img{display:block;width:100%;height:100%;object-fit:cover}
.is{position:absolute;left:50%;transform:translateX(-50%);border-radius:99px;background:#0b0b09}
.sb{position:absolute;inset:0 0 auto;display:flex;align-items:center;justify-content:space-between;font-weight:650}
.sb b{width:2.6em;height:.9em;border-radius:.25em;background:#292920}
.rule{position:absolute;left:72px;bottom:56px;font-size:20px;color:#6b6a60;font-weight:650;display:flex;gap:12px;align-items:center}
.rule:before{content:"";width:36px;height:2px;background:#c8462a}
</style></head><body>
<div class="l"><div class="wm">${mark}<span>brix<b>.</b></span></div>
<h1>Catch the charge <em>before it catches you.</em></h1>
<p>Tracks subscriptions and free trials. Reminds you before they bill.</p></div>
${phone("dashboard-mobile-393.webp", 240, "right:250px;top:44px;z-index:2")}
${phone("chat-confirm-mobile-393.webp", 206, "right:56px;top:122px")}
<div class="rule">usebrix.app</div>
</body></html>`;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await page.setContent(html, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: "app/opengraph-image.png" });
  await browser.close();
}

async function main() {
  const sizes = [16, 32, 48];
  const icoImages: { size: number; data: Buffer }[] = [];
  for (const size of sizes) icoImages.push({ size, data: await png(size) });
  writeFileSync("app/favicon.ico", ico(icoImages));
  writeFileSync("app/apple-icon.png", await png(180));
  writeFileSync("public/icon-192.png", await png(192));
  writeFileSync("public/icon-512.png", await png(512));
  await shareImage();
  console.log("icons and share image written");
}

main();
