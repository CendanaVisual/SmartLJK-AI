import cv2
import numpy as np
import json

def find_anchor_markers(image):
    """
    Detect 4 black square anchor markers (32x32 pixels) at corners of LJK
    Use contour detection, filter by area and aspect ratio
    Return sorted corners: [top-left, top-right, bottom-right, bottom-left]
    """
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    # Gunakan threshold otsu
    _, thresh = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    markers = []
    for contour in contours:
        area = cv2.contourArea(contour)
        x, y, w, h = cv2.boundingRect(contour)
        aspect_ratio = float(w) / h
        # Asumsikan area sekitar 32x32 = 1024, berikan toleransi
        if 500 < area < 2500 and 0.8 < aspect_ratio < 1.2:
            M = cv2.moments(contour)
            if M["m00"] != 0:
                cX = int(M["m10"] / M["m00"])
                cY = int(M["m01"] / M["m00"])
                markers.append((cX, cY))
    
    # Sort corners jika menemukan 4
    if len(markers) >= 4:
        # Sort based on sum of x+y (top-left is smallest, bottom-right is largest)
        markers = sorted(markers, key=lambda p: p[0] + p[1])
        tl = markers[0]
        br = markers[-1]
        
        # Sort remaining based on diff of x-y
        remaining = markers[1:-1]
        remaining = sorted(remaining, key=lambda p: p[0] - p[1])
        bl = remaining[0]
        tr = remaining[1]
        return [tl, tr, br, bl]
        
    return []

def perspective_warp(image, corners):
    """
    Apply perspective transformation to correct skew/rotation from phone camera
    Target size: A4 proportions (2100x2970 pixels for processing)
    Return warped image
    """
    if not corners or len(corners) != 4:
        return image
        
    target_width = 2100
    target_height = 2970
    
    # Koordinat sumber dari sudut
    src_pts = np.array(corners, dtype="float32")
    
    # Margin 40px
    margin = 40
    
    # Koordinat tujuan
    dst_pts = np.array([
        [margin, margin],
        [target_width - margin - 1, margin],
        [target_width - margin - 1, target_height - margin - 1],
        [margin, target_height - margin - 1]
    ], dtype="float32")
    
    M = cv2.getPerspectiveTransform(src_pts, dst_pts)
    warped = cv2.warpPerspective(image, M, (target_width, target_height))
    return warped

def detect_qr_code(image):
    """
    Detect and decode QR code from the LJK image
    Return decoded metadata dict or None
    """
    qr_detector = cv2.QRCodeDetector()
    data, bbox, _ = qr_detector.detectAndDecode(image)
    if data:
        try:
            return json.loads(data)
        except json.JSONDecodeError:
            return {"raw_data": data}
    return None

def extract_bubble_regions(warped_image, question_layout):
    """
    Given the warped image and question layout config, extract ROIs for each question
    question_layout is a list of dicts with question_number, question_type, and position info
    """
    regions = {}
    for q in question_layout:
        q_num = q.get('question_number')
        x, y, w, h = q.get('x'), q.get('y'), q.get('w'), q.get('h')
        if all(v is not None for v in [q_num, x, y, w, h]):
            roi = warped_image[y:y+h, x:x+w]
            regions[q_num] = {
                'type': q.get('question_type'),
                'roi': roi,
                'config': q
            }
    return regions

def _count_dark_pixels(cell):
    """Helper for counting dark pixels"""
    total_pixels = cell.shape[0] * cell.shape[1]
    dark_pixels = cv2.countNonZero(cell)
    ratio = dark_pixels / total_pixels if total_pixels > 0 else 0
    return ratio

def detect_single_choice(roi, num_options=4):
    """
    For a single-choice bubble region (A, B, C, D)
    Return the selected option or None if unclear, and confidence percentage
    """
    if len(roi.shape) == 3:
        roi = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
    _, thresh = cv2.threshold(roi, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    
    h, w = thresh.shape
    cell_w = w // num_options
    
    options = ['A', 'B', 'C', 'D', 'E'][:num_options]
    results = []
    
    for i in range(num_options):
        cell = thresh[:, i*cell_w:(i+1)*cell_w]
        ratio = _count_dark_pixels(cell)
        results.append((options[i], ratio))
        
    results.sort(key=lambda x: x[1], reverse=True)
    
    best_opt, best_ratio = results[0]
    second_ratio = results[1][1] if len(results) > 1 else 0
    
    if best_ratio > 0.40:
        confidence = (best_ratio - second_ratio) * 100
        # Jika ada bubble lain yang juga > 40%, mungkin tidak valid / ambigu
        if second_ratio > 0.40:
            return None, 0.0
        return best_opt, min(100.0, confidence * 2) 
    return None, 0.0

def detect_multi_choice(roi, num_options=4):
    """
    For multi-choice checkbox region
    Return list of selected options and confidence
    """
    if len(roi.shape) == 3:
        roi = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
    _, thresh = cv2.threshold(roi, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    
    h, w = thresh.shape
    cell_w = w // num_options
    
    options = ['A', 'B', 'C', 'D', 'E'][:num_options]
    selected = []
    confidences = []
    
    for i in range(num_options):
        cell = thresh[:, i*cell_w:(i+1)*cell_w]
        ratio = _count_dark_pixels(cell)
        if ratio > 0.40:
            selected.append(options[i])
            confidences.append(ratio * 100)
            
    avg_conf = sum(confidences) / len(confidences) if confidences else 0.0
    return selected, avg_conf

def detect_true_false(roi):
    """
    For Benar/Salah (True/False) bubble
    Detect if B or S is marked
    Return 'B' or 'S' and confidence
    """
    if len(roi.shape) == 3:
        roi = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
    _, thresh = cv2.threshold(roi, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    
    h, w = thresh.shape
    cell_w = w // 2
    
    cell_b = thresh[:, 0:cell_w]
    cell_s = thresh[:, cell_w:w]
    
    ratio_b = _count_dark_pixels(cell_b)
    ratio_s = _count_dark_pixels(cell_s)
    
    if ratio_b > 0.40 and ratio_s <= 0.40:
        return 'B', ratio_b * 100
    elif ratio_s > 0.40 and ratio_b <= 0.40:
        return 'S', ratio_s * 100
        
    return None, 0.0

def detect_matching(roi, num_questions=4, num_options=4):
    """
    For matching matrix grid
    Return dict like {1: 'C', 2: 'A', 3: 'D', 4: 'B'} and confidence
    """
    if len(roi.shape) == 3:
        roi = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
    _, thresh = cv2.threshold(roi, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    
    h, w = thresh.shape
    cell_h = h // num_questions
    cell_w = w // num_options
    
    options = ['A', 'B', 'C', 'D', 'E'][:num_options]
    result = {}
    confidences = []
    
    for q_idx in range(num_questions):
        row_roi = thresh[q_idx*cell_h:(q_idx+1)*cell_h, :]
        row_res = []
        for o_idx in range(num_options):
            cell = row_roi[:, o_idx*cell_w:(o_idx+1)*cell_w]
            ratio = _count_dark_pixels(cell)
            row_res.append((options[o_idx], ratio))
            
        row_res.sort(key=lambda x: x[1], reverse=True)
        best_opt, best_ratio = row_res[0]
        
        if best_ratio > 0.40:
            result[q_idx + 1] = best_opt
            confidences.append(best_ratio * 100)
            
    avg_conf = sum(confidences) / len(confidences) if confidences else 0.0
    return result, avg_conf

def extract_short_answer_region(warped_image, region_coords):
    """
    Crop the short answer handwriting area
    Apply preprocessing (denoise, enhance contrast)
    Return the cropped, preprocessed image as bytes
    """
    x, y, w, h = region_coords
    roi = warped_image[y:y+h, x:x+w]
    
    # Preprocessing
    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
    denoised = cv2.fastNlMeansDenoising(gray, None, 10, 7, 21)
    
    # Enhance contrast using CLAHE
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
    enhanced = clahe.apply(denoised)
    
    _, buffer = cv2.imencode('.jpg', enhanced)
    return buffer.tobytes()

def process_ljk_image(image_bytes, questions_config):
    """
    Main function that orchestrates the full OMR pipeline
    """
    # a. Decode image from bytes
    nparr = np.frombuffer(image_bytes, np.uint8)
    image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    # b. Find anchor markers
    corners = find_anchor_markers(image)
    
    # c. Apply perspective warp
    warped_image = perspective_warp(image, corners)
    
    # d. Detect QR code (top-right area, approx 150x150)
    h, w, _ = warped_image.shape
    qr_roi = warped_image[0:300, w-300:w]
    metadata = detect_qr_code(qr_roi)
    
    # e. For each question, detect answer based on type
    results = {}
    short_answers = {}
    
    regions = extract_bubble_regions(warped_image, questions_config)
    for q_num, data in regions.items():
        q_type = data['type']
        roi = data['roi']
        
        ans, conf = None, 0.0
        if q_type == 'single_choice':
            ans, conf = detect_single_choice(roi, num_options=data['config'].get('options', 4))
        elif q_type == 'multi_choice':
            ans, conf = detect_multi_choice(roi, num_options=data['config'].get('options', 4))
        elif q_type == 'true_false':
            ans, conf = detect_true_false(roi)
        elif q_type == 'matching':
            ans, conf = detect_matching(roi, 
                                        num_questions=data['config'].get('num_questions', 4),
                                        num_options=data['config'].get('num_options', 4))
        elif q_type == 'short_answer':
            coords = (data['config']['x'], data['config']['y'], data['config']['w'], data['config']['h'])
            img_bytes = extract_short_answer_region(warped_image, coords)
            short_answers[q_num] = img_bytes
            continue
            
        results[q_num] = {
            'answer': ans,
            'confidence': conf
        }
        
    return {
        'metadata': metadata,
        'answers': results,
        'short_answers': short_answers,
        'corners_detected': len(corners) == 4
    }
