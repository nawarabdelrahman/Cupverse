"use strict";
 
const WA_NUMBER = "201032278620";  
const CATS = {
  mugs: ["مجات", "fa-mug-hot"],
  bottles: ["زمزميات", "fa-bottle-water"],
  wallets: ["محافظ", "fa-wallet"],
  custom: ["هدايا مخصصة", "fa-gift"],
};
const icon = (c) => `<i class="fa-solid ${CATS[c]?.[1] || "fa-gift"}"></i>`;
const STATUS = ["جديد", "قيد التنفيذ", "تم التسليم", "ملغي"];

 
const DB = {
  get: (k, d) => {
    try {
      return JSON.parse(localStorage.getItem("cv_" + k)) ?? d;
    } catch {
      return d;
    }
  },
  set: (k, v) => {
    try {
      localStorage.setItem("cv_" + k, JSON.stringify(v));
    } catch {}
  },
};
let PRODUCTS = [],
  ORDERS = [];
const FILES = {};
const products = () => PRODUCTS,
  orders = () => ORDERS,
  cart = () => DB.get("cart", []);
async function api(path, opt = {}) {
  const h = { ...(opt.headers || {}) },
    tk = sessionStorage.cv_token;
  if (tk) h.Authorization = "Bearer " + tk;
  if (opt.json) {
    h["Content-Type"] = "application/json";
    opt.body = JSON.stringify(opt.json);
  }
  const r = await fetch("/api" + path, { ...opt, headers: h });
  const d = await r.json().catch(() => ({}));
  if (r.status === 401 && tk) sessionStorage.removeItem("cv_token");
  if (!r.ok) throw new Error(d.error || "تعذر الاتصال بالسيرفر");
  return d;
}
const loadProducts = async () => {
  PRODUCTS = await api("/products");
};

/* ===== Helpers ===== */
const $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)];
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const egp = (n) => `${Number(n).toLocaleString("en")} EGP`;
function toast(msg, type = "success") {
  const el = document.createElement("div");
  el.className = `toast align-items-center text-bg-${type} border-0 show`;
  el.innerHTML = `<div class="d-flex"><div class="toast-body">${esc(msg)}</div></div>`;
  $("#toast-box").append(el);
  setTimeout(() => el.remove(), 2600);
}
function validate(form) {
  form.classList.add("was-validated");
  return form.checkValidity();
}
const readFile = (file, max = 400 * 1024) =>
  new Promise((res, rej) => {
    if (!file) return res("");
    if (file.size > max) return rej(new Error("حجم الصورة أكبر من 400KB"));
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(new Error("فشل قراءة الملف"));
    r.readAsDataURL(file);
  });
const thumb = (p) =>
  p.img
    ? `<img src="${p.img}" alt="${esc(p.name)}" loading="lazy">`
    : icon(p.cat);

/* ===== Product card ===== */
function card(p) {
  return `<div class="col-12 col-md-6 col-lg-4"><div class="cv-card p-card">
    <a href="#product/${p.id}" class="p-img text-decoration-none">${thumb(p)}</a>
    <div class="body">
      <h6 class="fw-bold mb-1">${esc(p.name)}</h6>
      <div class="price mb-1">${egp(p.price)}</div>
      <p class="small text-muted flex-grow-1">${esc(p.desc.slice(0, 60))}${p.desc.length > 60 ? "…" : ""}</p>
      ${p.avail ? "" : '<span class="badge bg-secondary mb-2">غير متوفر</span>'}
      <div class="d-flex gap-2"><a href="#product/${p.id}" class="btn btn-outline-secondary btn-sm flex-fill">التفاصيل</a>
      <button class="btn btn-cv btn-sm flex-fill" data-add="${p.id}" ${p.avail ? "" : "disabled"}>أضف للسلة</button></div>
    </div></div></div>`;
}

/* ===== Cart ===== */
function addToCart(item) {
  const c = cart();
  const key = [
    item.id,
    item.color || "",
    item.text || "",
    item.file?.slice(-20) || "",
  ].join("|");
  const ex = c.find((i) => i.key === key);
  if (ex) ex.qty += item.qty;
  else {
    const { fileObj, ...rest } = item;
    c.push({ ...rest, key });
  }
  if (item.fileObj) FILES[key] = item.fileObj;
  DB.set("cart", c);
  updateBadge();
  toast("تمت الإضافة إلى السلة");
}
function updateBadge() {
  const n = cart().reduce((s, i) => s + i.qty, 0);
  $$(".cart-count").forEach((e) => (e.textContent = n));
}
function renderCart() {
  const c = cart(),
    box = $("#cart-items");
  if (!c.length) {
    box.innerHTML =
      '<div class="cv-card p-4 text-center"><i class="fa-solid fa-cart-shopping fa-2x mb-2"></i><br>السلة فارغة<br><a href="#shop" class="btn btn-cv mt-3">تسوق الآن</a></div>';
  } else
    box.innerHTML = c
      .map(
        (i, idx) => `<div class="cv-card cart-row">
    <div class="thumb">${i.img ? `<img src="${i.img}" alt="">` : icon(i.cat)}</div>
    <div class="flex-grow-1 min-w-0"><b>${esc(i.name)}</b>
      <div class="small text-muted">${i.color ? "اللون: " + esc(i.color) + " · " : ""}${i.text ? "النص: " + esc(i.text) + " · " : ""}${i.fileName ? "ملف: " + esc(i.fileName) : ""}</div>
      <div class="price">${egp(i.price * i.qty)}</div></div>
    <input type="number" min="1" max="99" value="${i.qty}" class="form-control form-control-sm qty" data-qty="${idx}">
    <button class="btn btn-sm btn-outline-danger" data-del="${idx}"><i class="fa-solid fa-trash"></i></button></div>`,
      )
      .join("");
  $("#cart-total").textContent = egp(
    c.reduce((s, i) => s + i.price * i.qty, 0),
  );
}

/* ===== Views ===== */
function renderHome() {
  $("#cat-grid").innerHTML =
    Object.entries(CATS)
      .map(
        ([k, [n, e]]) =>
          `<div class="col-6 col-md"><a class="cv-card cat-card" href="#shop/${k}"><div class="em">${icon(k)}</div><b>${n}</b></a></div>`,
      )
      .join("") +
    `<div class="col-6 col-md"><a class="cv-card cat-card" href="#shop"><div class="em"><i class="fa-solid fa-layer-group"></i></div><b>جميع المنتجات</b></a></div>`;
  $("#home-products").innerHTML = products()
    .slice(-6)
    .reverse()
    .map(card)
    .join("");
}
let shopCat = "all";
function renderShop(arg) {
  if (arg !== undefined) shopCat = arg || "all";
  $("#shop-filters").innerHTML = [
    ["all", "الكل"],
    ...Object.entries(CATS).map(([k, v]) => [k, v[0]]),
  ]
    .map(
      ([k, n]) =>
        `<button class="chip ${k === shopCat ? "active" : ""}" data-cat="${k}">${n}</button>`,
    )
    .join("");
  const q = $("#shop-search").value.trim().toLowerCase();
  const list = products().filter(
    (p) =>
      (shopCat === "all" || p.cat === shopCat) &&
      p.name.toLowerCase().includes(q),
  );
  $("#shop-products").innerHTML =
    list.map(card).join("") ||
    '<p class="text-center text-muted">لا توجد منتجات.</p>';
}
function renderProduct(id) {
  const p = products().find((x) => x.id == id),
    box = $("#v-product");
  if (!p) {
    box.innerHTML =
      '<p class="text-center">المنتج غير موجود. <a href="#shop">العودة للمتجر</a></p>';
    return;
  }
  box.innerHTML = `<div class="row g-4"><div class="col-md-5"><div class="cv-card overflow-hidden"><div class="p-img" style="border-radius:0">${thumb(p)}</div></div></div>
  <div class="col-md-7"><h2 class="fw-bold">${esc(p.name)}</h2><div class="price fs-3">${egp(p.price)}</div>
  <span class="badge ${p.avail ? "bg-success" : "bg-secondary"} mb-2">${p.avail ? "متوفر" : "غير متوفر"}</span>
  <p>${esc(p.desc)}</p>
  <form id="pd-form" novalidate>
   ${p.colors.length ? `<div class="mb-3"><label class="form-label">اللون</label><div class="d-flex gap-2 flex-wrap" id="pd-colors">${p.colors.map((c, i) => `<button type="button" class="chip ${i ? "" : "active"}" data-color="${esc(c)}">${esc(c)}</button>`).join("")}</div></div>` : ""}
   <div class="mb-3"><label class="form-label">الكمية</label><input id="pd-qty" type="number" min="1" max="99" value="1" class="form-control" style="max-width:120px" required></div>
   <div class="mb-3"><label class="form-label">الاسم / النص المطلوب طباعته (اختياري)</label><input id="pd-text" class="form-control" maxlength="60"></div>
   <div class="mb-3"><label class="form-label">ارفع صورة أو تصميم (اختياري)</label><input id="pd-file" type="file" accept="image/*" class="form-control"></div>
   <button class="btn btn-cv btn-lg" ${p.avail ? "" : "disabled"}><i class="fa-solid fa-cart-plus"></i> إضافة للسلة</button>
  </form></div></div>`;
  let color = p.colors[0] || "";
  $("#pd-colors")?.addEventListener("click", (e) => {
    const b = e.target.closest("[data-color]");
    if (!b) return;
    color = b.dataset.color;
    $$("#pd-colors .chip").forEach((x) =>
      x.classList.toggle("active", x === b),
    );
  });
  $("#pd-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const qty = parseInt($("#pd-qty").value);
    if (!(qty >= 1 && qty <= 99)) return toast("الكمية بين 1 و 99", "danger");
    const f = $("#pd-file").files[0];
    addToCart({
      id: p.id,
      name: p.name,
      price: p.price,
      cat: p.cat,
      img: p.img.length < 5e4 ? p.img : "",
      qty,
      color,
      text: $("#pd-text").value.trim(),
      fileName: f ? f.name : "",
      file: f ? f.name + f.size : "",
      fileObj: f,
    });
  });
}
function renderCustom() {
  $("#cu-prod").innerHTML = products()
    .filter((p) => p.avail)
    .map(
      (p) =>
        `<option value="${p.id}">${esc(p.name)} – ${egp(p.price)}</option>`,
    )
    .join("");
}

/* ===== Admin ===== */
let admTab = "dash",
  editId = null,
  admCat = "all",
  admQ = "";
async function renderAdmin() {
  const box = $("#v-admin");
  if (!sessionStorage.cv_token) {
    box.innerHTML = `<div class="container py-5"><form id="login" class="cv-card p-4 mx-auto" style="max-width:380px" novalidate>
      <h4 class="text-center mb-3">دخول الأدمن</h4><input id="ad-pass" type="password" class="form-control mb-2" placeholder="كلمة السر" required>
      <div class="invalid-feedback">أدخل كلمة السر</div><button class="btn btn-cv w-100 mt-2">دخول</button>
      <a href="#home" class="d-block text-center"><i class="fa-solid fa-arrow-right"></i> المتجر</a></form></div>`;
    return;
  }
  try {
    await loadProducts();
    if (admTab === "dash" || admTab === "orders") ORDERS = await api("/orders");
  } catch (err) {
    if (!sessionStorage.cv_token) {
      toast("انتهت الجلسة", "danger");
      return renderAdmin();
    }
    toast(err.message, "danger");
  }
  const P = products(),
    O = orders();
  const nav =
    [
      ["dash", "fa-gauge", "Dashboard"],
      ["list", "fa-box", "إدارة المنتجات"],
      ["form", "fa-circle-plus", editId ? "تعديل منتج" : "إضافة منتج جديد"],
      ["orders", "fa-receipt", "إدارة الطلبات"],
    ]
      .map(
        ([k, i, n]) =>
          `<button data-tab="${k}" class="${admTab === k ? "active" : ""}"><i class="fa-solid ${i}"></i> ${n}</button>`,
      )
      .join("") +
    '<button data-tab="logout"><i class="fa-solid fa-right-from-bracket"></i> تسجيل الخروج</button>';
  let body = "";
  if (admTab === "dash") {
    const sales = O.filter((o) => o.status !== "ملغي").reduce(
      (s, o) => s + o.total,
      0,
    );
    body = `<h4 class="mb-3">الإحصائيات</h4><div class="row g-3">${[
      ["إجمالي المنتجات", P.length],
      ["إجمالي الطلبات", O.length],
      ["المنتجات المتاحة", P.filter((p) => p.avail).length],
      ["إجمالي المبيعات", egp(sales)],
    ]
      .map(
        ([n, v]) =>
          `<div class="col-6 col-lg-3"><div class="cv-card stat"><b>${v}</b>${n}</div></div>`,
      )
      .join("")}</div>`;
  }
  if (admTab === "list") {
    const L = P.filter(
      (p) =>
        (admCat === "all" || p.cat === admCat) &&
        p.name.toLowerCase().includes(admQ.toLowerCase()),
    );
    body = `<h4 class="mb-3">إدارة المنتجات</h4><div class="row g-2 mb-3"><div class="col-sm-6"><input id="ad-q" class="form-control" placeholder="بحث بالاسم" value="${esc(admQ)}"></div>
      <div class="col-sm-6"><select id="ad-cat" class="form-select"><option value="all">كل التصنيفات</option>${Object.entries(
        CATS,
      )
        .map(
          ([k, v]) =>
            `<option value="${k}" ${admCat === k ? "selected" : ""}>${v[0]}</option>`,
        )
        .join("")}</select></div></div>
      <div class="cv-card p-2 tbl-wrap"><table class="table align-middle mb-0"><thead><tr><th>صورة</th><th>الاسم</th><th>السعر</th><th>التصنيف</th><th>الحالة</th><th></th></tr></thead><tbody>
      ${
        L.map(
          (
            p,
          ) => `<tr><td><span class="tbl-img">${p.img ? `<img src="${p.img}" class="tbl-img" alt="">` : icon(p.cat)}</span></td><td>${esc(p.name)}</td><td>${egp(p.price)}</td><td>${CATS[p.cat]?.[0] || ""}</td>
      <td><span class="badge ${p.avail ? "bg-success" : "bg-secondary"}">${p.avail ? "متوفر" : "نفد"}</span></td>
      <td class="text-nowrap"><button class="btn btn-sm btn-outline-primary" data-edit="${p.id}"><i class="fa-solid fa-pen"></i></button> <button class="btn btn-sm btn-outline-danger" data-pdel="${p.id}"><i class="fa-solid fa-trash"></i></button></td></tr>`,
        ).join("") ||
        '<tr><td colspan="6" class="text-center text-muted">لا نتائج</td></tr>'
      }</tbody></table></div>`;
  }
  if (admTab === "form") {
    const p = editId ? P.find((x) => x.id === editId) : null;
    body = `<h4 class="mb-3">${p ? "تعديل منتج" : "إضافة منتج جديد"}</h4><form id="pform" class="cv-card p-4" style="max-width:640px" novalidate>
      <div class="mb-3"><label class="form-label">اسم المنتج</label><input id="f-name" class="form-control" required minlength="2" value="${esc(p?.name)}"><div class="invalid-feedback">الاسم مطلوب</div></div>
      <div class="mb-3"><label class="form-label">صورة المنتج ${p?.img ? "(اتركها فارغة للإبقاء على الحالية)" : ""}</label><input id="f-img" type="file" accept="image/*" class="form-control"></div>
      <div class="row"><div class="col-6 mb-3"><label class="form-label">السعر (EGP)</label><input id="f-price" type="number" min="1" step="1" class="form-control" required value="${p?.price ?? ""}"><div class="invalid-feedback">سعر صحيح مطلوب</div></div>
      <div class="col-6 mb-3"><label class="form-label">التصنيف</label><select id="f-cat" class="form-select">${Object.entries(
        CATS,
      )
        .map(
          ([k, v]) =>
            `<option value="${k}" ${p?.cat === k ? "selected" : ""}>${v[0]}</option>`,
        )
        .join("")}</select></div></div>
      <div class="mb-3"><label class="form-label">الوصف</label><textarea id="f-desc" rows="3" class="form-control" required minlength="5">${esc(p?.desc)}</textarea><div class="invalid-feedback">الوصف مطلوب</div></div>
      <div class="mb-3"><label class="form-label">الألوان (مفصولة بفاصلة)</label><input id="f-colors" class="form-control" value="${esc(p?.colors.join("، "))}"></div>
      <div class="mb-3"><label class="form-label">الحالة</label><select id="f-avail" class="form-select"><option value="1" ${p && !p.avail ? "" : "selected"}>Available</option><option value="0" ${p && !p.avail ? "selected" : ""}>Out of Stock</option></select></div>
      <button class="btn btn-cv">${p ? "حفظ التعديلات" : "Add Product"}</button> ${p ? '<button type="button" class="btn btn-light" data-tab="list">إلغاء</button>' : ""}</form>`;
  }
  if (admTab === "orders") {
    body = `<h4 class="mb-3">الطلبات</h4>${
      O.length
        ? O.slice()
            .reverse()
            .map(
              (
                o,
              ) => `<div class="cv-card p-3 mb-3"><div class="d-flex flex-wrap justify-content-between gap-2"><b>#${o.id} – ${esc(o.name)}</b><span>${new Date(o.date).toLocaleString("ar-EG")}</span></div>
      <div class="small"><i class="fa-solid fa-phone"></i> ${esc(o.phone)} · <i class="fa-solid fa-location-dot"></i> ${esc(o.addr)}</div><ul class="small my-2">${o.items.map((i) => `<li>${esc(i.name)} ×${i.qty}${i.color ? " (" + esc(i.color) + ")" : ""}${i.text ? ' – "' + esc(i.text) + '"' : ""}${i.file ? ` <a href="/api/designs/${esc(i.file)}?token=${sessionStorage.cv_token}" target="_blank"><i class="fa-solid fa-paperclip"></i> التصميم</a>` : ""}</li>`).join("")}</ul>
      ${o.note ? `<div class="small text-muted">ملاحظات: ${esc(o.note)}</div>` : ""}
      <div class="d-flex justify-content-between align-items-center mt-2"><b class="price">${egp(o.total)}</b><select class="form-select form-select-sm w-auto" data-ostatus="${o.id}">${STATUS.map((s) => `<option ${s === o.status ? "selected" : ""}>${s}</option>`).join("")}</select></div></div>`,
            )
            .join("")
        : '<p class="text-muted">لا توجد طلبات بعد.</p>'
    }`;
  }
  box.innerHTML = `<div class="adm"><aside class="adm-side"><div class="brand text-white mb-3 px-2">Cupverse Admin</div>${nav}<button onclick="location.hash='home'"><i class="fa-solid fa-shop"></i> المتجر</button></aside><div class="adm-main">${body}</div></div>`;
}

/* ===== Router ===== */
function route() {
  const [v = "home", arg] = (location.hash.slice(1) || "home").split("/");
  const view = $("#v-" + v) ? v : "home";
  $$(".view").forEach((s) =>
    s.classList.toggle("active", s.id === "v-" + view),
  );
  $$(".nav-link").forEach((a) =>
    a.classList.toggle("active", a.getAttribute("href") === "#" + view),
  );
  const adm = view === "admin";
  $("#main-nav").style.display = $("#main-footer").style.display = adm
    ? "none"
    : "";
  (
    ({
      home: renderHome,
      shop: () => renderShop(arg),
      product: () => renderProduct(arg),
      cart: renderCart,
      custom: renderCustom,
      admin: renderAdmin,
    })[view] || (() => {})
  )();
  window.scrollTo(0, 0);
  window.bootstrap?.Collapse.getInstance($("#nv"))?.hide();
}

/* ===== Events ===== */
document.addEventListener("click", (e) => {
  const t = e.target;
  let el;
  if ((el = t.closest("[data-add]"))) {
    const p = products().find((x) => x.id == el.dataset.add);
    addToCart({
      id: p.id,
      name: p.name,
      price: p.price,
      cat: p.cat,
      img: p.img.length < 5e4 ? p.img : "",
      qty: 1,
      color: p.colors[0] || "",
      text: "",
      fileName: "",
      file: "",
    });
  } else if ((el = t.closest("[data-cat]"))) {
    shopCat = el.dataset.cat;
    renderShop();
  } else if ((el = t.closest("[data-del]"))) {
    const c = cart();
    c.splice(+el.dataset.del, 1);
    DB.set("cart", c);
    updateBadge();
    renderCart();
  } else if ((el = t.closest("[data-tab]"))) {
    if (el.dataset.tab === "logout") {
      sessionStorage.removeItem("cv_token");
    } else {
      admTab = el.dataset.tab;
      if (admTab !== "form") editId = null;
    }
    renderAdmin();
  } else if ((el = t.closest("[data-edit]"))) {
    editId = +el.dataset.edit;
    admTab = "form";
    renderAdmin();
  } else if ((el = t.closest("[data-pdel]"))) {
    if (confirm("حذف هذا المنتج؟"))
      api("/products/" + el.dataset.pdel, { method: "DELETE" })
        .then(() => {
          toast("تم الحذف");
          renderAdmin();
        })
        .catch((er) => toast(er.message, "danger"));
  }
});
document.addEventListener("change", (e) => {
  const t = e.target;
  if (t.dataset.qty !== undefined) {
    const c = cart(),
      q = parseInt(t.value);
    if (q >= 1 && q <= 99) {
      c[+t.dataset.qty].qty = q;
      DB.set("cart", c);
    }
    renderCart();
    updateBadge();
  }
  if (t.dataset.ostatus) {
    api("/orders/" + t.dataset.ostatus, {
      method: "PATCH",
      json: { status: t.value },
    })
      .then(() => toast("تم تحديث الحالة"))
      .catch((er) => toast(er.message, "danger"));
  }
  if (t.id === "ad-cat") {
    admCat = t.value;
    renderAdmin();
  }
});
document.addEventListener("input", (e) => {
  if (e.target.id === "shop-search") renderShop();
  if (e.target.id === "ad-q") {
    admQ = e.target.value;
    const pos = e.target.selectionStart;
    renderAdmin();
    const q = $("#ad-q");
    q.focus();
    q.setSelectionRange(pos, pos);
  }
});
document.addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target;
  if (f.id === "login") {
    try {
      const d = await api("/admin/login", {
        method: "POST",
        json: { password: $("#ad-pass").value },
      });
      sessionStorage.cv_token = d.token;
      renderAdmin();
    } catch (er) {
      toast(er.message, "danger");
    }
  } else if (f.id === "contact-form") {
    if (!validate(f)) return;
    window.open(
      `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(`من: ${$("#ct-name").value}\n${$("#ct-msg").value}`)}`,
      "_blank",
    );
    f.reset();
    f.classList.remove("was-validated");
  } else if (f.id === "custom-form") {
    if (!validate(f)) return;
    const p = products().find((x) => x.id == $("#cu-prod").value),
      file = $("#cu-file").files[0];
    addToCart({
      custom: true,
      id: p.id,
      name: p.name + " (مخصص)",
      price: p.price,
      cat: p.cat,
      img: "",
      qty: 1,
      color: "",
      text: $("#cu-text").value.trim() + " | " + $("#cu-note").value.trim(),
      fileName: file ? file.name : "",
      file: file ? file.name + file.size : "",
      fileObj: file,
    });
    f.reset();
    f.classList.remove("was-validated");
  } else if (f.id === "order-form") {
    const c = cart();
    if (!c.length) return toast("السلة فارغة", "danger");
    if (!validate(f)) return;
    const fd = new FormData();
    fd.append(
      "order",
      JSON.stringify({
        name: $("#o-name").value.trim(),
        phone: $("#o-phone").value.trim(),
        addr: $("#o-addr").value.trim(),
        note: $("#o-note").value.trim(),
        items: c.map(({ id, qty, color, text, custom, fileName }) => ({
          id,
          qty,
          color,
          text,
          custom: !!custom,
          fileName,
        })),
      }),
    );
    c.forEach((i, idx) => {
      if (FILES[i.key]) fd.append("design_" + idx, FILES[i.key]);
    });
    let o;
    try {
      o = await api("/orders", { method: "POST", body: fd });
    } catch (er) {
      return toast(er.message, "danger");
    }
    const total = o.total;
    const msg =
      `طلب جديد #${o.id} – Cupverse\n\n` +
      o.items
        .map(
          (i) =>
            `• ${i.name} ×${i.qty} = ${egp(i.price * i.qty)}${i.color ? "\n  اللون: " + i.color : ""}${i.text ? "\n  النص: " + i.text : ""}${i.fileName ? "\n  ملف مرفق: " + i.fileName + " (مرفوع للسيرفر)" : ""}`,
        )
        .join("\n") +
      `\n\nالإجمالي: ${egp(total)}\n\nالاسم: ${o.name}\nالهاتف: ${o.phone}\nالعنوان: ${o.addr}${o.note ? "\nملاحظات: " + o.note : ""}`;
    DB.set("cart", []);
    updateBadge();
    f.reset();
    f.classList.remove("was-validated");
    renderCart();
    window.open(
      `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`,
      "_blank",
    );
    toast("تم تسجيل طلبك");
  } else if (f.id === "pform") {
    if (!validate(f)) return;
    const p = editId ? products().find((x) => x.id === editId) : null,
      fd = new FormData();
    fd.append("name", $("#f-name").value.trim());
    fd.append("price", $("#f-price").value);
    fd.append("cat", $("#f-cat").value);
    fd.append("desc", $("#f-desc").value.trim());
    fd.append("colors", $("#f-colors").value);
    fd.append("avail", $("#f-avail").value);
    const im = $("#f-img").files[0];
    if (im) {
      if (im.size > 2 * 1024 * 1024)
        return toast("الصورة أكبر من 2MB", "danger");
      fd.append("image", im);
    }
    try {
      await api(editId ? "/products/" + editId : "/products", {
        method: editId ? "PUT" : "POST",
        body: fd,
      });
    } catch (er) {
      return toast(er.message, "danger");
    }
    toast(p ? "تم حفظ التعديلات" : "تمت إضافة المنتج");
    editId = null;
    admTab = "list";
    renderAdmin();
  }
});
window.addEventListener("hashchange", route);
loadProducts()
  .catch(() => toast("تعذر الاتصال بالسيرفر", "danger"))
  .finally(() => {
    updateBadge();
    route();
  });
