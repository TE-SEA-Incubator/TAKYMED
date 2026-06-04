#!/usr/bin/env node
/**
 * Incrémente la version Flutter avant chaque build mobile (APK / AAB).
 *
 * Source unique : mobile/pubspec.yaml → version: X.Y.Z+N
 * - Affichée (app, GitHub) : vX.Y.Z  ex. v1.0.3
 * - versionName Android  : X.Y.Z
 * - versionCode Android  : N (Play Store, toujours +1)
 *
 * Règles : patch +0.0.1 et build +1 à chaque bump
 *   1.0.3+3 → 1.0.4+4 → 1.0.5+5 …
 *
 * APK + AAB synchronisés : npm run mobile:release (un seul bump)
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

const major = Number(match[1]);
const minor = Number(match[2]);
let patch = Number(match[3]);
let build = Number(match[4]);

const previousDisplay = `${major}.${minor}.${patch}`;
const previousFull = `${previousDisplay}+${build}`;

patch += 1;
build += 1;

const nextDisplay = `${major}.${minor}.${patch}`;
const nextFull = `${nextDisplay}+${build}`;
const updated = content.replace(/^version:\s*.+$/m, `version: ${nextFull}`);

fs.writeFileSync(pubspecPath, updated, "utf8");

console.log(`📱 Version : v${previousDisplay} → v${nextDisplay} (build Android ${build})`);
