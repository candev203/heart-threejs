import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const url = process.env.SCENE_URL ?? 'http://127.0.0.1:5174/';
const outputDir = new URL('../artifacts/', import.meta.url);
const defaultChromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const viewports = [
  { name: 'desktop', width: 1440, height: 960 },
  { name: 'mobile', width: 390, height: 844 },
];

await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ?? defaultChromePath,
});
const results = [];

try {
  for (const viewport of viewports) {
    const page = await browser.newPage({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: viewport.name === 'mobile' ? 2 : 1,
    });
    const browserMessages = [];

    page.on('console', (message) => {
      browserMessages.push(`${message.type()}: ${message.text()}`);
    });

    page.on('pageerror', (error) => {
      browserMessages.push(`pageerror: ${error.message}`);
    });

    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForSelector('#heart-scene');
    await page.waitForTimeout(1200);

    const screenshotPath = fileURLToPath(new URL(`heart-${viewport.name}.png`, outputDir));
    await page.screenshot({ path: screenshotPath, fullPage: true });

    const metrics = await page.evaluate(() => {
      const canvas = document.querySelector('#heart-scene');
      const probe = document.createElement('canvas');
      const width = canvas.width;
      const height = canvas.height;
      probe.width = width;
      probe.height = height;

      const context = probe.getContext('2d', { willReadFrequently: true });
      context.drawImage(canvas, 0, 0, width, height);

      const { data } = context.getImageData(0, 0, width, height);
      const step = Math.max(4, Math.floor(Math.min(width, height) / 110));
      let samples = 0;
      let bright = 0;
      let redGlow = 0;
      let cyanGlow = 0;
      let totalLuma = 0;
      let minX = width;
      let maxX = 0;
      let minY = height;
      let maxY = 0;

      for (let y = 0; y < height; y += step) {
        for (let x = 0; x < width; x += step) {
          const index = (y * width + x) * 4;
          const r = data[index];
          const g = data[index + 1];
          const b = data[index + 2];
          const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;

          samples += 1;
          totalLuma += luma;

          if (luma > 32) {
            bright += 1;
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
          }

          if (r > 90 && r > g * 1.2 && r > b * 0.85) {
            redGlow += 1;
          }

          if (b > 58 && g > 46 && b > r * 0.72) {
            cyanGlow += 1;
          }
        }
      }

      const brightRatio = bright / samples;
      const redRatio = redGlow / samples;
      const cyanRatio = cyanGlow / samples;
      const averageLuma = totalLuma / samples;
      const brightCenterX = (minX + maxX) / 2 / width;
      const brightCenterY = (minY + maxY) / 2 / height;

      return {
        width,
        height,
        averageLuma,
        brightRatio,
        redRatio,
        cyanRatio,
        brightCenterX,
        brightCenterY,
      };
    });

    const isRenderable =
      metrics.averageLuma > 4 &&
      metrics.brightRatio > 0.015 &&
      metrics.redRatio > 0.01 &&
      metrics.brightCenterX > 0.33 &&
      metrics.brightCenterX < 0.67 &&
      metrics.brightCenterY > 0.26 &&
      metrics.brightCenterY < 0.74;

    results.push({
      viewport: viewport.name,
      screenshot: screenshotPath,
      isRenderable,
      browserMessages,
      metrics,
    });

    await page.close();
  }
} finally {
  await browser.close();
}

for (const result of results) {
  console.log(JSON.stringify(result, null, 2));
}

const failed = results.filter((result) => !result.isRenderable);

if (failed.length > 0) {
  throw new Error(`Scene verification failed for: ${failed.map((item) => item.viewport).join(', ')}`);
}
