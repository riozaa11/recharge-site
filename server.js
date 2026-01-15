import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import sqlite3 from "sqlite3";
import cookieSession from "cookie-session";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

/* ===== SESSION ===== */
app.use(
  cookieSession({
    name: "admin_session",
    keys: ["dev-secret-change-this"],
    httpOnly: true,
    sameSite: "lax"
  })
);

/* ===== ADMIN LOGIN INFO ===== */
const ADMIN_USER = "admin";
const ADMIN_PASS = "85359272"; // 👈 энд password-оо солино

function requireAdmin(req, res, next) {
  if (req.session?.isAdmin) return next();
  return res.status(401).json({ error: "Unauthorized" });
}

/* ===== DB ===== */
const db = new sqlite3.Database(path.join(__dirname, "data.sqlite"));

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      orderId TEXT PRIMARY KEY,
      game TEXT,
      packSku TEXT,
      packName TEXT,
      price INTEGER,
      accountId TEXT,
      phone TEXT,
      email TEXT,
      payment TEXT,
      note TEXT,
      status TEXT DEFAULT 'PENDING',
      createdAt TEXT
    )
  `);
});

function genId() {
  const c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => c[Math.floor(Math.random() * c.length)]).join("");
}

/* ===== USER API ===== */
app.post("/api/orders", (req, res) => {
  const o = req.body;
  const id = genId();
  const t = new Date().toISOString();

  db.run(
    `INSERT INTO orders VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id, o.game, o.packSku, o.packName, o.price,
      o.accountId, o.phone, o.email || "",
      o.payment, o.note || "", "PENDING", t
    ],
    (err) => {
      if (err) return res.status(500).json({ error: "DB error" });
      res.json({ orderId: id });
    }
  );
});

app.get("/api/orders/:id", (req, res) => {
  db.get(
    `SELECT orderId,status,createdAt FROM orders WHERE orderId=?`,
    [req.params.id],
    (e, r) => {
      if (!r) return res.status(404).json({ error: "Not found" });
      res.json(r);
    }
  );
});

/* ===== ADMIN AUTH API ===== */
app.post("/api/admin/login", (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    req.session.isAdmin = true;
    return res.json({ ok: true });
  }
  res.status(401).json({ error: "Username эсвэл password буруу" });
});

app.post("/api/admin/logout", (req, res) => {
  req.session = null;
  res.json({ ok: true });
});

app.get("/api/admin/me", (req, res) => {
  res.json({ isAdmin: !!req.session?.isAdmin });
});

/* ===== ADMIN DATA API ===== */
app.get("/api/admin/orders", requireAdmin, (req, res) => {
  db.all(`SELECT * FROM orders ORDER BY createdAt DESC`, [], (e, rows) => {
    res.json({ rows });
  });
});

app.patch("/api/admin/orders/:id", requireAdmin, (req, res) => {
  db.run(
    `UPDATE orders SET status=? WHERE orderId=?`,
    [req.body.status, req.params.id],
    function () {
      res.json({ ok: true });
    }
  );
});

/* ===== ADMIN PAGE ===== */
app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
