/**
 * GOOGLE APPS SCRIPT — Backend "Ghi nhận sản xuất"
 *
 * Sheet cần 4 tab (chạy setupSheets() lần đầu để tự tạo):
 *   KetQua            — nơi ghi dữ liệu
 *   DanhSachNhanVien  — cột A: Tên người phụ trách
 *   MA_MAY            — cột A: Mã, B: Tên, C: Ghi chú
 *   MA_CN             — cột A: Mã, B: Tên, C: Ghi chú
 */

var SHEET_DATA  = "KetQua";
var SHEET_NAMES = "DanhSachNhanVien";
var SHEET_MAY   = "MA_MAY";
var SHEET_CN    = "MA_CN";

var HEADERS = [
  "Thời gian", "Người ghi nhận",
  "Mã Máy", "Tên Máy",
  "Mã Công nhân", "Tên Công nhân",
  "Mã Sản phẩm", "LSX", "Số lượng", "Đơn vị tính", "KL (QR)",
  "KL thực tế (kg)",
  "Ghi chú"
];

/**
 * Chạy 1 lần để tạo 4 tab đúng định dạng.
 */
function setupSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // KetQua
  var data = ss.getSheetByName(SHEET_DATA) || ss.insertSheet(SHEET_DATA);
  if (data.getLastRow() === 0) {
    data.appendRow(HEADERS);
    data.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold").setBackground("#d1fae5");
    data.setFrozenRows(1);
    data.autoResizeColumns(1, HEADERS.length);
  }

  // DanhSachNhanVien
  var names = ss.getSheetByName(SHEET_NAMES) || ss.insertSheet(SHEET_NAMES);
  if (names.getLastRow() === 0) {
    names.appendRow(["Tên hiển thị"]);
    names.getRange(1, 1).setFontWeight("bold").setBackground("#d1fae5");
    names.setFrozenRows(1);
    names.setColumnWidth(1, 220);
  }

  // MA_MAY
  var may = ss.getSheetByName(SHEET_MAY) || ss.insertSheet(SHEET_MAY);
  if (may.getLastRow() === 0) {
    may.appendRow(["Mã", "Tên", "Ghi chú"]);
    may.getRange(1, 1, 1, 3).setFontWeight("bold").setBackground("#dbeafe");
    may.setFrozenRows(1);
    may.setColumnWidths(1, 3, [130, 220, 220]);
  }

  // MA_CN
  var cn = ss.getSheetByName(SHEET_CN) || ss.insertSheet(SHEET_CN);
  if (cn.getLastRow() === 0) {
    cn.appendRow(["Mã", "Tên", "Ghi chú"]);
    cn.getRange(1, 1, 1, 3).setFontWeight("bold").setBackground("#fce7f3");
    cn.setFrozenRows(1);
    cn.setColumnWidths(1, 3, [130, 220, 220]);
  }

  // Xóa tab mặc định trống nếu còn
  ss.getSheets().forEach(function(sh) {
    var nm = sh.getName();
    var known = [SHEET_DATA, SHEET_NAMES, SHEET_MAY, SHEET_CN];
    if (known.indexOf(nm) === -1 && sh.getLastRow() === 0 && ss.getSheets().length > 4) {
      ss.deleteSheet(sh);
    }
  });

  SpreadsheetApp.getActiveSpreadsheet().toast(
    "Đã tạo xong 4 tab: KetQua, DanhSachNhanVien, MA_MAY, MA_CN"
  );
}

/* ── doGet: trả danh sách theo action ─────────────────────────── */
function doGet(e) {
  try {
    var action = (e && e.parameter && e.parameter.action) || "names";
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    if (action === "machines") {
      return reply(e, { result: "ok", machines: getMasterList(ss, SHEET_MAY) });
    }
    if (action === "workers") {
      return reply(e, { result: "ok", workers: getMasterList(ss, SHEET_CN) });
    }

    // default: action=names
    var sh = ss.getSheetByName(SHEET_NAMES);
    var names = [];
    if (sh && sh.getLastRow() > 1) {
      var vals = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues();
      names = vals.map(function(r) { return String(r[0]).trim(); }).filter(Boolean);
    }
    return reply(e, { result: "ok", names: names });

  } catch(err) {
    return reply(e, { result: "error", error: String(err) });
  }
}

/** Đọc danh sách Mã/Tên/GhiChú từ 1 tab master. */
function getMasterList(ss, sheetName) {
  var sh = ss.getSheetByName(sheetName);
  if (!sh || sh.getLastRow() <= 1) return [];
  var data = sh.getRange(2, 1, sh.getLastRow() - 1, 3).getValues();
  return data
    .filter(function(r) { return String(r[0]).trim(); })
    .map(function(r) {
      return {
        ma:     String(r[0]).trim(),
        ten:    String(r[1] || "").trim(),
        ghiChu: String(r[2] || "").trim()
      };
    });
}

/* ── doPost: ghi dữ liệu vào KetQua ──────────────────────────── */
function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var rows = body.rows || [];
    if (!rows.length) return json({ result: "ok", inserted: 0 });

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName(SHEET_DATA);
    if (!sh) sh = ss.insertSheet(SHEET_DATA);

    if (sh.getLastRow() === 0) {
      sh.appendRow(HEADERS);
      sh.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
      sh.setFrozenRows(1);
    }

    var out = rows.map(function(r) {
      var p = splitProduct(r.sp);
      return [
        formatTime(r.ts),
        r.user   || body.user || "",
        r.may    || "",
        r.mayTen || "",
        r.cn     || "",
        r.cnTen  || "",
        r.sp     || "",
        p[0], p[1], p[2], p[3],
        r.kl     || "",
        r.note   || ""
      ];
    });

    sh.getRange(sh.getLastRow() + 1, 1, out.length, HEADERS.length).setValues(out);
    SpreadsheetApp.flush();
    return json({ result: "ok", inserted: out.length });

  } catch(err) {
    return json({ result: "error", error: String(err) });
  }
}

/* ── helpers ──────────────────────────────────────────────────── */
function splitProduct(sp) {
  var parts = String(sp || "").split("/");
  return [parts[0]||"", parts[1]||"", parts[2]||"", parts[3]||""];
}

function formatTime(ts) {
  try {
    var d = ts ? new Date(ts) : new Date();
    return Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
  } catch(e) { return ts || ""; }
}

function reply(e, obj) {
  var s = JSON.stringify(obj);
  var cb = e && e.parameter && e.parameter.callback;
  if (cb) {
    return ContentService.createTextOutput(cb+"("+s+");")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(s).setMimeType(ContentService.MimeType.JSON);
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
