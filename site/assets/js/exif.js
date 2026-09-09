/*! exif.js — Sparkler Exit Lab minimal EXIF reader (P2 engine wave, app child)
 *  Plain ES2020 module. No deps, no build step, no fetches.
 *
 *  - export parseExif(arrayBuffer) -> { shutter, iso, aperture, flashFired, raw }
 *      shutter:    '1/125' style (or plain seconds string) | null
 *      iso:        number | null
 *      aperture:   'f/2.8' | null
 *      flashFired: boolean | null
 *      raw:        flat map of every decoded tag, keyed '0x829A' etc
 *  - export hasExif(arrayBuffer) -> boolean
 *  - JPEG only (APP1 "Exif\0\0" TIFF). PNG/WebP/HEIC/malformed -> nulls, never throws.
 */

const TAG_EXPOSURE_TIME = 0x829a;
const TAG_ISO = 0x8827;
const TAG_FNUMBER = 0x829d;
const TAG_FLASH = 0x9209;
const TAG_EXIF_IFD_POINTER = 0x8769;

// TIFF field types: 0 n/a, 1 BYTE, 2 ASCII, 3 SHORT, 4 LONG, 5 RATIONAL,
// 6 SBYTE, 7 UNDEFINED, 8 SSHORT, 9 SLONG, 10 SRATIONAL
const TYPE_SIZES = [0, 1, 1, 2, 4, 8, 1, 1, 2, 4, 8];

function makeResult() {
  return { shutter: null, iso: null, aperture: null, flashFired: null, raw: {} };
}

function gcd(a, b) {
  return b === 0 ? a : gcd(b, a % b);
}

/* ---------- public: hasExif ---------- */

export function hasExif(arrayBuffer) {
  try {
    const view = new DataView(arrayBuffer);
    return findTiffOffset(view) >= 0;
  } catch (e) {
    return false;
  }
}

/* ---------- public: parseExif ---------- */

export function parseExif(arrayBuffer) {
  const result = makeResult();
  try {
    const view = new DataView(arrayBuffer);
    const tiff = findTiffOffset(view);
    if (tiff < 0) return result; // PNG / WebP / HEIC / not JPEG: graceful nulls

    const little = readByteOrder(view, tiff);
    if (little === null) return result;

    const tags = { ifd0: {}, exifIfd: {} };
    readIfd(view, tiff, readU32(view, tiff + 4, little), little, tags.ifd0, 0);

    const exifPtr = tags.ifd0['0x' + TAG_EXIF_IFD_POINTER.toString(16).toUpperCase()];
    if (typeof exifPtr === 'number' && exifPtr > 0) {
      readIfd(view, tiff, exifPtr, little, tags.exifIfd, 1);
    }

    // flatten into raw (hex-keyed), Exif IFD wins on collision
    for (const key of Object.keys(tags.ifd0)) result.raw[key] = tags.ifd0[key];
    for (const key of Object.keys(tags.exifIfd)) result.raw[key] = tags.exifIfd[key];

    const exposure = result.raw['0x' + TAG_EXPOSURE_TIME.toString(16).toUpperCase()];
    const iso = result.raw['0x' + TAG_ISO.toString(16).toUpperCase()];
    const fnumber = result.raw['0x' + TAG_FNUMBER.toString(16).toUpperCase()];
    const flash = result.raw['0x' + TAG_FLASH.toString(16).toUpperCase()];

    result.shutter = formatShutter(exposure);
    result.iso = (typeof iso === 'number' && isFinite(iso) && iso > 0) ? Math.round(iso) : null;
    result.aperture = (typeof fnumber === 'number' && isFinite(fnumber) && fnumber > 0)
      ? formatAperture(fnumber)
      : null;
    result.flashFired = (typeof flash === 'number') ? ((flash & 1) === 1) : null;
  } catch (e) {
    // malformed EXIF must never throw out of the parser
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('[exif] unreadable EXIF payload:', e && e.message ? e.message : e);
    }
  }
  return result;
}

/* ---------- JPEG structure scan ---------- */

// Walk JPEG markers from SOI to SOS/EOI; return absolute offset of the
// "Exif\0\0"-prefixed APP1 payload's TIFF header, or -1.
function findTiffOffset(view) {
  if (view.byteLength < 4) return -1;
  if (view.getUint16(0) !== 0xffd8) return -1; // not a JPEG (PNG/WebP land here)
  let off = 2;
  while (off + 4 <= view.byteLength) {
    if (view.getUint8(off) !== 0xff) return -1; // marker desync
    let marker = view.getUint8(off + 1);
    let i = off + 2;
    while (i < view.byteLength && marker === 0xff) { // fill bytes
      marker = view.getUint8(i);
      i += 1;
    }
    if (marker === 0xd8) { off = i; continue; }            // embedded SOI: keep scanning
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { off = i; continue; } // no length
    if (marker === 0xd9 || marker === 0xda) return -1;     // EOI / start of scan: too late
    if (i + 2 > view.byteLength) return -1;
    const segLen = view.getUint16(i); // JPEG lengths are always big-endian
    if (segLen < 2 || i + segLen > view.byteLength) return -1;
    const payload = i + 2;
    if (marker >= 0xe0 && marker <= 0xef) { // APPn
      if (segLen >= 8 && isExifHeader(view, payload)) return payload + 6;
    }
    off = i + segLen;
  }
  return -1;
}

function isExifHeader(view, pos) {
  return view.getUint8(pos) === 0x45 && view.getUint8(pos + 1) === 0x78 && // "Ex"
    view.getUint8(pos + 2) === 0x69 && view.getUint8(pos + 3) === 0x66 && // "if"
    view.getUint8(pos + 4) === 0x00 && view.getUint8(pos + 5) === 0x00;
}

/* ---------- TIFF / IFD ---------- */

// 'II' -> little-endian, 'MM' -> big-endian, else null
function readByteOrder(view, tiff) {
  if (tiff + 8 > view.byteLength) return null;
  const b0 = view.getUint8(tiff);
  const b1 = view.getUint8(tiff + 1);
  if (b0 === 0x49 && b1 === 0x49) return true;
  if (b0 === 0x4d && b1 === 0x4d) return false;
  return null;
}

function readU16(view, pos, little) {
  if (pos < 0 || pos + 2 > view.byteLength) return null;
  return view.getUint16(pos, little);
}

function readU32(view, pos, little) {
  if (pos < 0 || pos + 4 > view.byteLength) return null;
  return view.getUint32(pos, little);
}

function readIfd(view, tiff, ifdOffset, little, into, depth) {
  if (depth > 2 || ifdOffset === null || ifdOffset <= 0) return;
  const base = tiff + ifdOffset;
  const count = readU16(view, base, little);
  if (count === null || count === 0 || count > 0x1000) return;
  for (let i = 0; i < count; i++) {
    const entry = base + 2 + i * 12;
    if (entry + 12 > view.byteLength) return;
    const tag = view.getUint16(entry, little);
    const type = view.getUint16(entry + 2, little);
    const count2 = view.getUint32(entry + 4, little);
    const value = readValue(view, tiff, entry + 8, type, count2, little);
    if (value !== null) into['0x' + tag.toString(16).toUpperCase()] = value;
  }
}

function readValue(view, tiff, valueFieldPos, type, count, little) {
  const size = TYPE_SIZES[type] || 0;
  if (size === 0 || count <= 0 || count > 0x10000) return null;
  const total = size * count;
  let pos;
  if (total <= 4) {
    pos = valueFieldPos; // value stored inline in the 4-byte field
  } else {
    const offset = readU32(view, valueFieldPos, little);
    if (offset === null) return null;
    pos = tiff + offset;
  }
  if (pos < 0 || pos + total > view.byteLength) return null;

  switch (type) {
    case 1: // BYTE
    case 7: // UNDEFINED (treated as bytes)
      return count === 1 ? view.getUint8(pos) : readBytes(view, pos, count);
    case 2: { // ASCII
      const chars = [];
      for (let i = 0; i < count; i++) {
        const c = view.getUint8(pos + i);
        if (c === 0) break;
        chars.push(c);
      }
      return chars.length ? String.fromCharCode.apply(null, chars) : null;
    }
    case 3: { // SHORT
      if (count === 1) return view.getUint16(pos, little);
      const out = [];
      for (let i = 0; i < count; i++) out.push(view.getUint16(pos + i * 2, little));
      return out;
    }
    case 4: { // LONG
      if (count === 1) return view.getUint32(pos, little);
      const out = [];
      for (let i = 0; i < count; i++) out.push(view.getUint32(pos + i * 4, little));
      return out;
    }
    case 5: // RATIONAL
    case 10: { // SRATIONAL
      const vals = [];
      const stride = 8;
      for (let i = 0; i < count; i++) {
        const num = type === 5
          ? view.getUint32(pos + i * stride, little)
          : view.getInt32(pos + i * stride, little);
        const den = type === 5
          ? view.getUint32(pos + i * stride + 4, little)
          : view.getInt32(pos + i * stride + 4, little);
        vals.push(den !== 0 ? num / den : null);
      }
      if (count === 1) return vals[0];
      return vals;
    }
    case 6: // SBYTE
    case 8: // SSHORT
    case 9: // SLONG
    default:
      return null;
  }
}

function readBytes(view, pos, count) {
  const out = new Array(Math.min(count, 64));
  for (let i = 0; i < out.length; i++) out[i] = view.getUint8(pos + i);
  return out;
}

/* ---------- display formatting ---------- */

// 0.008 -> '1/125', 0.5 -> '1/2', 2 -> '2', 1.6 -> '1.6', 0.769 -> '0.8'
export function formatShutter(seconds) {
  if (typeof seconds !== 'number' || !isFinite(seconds) || seconds <= 0) return null;
  if (seconds < 1) {
    const den = Math.round(1 / seconds);
    if (den >= 2 && Math.abs(seconds - 1 / den) / seconds <= 0.02) {
      const num = Math.round(seconds * den);
      const g = gcd(num, den);
      const rn = Math.round(num / g);
      const rd = Math.round(den / g);
      return rn === 1 ? '1/' + rd : rn + '/' + rd;
    }
    // no clean reciprocal (e.g. 0.769 s): show decimal seconds like a camera would
    const rounded = Math.round(seconds * 10) / 10;
    return String(rounded);
  }
  if (Math.abs(seconds - Math.round(seconds)) < 0.001) return String(Math.round(seconds));
  return seconds.toFixed(1);
}

// 2.8 -> 'f/2.8', 8 -> 'f/8'
export function formatAperture(fnumber) {
  if (typeof fnumber !== 'number' || !isFinite(fnumber) || fnumber <= 0) return null;
  const s = fnumber.toFixed(1);
  return 'f/' + (s.endsWith('.0') ? s.slice(0, -2) : s);
}