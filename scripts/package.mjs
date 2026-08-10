/**
 * package.mjs
 * Packages the built extension (dist/) into a distributable zip.
 * Run after `pnpm build`. Output: voiload-<version>.zip in the repo root.
 */
import { createWriteStream, existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import archiver from "archiver";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");
const distDir = resolve(rootDir, "dist");

async function main() {
  if (!existsSync(distDir)) {
    console.error("dist/ not found. Run `pnpm build` first.");
    process.exit(1);
  }

  const pkg = JSON.parse(
    await readFile(resolve(rootDir, "package.json"), "utf8")
  );
  const outFile = resolve(rootDir, `voiload-${pkg.version}.zip`);

  await new Promise((resolvePromise, reject) => {
    const output = createWriteStream(outFile);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () => {
      console.log(
        `Packaged ${archive.pointer()} bytes -> ${outFile.replace(rootDir + "/", "")}`
      );
      resolvePromise();
    });
    archive.on("warning", (err) => {
      if (err.code === "ENOENT") {
        console.warn(err.message);
      } else {
        reject(err);
      }
    });
    archive.on("error", reject);

    archive.pipe(output);
    // Zip the contents of dist/ at the archive root (not nested under dist/).
    archive.directory(distDir, false);
    archive.finalize();
  });
}

main().catch((err) => {
  console.error("Packaging failed:", err);
  process.exit(1);
});
