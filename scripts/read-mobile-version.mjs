#!/usr/bin/env node
/**
 * Lit la version depuis mobile/pubspec.yaml
 * - display : X.Y.Z (affichée utilisateur, GitHub, app)
 * - build   : N (versionCode Android / Play Store)
 * - full    : X.Y.Z+N
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pubspecPath = path.resolve(__dirname, "../mobile/pubspec.yaml");

const content = fs.readFileSync(pubspecPath, "utf8");
const match = content.match(/^version:\s*(\d+)\.(\d+)\.(\d+)\+(\d+)\s*$/m);

if (!match) {
  console.error("❌ Format version introuvable dans pubspec.yaml (attendu: X.Y.Z+N)");
  process.exit(1);
}

const display = `${match[1]}.${match[2]}.${match[3]}`;
const build = match[4];
const full = `${display}+${build}`;

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ display, build, full, label: `v${display}` }));
} else if (process.argv.includes("--display")) {
  console.log(display);
} else if (process.argv.includes("--build")) {
  console.log(build);
} else {
  console.log(full);
}
