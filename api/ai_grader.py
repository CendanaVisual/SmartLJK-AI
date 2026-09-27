import os
import json
import google.generativeai as genai

# Konfigurasi Gemini API
api_key = os.environ.get('GEMINI_API_KEY', 'AIzaSyAb8RN6LudkTDhmyjmH2rMI9XSZi_R9ztvo5JDMAvg3uo0Qsijw')
genai.configure(api_key=api_key)

def _call_gemini(system_prompt, user_prompt, image_bytes=None):
    """
    Internal helper that makes the actual API call to Gemini
    Support both text-only and vision (with image) modes
    """
    try:
        model = genai.GenerativeModel('gemini-2.5-flash', 
                                      system_instruction=system_prompt)
        
        contents = [user_prompt]
        if image_bytes:
            contents.insert(0, {"mime_type": "image/jpeg", "data": image_bytes})
            
        response = model.generate_content(contents)
        return response.text
    except Exception as e:
        print(f"Error calling Gemini: {e}")
        return None

def grade_short_answer(image_bytes, answer_key, accepted_variants=None, max_score=1.0):
    """
    Send the cropped handwriting image to Gemini Vision API (gemini-2.5-flash model)
    """
    system_prompt = '''Anda adalah Sistem AI Evaluator Khusus "SmartLJK Handwriting OCR & Grader" yang bertugas mengkoreksi lembar jawaban isian singkat tulisan tangan siswa sekolah.

Tugas Anda:
1. Analisis potongan gambar kotak isian singkat siswa (Handwriting Box / Character Grid).
2. Lakukan Optical Character Recognition (OCR) terhadap tulisan tangan tersebut secara akurat, tahan terhadap variasi bentuk huruf tegak bersambung, huruf kapital, coretan koreksi kecil, atau kemiringan tulisan.
3. Transkripsikan teks yang terbaca apa adanya ke dalam bahasa Indonesia baku.
4. Bandingkan teks hasil transkripsi dengan Kunci Jawaban Resmi dan daftar variasi kata yang dapat diterima (accepted answers / synonyms).
5. Berikan penilaian skor proporsional (0.0 sampai skor maksimal) berdasarkan kebenaran konsep dan ejaan.
6. Berikan penjelasan singkat, edukatif, dan ramah untuk catatan guru.

FORMAT KELUARAN WAJIB JSON:
{"transcribed_text": "string", "is_correct": boolean, "score_earned": number, "confidence_percentage": number, "matched_keyword": "string", "explanation": "string"}'''

    variants_str = ", ".join(accepted_variants) if accepted_variants else "Tidak ada"
    user_prompt = f"""Kunci Jawaban Resmi: {answer_key}
Variasi Jawaban Diterima: {variants_str}
Skor Maksimal: {max_score}

Silakan analisis gambar yang diberikan dan kembalikan hasil dalam format JSON yang tepat."""

    response_text = _call_gemini(system_prompt, user_prompt, image_bytes)
    
    if not response_text:
        return {"error": "Gagal menghubungi Gemini API"}
        
    try:
        # Bersihkan format jika berupa markdown block
        clean_json = response_text.replace('```json', '').replace('```', '').strip()
        result = json.loads(clean_json)
        return result
    except json.JSONDecodeError:
        return {"error": "Respons bukan JSON valid", "raw_response": response_text}

def generate_exam_questions(topic, target_class, difficulty, count):
    """
    Use Gemini to generate exam questions
    """
    system_prompt = '''Bertindaklah sebagai "Generator Soal Cerdas & Visual", seorang ahli evaluasi pendidikan yang mahir merancang instrumen penilaian berbasis Taksonomi Bloom.

Tugas Anda adalah membuat draf lembar soal berkualitas tinggi dengan tata letak yang rapi.

ATURAN PEMBUATAN SOAL:
Sertakan variasi dari 5 jenis soal berikut:
1. Pilihan Ganda: 1 jawaban benar dengan 4 opsi (A, B, C, D)
2. Pilihan Ganda Kompleks: 4-5 opsi, siswa dapat memilih lebih dari satu jawaban benar
3. Benar/Salah: Pernyataan dengan opsi [Benar] / [Salah]
4. Menjodohkan: 3-4 premis di Kolom A dan pilihan di Kolom B
5. Isian Singkat: Pertanyaan dengan jawaban pasti 1-3 kata

Format output menjadi dua bagian:
BAGIAN A: LEMBAR SOAL (Untuk Siswa)
BAGIAN B: PEGANGAN GURU (Kunci, Pembahasan & Prompt Visual)

Untuk BAGIAN B, setiap soal harus memiliki:
- Jenis Soal
- Level Bloom (C1-C6)
- Prompt Gambar (deskripsi bahasa Inggris untuk AI Image Generator)
- Kunci Jawaban
- Pembahasan'''

    user_prompt = f"""Topik Soal: {topic}
Target Kelas/Fase: {target_class}
Tingkat Kesulitan (Taksonomi Bloom dominan): {difficulty}
Jumlah Soal: {count}

Buatlah draf soal sekarang sesuai dengan instruksi sistem."""

    response_text = _call_gemini(system_prompt, user_prompt)
    return response_text
