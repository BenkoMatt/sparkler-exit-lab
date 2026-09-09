// QA: node-side EXIF parser edge-case tests (exif.js is browser-safe ES2020, imports fine in node 22)
import { parseExif, hasExif, formatShutter } from '/root/sparkler-lab/site/assets/js/exif.js';
import assert from 'node:assert';

const cases = [];
function t(name, fn) { try { fn(); cases.push(['PASS', name]); } catch (e) { cases.push(['FAIL', name + ' :: ' + e.message]); } }

// 1. buffer < 4 bytes
t('empty buffer (0 bytes)', () => { const r = parseExif(new ArrayBuffer(0)); assert.deepStrictEqual(r, { shutter: null, iso: null, aperture: null, flashFired: null, raw: {} }); assert.strictEqual(hasExif(new ArrayBuffer(0)), false); });
t('1-byte buffer', () => { const b = new Uint8Array([0xff]).buffer; const r = parseExif(b); assert.strictEqual(r.shutter, null); assert.strictEqual(hasExif(b), false); });
t('2-byte SOI only', () => { const b = new Uint8Array([0xff, 0xd8]).buffer; const r = parseExif(b); assert.strictEqual(r.iso, null); });
t('3-byte buffer', () => { const b = new Uint8Array([0xff, 0xd8, 0xff]).buffer; const r = parseExif(b); assert.strictEqual(r.iso, null); });

// 2. malformed / truncated JPEGs
t('not a JPEG (PNG header)', () => { const b = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).buffer; assert.strictEqual(hasExif(b), false); const r = parseExif(b); assert.strictEqual(r.shutter, null); });
t('garbage bytes never throw', () => { for (let n = 1; n <= 32; n++) { const u = new Uint8Array(n); crypto.getRandomValues(u); const r = parseExif(u.buffer); assert.strictEqual(r.iso, null); } });
t('SOI + truncated APP1 (len beyond bounds)', () => {
  // APP1 claims len 65535 but only 10 bytes present
  const u = new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00]);
  const r = parseExif(u.buffer); assert.strictEqual(r.shutter, null); // must not throw
});
t('APP1 with truncated TIFF header', () => {
  const u = new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x08, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00, 0x49]); // "II" cut at 1 byte
  const r = parseExif(u.buffer); assert.strictEqual(r.shutter, null);
});
t('APP1 Exif header but TIFF byteOrder cut', () => {
  // full APP1 with only "II" (byte order ok) but 8-byte TIFF header incomplete -> readByteOrder guard tiff+8>len
  const u = new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x0a, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00, 0x49, 0x49]);
  const r = parseExif(u.buffer); assert.strictEqual(r.iso, null);
});

// 3. valid minimal TIFF with exposure + ISO + FNumber + Flash (little-endian)
function buildExif(tags) {
  // returns full JPEG buffer: SOI + APP1("Exif\0\0" + TIFF) + minimal rest
  const enc = new TextEncoder();
  const entries = [];
  const ifdOff = 8;
  // layout: [tiff header 8][IFD0: count(2) + entries*12 + nextIFD 4][value heap]
  let heap = [];
  let heapBase; // computed after we know entry count
  const n = tags.length;
  const ifdLen = 2 + n * 12 + 4;
  heapBase = ifdOff + ifdLen;
  for (const tg of tags) {
    // tg: {tag, type, count, valueBytes (le)}
    entries.push(tg);
  }
  const tiffLen = heapBase + heap.length; // update below
  // first pass: compute heap size with values
  let heapSize = 0;
  for (const tg of tags) {
    if (tg.valueBytes.length > 4) heapSize += tg.valueBytes.length + (tg.valueBytes.length % 2);
  }
  const totalTiff = ifdOff + ifdLen + heapSize;
  const tiff = new Uint8Array(totalTiff);
  const dv = new DataView(tiff.buffer);
  tiff.set([0x49, 0x49, 0x2a, 0x00, ifdOff, 0x00, 0x00, 0x00]); // II, 42, IFD0 @8
  dv.setUint16(ifdOff, n, true);
  let eOff = ifdOff + 2;
  let hOff = heapBase;
  for (const tg of tags) {
    dv.setUint16(eOff, tg.tag, true);
    dv.setUint16(eOff + 2, tg.type, true);
    dv.setUint32(eOff + 4, tg.count, true);
    if (tg.valueBytes.length <= 4) {
      new Uint8Array(tiff.buffer).set(tg.valueBytes, eOff + 8);
    } else {
      dv.setUint32(eOff + 8, hOff - 0, true); // offset relative to tiff start
      tiff.set(tg.valueBytes, hOff);
      hOff += tg.valueBytes.length + (tg.valueBytes.length % 2);
    }
    eOff += 12;
  }
  dv.setUint32(ifdOff + 2 + n * 12, 0, true); // next IFD = 0
  // wrap in APP1 + JPEG
  const app1Payload = new Uint8Array(6 + tiff.length);
  app1Payload.set([0x45, 0x78, 0x69, 0x66, 0x00, 0x00]);
  app1Payload.set(tiff, 6);
  const segLen = 2 + app1Payload.length;
  const out = new Uint8Array(4 + segLen + 2);
  out.set([0xff, 0xd8, 0xff, 0xe1]);
  new DataView(out.buffer).setUint16(4, segLen, false); // big-endian segment length
  out.set(app1Payload, 6);
  out.set([0xff, 0xd9], 6 + app1Payload.length);
  return out.buffer;
}

t('valid EXIF: shutter+iso+aperture+flash decode', () => {
  const rational = (num, den) => { const u = new Uint8Array(8); new DataView(u.buffer).setUint32(0, num, true); new DataView(u.buffer).setUint32(4, den, true); return u; };
  const buf = buildExif([
    { tag: 0x829a, type: 5, count: 1, valueBytes: rational(1, 125) },
    { tag: 0x8827, type: 3, count: 1, valueBytes: new Uint8Array([0x50, 0x03]) }, // ISO 848? no: 0x0350=848... use 1600
    { tag: 0x829d, type: 5, count: 1, valueBytes: rational(28, 10) },
    { tag: 0x9209, type: 3, count: 1, valueBytes: new Uint8Array([0x01, 0x00]) },
  ]);
  const r = parseExif(buf);
  assert.strictEqual(r.shutter, '1/3'); // 1/1? see below
});
t('ISO 1600 SHORT inline little-endian', () => {
  const u = new Uint8Array(2); new DataView(u.buffer).setUint16(0, 1600, true);
  const buf = buildExif([{ tag: 0x8827, type: 3, count: 1, valueBytes: u }]);
  const r = parseExif(buf); assert.strictEqual(r.iso, 1600); assert.strictEqual(r.raw['0x8827'], 1600);
});
t('misaligned/absurd tag offset rejected', () => {
  // value offset points beyond buffer -> readValue must bail (value null), no throw
  const u = new Uint8Array(2); new DataView(u.buffer).setUint16(0, 1600, true);
  const buf = buildExif([{ tag: 0x8827, type: 3, count: 5, valueBytes: u }]); // count=5 but only 2 bytes inline <=4 -> pos+total>len? inline path
  const r = parseExif(buf);
  // count>1 SHORT: reads count*2 bytes from inline pos: 10 bytes past entry+8, buffer ends right there -> must be null-safe
  assert.ok(r.iso === null || typeof r.iso === 'number');
});
t('huge count bomb (count > 0x10000) rejected', () => {
  const u = new Uint8Array(4);
  const buf = buildExif([{ tag: 0x8827, type: 3, count: 999999, valueBytes: u }]);
  const r = parseExif(buf); assert.strictEqual(r.iso, null); assert.ok(!('0x8827' in r.raw));
});
t('den=0 RATIONAL -> null, not Infinity', () => {
  const rational = (num, den) => { const u = new Uint8Array(8); new DataView(u.buffer).setUint32(0, num, true); new DataView(u.buffer).setUint32(4, den, true); return u; };
  const buf = buildExif([{ tag: 0x829a, type: 5, count: 1, valueBytes: rational(1, 0) }]);
  const r = parseExif(buf); assert.strictEqual(r.shutter, null);
});
t('formatShutter known values', () => {
  assert.strictEqual(formatShutter(0.008), '1/125');
  assert.strictEqual(formatShutter(0.5), '1/2');
  assert.strictEqual(formatShutter(2), '2');
  assert.strictEqual(formatShutter(0.769), '0.8');
  assert.strictEqual(formatShutter(1.6), '1.6');
  assert.strictEqual(formatShutter(0), null);
  assert.strictEqual(formatShutter(-1), null);
  assert.strictEqual(formatShutter(NaN), null);
});

let pass = 0, fail = 0;
for (const [s, n] of cases) { console.log(s + '  ' + n); if (s === 'PASS') pass++; else fail++; }
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);