import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..", "..");
const outDir = join(root, "web", "assets", "generated");

const sizes = [16, 32, 64, 128, 256, 512, 1024];

await mkdir(outDir, { recursive: true });

for (const size of sizes) {
  const png = renderIcon(size);
  await writeFile(join(outDir, `sbs-prism-app-icon-${size}.png`), png);
}

await writeFile(join(outDir, "sbs-prism-app-icon.png"), renderIcon(1024));

function renderIcon(size) {
  const scale = size / 1024;
  const pixels = new Uint8ClampedArray(size * size * 4);

  const fill = (x, y, color) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    const a = color[3];
    const ia = 1 - a;
    pixels[i] = Math.round(color[0] * a + pixels[i] * ia);
    pixels[i + 1] = Math.round(color[1] * a + pixels[i + 1] * ia);
    pixels[i + 2] = Math.round(color[2] * a + pixels[i + 2] * ia);
    pixels[i + 3] = Math.round(255 * a + pixels[i + 3] * ia);
  };

  fillRoundedTile(fill, size, 80 * scale, 80 * scale, 864 * scale, 864 * scale, 190 * scale);

  const point = (x, y) => [x * scale, y * scale];
  const line = (a, b, color, width) => drawLine(fill, size, point(...a), point(...b), color, width * scale);
  const poly = (pts, color) => fillPolygon(fill, size, pts.map((p) => point(...p)), color);

  // Near-equilateral prism: wide base, shorter height, friendlier silhouette.
  poly([[512, 272], [232, 732], [792, 732]], [72, 184, 216, 0.17]);
  poly([[512, 272], [512, 732], [792, 732]], [132, 112, 240, 0.1]);
  poly([[512, 272], [232, 732], [512, 462]], [255, 255, 255, 0.06]);

  // Input and output rays. Keep glow light so small app-icon sizes stay crisp.
  glowLine(fill, size, point(144, 512), point(334, 512), [180, 244, 255], 18 * scale, 0.14);
  line([144, 512], [334, 512], [197, 246, 255, 0.96], 16);
  [
    [[648, 512], [874, 380], [47, 140, 255]],
    [[648, 512], [874, 460], [49, 207, 122]],
    [[648, 512], [874, 532], [255, 196, 61]],
    [[648, 512], [874, 612], [255, 91, 69]],
    [[648, 512], [874, 712], [132, 87, 255]],
  ].forEach(([a, b, rgb]) => {
    glowLine(fill, size, point(...a), point(...b), rgb, 20 * scale, 0.14);
    line(a, b, [...rgb, 0.97], 17);
  });

  // Prism glow and edges.
  glowLine(fill, size, point(512, 272), point(232, 732), [110, 230, 255], 26 * scale, 0.14);
  glowLine(fill, size, point(512, 272), point(792, 732), [200, 184, 255], 26 * scale, 0.12);
  glowLine(fill, size, point(232, 732), point(792, 732), [150, 235, 255], 25 * scale, 0.12);
  line([512, 272], [232, 732], [236, 252, 255, 0.99], 22);
  line([512, 272], [792, 732], [233, 235, 255, 0.99], 22);
  line([232, 732], [792, 732], [206, 246, 255, 0.97], 22);
  line([512, 272], [512, 732], [218, 248, 255, 0.86], 12);
  line([232, 732], [648, 512], [156, 238, 255, 0.72], 12);
  line([648, 512], [792, 732], [210, 204, 255, 0.72], 12);

  circle(fill, size, point(512, 440), 28 * scale, [247, 253, 255, 0.98]);
  glowCircle(fill, size, point(512, 440), 56 * scale, [98, 220, 255], 0.08);

  return encodePng(size, size, pixels);
}

function fillRoundedTile(fill, size, x, y, width, height, radius) {
  const right = x + width;
  const bottom = y + height;
  for (let py = Math.max(0, Math.floor(y - 2)); py <= Math.min(size - 1, Math.ceil(bottom + 2)); py += 1) {
    for (let px = Math.max(0, Math.floor(x - 2)); px <= Math.min(size - 1, Math.ceil(right + 2)); px += 1) {
      const qx = Math.max(x + radius - px, 0, px - (right - radius));
      const qy = Math.max(y + radius - py, 0, py - (bottom - radius));
      const outside = Math.hypot(qx, qy) - radius;
      const edgeAlpha = Math.max(0, Math.min(1, 1 - outside));
      if (edgeAlpha <= 0) continue;
      const nx = (px - x) / width;
      const ny = (py - y) / height;
      const dx = nx - 0.5;
      const dy = ny - 0.48;
      const vignette = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) * 1.45);
      fill(px, py, [
        10 + 14 * vignette,
        17 + 16 * vignette,
        27 + 20 * vignette,
        edgeAlpha,
      ]);
    }
  }
}

function drawLine(fill, size, [x1, y1], [x2, y2], color, width) {
  const minX = Math.max(0, Math.floor(Math.min(x1, x2) - width * 2));
  const maxX = Math.min(size - 1, Math.ceil(Math.max(x1, x2) + width * 2));
  const minY = Math.max(0, Math.floor(Math.min(y1, y2) - width * 2));
  const maxY = Math.min(size - 1, Math.ceil(Math.max(y1, y2) + width * 2));
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy || 1;
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / len2));
      const px = x1 + t * dx;
      const py = y1 + t * dy;
      const d = Math.hypot(x - px, y - py);
      const alpha = Math.max(0, 1 - d / width);
      if (alpha > 0) fill(x, y, [color[0], color[1], color[2], (color[3] ?? 1) * alpha]);
    }
  }
}

function glowLine(fill, size, a, b, rgb, width, opacity) {
  drawLine(fill, size, a, b, [rgb[0], rgb[1], rgb[2], opacity], width);
}

function circle(fill, size, [cx, cy], radius, color) {
  for (let y = Math.max(0, Math.floor(cy - radius)); y <= Math.min(size - 1, Math.ceil(cy + radius)); y += 1) {
    for (let x = Math.max(0, Math.floor(cx - radius)); x <= Math.min(size - 1, Math.ceil(cx + radius)); x += 1) {
      const d = Math.hypot(x - cx, y - cy);
      const alpha = Math.max(0, 1 - d / radius);
      if (alpha > 0) fill(x, y, [color[0], color[1], color[2], color[3] * Math.min(1, alpha * 1.6)]);
    }
  }
}

function glowCircle(fill, size, p, radius, rgb, opacity) {
  circle(fill, size, p, radius, [rgb[0], rgb[1], rgb[2], opacity]);
}

function fillPolygon(fill, size, pts, color) {
  const minY = Math.max(0, Math.floor(Math.min(...pts.map((p) => p[1]))));
  const maxY = Math.min(size - 1, Math.ceil(Math.max(...pts.map((p) => p[1]))));
  for (let y = minY; y <= maxY; y += 1) {
    const hits = [];
    for (let i = 0; i < pts.length; i += 1) {
      const [x1, y1] = pts[i];
      const [x2, y2] = pts[(i + 1) % pts.length];
      if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) {
        hits.push(x1 + ((y - y1) * (x2 - x1)) / (y2 - y1));
      }
    }
    hits.sort((a, b) => a - b);
    for (let i = 0; i < hits.length; i += 2) {
      for (let x = Math.max(0, Math.floor(hits[i])); x <= Math.min(size - 1, Math.ceil(hits[i + 1])); x += 1) {
        fill(x, y, color);
      }
    }
  }
}

function encodePng(width, height, rgba) {
  const scanline = width * 4 + 1;
  const raw = Buffer.alloc(scanline * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * scanline] = 0;
    Buffer.from(rgba.buffer, y * width * 4, width * 4).copy(raw, y * scanline + 1);
  }

  const chunks = [
    chunk("IHDR", Buffer.concat([
      u32(width),
      u32(height),
      Buffer.from([8, 6, 0, 0, 0]),
    ])),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ];
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), ...chunks]);
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type);
  const crcData = Buffer.concat([typeBuf, data]);
  return Buffer.concat([u32(data.length), typeBuf, data, u32(crc32(crcData))]);
}

function u32(n) {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n >>> 0);
  return b;
}

function crc32(buf) {
  let crc = ~0;
  for (const byte of buf) {
    crc ^= byte;
    for (let k = 0; k < 8; k += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return ~crc;
}
