/**
 * ПРЕДЛОЖЕНИЯ ТОВАРОВ (отдельный файл в Apps Script: «Предложения»), версия 2: с фото
 * Принимает заявки из формы «Предложить товар» на сайте: текст, где видели / поставщик, контакт и до 3 фото.
 * Текст попадает в лист «Предложения», фото — в папку «Mol Mart» → «Предложения — фото» на Google Диске (в таблице ссылки).
 *
 * Установка (один раз):
 *   1. Расширения → Apps Script → «+» → Скрипт, назвать «Предложения», вставить этот код, сохранить.
 *   2. Выбрать функцию setupSuggestions → ▶ Выполнить → разрешить доступ (создаст лист и папку на Диске).
 *   3. Развернуть → Новое развёртывание → тип «Веб-приложение»:
 *        «Выполнять от имени» — Я;  «У кого есть доступ» — Все.  Нажать «Развернуть», разрешить доступ.
 *   4. Скопировать «URL веб-приложения» (заканчивается на /exec) и прислать Claude: он вставит его в config.js (SUGGEST_URL).
 *   После правок кода: Развернуть → Управление развёртываниями → ✎ → «Новая версия» (URL останется тем же).
 *
 * Защита от спама (без капчи): сайт не отправляет заявку, если заполнено скрытое поле, и не пускает чаще 1 раза в минуту
 * и 3 раз в сутки с одного устройства. Здесь дополнительно: слишком быстрая отправка (меньше 1,5 с), ссылки в тексте,
 * повтор того же текста за сутки, общий лимит заявок в сутки. Фото принимаются только JPEG, не больше SG_MAX_PHOTOS штук
 * и ограниченного размера (сайт сам сжимает их до ~1000 px).
 */
const SG_SHEET = "Предложения";
const SG_ROOT_FOLDER = "Mol Mart";            // общая папка проекта на Диске; пусто = создавать в корне «Мой диск»
const SG_FOLDER_NAME = "Предложения — фото";
const SG_VIEWER_EMAIL = "";   // кому дать просмотр папки с фото (например, владелице магазина); пусто = видит только владелец файла
const SG_NOTIFY_EMAIL = "";   // кому слать письмо о новой заявке; пусто = письма не отправляются (адрес уточняем у владельца)
const SG_DAY_LIMIT = 40;      // максимум заявок в сутки на весь сайт
const SG_MAX_PHOTOS = 3;      // сколько фото принимаем в одной заявке
const SG_MAX_B64 = 900000;    // максимум размера одного фото (символов base64, это около 650 КБ)
const SG_TZ = "Asia/Almaty";
const SG_HEAD = ["Дата и время", "Предложение", "Где видели / поставщик", "Контакт", "Фото", "Язык", "Статус", "Заметка"];
const SG_STATUSES = ["Новое", "Принято", "Отклонено", "Добавлено"];

/** Запустить ОДИН РАЗ вручную: создаёт лист «Предложения» (заголовок, статусы) и папку для фото на Диске. */
function setupSuggestions() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(SG_SHEET);
  if (!sh) sh = ss.insertSheet(SG_SHEET);
  sh.getRange(1, 1, 1, SG_HEAD.length).setValues([SG_HEAD]).setFontWeight("bold").setBackground("#e6f3f6");
  sh.setFrozenRows(1);
  const widths = [130, 240, 220, 150, 260, 60, 110, 220];
  widths.forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
  const rule = SpreadsheetApp.newDataValidation().requireValueInList(SG_STATUSES, true).setAllowInvalid(false).build();
  sh.getRange(2, 7, 1000, 1).setDataValidation(rule);
  sh.getRange(2, 2, 1000, 4).setWrap(true);
  sgFolder_();
}

/** Принимает заявку с сайта. Всегда отвечает JSON; причина отказа — в поле reason (для проверки вручную). */
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const data = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    const name = sgClean_(data.name, 80);
    const where = sgClean_(data.where, 120);
    const contact = sgClean_(data.contact, 60);
    const lang = data.lang === "kk" ? "kk" : "ru";
    const ms = Number(data.ms) || 0;

    if (name.length < 3) return sgReply_("short");
    if (ms < 1500) return sgReply_("fast");
    if (/https?:\/\/|www\.|\.(com|ru|kz|net|org|xyz)\b/i.test(name + " " + where + " " + contact)) return sgReply_("link");

    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName(SG_SHEET);
    if (!sh) return sgReply_("nosheet");

    const now = new Date();
    const today = Utilities.formatDate(now, SG_TZ, "dd.MM.yyyy");
    const stamp = Utilities.formatDate(now, SG_TZ, "dd.MM.yyyy HH:mm");

    // смотрим последние 200 заявок: общий лимит за сутки и повтор того же текста
    const last = sh.getLastRow();
    const from = Math.max(2, last - 199);
    const rows = last >= 2 ? sh.getRange(from, 1, last - from + 1, 2).getDisplayValues() : [];
    const key = name.toLowerCase();
    let todayCount = 0;
    for (let i = 0; i < rows.length; i++) {
      if (String(rows[i][0]).indexOf(today) === 0) {
        todayCount++;
        if (String(rows[i][1]).toLowerCase() === key) return sgReply_("dup");
      }
    }
    if (todayCount >= SG_DAY_LIMIT) return sgReply_("limit");

    // фото: только JPEG ограниченного размера, не больше SG_MAX_PHOTOS; сбой фото не мешает принять текст
    let links = [];
    try { links = sgSaveImages_(data.images, now); } catch (imgErr) {}

    // текстовый формат, чтобы «=1+1» или «+7…» не превращались в формулу или число
    const row = last + 1;
    sh.getRange(row, 1, 1, SG_HEAD.length).setNumberFormat("@")
      .setValues([[stamp, name, where, contact, links.join("\n"), lang, "Новое", ""]]);

    if (SG_NOTIFY_EMAIL) {
      try {
        MailApp.sendEmail(SG_NOTIFY_EMAIL, "[" + ss.getName() + "] Новое предложение товара",
          "Предложили: " + name + (where ? "\nГде видели / поставщик: " + where : "") + (contact ? "\nКонтакт: " + contact : "") +
          (links.length ? "\nФото: " + links.length : "") + "\n\nЛист «" + SG_SHEET + "»: " + ss.getUrl());
      } catch (mailErr) {}
    }
    return sgReply_("ok");
  } catch (err) {
    return sgReply_("error");
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}

/** Открытие адреса в браузере: просто проверка, что веб-приложение работает. */
function doGet() { return sgReply_("alive"); }

// Сохраняет фото в папку на Диске, возвращает ссылки. Пропускает всё, что не JPEG или слишком большое.
function sgSaveImages_(images, now) {
  const urls = [];
  if (!Array.isArray(images) || !images.length) return urls;
  const folder = sgFolder_();
  const tag = Utilities.formatDate(now, SG_TZ, "yyyy-MM-dd_HHmmss");
  images.slice(0, SG_MAX_PHOTOS).forEach(function (raw, i) {
    const b64 = String(raw || "").replace(/^data:image\/jpeg;base64,/, "");
    if (b64.length < 100 || b64.length > SG_MAX_B64) return;
    if (b64.indexOf("/9j/") !== 0) return;               // начало JPEG-файла в base64
    const blob = Utilities.newBlob(Utilities.base64Decode(b64), "image/jpeg", tag + "_" + (i + 1) + ".jpg");
    urls.push(folder.createFile(blob).getUrl());
  });
  return urls;
}

// Папка для фото «Предложения — фото» внутри общей папки SG_ROOT_FOLDER (находит или создаёт);
// при создании даёт просмотр SG_VIEWER_EMAIL.
function sgFolder_() {
  let parent = null;
  if (SG_ROOT_FOLDER) {
    const pit = DriveApp.getFoldersByName(SG_ROOT_FOLDER);
    parent = pit.hasNext() ? pit.next() : DriveApp.createFolder(SG_ROOT_FOLDER);
  }
  const it = parent ? parent.getFoldersByName(SG_FOLDER_NAME) : DriveApp.getFoldersByName(SG_FOLDER_NAME);
  if (it.hasNext()) return it.next();
  const folder = parent ? parent.createFolder(SG_FOLDER_NAME) : DriveApp.createFolder(SG_FOLDER_NAME);
  if (SG_VIEWER_EMAIL) { try { folder.addViewer(SG_VIEWER_EMAIL); } catch (e) {} }
  return folder;
}

// Убирает переносы и лишние пробелы, режет по длине.
function sgClean_(v, max) {
  return String(v == null ? "" : v).replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim().slice(0, max);
}

function sgReply_(reason) {
  return ContentService.createTextOutput(JSON.stringify({ ok: reason === "ok" || reason === "alive", reason: reason }))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Проверка вручную: добавляет тестовую заявку без фото (потом удалите строку). */
function testSuggestion() {
  const r = doPost({ postData: { contents: JSON.stringify({ name: "Тест: онигири с угрём", where: "тест", contact: "", lang: "ru", ms: 5000 }) } });
  Logger.log(r.getContent());
}
