import json
import io
try:
    import qrcode
    from PIL import Image
except ImportError:
    qrcode = None
    Image = None
from reportlab.pdfgen import canvas
from reportlab.lib.units import mm
from reportlab.lib import colors

# Ukuran Kertas F4 (Folio): 215 mm x 330 mm
F4 = (215 * mm, 330 * mm)

def generate_ljk_pdf(exam_data, questions):
    """
    Generate PDF untuk Lembar Jawaban Komputer (LJK) F4 (215 mm x 330 mm)
    Tinggi optimal cetak: maks 302 mm (100% pas 1 lembar tanpa terpotong di printer Epson/Canon/HP)
    """
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=F4)
    page_w, page_h = F4  # 215mm, 330mm
    
    # Helper untuk sistem koordinat top-down (0,0 di kiri atas)
    def y_conv(y_mm):
        return page_h - (y_mm * mm)

    def draw_rect(x_mm, y_mm, w_mm, h_mm, fill=0, stroke=1, line_width=0.8, fill_color=colors.white, stroke_color=colors.black):
        c.saveState()
        c.setLineWidth(line_width)
        c.setFillColor(fill_color)
        c.setStrokeColor(stroke_color)
        c.rect(x_mm * mm, page_h - (y_mm + h_mm) * mm, w_mm * mm, h_mm * mm, fill=fill, stroke=stroke)
        c.restoreState()

    def draw_dashed_rect(x_mm, y_mm, w_mm, h_mm, dash_pattern=[2, 2], line_width=0.8):
        c.saveState()
        c.setLineWidth(line_width)
        c.setDash(dash_pattern[0], dash_pattern[1])
        c.rect(x_mm * mm, page_h - (y_mm + h_mm) * mm, w_mm * mm, h_mm * mm, fill=0, stroke=1)
        c.restoreState()

    def draw_text(x_mm, y_mm, text, font="Helvetica", size=9, color=colors.black):
        c.saveState()
        c.setFont(font, size)
        c.setFillColor(color)
        c.drawString(x_mm * mm, page_h - y_mm * mm, str(text))
        c.restoreState()

    def draw_centered_text(x_mm, y_mm, text, font="Helvetica", size=9, color=colors.black):
        c.saveState()
        c.setFont(font, size)
        c.setFillColor(color)
        c.drawCentredString(x_mm * mm, page_h - y_mm * mm, str(text))
        c.restoreState()

    def draw_circle(x_mm, y_mm, r_mm, fill=0, stroke=1, line_width=0.8):
        c.saveState()
        c.setLineWidth(line_width)
        c.circle(x_mm * mm, page_h - y_mm * mm, r_mm * mm, fill=fill, stroke=stroke)
        c.restoreState()

    def draw_line(x1_mm, y1_mm, x2_mm, y2_mm, line_width=0.8, stroke_color=colors.black):
        c.saveState()
        c.setLineWidth(line_width)
        c.setStrokeColor(stroke_color)
        c.line(x1_mm * mm, page_h - y1_mm * mm, x2_mm * mm, page_h - y2_mm * mm)
        c.restoreState()

    # 1. Solid Black Anchors (28 px x 28 px ≈ 9.88 mm x 9.88 mm)
    anchor_size = 9.88  # 28 pt / 28 px
    margin_x = 10.0
    margin_top = 10.0
    limit_bottom = 302.0  # Batas tinggi optimal F4
    page_right = 215.0 - margin_x  # 205 mm
    content_width = page_right - margin_x  # 195 mm

    def draw_anchors():
        # Top-Left
        draw_rect(margin_x, margin_top, anchor_size, anchor_size, fill=1, stroke=0, fill_color=colors.black)
        # Top-Right
        draw_rect(page_right - anchor_size, margin_top, anchor_size, anchor_size, fill=1, stroke=0, fill_color=colors.black)
        # Bottom-Left
        draw_rect(margin_x, limit_bottom - anchor_size, anchor_size, anchor_size, fill=1, stroke=0, fill_color=colors.black)
        # Bottom-Right
        draw_rect(page_right - anchor_size, limit_bottom - anchor_size, anchor_size, anchor_size, fill=1, stroke=0, fill_color=colors.black)

    # 2. Header & Metadata Box (y: 10 mm s.d. 50 mm)
    def draw_header():
        # Outer header border (dari x: 10 s.d. 205, y: 10 s.d. 50 mm)
        draw_rect(margin_x, margin_top, content_width, 40.0, fill=0, stroke=1, line_width=1.2)

        # Teks KOP Kiri
        instansi = exam_data.get('institution', 'DINAS PENDIDIKAN DAN KEBUDAYAAN').upper()
        draw_text(margin_x + 13, 16.0, instansi, font="Helvetica-Bold", size=9.5)
        draw_text(margin_x + 13, 22.0, "LEMBAR JAWABAN KOMPUTER (LJK) SMART AI", font="Helvetica-Bold", size=13.0)
        
        exam_title = exam_data.get('title', 'Penilaian Akhir Semester - IPA Biologi')
        draw_text(margin_x + 13, 27.5, exam_title, font="Helvetica", size=10.0)

        # QR Code di Kanan Atas
        exam_code = exam_data.get('code', 'BIO-SMP8-2025')
        qr_x = page_right - anchor_size - 24.0  # Posisi pas di samping anchor kanan
        qr_y = 12.0
        qr_w = 21.0
        
        if qrcode is not None:
            try:
                qr_data = {
                    "id": exam_data.get("id", ""),
                    "code": exam_code,
                    "title": exam_title,
                    "total": len(questions)
                }
                qr = qrcode.QRCode(box_size=4, border=1)
                qr.add_data(json.dumps(qr_data))
                qr.make(fit=True)
                img = qr.make_image(fill_color="black", back_color="white")
                img_buffer = io.BytesIO()
                img.save(img_buffer, format="PNG")
                img_buffer.seek(0)
                from reportlab.lib.utils import ImageReader
                qr_reader = ImageReader(img_buffer)
                c.drawImage(qr_reader, qr_x * mm, page_h - (qr_y + qr_w) * mm, width=qr_w * mm, height=qr_w * mm)
            except Exception:
                draw_rect(qr_x, qr_y, qr_w, qr_w, fill=0, stroke=1, line_width=1.0)
                draw_centered_text(qr_x + (qr_w / 2.0), qr_y + (qr_w / 2.0), "[QR CODE]", font="Helvetica-Bold", size=6.5)
        else:
            draw_rect(qr_x, qr_y, qr_w, qr_w, fill=0, stroke=1, line_width=1.0)
            draw_centered_text(qr_x + (qr_w / 2.0), qr_y + (qr_w / 2.0), "[QR CODE]", font="Helvetica-Bold", size=6.5)
        
        # Kode Ujian di bawah QR Code
        draw_centered_text(qr_x + (qr_w / 2.0), qr_y + qr_w + 3.2, exam_code, font="Helvetica-Bold", size=7.5)

        # Garis horizontal pembatas judul
        draw_line(margin_x, 37.0, page_right, 37.0, line_width=1.0)

        # Metadata Row (Mata Pelajaran, Kelas, Tahun Ajaran, KKM)
        meta_y = 43.5
        subject = exam_data.get('subject', 'Ilmu Pengetahuan Alam (IPA)')
        class_name = exam_data.get('class_name', 'Kelas 8A')
        academic_year = exam_data.get('academic_year', '2024/2025')
        kkm = exam_data.get('passing_score', '75.00')

        # Sub-kolom metadata
        draw_text(margin_x + 3.0, meta_y, "Mata Pelajaran: ", font="Helvetica", size=8.0)
        draw_text(margin_x + 25.0, meta_y, subject, font="Helvetica-Bold", size=8.0)

        draw_text(margin_x + 72.0, meta_y, "Kelas / Semester: ", font="Helvetica", size=8.0)
        draw_text(margin_x + 98.0, meta_y, class_name, font="Helvetica-Bold", size=8.0)

        draw_text(margin_x + 128.0, meta_y, "Tahun Ajaran: ", font="Helvetica", size=8.0)
        draw_text(margin_x + 147.0, meta_y, str(academic_year), font="Helvetica-Bold", size=8.0)

        draw_text(margin_x + 168.0, meta_y, "KKM: ", font="Helvetica", size=8.0)
        draw_text(margin_x + 177.0, meta_y, str(kkm), font="Helvetica-Bold", size=8.0)

    # 3. Student Info & Signature Box (y: 53.0 mm s.d. 95.0 mm)
    def draw_student_info():
        box_y = 53.0
        box_h = 42.0
        draw_rect(margin_x, box_y, content_width, box_h, fill=0, stroke=1, line_width=1.2)
        
        # Garis vertikal pembagi (kolom nama 62% vs kolom absen/tanda tangan 38%)
        col_divider_x = margin_x + 120.0
        draw_line(col_divider_x, box_y, col_divider_x, box_y + box_h, line_width=1.0)

        # --- Bagian Kiri: Nama Siswa ---
        draw_text(margin_x + 3.0, box_y + 4.5, "NAMA LENGKAP SISWA (HURUF BALOK / KAPITAL):", font="Helvetica-Bold", size=7.5)
        
        # Grid 2 baris x 10 kolom kotak karakter (Total 20 kotak)
        char_box_w = 5.2
        char_box_h = 5.5
        gap = 0.5
        grid_start_x = margin_x + 3.0
        row1_y = box_y + 6.5
        row2_y = row1_y + char_box_h + gap

        for col in range(10):
            bx = grid_start_x + (col * (char_box_w + gap))
            draw_rect(bx, row1_y, char_box_w, char_box_h, fill=0, stroke=1, line_width=0.6)
            draw_rect(bx, row2_y, char_box_w, char_box_h, fill=0, stroke=1, line_width=0.6)

        # Petunjuk Pengisian (Kotak bergaris putus-putus)
        petunjuk_y = row2_y + char_box_h + 2.5
        petunjuk_w = 114.0
        petunjuk_h = 17.5
        draw_dashed_rect(grid_start_x, petunjuk_y, petunjuk_w, petunjuk_h, dash_pattern=[2, 2], line_width=0.7)
        
        draw_text(grid_start_x + 2.5, petunjuk_y + 4.0, "PETUNJUK PENGISIAN:", font="Helvetica-Bold", size=6.8)
        draw_text(grid_start_x + 2.5, petunjuk_y + 8.5, "•  Gunakan pensil 2B atau pulpen hitam pekat. Hitamkan bulatan: ●", font="Helvetica", size=6.5)
        draw_text(grid_start_x + 2.5, petunjuk_y + 13.0, "•  Tuliskan isian singkat dengan rapi di dalam kotak bertanda.", font="Helvetica", size=6.5)

        # --- Bagian Kanan: Absen, Kelas, & Tanda Tangan ---
        right_start_x = col_divider_x + 4.0
        
        # Nomor Absen (4 kotak)
        draw_text(right_start_x, box_y + 4.5, "NOMOR ABSEN:", font="Helvetica-Bold", size=7.5)
        for col in range(4):
            bx = right_start_x + (col * (char_box_w + gap))
            draw_rect(bx, box_y + 6.5, char_box_w, char_box_h, fill=0, stroke=1, line_width=0.6)

        # Kelas / Rombel (5 kotak)
        draw_text(right_start_x, box_y + 16.5, "KELAS / ROMBEL:", font="Helvetica-Bold", size=7.5)
        for col in range(5):
            bx = right_start_x + (col * (char_box_w + gap))
            draw_rect(bx, box_y + 18.5, char_box_w, char_box_h, fill=0, stroke=1, line_width=0.6)

        # Tanda Tangan Murid
        sig_y = box_y + 28.0
        draw_centered_text(col_divider_x + (content_width - 120.0)/2.0, sig_y, "Tanda Tangan Murid:", font="Helvetica", size=7.0)
        draw_line(right_start_x, box_y + 38.0, page_right - 4.0, box_y + 38.0, line_width=0.7)

    # 4. Section Banner: LEMBAR JAWABAN SOAL (y: 98.0 s.d. 104.5 mm)
    def draw_section_banner():
        banner_y = 97.5
        banner_h = 6.5
        # Background abu-abu muda
        draw_rect(margin_x, banner_y, content_width, banner_h, fill=1, stroke=1, line_width=1.0, 
                  fill_color=colors.HexColor('#F3F4F6'), stroke_color=colors.black)
        draw_centered_text(margin_x + (content_width / 2.0), banner_y + 4.5, "LEMBAR JAWABAN SOAL", font="Helvetica-Bold", size=8.5)

    # 5. Penataan Ulang Posisi 5 Bentuk Soal (Proporsional & Bebas Terpotong)
    # Area soal dimulai dari y: 106.0 mm s.d. 290.0 mm
    draw_anchors()
    draw_header()
    draw_student_info()
    draw_section_banner()

    # Kelompokkan soal berdasarkan tipe untuk penataan proporsional
    # Bagian I: Pilihan Ganda (Single Choice)
    # Bagian II: Pilihan Ganda Kompleks (Multi Choice)
    # Bagian III: Benar / Salah (True / False)
    # Bagian IV: Menjodohkan (Matching)
    # Bagian V: Isian Singkat (Handwriting OCR)
    
    single_choice_q = [q for q in questions if q.get('question_type') in ['single_choice', 'Pilihan Ganda']]
    multi_choice_q = [q for q in questions if q.get('question_type') in ['multi_choice', 'Pilihan Ganda Kompleks']]
    true_false_q = [q for q in questions if q.get('question_type') in ['true_false', 'Benar/Salah']]
    matching_q = [q for q in questions if q.get('question_type') in ['matching', 'Menjodohkan']]
    short_answer_q = [q for q in questions if q.get('question_type') in ['short_answer', 'Isian Singkat']]

    # 2 Kolom Utama untuk menampung seluruh soal secara efisien
    col1_x = margin_x + 2.0         # x: 12 mm s.d. 104 mm (lebar ~92 mm)
    col2_x = margin_x + 100.0       # x: 110 mm s.d. 202 mm (lebar ~92 mm)
    current_y_col1 = 108.0
    current_y_col2 = 108.0

    # Helper render Bagian I — Pilihan Ganda (Sub-grid dinamis 2 sub-kolom jika > 4)
    if single_choice_q:
        draw_text(col1_x, current_y_col1, "BAGIAN I — PILIHAN GANDA", font="Helvetica-Bold", size=7.5)
        current_y_col1 += 5.0
        
        use_subgrid = len(single_choice_q) > 4
        sub_col_w = 44.0
        bubble_r = 2.4  # Diameter ~4.8 mm presisi OMR
        
        for idx, q in enumerate(single_choice_q):
            q_num = q.get('question_number', idx + 1)
            
            if use_subgrid:
                # 2 sub-kolom dalam col1
                sub_col = idx % 2
                item_x = col1_x + (sub_col * sub_col_w)
                # No soal
                draw_text(item_x, current_y_col1 + 3.0, f"{q_num}.", font="Helvetica-Bold", size=7.5)
                # Bulatan A B C D
                opt_start_x = item_x + 6.5
                for opt_idx, opt_char in enumerate(["A", "B", "C", "D"]):
                    bx = opt_start_x + (opt_idx * 7.5)
                    by = current_y_col1 + 2.0
                    draw_circle(bx, by, bubble_r, fill=0, stroke=1, line_width=0.7)
                    draw_centered_text(bx, by + 1.8, opt_char, font="Helvetica", size=5.5)
                    
                if sub_col == 1 or idx == len(single_choice_q) - 1:
                    current_y_col1 += 6.5
            else:
                item_x = col1_x
                draw_text(item_x, current_y_col1 + 3.0, f"{q_num}.", font="Helvetica-Bold", size=8.0)
                opt_start_x = item_x + 10.0
                for opt_idx, opt_char in enumerate(["A", "B", "C", "D"]):
                    bx = opt_start_x + (opt_idx * 9.0)
                    by = current_y_col1 + 2.0
                    draw_circle(bx, by, bubble_r, fill=0, stroke=1, line_width=0.7)
                    draw_centered_text(bx, by + 1.8, opt_char, font="Helvetica", size=6.0)
                current_y_col1 += 6.5

        current_y_col1 += 2.0

    # Helper render Bagian II — Pilihan Ganda Kompleks (Kotak centang kompak)
    if multi_choice_q:
        draw_text(col1_x, current_y_col1, "BAGIAN II — PILIHAN GANDA KOMPLEKS", font="Helvetica-Bold", size=7.5)
        current_y_col1 += 5.0
        
        use_subgrid_multi = len(multi_choice_q) > 4
        sub_col_w = 44.0
        chk_size = 4.2
        
        for idx, q in enumerate(multi_choice_q):
            q_num = q.get('question_number', idx + 1)
            if use_subgrid_multi:
                sub_col = idx % 2
                item_x = col1_x + (sub_col * sub_col_w)
                draw_text(item_x, current_y_col1 + 3.0, f"{q_num}.", font="Helvetica-Bold", size=7.5)
                opt_start_x = item_x + 6.5
                for opt_idx, opt_char in enumerate(["A", "B", "C", "D"]):
                    bx = opt_start_x + (opt_idx * 7.5)
                    by = current_y_col1
                    draw_rect(bx, by, chk_size, chk_size, fill=0, stroke=1, line_width=0.7)
                    draw_centered_text(bx + (chk_size/2.0), by + 3.2, opt_char, font="Helvetica", size=5.5)
                if sub_col == 1 or idx == len(multi_choice_q) - 1:
                    current_y_col1 += 6.5
            else:
                item_x = col1_x
                draw_text(item_x, current_y_col1 + 3.0, f"{q_num}.", font="Helvetica-Bold", size=8.0)
                opt_start_x = item_x + 10.0
                for opt_idx, opt_char in enumerate(["A", "B", "C", "D"]):
                    bx = opt_start_x + (opt_idx * 9.0)
                    by = current_y_col1
                    draw_rect(bx, by, chk_size, chk_size, fill=0, stroke=1, line_width=0.7)
                    draw_centered_text(bx + (chk_size/2.0), by + 3.2, opt_char, font="Helvetica", size=6.0)
                current_y_col1 += 6.5

        current_y_col1 += 2.0

    # Helper render Bagian III — Benar / Salah (Lencana seleksi [ B ] [ S ])
    if true_false_q:
        target_col = col1_x if current_y_col1 <= 240.0 else col2_x
        curr_y = current_y_col1 if target_col == col1_x else current_y_col2

        draw_text(target_col, curr_y, "BAGIAN III — BENAR / SALAH", font="Helvetica-Bold", size=7.5)
        curr_y += 5.0

        for idx, q in enumerate(true_false_q):
            q_num = q.get('question_number', idx + 1)
            draw_text(target_col, curr_y + 3.0, f"{q_num}.", font="Helvetica-Bold", size=8.0)
            
            # Lencana [ B ]
            b_x = target_col + 10.0
            draw_rect(b_x, curr_y, 7.5, 4.8, fill=0, stroke=1, line_width=0.7)
            draw_centered_text(b_x + 3.75, curr_y + 3.6, "B", font="Helvetica-Bold", size=6.5)
            
            # Lencana [ S ]
            s_x = b_x + 11.0
            draw_rect(s_x, curr_y, 7.5, 4.8, fill=0, stroke=1, line_width=0.7)
            draw_centered_text(s_x + 3.75, curr_y + 3.6, "S", font="Helvetica-Bold", size=6.5)
            
            curr_y += 6.5

        if target_col == col1_x:
            current_y_col1 = curr_y + 2.0
        else:
            current_y_col2 = curr_y + 2.0

    # Bagian IV: Menjodohkan (Matriks Pasangan Premis Tabel Hemat Ruang)
    if matching_q:
        draw_text(col2_x, current_y_col2, "BAGIAN IV — MENJODOHKAN", font="Helvetica-Bold", size=7.5)
        current_y_col2 += 5.0
        
        for idx, q in enumerate(matching_q):
            q_num = q.get('question_number', idx + 1)
            draw_text(col2_x, current_y_col2 + 3.0, f"Soal {q_num}:", font="Helvetica-Bold", size=7.5)
            
            # Matriks tabel kompresi 4 premis x 4 opsi
            tbl_x = col2_x + 14.0
            tbl_y = current_y_col2
            cell_w = 7.0
            cell_h = 4.2
            
            # Header kolom A, B, C, D
            for ci, col_label in enumerate(["A", "B", "C", "D"]):
                cx = tbl_x + 6.0 + (ci * cell_w)
                draw_centered_text(cx, tbl_y + 3.0, col_label, font="Helvetica-Bold", size=6.5)
                
            tbl_y += 4.0
            # Baris 1, 2, 3, 4
            for r_idx in range(1, 5):
                draw_centered_text(tbl_x + 2.0, tbl_y + 3.0, str(r_idx), font="Helvetica-Bold", size=6.5)
                for ci in range(4):
                    cx = tbl_x + 6.0 + (ci * cell_w)
                    draw_circle(cx, tbl_y + 2.0, 1.8, fill=0, stroke=1, line_width=0.6)
                tbl_y += cell_h

            current_y_col2 = tbl_y + 4.0

    # Bagian V: Isian Singkat (Handwriting OCR)
    # Kotak presisi tinggi 32 px (~11 mm), corner tick marks, baseline guide
    if short_answer_q:
        draw_text(col2_x, current_y_col2, "BAGIAN V — ISIAN SINGKAT (AI OCR)", font="Helvetica-Bold", size=7.5)
        current_y_col2 += 5.0

        for idx, q in enumerate(short_answer_q):
            q_num = q.get('question_number', idx + 1)
            draw_text(col2_x, current_y_col2 + 3.0, f"{q_num}.", font="Helvetica-Bold", size=7.5)
            
            box_ocr_x = col2_x + 8.0
            box_ocr_y = current_y_col2
            box_ocr_w = 82.0
            box_ocr_h = 10.5  # ~32 px presisi

            # Kotak garis tepi hitam solid
            draw_rect(box_ocr_x, box_ocr_y, box_ocr_w, box_ocr_h, fill=0, stroke=1, line_width=0.9)
            
            # Corner Tick Marks (tanda registrasi sudut OCR)
            tick_len = 1.8
            # Kiri-atas
            draw_line(box_ocr_x + tick_len, box_ocr_y, box_ocr_x, box_ocr_y, line_width=1.5)
            draw_line(box_ocr_x, box_ocr_y, box_ocr_x, box_ocr_y + tick_len, line_width=1.5)
            # Kanan-atas
            draw_line(box_ocr_x + box_ocr_w - tick_len, box_ocr_y, box_ocr_x + box_ocr_w, box_ocr_y, line_width=1.5)
            draw_line(box_ocr_x + box_ocr_w, box_ocr_y, box_ocr_x + box_ocr_w, box_ocr_y + tick_len, line_width=1.5)
            # Kiri-bawah
            draw_line(box_ocr_x, box_ocr_y + box_ocr_h - tick_len, box_ocr_x, box_ocr_y + box_ocr_h, line_width=1.5)
            draw_line(box_ocr_x, box_ocr_y + box_ocr_h, box_ocr_x + tick_len, box_ocr_y + box_ocr_h, line_width=1.5)
            # Kanan-bawah
            draw_line(box_ocr_x + box_ocr_w - tick_len, box_ocr_y + box_ocr_h, box_ocr_x + box_ocr_w, box_ocr_y + box_ocr_h, line_width=1.5)
            draw_line(box_ocr_x + box_ocr_w, box_ocr_y + box_ocr_h - tick_len, box_ocr_x + box_ocr_w, box_ocr_y + box_ocr_h, line_width=1.5)

            # Baseline Guide (Garis panduan dasar putus-putus)
            guide_y = box_ocr_y + box_ocr_h - 2.5
            draw_dashed_rect(box_ocr_x + 1.0, guide_y, box_ocr_w - 2.0, 0.1, dash_pattern=[2, 2], line_width=0.4)

            current_y_col2 += box_ocr_h + 3.5

    # 6. Footer Lembar LJK (Tepat di batas limit_bottom = 302 mm)
    footer_text = "SmartLJK AI • Sistem OMR & OCR Cerdas • Standar Cetak Kertas F4 (215 x 330 mm) • 100% Pas 1 Lembar"
    draw_centered_text(margin_x + (content_width / 2.0), limit_bottom - 2.5, footer_text, font="Helvetica", size=6.5, color=colors.HexColor('#475569'))

    c.save()
    buffer.seek(0)
    return buffer
