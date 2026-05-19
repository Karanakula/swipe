#!/usr/bin/env node
/**
 * Admin utility: add a single item without editing app code.
 * Usage: SWIPE_DB_PATH=... npx tsx scripts/add-item.ts --id foo --label "Bar" --image https://... [--desc "text"]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openDb } from "../src/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.SWIPE_DB_PATH ?? path.join(__dirname, "..", "data", "swipe.sqlite");

function arg(name: string) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

const id = arg("--id");
const label = arg("--label");
const imageUrl = arg("--image");
const description = arg("--desc") ?? "";

if (!id || !label || !imageUrl) {
  console.error(
    "Usage: tsx scripts/add-item.ts --id <id> --label <label> --image <url> [--desc <text>]"
  );
  process.exit(1);
}

if (!fs.existsSync(dbPath)) {
  console.error(`Database not found at ${dbPath}. Run npm run seed first.`);
  process.exit(1);
}

const db = openDb();
db.prepare(`INSERT OR REPLACE INTO items (id, label, description, image_url) VALUES (?, ?, ?, ?)`).run(
  id,
  label,
  description,
  imageUrl
);

console.log(`Upserted item ${id}`);
db.close();
