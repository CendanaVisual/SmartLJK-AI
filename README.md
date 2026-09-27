# 🎓 SmartLJK AI

**Pembuat LJK (Lembar Jawaban Komputer) & Pemeriksa Jawaban Otomatis Berbasis AI**

> Aplikasi web ringan yang mengintegrasikan Computer Vision (OpenCV) untuk OMR dan AI (Gemini) untuk analisis tulisan tangan siswa.

## 🚀 Fitur Utama

### 📝 Pembuat LJK (Beranda)
- Generator template LJK PDF/printable dengan anchor markers dan QR Code
- Mendukung 5 tipe soal:
  - ✅ Pilihan Ganda (Single Choice A-D)
  - ☑️ Pilihan Ganda Kompleks (Multi Choice)
  - ⭕ Benar/Salah (B/S)
  - 🔗 Menjodohkan (Matching Matrix)
  - ✍️ Isian Singkat (Handwriting OCR)
- Pratinjau realtime LJK ukuran A4
- Cetak/export PDF presisi

### 📷 Scan LJK (Pemeriksa Otomatis)
- Upload foto, drag & drop, atau kamera langsung
- Pemindaian PDF multi-halaman (hingga 32 lembar)
- OMR otomatis dengan OpenCV (perspective warp, bubble detection)
- AI OCR untuk isian singkat tulisan tangan (Gemini Vision)
- Hasil evaluasi instan dengan skor dan feedback

### 📊 Dashboard Guru
- Statistik kelas (rata-rata, tertinggi/terendah, kelulusan)
- Rekap nilai siswa dengan peringkat
- Detail per-siswa termasuk skor OMR dan AI
- Ekspor laporan Excel multi-sheet

### 🤖 Generator Soal AI
- Generate soal berbasis Taksonomi Bloom (C1-C6)
- Mendukung semua 5 tipe soal
- Output: Lembar Soal + Pegangan Guru
- Impor langsung ke LJK Builder

## 🛠️ Teknologi

| Komponen | Teknologi |
|----------|-----------|
| Frontend | HTML5, CSS3, JavaScript ES6+ (Vanilla) |
| Backend | Python FastAPI |
| Computer Vision | OpenCV + NumPy |
| AI/LLM | Google Gemini 2.5 Flash |
| Database | Neon Serverless PostgreSQL |
| PDF Generation | ReportLab + QRCode |
| Excel Export | OpenPyXL |
| Hosting | Vercel |

## 📁 Struktur Proyek

```
smartljk/
├── api/
│   ├── index.py           # FastAPI entry point
│   ├── database.py         # Neon DB connection & CRUD
│   ├── omr_processor.py    # OpenCV OMR processing
│   ├── ai_grader.py        # Gemini AI integration
│   ├── pdf_generator.py    # LJK PDF generation
│   └── excel_export.py     # Excel report generation
├── public/
│   ├── index.html          # SPA frontend
│   ├── css/
│   │   └── style.css       # Complete stylesheet
│   └── js/
│       ├── app.js          # Main application logic
│       └── utils.js        # Utility functions
├── requirements.txt        # Python dependencies
├── vercel.json             # Vercel deployment config
├── .env                    # Environment variables
├── .gitignore
└── README.md
```

## 🚀 Deployment ke Vercel

### 1. Setup Repository GitHub
```bash
git init
git add .
git commit -m "Initial commit - SmartLJK AI"
git remote add origin https://github.com/username/smartljk.git
git push -u origin main
```

### 2. Deploy ke Vercel
1. Buka [vercel.com](https://vercel.com) dan login
2. Import repository GitHub
3. Set Environment Variables di Vercel Dashboard:
   - `DATABASE_URL`: Connection string Neon PostgreSQL
   - `GEMINI_API_KEY`: API key Google Gemini
4. Deploy!

### 3. Jalankan Lokal
```bash
# Install dependencies
pip install -r requirements.txt

# Jalankan server
uvicorn api.index:app --reload --port 8000

# Buka browser: http://localhost:8000
```

## 📄 API Endpoints

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/api/health` | Health check |
| POST | `/api/exams` | Buat ujian baru |
| GET | `/api/exams` | Daftar semua ujian |
| GET | `/api/exams/{id}` | Detail ujian |
| PUT | `/api/exams/{id}` | Update ujian |
| DELETE | `/api/exams/{id}` | Hapus ujian |
| POST | `/api/generate-ljk/{id}` | Generate PDF LJK |
| POST | `/api/scan` | Proses scan LJK |
| POST | `/api/scan-pdf` | Proses scan PDF multi-halaman |
| GET | `/api/results/{exam_id}` | Hasil ujian |
| GET | `/api/results/detail/{id}` | Detail hasil siswa |
| GET | `/api/dashboard/{exam_id}` | Statistik dashboard |
| GET | `/api/export/{exam_id}` | Ekspor Excel |
| POST | `/api/generate-questions` | Generate soal AI |

## 📜 Lisensi

MIT License © 2024 SmartLJK AI
