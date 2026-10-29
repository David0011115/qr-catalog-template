/**
 * ПРЕДЛОЖЕНИЯ ТОВАРОВ (отдельный файл в Apps Script: «Предложения»)
 * Принимает заявки из формы «Предложить товар» на сайте и складывает их в лист «Предложения».
 *
 * Установка (один раз):
 *   1. Расширения → Apps Script → «+» → Скрипт, назвать «Предложения», вставить этот код, сохранить.
 *   2. Выбрать функцию setupSuggestions → ▶ Выполнить → разрешить доступ (создаст лист «Предложения»).
 *   3. Развернуть → Новое развёртывание → тип «Веб-приложение»:
 *        «Выполнять от имени» — Я;  «У кого есть доступ» — Все.  Нажать «Развернуть», разрешить доступ.
 *   4. Скопировать «URL веб-приложения» (заканчивается на /exec) и прислать Claude: он вставит его в config.js (SUGGEST_URL).
 *   После правок кода: Развернуть → Управление развёртываниями → ✎ → «Новая версия» (URL останется тем же).
 *
 * Защита от спама (без капчи): сайт не отправляет заявку, если заполнено скрытое поле, и не пускает чаще 1 раза в минуту
 * и 3 раз в сутки с одного устройства. Здесь дополнительно: слишком быстрая отправка (меньше 1,5 с), ссылки в тексте,
 * повтор того же текста за сутки и общий лимит заявок в сутки.
 */
const SG_SHEET = "Предложения";
const SG_NOTIFY_EMAIL = "";   // кому слать письмо о новой заявке; пусто = письма не отправляются (адрес уточняем у владельца)
const SG_DAY_LIMIT = 40;      // максимум заявок в сутки на весь сайт
const SG_TZ = "Asia/Almaty";
const SG_HEAD = ["Дата и время", "Предложение", "Контакт", "Язык", "Статус", "Заметка"];
const SG_STATUSES = ["Новое", "Принято", "Отклонено", "Добавлено"];

/** Запустить ОДИН РАЗ вручную: создаёт лист «Предложения» с заголовком и списком статусов. */
function setupSuggestions() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(SG_SHEET);
  if (!sh) sh = ss.insertSheet(SG_SHEET);
  sh.getRange(1, 1, 1, SG_HEAD.length).setValues([SG_HEAD]).setFontWeight("bold").setBackground("#e6f3f6");
  sh.setFrozenRows(1);
  sh.setColumnWidth(1, 130); sh.setColumnWidth(2, 280); sh.setColumnWidth(3, 170);
  sh.setColumnWidth(4, 60); sh.setColumnWidth(5, 110); sh.setColumnWidth(6, 240);
  const rule = SpreadsheetApp.newDataValidation().requireValueInList(SG_STATUSES, true).setAllowInvalid(false).build();
  sh.getRange(2, 5, 1000, 1).setDataValidation(rule);
  sh.getRange(2, 2, 1000, 2).setWrap(true);
}

/** Принимает заявку с сайта. Всегда отвечает «ok», чтобы бот не подбирал обход; причина отказа — в поле reason. */
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const data = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    const name = sgClean_(data.name, 80);
    const contact = sgClean_(data.contact, 60);
    const lang = data.lang === "kk" ? "kk" : "ru";
    const ms = Number(data.ms) || 0;

    if (name.length < 3) return sgReply_("short");
    if (ms < 1500) return sgReply_("fast");
    if (/https?:\/\/|www\.|\.(com|ru|kz|net|org|xyz)\b/i.test(name + " " + contact)) return sgReply_("link");

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

    // текстовый формат, чтобы «=1+1» или «+7…» не превращались в формулу или число
    const row = last + 1;
    sh.getRange(row, 1, 1, SG_HEAD.length).setNumberFormat("@").setValues([[stamp, name, contact, lang, "Новое", ""]]);

    if (SG_NOTIFY_EMAIL) {
      try {
        MailApp.sendEmail(SG_NOTIFY_EMAIL, "[" + ss.getName() + "] Новое предложение товара",
          "Предложили: " + name + (contact ? "\nКонтакт: " + contact : "") + "\n\nЛист «" + SG_SHEET + "»: " + ss.getUrl());
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

// Убирает переносы и лишние пробелы, режет по длине.
function sgClean_(v, max) {
  return String(v == null ? "" : v).replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim().slice(0, max);
}

function sgReply_(reason) {
  return ContentService.createTextOutput(JSON.stringify({ ok: reason === "ok" || reason === "alive", reason: reason }))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Проверка вручную: добавляет тестовую заявку (потом удалите строку). */
function testSuggestion() {
  const r = doPost({ postData: { contents: JSON.stringify({ name: "Тест: онигири с угрём", contact: "", lang: "ru", ms: 5000 }) } });
  Logger.log(r.getContent());
}
