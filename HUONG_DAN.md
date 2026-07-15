# QA-P.ERP — Hướng dẫn cài đặt & vận hành (v2.6)

Hệ thống quản lý doanh nghiệp module hóa, chạy trên trình duyệt điện thoại (PWA).
Dữ liệu gửi về Google Sheet qua Google Apps Script. Hosting trên GitHub Pages.

> Cập nhật: 15/07/2026 (v2.7) —
> 1. **Module Kho — Đối chiếu xuất hàng (WH_DCXH):** Web app quét QR đối chiếu hàng hóa trước khi xuất theo Phiếu giao hàng (DN). Google Sheet riêng (`Code_XuatHang.gs`) chứa tab DN_LSX (danh sách hàng cần giao) và DN_ScanLog (lịch sử quét). Kiểm tra vượt SL ngay trên trình duyệt trước khi ghi. Hiển thị tiến độ từng LSX (thanh SL + KL). Hỗ trợ offline queue.
>
> Bản 11/07/2026 (v2.6) —
> 1. **Chức năng ghi nhận tách theo nhánh qua phân quyền:** ChucNang cột URL hỗ trợ `index.html?branch=CT` / `index.html?branch=GTB` (VD mã PD_A01 = Ghi nhận Cắt/TC, PD_A02 = Ghi nhận GTB) → bấm chức năng nào vào thẳng nhánh đó, ai không có quyền thì không thấy nhánh. URL `index.html` không tham số (kiểu cũ) vẫn hiện màn chọn 2 nhánh.
> 2. **GanVaiTro thêm cột D "Apply from", E "Apply to", F "Trạng thái":** mỗi dòng gán vai trò có khoảng hiệu lực riêng — đăng nhập chỉ nhận vai trò đang hiệu lực (ô trống = không giới hạn; Inactive = khóa). Đổi vai trò theo kế hoạch: thêm dòng mới với ngày áp dụng, điền Apply to dòng cũ (giữ lịch sử). Dòng 3 cột kiểu cũ vẫn chạy bình thường.
>
> Bản 11/07/2026 (v2.5) —
> 1. **Tra cứu theo LSX/Khách hàng/Mã hàng: LSX gần nhất hiển thị trước** (sort LSXCT giảm dần trước khi cắt 300 dòng).
> 2. **Tổ/Ngày cho chọn NHIỀU tổ** (chip bật/tắt: Cắt, Thủ công, GTB, Khác — mặc định chọn hết; đổi lựa chọn không cần tải lại).
> 3. **Danh sách chi tiết dạng cây Tổ → Máy → LSX** (mỗi máy hiện các LSX của riêng máy đó). Mặc định MỞ hết; bấm dòng tổ/máy (▶) để đóng/mở tiết kiệm không gian.
> 4. **Bộ lọc 2 hàng gọn:** hàng 1 = "Từ ngày" + ô ngày + "Đến ngày" + ô ngày; hàng 2 = "Tổ" + chip tổ + nút Xem.
>
> Bản 10/07/2026 (v2.4) —
> 1. **Báo cáo Tổ/Ngày thêm thống kê theo MÁY:** bấm vào 1 tổ hiện 2 bảng — 🔩 Theo máy (mã + tên máy, SL, KL, lượt của từng máy) và 📋 Theo LSX (như cũ). Endpoint `teamDaily` trả thêm mảng `may` trong mỗi tổ.
> 2. **Đóng băng tiêu đề cột** (Máy/LSX, SL, KL, Lượt) khi cuộn danh sách dài (sticky header).
> 3. **Bộ lọc gọn hơn:** Từ ngày + Đến ngày chung 1 hàng; Tổ + nút Xem chung 1 hàng — phần kết quả hiển thị rộng hơn.
> (Sau lần quét GTB app tự khóa — phải bấm "Quét tiếp" mới nhận QR mới, tránh quét trùng liên tục.)
>
> Bản 10/07/2026 (v2.3) —
> 1. **MA_MAY, MA_CN chuyển sang Master Sheet** (chạy `migrateMayCN()` 1 lần để copy). Master chưa có → app tự fallback đọc tab cũ ở Sheet SX, không gián đoạn. Sheet SX giờ chỉ còn tab KetQua.
> 2. **MA_CN thêm cột D "Work station"** (CAT/TCO/GTB) + **E "Apply from"** + **F "Apply to"**: backend chỉ trả công nhân đang hiệu lực (E ≤ hôm nay ≤ F; ô trống = không giới hạn). Công nhân chuyển tổ → thêm dòng mới với ngày áp dụng, điền Apply to cho dòng cũ (giữ lịch sử).
> 3. **App lọc Máy + Công nhân theo nhánh:** nhánh Cắt/Thủ công chỉ hiện tổ CAT + TCO; nhánh Giấy/Thùng/Bìa chỉ hiện tổ GTB. Máy/CN CHƯA gán tổ hiện ở mọi nhánh (tránh chặn nhầm).
>
> Bản 10/07/2026 (v2.2) —
> 1. Ghi nhận SX chia 2 nhánh chọn trên menu: **Cắt/Thủ công** (nhập KL tay như cũ) và **Giấy/Thùng/Bìa** (chỉ quét — KL thực tế tự động = KL QR; QR thiếu KL → vẫn hỏi nhập tay).
> 2. MA_MAY thêm **cột D "Work station"** (CAT / TCO / GTB) — dùng để phân tổ khi tổng hợp Tổ/Ngày (hiển thị kèm trong danh sách chọn máy).
> 3. Tiến độ đơn hàng: KL đổi sang **cột K (KL QR)** thay vì cột L.
> 4. "Tra cứu tiến độ Sản xuất": vào là chọn 1 trong 2 kiểu — **Theo LSX/Khách hàng/Mã hàng** (như cũ) và **Theo Tổ/Ngày** (chọn khoảng ngày + lọc Tổ; tổng SL + KL mỗi ngày theo tổ, chi tiết từng LSX), endpoint mới `teamDaily`.
> 5. Bỏ tab DanhSachNhanVien trong Sheet SX (nhân viên quản lý ở Master Sheet).
> Bản trước 04/07/2026 (v2.1): Fix deploy Web App, kiểm tra quyền C trước khi ghi, endpoint version check.

---

## MỤC LỤC

- A. Kiến trúc hệ thống
- B. 11 Module
- C. Phân quyền RBAC — 6 tab, ma trận 1/0
- D. Cấu hình & biến quan trọng
- E. Cài đặt lần đầu
- F. Hosting trên GitHub Pages
- G. Cài app trên điện thoại (PWA)
- H. Vận hành hàng ngày
- I. Luồng điều hướng (Navigation)
- J. Session & bảo mật
- K. Cập nhật & bảo trì
- L. Các hàm chạy tay trong Apps Script
- M. Xử lý sự cố
- N. Danh sách file

---

## PHẦN A — Kiến trúc hệ thống

Frontend (PWA) → Google Apps Script (Web App) → Google Sheets (dữ liệu)

- **Frontend:** GitHub Pages — `https://tksx01quanganh.github.io/QA-P.ERP/`
- **Backend:** Google Apps Script, deploy dạng Web App (doGet + doPost)
- **Dữ liệu sản xuất (Sheet SX):** chỉ còn tab KetQua — thuần dữ liệu giao dịch. Apps Script gắn với sheet này.
- **Master data (trong Master Sheet):** MA_MAY (A-D: Mã, Tên, Ghi chú, Work station) và MA_CN (A-F: Mã, Tên, Ghi chú, Work station, Apply from, Apply to). Work station: CAT / TCO / GTB.
- **Phân quyền (RBAC):** Google Sheet riêng (MASTER_PHANQUYEN) chứa 6 tab
- **Đơn hàng:** Google Sheet riêng (Order List) cho tra cứu tiến độ
- **PWA:** Service Worker (network-first) + manifest.json, hoạt động offline

### Sơ đồ luồng dữ liệu

```
Điện thoại (PWA)
  │
  ├── index.html ────► Apps Script (doPost) ────► Sheet SX (KetQua)
  │   (ghi nhận SX)        │
  │                         └── Kiểm tra quyền "C" trước khi ghi
  │
  ├── index.html ────► Apps Script (doGet)  ────► Sheet SX (MA_MAY, MA_CN)
  │   (tải danh sách)
  │
  ├── index.html ────► Apps Script (doPost) ────► Master Sheet (NhanVien)
  │   (đăng nhập)           │
  │                         └──────────────────► Master Sheet (6 tab RBAC)
  │
  └── tien-do.html ──► Apps Script (doGet)  ────► Sheet Order List + KetQua
      (tra cứu tiến độ)     │
                             └── Aggregate KetQua (cột H-L) + match Order List
```

---

## PHẦN B — 11 Module

| Mã | Tên | Icon | Mô tả |
|----|-----|------|-------|
| PD | Sản xuất | 🏭 | Ghi nhận sản xuất, tiến độ đơn hàng |
| WH | Kho | 📦 | Nhập/xuất kho, tồn kho |
| PU | Mua hàng | 🛒 | Quản lý đơn mua hàng |
| SA | Bán hàng | 💰 | Quản lý đơn bán hàng |
| QC | Chất lượng | ✅ | Kiểm tra chất lượng |
| MA | Bảo dưỡng | 🔧 | Bảo trì thiết bị |
| QT | Kế toán QT | 📊 | Kế toán quản trị |
| AD | Admin | ⚙️ | Quản trị hệ thống |
| HR | Nhân sự | 👥 | Hành chính nhân sự |
| PL | Kế hoạch | 📅 | Lập kế hoạch sản xuất |
| DL | Giao hàng | 🚚 | Quản lý vận chuyển |

Hiện tại module PD (Sản xuất) đã hoàn thiện 2 chức năng: Ghi nhận sản xuất (index.html) và Tra cứu tiến độ đơn hàng (tien-do.html). Các module khác hiện ở dạng placeholder — grid hiển thị nhưng chức năng chưa phát triển.

---

## PHẦN C — Phân quyền RBAC — 6 tab, ma trận 1/0

### Nguyên tắc

Quyền là **ĐỘC LẬP** (không xếp bậc), tuân thủ Segregation of Duties. Có quyền "Phê duyệt" không tự động có quyền "Xem" — phải cấp riêng từng quyền.

### 6 loại quyền

| Mã | Tên | Mô tả |
|----|-----|-------|
| V | Xem | Chỉ đọc, không thao tác |
| C | Tạo | Tạo mới / nhập liệu |
| E | Sửa | Chỉnh sửa dữ liệu đã tạo |
| R | Kiểm tra | Xác nhận / review |
| A | Phê duyệt | Ký duyệt chính thức |
| D | Xóa | Xóa dữ liệu |

### Kiểm tra quyền — 2 lớp bảo vệ

**Lớp 1 — Frontend (index.html):** Khi nhấn vào chức năng nhập liệu (url = index.html), kiểm tra user có quyền "C" trong mảng `p.quyen`. Nếu chỉ có "V" → hiện thông báo "Bạn chỉ có quyền Xem, không có quyền Tạo dữ liệu" và chặn truy cập.

**Lớp 2 — Backend (Code.gs doPost):** Trước khi ghi dữ liệu sản xuất, đọc RBAC để xác minh user có quyền "C". Nếu không → trả lỗi `"Bạn không có quyền tạo dữ liệu (C)"`.

### 6 tab trong Master Sheet (MASTER_PHANQUYEN)

**Tab 1 — NhanVien:** Danh sách nhân viên

| Cột | Nội dung |
|-----|----------|
| A | Mã NV |
| B | Tên nhân viên |
| C | Username (đăng nhập) |
| D | Mật khẩu (tự mã hóa SHA-256 sau lần đầu đăng nhập) |
| E | Trạng thái (Active / Inactive) |

**Tab 2 — VaiTro:** Định nghĩa vai trò

| Cột | Nội dung |
|-----|----------|
| A | Mã vai trò (VD: NV_SX, TP_SX, GD, ADMIN) |
| B | Tên vai trò |
| C | Mô tả |

**Tab 3 — ChucNang:** Danh mục chức năng

| Cột | Nội dung |
|-----|----------|
| A | Mã CN (VD: PD_GNSX, PD_TDDH, AD_QLHT) |
| B | Mã module (VD: PD, WH, AD) |
| C | Tên chức năng |
| D | URL (file HTML tương ứng, VD: index.html, tien-do.html) |

Quy ước mã CN: `[MÃ_MODULE]_[MÃ_NGHIỆP_VỤ]`, đánh mã kiểu `A01, A02...` cho biến thể của cùng nghiệp vụ (cột Tên chức năng ghi rõ nghĩa). Ví dụ hiện dùng:

| Mã CN | Tên chức năng | URL |
|-------|---------------|-----|
| PD_A01 | Ghi nhận KQSX Cắt/Thủ công | index.html?branch=CT |
| PD_A02 | Ghi nhận KQSX Giấy/Thùng/Bìa | index.html?branch=GTB |
| PD_TDDH | Tra cứu tiến độ Sản xuất | tien-do.html |

Chức năng có `?branch=` → app vào thẳng nhánh đó theo phân quyền (ai không có quyền không thấy). Mã cũ PD_GNSX (url `index.html` không tham số) vẫn chạy: hiện màn chọn 2 nhánh — nên thay bằng PD_A01/PD_A02 rồi xóa dòng cũ.

**Tab 4 — Quyen:** Bảng tham chiếu (tự tạo bởi setupMasterSheet)

| Cột | Nội dung |
|-----|----------|
| A | Mã quyền (V, C, E, R, A, D) |
| B | Tên quyền |
| C | Mô tả |

**Tab 5 — GanVaiTro:** Gán vai trò cho nhân viên (danh sách dài — mỗi dòng = 1 lượt gán có hiệu lực riêng)

| Cột | Nội dung |
|-----|----------|
| A | Mã NV |
| B | Tên NV (tự điền bằng script `updateGanVaiTroNames()`) |
| C | Mã vai trò |
| D | Apply from — ngày bắt đầu hiệu lực (trống = từ trước đến nay) |
| E | Apply to — ngày hết hiệu lực (trống = vô thời hạn) |
| F | Trạng thái — trống/Active = dùng; Inactive = khóa dòng gán này |

Một nhân viên có thể được gán nhiều vai trò (nhiều dòng cùng Mã NV). **Đổi vai trò theo kế hoạch:** thêm dòng mới với Apply from = ngày chuyển, điền Apply to cho dòng cũ — hệ thống tự nhận đúng ngày, lịch sử giữ nguyên. Nguyên tắc quản trị: **nhập ở danh sách này, xem tổng quan bằng tab pivot riêng** (nếu cần ma trận NV × chức năng thì tạo tab công thức chỉ để đọc, không nhập tay vào ma trận).

**Tab 6 — PhanQuyen:** Ma trận quyền 1/0

| Mã vai trò | Mã chức năng | V-Xem | C-Tạo | E-Sửa | R-Kiểm tra | A-Phê duyệt | D-Xóa | Trạng thái |
|------------|-------------|-------|-------|-------|-----------|-------------|-------|-----------|
| NV_SX | PD_GNSX | 1 | 1 | 0 | 0 | 0 | 0 | Active |
| NV_SX | PD_TDDH | 1 | 0 | 0 | 0 | 0 | 0 | Active |
| TP_SX | PD_GNSX | 1 | 0 | 0 | 1 | 0 | 0 | Active |
| GD | PD_TDDH | 1 | 0 | 0 | 0 | 1 | 0 | Active |
| ADMIN | AD_QLHT | 1 | 1 | 1 | 1 | 1 | 1 | Active |

Giá trị: `1` = có quyền, `0` = không có quyền. Trạng thái mặc định là Active (ô trống cũng tính Active, chỉ bỏ qua khi ghi rõ "inactive").

### Luồng xác thực

1. Nhân viên đăng nhập bằng Username + Mật khẩu
2. Script đọc tab NhanVien → xác thực → lấy Mã NV
3. Đọc tab GanVaiTro → lấy danh sách vai trò của nhân viên
4. Đọc tab ChucNang → lấy danh mục chức năng (module, tên, URL)
5. Đọc tab PhanQuyen → lấy ma trận quyền 1/0 cho từng vai trò × chức năng
6. Gộp kết quả → trả về `permissions[]` cho frontend

---

## PHẦN D — Cấu hình & biến quan trọng

### Trong Code.gs (backend)

| Biến | Giá trị | Mô tả |
|------|---------|-------|
| `MASTER_SHEET_ID` | `1nd0WmT5dMZU1_ylAwrC4yIr1RhitzO28hnzvBO_JZzs` | ID Google Sheet RBAC (Master) |
| `ORDERLIST_SHEET_ID` | `1Ty0O9f5HWdvyKvv_MmJjkOBX1aS0ufbH` | ID Google Sheet đơn hàng (Order List) |
| `ORDERLIST_TAB` | `DATA COMBINE` | Tên tab đơn hàng |
| `SHEET_DATA` | `KetQua` | Tab ghi kết quả sản xuất |
| `SHEET_NAMES` | `DanhSachNhanVien` | Tab danh sách nhân viên (Sheet SX) |
| `SHEET_MAY` | `MA_MAY` | Tab danh sách máy |
| `SHEET_CN` | `MA_CN` | Tab danh sách công nhân |

**Biến OL — Mapping cột Order List:** Tên header CHÍNH XÁC trong sheet DATA COMBINE. Nếu header sheet khác tên → chỉ sửa giá trị bên phải.

| Code field | Header trong sheet | Cột tham khảo |
|------------|-------------------|---------------|
| `ngaygiao` | Ngày yêu cầu giao hàng | A |
| `lsx` | LSX | B |
| `lsxct` | LSX CT | C |
| `masp` | Mã sản phẩm | D |
| `mota` | Mô tả sản phẩm | E |
| `dvt` | Đơn vị tính | G |
| `soluong` | Số lượng đặt hàng | K |
| `khachhang` | Khách hàng | N |

**Cache TTL:**

| Biến | Giá trị | Mô tả |
|------|---------|-------|
| `CACHE_KQ` | 900 (15 phút) | Cache aggregation KetQua |
| `CACHE_OL` | 1800 (30 phút) | Cache Order List |
| `CACHE_CUST` | 1800 (30 phút) | Cache danh sách khách hàng |
| `CACHE_TD` | 300 (5 phút) | Cache tổng hợp Tổ/Ngày (teamDaily) |

### Trong index.html và tien-do.html (frontend)

| Biến | Giá trị |
|------|---------|
| `CONFIG.APPS_SCRIPT_URL` | `https://script.google.com/macros/s/AKfycbweJ234d0G0CTZfSwd21tX-EzWq29K-XHELqBh0ho0MQv2YMJ1-9nv0ZHz_Mv9_V_Ns/exec` |

### Trong sw.js (Service Worker)

| Biến | Giá trị | Mô tả |
|------|---------|-------|
| `CACHE` | `qap-erp-v20` | Tên cache hiện tại. Tăng version để force update PWA |

### Trong manifest.json

| Thuộc tính | Giá trị |
|------------|---------|
| `name` | QA-P.ERP |
| `display` | standalone |
| `theme_color` | #0f766e (teal) |
| `start_url` | ./ |

---

## PHẦN E — Cài đặt lần đầu

### E1. Google Sheet dữ liệu sản xuất

1. Tạo Google Sheet mới
2. Mở **Tiện ích mở rộng → Apps Script** → dán nội dung file `Code.gs`
3. Chạy hàm `setupSheets()` → tạo tab KetQua (Sheet SX chỉ có tab này)

### E1b. Danh mục Máy & Công nhân (trong Master Sheet — từ v2.3)

**Tab MA_MAY:** cột A=Mã, B=Tên, C=Ghi chú, **D=Work station** (CAT / TCO / GTB)

**Tab MA_CN:** cột A=Mã, B=Tên, C=Ghi chú, **D=Work station**, **E=Apply from**, **F=Apply to**

- **Work station:** dùng để (1) lọc danh sách máy/công nhân theo nhánh khi ghi nhận, (2) phân tổ khi tổng hợp Tổ/Ngày. Để trống → hiện ở mọi nhánh / tổ "Khác".
- **Apply from / Apply to (chỉ MA_CN):** khoảng ngày hiệu lực. Backend chỉ trả công nhân có `E ≤ hôm nay ≤ F`; ô trống = không giới hạn. **Chuyển tổ:** thêm dòng mới (cùng Mã CN, tổ mới, Apply from = ngày chuyển) và điền Apply to vào dòng cũ — giữ được lịch sử.
- Đang dùng bản cũ? Chạy `migrateMayCN()` trong Apps Script để tự copy 2 tab từ Sheet SX sang Master (không ghi đè nếu Master đã có dữ liệu). Kiểm tra OK rồi mới xóa 2 tab cũ ở Sheet SX.

### E2. Master Sheet phân quyền (RBAC 6-tab)

1. Tạo Google Sheet mới, đặt tên "MASTER_PHANQUYEN"
2. Copy ID từ URL (phần giữa `/d/` và `/edit`), dán vào biến `MASTER_SHEET_ID` trong Code.gs
3. Chạy hàm `setupMasterSheet()` → tự tạo 6 tab: NhanVien, VaiTro, ChucNang, Quyen, GanVaiTro, PhanQuyen
4. Chạy `migrateEmployees()` để copy nhân viên từ Sheet SX sang Master Sheet
5. Mở tab **VaiTro** → thêm các vai trò (VD: NV_SX, TP_SX, GD, ADMIN)
6. Mở tab **ChucNang** → thêm chức năng, mỗi dòng = 1 chức năng:
   - Cột A: Mã CN (VD: PD_GNSX)
   - Cột B: Mã module (VD: PD)
   - Cột C: Tên chức năng (VD: Ghi nhận sản xuất)
   - Cột D: URL (VD: index.html)
7. Mở tab **GanVaiTro** → gán vai trò cho nhân viên (cột A: Mã NV, cột C: Mã vai trò). Chạy `updateGanVaiTroNames()` để tự điền cột B (Tên NV)
8. Mở tab **PhanQuyen** → điền 1/0 cho từng quyền (V/C/E/R/A/D) theo ma trận. Hoặc chạy `resetPhanQuyen()` để tạo 8 dòng mẫu

### E3. Liên kết Order List (tùy chọn)

1. Copy ID Google Sheet chứa dữ liệu đơn hàng, dán vào `ORDERLIST_SHEET_ID` trong Code.gs
2. Đảm bảo tài khoản chạy Apps Script có quyền xem Sheet đó
3. Kiểm tra header sheet DATA COMBINE trùng khớp với biến `OL` trong Code.gs

### E4. Deploy Apps Script

1. Trong Apps Script: **Triển khai → Triển khai mới → Ứng dụng web**
2. Thực thi với tư cách: **Tôi**. Ai có quyền truy cập: **Bất kỳ ai**
3. Copy URL (kết thúc bằng `/exec`) → dán vào `CONFIG.APPS_SCRIPT_URL` trong `index.html` và `tien-do.html`
4. Kiểm tra: truy cập `URL?action=version` → phải trả về `{"result":"ok","version":"2.0"}`

---

## PHẦN F — Hosting trên GitHub Pages

1. Tạo repository trên GitHub (VD: `QA-P.ERP`)
2. Đẩy các file lên branch `main`: index.html, tien-do.html, sw.js, manifest.json, icon.svg, icon-192.png, icon-512.png, logo.jpg
3. Vào **Settings → Pages → Source:** Deploy from branch `main` / `/ (root)`
4. Link app: `https://tksx01quanganh.github.io/QA-P.ERP/`

**Lưu ý khi cập nhật file:**
- Sau khi push lên GitHub, cần tăng version cache trong sw.js (VD: `qap-erp-v13` → `v14`)
- Phải xóa file cũ rồi dán file mới vào (không upload đè)
- Người dùng cần Ctrl+Shift+R (PC) hoặc đóng/mở lại app (điện thoại) để nhận bản mới

---

## PHẦN G — Cài app trên điện thoại (PWA)

1. Mở Chrome trên điện thoại → vào `https://tksx01quanganh.github.io/QA-P.ERP/`
2. Bấm **⋮** (menu 3 chấm) → **Thêm vào Màn hình chính** (Add to Home Screen)
3. App hiển thị fullscreen như app native, có logo Quang Anh
4. Lần đầu quét QR sẽ hỏi quyền camera → bấm **Cho phép**

### Tính năng PWA

- Hoạt động offline (cache danh sách máy/CN đã tải)
- Hàng đợi gửi dữ liệu khi mất mạng (tự gửi lại khi có mạng)
- Network-first strategy: luôn lấy dữ liệu mới nhất từ server, fallback cache khi offline

---

## PHẦN H — Vận hành hàng ngày

### Đăng nhập

Nhập Username + Mật khẩu → hệ thống xác thực → hiện grid 11 module. Module có quyền hiện bình thường với tag quyền (V, C, E...). Module không có quyền hiện xám + khóa 🔒.

### Ghi nhận sản xuất (PD_GNSX) — Cần quyền "C"

1. Chọn module **Sản xuất** → **Ghi nhận sản xuất** → chọn nhánh:
   - **✂️ Cắt / Thủ công:** quét QR → nhập khối lượng thực tế (kg) → Xác nhận (như cũ)
   - **📦 Giấy / Thùng / Bìa:** chỉ quét QR — KL thực tế tự động = KL(QR), KHÔNG hỏi nhập tay. Sau MỖI lần quét app tự khóa, phải bấm **"Quét tiếp"** mới nhận QR mới (tránh quét trùng liên tục). Nếu QR thiếu KL hợp lệ → app vẫn hỏi nhập tay. Nhập thủ công (không camera): bỏ trống ô KL sẽ tự lấy phần 4 của mã SP
2. Hệ thống kiểm tra quyền "C": nếu chỉ có "V" → chặn truy cập, hiện thông báo
3. Chọn Máy (từ danh sách hoặc nhập tay) — danh sách ĐÃ LỌC theo nhánh: Cắt/TC chỉ hiện máy tổ CAT+TCO, GTB chỉ hiện máy tổ GTB (máy chưa gán tổ hiện ở cả 2)
4. Chọn Công nhân (từ danh sách hoặc nhập tay) — lọc theo nhánh tương tự, và chỉ hiện công nhân đang hiệu lực (Apply from/to trong MA_CN)
5. Quét liên tục, xem danh sách, sửa/xóa nếu cần
6. Bấm **Gửi tất cả lên Google Sheet** khi xong
7. Backend kiểm tra quyền "C" lần nữa trước khi ghi → đảm bảo an toàn

Nhánh do NGƯỜI DÙNG chọn trên menu quyết định cách nhập KL (không phụ thuộc cột D MA_MAY). Cột D MA_MAY chỉ dùng để phân tổ khi tổng hợp Tổ/Ngày.

Dữ liệu QR gồm 4 phần: `LSX/SốLượng/ĐơnVịTính/KL` (phần 1 ghi vào cột H "LSX", phần 4 = KL QR ghi vào cột K). Máy nhập tay (không có trong MA_MAY) khi tổng hợp Tổ/Ngày sẽ xếp vào "Khác".

### Tra cứu tiến độ Sản xuất (PD_TDDH) — Chỉ cần quyền "V"

Vào là hiện màn hình chọn 1 trong 2 kiểu (vẫn có thanh tab để chuyển nhanh):

**Kiểu A — Theo LSX / Khách hàng / Mã hàng:** tìm theo khách hàng / LSX / mã SP / mô tả. Hiển thị % hoàn thành với thanh tiến độ.

**Cách tính tiến độ:** Backend đọc cột H-L trong tab KetQua (tối ưu cho 100K+ dòng), aggregate theo LSX (SL = cột I, KL = cột K), rồi match với Order List qua LSXCT (ưu tiên) hoặc LSX (fallback).

**Kiểu B — Theo Tổ/Ngày:** chọn khoảng ngày (Từ/Đến cùng 1 hàng; nút nhanh: Hôm nay / 7 ngày / 30 ngày, tối đa 62 ngày) + **chọn nhiều Tổ bằng chip** (Cắt / Thủ công / GTB / Khác — mặc định chọn hết, bật/tắt không cần tải lại; bỏ chọn hết → app nhắc chọn ít nhất 1 tổ) → mỗi ngày 1 thẻ hiển thị tổng SL + tổng KL + số lượt (tổng tính lại theo các tổ đang chọn). Chi tiết dạng **cây Tổ → Máy → LSX**: mỗi tổ liệt kê từng máy (mã + tên, SL/KL/lượt), trong mỗi máy là bảng LSX riêng của máy đó. Mặc định mở hết, bấm dòng tổ/máy (▶) để đóng/mở. Tiêu đề cột được đóng băng (sticky) khi cuộn. Tổ suy từ Mã máy (cột C KetQua) tra sang MA_MAY cột D — dữ liệu cũ trước v2.2 vẫn phân tổ được.

### Mật khẩu

- Lần đầu đăng nhập: mật khẩu tự động mã hóa SHA-256 và ghi đè vào Master Sheet
- Đổi mật khẩu: xóa ô mật khẩu trong tab NhanVien (Master Sheet), gõ mật khẩu mới dạng thường → hệ thống sẽ tự mã hóa lần đăng nhập kế tiếp

---

## PHẦN I — Luồng điều hướng (Navigation)

### Cấu trúc màn hình

```
Đăng nhập (screenLogin)
  └── Grid Module (screenModules)
        └── Chức năng module (screenFuncs) [nếu module có > 1 chức năng]
              ├── Ghi nhận SX: Chọn Máy → Chọn CN → Quét (screenScan) → Danh sách (screenList)
              │   ⚠ Chỉ vào được nếu có quyền "C"
              └── Tiến độ: tien-do.html
                  ⚠ Chỉ cần quyền "V"
```

### Nút điều hướng

Mọi màn hình (trừ Login và Grid Module) đều có 2 nút trên topbar:

| Vị trí | Nút | Hành động |
|--------|-----|-----------|
| Trái | ← (quay lại) | Về màn hình level trên (VD: từ Chọn CN → Chọn Máy) |
| Phải | 🏠 (home) | Về Grid Module (màn hình chọn module sau đăng nhập) |

### Trang tien-do.html

- Nút ← : `history.back()` (quay lại trang trước), fallback về index.html
- Nút 🏠 : chuyển về index.html → boot() phục hồi session → hiện Grid Module (không cần đăng nhập lại)

---

## PHẦN J — Session & bảo mật

### Session persistence (sessionStorage)

Khi đăng nhập thành công, frontend lưu session vào `sessionStorage`:

```
Key: "ghinhan_session"
Value: { user, maNV, username, permissions[], ts }
```

Tác dụng: khi người dùng chuyển từ tien-do.html quay lại index.html, hàm `boot()` đọc session này và khôi phục trạng thái đăng nhập → hiện Grid Module thay vì màn hình Login.

Session hết hạn sau 8 giờ. Đăng xuất sẽ xóa session.

### localStorage (dữ liệu bền vững)

| Key | Mô tả |
|-----|-------|
| `ghinhan_rows` | Dữ liệu quét chưa gửi (backup khi mất mạng) |
| `ghinhan_machines` | Cache danh sách máy |
| `ghinhan_workers` | Cache danh sách công nhân |
| `ghinhan_queue` | Hàng đợi gửi khi offline |
| `ghinhan_last_username` | Username lần đăng nhập gần nhất (prefill) |

### Mã hóa mật khẩu

- Sử dụng SHA-256 (một chiều, không giải mã được)
- Lần đầu đăng nhập: mật khẩu thường → hash → ghi đè vào Master Sheet
- Các lần sau: hash input → so sánh với hash đã lưu

### Kiểm soát quyền ghi dữ liệu

- Frontend chặn truy cập nhập liệu nếu không có quyền "C"
- Backend kiểm tra RBAC trước khi ghi vào KetQua — nếu user không có quyền "C" trên bất kỳ chức năng nào → trả lỗi
- Hai lớp bảo vệ này hoạt động độc lập: dù bypass frontend (gọi API trực tiếp), backend vẫn chặn

---

## PHẦN K — Cập nhật & bảo trì

### Thêm nhân viên

1. Thêm dòng trong tab NhanVien (Master Sheet): Mã NV, Tên, Username, Mật khẩu, Trạng thái
2. Thêm dòng trong GanVaiTro: Mã NV + Mã vai trò
3. Chạy `updateGanVaiTroNames()` để tự điền tên

### Thêm chức năng mới

1. Thêm dòng trong tab ChucNang (VD: WH_NHKTP, WH, Nhập kho thành phẩm, nhap-kho.html)
2. Thêm dòng trong PhanQuyen: điền 1/0 cho từng quyền
3. Tạo file HTML cho chức năng mới
4. Đẩy file lên GitHub

### Thêm vai trò mới

1. Thêm dòng ở VaiTro (Mã vai trò, Tên, Mô tả)
2. Thêm các dòng tương ứng ở PhanQuyen cho từng chức năng cần cấp quyền

### Thêm module mới

- Có thể liên kết Google Sheet khác bằng `SpreadsheetApp.openById()`
- Thêm file HTML + đăng ký trong ChucNang

### Sửa code Apps Script (QUAN TRỌNG)

1. Sửa code trong Apps Script editor → Lưu (Ctrl+S)
2. Vào **Triển khai → Quản lý triển khai → nhấn bút chì ✏️ → Phiên bản: Phiên bản mới → Triển khai**
3. Kiểm tra: truy cập `URL?action=version` → xác nhận trả về version mới

⚠ **KHÔNG nhấn "Triển khai mới"** — sẽ tạo URL mới, URL cũ vẫn chạy code cũ. Phải CẬP NHẬT triển khai hiện có.

### Sửa frontend

1. Sửa file HTML/JS
2. Đẩy lên GitHub
3. Tăng version cache trong sw.js (VD: `qap-erp-v13` → `qap-erp-v14`)
4. Người dùng cần hard refresh hoặc đóng/mở lại app

---

## PHẦN L — Các hàm chạy tay trong Apps Script

### Hàm setup (chạy 1 lần)

| Hàm | Mục đích |
|-----|----------|
| `setupSheets()` | Tạo tab KetQua trong Sheet SX |
| `setupMasterSheet()` | Tạo/cập nhật 6 tab RBAC trong Master Sheet (giữ nguyên MA_MAY, MA_CN nếu có) |
| `migrateMayCN()` | (v2.3) Copy MA_MAY + MA_CN từ Sheet SX sang Master, tạo sẵn cột D/E/F. Không ghi đè nếu Master đã có dữ liệu |
| `migrateEmployees()` | (Cũ) Copy nhân viên từ tab DanhSachNhanVien sang Master Sheet — đã dùng xong, tab nguồn đã xóa |

### Hàm vận hành

| Hàm | Mục đích |
|-----|----------|
| `updateGanVaiTroNames()` | Cập nhật cột Tên NV trong tab GanVaiTro (đọc từ NhanVien, ghi dạng plain text — không dùng VLOOKUP) |
| `resetPhanQuyen()` | Reset tab PhanQuyen về 8 dòng mẫu (khi dữ liệu bị hỏng/sai). Xóa cả data validations trước khi ghi |
| `clearOrderCache()` | Xóa cache Order List (khi cần thấy dữ liệu đơn hàng mới ngay) |

### Hàm chẩn đoán

| Hàm | Mục đích |
|-----|----------|
| `debugRBAC()` | Kiểm tra trạng thái 6 tab + test phân quyền cho nhân viên đầu tiên |
| `fixEmployeeStatusDropdown()` | Thêm dropdown Trạng thái cho tab DanhSachNhanVien (sheet SX cũ) |

### API endpoints

| Action | Method | Mô tả |
|--------|--------|-------|
| `version` | GET | Kiểm tra phiên bản code đang deploy |
| `machines` | GET | Danh sách máy — đọc MA_MAY ở Master (fallback Sheet SX), kèm ws |
| `workers` | GET | Danh sách công nhân — đọc MA_CN ở Master (fallback Sheet SX), kèm ws, CHỈ dòng đang hiệu lực Apply from/to |
| `names` | GET | Lấy danh sách tên nhân viên (default) |
| `orderCustomers` | GET | Lấy danh sách khách hàng unique từ Order List |
| `orderSearch` | GET | Tìm đơn hàng + aggregate tiến độ từ KetQua (SL cột I, KL cột K). LSX gần nhất trước, tối đa 300 dòng |
| `teamDaily` | GET | Tổng hợp SL + KL theo Tổ/Ngày, cấu trúc cây Tổ → Máy → LSX (`to[].may[].lsx[]`, tổ kèm `lsxCount`). Tham số: `from`, `to` (yyyy-mm-dd, tối đa 62 ngày). Cache 5 phút |
| `login` | POST | Đăng nhập (xác thực + trả permissions) |
| (save) | POST | Ghi dữ liệu sản xuất — kiểm tra quyền "C" trước khi ghi |

---

## PHẦN M — Xử lý sự cố

### Module grid không hiện sau đăng nhập

**Nguyên nhân:** Tab PhanQuyen trống hoặc dữ liệu bị hỏng → getPermissions_() trả về mảng rỗng.

**Giải pháp:**
1. Chạy `resetPhanQuyen()` trong Apps Script
2. Chạy `debugRBAC()` để kiểm tra → xem Nhật ký thực thi
3. Kiểm tra tab GanVaiTro đã gán vai trò cho nhân viên chưa

### Tiến độ sản xuất luôn hiện 0

**Nguyên nhân có thể:**
1. Web app chạy code cũ → kiểm tra bằng `?action=version`
2. URL trong index.html/tien-do.html không trùng với URL triển khai hiện tại
3. Cache cũ → chạy `clearOrderCache()` trong Apps Script

**Giải pháp:** Truy cập `URL?action=version`. Nếu không trả về version → web app chưa deploy đúng. Xem phần K "Sửa code Apps Script".

### Nhân viên chỉ có quyền Xem nhưng vẫn nhập liệu được

**Nguyên nhân:** Code cũ không kiểm tra quyền. Đã fix trong v2.1.

**Giải pháp:** Cập nhật Code.gs (có kiểm tra quyền "C" trong doPost) + cập nhật index.html (chặn truy cập nhập liệu khi chỉ có "V"). Deploy lại.

### Nút 🏠 ra màn hình đăng nhập thay vì Grid Module

**Nguyên nhân:** Session chưa được lưu vào sessionStorage, hoặc cache PWA cũ chưa cập nhật.

**Giải pháp:**
1. Đảm bảo file index.html đã có hàm `boot()` với đoạn khôi phục sessionStorage
2. Tăng version sw.js → đẩy lên GitHub
3. Hard refresh: Ctrl+Shift+R (PC) hoặc đóng/mở lại app (điện thoại)

### VLOOKUP #ERROR! trong GanVaiTro

**Nguyên nhân:** Google Sheets locale Tiếng Việt dùng dấu `;` thay vì `,` trong công thức.

**Giải pháp:** Không dùng VLOOKUP. Chạy `updateGanVaiTroNames()` để điền tên bằng script (ghi plain text).

### Lỗi validation khi chạy setupMasterSheet hoặc resetPhanQuyen

**Nguyên nhân:** Tab PhanQuyen cũ có data validation (dropdown) trên cột → ghi giá trị mới bị chặn.

**Giải pháp:** Code đã xử lý bằng `clearDataValidations()` trước khi ghi. Nếu vẫn lỗi, xóa tay tab PhanQuyen rồi chạy lại.

### Dữ liệu không cập nhật sau khi sửa code

**Giải pháp cho Apps Script:** Triển khai → Quản lý triển khai → bút chì → chọn **Phiên bản mới** → Triển khai. KHÔNG nhấn "Triển khai mới".

**Giải pháp cho frontend:** Tăng version cache sw.js + đẩy lên GitHub.

### Bấm chức năng không vào được (quay lại màn hình module)

**Nguyên nhân có thể:**
1. Mất kết nối tạm thời (network loss) — API call login/session bị timeout, app quay lại màn hình trước
2. Service Worker phục vụ file cũ từ cache — index.html mới chưa được tải
3. Apps Script chưa deploy phiên bản mới (URL vẫn trỏ code cũ)

**Giải pháp:**
1. Kiểm tra mạng, thử lại sau vài giây
2. Tăng version cache sw.js (VD: `qap-erp-v20` → `qap-erp-v21`) + đẩy lên GitHub
3. Triển khai Apps Script: Quản lý triển khai → bút chì → **Phiên bản mới** → Triển khai
4. Hard refresh: đóng app hoàn toàn rồi mở lại (điện thoại) hoặc Ctrl+Shift+R (PC)

### File đẩy lên GitHub không thay đổi

**Lưu ý:** Phải xóa file cũ rồi dán file mới vào (không upload đè). Đây là workaround đã xác nhận hoạt động.

---

## PHẦN N — Danh sách file

### File deploy lên GitHub Pages

| File | Mô tả |
|------|-------|
| `index.html` | Trang chính: đăng nhập → grid module → chọn chức năng → ghi nhận sản xuất (quét QR) |
| `tien-do.html` | Tra cứu tiến độ đơn hàng (tìm theo khách hàng / LSX) |
| `xuat-hang.html` | Đối chiếu xuất hàng — quét QR đối chiếu theo DN, tiến độ SL+KL, offline queue |
| `sw.js` | Service Worker — cache version: `qap-erp-v21`, network-first strategy |
| `manifest.json` | PWA manifest — name: QA-P.ERP, display: standalone |
| `icon.svg` | Icon SVG |
| `icon-192.png` | Icon 192×192 (logo Quang Anh) |
| `icon-512.png` | Icon 512×512 (logo Quang Anh) |
| `logo.jpg` | Logo gốc công ty |

### File tham khảo (không deploy lên GitHub)

| File | Mô tả |
|------|-------|
| `Code.gs` | Backend Apps Script v2.7 — RBAC, login, orderSearch, teamDaily, master data, kiểm tra quyền C, GanVaiTro hiệu lực theo ngày |
| `Code_XuatHang.gs` | Backend riêng cho Xuất hàng — gắn vào Google Sheet xuất hàng. Tab DN_LSX + DN_ScanLog. Deploy Web App riêng |
| `HUONG_DAN.md` | File hướng dẫn này |

### Thư viện ngoài sử dụng

| Thư viện | Phiên bản | Mục đích |
|----------|-----------|----------|
| html5-qrcode | 2.3.8 | Quét QR code bằng camera (CDN: unpkg.com) |
