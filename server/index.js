/*
 * server/index.js — Velora Café API + static file server.
 *
 * Pure Node built-ins (node:http, node:fs, node:path, node:url, node:crypto).
 * Serves the Vite production build from ../dist and the admin entry via the
 * same server, and exposes a JSON REST API under /api.
 *
 * Run:  node server/index.js   (or `npm start`)
 * Env:  PORT (default 4000), VELORA_SECRET (recommended in production)
 */
'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const urlMod = require('node:url');

const { openDb, verifyPassword, hashPassword, makeSalt } = require('./db');
const { signToken, verifyToken } = require('./auth');

const PORT = Number(process.env.PORT) || 4000;
const HOST = process.env.HOST || '0.0.0.0';

const ROOT = path.join(__dirname, '..');
const DIST_DIR = path.join(ROOT, 'dist');
const UPLOADS_DIR = path.join(ROOT, 'uploads');

// Paths that must be excluded from static file serving (route-first)
const API_PREFIX = '/api';
const STATIC_PREFIXES = ['/assets/', '/uploads/'];

// ---------------------------------------------------------------------------
// Tiny home-grown static file serving (gated to dist + uploads).
// ---------------------------------------------------------------------------
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json',
};

function contentType(p) {
  return MIME[path.extname(p).toLowerCase()] || 'application/octet-stream';
}

// Send a file, guarding against path traversal.
function sendFile(req, res, absPath) {
  fs.readFile(absPath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': contentType(absPath),
      'Cache-Control': absPath.includes(STATIC_PREFIXES[0])
        ? 'public, max-age=31536000, immutable'
        : 'no-cache',
    });
    res.end(data);
  });
}

// SPA-style fallback to index.html / admin.html (only for HTML navigation).
function serveBuildFile(filepath, fallback) {
  if (!fs.existsSync(filepath)) {
    // Missing requested file: fall back to the SPA entry (client routing)
    const fb = path.join(DIST_DIR, fallback);
    return fs.existsSync(fb) ? fb : filepath;
  }
  return filepath;
}

// ---------------------------------------------------------------------------
// JSON helpers
// ---------------------------------------------------------------------------
function readJsonBody(req, limit = 2 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > limit) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function json(res, status, data) {
  const payload = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

// ---------------------------------------------------------------------------
// DB-backed CRUD helpers
// ---------------------------------------------------------------------------
function rowToMenu(r) {
  return {
    id: r.id,
    name: r.name,
    price: r.price,
    desc: r.desc,
    category: r.category,
    image: r.image,
    sort_order: r.sort_order,
    available: !!r.available,
  };
}

// ---------------------------------------------------------------------------
// Create the http server & routes
// ---------------------------------------------------------------------------
const db = openDb();
console.log(`[velora] SQLite ready at ${require('./db').DB_PATH}`);

// Prepared statements (menu)
const menuListStmt = db.prepare(
  'SELECT * FROM menu_items WHERE available = 1 ORDER BY sort_order ASC, id ASC'
);
const menuAllStmt = db.prepare('SELECT * FROM menu_items ORDER BY sort_order ASC, id ASC');
const menuGetStmt = db.prepare('SELECT * FROM menu_items WHERE id = ?');
const menuInsertStmt = db.prepare(
  'INSERT INTO menu_items (name, price, desc, category, image, sort_order, available) VALUES (?, ?, ?, ?, ?, ?, ?)'
);
const menuUpdateStmt = db.prepare(
  'UPDATE menu_items SET name = ?, price = ?, desc = ?, category = ?, image = ?, sort_order = ?, available = ? WHERE id = ?'
);
const menuDeleteStmt = db.prepare('DELETE FROM menu_items WHERE id = ?');

// reviews
const reviewListStmt = db.prepare('SELECT * FROM reviews ORDER BY sort_order ASC, id ASC');
const reviewGetStmt = db.prepare('SELECT * FROM reviews WHERE id = ?');
const reviewInsertStmt = db.prepare(
  'INSERT INTO reviews (name, role, quote, rating, sort_order) VALUES (?, ?, ?, ?, ?)'
);
const reviewUpdateStmt = db.prepare(
  'UPDATE reviews SET name = ?, role = ?, quote = ?, rating = ?, sort_order = ? WHERE id = ?'
);
const reviewDeleteStmt = db.prepare('DELETE FROM reviews WHERE id = ?');

// gallery
const galleryListStmt = db.prepare('SELECT * FROM gallery ORDER BY sort_order ASC, id ASC');
const galleryGetStmt = db.prepare('SELECT * FROM gallery WHERE id = ?');
const galleryInsertStmt = db.prepare(
  'INSERT INTO gallery (label, caption, image, sort_order) VALUES (?, ?, ?, ?)'
);
const galleryUpdateStmt = db.prepare(
  'UPDATE gallery SET label = ?, caption = ?, image = ?, sort_order = ? WHERE id = ?'
);
const galleryDeleteStmt = db.prepare('DELETE FROM gallery WHERE id = ?');

// settings
const settingsGetStmt = db.prepare('SELECT key, value FROM settings');
const settingUpsertStmt = db.prepare(
  'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
);

// reservations
const resvListStmt = db.prepare(
  "SELECT * FROM reservations WHERE status != 'cancelled' ORDER BY date ASC, time ASC"
);
const resvAllStmt = db.prepare('SELECT * FROM reservations ORDER BY created_at DESC, id DESC');
const resvGetStmt = db.prepare('SELECT * FROM reservations WHERE id = ?');
const resvInsertStmt = db.prepare(
  'INSERT INTO reservations (name, phone, date, time, guests, note, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
);
const resvUpdateStmt = db.prepare(
  'UPDATE reservations SET name = ?, phone = ?, date = ?, time = ?, guests = ?, note = ?, status = ? WHERE id = ?'
);
const resvStatusStmt = db.prepare('UPDATE reservations SET status = ? WHERE id = ?');
const resvDeleteStmt = db.prepare('DELETE FROM reservations WHERE id = ?');

// admins
const adminByNameStmt = db.prepare('SELECT * FROM admins WHERE username = ?');

// Extract "id" path param helper e.g. /api/admin/menu/3
function firstNumericSeg(urlParts, afterIndex) {
  // find first numeric segment after `afterIndex`
  for (let i = afterIndex; i < urlParts.length; i++) {
    if (/^\d+$/.test(urlParts[i])) return Number(urlParts[i]);
  }
  return null;
}

// Convert a body to menu-friendly object (coerce types from JSON)
function normInt(v, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : def;
}
function normBool(v, def = true) {
  if (v === undefined || v === null) return def;
  return v === true || v === 1 || v === '1' || v === 'true';
}

const server = http.createServer(async (req, res) => {
  const method = (req.method || 'GET').toUpperCase();
  const parsed = urlMod.parse(req.url, true);
  const pathname = decodeURIComponent(parsed.pathname || '/');
  const parts = pathname.split('/').filter(Boolean);

  // CORS
  // Preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, corsHeaders());
    res.end();
    return;
  }

  const setCommon = () => {
    const h = corsHeaders();
    for (const [k, v] of Object.entries(h)) res.setHeader(k, v);
  };
  setCommon();

  try {
    // ---------------- /api ----------------
    if (pathname.startsWith(API_PREFIX)) {
      return await handleApi(req, res, method, parts, pathname, parsed);
    }

    // ---------------- /uploads/* ----------------
    if (parts[0] === 'uploads') {
      const rel = parts.slice(1).join('/');
      const abs = path.join(UPLOADS_DIR, rel);
      // Guard: resolved path must stay within uploads dir
      if (!abs.startsWith(UPLOADS_DIR + path.sep)) {
        json(res, 403, { error: 'Forbidden' });
        return;
      }
      if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
        return sendFile(req, res, abs);
      }
      json(res, 404, { error: 'Not found' });
      return;
    }

    // ---------------- Static build (dist) ----------------
    let filePath;
    if (pathname === '/admin' || pathname === '/admin/') {
      filePath = serveBuildFile(path.join(DIST_DIR, 'admin.html'), 'admin.html');
    } else if (pathname === '/') {
      filePath = serveBuildFile(path.join(DIST_DIR, 'index.html'), 'index.html');
    } else {
      const candidate = path.join(DIST_DIR, pathname);
      if (
        candidate.startsWith(DIST_DIR + path.sep) &&
        fs.existsSync(candidate) &&
        fs.statSync(candidate).isFile()
      ) {
        filePath = candidate;
      } else {
        // SPA fallback to main page (or admin).
        filePath = pathname.indexOf('/admin') === 0
          ? serveBuildFile(path.join(DIST_DIR, 'admin.html'), 'admin.html')
          : path.join(DIST_DIR, 'index.html');
        if (!fs.existsSync(filePath)) {
          json(res, 404, { error: 'Not found' });
          return;
        }
      }
    }
    return sendFile(req, res, filePath);
  } catch (err) {
    console.error('[velora] request error:', err);
    if (!res.headersSent) json(res, 500, { error: 'Internal server error' });
    else res.end();
  }
});

// ---------------------------------------------------------------------------
// handleApi
// ---------------------------------------------------------------------------
async function handleApi(req, res, method, parts, pathname, parsed) {
  // strip leading 'api'
  const p = parts.slice(1); // e.g. ['menu'], ['admin','menu','3'], ['auth','login']

  // ---- /api/health
  if (p[0] === 'health') {
    return json(res, 200, { status: 'ok', time: new Date().toISOString() });
  }

  // ---- /api/auth/login  (POST)
  if (p[0] === 'auth' && p[1] === 'login') {
    if (method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
    const body = await readJsonBody(req);
    const username = String(body.username || '').trim();
    const password = String(body.password || '');
    if (!username || !password) return json(res, 400, { error: 'Username and password required' });
    const admin = adminByNameStmt.get(username);
    if (!admin) return json(res, 401, { error: 'Invalid credentials' });
    if (!verifyPassword(password, admin.salt, admin.password_hash))
      return json(res, 401, { error: 'Invalid credentials' });
    const token = signToken({ sub: admin.id, username: admin.username });
    return json(res, 200, { token, admin: { id: admin.id, username: admin.username } });
  }

  // ---- /api/auth/me
  if (p[0] === 'auth' && p[1] === 'me') {
    const auth = authorize(req);
    if (!auth) return json(res, 401, { error: 'Unauthorized' });
    return json(res, 200, { admin: { id: auth.payload.sub, username: auth.payload.username } });
  }

  // ---- Public GET resources: menu / reviews / gallery / settings
  if (method === 'GET' && p.length === 1) {
    if (p[0] === 'menu') {
      return json(res, 200, menuListStmt.all().map(rowToMenu));
    }
    if (p[0] === 'reviews') return json(res, 200, reviewListStmt.all());
    if (p[0] === 'gallery') return json(res, 200, galleryListStmt.all());
    if (p[0] === 'settings') {
      const rows = settingsGetStmt.all();
      const obj = {};
      for (const r of rows) obj[r.key] = r.value;
      return json(res, 200, obj);
    }
  }

  // ---- Public: POST /api/reservations
  if (p[0] === 'reservations' && method === 'POST') {
    const body = await readJsonBody(req);
    const name = String(body.name || '').trim();
    const phone = String(body.phone || '').trim();
    const date = String(body.date || '').trim();
    const time = String(body.time || '').trim();
    const guests = normInt(body.guests, 2);
    const note = String(body.note || '').trim();
    if (!name || !phone || !date || !time)
      return json(res, 400, { error: 'Name, phone, date and time are required' });
    const info = resvInsertStmt.run(name, phone, date, time, guests, note, 'new');
    return json(res, 201, {
      id: Number(info.lastInsertRowid),
      name,
      phone,
      date,
      time,
      guests,
      note,
      status: 'new',
      message: 'Reservation request received',
    });
  }

  // ================= ADMIN routes (token-protected) =================
  const isAdmin = p[0] === 'admin';
  if (isAdmin) {
    const auth = authorize(req);
    if (!auth) return json(res, 401, { error: 'Unauthorized' });
    const a = p.slice(1); // e.g. ['menu'], ['menu','3'], ['reservations','2']

    // ---- change own password optional / future-proof. skip.

    // -------- MENU --------
    if (a[0] === 'menu') {
      const id = firstNumericSeg(a, 1);
      if (method === 'GET' && !id) return json(res, 200, menuAllStmt.all().map(rowToMenu));
      if (method === 'POST') {
        const b = await readJsonBody(req);
        const info = menuInsertStmt.run(
          String(b.name || '').trim(),
          String(b.price || '').trim(),
          String(b.desc || '').trim(),
          String(b.category || 'coffee').trim(),
          String(b.image || '').trim(),
          normInt(b.sort_order, 0),
          normBool(b.available) ? 1 : 0
        );
        return json(res, 201, menuGetStmt.get(Number(info.lastInsertRowid)));
      }
      if (method === 'PUT' && id) {
        const b = await readJsonBody(req);
        const cur = menuGetStmt.get(id);
        if (!cur) return json(res, 404, { error: 'Not found' });
        menuUpdateStmt.run(
          b.name !== undefined ? String(b.name).trim() : cur.name,
          b.price !== undefined ? String(b.price).trim() : cur.price,
          b.desc !== undefined ? String(b.desc).trim() : cur.desc,
          b.category !== undefined ? String(b.category).trim() : cur.category,
          b.image !== undefined ? String(b.image).trim() : cur.image,
          b.sort_order !== undefined ? normInt(b.sort_order, cur.sort_order) : cur.sort_order,
          b.available !== undefined ? (normBool(b.available) ? 1 : 0) : cur.available,
          id
        );
        return json(res, 200, menuGetStmt.get(id) || null);
      }
      if (method === 'DELETE' && id) {
        menuDeleteStmt.run(id);
        return json(res, 200, { ok: true, id });
      }
    }

    // -------- REVIEWS --------
    if (a[0] === 'reviews') {
      const id = firstNumericSeg(a, 1);
      if (method === 'GET' && !id) return json(res, 200, reviewListStmt.all());
      if (method === 'POST') {
        const b = await readJsonBody(req);
        const info = reviewInsertStmt.run(
          String(b.name || '').trim(),
          String(b.role || '').trim(),
          String(b.quote || '').trim(),
          normInt(b.rating, 5),
          normInt(b.sort_order, 0)
        );
        return json(res, 201, reviewGetStmt.get(Number(info.lastInsertRowid)));
      }
      if (method === 'PUT' && id) {
        const b = await readJsonBody(req);
        const cur = reviewGetStmt.get(id);
        if (!cur) return json(res, 404, { error: 'Not found' });
        reviewUpdateStmt.run(
          b.name !== undefined ? String(b.name).trim() : cur.name,
          b.role !== undefined ? String(b.role).trim() : cur.role,
          b.quote !== undefined ? String(b.quote).trim() : cur.quote,
          b.rating !== undefined ? normInt(b.rating, cur.rating) : cur.rating,
          b.sort_order !== undefined ? normInt(b.sort_order, cur.sort_order) : cur.sort_order,
          id
        );
        return json(res, 200, reviewGetStmt.get(id) || null);
      }
      if (method === 'DELETE' && id) {
        reviewDeleteStmt.run(id);
        return json(res, 200, { ok: true, id });
      }
    }

    // -------- GALLERY --------
    if (a[0] === 'gallery') {
      const id = firstNumericSeg(a, 1);
      if (method === 'GET' && !id) return json(res, 200, galleryListStmt.all());
      if (method === 'POST') {
        const b = await readJsonBody(req);
        const info = galleryInsertStmt.run(
          String(b.label || '').trim(),
          String(b.caption || '').trim(),
          String(b.image || '').trim(),
          normInt(b.sort_order, 0)
        );
        return json(res, 201, galleryGetStmt.get(Number(info.lastInsertRowid)));
      }
      if (method === 'PUT' && id) {
        const b = await readJsonBody(req);
        const cur = galleryGetStmt.get(id);
        if (!cur) return json(res, 404, { error: 'Not found' });
        galleryUpdateStmt.run(
          b.label !== undefined ? String(b.label).trim() : cur.label,
          b.caption !== undefined ? String(b.caption).trim() : cur.caption,
          b.image !== undefined ? String(b.image).trim() : cur.image,
          b.sort_order !== undefined ? normInt(b.sort_order, cur.sort_order) : cur.sort_order,
          id
        );
        return json(res, 200, galleryGetStmt.get(id) || null);
      }
      if (method === 'DELETE' && id) {
        galleryDeleteStmt.run(id);
        return json(res, 200, { ok: true, id });
      }
    }

    // -------- SETTINGS --------
    if (a[0] === 'settings') {
      if (method === 'GET') {
        const rows = settingsGetStmt.all();
        const obj = {};
        for (const r of rows) obj[r.key] = r.value;
        return json(res, 200, obj);
      }
      if (method === 'PUT' || method === 'POST') {
        const body = await readJsonBody(req);
        const patch = body && typeof body === 'object' ? body : {};
        for (const [k, v] of Object.entries(patch)) {
          if (k === 'key' || k === 'value') continue;
          settingUpsertStmt.run(k, v === null ? '' : String(v));
        }
        const rows = db.prepare('SELECT key, value FROM settings').all();
        const obj = {};
        for (const r of rows) obj[r.key] = r.value;
        return json(res, 200, obj);
      }
    }

    // -------- RESERVATIONS --------
    if (a[0] === 'reservations') {
      const id = firstNumericSeg(a, 1);
      if (method === 'GET' && !id) return json(res, 200, resvAllStmt.all());
      if (method === 'GET' && id) return json(res, 200, resvGetStmt.get(id) || {});
      if (method === 'PUT' && id) {
        const b = await readJsonBody(req);
        // allow partial status update OR full update
        const existing = resvGetStmt.get(id);
        if (!existing) return json(res, 404, { error: 'Not found' });
        if (b.status !== undefined) {
          resvStatusStmt.run(String(b.status), id);
          return json(res, 200, resvGetStmt.get(id));
        }
        const name = b.name !== undefined ? String(b.name).trim() : existing.name;
        const phone = b.phone !== undefined ? String(b.phone).trim() : existing.phone;
        const date = b.date !== undefined ? String(b.date).trim() : existing.date;
        const time = b.time !== undefined ? String(b.time).trim() : existing.time;
        const guests = b.guests !== undefined ? normInt(b.guests, existing.guests) : existing.guests;
        const note = b.note !== undefined ? String(b.note) : existing.note;
        const status = b.status !== undefined ? String(b.status) : existing.status;
        resvUpdateStmt.run(name, phone, date, time, guests, note, status, id);
        return json(res, 200, resvGetStmt.get(id));
      }
      if (method === 'DELETE' && id) {
        resvDeleteStmt.run(id);
        return json(res, 200, { ok: true, id });
      }
    }

    // -------- UPLOAD (base64 JSON) --------
    if (a[0] === 'upload' && method === 'POST') {
      return await handleUpload(req, res);
    }

    return json(res, 404, { error: 'Unknown admin resource' });
  }

  // fallback
  return json(res, 404, { error: 'Not found' });
}

// ---------------------------------------------------------------------------
// Upload: accept { filename, data(base64), mime } and store into uploads dir
// ---------------------------------------------------------------------------
function handleUpload(req, res) {
  return readJsonBody(req, 8 * 1024 * 1024).then(async (body) => {
    if (!body.data) return json(res, 400, { error: 'Missing base64 data' });
    const mime = String(body.mime || 'image/png').toLowerCase();
    const extMap = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/gif': '.gif' };
    const ext = extMap[mime] || '.png';
    const base64 = String(body.data).split(',')[1] || String(body.data);
    let buffer;
    try {
      buffer = Buffer.from(base64, 'base64');
    } catch {
      return json(res, 400, { error: 'Invalid base64' });
    }
    if (!buffer.length) return json(res, 400, { error: 'Empty image data' });
    if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    const name = `img-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`;
    const absPath = path.join(UPLOADS_DIR, name);
    fs.writeFileSync(absPath, buffer);
    const publicUrl = `/uploads/${name}`;
    return json(res, 201, { url: publicUrl, filename: name });
  });
}

// ---------------------------------------------------------------------------
// Auth middleware helper
// ---------------------------------------------------------------------------
function authorize(req) {
  const header = req.headers['authorization'] || '';
  const m = header.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  const payload = verifyToken(m[1].trim());
  if (!payload) return null;
  return { token: m[1].trim(), payload };
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
server.listen(PORT, HOST, () => {
  console.log(`[velora] 🌱  server up → http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
  console.log(`[velora]    Public site   → http://localhost:${PORT}/`);
  console.log(`[velora]    Admin panel   → http://localhost:${PORT}/admin`);
  console.log(`[velora]    API health    → http://localhost:${PORT}/api/health`);
});
