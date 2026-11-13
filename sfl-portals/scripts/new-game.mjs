// Crée un nouveau Portal à partir de games/template.
// Usage : npm run new -- mon-portal
import { cpSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const name = process.argv[2];

if (!name || !/^[a-z0-9][a-z0-9-]*$/.test(name)) {
  console.error("Donne un nom en minuscules avec des tirets, ex. : npm run new -- village-builder");
  process.exit(1);
}
const dest = join(root, "games", name);
if (existsSync(dest)) {
  console.error(`games/${name} existe déjà.`);
  process.exit(1);
}

cpSync(join(root, "games", "template"), dest, {
  recursive: true,
  filter: (src) => !/node_modules|dist/.test(src),
});

for (const file of ["package.json", "src/config.ts", ".env.example"]) {
  const p = join(dest, file);
  writeFileSync(p, readFileSync(p, "utf8").replaceAll("portal-template", name));
}

console.log(`Portal créé dans games/${name}.`);
console.log(`Ensuite : npm install, puis npm run dev -w games/${name}`);
