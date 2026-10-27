// Puts the Plum icon and name into the Electron exe: node brand-exe.js <in.exe> <out.exe>
// Needs `npm i resedit pe-library` next to it (or anywhere on NODE_PATH). The icon comes from plum.ico (made from plum-icon-1024.png, the feather logo).
const ResEdit = require('resedit'), PE = require('pe-library'), fs = require('fs'), path = require('path');
const [src, dst] = process.argv.slice(2);
const exe = PE.NtExecutable.from(fs.readFileSync(src), { ignoreCert: true });
const res = PE.NtExecutableResource.from(exe);
const ico = ResEdit.Data.IconFile.from(fs.readFileSync(path.join(__dirname, 'plum.ico')));
for (const g of ResEdit.Resource.IconGroupEntry.fromEntries(res.entries)) ResEdit.Resource.IconGroupEntry.replaceIconsForResource(res.entries, g.id, g.lang, ico.icons.map(i => i.data));
for (const v of ResEdit.Resource.VersionInfo.fromEntries(res.entries)) {
  const lang = v.getAllLanguagesForStringValues()[0];
  v.setStringValues(lang, { FileDescription: 'PLUM', ProductName: 'PLUM', InternalName: 'PLUM', OriginalFilename: 'PLUM.exe', CompanyName: 'PLUM' });
  v.outputToResourceEntries(res.entries);
}
res.outputResource(exe);
fs.writeFileSync(dst, Buffer.from(exe.generate()));
