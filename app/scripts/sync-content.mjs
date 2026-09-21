// Copy committed data into the Vite public directory.
//
//   bundles/            -> public/bundles/
//   content/oracle/     -> public/content/oracle/
//   content/*.json      -> public/content/
//
// A symlink would be simpler but does not survive every CI checkout, and Vite
// copies publicDir verbatim. Contents are replaced, never the directories: a dev
// server already serving publicDir keeps the old inode, and every request under
// it would fall through to index.html with a 200.
import { cp, mkdir, readdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..", "..");
const pub = join(here, "..", "public");

async function replace(src, dest, filter = () => true) {
  if (!existsSync(src)) {
    console.error(`missing ${src}`);
    process.exit(1);
  }
  await mkdir(dest, { recursive: true });
  for (const entry of await readdir(dest)) await rm(join(dest, entry), { recursive: true, force: true });
  let n = 0;
  for (const entry of await readdir(src)) {
    if (!filter(entry)) continue;
    await cp(join(src, entry), join(dest, entry), { recursive: true });
    n += 1;
  }
  return n;
}

const nb = await replace(join(repo, "bundles"), join(pub, "bundles"));
const nc = await replace(join(repo, "content"), join(pub, "content"));
console.log(`synced ${nb} bundles and ${nc} content entries into app/public`);
