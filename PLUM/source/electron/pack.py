import struct, json, hashlib, zipfile, sys, os
base = os.path.dirname(os.path.abspath(__file__))
orig = open(os.path.join(base, 'app.asar'), 'rb').read()
hs = struct.unpack('<I', orig[4:8])[0]; jl = struct.unpack('<I', orig[12:16])[0]
H = json.loads(orig[16:16 + jl]); data0 = 8 + hs
repl = {p: open(os.path.join(base, 'hub', p), 'rb').read() for p in ['app/index.html', 'main.js', 'preload.js', 'package.json', 'wintab.js']}
def integ(b):
    bs = 4 * 1024 * 1024
    return {'algorithm': 'SHA256', 'hash': hashlib.sha256(b).hexdigest(), 'blockSize': bs, 'blocks': [hashlib.sha256(b[i:i + bs]).hexdigest() for i in range(0, max(len(b), 1), bs)]}
chunks = []; off = 0
def walk(t, p=''):
    global off
    for k, v in t['files'].items():
        if 'files' in v: walk(v, p + k + '/'); continue
        if v.get('unpacked'): continue
        path = p + k
        b = repl[path] if path in repl else orig[data0 + int(v['offset']): data0 + int(v['offset']) + v['size']]
        v['size'] = len(b); v['offset'] = str(off); v['integrity'] = integ(b); chunks.append(b); off += len(b)
walk(H)
js = json.dumps(H, separators=(',', ':')).encode()
pad = (4 - len(js) % 4) % 4
hp = struct.pack('<I', 4 + len(js) + pad) + struct.pack('<I', len(js)) + js + b'\0' * pad
asar = struct.pack('<I', 4) + struct.pack('<I', len(hp)) + hp + b''.join(chunks)
open(os.path.join(base, 'hub-app.asar'), 'wb').write(asar)
# verify by re-reading
hs2 = struct.unpack('<I', asar[4:8])[0]; jl2 = struct.unpack('<I', asar[12:16])[0]; H2 = json.loads(asar[16:16 + jl2]); d2 = 8 + hs2
f = H2['files']['app']['files']['index.html']; assert asar[d2 + int(f['offset']): d2 + int(f['offset']) + f['size']] == repl['app/index.html']
f = H2['files']['package.json']; print(asar[d2 + int(f['offset']): d2 + int(f['offset']) + f['size']].decode()[:120])
src = sys.argv[1]; dst = sys.argv[2]
with zipfile.ZipFile(src) as zi, zipfile.ZipFile(dst + '.tmp', 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as zo:
    for info in zi.infolist():
        name = info.filename
        if name == 'resources/app.asar': zo.writestr('resources/app.asar', asar); continue
        if name == 'Notely Sketch.exe': name = 'PLUM.exe'
        if name == 'PLUM.exe' and os.path.exists(os.path.join(base, 'PLUM.exe')):  # branded by brand/brand-exe.js
            zinfo = zipfile.ZipInfo(name, date_time=info.date_time); zinfo.compress_type = zipfile.ZIP_DEFLATED; zinfo.external_attr = info.external_attr
            with open(os.path.join(base, 'PLUM.exe'), 'rb') as fi, zo.open(zinfo, 'w') as fo:
                while True:
                    c = fi.read(1 << 20)
                    if not c: break
                    fo.write(c)
            continue
        if name.endswith('/'): zo.writestr(name, b''); continue
        zinfo = zipfile.ZipInfo(name, date_time=info.date_time); zinfo.compress_type = zipfile.ZIP_DEFLATED; zinfo.external_attr = info.external_attr
        with zi.open(info) as fi, zo.open(zinfo, 'w') as fo:
            while True:
                c = fi.read(1 << 20)
                if not c: break
                fo.write(c)
os.replace(dst + '.tmp', dst)
print('zip', os.path.getsize(dst) // (1 << 20), 'MB')
