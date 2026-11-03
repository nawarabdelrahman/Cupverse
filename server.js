"use strict";
const express = require("express"),
  multer = require("multer"),
  fs = require("fs"),
  path = require("path"),
  crypto = require("crypto");
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123"; // غيّرها عبر متغير البيئة
const DATA = path.join(__dirname, "data"),
  DB_FILE = path.join(DATA, "db.json");
const UP = path.join(__dirname, "public", "uploads"),
  DESIGNS = path.join(DATA, "designs");
[DATA, UP, DESIGNS].forEach((d) => fs.mkdirSync(d, { recursive: true }));
const CATS = ["mugs", "bottles", "wallets", "custom"];
const STATUS = ["جديد", "قيد التنفيذ", "تم التسليم", "ملغي"];

/* ---------- Data layer (استبدلها بـ SQLite/Postgres/Mongo لاحقًا) ---------- */
const seed = [
  [
    "مج ماجيك يتغير لونه",
    150,
    "mugs",
    "مج سيراميك يظهر تصميمك عند التسخين.",
    ["أسود", "أبيض"],
  ],
  [
    "مج كلاسيك بالاسم",
    95,
    "mugs",
    "مج أبيض مطبوع عليه اسمك أو صورتك.",
    ["أبيض", "وردي", "لافندر"],
  ],
  [
    "مج السفر الحراري",
    220,
    "mugs",
    "يحافظ على حرارة مشروبك 6 ساعات.",
    ["رمادي", "وردي"],
  ],
  [
    "زمزمية ستانلس 750 مل",
    260,
    "bottles",
    "زجاجة فولاذ بدون صدأ مع نقش اسمك.",
    ["أزرق", "وردي", "أسود"],
  ],
  [
    "زجاجة مياه رياضية",
    130,
    "bottles",
    "خفيفة وآمنة، مناسبة للجيم والمدرسة.",
    ["شفاف", "لافندر"],
  ],
  [
    "محفظة جلد بالاسم",
    240,
    "wallets",
    "جلد صناعي فاخر مع حفر الاسم.",
    ["بني", "أسود"],
  ],
  [
    "محفظة كروت أنيقة",
    160,
    "wallets",
    "تصميم نحيف يتسع لـ 8 كروت.",
    ["بيج", "وردي"],
  ],
  ["بوكس هدية مخصص", 350, "custom", "بوكس يضم مج + كارت + مفاجأة بتصميمك.", []],
].map((p, i) => ({
  id: i + 1,
  name: p[0],
  price: p[1],
  cat: p[2],
  desc: p[3],
  colors: p[4],
  img: "",
  avail: true,
}));
let db;
const save = () => {
  const t = DB_FILE + ".tmp";
  fs.writeFileSync(t, JSON.stringify(db, null, 2));
  fs.renameSync(t, DB_FILE);
};
if (fs.existsSync(DB_FILE)) db = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
else {
  db = { products: seed, orders: [] };
  save();
}

/* ---------- Uploads ---------- */
const EXT = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};
const mk = (dir) =>
  multer({
    storage: multer.diskStorage({
      destination: dir,
      filename: (q, f, cb) =>
        cb(null, crypto.randomBytes(12).toString("hex") + EXT[f.mimetype]),
    }),
    fileFilter: (q, f, cb) =>
      EXT[f.mimetype]
        ? cb(null, true)
        : cb(new Error("الملف لازم يكون صورة (jpg/png/webp/gif)")),
    limits: { fileSize: 2 * 1024 * 1024, files: 20 },
  });
const productUp = mk(UP),
  designUp = mk(DESIGNS);
const rm = (f) => {
  try {
    fs.unlinkSync(f);
  } catch {}
};

/* ---------- Auth ---------- */
const tokens = new Map(),
  fails = new Map();
const sha = (s) => crypto.createHash("sha256").update(String(s)).digest();
function admin(req, res, next) {
  const t =
    (req.headers.authorization || "").replace("Bearer ", "") || req.query.token;
  const exp = tokens.get(t);
  if (!exp || exp < Date.now()) {
    tokens.delete(t);
    return res.status(401).json({ error: "غير مصرح، سجّل الدخول" });
  }
  next();
}

const app = express();
app.disable("x-powered-by");
app.use((q, r, n) => {
  r.setHeader("X-Content-Type-Options", "nosniff");
  r.setHeader("X-Frame-Options", "SAMEORIGIN");
  n();
});
app.use(express.json({ limit: "100kb" }));

app.post("/api/admin/login", (req, res) => {
  const ip = req.ip,
    f = fails.get(ip) || { n: 0, t: Date.now() };
  if (Date.now() - f.t > 15 * 60e3) {
    f.n = 0;
    f.t = Date.now();
  }
  if (f.n >= 5)
    return res.status(429).json({ error: "محاولات كثيرة، حاول بعد 15 دقيقة" });
  if (
    !crypto.timingSafeEqual(sha(req.body.password || ""), sha(ADMIN_PASSWORD))
  ) {
    f.n++;
    fails.set(ip, f);
    return res.status(401).json({ error: "كلمة السر غير صحيحة" });
  }
  fails.delete(ip);
  const token = crypto.randomBytes(24).toString("hex");
  tokens.set(token, Date.now() + 8 * 3600e3);
  res.json({ token });
});

/* ---------- Products ---------- */
function parseProduct(b) {
  const p = {
    name: String(b.name || "").trim(),
    price: Number(b.price),
    desc: String(b.desc || "").trim(),
    cat: b.cat,
    colors: String(b.colors || "")
      .split(/[,،]/)
      .map((s) => s.trim())
      .filter(Boolean),
    avail: b.avail === "1" || b.avail === true,
  };
  if (p.name.length < 2 || p.name.length > 100)
    return { error: "اسم المنتج غير صالح" };
  if (!(p.price > 0 && p.price < 1e6)) return { error: "السعر غير صالح" };
  if (p.desc.length < 5) return { error: "الوصف قصير" };
  if (!CATS.includes(p.cat)) return { error: "التصنيف غير صالح" };
  return { p };
}
app.get("/api/products", (q, r) => r.json(db.products));
app.post("/api/products", admin, productUp.single("image"), (req, res) => {
  const { p, error } = parseProduct(req.body);
  if (error) {
    if (req.file) rm(req.file.path);
    return res.status(400).json({ error });
  }
  const prod = {
    id: Math.max(0, ...db.products.map((x) => x.id)) + 1,
    ...p,
    img: req.file ? "/uploads/" + req.file.filename : "",
  };
  db.products.push(prod);
  save();
  res.status(201).json(prod);
});
app.put("/api/products/:id", admin, productUp.single("image"), (req, res) => {
  const prod = db.products.find((x) => x.id == req.params.id);
  if (!prod) {
    if (req.file) rm(req.file.path);
    return res.status(404).json({ error: "المنتج غير موجود" });
  }
  const { p, error } = parseProduct(req.body);
  if (error) {
    if (req.file) rm(req.file.path);
    return res.status(400).json({ error });
  }
  if (req.file) {
    if (prod.img) rm(path.join(__dirname, "public", prod.img));
    prod.img = "/uploads/" + req.file.filename;
  }
  Object.assign(prod, p);
  save();
  res.json(prod);
});
app.delete("/api/products/:id", admin, (req, res) => {
  const i = db.products.findIndex((x) => x.id == req.params.id);
  if (i < 0) return res.status(404).json({ error: "المنتج غير موجود" });
  const [p] = db.products.splice(i, 1);
  if (p.img) rm(path.join(__dirname, "public", p.img));
  save();
  res.json({ ok: true });
});

/* ---------- Orders ---------- */
app.post("/api/orders", designUp.any(), (req, res) => {
  const files = req.files || [],
    cleanup = () => files.forEach((f) => rm(f.path)),
    bad = (m) => {
      cleanup();
      return res.status(400).json({ error: m });
    };
  let o;
  try {
    o = JSON.parse(req.body.order);
  } catch {
    return bad("بيانات الطلب غير صالحة");
  }
  const name = String(o.name || "").trim(),
    phone = String(o.phone || "").trim(),
    addr = String(o.addr || "").trim(),
    note = String(o.note || "")
      .trim()
      .slice(0, 500);
  if (name.length < 3 || name.length > 80) return bad("الاسم غير صالح");
  if (!/^01[0-9]{9}$/.test(phone)) return bad("رقم الهاتف غير صالح");
  if (addr.length < 8 || addr.length > 300) return bad("العنوان غير صالح");
  if (!Array.isArray(o.items) || !o.items.length || o.items.length > 50)
    return bad("السلة فارغة");
  const items = [];
  for (const [idx, it] of o.items.entries()) {
    const p = db.products.find((x) => x.id == it.id),
      qty = parseInt(it.qty);
    if (!p || !p.avail) return bad("منتج غير متاح: " + (p ? p.name : it.id));
    if (!(qty >= 1 && qty <= 99)) return bad("كمية غير صالحة");
    const f = files.find((x) => x.fieldname === "design_" + idx);
    items.push({
      id: p.id,
      name: p.name + (it.custom ? " (مخصص)" : ""),
      price: p.price,
      qty, // السعر من السيرفر وليس العميل
      color: String(it.color || "").slice(0, 40),
      text: String(it.text || "").slice(0, 300),
      fileName: String(it.fileName || "").slice(0, 100),
      file: f ? f.filename : "",
    });
  }
  const order = {
    id: String(Math.max(1000, ...db.orders.map((x) => +x.id)) + 1),
    date: Date.now(),
    name,
    phone,
    addr,
    note,
    items,
    total: items.reduce((s, i) => s + i.price * i.qty, 0),
    status: STATUS[0],
  };
  db.orders.push(order);
  save();
  res.status(201).json(order);
});
app.get("/api/orders", admin, (q, r) => r.json(db.orders));
app.patch("/api/orders/:id", admin, (req, res) => {
  const o = db.orders.find((x) => x.id == req.params.id);
  if (!o) return res.status(404).json({ error: "الطلب غير موجود" });
  if (!STATUS.includes(req.body.status))
    return res.status(400).json({ error: "حالة غير صالحة" });
  o.status = req.body.status;
  save();
  res.json(o);
});
app.get("/api/designs/:file", admin, (req, res) => {
  const f = path.basename(req.params.file),
    full = path.join(DESIGNS, f);
  fs.existsSync(full)
    ? res.sendFile(full)
    : res.status(404).json({ error: "غير موجود" });
});

// ملفات الواجهة (index.html بره في الجذر)
app.use("/public", express.static(path.join(__dirname, "public")));
// الصور المرفوعة بتتطلب كـ /uploads/xxx
app.use("/uploads", express.static(UP));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});
app.use("/api", (q, r) => r.status(404).json({ error: "غير موجود" }));
app.use((err, q, res, n) =>
  res
    .status(400)
    .json({
      error:
        err.code === "LIMIT_FILE_SIZE"
          ? "حجم الصورة أكبر من 2MB"
          : err.message || "خطأ",
    }),
);
app.listen(PORT, () =>
  console.log(`Cupverse running at http://localhost:${PORT}`),
);
