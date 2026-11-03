# Cupverse – مجك عندنا

## التشغيل
1. npm install
2. npm start            (أو: ADMIN_PASSWORD=كلمتك npm start)
3. افتح http://localhost:3000   — لوحة الأدمن: http://localhost:3000/#admin

## تغيير رقم الواتساب
في أول ملف public/script.js غيّر WA_NUMBER (كود الدولة بدون +).

## الهيكل
server.js        السيرفر (Express + API)
package.json
public/          index.html + style.css + script.js + vendor (Bootstrap والخط والأيقونات محليًا)
data/            db.json وصور تصاميم العملاء (تتكوّن تلقائيًا)
public/uploads/  صور المنتجات (تتكوّن تلقائيًا)
