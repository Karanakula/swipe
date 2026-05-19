/**
 * Seeds SQLite with 100+ themed items.
 * Images: Lorem Picsum (https://picsum.photos) — deterministic per-item seeds; see README credits.
 */
import { openDb, runInTransaction } from "./src/db.js";

const THEMES = [
  "Ancient ruins",
  "Modern skyline",
  "National park",
  "Island paradise",
  "Mountain vista",
  "Coastal cliffs",
  "Desert dunes",
  "Frozen tundra",
  "Waterfall",
  "Historic bridge",
];

function itemLabel(i: number) {
  return `Landmark pick #${String(i).padStart(3, "0")}`;
}

function itemDescription(i: number) {
  const t = THEMES[i % THEMES.length];
  return `${t} — swipe yes if you'd book a trip here tomorrow.`;
}

function imageUrlFor(id: string) {
  const seed = `swipe-landmark-${id}`;
  const w = 480;
  const h = 640;
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/${w}/${h}`;
}

const db = openDb();

const insert = db.prepare(`
  INSERT OR REPLACE INTO items (id, label, description, image_url)
  VALUES (?, ?, ?, ?)
`);

const TARGET = 110;

runInTransaction(db, () => {
  for (let i = 1; i <= TARGET; i++) {
    const id = `lm-${String(i).padStart(4, "0")}`;
    insert.run(id, itemLabel(i), itemDescription(i), imageUrlFor(id));
  }
});

const count = (db.prepare(`SELECT COUNT(*) AS c FROM items`).get() as { c: number }).c;
console.log(`Seeded ${count} items.`);
db.close();
