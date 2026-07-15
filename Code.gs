/**
 * QA-P.ERP — Google Apps Script Backend
 * Phiên bản: 2.6 (11/07/2026)
 * - GanVaiTro thêm cột D "Apply from", E "Apply to", F "Trạng thái": mỗi dòng gán vai trò
 *   có khoảng hiệu lực riêng — getPermissions_ chỉ nhận dòng đang hiệu lực (ô trống = không giới hạn).
 *   Đổi vai trò theo kế hoạch: thêm dòng mới với Apply from, đóng Apply to dòng cũ (giữ lịch sử).
 * - Hỗ trợ chức năng theo nhánh: ChucNang cột URL dùng "index.html?branch=CT" / "index.html?branch=GTB"
 *   (VD mã PD_A01 / PD_A02) → app vào thẳng nhánh theo phân quyền.
 * - v2.5: orderSearch LSX mới nhất trước; teamDaily cây Tổ → Máy → LSX + lsxCount
 * - MA_MAY, MA_CN chuyển sang MASTER SHEET (chạy migrateMayCN() 1 lần để copy).
 *   Nếu Master chưa có/còn trống → tự fallback đọc tab cũ ở Sheet SX (không gián đoạn).
 * - MA_CN thêm cột D "Work station" (CAT/TCO/GTB), E "Apply from", F "Apply to":
 *   backend chỉ trả công nhân đang hiệu lực (from ≤ hôm nay ≤ to; ô trống = không giới hạn).
 * - v2.2: MA_MAY cột D Work station; KL tiến độ = cột K; endpoint teamDaily.
 *
 * Sheet SX       : KetQua (thuần dữ liệu giao dịch)
 * Master Sheet   : NhanVien, VaiTro, ChucNang, Quyen, GanVaiTro, PhanQuyen + MA_MAY, MA_CN
 * Order List     : DATA COMBINE (sheet riêng)
 */

// ═══════════════════════════════════════════════════════════
// 1. CẤU HÌNH — Sửa tại đây khi cần
// ═══════════════════════════════════════════════════════════

var MASTER_SHEET_ID    = "1nd0WmT5dMZU1_ylAwrC4yIr1RhitzO28hnzvBO_JZzs";
var ORDERLIST_SHEET_ID = "1Ty0O9f5HWdvyKvv_MmJjkOBX1aS0ufbH";
var ORDERLIST_TAB      = "DATA COMBINE";

// Tab names — Sheet dữ liệu SX
var SHEET_DATA  = "KetQua";
var SHEET_NAMES = "DanhSachNhanVien";
var SHEET_MAY   = "MA_MAY";
var SHEET_CN    = "MA_CN";

var HEADERS = [
  "Thời gian", "Người ghi nhận",
  "Mã Máy", "Tên Máy",
  "Mã Công nhân", "Tên Công nhân",
  "Mã Sản phẩm", "LSX", "Số lượng", "Đơn vị tính", "KL (QR)",
  "KL thực tế (kg)", "Ghi chú", "ID"
];

var ID_COL = 14; // cột N: ID tuần tự, duy nhất

// Mapping cột Order List — tên header CHÍNH XÁC trong sheet DATA COMBINE
// ⚠ Nếu header sheet khác tên → chỉ sửa giá trị bên phải
var OL = {
  ngaygiao:  "Ngày yêu cầu giao hàng",   // A
  lsx:       "LSX",                         // B
  lsxct:     "LSX CT",                      // C
  masp:      "Mã sản phẩm",                // D
  mota:      "Mô tả sản phẩm",             // E
  dvt:       "Đơn vị tính",                // G
  soluong:   "Số lượng đặt hàng",          // K
  khachhang: "Khách hàng"                   // N
};

// 6 loại quyền RBAC (độc lập, không xếp bậc)
var QUYEN_CODES = [
  { ma: "V", ten: "Xem",       mota: "Chỉ đọc, không thao tác" },
  { ma: "C", ten: "Tạo",       mota: "Tạo mới / nhập liệu" },
  { ma: "E", ten: "Sửa",       mota: "Chỉnh sửa dữ liệu đã tạo" },
  { ma: "R", ten: "Kiểm tra",  mota: "Xác nhận / review" },
  { ma: "A", ten: "Phê duyệt", mota: "Ký duyệt chính thức" },
  { ma: "D", ten: "Xóa",       mota: "Xóa dữ liệu" }
];

// Cache duration (giây)
var CACHE_KQ   = 900;   // 15 phút — aggregation KetQua
var CACHE_OL   = 1800;  // 30 phút — Order List
var CACHE_CUST = 1800;  // 30 phút — danh sách khách hàng
var CACHE_TD   = 300;   // 5 phút  — tổng hợp Tổ/Ngày (dữ liệu trong ngày thay đổi liên tục)

// ═══════════════════════════════════════════════════════════
// 2. SETUP — Sheet SX (4 tab) — chạy 1 lần
// ═══════════════════════════════════════════════════════════

function setupSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var data = ss.getSheetByName(SHEET_DATA) || ss.insertSheet(SHEET_DATA);
  if (data.getLastRow() === 0) {
    data.appendRow(HEADERS);
    data.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold").setBackground("#d1fae5");
    data.setFrozenRows(1);
    data.autoResizeColumns(1, HEADERS.length);
  }

  // Từ v2.3: Sheet SX CHỈ còn tab KetQua.
  // DanhSachNhanVien → Master (tab NhanVien); MA_MAY, MA_CN → Master (chạy migrateMayCN()).

  ss.toast("Đã tạo xong tab KetQua. Máy/Công nhân quản lý ở Master Sheet (chạy migrateMayCN() nếu chưa chuyển).");
}

/**
 * CHẠY 1 LẦN (v2.3): copy tab MA_MAY, MA_CN từ Sheet SX sang Master Sheet.
 * - MA_MAY ở Master: cột A-D (Mã, Tên, Ghi chú, Work station)
 * - MA_CN  ở Master: cột A-F (Mã, Tên, Ghi chú, Work station, Apply from, Apply to)
 * - Nếu tab ở Master ĐÃ có dữ liệu → bỏ qua tab đó (không ghi đè).
 * Sau khi chạy xong + kiểm tra app OK → có thể xóa tay 2 tab cũ ở Sheet SX.
 */
function migrateMayCN() {
  var sx = SpreadsheetApp.getActiveSpreadsheet();
  var master = SpreadsheetApp.openById(MASTER_SHEET_ID);

  copyMasterTab_(sx, master, SHEET_MAY,
    ["Mã", "Tên", "Ghi chú", "Work station"], "#dbeafe");
  copyMasterTab_(sx, master, SHEET_CN,
    ["Mã", "Tên", "Ghi chú", "Work station", "Apply from", "Apply to"], "#fce7f3");

  Logger.log("Xong. Kiểm tra 2 tab MA_MAY, MA_CN trong Master Sheet, điền Work station cho công nhân, rồi test app trước khi xóa tab cũ ở Sheet SX.");
}

/** Copy 1 tab danh mục sang Master: tạo header chuẩn + đổ dữ liệu cũ (pad cột thiếu) */
function copyMasterTab_(srcSS, dstSS, name, headers, color) {
  var dst = dstSS.getSheetByName(name) || dstSS.insertSheet(name);
  if (dst.getLastRow() > 1) {
    Logger.log(name + " ở Master đã có dữ liệu — BỎ QUA (không ghi đè).");
    return;
  }
  dst.clear();
  dst.getRange(1, 1, 1, headers.length).setValues([headers])
     .setFontWeight("bold").setBackground(color);
  dst.setFrozenRows(1);

  var src = srcSS.getSheetByName(name);
  if (src && src.getLastRow() > 1) {
    var nCols = Math.min(src.getLastColumn(), headers.length);
    var data = src.getRange(2, 1, src.getLastRow() - 1, nCols).getValues();
    var rows = [];
    for (var i = 0; i < data.length; i++) {
      if (!String(data[i][0]).trim()) continue;
      var row = [];
      for (var c = 0; c < headers.length; c++) row.push(c < nCols ? data[i][c] : "");
      rows.push(row);
    }
    if (rows.length) dst.getRange(2, 1, rows.length, headers.length).setValues(rows);
    Logger.log(name + ": đã copy " + rows.length + " dòng sang Master.");
  } else {
    Logger.log(name + ": Sheet SX không có dữ liệu — chỉ tạo header ở Master.");
  }
}

// ═══════════════════════════════════════════════════════════
// 3. SETUP — Master Sheet RBAC (6 tab)
// ═══════════════════════════════════════════════════════════

function setupMasterSheet() {
  var ss = SpreadsheetApp.openById(MASTER_SHEET_ID);

  // Tab 1: NhanVien
  var nv = ss.getSheetByName("NhanVien") || ss.insertSheet("NhanVien");
  if (nv.getLastRow() === 0) {
    nv.appendRow(["Mã NV", "Tên nhân viên", "Username", "Mật khẩu", "Trạng thái"]);
    nv.getRange(1, 1, 1, 5).setFontWeight("bold").setBackground("#dbeafe");
    nv.setFrozenRows(1);
  }

  // Tab 2: VaiTro
  var vt = ss.getSheetByName("VaiTro") || ss.insertSheet("VaiTro");
  if (vt.getLastRow() === 0) {
    vt.appendRow(["Mã vai trò", "Tên vai trò", "Mô tả"]);
    vt.getRange(1, 1, 1, 3).setFontWeight("bold").setBackground("#fef3c7");
    vt.setFrozenRows(1);
  }

  // Tab 3: ChucNang (catalog chức năng)
  var cnTab = ss.getSheetByName("ChucNang") || ss.insertSheet("ChucNang");
  if (cnTab.getLastRow() === 0) {
    cnTab.appendRow(["Mã CN", "Mã module", "Tên chức năng", "URL"]);
    cnTab.getRange(1, 1, 1, 4).setFontWeight("bold").setBackground("#e0e7ff");
    cnTab.setFrozenRows(1);
    cnTab.getRange(2, 1, 3, 4).setValues([
      ["PD_GNSX", "PD", "Ghi nhận sản xuất", "index.html"],
      ["PD_TDDH", "PD", "Tra cứu tiến độ đơn hàng", "tien-do.html"],
      ["WH_DCXH", "WH", "Đối chiếu xuất hàng", "xuat-hang.html"]
    ]);
  }

  // Tab 4: Quyen (bảng tham chiếu)
  var q = ss.getSheetByName("Quyen") || ss.insertSheet("Quyen");
  if (q.getLastRow() === 0) {
    q.appendRow(["Mã quyền", "Tên", "Mô tả"]);
    q.getRange(1, 1, 1, 3).setFontWeight("bold").setBackground("#fce7f3");
    q.setFrozenRows(1);
    var qData = QUYEN_CODES.map(function(c) { return [c.ma, c.ten, c.mota]; });
    q.getRange(2, 1, qData.length, 3).setValues(qData);
  }

  // Tab 5: GanVaiTro — v2.6 có thêm D=Apply from, E=Apply to, F=Trạng thái (mỗi dòng gán 1 khoảng hiệu lực)
  var gvt = ss.getSheetByName("GanVaiTro") || ss.insertSheet("GanVaiTro");
  if (gvt.getLastRow() === 0) {
    gvt.appendRow(["Mã NV", "Tên NV", "Mã vai trò", "Apply from", "Apply to", "Trạng thái"]);
    gvt.getRange(1, 1, 1, 6).setFontWeight("bold").setBackground("#d1fae5");
    gvt.setFrozenRows(1);
  } else if (String(gvt.getRange(1, 4).getValue()).trim() === "") {
    // Sheet cũ 3 cột → bổ sung header D/E/F (ô trống = không giới hạn, tương thích ngược)
    gvt.getRange(1, 4, 1, 3).setValues([["Apply from", "Apply to", "Trạng thái"]])
       .setFontWeight("bold").setBackground("#d1fae5");
  }

  // Tab 6: PhanQuyen (ma trận 1/0)
  var pq = ss.getSheetByName("PhanQuyen") || ss.insertSheet("PhanQuyen");
  var pqHeaders = ["Mã vai trò", "Mã chức năng",
    "V-Xem", "C-Tạo", "E-Sửa", "R-Kiểm tra", "A-Phê duyệt", "D-Xóa",
    "Trạng thái"];
  var pqIsNew   = (pq.getLastRow() === 0);
  var pqIsEmpty = (pq.getLastRow() <= 1);

  // Xóa data validations cũ (tránh lỗi khi ghi)
  pq.getRange(1, 1, pq.getMaxRows(), pq.getMaxColumns()).clearDataValidations();

  if (pqIsNew || pqIsEmpty) {
    pq.clear();
    pq.appendRow(pqHeaders);
    pq.getRange(1, 1, 1, pqHeaders.length).setFontWeight("bold").setBackground("#fef9c3");
    pq.setFrozenRows(1);
    writeSamplePhanQuyen_(pq);
  } else {
    // Kiểm tra cần migrate không (format cũ → 9 cột 1/0)
    var currentHeaders = pq.getRange(1, 1, 1, pq.getLastColumn()).getValues()[0];
    if (currentHeaders.length < 9 || String(currentHeaders[2]).indexOf("V-") !== 0) {
      migratePhanQuyenToMatrix_(pq, pqHeaders);
    }
  }

  // Xóa tab mặc định trống — GIỮ cả MA_MAY, MA_CN (master data từ v2.3)
  var known = ["NhanVien", "VaiTro", "ChucNang", "Quyen", "GanVaiTro", "PhanQuyen", SHEET_MAY, SHEET_CN];
  ss.getSheets().forEach(function(sh) {
    if (known.indexOf(sh.getName()) === -1 && sh.getLastRow() === 0 && ss.getSheets().length > 6) {
      try { ss.deleteSheet(sh); } catch(e) {}
    }
  });

  ss.toast("Đã tạo/cập nhật 6 tab RBAC");
}

/** Ghi 8 dòng mẫu vào PhanQuyen */
function writeSamplePhanQuyen_(pq) {
  var sample = [
    ["NV_SX",  "PD_GNSX", "1","1","0","0","0","0", "Active"],
    ["NV_SX",  "PD_TDDH", "1","0","0","0","0","0", "Active"],
    ["TP_SX",  "PD_GNSX", "1","0","0","1","0","0", "Active"],
    ["TP_SX",  "PD_TDDH", "1","0","0","1","0","0", "Active"],
    ["GD",     "PD_GNSX", "1","0","0","0","1","0", "Active"],
    ["GD",     "PD_TDDH", "1","0","0","0","1","0", "Active"],
    ["ADMIN",  "PD_GNSX", "1","1","1","1","1","1", "Active"],
    ["ADMIN",  "PD_TDDH", "1","1","1","1","1","1", "Active"]
  ];
  pq.getRange(2, 1, sample.length, 9).setValues(sample);
}

/** Migrate PhanQuyen format cũ (text) sang format 1/0 */
function migratePhanQuyenToMatrix_(pq, newHeaders) {
  var lastRow = pq.getLastRow();
  var oldData = lastRow > 1 ? pq.getRange(2, 1, lastRow - 1, pq.getLastColumn()).getValues() : [];

  pq.getRange(1, 1, pq.getMaxRows(), pq.getMaxColumns()).clearDataValidations();
  pq.clear();
  pq.appendRow(newHeaders);
  pq.getRange(1, 1, 1, newHeaders.length).setFontWeight("bold").setBackground("#fef9c3");
  pq.setFrozenRows(1);

  if (oldData.length === 0) { writeSamplePhanQuyen_(pq); return; }

  var newRows = [];
  for (var i = 0; i < oldData.length; i++) {
    var r = oldData[i];
    var vaiTro = String(r[0] || "").trim();
    var maCN   = String(r[1] || "").trim();
    if (!vaiTro || !maCN) continue;

    if (r.length >= 9 && (String(r[2]) === "1" || String(r[2]) === "0")) {
      newRows.push([vaiTro, maCN,
        String(r[2]||"0"), String(r[3]||"0"), String(r[4]||"0"),
        String(r[5]||"0"), String(r[6]||"0"), String(r[7]||"0"),
        String(r[8] || "Active")]);
    } else {
      var perms = {};
      for (var j = 2; j < r.length; j++) {
        var val = String(r[j] || "").trim();
        if (val) perms[val] = true;
      }
      newRows.push([vaiTro, maCN,
        perms["Xem"]||perms["V"] ? "1":"0",
        perms["Tao"]||perms["Tạo"]||perms["C"] ? "1":"0",
        perms["Sua"]||perms["Sửa"]||perms["E"] ? "1":"0",
        perms["KiemTra"]||perms["Kiểm tra"]||perms["R"] ? "1":"0",
        perms["PheDuyet"]||perms["Phê duyệt"]||perms["A"] ? "1":"0",
        perms["Xoa"]||perms["Xóa"]||perms["D"] ? "1":"0",
        "Active"]);
    }
  }

  if (newRows.length > 0) {
    pq.getRange(2, 1, newRows.length, 9).setValues(newRows);
  } else {
    writeSamplePhanQuyen_(pq);
  }
}

// ═══════════════════════════════════════════════════════════
// 4. HTTP — doGet
// ═══════════════════════════════════════════════════════════

function doGet(e) {
  try {
    var action = (e && e.parameter && e.parameter.action) || "names";
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    switch (action) {
      case "version":
        return reply_(e, { result: "ok", version: "2.6", timestamp: "2026-07-11" });

      case "machines":
        return reply_(e, { result: "ok", machines: getMachines_() });

      case "workers":
        return reply_(e, { result: "ok", workers: getWorkers_() });

      case "orderCustomers":
        return reply_(e, { result: "ok", customers: getOrderCustomers_() });

      case "orderSearch":
        var customer = String(e.parameter.customer || "").trim();
        var q        = String(e.parameter.q || "").trim();
        return reply_(e, orderSearch_(ss, customer, q));

      case "teamDaily":
        var from = String(e.parameter.from || "").trim();
        var to   = String(e.parameter.to   || "").trim();
        return reply_(e, getTeamDaily_(ss, from, to));

      default:
        var sh = ss.getSheetByName(SHEET_NAMES);
        var namesList = [];
        if (sh && sh.getLastRow() > 1) {
          namesList = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues()
            .map(function(r) { return String(r[0]).trim(); })
            .filter(Boolean);
        }
        return reply_(e, { result: "ok", names: namesList });
    }
  } catch (err) {
    return reply_(e, { result: "error", error: String(err) });
  }
}

/** Đọc danh sách Mã/Tên/GhiChú/Work station (cột A-D) từ 1 tab. */
function getMasterList_(ss, sheetName) {
  var sh = ss.getSheetByName(sheetName);
  if (!sh || sh.getLastRow() <= 1) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, 4).getValues()
    .filter(function(r) { return String(r[0]).trim(); })
    .map(function(r) {
      return {
        ma: String(r[0]).trim(), ten: String(r[1]||"").trim(),
        ghiChu: String(r[2]||"").trim(), ws: String(r[3]||"").trim().toUpperCase()
      };
    });
}

/** Mở Master Sheet (null nếu lỗi) */
function masterSS_() {
  try { return SpreadsheetApp.openById(MASTER_SHEET_ID); } catch(e) { return null; }
}

/** Danh sách MÁY: ưu tiên tab MA_MAY ở Master, fallback tab cũ ở Sheet SX */
function getMachines_() {
  var m = masterSS_();
  if (m) {
    var list = getMasterList_(m, SHEET_MAY);
    if (list.length) return list;
  }
  return getMasterList_(SpreadsheetApp.getActiveSpreadsheet(), SHEET_MAY);
}

/**
 * Danh sách CÔNG NHÂN: ưu tiên tab MA_CN ở Master (cột A-F),
 * chỉ trả dòng ĐANG HIỆU LỰC: Apply from (E) ≤ hôm nay ≤ Apply to (F).
 * Ô E/F trống = không giới hạn. Fallback tab cũ ở Sheet SX (không có hiệu lực).
 */
function getWorkers_() {
  var m = masterSS_();
  if (m) {
    var sh = m.getSheetByName(SHEET_CN);
    if (sh && sh.getLastRow() > 1) {
      var now = new Date();
      var data = sh.getRange(2, 1, sh.getLastRow() - 1, 6).getValues();
      var out = [];
      for (var i = 0; i < data.length; i++) {
        var r = data[i];
        var ma = String(r[0]).trim();
        if (!ma) continue;
        var from = coerceDate_(r[4]);
        var to   = coerceDate_(r[5]);
        if (from && now.getTime() < from.getTime()) continue;                    // chưa đến ngày áp dụng
        if (to   && now.getTime() > to.getTime() + 86399999) continue;           // đã hết hiệu lực (hết ngày to)
        out.push({
          ma: ma, ten: String(r[1]||"").trim(),
          ghiChu: String(r[2]||"").trim(), ws: String(r[3]||"").trim().toUpperCase()
        });
      }
      if (out.length) return out;
    }
  }
  return getMasterList_(SpreadsheetApp.getActiveSpreadsheet(), SHEET_CN);
}

/** Ép giá trị ô thành Date 00:00 (chấp nhận Date, "dd/mm/yyyy", "yyyy-mm-dd"). Trống/sai → null */
function coerceDate_(v) {
  if (v instanceof Date && !isNaN(v.getTime())) {
    return new Date(v.getFullYear(), v.getMonth(), v.getDate(), 0, 0, 0);
  }
  var s = String(v == null ? "" : v).trim();
  if (!s) return null;
  var m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s); // dd/mm/yyyy (locale VN)
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), 0, 0, 0);
  m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);       // yyyy-mm-dd
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0);
  return null;
}

// ═══════════════════════════════════════════════════════════
// 5. HTTP — doPost
// ═══════════════════════════════════════════════════════════

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);

    if (body.action === "login") {
      return json_(doLogin_(body));
    }

    // Ghi dữ liệu sản xuất — kiểm tra quyền "C" (Create)
    var rows = body.rows || [];
    if (!rows.length) return json_({ result: "ok", inserted: 0 });

    // Xác thực quyền: user phải có quyền "C" trên ít nhất 1 chức năng
    var username = String(body.user || "").trim();
    if (username) {
      try {
        var masterSS = SpreadsheetApp.openById(MASTER_SHEET_ID);
        var nvSheet = masterSS.getSheetByName("NhanVien");
        var nvData = nvSheet.getDataRange().getValues();
        var maNV = "";
        for (var i = 1; i < nvData.length; i++) {
          if (String(nvData[i][2]).trim().toLowerCase() === username.toLowerCase()) {
            maNV = String(nvData[i][0]).trim();
            break;
          }
        }
        if (maNV) {
          var perms = getPermissions_(masterSS, maNV);
          var hasCreate = perms.some(function(p) {
            return Array.isArray(p.quyen) && p.quyen.indexOf("C") !== -1;
          });
          if (!hasCreate) {
            return json_({ result: "error", error: "Bạn không có quyền tạo dữ liệu (C). Liên hệ quản trị viên." });
          }
        }
      } catch(permErr) {
        // Nếu không check được quyền → log nhưng vẫn cho qua (tránh block hoàn toàn)
        Logger.log("RBAC check error: " + permErr);
      }
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName(SHEET_DATA);
    if (!sh) sh = ss.insertSheet(SHEET_DATA);
    if (sh.getLastRow() === 0) {
      sh.appendRow(HEADERS);
      sh.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
      sh.setFrozenRows(1);
    }

    var out = rows.map(function(r) {
      var p = splitProduct_(r.sp);
      var slQR = parseFloat(p[1]);   // Số lượng → số thật
      var klQR = parseFloat(p[3]);   // KL (QR) → số thật, tránh Sheets hiểu "." là dấu ngàn
      // KL thực tế → ép về số thật (phòng trường hợp client gửi chuỗi "1,8" / "1.8")
      var klTT = parseFloat(String(r.kl == null ? "" : r.kl).replace(",", "."));
      return [
        formatTime_(r.ts), r.user || body.user || "",
        r.may || "", r.mayTen || "",
        r.cn || "", r.cnTen || "",
        r.sp || "", p[0],
        isNaN(slQR) ? p[1] : slQR,
        p[2],
        isNaN(klQR) ? p[3] : klQR,
        isNaN(klTT) ? "" : klTT,
        r.note || ""
      ];
    });

    // Cấp ID tuần tự cho từng dòng (cột N) — duy nhất, tăng dần
    var startId = allocateIds_(out.length);
    for (var d = 0; d < out.length; d++) out[d].push(startId + d);

    var startRow = sh.getLastRow() + 1;
    var rng = sh.getRange(startRow, 1, out.length, HEADERS.length);
    // Ép định dạng SỐ cho các cột số TRƯỚC khi ghi, tránh ô kế thừa định dạng
    // Ngày tháng từ dòng trên (Sheets locale VN hiểu "1.8" = ngày 1 tháng 8,
    // sau đó số 12 hiển thị thành 11/01/1900, 0.8 thành 30/12/1899...)
    sh.getRange(startRow, 9,  out.length, 1).setNumberFormat("0.###"); // cột I: Số lượng
    sh.getRange(startRow, 11, out.length, 2).setNumberFormat("0.###"); // cột K, L: KL (QR), KL thực tế
    sh.getRange(startRow, ID_COL, out.length, 1).setNumberFormat("0"); // cột N: ID
    rng.setValues(out);
    SpreadsheetApp.flush();

    // Xóa cache aggregation (có dữ liệu mới)
    try { CacheService.getScriptCache().remove("kq_agg"); } catch(ce) {}

    return json_({ result: "ok", inserted: out.length });
  } catch (err) {
    return json_({ result: "error", error: String(err) });
  }
}

// ═══════════════════════════════════════════════════════════
// 6. ĐĂNG NHẬP & MẬT KHẨU
// ═══════════════════════════════════════════════════════════

function doLogin_(body) {
  var username = String(body.username || "").trim();
  var password = String(body.password || "");
  if (!username || !password) return { result: "error", error: "Thiếu username hoặc mật khẩu" };

  var masterSS;
  try { masterSS = SpreadsheetApp.openById(MASTER_SHEET_ID); }
  catch (e) { return { result: "error", error: "Không mở được Master Sheet. Kiểm tra MASTER_SHEET_ID." }; }

  var nvSheet = masterSS.getSheetByName("NhanVien");
  if (!nvSheet || nvSheet.getLastRow() <= 1) {
    return { result: "error", error: "Tab NhanVien trống. Chạy setupMasterSheet() trước." };
  }

  var data = nvSheet.getRange(2, 1, nvSheet.getLastRow() - 1, 5).getValues();
  var matchRow = -1;
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][2]).trim().toLowerCase() === username.toLowerCase()) {
      matchRow = i; break;
    }
  }
  if (matchRow === -1) return { result: "error", error: "Sai username hoặc mật khẩu" };

  var row    = data[matchRow];
  var maNV   = String(row[0]).trim();
  var ten    = String(row[1]).trim();
  var stored = String(row[3]).trim();
  var status = String(row[4]).trim().toLowerCase();

  if (status === "inactive") return { result: "error", error: "Tài khoản đã bị vô hiệu hóa" };

  var inputHash = sha256_(password);

  if (stored.length < 64) {
    // Mật khẩu chưa hash → so sánh plain text, rồi hash lưu lại
    if (password !== stored) return { result: "error", error: "Sai username hoặc mật khẩu" };
    var lock = LockService.getScriptLock();
    try {
      lock.waitLock(5000);
      nvSheet.getRange(matchRow + 2, 4).setValue(inputHash);
      SpreadsheetApp.flush();
    } finally { lock.releaseLock(); }
  } else {
    if (inputHash !== stored) return { result: "error", error: "Sai username hoặc mật khẩu" };
  }

  var permissions = getPermissions_(masterSS, maNV);

  return {
    result: "ok",
    maNV: maNV,
    ten: ten,
    username: String(row[2]).trim(),
    permissions: permissions
  };
}

/** SHA-256 hash */
function sha256_(input) {
  var raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, input, Utilities.Charset.UTF_8);
  return raw.map(function(b) { return ("0" + ((b + 256) % 256).toString(16)).slice(-2); }).join("");
}

// ═══════════════════════════════════════════════════════════
// 7. RBAC — Phân quyền
// ═══════════════════════════════════════════════════════════

/**
 * Lấy danh sách quyền cho 1 nhân viên.
 * Trả về: [{module, tenModule, chucNang, url, quyen:["V","C",...]}]
 */
function getPermissions_(masterSS, maNV) {
  // 1. GanVaiTro → vai trò của NV
  var gvt = masterSS.getSheetByName("GanVaiTro");
  if (!gvt || gvt.getLastRow() <= 1) return [];

  var gvtData = gvt.getRange(2, 1, gvt.getLastRow() - 1, gvt.getLastColumn()).getValues();
  var vaiTros = [];
  var nowG = new Date();
  for (var i = 0; i < gvtData.length; i++) {
    var r = gvtData[i];
    if (String(r[0]).trim() !== maNV) continue;
    // Hỗ trợ 2 cột (MãNV + MãVT) hoặc 3+ cột (MãNV + TênNV + MãVT [+ Apply from + Apply to + Trạng thái])
    var vtCol = r.length >= 3 ? String(r[2]).trim() : String(r[1]).trim();
    if (!vtCol) continue;

    // v2.6 — hiệu lực theo dòng gán: D=Apply from, E=Apply to, F=Trạng thái (thiếu cột/ô trống = không giới hạn)
    if (r.length >= 6 && String(r[5] || "").trim().toLowerCase() === "inactive") continue;
    if (r.length >= 4) {
      var gvFrom = coerceDate_(r[3]);
      if (gvFrom && nowG.getTime() < gvFrom.getTime()) continue;               // chưa đến ngày áp dụng
    }
    if (r.length >= 5) {
      var gvTo = coerceDate_(r[4]);
      if (gvTo && nowG.getTime() > gvTo.getTime() + 86399999) continue;        // đã hết hiệu lực (hết ngày to)
    }

    if (vaiTros.indexOf(vtCol) === -1) vaiTros.push(vtCol);
  }
  if (vaiTros.length === 0) return [];

  // 2. ChucNang → catalog
  var cnSheet = masterSS.getSheetByName("ChucNang");
  var cnMap = {};
  if (cnSheet && cnSheet.getLastRow() > 1) {
    var cnData = cnSheet.getRange(2, 1, cnSheet.getLastRow() - 1, 4).getValues();
    for (var j = 0; j < cnData.length; j++) {
      var maCN = String(cnData[j][0]).trim();
      if (maCN) cnMap[maCN] = {
        module: String(cnData[j][1]).trim(),
        tenCN:  String(cnData[j][2]).trim(),
        url:    String(cnData[j][3]).trim()
      };
    }
  }

  // 3. PhanQuyen → ma trận 1/0
  var pq = masterSS.getSheetByName("PhanQuyen");
  if (!pq || pq.getLastRow() <= 1) return [];

  var pqData = pq.getRange(2, 1, pq.getLastRow() - 1, 9).getValues();
  var result = [];
  var seen = {};

  for (var k = 0; k < pqData.length; k++) {
    var pRow    = pqData[k];
    var pVaiTro = String(pRow[0]).trim();
    var pMaCN   = String(pRow[1]).trim();
    var pStatus = String(pRow[8]).trim().toLowerCase();

    if (pStatus === "inactive") continue;
    if (vaiTros.indexOf(pVaiTro) === -1) continue;

    var quyenArr = [];
    var codes = ["V", "C", "E", "R", "A", "D"];
    for (var c = 0; c < 6; c++) {
      if (String(pRow[c + 2]).trim() === "1") quyenArr.push(codes[c]);
    }
    if (quyenArr.length === 0) continue;

    var cn = cnMap[pMaCN] || null;
    var module, tenModule, chucNang, url;
    if (cn) {
      module = cn.module; tenModule = cn.tenCN; chucNang = cn.tenCN; url = cn.url;
    } else {
      var parts = pMaCN.split("_");
      module = parts[0] || pMaCN; tenModule = pMaCN; chucNang = pMaCN; url = "";
    }

    // Gộp quyền nếu cùng chức năng (NV có nhiều vai trò)
    if (seen[pMaCN]) {
      var existing = seen[pMaCN];
      quyenArr.forEach(function(qq) {
        if (existing.quyen.indexOf(qq) === -1) existing.quyen.push(qq);
      });
    } else {
      var entry = { module: module, tenModule: tenModule, chucNang: chucNang, url: url, quyen: quyenArr };
      seen[pMaCN] = entry;
      result.push(entry);
    }
  }

  return result;
}

// ═══════════════════════════════════════════════════════════
// 8. ĐƠN HÀNG & TIẾN ĐỘ (tối ưu cho 100K+ dòng KetQua)
// ═══════════════════════════════════════════════════════════

/**
 * Tìm đơn hàng + tính tiến độ.
 * Order List cache 30 phút, KetQua aggregation cache 15 phút.
 * Trả về max 300 dòng.
 */
function orderSearch_(sxSS, customer, q) {
  var orders = loadOrderList_();
  if (!orders || orders.length === 0) {
    return { result: "error", error: "Không đọc được Order List. Kiểm tra ORDERLIST_SHEET_ID và tab " + ORDERLIST_TAB };
  }

  // Lọc
  var custLower = customer.toLowerCase();
  var qLower    = q.toLowerCase();
  var filtered  = orders;

  if (customer) {
    filtered = filtered.filter(function(o) {
      return o.khachhang.toLowerCase().indexOf(custLower) !== -1;
    });
  }
  if (q) {
    filtered = filtered.filter(function(o) {
      return o.lsxct.toLowerCase().indexOf(qLower) !== -1
          || o.lsx.toLowerCase().indexOf(qLower) !== -1
          || o.masp.toLowerCase().indexOf(qLower) !== -1;
    });
  }
  // LSX gần nhất trước (LSXCT dạng yymmdd... nên so sánh numeric-aware giảm dần là mới nhất trước)
  filtered = filtered.slice(); // không sửa mảng cache
  filtered.sort(function(a, b) {
    return String(b.lsxct).localeCompare(String(a.lsxct), undefined, { numeric: true });
  });
  if (filtered.length > 300) filtered = filtered.slice(0, 300);

  // Aggregate KetQua
  var agg = getKetQuaAgg_(sxSS);

  // Gộp kết quả
  var rows = filtered.map(function(o) {
    // Match LSXCT trước, fallback LSX
    var prod = agg[o.lsxct] || agg[o.lsx] || { sl: 0, kg: 0, rows: 0 };
    return {
      lsxct:         o.lsxct,
      lsx:           o.lsx,
      khachhang:     o.khachhang,
      masp:          o.masp,
      mota:          o.mota,
      soluong:       o.soluong,
      dvt:           o.dvt,
      ngaygiao:      o.ngaygiao,
      daCatSoLuong:  prod.sl,
      daCatKg:       prod.kg,
      soDongGhiNhan: prod.rows
    };
  });

  return { result: "ok", rows: rows };
}

/** Danh sách khách hàng unique từ Order List */
function getOrderCustomers_() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get("ol_customers");
  if (cached) {
    try { return JSON.parse(cached); } catch(e) {}
  }

  var orders = loadOrderList_();
  var seen = {}, list = [];
  for (var i = 0; i < orders.length; i++) {
    var kh = orders[i].khachhang;
    if (kh && !seen[kh]) { seen[kh] = true; list.push(kh); }
  }
  list.sort();

  try { cache.put("ol_customers", JSON.stringify(list), CACHE_CUST); } catch(e) {}
  return list;
}

/**
 * Đọc Order List từ sheet DATA COMBINE (cache 30 phút, chunked).
 * Trả về: [{lsxct, lsx, khachhang, masp, mota, soluong, dvt, ngaygiao}]
 */
function loadOrderList_() {
  var cache = CacheService.getScriptCache();

  // Thử đọc cache
  var meta = cache.get("ol_meta");
  if (meta) {
    try {
      var m = JSON.parse(meta);
      var keys = [];
      for (var c = 0; c < m.chunks; c++) keys.push("ol_" + c);
      var parts = cache.getAll(keys);
      var str = "";
      var ok = true;
      for (var c = 0; c < m.chunks; c++) {
        if (!parts["ol_" + c]) { ok = false; break; }
        str += parts["ol_" + c];
      }
      if (ok && str) return JSON.parse(str);
    } catch(e) {}
  }

  // Đọc từ Sheet
  var olSS;
  try { olSS = SpreadsheetApp.openById(ORDERLIST_SHEET_ID); }
  catch(e) { return []; }

  var tab = olSS.getSheetByName(ORDERLIST_TAB) || olSS.getSheets()[0];
  if (!tab || tab.getLastRow() <= 1) return [];

  // Tìm column index theo header
  var headers = tab.getRange(1, 1, 1, tab.getLastColumn()).getValues()[0];
  var colIdx = {};
  var olKeys = Object.keys(OL);
  for (var k = 0; k < olKeys.length; k++) {
    var field  = olKeys[k];
    var target = OL[field].toLowerCase().trim();
    colIdx[field] = -1;
    for (var h = 0; h < headers.length; h++) {
      if (String(headers[h]).toLowerCase().trim() === target) { colIdx[field] = h; break; }
    }
  }

  var allData = tab.getRange(2, 1, tab.getLastRow() - 1, tab.getLastColumn()).getValues();
  var result = [];

  for (var i = 0; i < allData.length; i++) {
    var r = allData[i];
    var lsxct = colIdx.lsxct >= 0 ? String(r[colIdx.lsxct] || "").trim() : "";
    if (!lsxct) continue;

    var ngaygiao = "";
    if (colIdx.ngaygiao >= 0) {
      var raw = r[colIdx.ngaygiao];
      ngaygiao = (raw instanceof Date)
        ? Utilities.formatDate(raw, Session.getScriptTimeZone(), "dd/MM/yyyy")
        : String(raw || "").trim();
    }

    result.push({
      lsxct:     lsxct,
      lsx:       colIdx.lsx >= 0 ? String(r[colIdx.lsx] || "").trim() : "",
      khachhang: colIdx.khachhang >= 0 ? String(r[colIdx.khachhang] || "").trim() : "",
      masp:      colIdx.masp >= 0 ? String(r[colIdx.masp] || "").trim() : "",
      mota:      colIdx.mota >= 0 ? String(r[colIdx.mota] || "").trim() : "",
      soluong:   colIdx.soluong >= 0 ? Number(r[colIdx.soluong]) || 0 : 0,
      dvt:       colIdx.dvt >= 0 ? String(r[colIdx.dvt] || "").trim() : "",
      ngaygiao:  ngaygiao
    });
  }

  // Cache chunked (mỗi chunk ≤ 90KB)
  cacheChunked_(cache, "ol", result, CACHE_OL);
  return result;
}

/**
 * Aggregate KetQua theo LSX — CHỈ đọc 5 cột H-L (tối ưu cho 100K+ dòng).
 * Trả về: { "LSX_VALUE": {sl, kg, rows} }
 */
function getKetQuaAgg_(sxSS) {
  var cache = CacheService.getScriptCache();
  var cached = cache.get("kq_agg");
  if (cached) {
    try { return JSON.parse(cached); } catch(e) {}
  }

  var sh = sxSS.getSheetByName(SHEET_DATA);
  if (!sh || sh.getLastRow() <= 1) return {};

  var lastRow = sh.getLastRow();
  // Chỉ đọc cột H(8) đến L(12) = 5 cột
  var data = sh.getRange(2, 8, lastRow - 1, 5).getValues();

  var agg = {};
  for (var i = 0; i < data.length; i++) {
    var lsx = String(data[i][0]).trim(); // Col H = LSX
    if (!lsx) continue;
    if (!agg[lsx]) agg[lsx] = { sl: 0, kg: 0, rows: 0 };
    agg[lsx].sl   += Number(data[i][1]) || 0; // Col I = Số lượng
    agg[lsx].kg   += Number(data[i][3]) || 0; // Col K = KL (QR) (H+3)
    agg[lsx].rows += 1;
  }

  // Cache nếu đủ nhỏ
  try {
    var str = JSON.stringify(agg);
    if (str.length <= 95000) cache.put("kq_agg", str, CACHE_KQ);
  } catch(e) {}

  return agg;
}

// ═══════════════════════════════════════════════════════════
// TỔNG HỢP THEO TỔ / NGÀY (endpoint teamDaily) — v2.2
// Tổ (Work station) suy từ Mã máy (cột C KetQua) tra sang MA_MAY cột D.
// SL = cột I, KL = cột K (KL QR). Máy không có trong MA_MAY → tổ "KHAC".
// ═══════════════════════════════════════════════════════════

function getTeamDaily_(ss, fromStr, toStr) {
  var from = parseDateParam_(fromStr);
  var to   = parseDateParam_(toStr);
  if (!from || !to) return { result: "error", error: "Thiếu hoặc sai định dạng ngày (yyyy-mm-dd)" };
  if (to.getTime() < from.getTime()) { var tmp = from; from = to; to = tmp; }
  // Giới hạn 62 ngày để tránh quét quá nặng
  if ((to - from) / 86400000 > 62) return { result: "error", error: "Khoảng ngày tối đa 62 ngày" };
  var toEnd = new Date(to.getTime() + 86399999); // hết ngày "to" 23:59:59

  var cacheKey = "td_" + Utilities.formatDate(from, Session.getScriptTimeZone(), "yyyyMMdd") +
                 "_"   + Utilities.formatDate(to,   Session.getScriptTimeZone(), "yyyyMMdd");
  var cache = CacheService.getScriptCache();
  var cached = cache.get(cacheKey);
  if (cached) { try { return JSON.parse(cached); } catch(e) {} }

  // Map Mã máy → Tổ (Work station) + Tên máy — nguồn: Master (fallback Sheet SX)
  var wsMap = {}, tenMap = {};
  getMachines_().forEach(function(m) {
    wsMap[m.ma.toUpperCase()]  = m.ws || "KHAC";
    tenMap[m.ma.toUpperCase()] = m.ten || "";
  });

  var sh = ss.getSheetByName(SHEET_DATA);
  if (!sh || sh.getLastRow() <= 1) return { result: "ok", days: [] };

  var n = sh.getLastRow() - 1;
  // Đọc cột A..K (11 cột): A=Thời gian, C=Mã máy, H=LSX, I=Số lượng, K=KL(QR)
  var data = sh.getRange(2, 1, n, 11).getValues();
  var tz = Session.getScriptTimeZone();

  var agg = {}; // { "yyyy-MM-dd": { sl, kg, rows, to: { WS: { sl, kg, rows, lsx: { LSX: {sl,kg,rows} } } } } }
  for (var i = 0; i < data.length; i++) {
    var raw = data[i][0];
    var dt = (raw instanceof Date) ? raw : new Date(String(raw).replace(" ", "T"));
    if (isNaN(dt.getTime())) continue;
    if (dt < from || dt > toEnd) continue;

    var dateKey = Utilities.formatDate(dt, tz, "yyyy-MM-dd");
    var mayRaw = String(data[i][2]).trim();
    var may = mayRaw.toUpperCase();
    var ws  = wsMap[may] || "KHAC";
    var lsx = String(data[i][7]).trim() || "(không LSX)";
    var sl  = Number(data[i][8])  || 0;
    var kg  = Number(data[i][10]) || 0;

    if (!agg[dateKey]) agg[dateKey] = { sl: 0, kg: 0, rows: 0, to: {} };
    var d = agg[dateKey];
    d.sl += sl; d.kg += kg; d.rows += 1;

    if (!d.to[ws]) d.to[ws] = { sl: 0, kg: 0, rows: 0, lsxSet: {}, may: {} };
    var t = d.to[ws];
    t.sl += sl; t.kg += kg; t.rows += 1;
    t.lsxSet[lsx] = 1; // đếm LSX riêng biệt của tổ

    // Cây Tổ → Máy → LSX
    var mayKey = mayRaw || "(không máy)";
    if (!t.may[mayKey]) t.may[mayKey] = { sl: 0, kg: 0, rows: 0, lsx: {} };
    var mv = t.may[mayKey];
    mv.sl += sl; mv.kg += kg; mv.rows += 1;
    if (!mv.lsx[lsx]) mv.lsx[lsx] = { sl: 0, kg: 0, rows: 0 };
    mv.lsx[lsx].sl += sl; mv.lsx[lsx].kg += kg; mv.lsx[lsx].rows += 1;
  }

  // Xuất mảng: ngày mới nhất trước; tổ, máy, LSX sắp theo tên
  var days = Object.keys(agg).sort().reverse().map(function(dk) {
    var d = agg[dk];
    return {
      ngay: dk, sl: round3_(d.sl), kg: round3_(d.kg), rows: d.rows,
      to: Object.keys(d.to).sort().map(function(w) {
        var t = d.to[w];
        return {
          ws: w, sl: round3_(t.sl), kg: round3_(t.kg), rows: t.rows,
          lsxCount: Object.keys(t.lsxSet).length,
          may: Object.keys(t.may).sort().map(function(mk) {
            var mv = t.may[mk];
            return {
              may: mk, ten: tenMap[mk.toUpperCase()] || "",
              sl: round3_(mv.sl), kg: round3_(mv.kg), rows: mv.rows,
              lsx: Object.keys(mv.lsx).sort().map(function(l) {
                var v = mv.lsx[l];
                return { lsx: l, sl: round3_(v.sl), kg: round3_(v.kg), rows: v.rows };
              })
            };
          })
        };
      })
    };
  });

  var result = { result: "ok", from: fromStr, to: toStr, days: days };
  try {
    var str = JSON.stringify(result);
    if (str.length <= 95000) cache.put(cacheKey, str, CACHE_TD);
  } catch(e) {}
  return result;
}

/** Parse tham số ngày "yyyy-mm-dd" → Date 00:00 (múi giờ script). Sai → null */
function parseDateParam_(s) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || "").trim());
  if (!m) return null;
  var d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0);
  return isNaN(d.getTime()) ? null : d;
}

/** Làm tròn 3 chữ số thập phân (tránh nhiễu float khi cộng dồn) */
function round3_(x) { return Math.round((Number(x) || 0) * 1000) / 1000; }

/** Cache chunked — chia dữ liệu lớn thành chunk ≤ 90KB */
function cacheChunked_(cache, prefix, obj, ttl) {
  try {
    var str = JSON.stringify(obj);
    var chunkSize = 90000;
    var chunks = Math.ceil(str.length / chunkSize);
    var map = {};
    map[prefix + "_meta"] = JSON.stringify({ chunks: chunks });
    for (var i = 0; i < chunks; i++) {
      map[prefix + "_" + i] = str.substr(i * chunkSize, chunkSize);
    }
    cache.putAll(map, ttl);
  } catch(e) {}
}

// ═══════════════════════════════════════════════════════════
// 9. TIỆN ÍCH — Chạy tay trong Apps Script editor
// ═══════════════════════════════════════════════════════════

/** Reset PhanQuyen về 8 dòng mẫu (khi dữ liệu bị hỏng) */
function resetPhanQuyen() {
  var ss = SpreadsheetApp.openById(MASTER_SHEET_ID);
  var pq = ss.getSheetByName("PhanQuyen");
  if (!pq) { Logger.log("Tab PhanQuyen không tồn tại!"); return; }

  var headers = ["Mã vai trò", "Mã chức năng",
    "V-Xem", "C-Tạo", "E-Sửa", "R-Kiểm tra", "A-Phê duyệt", "D-Xóa", "Trạng thái"];

  pq.getRange(1, 1, pq.getMaxRows(), pq.getMaxColumns()).clearDataValidations();
  pq.clear();
  pq.appendRow(headers);
  pq.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#fef9c3");
  pq.setFrozenRows(1);
  writeSamplePhanQuyen_(pq);

  Logger.log("Đã reset PhanQuyen: 8 dòng mẫu.");
  ss.toast("Đã reset PhanQuyen");
}

/** Copy nhân viên từ Sheet SX sang Master Sheet */
function migrateEmployees() {
  var sxSS = SpreadsheetApp.getActiveSpreadsheet();
  var src = sxSS.getSheetByName(SHEET_NAMES);
  if (!src || src.getLastRow() <= 1) { Logger.log("DanhSachNhanVien trống."); return; }

  var masterSS = SpreadsheetApp.openById(MASTER_SHEET_ID);
  var nv = masterSS.getSheetByName("NhanVien");
  if (!nv) { Logger.log("Chưa có tab NhanVien. Chạy setupMasterSheet() trước."); return; }

  var existing = {};
  if (nv.getLastRow() > 1) {
    nv.getRange(2, 2, nv.getLastRow() - 1, 1).getValues().forEach(function(r) {
      existing[String(r[0]).trim()] = true;
    });
  }

  var names = src.getRange(2, 1, src.getLastRow() - 1, 1).getValues()
    .map(function(r) { return String(r[0]).trim(); })
    .filter(function(n) { return n && !existing[n]; });

  if (names.length === 0) { Logger.log("Không có nhân viên mới."); return; }

  var lastIdx = nv.getLastRow();
  var newRows = names.map(function(name, i) {
    var idx = String(lastIdx + i);
    while (idx.length < 3) idx = "0" + idx;
    return ["NV" + idx, name, removeVietnamese_(name).toLowerCase().replace(/\s+/g, ""), "123456", "Active"];
  });

  nv.getRange(nv.getLastRow() + 1, 1, newRows.length, 5).setValues(newRows);
  Logger.log("Đã migrate " + newRows.length + " nhân viên. MK mặc định: 123456");
}

/** Cập nhật cột Tên NV trong GanVaiTro (plain text, không VLOOKUP) */
function updateGanVaiTroNames() {
  var ss = SpreadsheetApp.openById(MASTER_SHEET_ID);
  fillGanVaiTroNames_(ss.getSheetByName("NhanVien"), ss.getSheetByName("GanVaiTro"));
  ss.toast("Đã cập nhật tên NV trong GanVaiTro");
}

function fillGanVaiTroNames_(nvSheet, gvtSheet) {
  if (!nvSheet || !gvtSheet || gvtSheet.getLastRow() <= 1) return;

  var nameMap = {};
  if (nvSheet.getLastRow() > 1) {
    nvSheet.getRange(2, 1, nvSheet.getLastRow() - 1, 2).getValues().forEach(function(r) {
      var ma = String(r[0]).trim();
      if (ma) nameMap[ma] = String(r[1]).trim();
    });
  }

  var gvtData = gvtSheet.getRange(2, 1, gvtSheet.getLastRow() - 1, 1).getValues();
  var names = gvtData.map(function(r) { return [nameMap[String(r[0]).trim()] || ""]; });
  gvtSheet.getRange(2, 2, names.length, 1).setValues(names);
}

/** Kiểm tra 6 tab + test phân quyền cho NV đầu tiên */
function debugRBAC() {
  var ss;
  try { ss = SpreadsheetApp.openById(MASTER_SHEET_ID); }
  catch(e) { Logger.log("Không mở được Master Sheet: " + e); return; }

  ["NhanVien", "VaiTro", "ChucNang", "Quyen", "GanVaiTro", "PhanQuyen"].forEach(function(name) {
    var sh = ss.getSheetByName(name);
    if (!sh) { Logger.log("❌ " + name + ": KHÔNG TỒN TẠI"); }
    else {
      Logger.log("✅ " + name + ": " + (sh.getLastRow() - 1) + " dòng");
      if (sh.getLastRow() > 1) {
        Logger.log("   Dòng đầu: " + JSON.stringify(sh.getRange(2, 1, 1, sh.getLastColumn()).getValues()[0]));
      }
    }
  });

  var nv = ss.getSheetByName("NhanVien");
  if (nv && nv.getLastRow() > 1) {
    var maNV = String(nv.getRange(2, 1).getValue()).trim();
    var ten  = String(nv.getRange(2, 2).getValue()).trim();
    Logger.log("\nTest phân quyền: " + ten + " (" + maNV + ")");
    var perms = getPermissions_(ss, maNV);
    Logger.log("Kết quả: " + perms.length + " chức năng");
    perms.forEach(function(p) {
      Logger.log("  " + p.module + "/" + p.chucNang + " [" + p.quyen.join(",") + "] → " + (p.url || "—"));
    });
  }
}

/** Xóa tất cả cache */
function clearOrderCache() {
  CacheService.getScriptCache().removeAll([
    "kq_agg", "ol_meta", "ol_0", "ol_1", "ol_2", "ol_3", "ol_customers"
  ]);
  Logger.log("Đã xóa cache Order List + KetQua");
}

/** Thêm dropdown Trạng thái cho tab DanhSachNhanVien cũ */
function fixEmployeeStatusDropdown() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAMES);
  if (!sh || sh.getLastRow() <= 1) return;

  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var statusCol = -1;
  for (var i = 0; i < headers.length; i++) {
    if (String(headers[i]).trim() === "Trạng thái") { statusCol = i + 1; break; }
  }
  if (statusCol === -1) {
    statusCol = sh.getLastColumn() + 1;
    sh.getRange(1, statusCol).setValue("Trạng thái").setFontWeight("bold");
  }

  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["Active", "Inactive"], true)
    .setAllowInvalid(false).build();
  sh.getRange(2, statusCol, sh.getLastRow() - 1, 1).setDataValidation(rule);
  Logger.log("Đã thêm dropdown Trạng thái cột " + statusCol);
}

// ═══════════════════════════════════════════════════════════
// 9B. ID TUẦN TỰ — cột N tab KetQua
//     Mọi nguồn nhập (App, Form, gõ tay) đều được cấp ID
//     duy nhất, tăng dần. Dùng để query tăng dần sang Excel.
// ═══════════════════════════════════════════════════════════

/**
 * CHẠY 1 LẦN: tạo header "ID" ở ô N1 + cấp ID cho toàn bộ dòng cũ
 * theo thứ tự dòng hiện tại. Sau đó chạy setupIdTrigger().
 */
function initIdColumn() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_DATA);
  if (!sh) { Logger.log("Không tìm thấy tab " + SHEET_DATA); return; }
  sh.getRange(1, ID_COL).setValue("ID").setFontWeight("bold").setBackground("#d1fae5");
  assignMissingIds_();
  SpreadsheetApp.flush();
  Logger.log("Xong. ID cuối cùng = " +
    PropertiesService.getScriptProperties().getProperty("LAST_ID"));
}

/**
 * CHẠY 1 LẦN: tạo trigger onChange — tự cấp ID khi có dòng mới
 * do nhập tay trong Sheet hoặc qua Google Form.
 * (Dòng do App ghi qua doPost đã được cấp ID ngay lúc ghi.)
 */
function setupIdTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === "onChangeAssignId") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("onChangeAssignId")
    .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet())
    .onChange()
    .create();
  Logger.log("Đã tạo trigger onChange → onChangeAssignId");
}

/** Trigger onChange: cấp ID cho các dòng chưa có ID */
function onChangeAssignId(e) {
  try { assignMissingIds_(); }
  catch (err) { Logger.log("onChangeAssignId: " + err); }
}

/** Quét cột N, cấp ID cho mọi dòng có dữ liệu nhưng chưa có ID */
function assignMissingIds_() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_DATA);
  if (!sh || sh.getLastRow() < 2) return;
  var n = sh.getLastRow() - 1;

  // Bước 1: chỉ đọc cột N — thoát nhanh nếu không thiếu ID (đa số lần edit)
  var idVals = sh.getRange(2, ID_COL, n, 1).getValues();
  var hasMissing = false;
  for (var i = 0; i < n; i++) {
    if (String(idVals[i][0]).trim() === "") { hasMissing = true; break; }
  }
  if (!hasMissing) return;

  // Bước 2: đọc A–M để bỏ qua dòng hoàn toàn trống
  var data = sh.getRange(2, 1, n, 13).getValues();
  var targets = [];
  for (var j = 0; j < n; j++) {
    if (String(idVals[j][0]).trim() !== "") continue;
    for (var c = 0; c < 13; c++) {
      if (String(data[j][c]).trim() !== "") { targets.push(j); break; }
    }
  }
  if (targets.length === 0) return;

  // Bước 3: cấp ID (chống trùng bằng Lock) rồi ghi lại cả cột 1 lần
  var startId = allocateIds_(targets.length);
  for (var t = 0; t < targets.length; t++) idVals[targets[t]][0] = startId + t;
  sh.getRange(2, ID_COL, n, 1).setNumberFormat("0").setValues(idVals);

  // Dòng nhập tay: ép định dạng số I, K, L + khôi phục nếu bị hiểu thành Ngày
  if (targets.length <= 30) {
    for (var t2 = 0; t2 < targets.length; t2++) {
      var row = targets[t2] + 2;
      fixNumberCell_(sh, row, 9);
      fixNumberCell_(sh, row, 11);
      fixNumberCell_(sh, row, 12);
    }
  }
  SpreadsheetApp.flush();
}

/**
 * Cấp phát `count` ID liên tiếp, trả về ID đầu tiên.
 * Dùng LockService + ScriptProperties → không bao giờ trùng,
 * kể cả khi App và nhập tay ghi cùng lúc.
 */
function allocateIds_(count) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var props = PropertiesService.getScriptProperties();
    var last = parseInt(props.getProperty("LAST_ID"), 10);
    if (isNaN(last)) last = findMaxIdFromSheet_();
    props.setProperty("LAST_ID", String(last + count));
    return last + 1;
  } finally {
    lock.releaseLock();
  }
}

/** Tìm ID lớn nhất trong cột N (chỉ dùng khi LAST_ID chưa khởi tạo) */
function findMaxIdFromSheet_() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_DATA);
  if (!sh || sh.getLastRow() < 2) return 0;
  var vals = sh.getRange(2, ID_COL, sh.getLastRow() - 1, 1).getValues();
  var max = 0;
  for (var i = 0; i < vals.length; i++) {
    var v = Number(vals[i][0]);
    if (!isNaN(v) && v > max) max = v;
  }
  return max;
}

/** Ép 1 ô về định dạng số; nếu ô đã bị lưu thành Date thì khôi phục lại số */
function fixNumberCell_(sh, row, col) {
  var cell = sh.getRange(row, col);
  var v = cell.getValue();
  if (v instanceof Date) {
    var num = parseFloat(v.getDate() + "." + (v.getMonth() + 1));
    if (!isNaN(num)) cell.setNumberFormat("0.###").setValue(num);
  } else {
    cell.setNumberFormat("0.###");
  }
}

// ═══════════════════════════════════════════════════════════
// 10. HELPERS
// ═══════════════════════════════════════════════════════════

/**
 * CHẠY 1 LẦN để sửa dữ liệu cũ: bóc lại Số lượng (cột I) và KL QR (cột K)
 * từ Mã Sản phẩm (cột G), ghi đè bằng SỐ THẬT.
 * Cách chạy: mở Apps Script → chọn hàm fixKLQR → Run.
 */
function fixKLQR() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_DATA);
  if (!sh || sh.getLastRow() < 2) { Logger.log("Không có dữ liệu."); return; }
  var n = sh.getLastRow() - 1;
  var spVals = sh.getRange(2, 7, n, 1).getValues();  // cột G: Mã Sản phẩm
  var slOut = [], klOut = [], fixed = 0;
  for (var i = 0; i < n; i++) {
    var p = splitProduct_(spVals[i][0]);
    var sl = parseFloat(p[1]);
    var kl = parseFloat(p[3]);
    slOut.push([isNaN(sl) ? p[1] : sl]);
    klOut.push([isNaN(kl) ? p[3] : kl]);
    if (!isNaN(kl)) fixed++;
  }
  // Reset định dạng về số (xóa định dạng Ngày bị Sheets tự gán trước đây)
  sh.getRange(2, 9,  n, 1).setNumberFormat("General").setValues(slOut);  // cột I: Số lượng
  sh.getRange(2, 11, n, 1).setNumberFormat("General").setValues(klOut);  // cột K: KL (QR)
  SpreadsheetApp.flush();
  try { CacheService.getScriptCache().remove("kq_agg"); } catch(e) {}
  Logger.log("Đã sửa lại " + fixed + "/" + n + " dòng.");
}

/**
 * CHẠY 1 LẦN để sửa cột L (KL thực tế) bị Sheets hiểu nhầm thành NGÀY:
 * - Ô là Date (vd "1.8" bị hiểu thành 01/08) → khôi phục lại số: ngày.tháng = 1.8
 * - Ô là số nhưng hiển thị kiểu ngày → chỉ cần reset định dạng, giá trị giữ nguyên
 * - Ô là chuỗi "1,8" → đổi thành số 1.8
 * Cách chạy: mở Apps Script → chọn hàm fixKLThucTe → Run.
 */
function fixKLThucTe() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_DATA);
  if (!sh || sh.getLastRow() < 2) { Logger.log("Không có dữ liệu."); return; }
  var n = sh.getLastRow() - 1;
  var vals = sh.getRange(2, 12, n, 1).getValues(); // cột L: KL thực tế (kg)
  var out = [], fixed = 0;
  for (var i = 0; i < n; i++) {
    var v = vals[i][0];
    if (v instanceof Date) {
      // "1.8" từng bị hiểu là ngày 1 tháng 8 → khôi phục: ngày + "." + tháng
      var num = parseFloat(v.getDate() + "." + (v.getMonth() + 1));
      out.push([isNaN(num) ? "" : num]);
      fixed++;
    } else if (typeof v === "number") {
      out.push([v]); // giá trị đúng, chỉ bị sai định dạng hiển thị
    } else {
      var s = String(v == null ? "" : v).trim().replace(",", ".");
      var f = parseFloat(s);
      out.push([s === "" ? "" : (isNaN(f) ? v : f)]);
      if (!isNaN(f) && s !== "") fixed++;
    }
  }
  sh.getRange(2, 12, n, 1).setNumberFormat("0.###").setValues(out);
  SpreadsheetApp.flush();
  try { CacheService.getScriptCache().remove("kq_agg"); } catch(e) {}
  Logger.log("Đã xử lý " + n + " dòng, khôi phục/chuẩn hóa " + fixed + " ô.");
}

function splitProduct_(sp) {
  var parts = String(sp || "").split("/");
  return [parts[0]||"", parts[1]||"", parts[2]||"", parts[3]||""];
}

function formatTime_(ts) {
  try {
    var d = ts ? new Date(ts) : new Date();
    return Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
  } catch(e) { return ts || ""; }
}

function reply_(e, obj) {
  var s = JSON.stringify(obj);
  var cb = e && e.parameter && e.parameter.callback;
  if (cb) {
    return ContentService.createTextOutput(cb + "(" + s + ");")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(s).setMimeType(ContentService.MimeType.JSON);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Bỏ dấu tiếng Việt (dùng cho tạo username tự động) */
function removeVietnamese_(str) {
  return String(str)
    .replace(/[àáạảãâầấậẩẫăằắặẳẵ]/g, "a")
    .replace(/[èéẹẻẽêềếệểễ]/g, "e")
    .replace(/[ìíịỉĩ]/g, "i")
    .replace(/[òóọỏõôồốộổỗơờớợởỡ]/g, "o")
    .replace(/[ùúụủũưừứựửữ]/g, "u")
    .replace(/[ỳýỵỷỹ]/g, "y")
    .replace(/đ/g, "d")
    .replace(/[ÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴ]/g, "A")
    .replace(/[ÈÉẸẺẼÊỀẾỆỂỄ]/g, "E")
    .replace(/[ÌÍỊỈĨ]/g, "I")
    .replace(/[ÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠ]/g, "O")
    .replace(/[ÙÚỤỦŨƯỪỨỰỬỮ]/g, "U")
    .replace(/[ỲÝỴỶỸ]/g, "Y")
    .replace(/Đ/g, "D");
}
