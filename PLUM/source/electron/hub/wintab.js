// Native tablet pressure through Wintab (wintab32.dll), so Wacom / Huion / XP-Pen pens
// report pressure and tilt on Windows even when Windows Ink is turned off in the driver.
// Runs in the Electron main process and calls the driver with koffi (Node-API FFI).
// Every failure is reported as { ok:false, reason } and the app keeps working with
// plain Pointer Events.
'use strict';

// ---- Constants: Wacom SDK wintab.h / pktdef.h (2010). Struct sizes and every field offset
// below are checked against gcc's layout of those headers by test/layout-check.js. ----
const WTI_DEFSYSCTX = 4;
const WTI_DEVICES = 100;
const DVC_NAME = 1;
const DVC_NPRESSURE = 15;         // AXIS
const DVC_ORIENTATION = 17;       // AXIS[3]: azimuth, altitude, twist
const CXO_SYSTEM = 0x0001;
const CXO_MESSAGES = 0x0004;
const PK_STATUS = 0x0002, PK_TIME = 0x0004, PK_CURSOR = 0x0020, PK_BUTTONS = 0x0040;
const PK_X = 0x0080, PK_Y = 0x0100, PK_NORMAL_PRESSURE = 0x0400, PK_ORIENTATION = 0x1000;
const TPS_PROXIMITY = 0x0001;     // "cursor is out of the context"
const TPS_INVERT = 0x0010;        // eraser end (Wintab 1.1)
const TU_CIRCLE = 3;
const WT_DEFBASE = 0x7FF0;
const WT_PACKET = WT_DEFBASE + 0; // wParam = serial, lParam = HCTX
const WT_PROXIMITY = WT_DEFBASE + 5; // LOWORD(lParam) != 0 entering context, 0 leaving
const LCNAMELEN = 40;

const PKT_FULL = PK_STATUS | PK_TIME | PK_CURSOR | PK_BUTTONS | PK_X | PK_Y | PK_NORMAL_PRESSURE | PK_ORIENTATION;
const PKT_NO_TILT = PKT_FULL & ~PK_ORIENTATION;
const QUEUE = 128;
const POLL_MS = 4;

let T = null; // koffi types, defined once (koffi type names are global)
function types(koffi) {
  if (T) return T;
  // wintab.h: typedef struct tagAXIS { LONG axMin; LONG axMax; UINT axUnits; FIX32 axResolution; } -- 16 bytes
  const AXIS = koffi.struct('NOTELY_WT_AXIS', { axMin: 'int32', axMax: 'int32', axUnits: 'uint32', axResolution: 'uint32' });
  // wintab.h: typedef struct tagORIENTATION { int orAzimuth; int orAltitude; int orTwist; } -- 12 bytes
  const ORIENTATION = koffi.struct('NOTELY_WT_ORIENTATION', { orAzimuth: 'int32', orAltitude: 'int32', orTwist: 'int32' });
  // wintab.h: typedef struct tagLOGCONTEXTA (ANSI). WTPKT, FIX32, DWORD, UINT = 32-bit unsigned;
  // LONG, BOOL, int = 32-bit signed on Win64 too. 40 + 33 * 4 = 172 bytes, no padding.
  const LOGCONTEXTA = koffi.struct('NOTELY_WT_LOGCONTEXTA', {
    lcName: koffi.array('char', LCNAMELEN),
    lcOptions: 'uint32', lcStatus: 'uint32', lcLocks: 'uint32', lcMsgBase: 'uint32', lcDevice: 'uint32', lcPktRate: 'uint32',
    lcPktData: 'uint32', lcPktMode: 'uint32', lcMoveMask: 'uint32', lcBtnDnMask: 'uint32', lcBtnUpMask: 'uint32',
    lcInOrgX: 'int32', lcInOrgY: 'int32', lcInOrgZ: 'int32', lcInExtX: 'int32', lcInExtY: 'int32', lcInExtZ: 'int32',
    lcOutOrgX: 'int32', lcOutOrgY: 'int32', lcOutOrgZ: 'int32', lcOutExtX: 'int32', lcOutExtY: 'int32', lcOutExtZ: 'int32',
    lcSensX: 'uint32', lcSensY: 'uint32', lcSensZ: 'uint32', lcSysMode: 'int32',
    lcSysOrgX: 'int32', lcSysOrgY: 'int32', lcSysExtX: 'int32', lcSysExtY: 'int32', lcSysSensX: 'uint32', lcSysSensY: 'uint32'
  });
  // pktdef.h: fields appear in PK_* bit order; with lcPktMode = 0 (all absolute)
  // pkNormalPressure is UINT. PKT_FULL gives 7 * 4 + 12 = 40 bytes.
  const PACKET = koffi.struct('NOTELY_WT_PACKET', {
    pkStatus: 'uint32', pkTime: 'uint32', pkCursor: 'uint32', pkButtons: 'uint32',
    pkX: 'int32', pkY: 'int32', pkNormalPressure: 'uint32', pkOrientation: ORIENTATION
  });
  const PACKET_NO_TILT = koffi.struct('NOTELY_WT_PACKET_NOTILT', {
    pkStatus: 'uint32', pkTime: 'uint32', pkCursor: 'uint32', pkButtons: 'uint32',
    pkX: 'int32', pkY: 'int32', pkNormalPressure: 'uint32'
  });
  const expect = [[AXIS, 16, 'AXIS'], [ORIENTATION, 12, 'ORIENTATION'], [LOGCONTEXTA, 172, 'LOGCONTEXTA'], [PACKET, 40, 'PACKET'], [PACKET_NO_TILT, 28, 'PACKET_NO_TILT']];
  for (const [t, n, name] of expect) if (koffi.sizeof(t) !== n) throw new Error(`${name} is ${koffi.sizeof(t)} bytes, expected ${n}`);
  T = { AXIS, ORIENTATION, LOGCONTEXTA, PACKET, PACKET_NO_TILT };
  return T;
}

function off(koffi, t, f) { return koffi.offsetof(t, f); }

function bind(koffi, file) {
  const lib = koffi.load(file);
  // wintab.h prototypes; API = WINAPI (__stdcall, ignored on x64). HWND/HCTX are pointers.
  return {
    WTInfoA: lib.func('__stdcall', 'WTInfoA', 'uint32', ['uint32', 'uint32', 'void *']),
    WTOpenA: lib.func('__stdcall', 'WTOpenA', 'void *', ['intptr_t', 'void *', 'int32']),
    WTClose: lib.func('__stdcall', 'WTClose', 'int32', ['void *']),
    WTPacketsGet: lib.func('__stdcall', 'WTPacketsGet', 'int32', ['void *', 'int32', 'void *']),
    WTQueueSizeSet: lib.func('__stdcall', 'WTQueueSizeSet', 'int32', ['void *', 'int32']),
    WTEnable: lib.func('__stdcall', 'WTEnable', 'int32', ['void *', 'int32']),
    WTOverlap: lib.func('__stdcall', 'WTOverlap', 'int32', ['void *', 'int32'])
  };
}

function readAxis(koffi, wt, cat, idx, count) {
  const size = koffi.sizeof(T.AXIS) * count;
  const buf = Buffer.alloc(size);
  const n = wt.WTInfoA(cat, idx, buf);
  if (n < size) return null;
  const out = [];
  for (let i = 0; i < count; i++) out.push(koffi.decode(buf.subarray(i * koffi.sizeof(T.AXIS)), T.AXIS));
  return out;
}

function readString(wt, cat, idx) {
  const n = wt.WTInfoA(cat, idx, null);
  if (!n || n > 4096) return '';
  const buf = Buffer.alloc(n + 1);
  wt.WTInfoA(cat, idx, buf);
  const end = buf.indexOf(0);
  return buf.toString('latin1', 0, end < 0 ? n : end).trim();
}

// Degrees per raw orientation unit. Wacom: TU_CIRCLE with FIX32 3600 per turn (tenths of a degree).
function degPerUnit(axis, fullScaleDeg) {
  if (!axis) return 0.1;
  if (axis.axUnits === TU_CIRCLE && axis.axResolution > 0) return 360 / (axis.axResolution / 65536);
  if (axis.axMax > 0) return fullScaleDeg / axis.axMax;
  return 0.1;
}

function hwndOf(win) {
  const b = win.getNativeWindowHandle();
  return b.length >= 8 ? b.readBigInt64LE(0) : BigInt(b.readInt32LE(0));
}

const idle = reason => ({ info: () => ({ ok: false, reason }), close() {} });

/**
 * Opens a Wintab context on `win` and streams pen samples to its renderer as
 * webContents.send('pen', rows), rows = [[pressure 0..1, tilt deg, azimuth deg,
 * eraser 0|1, down 0|1, inProximity 0|1, pkTime ms], ...].
 * Never throws; returns { info(), close() }.
 */
function attach(win, opts = {}) {
  const libPath = opts.libPath || process.env.NOTELY_WINTAB_LIB || (process.platform === 'win32' ? 'wintab32.dll' : null);
  if (!libPath) return idle('Wintab is only available on Windows');
  try {
    return open(win, libPath);
  } catch (err) {
    return idle(String((err && err.message) || err));
  }
}

function open(win, libPath) {
  let koffi;
  try { koffi = require('koffi'); } catch (err) { return idle('koffi failed to load: ' + err.message); }
  types(koffi);
  let wt;
  try { wt = bind(koffi, libPath); } catch (err) { return idle(`cannot load ${libPath}: ${err.message}`); }
  if (!wt.WTInfoA(0, 0, null)) return idle('Wintab driver not available (no tablet service running)');

  // Default system context: the driver's own mapping of tablet -> screen.
  const lcSize = koffi.sizeof(T.LOGCONTEXTA);
  const lc = Buffer.alloc(lcSize);
  if (wt.WTInfoA(WTI_DEFSYSCTX, 0, lc) < lcSize) return idle('WTInfoA(WTI_DEFSYSCTX) failed');
  const L = f => off(koffi, T.LOGCONTEXTA, f);
  const device = lc.readUInt32LE(L('lcDevice'));
  const devCat = WTI_DEVICES + device;

  const name = readString(wt, devCat, DVC_NAME);
  const np = readAxis(koffi, wt, devCat, DVC_NPRESSURE, 1);
  const pMin = np ? np[0].axMin : 0;
  const pMax = np && np[0].axMax > np[0].axMin ? np[0].axMax : 1023;
  const pRange = pMax - pMin;
  const orient = readAxis(koffi, wt, devCat, DVC_ORIENTATION, 3);
  const tiltAxes = orient && orient[1].axMax > 0 ? orient : null;
  const azScale = tiltAxes ? degPerUnit(tiltAxes[0], 360) : 0;
  const altScale = tiltAxes ? degPerUnit(tiltAxes[1], 90) : 0;

  lc.fill(0, 0, LCNAMELEN);
  lc.write('PLUM', 0, LCNAMELEN - 1, 'latin1');
  lc.writeUInt32LE((lc.readUInt32LE(L('lcOptions')) | CXO_SYSTEM | CXO_MESSAGES) >>> 0, L('lcOptions'));
  lc.writeUInt32LE(WT_DEFBASE, L('lcMsgBase'));
  lc.writeUInt32LE(0, L('lcPktMode'));

  const hwnd = hwndOf(win);
  let ctx = null, mask = 0;
  for (const m of tiltAxes ? [PKT_FULL, PKT_NO_TILT] : [PKT_NO_TILT]) {
    lc.writeUInt32LE(m, L('lcPktData'));
    lc.writeUInt32LE(m, L('lcMoveMask'));
    ctx = wt.WTOpenA(hwnd, lc, 1);
    if (ctx) { mask = m; break; }
  }
  if (!ctx) return idle('WTOpenA failed');
  // wintab.h docs: a failed WTQueueSizeSet leaves the context with NO queue, so step down until one sticks.
  let queue = 0;
  for (let q = QUEUE; q >= 8 && !queue; q >>= 1) if (wt.WTQueueSizeSet(ctx, q)) queue = q;
  if (!queue) { wt.WTClose(ctx); return idle('WTQueueSizeSet failed'); }

  const hasTilt = mask === PKT_FULL;
  const P = hasTilt ? T.PACKET : T.PACKET_NO_TILT;
  const size = koffi.sizeof(P);
  const O = {
    status: off(koffi, P, 'pkStatus'), time: off(koffi, P, 'pkTime'), cursor: off(koffi, P, 'pkCursor'),
    buttons: off(koffi, P, 'pkButtons'), pressure: off(koffi, P, 'pkNormalPressure'),
    az: hasTilt ? off(koffi, P, 'pkOrientation') + off(koffi, T.ORIENTATION, 'orAzimuth') : 0,
    alt: hasTilt ? off(koffi, P, 'pkOrientation') + off(koffi, T.ORIENTATION, 'orAltitude') : 0
  };
  const pkts = Buffer.alloc(QUEUE * size);
  const r1 = x => Math.round(x * 10) / 10;
  let last = null;

  function row(o) {
    const status = pkts.readUInt32LE(o + O.status);
    const raw = pkts.readUInt32LE(o + O.pressure);
    const buttons = pkts.readUInt32LE(o + O.buttons);
    const cursor = pkts.readUInt32LE(o + O.cursor);
    const pressure = Math.min(1, Math.max(0, (raw - pMin) / pRange));
    let tilt = 0, azimuth = 0;
    if (hasTilt) {
      // Altitude is 90 deg (900) when the pen is upright; negative for the eraser end.
      tilt = Math.min(90, Math.max(0, 90 - Math.abs(pkts.readInt32LE(o + O.alt)) * altScale));
      azimuth = ((pkts.readInt32LE(o + O.az) * azScale) % 360 + 360) % 360;
    }
    const eraser = cursor % 3 === 2 || (status & TPS_INVERT) ? 1 : 0;
    const down = (buttons & 1) || pressure > 0 ? 1 : 0;
    const inProx = status & TPS_PROXIMITY ? 0 : 1;
    return [pressure, r1(tilt), r1(azimuth), eraser, down, inProx, pkts.readUInt32LE(o + O.time)];
  }

  function send(rows) {
    last = rows[rows.length - 1];
    if (!win.isDestroyed() && !win.webContents.isDestroyed()) win.webContents.send('pen', rows);
  }

  let errors = 0;
  function drain() {
    if (!ctx) return 0;
    let rows = null;
    try {
      for (let guard = 0; guard < 32; guard++) {
        const n = wt.WTPacketsGet(ctx, QUEUE, pkts);
        if (n <= 0) break;
        rows = rows || [];
        for (let i = 0; i < n; i++) rows.push(row(i * size));
        if (n < QUEUE) break;
      }
    } catch (err) {
      if (++errors === 1) console.error('[wintab] WTPacketsGet failed:', err);
      if (errors > 20) close();
    }
    if (rows) send(rows);
    return rows ? rows.length : 0;
  }

  function raise() {
    if (!ctx) return;
    try { wt.WTEnable(ctx, 1); wt.WTOverlap(ctx, 1); } catch (err) {}
  }

  // Delivery: WT_PACKET messages on Windows, a 4 ms poll elsewhere (tests) or if
  // the messages never show up (watchdog).
  let mode = 'polling', poll = null, watchdog = null, hooked = [], hookHits = 0;
  const startPolling = () => { if (!poll) poll = setInterval(drain, POLL_MS); mode = 'polling'; };
  if (process.platform === 'win32' && typeof win.hookWindowMessage === 'function') {
    mode = 'messages';
    win.hookWindowMessage(WT_PACKET, () => { hookHits++; drain(); });
    win.hookWindowMessage(WT_PROXIMITY, (wParam, lParam) => {
      if (lParam.readUInt16LE(0) !== 0) return; // entering
      drain();
      if (last && last[5]) send([[0, 0, 0, last[3], 0, 0, last[6]]]);
    });
    hooked = [WT_PACKET, WT_PROXIMITY];
    let misses = 0;
    watchdog = setInterval(() => {
      if (hookHits) { clearInterval(watchdog); watchdog = null; return; }
      if (drain() > 0 && ++misses >= 2) {
        clearInterval(watchdog); watchdog = null;
        console.warn('[wintab] no WT_PACKET messages received, polling instead');
        startPolling();
      }
    }, 250);
  } else {
    startPolling();
  }

  raise();
  win.on('focus', raise);

  function close() {
    if (!ctx) return;
    const c = ctx; ctx = null;
    clearInterval(poll); clearInterval(watchdog); poll = watchdog = null;
    if (!win.isDestroyed()) {
      win.removeListener('focus', raise);
      for (const m of hooked) try { win.unhookWindowMessage(m); } catch (err) {}
    }
    try { wt.WTClose(c); } catch (err) {}
  }
  win.once('closed', close);

  const info = { ok: true, device: name || 'Wintab tablet', pressureLevels: pRange + 1, tilt: hasTilt, mode };
  return { info: () => (ctx ? { ...info, mode } : { ok: false, reason: 'Wintab context closed' }), close };
}

module.exports = { attach, _types: types, _constants: { PKT_FULL, PKT_NO_TILT, WT_PACKET, WT_PROXIMITY } };
