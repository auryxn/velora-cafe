/*
 * server/db.js
 * -------------------------------------------------------------
 * Opens (or creates) the Velora Café SQLite database at ./velora.sqlite
 * using the Node 24 built-in `node:sqlite` (DatabaseSync). Zero extra deps.
 *
 * Creates all tables and seeds them idempotently with the site's current
 * hardcoded content (menu, gallery, reviews, settings) plus a default admin.
 */
'use strict';

const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const crypto = require('node:crypto');

const DB_PATH = path.join(__dirname, '..', 'velora.sqlite');

// ---------------------------------------------------------------------------
// Table schema
// ---------------------------------------------------------------------------
const SCHEMA = `
CREATE TABLE IF NOT EXISTS menu_items (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  price      TEXT NOT NULL,
  desc       TEXT NOT NULL,
  category   TEXT NOT NULL DEFAULT 'coffee',
  image      TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  available  INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS reviews (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT '',
  quote      TEXT NOT NULL,
  rating     INTEGER NOT NULL DEFAULT 5,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS gallery (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  label      TEXT NOT NULL,
  caption    TEXT NOT NULL DEFAULT '',
  image      TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS reservations (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  phone      TEXT NOT NULL,
  date       TEXT NOT NULL,
  time       TEXT NOT NULL,
  guests     INTEGER NOT NULL DEFAULT 2,
  note       TEXT NOT NULL DEFAULT '',
  status     TEXT NOT NULL DEFAULT 'new',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS admins (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  salt          TEXT NOT NULL
);
`;

// ---------------------------------------------------------------------------
// Seed data (kept identical to the values currently hardcoded in the site)
// Image values use the key <local:hero|interior|dessert|evening> or an
// uploaded path beginning with /uploads/.
// ---------------------------------------------------------------------------
const SEED_SETTINGS = {
  brand_name: 'BALTIC BREW',
  tagline: 'Specialty coffee & all-day breakfast, made slow.',
  brand_subtitle: 'Specialty Coffee & All-Day Breakfast in Vilnius',
  location_eyebrow: 'Vilnius · Specialty Coffee',
  address: 'Užupio g. 12, Vilnius, Lithuania',
  hours: 'Mon–Fri: 08:00–20:00 · Sat–Sun: 09:00–21:00',
  phone: '+370 600 12345',
  email: 'hello@balticbrew.com',
  instagram: '#',
  facebook: '#',
  tiktok: '#',
  hero_title: 'Specialty Coffee & All-Day Breakfast in Vilnius',
  hero_subtitle:
    'A warm modern café for slow mornings, good conversations, and handcrafted desserts.',
  about_title: 'A café built around slow mornings',
  about_body:
    'BALTIC BREW is a specialty coffee spot in the heart of Užupis, where every cup is brewed with care and every plate is made fresh. We roast thoughtfully, source seasonally, and keep the room calm enough for deep work, first dates, and long catch-ups with friends.',
  gallery_eyebrow: 'Inside BALTIC BREW',
  reviews_eyebrow: 'What Guests Say',
  footer_tagline: 'Specialty coffee & all-day breakfast, made slow.',
  footer_year: '2025',
};

const ICON_KEYS = {
  Coffee: 'Coffee',
  UtensilsCrossed: 'UtensilsCrossed',
  Sparkles: 'Sparkles',
};

const SEED_MENU = [
  { name: 'Flat White', price: '€3.80', desc: 'Smooth espresso, velvety steamed milk', category: 'coffee', image: 'local:hero', sort_order: 1 },
  { name: 'Vanilla Latte', price: '€4.20', desc: 'Espresso with house-made vanilla syrup', category: 'coffee', image: 'local:dessert', sort_order: 2 },
  { name: 'Avocado Toast', price: '€8.50', desc: 'Sourdough, smashed avocado, chili oil', category: 'food', image: 'local:hero', sort_order: 3 },
  { name: 'Croissant Benedict', price: '€9.90', desc: 'Butter croissant, poached eggs, hollandaise', category: 'food', image: 'local:hero', sort_order: 4 },
  { name: 'Pistachio Cheesecake', price: '€5.50', desc: 'Creamy cheesecake, roasted pistachio crumb', category: 'dessert', image: 'local:dessert', sort_order: 5 },
  { name: 'Berry Pancakes', price: '€8.90', desc: 'Fluffy pancakes, seasonal berries, maple syrup', category: 'dessert', image: 'local:hero', sort_order: 6 },
];

const SEED_GALLERY = [
  { label: 'Morning espresso pull', caption: 'Morning light', image: 'local:hero', sort_order: 1 },
  { label: 'Pastry case close-up', caption: 'Fresh daily', image: 'local:dessert', sort_order: 2 },
  { label: 'Window seat, midday', caption: 'Midday calm', image: 'local:interior', sort_order: 3 },
  { label: 'Friends at the table', caption: 'Catching up', image: 'local:interior', sort_order: 4 },
  { label: 'Evening glow, last guests', caption: 'Warm evening', image: 'local:evening', sort_order: 5 },
];

const SEED_REVIEWS = [
  { name: 'Marta', role: 'Remote worker', quote: 'My unofficial office. Great wifi, better coffee, nobody rushes you.', rating: 5, sort_order: 1 },
  { name: 'Tomas & Eglė', role: 'Date night', quote: 'We came for coffee and stayed for the conversation. So cozy.', rating: 5, sort_order: 2 },
  { name: 'Weekend friends', role: 'Brunch regulars', quote: 'Pancakes are unreal and our table was ready right on time.', rating: 5, sort_order: 3 },
];

// ---------------------------------------------------------------------------
// Password hashing helpers (pbkdf2) — same approach as typical scrypt/pbkdf2.
// ---------------------------------------------------------------------------
function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
}

function makeSalt() {
  return crypto.randomBytes(16).toString('hex');
}

// ---------------------------------------------------------------------------
// "is empty" helpers just counting rows.
// ---------------------------------------------------------------------------
function count(db, table) {
  const row = db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get();
  return row ? Number(row.c) : 0;
}

function seedTable(db, table, rows, columns, ignoreSets = []) {
  if (count(db, table) > 0) return; // idempotent: only seed empty tables
  const placeholders = columns.map(() => '?').join(', ');
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`
  );
  for (const r of rows) {
    runGuarded(db, () =>
      stmt.run(...columns.map((c) => (r[c] === undefined ? 0 : r[c])))
    );
  }
  db.exec(`DELETE FROM sqlite_sequence WHERE name = '${table}'`); // rewind autoincrement
}

function runGuarded(db, fn) {
  try {
    fn();
  } catch (e) {
    // ignore constraint / duplicate key — intended for idempotent seeding
    if (!String(e && e.message).includes('UNIQUE')) console.error('seed warn:', e.message);
  }
}

// ---------------------------------------------------------------------------
// Seed admins (idempotent by username)
// ---------------------------------------------------------------------------
function seedAdmins(db) {
  const existing = db.prepare('SELECT COUNT(*) AS c FROM admins').get();
  if (existing && existing.c > 0) return;
  const salt = makeSalt();
  const hash = hashPassword('admin123', salt);
  db.prepare('INSERT INTO admins (username, password_hash, salt) VALUES (?, ?, ?)').run(
    'admin',
    hash,
    salt
  );
}

// ---------------------------------------------------------------------------
// Open DB + apply schema + seed
// ---------------------------------------------------------------------------
function openDb() {
  const db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec(SCHEMA);

  // Seed settings only if the table is empty (merge rather than clobber on upgrades)
  if (count(db, 'settings') === 0) {
    const ins = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
    for (const [k, v] of Object.entries(SEED_SETTINGS)) {
      runGuarded(db, () => ins.run(k, String(v)));
    }
  }

  seedTable(db, 'menu_items', SEED_MENU, ['name', 'price', 'desc', 'category', 'image', 'sort_order']);
  seedTable(db, 'gallery', SEED_GALLERY, ['label', 'caption', 'image', 'sort_order']);
  seedTable(db, 'reviews', SEED_REVIEWS, ['name', 'role', 'quote', 'rating', 'sort_order']);
  seedAdmins(db);

  return db;
}

// Validate a password against a stored admin row {password_hash, salt}
function verifyPassword(password, salt, expectedHash) {
  return hashPassword(password, salt) === expectedHash;
}

if (require.main === module) {
  const db = openDb();
  if (typeof db.close === 'function') db.close();
  console.log(`SQLite database ready: ${DB_PATH}`);
  console.log('Default admin: admin / admin123');
}

module.exports = {
  openDb,
  hashPassword,
  makeSalt,
  verifyPassword,
  DB_PATH,
};
