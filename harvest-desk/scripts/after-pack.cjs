/**
 * electron-builder hook. The build runs with signAndEditExecutable: false because its
 * own resource editor needs symlink rights Windows does not give by default. So the icon
 * and the file details are written into the .exe here, with rcedit, before the installer is made.
 */
const { join } = require("node:path");

exports.default = async function afterPack(ctx) {
  if (ctx.electronPlatformName !== "win32") return;
  const mod = require("rcedit");
  const rcedit = mod.rcedit || mod.default || mod;
  const name = ctx.packager.appInfo.productFilename;
  const version = ctx.packager.appInfo.version;
  await rcedit(join(ctx.appOutDir, `${name}.exe`), {
    icon: join(ctx.packager.projectDir, "build", "icon.ico"),
    "file-version": version,
    "product-version": version,
    "version-string": { ProductName: "Harvest Desk", FileDescription: "Harvest Desk", CompanyName: "Wzx", OriginalFilename: `${name}.exe` },
  });
};
