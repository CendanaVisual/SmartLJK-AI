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

def generate_exam_questions(**kwargs):
    """
    Use Gemini to generate a complete 'Asesmen Lengkap' (Kisi-kisi + Kartu Soal + Soal Sumatif)
    """
    system_prompt = '''Bertindaklah sebagai "Generator Soal Cerdas & Visual", seorang ahli evaluasi pendidikan yang mahir merancang instrumen penilaian.

Tugas Anda adalah membuat dokumen "Asesmen Lengkap" yang terdiri dari 3 bagian:
BAGIAN 1: KISI-KISI SOAL (Format tabel/daftar yang rapi)
BAGIAN 2: KARTU SOAL (Lengkap dengan indikator dan kunci jawaban)
BAGIAN 3: LEMBAR SOAL SUMATIF (Untuk diberikan ke siswa)

ATURAN PEMBUATAN SOAL:
- Sesuaikan dengan mata pelajaran, kelas/fase, tingkat kognitif, dan bentuk soal yang diminta.
- Gunakan bahasa Indonesia baku dan ejaan yang disempurnakan.
- Pastikan tata letak output menggunakan Markdown yang sangat rapi.
- Pada Kartu Soal, sertakan kunci jawaban dan pembahasan singkat.
'''

    mata_pelajaran = kwargs.get('mata_pelajaran', '')
    jenjang = kwargs.get('jenjang', '')
    kelas = kwargs.get('kelas', '')
    fase = kwargs.get('fase', '')
    sekolah = kwargs.get('sekolah', '')
    kepala_sekolah = kwargs.get('kepala_sekolah', '')
    guru = kwargs.get('guru', '')
    nip_kepala = kwargs.get('nip_kepala', '')
    nip_guru = kwargs.get('nip_guru', '')
    lingkup_materi = kwargs.get('lingkup_materi', '')
    tujuan_pembelajaran = kwargs.get('tujuan_pembelajaran', '')
    indikator_soal = kwargs.get('indikator_soal', '')
    jenis_taksonomi = kwargs.get('jenis_taksonomi', '')
    tingkat_kognitif = kwargs.get('tingkat_kognitif', '')
    jumlah_opsi = kwargs.get('jumlah_opsi', '')
    bentuk_soal = kwargs.get('bentuk_soal', '')
    jumlah_soal = kwargs.get('jumlah_soal', '5')
    
    # Fallback to old args if old client is calling
    topic = kwargs.get('topic', lingkup_materi)
    target_class = kwargs.get('target_class', f"{kelas} / {fase}")
    difficulty = kwargs.get('difficulty', tingkat_kognitif)
    count = kwargs.get('count', jumlah_soal)

    user_prompt = f"""Tolong buatkan Asesmen Lengkap dengan detail berikut:

Mata Pelajaran: {mata_pelajaran or topic}
Jenjang: {jenjang}
Kelas / Fase: {target_class}
Sekolah: {sekolah}
Nama Kepala Sekolah: {kepala_sekolah} (NIP: {nip_kepala})
Nama Guru: {guru} (NIP: {nip_guru})
Lingkup Materi: {lingkup_materi or topic}
Tujuan Pembelajaran: {tujuan_pembelajaran}
Indikator Soal: {indikator_soal}
Jenis Taksonomi: {jenis_taksonomi}
Tingkat Kognitif: {difficulty}
Bentuk Soal: {bentuk_soal}
Jumlah Opsi (jika PG): {jumlah_opsi}
Jumlah Soal: {count}

Buatlah draf asesmen lengkap sekarang sesuai dengan instruksi sistem, pisahkan ketiga bagian (KISI-KISI, KARTU SOAL, SOAL SUMATIF) dengan jelas menggunakan Markdown."""

    response_text = _call_gemini(system_prompt, user_prompt)
    return response_text
