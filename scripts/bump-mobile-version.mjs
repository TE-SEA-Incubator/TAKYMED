#!/usr/bin/env node
/**
 * Incrémente la version Flutter avant chaque build APK.
 *
 * Règles :
 * - +0.0.1 à chaque build (patch : 1.0.0 → 1.0.1 → 1.0.2 …)
 * - Numéro de build Android (+N) toujours +1
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

const previous = `${major}.${minor}.${patch}+${build}`;

patch += 1;
build += 1;

const next = `${major}.${minor}.${patch}+${build}`;
const updated = content.replace(/^version:\s*.+$/m, `version: ${next}`);

fs.writeFileSync(pubspecPath, updated, "utf8");

console.log(`📱 Version mobile : ${previous} → ${next}`);
