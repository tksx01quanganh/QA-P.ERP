/**
 * Code_XuatHang.gs - Backend cho chuc nang Doi chieu Xuat hang
 *
 * Google Sheet nay can 3 tab:
 *   DN_LSX    : DN | Khach hang | LSX | So luong
 *   DN_ScanLog: SessionID | DN | LSX | Noi dung QR | So luong | KL lien ket | Thoi gian | Nguoi thuc hien
 *   DN_KetQua : DN | LSX | SL yeu cau | SL thuc te | Trang thai | Tong KL | Thoi gian | Nguoi thuc hien
 *
 * Lien ket voi Sheet Ket qua SX (KetQua tab) de lay KL thuc te.
 * Khi submit: match LSX + SL, danh dau cot P = ma DN, cot Q = ngay hoan thanh.
 *
 * Deploy: Web App - Anyone (even anonymous) - Execute as Me
 */

var TAB_DN   = "DN_LSX";
var TAB_LOG  = "DN_ScanLog";
var TAB_KQ   = "DN_KetQua";

// Sheet Ket qua San xuat (de link KL)
var SX_SHEET_ID = "1YWLrhDMTN4c4evLzFar6CKZXu0uuJeRXPrb8lB6a9nk";
var SX_TAB_NAME = "KetQua";

var DN_HEADERS  = ["DN", "Khach hang", "LSX", "So luong"];
var LOG_HEADERS = ["SessionID", "DN", "LSX", "Noi dung QR", "So luong", "KL lien ket", "Thoi gian", "Nguoi thuc hien"];
var KQ_HEADERS  = ["DN", "LSX", "SL yeu cau", "SL thuc te", "Trang thai", "Tong KL", "Thoi gian", "Nguoi thuc hien"];

// ═══════════════════════════════════════════════════════════
// SETUP
// ═══════════════════════════════════════════════════════════

function setupXuatHang() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var dn = ss.getSheetByName(TAB_DN) || ss.insertSheet(TAB_DN);
  if (dn.getLastRow() === 0) {
    dn.appendRow(DN_HEADERS);
    dn.getRange(1, 1, 1, DN_HEADERS.length).setFontWeight("bold").setBackground("#dbeafe");
    dn.setFrozenRows(1);
  }

  var log = ss.getSheetByName(TAB_LOG) || ss.insertSheet(TAB_LOG);
  if (log.getLastRow() === 0) {
    log.appendRow(LOG_HEADERS);
    log.getRange(1, 1, 1, LOG_HEADERS.length).setFontWeight("bold").setBackground("#fef3c7");
    log.setFrozenRows(1);
  }

  var kq = ss.getSheetByName(TAB_KQ) || ss.insertSheet(TAB_KQ);
  if (kq.getLastRow() === 0) {
    kq.appendRow(KQ_HEADERS);
    kq.getRange(1, 1, 1, KQ_HEADERS.length).setFontWeight("bold").setBackground("#d1fae5");
    kq.setFrozenRows(1);
  }

  ss.toast("Da tao/cap nhat 3 tab: " + TAB_DN + ", " + TAB_LOG + ", " + TAB_KQ);
}

// ═══════════════════════════════════════════════════════════
// HTTP - doGet
// ═══════════════════════════════════════════════════════════

function doGet(e) {
  try {
    var action = (e && e.parameter && e.parameter.action) || "";
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (action === "version") return json_({ result: "ok", version: "2.1" });
    if (action === "dnlist") return json_(getDnList_(ss));
    if (action === "dndetail") {
      var dn = String(e.parameter.dn || "").trim();
      if (!dn) return json_({ result: "error", error: "Thieu ma DN" });
      return json_(getDnDetail_(ss, dn));
    }
    return json_({ result: "error", error: "action khong hop le: " + action });
  } catch (err) {
    return json_({ result: "error", error: String(err) });
  }
}

// ═══════════════════════════════════════════════════════════
// HTTP - doPost
// ═══════════════════════════════════════════════════════════

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    if (body.action === "submit") return json_(submitResult_(body));
    return json_({ result: "error", error: "action khong hop le" });
  } catch (err) {
    return json_({ result: "error", error: String(err) });
  }
}

// ═══════════════════════════════════════════════════════════
// DOC DU LIEU
// ═══════════════════════════════════════════════════════════

function getDnList_(ss) {
  var sh = ss.getSheetByName(TAB_DN);
  if (!sh || sh.getLastRow() <= 1) return { result: "ok", list: [] };
  var data = sh.getRange(2, 1, sh.getLastRow() - 1, 4).getValues();
  var map = {};
  for (var i = 0; i < data.length; i++) {
    var dn = String(data[i][0]).trim();
    if (!dn) continue;
    if (!map[dn]) map[dn] = { dn: dn, kh: String(data[i][1]).trim(), soLSX: 0 };
    map[dn].soLSX++;
  }
  var list = [];
  for (var k in map) list.push(map[k]);
  list.sort(function(a, b) { return b.dn.localeCompare(a.dn); });
  return { result: "ok", list: list };
}

function getDnDetail_(ss, dnCode) {
  var dnSh = ss.getSheetByName(TAB_DN);
  if (!dnSh || dnSh.getLastRow() <= 1) return { result: "error", error: "Tab " + TAB_DN + " trong" };
  var dnData = dnSh.getRange(2, 1, dnSh.getLastRow() - 1, 4).getValues();
  var items = [];
  var kh = "";
  for (var i = 0; i < dnData.length; i++) {
    if (String(dnData[i][0]).trim() !== dnCode) continue;
    if (!kh) kh = String(dnData[i][1]).trim();
    items.push({
      lsx: String(dnData[i][2]).trim(),
      slYC: parseFloat(dnData[i][3]) || 0,
      slDone: 0
    });
  }
  if (items.length === 0) return { result: "error", error: "Khong tim thay DN: " + dnCode };

  // Doc DN_ScanLog de tinh tien do da gui truoc do
  var logSh = ss.getSheetByName(TAB_LOG);
  if (logSh && logSh.getLastRow() > 1) {
    var logData = logSh.getRange(2, 1, logSh.getLastRow() - 1, 5).getValues();
    for (var j = 0; j < logData.length; j++) {
      if (String(logData[j][1]).trim() !== dnCode) continue;
      var logLSX = String(logData[j][2]).trim();
      var logSL = parseFloat(logData[j][4]) || 0;
      for (var k = 0; k < items.length; k++) {
        if (items[k].lsx === logLSX) {
          items[k].slDone += logSL;
          break;
        }
      }
    }
  }
  return { result: "ok", dn: dnCode, kh: kh, items: items };
}

// ═══════════════════════════════════════════════════════════
// SUBMIT KET QUA
// ═══════════════════════════════════════════════════════════

function submitResult_(body) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var timeStr = body.time || formatTime_(new Date().toISOString());
  var userName = String(body.user || "");
  var dnCode = String(body.dn || "");
  var sessionId = String(body.sessionId || "");

  var scanRows = body.scanRows || [];
  var summary = body.summary || [];

  // --- 1. Link KL tu Sheet Ket qua SX ---
  var klMap = {};  // key = "LSX|SL" -> [{rowIdx, kl}]  (da match)
  var klLinked = {}; // scanIndex -> kl value
  try {
    klMap = linkKLFromSX_(dnCode, scanRows, timeStr);
    // klMap: scanIndex -> kl
    klLinked = klMap;
  } catch (ex) {
    // Khong link duoc KL thi van ghi scan log binh thuong
    Logger.log("Link KL error: " + ex);
  }

  // --- 2. Ghi scan log ---
  if (scanRows.length > 0) {
    var logSh = ss.getSheetByName(TAB_LOG);
    if (!logSh) {
      logSh = ss.insertSheet(TAB_LOG);
      logSh.appendRow(LOG_HEADERS);
      logSh.getRange(1, 1, 1, LOG_HEADERS.length).setFontWeight("bold");
      logSh.setFrozenRows(1);
    }
    var logOut = [];
    for (var i = 0; i < scanRows.length; i++) {
      var r = scanRows[i];
      logOut.push([
        sessionId,
        dnCode,
        String(r.lsx || ""),
        String(r.qr || ""),
        parseFloat(r.sl) || 0,
        klLinked[i] || "",   // KL lien ket
        r.time || timeStr,
        userName
      ]);
    }
    logSh.getRange(logSh.getLastRow() + 1, 1, logOut.length, LOG_HEADERS.length).setValues(logOut);
  }

  // --- 3. Ghi ket qua tong hop ---
  if (summary.length > 0) {
    // Tinh tong KL da link theo LSX
    var klByLSX = {};
    for (var si = 0; si < scanRows.length; si++) {
      var sLsx = String(scanRows[si].lsx || "");
      if (klLinked[si]) {
        klByLSX[sLsx] = (klByLSX[sLsx] || 0) + (parseFloat(klLinked[si]) || 0);
      }
    }

    var kqSh = ss.getSheetByName(TAB_KQ);
    if (!kqSh) {
      kqSh = ss.insertSheet(TAB_KQ);
      kqSh.appendRow(KQ_HEADERS);
      kqSh.getRange(1, 1, 1, KQ_HEADERS.length).setFontWeight("bold");
      kqSh.setFrozenRows(1);
    }
    var kqOut = [];
    for (var j = 0; j < summary.length; j++) {
      var s = summary[j];
      var slYC = parseFloat(s.slYC) || 0;
      var slTT = parseFloat(s.slThucTe) || 0;
      var trangThai = "Thieu";
      if (slTT >= slYC) trangThai = "Du";
      if (slTT > slYC) trangThai = "Vuot";
      var tongKL = klByLSX[String(s.lsx || "")] || "";
      kqOut.push([dnCode, String(s.lsx || ""), slYC, slTT, trangThai, tongKL, timeStr, userName]);
    }
    kqSh.getRange(kqSh.getLastRow() + 1, 1, kqOut.length, KQ_HEADERS.length).setValues(kqOut);
  }

  SpreadsheetApp.flush();
  return { result: "ok", scans: scanRows.length, summaries: summary.length };
}

// ═══════════════════════════════════════════════════════════
// LINK KL TU SHEET KET QUA SX
// ═══════════════════════════════════════════════════════════

/**
 * Voi moi scan row (LSX + SL), tim dong dau tien chua dung trong tab KetQua
 * cua Sheet SX (cung LSX o cot H, cung SL o cot I, cot P trong).
 * Neu tim thay: ghi DN vao cot P, ngay vao cot Q, lay KL thuc te tu cot L.
 *
 * Tra ve object: { scanIndex: klValue }
 */
function linkKLFromSX_(dnCode, scanRows, timeStr) {
  if (!scanRows || scanRows.length === 0) return {};
  if (!SX_SHEET_ID) return {};

  var sxSS = SpreadsheetApp.openById(SX_SHEET_ID);
  var sxSh = sxSS.getSheetByName(SX_TAB_NAME);
  if (!sxSh || sxSh.getLastRow() <= 1) return {};

  var lastRow = sxSh.getLastRow();
  var lastCol = sxSh.getLastColumn();
  // Ensure at least 17 columns (Q = col 17)
  if (lastCol < 17) {
    sxSh.insertColumnsAfter(lastCol, 17 - lastCol);
    lastCol = 17;
  }

  // Doc cot H(8), I(9), L(12), P(16) — chi doc cot can thiet
  // Doc toan bo data 1 lan de tranh nhieu getRange
  var allData = sxSh.getRange(2, 1, lastRow - 1, 17).getValues();

  // Index: cot H=7, I=8, L=11, P=15, Q=16 (0-based)
  var COL_LSX = 7;
  var COL_SL  = 8;
  var COL_KL  = 11;
  var COL_DN  = 15;
  var COL_DATE = 16;

  var result = {};
  var usedRows = {};  // rowIndex -> true (danh dau da dung trong phien nay)

  for (var si = 0; si < scanRows.length; si++) {
    var scanLSX = String(scanRows[si].lsx || "").trim();
    var scanSL = parseFloat(scanRows[si].sl) || 0;
    if (!scanLSX || scanSL <= 0) continue;

    // Tim dong dau tien match va chua dung
    for (var ri = 0; ri < allData.length; ri++) {
      if (usedRows[ri]) continue;  // da dung trong phien nay
      var rowLSX = String(allData[ri][COL_LSX]).trim();
      var rowSL = parseFloat(allData[ri][COL_SL]) || 0;
      var rowDN = String(allData[ri][COL_DN] || "").trim();

      if (rowLSX === scanLSX && rowSL === scanSL && rowDN === "") {
        // Match! Lay KL va danh dau
        var klVal = parseFloat(allData[ri][COL_KL]) || 0;
        result[si] = klVal;
        usedRows[ri] = true;

        // Ghi DN vao cot P, ngay vao cot Q (row index = ri + 2 vi header + 0-based)
        var sheetRow = ri + 2;
        sxSh.getRange(sheetRow, 16).setValue(dnCode);       // cot P
        sxSh.getRange(sheetRow, 17).setValue(timeStr);       // cot Q
        break;
      }
    }
  }

  return result;
}

// ═══════════════════════════════════════════════════════════
// HELPER
// ═══════════════════════════════════════════════════════════

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function formatTime_(iso) {
  try {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    var dd = ("0" + d.getDate()).slice(-2);
    var mm = ("0" + (d.getMonth() + 1)).slice(-2);
    var yy = d.getFullYear();
    var hh = ("0" + d.getHours()).slice(-2);
    var mi = ("0" + d.getMinutes()).slice(-2);
    var sc = ("0" + d.getSeconds()).slice(-2);
    return dd + "/" + mm + "/" + yy + " " + hh + ":" + mi + ":" + sc;
  } catch (e) { return iso; }
}
