# Twibbon Video Generator (Web App)

Aplikasi web instan untuk membuat Twibbon beranimasi video untuk Mahasiswa Baru (Maba). Maba cukup upload foto, atur crop/posisi, lalu sistem akan otomatis menggabungkan **Video Animasi Intro** dengan **Foto Maba + Frame Twibbon** menjadi file video MP4 siap download.

---

## 🚀 Cara Menjalankan

Kamu bisa membuka file `index.html` langsung di browser atau menggunakan live server lokal (seperti VS Code Live Server, `npx serve`, atau ditaruh di folder `public` Laravel):

```bash
# Contoh menjalankan web server lokal ringan:
npx serve .
# Atau dengan python:
python -m http.server 8080
```

---

## 📁 Struktur Folder & File

```
d:/Gawe/LPKIA/
├── index.html            # Halaman utama aplikasi (UI Flat, Mobile-Friendly)
├── README.md             # Petunjuk penggunaan
└── assets/
    ├── css/
    │   └── style.css     # Styling flat (solid color, tanpa gradient)
    ├── js/
    │   └── app.js        # Core Video & Canvas Compositor + Cropper engine
    ├── frame.svg         # File frame twibbon vektor transparan
    └── intro.mp4         # (Opsional) Video animasi pembuka
```

---

## 🎨 Cara Mengganti Video Intro & Frame Twibbon

1. **Mengganti Frame Twibbon:**
   - Siapkan file SVG (atau PNG transparan).
   - Pastikan bagian tengah tempat foto berstatus transparan (bolong).
   - Simpan / replace file ke: `assets/frame.svg` (atau `assets/frame.png`).

2. **Mengganti Video Intro:**
   - Siapkan video intro format `.mp4` (rasio 1:1 square disarankan 1080x1080).
   - Simpan / replace file ke: `assets/intro.mp4`.
   - *Catatan:* Jika file `assets/intro.mp4` belum ada, web otomatis menggunakan generator animasi intro bawaan untuk keperluan demo/testing.

3. **Mengatur Durasi Tampilan Twibbon Foto:**
   - Buka menu **"Pengaturan"** di pojok kanan atas web, atau ubah nilai `holdPhotoDuration: 5` di file `assets/js/app.js`.

---

## ✨ Fitur-Fitur:
- **Zero Server Load:** Rendering 100% diproses langsung di browser client (HP/Laptop maba).
- **Panduan Frame pada Cropper:** Maba bisa melihat siluet/outline frame saat menggeser foto agar posisi wajah pas.
- **Dual Export:** Bisa unduh versi Video (MP4) dan versi Foto Diam (PNG High-Res).
- **Responsive & Flat Design:** Tampilan bersih, minimalis, dan sangat mudah digunakan di smartphone.
