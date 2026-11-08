// Minimal dependency-free PNG decode/encode (8-bit RGB/RGBA, non-interlaced) for review images.
import zlib from "node:zlib";

const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** → { width, height, data: Uint8Array RGB } */
export function decodePNG(buf) {
  let p = 8, width = 0, height = 0, ct = 0, depth = 0;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString("ascii", p + 4, p + 8);
    const d = buf.subarray(p + 8, p + 8 + len);
    if (type === "IHDR") {
      width = d.readUInt32BE(0);
      height = d.readUInt32BE(4);
      depth = d[8];
      ct = d[9];
      if (d[12] !== 0) throw new Error("interlaced PNG not supported");
    } else if (type === "IDAT") idat.push(d);
    else if (type === "IEND") break;
    p += 12 + len;
  }
  if (depth !== 8 || (ct !== 2 && ct !== 6)) throw new Error(`unsupported PNG (depth ${depth}, colour type ${ct})`);
  const bpp = ct === 6 ? 4 : 3;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * bpp;
  const out = new Uint8Array(width * height * 3);
  let prev = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const cur = new Uint8Array(stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
      let v = line[i];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      cur[i] = v & 255;
    }
    for (let x = 0; x < width; x++) {
      out[(y * width + x) * 3] = cur[x * bpp];
      out[(y * width + x) * 3 + 1] = cur[x * bpp + 1];
      out[(y * width + x) * 3 + 2] = cur[x * bpp + 2];
    }
    prev = cur;
  }
  return { width, height, data: out };
}

export function encodePNG({ width, height, data }) {
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) Buffer.from(data.buffer, data.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  const chunk = (type, d) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(d.length);
    const td = Buffer.concat([Buffer.from(type, "ascii"), d]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw, { level: 6 })), chunk("IEND", Buffer.alloc(0))]);
}

/** Box-filter downscale to a target height. */
export function resize(img, H) {
  const s = img.height / H;
  const W = Math.round(img.width / s);
  const out = new Uint8Array(W * H * 3);
  for (let y = 0; y < H; y++) {
    const y0 = Math.floor(y * s), y1 = Math.max(y0 + 1, Math.floor((y + 1) * s));
    for (let x = 0; x < W; x++) {
      const x0 = Math.floor(x * s), x1 = Math.max(x0 + 1, Math.floor((x + 1) * s));
      let r = 0, g = 0, b = 0, n = 0;
      for (let yy = y0; yy < y1; yy++)
        for (let xx = x0; xx < x1; xx++) {
          const i = (yy * img.width + xx) * 3;
          r += img.data[i]; g += img.data[i + 1]; b += img.data[i + 2]; n++;
        }
      const o = (y * W + x) * 3;
      out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n;
    }
  }
  return { width: W, height: H, data: out };
}
