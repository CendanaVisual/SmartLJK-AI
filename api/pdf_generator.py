import json
import io
import qrcode
from PIL import Image
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib.units import mm
from reportlab.lib import colors

def generate_ljk_pdf(exam_data, questions):
    """
    Generate PDF for Lembar Jawaban Komputer (LJK).
    """
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    
    # We will use top-down coordinates for easier layout.
    # reportlab default origin is bottom-left. 
    # To draw at (x, y) where (0,0) is top-left: real_y = height - y
    
    def draw_top_down_rect(x, y, w, h, fill=1, stroke=0):
        c.rect(x * mm, height - (y + h) * mm, w * mm, h * mm, fill=fill, stroke=stroke)
        
    def draw_top_down_string(x, y, text, font="Helvetica", size=10):
        c.setFont(font, size)
        c.drawString(x * mm, height - y * mm, text)
        
    def draw_top_down_centered_string(x, y, text, font="Helvetica", size=10):
        c.setFont(font, size)
        c.drawCentredString(x * mm, height - y * mm, text)

    def draw_top_down_circle(x, y, r, fill=0, stroke=1):
        c.circle(x * mm, height - y * mm, r * mm, fill=fill, stroke=stroke)
        
    def draw_top_down_line(x1, y1, x2, y2):
        c.line(x1 * mm, height - y1 * mm, x2 * mm, height - y2 * mm)

    def draw_anchors():
        c.setFillColor(colors.black)
        # Top-left
        draw_top_down_rect(10, 10, 10, 10, fill=1)
        # Top-right
        draw_top_down_rect(190, 10, 10, 10, fill=1)
        # Bottom-left
        draw_top_down_rect(10, 277, 10, 10, fill=1)
        # Bottom-right
        draw_top_down_rect(190, 277, 10, 10, fill=1)

    def draw_header():
        c.setFillColor(colors.black)
        
        # Header text
        draw_top_down_string(25, 12, "DINAS PENDIDIKAN DAN KEBUDAYAAN", font="Helvetica", size=10)
        draw_top_down_string(25, 17, "LEMBAR JAWABAN KOMPUTER (LJK) SMART AI", font="Helvetica-Bold", size=12)
        draw_top_down_string(25, 22, exam_data.get('title', 'Ujian Sekolah'), font="Helvetica", size=10)
        
        # QR Code
        qr_data = {
            "exam_id": exam_data.get("id", ""),
            "code": exam_data.get("code", ""),
            "title": exam_data.get("title", ""),
            "total_questions": len(questions)
        }
        qr = qrcode.QRCode(box_size=4, border=1)
        qr.add_data(json.dumps(qr_data))
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        img_buffer = io.BytesIO()
        img.save(img_buffer, format="PNG")
        img_buffer.seek(0)
        from reportlab.lib.utils import ImageReader
        qr_img_reader = ImageReader(img_buffer)
        
        # Draw QR Code at top right
        c.drawImage(qr_img_reader, 155 * mm, height - 30 * mm, width=20 * mm, height=20 * mm)
        
        # Exam Code below QR
        draw_top_down_centered_string(165, 34, exam_data.get('code', 'NO-CODE'), font="Helvetica", size=8)
        
        # Horizontal Line
        c.setLineWidth(1)
        draw_top_down_line(25, 37, 185, 37)
        
        # Table-like metadata
        meta_y = 42
        draw_top_down_string(25, meta_y, "Mata Pelajaran", size=9)
        draw_top_down_string(50, meta_y, f": {exam_data.get('subject', '')}", size=9)
        draw_top_down_string(25, meta_y + 5, "Kelas / Semester", size=9)
        draw_top_down_string(50, meta_y + 5, f": {exam_data.get('class_name', '')}", size=9)
        
        draw_top_down_string(110, meta_y, "Tahun Ajaran", size=9)
        draw_top_down_string(135, meta_y, f": {exam_data.get('academic_year', '2024/2025')}", size=9)
        draw_top_down_string(110, meta_y + 5, "KKM", size=9)
        draw_top_down_string(135, meta_y + 5, f": {exam_data.get('passing_score', '75')}", size=9)

        # Horizontal line
        draw_top_down_line(25, 50, 185, 50)
        
        # Grid section
        grid_y = 55
        draw_top_down_string(25, grid_y, "NAMA LENGKAP SISWA (HURUF BALOK / KAPITAL):", font="Helvetica-Bold", size=8)
        
        # Name grid (2 rows, 20 cols)
        box_w = 5
        box_h = 6
        for row in range(2):
            for col in range(20):
                c.setLineWidth(0.5)
                draw_top_down_rect(25 + col * box_w, grid_y + 2 + row * box_h, box_w, box_h, fill=0, stroke=1)
                
        # Absen & Kelas grid
        abs_x = 135
        draw_top_down_string(abs_x, grid_y, "NOMOR ABSEN:", font="Helvetica-Bold", size=8)
        for col in range(2):
            draw_top_down_rect(abs_x + col * box_w, grid_y + 2, box_w, box_h, fill=0, stroke=1)
            
        draw_top_down_string(abs_x + 20, grid_y, "KELAS / ROMBEL:", font="Helvetica-Bold", size=8)
        for col in range(3):
            draw_top_down_rect(abs_x + 20 + col * box_w, grid_y + 2, box_w, box_h, fill=0, stroke=1)
            
        # Tanda Tangan
        draw_top_down_string(abs_x, grid_y + 12, "Tanda Tangan Murid:", font="Helvetica", size=8)
        draw_top_down_line(abs_x, grid_y + 25, abs_x + 40, grid_y + 25)

        # Petunjuk Pengisian
        petunjuk_y = 75
        c.setDash(2, 2)
        c.setLineWidth(0.5)
        draw_top_down_rect(25, petunjuk_y, 160, 15, fill=0, stroke=1)
        c.setDash() # reset
        
        draw_top_down_string(27, petunjuk_y + 4, "PETUNJUK PENGISIAN:", font="Helvetica-Bold", size=8)
        draw_top_down_string(27, petunjuk_y + 8, "1. Gunakan pensil 2B untuk menghitamkan bulatan (O).", font="Helvetica", size=7)
        draw_top_down_string(27, petunjuk_y + 12, "2. Hitamkan bulatan dengan penuh dan rapi. 3. Hapus bersih jika ingin memperbaiki.", font="Helvetica", size=7)

        # Section header
        sec_y = 95
        c.setFillColor(colors.black)
        draw_top_down_rect(25, sec_y, 160, 6, fill=1, stroke=0)
        c.setFillColor(colors.white)
        draw_top_down_centered_string(105, sec_y + 4.5, "LEMBAR JAWABAN SOAL", font="Helvetica-Bold", size=10)
        c.setFillColor(colors.black)

    def draw_footer():
        c.setFillColor(colors.black)
        draw_top_down_centered_string(105, 290, "SmartLJK AI - Powered by Computer Vision & Gemini AI", font="Helvetica", size=8)

    y_pos = 105
    x_pos_col1 = 25
    x_pos_col2 = 110
    
    draw_anchors()
    draw_header()
    draw_footer()
    
    current_col = 1
    current_x = x_pos_col1
    
    for q in questions:
        q_num = q.get("question_number", 1)
        q_type = q.get("question_type", "single_choice")
        
        required_h = 10
        if q_type == "matching":
            required_h = 50
        elif q_type == "short_answer":
            required_h = 25
            
        if y_pos + required_h > 270:
            if current_col == 1 and q_type not in ["short_answer", "matching"]:
                current_col = 2
                current_x = x_pos_col2
                y_pos = 105
            else:
                c.showPage()
                draw_anchors()
                draw_footer()
                y_pos = 20
                current_col = 1
                current_x = x_pos_col1
                
        c.setFillColor(colors.black)
        
        if q_type == "single_choice":
            draw_top_down_string(current_x, y_pos, f"{q_num}.", size=11)
            cx = current_x + 10
            for label in ["A", "B", "C", "D"]:
                draw_top_down_circle(cx, y_pos - 1, 3, fill=0, stroke=1)
                draw_top_down_centered_string(cx, y_pos - 1.5, label, size=8)
                cx += 15
            y_pos += 10
            
        elif q_type == "multi_choice":
            draw_top_down_string(current_x, y_pos, f"{q_num}.", size=11)
            cx = current_x + 10
            for label in ["A", "B", "C", "D"]:
                draw_top_down_rect(cx - 2.5, y_pos - 4, 5, 5, fill=0, stroke=1)
                draw_top_down_centered_string(cx, y_pos - 1.5, label, size=8)
                cx += 15
            y_pos += 10
            
        elif q_type == "true_false":
            draw_top_down_string(current_x, y_pos, f"{q_num}.", size=11)
            cx = current_x + 10
            for label in ["B", "S"]:
                draw_top_down_circle(cx, y_pos - 1, 3, fill=0, stroke=1)
                draw_top_down_centered_string(cx, y_pos - 1.5, label, size=8)
                cx += 25
            y_pos += 10
            
        elif q_type == "matching":
            current_x = x_pos_col1
            current_col = 1
            draw_top_down_string(current_x, y_pos, f"{q_num}.", size=11)
            mx = current_x + 15
            my = y_pos
            
            cols = ["A", "B", "C", "D"]
            rows = ["1", "2", "3", "4"]
            for i, h_col in enumerate(cols):
                draw_top_down_centered_string(mx + 10 + i*10, my, h_col, size=10)
            my += 8
            
            for r in rows:
                draw_top_down_centered_string(mx, my, r, size=10)
                for i in range(len(cols)):
                    draw_top_down_circle(mx + 10 + i*10, my - 1, 3, fill=0, stroke=1)
                my += 8
                
            y_pos = my + 5
            
        elif q_type == "short_answer":
            current_x = x_pos_col1
            current_col = 1
            draw_top_down_string(current_x, y_pos, f"{q_num}.", size=11)
            
            c.setLineWidth(1)
            bx = current_x + 10
            bw = 160
            bh = 15
            draw_top_down_rect(bx, y_pos - 10, bw, bh, fill=0, stroke=1)
            
            for i in range(8, bw, 8):
                draw_top_down_line(bx + i, y_pos - 10, bx + i, y_pos - 10 + bh)
                
            y_pos += 25
            
    c.save()
    buffer.seek(0)
    return buffer
