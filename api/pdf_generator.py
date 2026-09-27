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
        draw_top_down_centered_string(105, 15, "LEMBAR JAWABAN KOMPUTER (LJK)", font="Helvetica-Bold", size=14)
        
        subtitle = f"{exam_data.get('title', '')} | {exam_data.get('subject', '')} | Kelas: {exam_data.get('class_name', '')}"
        draw_top_down_centered_string(105, 22, subtitle, font="Helvetica", size=10)
        
        # Student Info
        c.setLineWidth(1)
        draw_top_down_string(25, 35, "Nama  : ___________________________", size=11)
        draw_top_down_string(25, 45, "NIS   : ___________________________", size=11)
        draw_top_down_string(25, 55, "Kelas : ___________________________", size=11)
        
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
        
        # Save PIL image to bytes
        img_buffer = io.BytesIO()
        img.save(img_buffer, format="PNG")
        img_buffer.seek(0)
        
        # Draw QR code at top right
        # X: 155mm, Y: 30mm, W: 30mm, H: 30mm
        from reportlab.lib.utils import ImageReader
        qr_img_reader = ImageReader(img_buffer)
        c.drawImage(qr_img_reader, 155 * mm, height - 60 * mm, width=30 * mm, height=30 * mm)

    def draw_footer():
        c.setFillColor(colors.black)
        draw_top_down_centered_string(105, 290, "SmartLJK AI - Powered by Computer Vision & Gemini AI", font="Helvetica", size=8)

    y_pos = 70
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
                y_pos = 70
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
