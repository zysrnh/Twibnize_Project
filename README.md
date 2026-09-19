# Twibbon Video Generator - PKKMB SADAJIWA IDE LPKIA 2026

Aplikasi Web Pembuat Twibbon Video Animasi Mahasiswa Baru. 100% diproses langsung di browser client (zero server-load), cepat, hemat bandwidth, dan sudah dioptimasi untuk cPanel / Apache / LiteSpeed hosting.

---

## 📁 Struktur Folder Project (cPanel Ready)

```
/ (public_html)
├── index.html                   # Halaman utama aplikasi (Entry Point)
├── .htaccess                    # Konfigurasi cPanel (Video streaming & Gzip)
├── .gitignore                   # Ignore file sampah/temporary
├── README.md                    # Dokumentasi & panduan
└── assets/
    ├── css/
    │   └── style.css            # Styling Flat PKKMB LPKIA
    ├── js/
    │   └── app.js               # Mesin Canvas Compositor, Chroma Key & Cropper
    ├── images/
    │   ├── Logo_PKKMB.png       # Logo resmi PKKMB LPKIA
    │   ├── zyrsnh.png           # Watermark developer
    │   └── twibon.svg           # Frame twibbon vektor resmi
    └── videos/
        └── Framenaur.mp4        # Video animasi intro resmi (Full HD)
```

---

## 🚀 Cara Upload / Hosting ke cPanel

1. **Kompres Jadi ZIP:**
   - Pilih semua file & folder di dalam project (`index.html`, `.htaccess`, `assets/`, dll).
   - Klik kanan $\rightarrow$ **Send to / Compress to ZIP**.

2. **Upload ke cPanel:**
   - Buka **cPanel** $\rightarrow$ buka menu **File Manager**.
   - Masuk ke folder root domain abang (biasanya `public_html` atau sub-domain seperti `public_html/twibbon`).
   - Klik **Upload**, pilih file ZIP tadi.

3. **Ekstrak File:**
   - Klik kanan pada file ZIP di File Manager $\rightarrow$ klik **Extract**.
   - Pastikan file `.htaccess` dan `index.html` berada tepat di folder utama tersebut.
   - Selesai! Web langsung online dan bisa diakses maba.

---

## ✨ Fitur-Fitur Utama:
- **Zero Server Load:** Rendering video MP4/WebM 100% diproses di HP maba masing-masing.
- **Rasio 4:5 Murni (1080 x 1350 px):** Pas untuk Instagram Feed & WhatsApp Status tanpa garis hitam.
- **Ultra High Bitrate (16 Mbps):** Kualitas video sangat jernih dan tajam.
- **Auto Chroma Key:** Otomatis menghilangkan green-screen pada frame SVG.
- **Twibbonize Free-Move Mode:** Geser dan pinch zoom foto dengan bebas dan mulus.
- **Magical Starburst Crossfade:** Transisi sinematik menyatu dengan sihir burung hantu LPKIA.
