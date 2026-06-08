#!/usr/bin/env node
/**
 * Build le frontend (dist/spa) et crée takymed-web.zip à la racine du projet.
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const spaDir = path.join(root, "dist", "spa");
const zipName = "takymed-web.zip";
const zipPath = path.join(root, zipName);

console.log("📦 Build frontend…");
execSync("npm run build:client", { cwd: root, stdio: "inherit" });

if (!fs.existsSync(spaDir)) {
  console.error("❌ dist/spa introuvable après le build");
  process.exit(1);
}

const htaccess = path.join(spaDir, ".htaccess");
if (!fs.existsSync(htaccess)) {
  console.warn("⚠️  .htaccess absent de dist/spa — routing SPA IONOS peut échouer");
} else {
  console.log("✓ .htaccess inclus (routing SPA pour IONOS)");
}

if (fs.existsSync(zipPath)) {
  fs.unlinkSync(zipPath);
}

console.log("🗜️  Création de l'archive…");
execSync(`zip -rq "${zipPath}" .`, { cwd: spaDir, stdio: "inherit" });

const sizeMb = (fs.statSync(zipPath).size / (1024 * 1024)).toFixed(2);
console.log(`✅ Archive créée : ${zipName} (${sizeMb} Mo)`);
