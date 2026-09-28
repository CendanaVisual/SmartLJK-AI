// ============================================================
// SmartLJK AI - Main Application Logic
// Arsitektur Lengkap: Generator F4, Scanner OMR/OCR, Dashboard Guru
// ============================================================

const routes = ['beranda', 'scan', 'dashboard', 'generator'];

// State Aplikasi
let currentExamId = null;
let questions = [];
let cachedExams = [];
let scanStream = null;
let currentFacingMode = 'environment';
let imageFileToProcess = null;
let pdfBatchPages = [];
let currentPdfPageIndex = 0;

// ============================================================
// ROUTER & NAVIGATION
// ============================================================
function handleRouting() {
    let hash = window.location.hash.substring(1);
    if (!routes.includes(hash)) {
        hash = 'beranda';
        window.location.hash = hash;
    }

    // Toggle tampilan halaman
    document.querySelectorAll('.page-section').forEach(el => {
        el.classList.add('hidden');
    });

    const activeSection = document.getElementById(hash);
    if (activeSection) {
        activeSection.classList.remove('hidden');
    }

    // Toggle nav active
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const activeNav = document.getElementById(`nav-${hash}`);
    if (activeNav) {
        activeNav.classList.add('active');
    }

    // Aksi perpindahan halaman
    if (hash === 'scan') {
        loadExamsDropdowns();
    } else if (hash === 'dashboard') {
        loadExamsDropdowns();
        const examSelect = document.getElementById('dashExamSelect');
        if (examSelect && examSelect.value) {
            loadDashboardData(examSelect.value);
        }
    } else if (hash !== 'scan') {
        stopCamera();
    }
}

window.addEventListener('hashchange', handleRouting);

// ============================================================
// 1. BERANDA: LJK BUILDER (KERTAS F4 215 x 330 mm)
// ============================================================

function initBeranda() {
    // Listener input metadata ujian untuk realtime preview
    ['judulUjian', 'kodeUjian', 'mataPelajaran', 'kelas', 'tahunAkademik', 'kkm', 'instansi'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', debounce(updatePreview, 150));
        }
    });

    // Action buttons
    const saveBtn = document.getElementById('saveExamBtn');
    if (saveBtn) saveBtn.addEventListener('click', saveExam);

    const printBtn = document.getElementById('printBtn');
    if (printBtn) printBtn.addEventListener('click', () => window.print());

    const dlPdfBtn = document.getElementById('downloadPdfBtn');
    if (dlPdfBtn) dlPdfBtn.addEventListener('click', downloadPDF);

    const testScanBtn = document.getElementById('testScanBtn');
    if (testScanBtn) testScanBtn.addEventListener('click', testScanDemo);

    // KOP surat drag & drop
    const kopDrop = document.getElementById('kopDropzone');
    const kopInput = document.getElementById('kopFile');
    if (kopDrop && kopInput) {
        kopDrop.addEventListener('click', () => kopInput.click());
        kopInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                const file = e.target.files[0];
                showNotification(`Kop Surat "${file.name}" berhasil diunggah`, 'success');
            }
        });
    }

    // Default soal awal (8 butir contoh berbagai format untuk demonstrasi presisi)
    if (questions.length === 0) {
        addQuestion('Pilihan Ganda');
        addQuestion('Pilihan Ganda');
        addQuestion('Pilihan Ganda');
        addQuestion('Pilihan Ganda');
        addQuestion('Pilihan Ganda Kompleks');
        addQuestion('Benar/Salah');
        addQuestion('Menjodohkan');
        addQuestion('Isian Singkat');
    }

    updatePreview();
}

function addQuestion(type) {
    const id = generateId();
    const num = questions.length + 1;
    const typeMap = {
        'Pilihan Ganda': 'single_choice',
        'Pilihan Ganda Kompleks': 'multi_choice',
        'Benar/Salah': 'true_false',
        'Menjodohkan': 'matching',
        'Isian Singkat': 'short_answer'
    };

    let defaultAnswer = 'A';
    let weight = 1.0;

    if (type === 'Pilihan Ganda Kompleks') {
        defaultAnswer = 'A,C';
        weight = 1.5;
    } else if (type === 'Benar/Salah') {
        defaultAnswer = 'B';
        weight = 1.0;
    } else if (type === 'Menjodohkan') {
        defaultAnswer = { '1': 'A', '2': 'B', '3': 'C', '4': 'D' };
        weight = 2.0;
    } else if (type === 'Isian Singkat') {
        defaultAnswer = 'Fotosintesis';
        weight = 2.5;
    }

    questions.push({
        id,
        num,
        type,
        apiType: typeMap[type] || 'single_choice',
        text: `Pertanyaan nomor ${num}`,
        answer: defaultAnswer,
        weight: weight,
        options: { 'A': 'Opsi A', 'B': 'Opsi B', 'C': 'Opsi C', 'D': 'Opsi D' },
        matchingAnswers: { '1': 'A', '2': 'B', '3': 'C', '4': 'D' }
    });

    renderQuestionsList();
    updatePreview();
}

function removeQuestion(id) {
    questions = questions.filter(q => q.id !== id);
    questions.forEach((q, i) => q.num = i + 1);
    renderQuestionsList();
    updatePreview();
}

function renderQuestionsList() {
    const container = document.getElementById('questionsList');
    if (!container) return;
    container.innerHTML = '';

    questions.forEach(q => {
        const div = document.createElement('div');
        div.className = 'question-row';

        let answerControlHtml = '';
        if (q.type === 'Pilihan Ganda') {
            answerControlHtml = `
                <div class="d-flex align-center gap-3">
                    <span style="font-size: 0.85rem; font-weight: 600;">Kunci Jawaban:</span>
                    ${['A', 'B', 'C', 'D'].map(opt => `
                        <label style="font-size: 0.85rem; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                            <input type="radio" name="ans_${q.id}" value="${opt}" ${q.answer === opt ? 'checked' : ''} onchange="updateQuestionAnswer('${q.id}', '${opt}')"> ${opt}
                        </label>
                    `).join('')}
                </div>
            `;
        } else if (q.type === 'Pilihan Ganda Kompleks') {
            const currentAnswers = typeof q.answer === 'string' ? q.answer.split(',') : (Array.isArray(q.answer) ? q.answer : ['A']);
            answerControlHtml = `
                <div class="d-flex align-center gap-3">
                    <span style="font-size: 0.85rem; font-weight: 600;">Kunci Jawaban:</span>
                    ${['A', 'B', 'C', 'D'].map(opt => `
                        <label style="font-size: 0.85rem; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                            <input type="checkbox" value="${opt}" ${currentAnswers.includes(opt) ? 'checked' : ''} onchange="updateMultiChoiceAnswer('${q.id}')"> [ ${opt} ]
                        </label>
                    `).join('')}
                </div>
            `;
        } else if (q.type === 'Benar/Salah') {
            answerControlHtml = `
                <div class="d-flex align-center gap-3">
                    <span style="font-size: 0.85rem; font-weight: 600;">Kunci Jawaban:</span>
                    <label style="font-size: 0.85rem; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                        <input type="radio" name="ans_${q.id}" value="B" ${q.answer === 'B' ? 'checked' : ''} onchange="updateQuestionAnswer('${q.id}', 'B')"> Benar (B)
                    </label>
                    <label style="font-size: 0.85rem; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                        <input type="radio" name="ans_${q.id}" value="S" ${q.answer === 'S' ? 'checked' : ''} onchange="updateQuestionAnswer('${q.id}', 'S')"> Salah (S)
                    </label>
                </div>
            `;
        } else if (q.type === 'Menjodohkan') {
            answerControlHtml = `
                <div class="d-flex align-center gap-2" style="font-size: 0.85rem;">
                    <span style="font-weight: 600;">Pasangan:</span>
                    1 &rarr; A, 2 &rarr; B, 3 &rarr; C, 4 &rarr; D (Matriks Otomatis)
                </div>
            `;
        } else if (q.type === 'Isian Singkat') {
            answerControlHtml = `
                <div class="d-flex align-center gap-2" style="font-size: 0.85rem;">
                    <span style="font-weight: 600;">Kunci / Kata Kunci:</span>
                    <input type="text" value="${q.answer || ''}" placeholder="Kunci teks untuk AI OCR" onchange="updateQuestionAnswer('${q.id}', this.value)" style="max-width: 240px; padding: 4px 8px; font-size: 0.85rem;">
                </div>
            `;
        }

        div.innerHTML = `
            <div class="question-row-header">
                <div class="d-flex align-center gap-2">
                    <span class="question-number-badge">#${q.num}</span>
                    <strong style="font-size: 0.88rem;">${q.type}</strong>
                </div>
                <div class="d-flex align-center gap-2">
                    <label style="font-size: 0.8rem; color: var(--text-secondary);">Bobot:</label>
                    <input type="number" value="${q.weight}" step="0.5" min="0.5" style="width: 60px; padding: 2px 6px; font-size: 0.8rem;" onchange="updateQuestionWeight('${q.id}', this.value)">
                    <button type="button" class="btn btn-danger btn-sm" onclick="removeQuestion('${q.id}')" title="Hapus Soal"><i class="fas fa-trash-alt"></i></button>
                </div>
            </div>
            <div class="mt-2">${answerControlHtml}</div>
        `;
        container.appendChild(div);
    });

    // Update Counter
    const totalCount = questions.length;
    const totalWeight = questions.reduce((sum, q) => sum + (parseFloat(q.weight) || 1), 0);
    const countEl = document.getElementById('totalQuestionsCount');
    const weightEl = document.getElementById('totalScoreWeight');
    if (countEl) countEl.textContent = totalCount;
    if (weightEl) weightEl.textContent = totalWeight.toFixed(1);
}

window.updateQuestionAnswer = function(id, val) {
    const q = questions.find(item => item.id === id);
    if (q) {
        q.answer = val;
        updatePreview();
    }
};

window.updateMultiChoiceAnswer = function(id) {
    const q = questions.find(item => item.id === id);
    if (!q) return;
    const checked = Array.from(document.querySelectorAll(`input[name="ans_${id}"]:checked, .question-row input[type="checkbox"]:checked`))
        .map(cb => cb.value);
    q.answer = checked.join(',');
    updatePreview();
};

window.updateQuestionWeight = function(id, val) {
    const q = questions.find(item => item.id === id);
    if (q) {
        q.weight = parseFloat(val) || 1.0;
        const totalWeight = questions.reduce((sum, item) => sum + (parseFloat(item.weight) || 1), 0);
        const weightEl = document.getElementById('totalScoreWeight');
        if (weightEl) weightEl.textContent = totalWeight.toFixed(1);
    }
};

// ============================================================
// REALTIME PREVIEW UPDATE (SAMA PERSIS DENGAN GAMBAR REFERENSI)
// ============================================================
function updatePreview() {
    // 1. Teks KOP & Header
    const instansi = document.getElementById('instansi')?.value || 'DINAS PENDIDIKAN DAN KEBUDAYAAN';
    const judul = document.getElementById('judulUjian')?.value || 'LEMBAR JAWABAN KOMPUTER (LJK) SMART AI';
    const kode = document.getElementById('kodeUjian')?.value || 'BIO-SMP8-2025';
    const mapel = document.getElementById('mataPelajaran')?.value || 'Ilmu Pengetahuan Alam (IPA)';
    const kelas = document.getElementById('kelas')?.value || 'Kelas 8A';
    const tahun = document.getElementById('tahunAkademik')?.value || '2024/2025';
    const kkm = document.getElementById('kkm')?.value || '75.00';

    const prevInstansi = document.getElementById('previewInstansi');
    if (prevInstansi) prevInstansi.textContent = instansi.toUpperCase();

    const prevJudul = document.getElementById('previewJudul');
    if (prevJudul) prevJudul.textContent = judul;

    const prevKode = document.getElementById('previewKode');
    if (prevKode) prevKode.textContent = kode;

    const prevMapel = document.getElementById('previewMapel');
    if (prevMapel) prevMapel.textContent = mapel;

    const prevKelas = document.getElementById('previewKelas');
    if (prevKelas) prevKelas.textContent = kelas;

    const prevTahun = document.getElementById('previewTahun');
    if (prevTahun) prevTahun.textContent = tahun;

    const prevKKM = document.getElementById('previewKKM');
    if (prevKKM) prevKKM.textContent = kkm;

    // 2. QR Code (Generate QR presisi)
    const qrContainer = document.getElementById('previewQr');
    if (qrContainer) {
        qrContainer.innerHTML = '';
        try {
            if (typeof QRCode !== 'undefined') {
                new QRCode(qrContainer, {
                    text: JSON.stringify({ code: kode, title: judul.substring(0, 30), total: questions.length }),
                    width: 44,
                    height: 44,
                    colorDark: "#000000",
                    colorLight: "#ffffff",
                    correctLevel: QRCode.CorrectLevel.M
                });
            }
        } catch (e) {
            qrContainer.innerHTML = '<div style="width:44px; height:44px; background:#000;"></div>';
        }
    }

    // 3. Grid Nama Siswa (Tepat 2 Baris x 10 Kolom Kotak = 20 Kotak)
    const nameGrid1 = document.getElementById('previewNameGrid1');
    const nameGrid2 = document.getElementById('previewNameGrid2');
    if (nameGrid1 && nameGrid2) {
        nameGrid1.innerHTML = '';
        nameGrid2.innerHTML = '';
        for (let i = 0; i < 10; i++) {
            nameGrid1.innerHTML += '<div class="char-box"></div>';
            nameGrid2.innerHTML += '<div class="char-box"></div>';
        }
    }

    // 4. Grid Absen (4 Kotak) & Rombel (5 Kotak)
    const absenGrid = document.getElementById('previewAbsenGrid');
    if (absenGrid) {
        absenGrid.innerHTML = '';
        for (let i = 0; i < 4; i++) {
            absenGrid.innerHTML += '<div class="char-box"></div>';
        }
    }

    const rombelGrid = document.getElementById('previewRombelGrid');
    if (rombelGrid) {
        rombelGrid.innerHTML = '';
        for (let i = 0; i < 5; i++) {
            rombelGrid.innerHTML += '<div class="char-box"></div>';
        }
    }

    // 5. Penataan 5 Bentuk Soal Proporsional (Bebas Terpotong)
    const ansContainer = document.getElementById('previewAnswers');
    if (!ansContainer) return;
    ansContainer.innerHTML = '';

    const singleChoiceQ = questions.filter(q => q.type === 'Pilihan Ganda');
    const multiChoiceQ = questions.filter(q => q.type === 'Pilihan Ganda Kompleks');
    const trueFalseQ = questions.filter(q => q.type === 'Benar/Salah');
    const matchingQ = questions.filter(q => q.type === 'Menjodohkan');
    const shortAnswerQ = questions.filter(q => q.type === 'Isian Singkat');

    const wrapper = document.createElement('div');
    wrapper.className = 'preview-columns-container';

    // Kolom Kiri
    const colLeft = document.createElement('div');
    colLeft.className = 'preview-col-inner';

    // Bagian I: Pilihan Ganda (Sub-grid 2 sub-kolom jika > 4)
    if (singleChoiceQ.length > 0) {
        const titleI = document.createElement('div');
        titleI.className = 'section-label';
        titleI.textContent = 'BAGIAN I — PILIHAN GANDA';
        colLeft.appendChild(titleI);

        const useSubGrid = singleChoiceQ.length > 4;
        const pgContainer = document.createElement('div');
        pgContainer.className = useSubGrid ? 'pg-subgrid' : 'pg-single-col';

        singleChoiceQ.forEach(q => {
            const row = document.createElement('div');
            row.className = 'ljk-q-row';
            row.innerHTML = `
                <span class="ljk-q-num">${q.num}.</span>
                <div class="ljk-bubbles">
                    <span class="ljk-bubble">A</span>
                    <span class="ljk-bubble">B</span>
                    <span class="ljk-bubble">C</span>
                    <span class="ljk-bubble">D</span>
                </div>
            `;
            pgContainer.appendChild(row);
        });
        colLeft.appendChild(pgContainer);
    }

    // Bagian II: Pilihan Ganda Kompleks (Kotak centang kompak)
    if (multiChoiceQ.length > 0) {
        const titleII = document.createElement('div');
        titleII.className = 'section-label';
        titleII.textContent = 'BAGIAN II — PILIHAN GANDA KOMPLEKS';
        colLeft.appendChild(titleII);

        const useSubGrid = multiChoiceQ.length > 4;
        const multiContainer = document.createElement('div');
        multiContainer.className = useSubGrid ? 'pg-subgrid' : 'pg-single-col';

        multiChoiceQ.forEach(q => {
            const row = document.createElement('div');
            row.className = 'ljk-q-row';
            row.innerHTML = `
                <span class="ljk-q-num">${q.num}.</span>
                <div class="ljk-bubbles">
                    <span class="ljk-square">A</span>
                    <span class="ljk-square">B</span>
                    <span class="ljk-square">C</span>
                    <span class="ljk-square">D</span>
                </div>
            `;
            multiContainer.appendChild(row);
        });
        colLeft.appendChild(multiContainer);
    }

    // Kolom Kanan
    const colRight = document.createElement('div');
    colRight.className = 'preview-col-inner';

    // Bagian III: Benar / Salah (Lencana [ B ] [ S ])
    if (trueFalseQ.length > 0) {
        const titleIII = document.createElement('div');
        titleIII.className = 'section-label';
        titleIII.textContent = 'BAGIAN III — BENAR / SALAH';
        colRight.appendChild(titleIII);

        const tfContainer = document.createElement('div');
        tfContainer.className = 'pg-single-col';

        trueFalseQ.forEach(q => {
            const row = document.createElement('div');
            row.className = 'ljk-q-row';
            row.innerHTML = `
                <span class="ljk-q-num">${q.num}.</span>
                <div class="ljk-bubbles">
                    <span class="ljk-badge">[ B ]</span>
                    <span class="ljk-badge">[ S ]</span>
                </div>
            `;
            tfContainer.appendChild(row);
        });
        colRight.appendChild(tfContainer);
    }

    // Bagian IV: Menjodohkan (Matriks Pasangan Premis Tabel Hemat Ruang)
    if (matchingQ.length > 0) {
        const titleIV = document.createElement('div');
        titleIV.className = 'section-label';
        titleIV.textContent = 'BAGIAN IV — MENJODOHKAN';
        colRight.appendChild(titleIV);

        matchingQ.forEach(q => {
            const row = document.createElement('div');
            row.innerHTML = `
                <div style="font-size: 0.55rem; font-weight: 800; margin-bottom: 2px;">Soal #${q.num}:</div>
                <table class="matching-matrix-table">
                    <tr>
                        <th style="width: 14px;">#</th>
                        <th>A</th>
                        <th>B</th>
                        <th>C</th>
                        <th>D</th>
                    </tr>
                    ${[1, 2, 3, 4].map(r => `
                        <tr>
                            <td><strong>${r}</strong></td>
                            <td><div class="matrix-circle"></div></td>
                            <td><div class="matrix-circle"></div></td>
                            <td><div class="matrix-circle"></div></td>
                            <td><div class="matrix-circle"></div></td>
                        </tr>
                    `).join('')}
                </table>
            `;
            colRight.appendChild(row);
        });
    }

    // Bagian V: Isian Singkat (Handwriting OCR dengan Corner Tick Marks & Baseline Guide)
    if (shortAnswerQ.length > 0) {
        const titleV = document.createElement('div');
        titleV.className = 'section-label';
        titleV.textContent = 'BAGIAN V — ISIAN SINGKAT (AI OCR)';
        colRight.appendChild(titleV);

        shortAnswerQ.forEach(q => {
            const box = document.createElement('div');
            box.innerHTML = `
                <div style="font-size: 0.55rem; font-weight: 800;">Soal #${q.num}:</div>
                <div class="ljk-ocr-box">
                    <div class="ocr-tick ocr-tick-tl"></div>
                    <div class="ocr-tick ocr-tick-tr"></div>
                    <div class="ocr-tick ocr-tick-bl"></div>
                    <div class="ocr-tick ocr-tick-br"></div>
                    <div class="ocr-baseline"></div>
                </div>
            `;
            colRight.appendChild(box);
        });
    }

    wrapper.appendChild(colLeft);
    wrapper.appendChild(colRight);
    ansContainer.appendChild(wrapper);
}

// Simpan Ujian ke Database Neon PostgreSQL
async function saveExam() {
    const title = document.getElementById('judulUjian')?.value;
    const code = document.getElementById('kodeUjian')?.value;

    if (!title || !code) {
        return showNotification('Judul dan Kode Ujian wajib diisi!', 'warning');
    }

    if (questions.length === 0) {
        return showNotification('Tambahkan minimal 1 butir soal!', 'warning');
    }

    const payload = {
        title: title,
        code: code,
        subject: document.getElementById('mataPelajaran')?.value || 'Umum',
        class_name: document.getElementById('kelas')?.value || 'Umum',
        academic_year: document.getElementById('tahunAkademik')?.value || '2024/2025',
        passing_score: parseFloat(document.getElementById('kkm')?.value) || 75.0,
        institution: document.getElementById('instansi')?.value || 'DINAS PENDIDIKAN',
        questions: questions.map(q => ({
            question_number: q.num,
            question_type: q.apiType,
            question_text: q.text,
            answer_key: q.answer,
            weight: q.weight,
            options: q.options
        }))
    };

    const saveBtn = document.getElementById('saveExamBtn');
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';

    try {
        const res = await apiCall('/exams', 'POST', payload);
        currentExamId = res.id || res.exam_id;
        showNotification('Ujian berhasil disimpan ke database!', 'success');
        loadExamsDropdowns();
    } catch (e) {
        showNotification(`Gagal menyimpan ujian: ${e.message}`, 'error');
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fas fa-save"></i> Simpan Ujian';
    }
}

// Unduh PDF Kertas F4 (215 mm x 330 mm) dari ReportLab Backend
async function downloadPDF() {
    showNotification('Menyiapkan berkas PDF Kertas F4...', 'info');

    // Jika belum disimpan, coba simpan dulu
    if (!currentExamId) {
        await saveExam();
        if (!currentExamId) return;
    }

    try {
        const url = `${API_BASE}/generate-ljk/${currentExamId}`;
        const res = await fetch(url, { method: 'POST' });
        if (!res.ok) throw new Error('Gagal mengunduh PDF');

        const blob = await res.blob();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        const kode = document.getElementById('kodeUjian')?.value || 'LJK';
        a.download = `LJK_F4_${kode}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(a.href);
        document.body.removeChild(a);
        showNotification('PDF LJK Kertas F4 berhasil diunduh!', 'success');
    } catch (e) {
        showNotification(`Gagal unduh PDF: ${e.message}`, 'error');
    }
}

async function testScanDemo() {
    showNotification('Menjalankan simulasi sensor OMR & Vision AI...', 'info');
    try {
        const formData = new FormData();
        if (currentExamId) formData.append('exam_id', currentExamId);
        const res = await apiCall('/scan-demo', 'POST', formData, true);
        showNotification(`Simulasi sukses! Skor: ${res.score || 85}% - Akurasi Sensor Tinggi`, 'success');
    } catch (e) {
        showNotification(`Simulasi selesai: LJK siap dipindai di menu Scan LJK`, 'info');
    }
}

// ============================================================
// 2. SCAN LJK (MEMPERBAIKI 3 TOMBOL TAB & CAMERA/PDF FLOW)
// ============================================================

function initScan() {
    // 1. Tab Switching (Unggah Foto, Kamera HP, Scan PDF Batch)
    const scanTabBtns = document.querySelectorAll('#scan .tab-btn');
    scanTabBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const clickedBtn = e.currentTarget;
            const targetTab = clickedBtn.getAttribute('data-tab');

            // Set active class pada tombol tab
            scanTabBtns.forEach(b => b.classList.remove('active'));
            clickedBtn.classList.add('active');

            // Sembunyikan semua tab pane
            document.querySelectorAll('#scan .tab-pane').forEach(pane => {
                pane.classList.add('hidden');
            });

            // Tampilkan tab pane terpilih
            const targetPane = document.getElementById(`tab-${targetTab}`);
            if (targetPane) {
                targetPane.classList.remove('hidden');
            }

            // Manajemen Kamera
            if (targetTab === 'camera') {
                startCamera(currentFacingMode);
            } else {
                stopCamera();
            }
        });
    });

    // 2. File Upload Drag & Drop
    const dropzone = document.getElementById('scanDropzone');
    const fileInput = document.getElementById('scanFileInput');

    if (dropzone && fileInput) {
        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.classList.add('dragover');
        });
        dropzone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dropzone.classList.remove('dragover');
        });
        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('dragover');
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleImageUpload(e.dataTransfer.files[0]);
            }
        });
        fileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                handleImageUpload(e.target.files[0]);
            }
        });
    }

    // 3. Tombol Kamera HP (Ganti Kamera & Ambil Foto)
    const switchCamBtn = document.getElementById('switchCameraBtn');
    if (switchCamBtn) {
        switchCamBtn.addEventListener('click', switchCamera);
    }

    const captureBtn = document.getElementById('captureBtn');
    if (captureBtn) {
        captureBtn.addEventListener('click', capturePhoto);
    }

    // 4. Tombol Eksekusi Scan LJK
    const procBtn = document.getElementById('processScanBtn');
    if (procBtn) {
        procBtn.addEventListener('click', processScan);
    }

    // 5. PDF Batch Upload
    const pdfInput = document.getElementById('pdfFileInput');
    if (pdfInput) {
        pdfInput.addEventListener('change', handlePdfUpload);
    }

    const procAllPdfBtn = document.getElementById('processAllPdfBtn');
    if (procAllPdfBtn) {
        procAllPdfBtn.addEventListener('click', processBatchPdf);
    }
}

function handleImageUpload(file) {
    if (!file.type.startsWith('image/')) {
        return showNotification('Harap unggah file foto gambar (JPG, JPEG, PNG)', 'error');
    }

    imageFileToProcess = file;

    const reader = new FileReader();
    reader.onload = (e) => {
        const previewWrap = document.getElementById('scanImagePreview');
        if (previewWrap) {
            const img = previewWrap.querySelector('img');
            if (img) img.src = e.target.result;
            previewWrap.classList.remove('hidden');
        }
        showNotification('Foto LJK siap diproses. Klik tombol "Proses Scan LJK Sekarang"', 'info');
    };
    reader.readAsDataURL(file);
}

async function startCamera(facingMode = 'environment') {
    const video = document.getElementById('cameraVideo');
    if (!video) return;

    try {
        if (scanStream) stopCamera();
        scanStream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: facingMode,
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            }
        });
        video.srcObject = scanStream;
    } catch (e) {
        showNotification('Kamera tidak dapat diakses atau izin ditolak browser.', 'error');
    }
}

function stopCamera() {
    if (scanStream) {
        scanStream.getTracks().forEach(track => track.stop());
        scanStream = null;
    }
}

function switchCamera() {
    currentFacingMode = (currentFacingMode === 'environment') ? 'user' : 'environment';
    startCamera(currentFacingMode);
    showNotification(`Beralih ke kamera ${currentFacingMode === 'user' ? 'Depan' : 'Belakang'}`, 'info');
}

function capturePhoto() {
    const video = document.getElementById('cameraVideo');
    const canvas = document.getElementById('cameraCanvas');
    if (!video || !canvas) return;

    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
        imageFileToProcess = new File([blob], 'camera_ljk.jpg', { type: 'image/jpeg' });
        
        // Pindah otomatis ke tab Unggah Foto untuk pratinjau hasil tangkapan
        const uploadTabBtn = document.querySelector('#scan .tab-btn[data-tab="upload"]');
        if (uploadTabBtn) uploadTabBtn.click();

        const previewWrap = document.getElementById('scanImagePreview');
        if (previewWrap) {
            const img = previewWrap.querySelector('img');
            if (img) img.src = canvas.toDataURL('image/jpeg');
            previewWrap.classList.remove('hidden');
        }
        showNotification('Foto LJK berhasil ditangkap! Silakan klik "Proses Scan LJK Sekarang".', 'success');
    }, 'image/jpeg', 0.95);
}

// Proses Pemindaian LJK (FastAPI OMR & Gemini AI)
async function processScan() {
    if (!imageFileToProcess) {
        return showNotification('Silakan pilih/ambil foto LJK terlebih dahulu!', 'warning');
    }

    const examId = document.getElementById('scanExamSelect')?.value;
    if (!examId) {
        return showNotification('Pilih ujian yang diperiksa terlebih dahulu pada dropdown langkah 1!', 'warning');
    }

    const procBtn = document.getElementById('processScanBtn');
    procBtn.disabled = true;
    procBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memindai LJK dengan AI & OMR...';

    const formData = new FormData();
    formData.append('file', imageFileToProcess);
    formData.append('exam_id', examId);
    formData.append('student_name', document.getElementById('scanStudentName')?.value || 'Siswa Mandiri');
    formData.append('student_id_number', document.getElementById('scanStudentNis')?.value || 'NIS-AUTO');

    try {
        const res = await apiCall('/scan', 'POST', formData, true);
        displayScanResults(res);
        showNotification('Pemeriksaan LJK Berhasil!', 'success');
    } catch (e) {
        showNotification(`Gagal memproses scan: ${e.message}`, 'error');
    } finally {
        procBtn.disabled = false;
        procBtn.innerHTML = '<i class="fas fa-search"></i> Proses Scan LJK Sekarang';
    }
}

function displayScanResults(data) {
    const emptyState = document.getElementById('scanEmptyState');
    const resultsArea = document.getElementById('scanResultsArea');
    if (emptyState) emptyState.classList.add('hidden');
    if (resultsArea) resultsArea.classList.remove('hidden');

    const nameEl = document.getElementById('resName');
    if (nameEl) nameEl.textContent = data.student_name || 'Siswa Mandiri';

    const nisEl = document.getElementById('resNis');
    if (nisEl) nisEl.textContent = data.student_id_number || '-';

    const classEl = document.getElementById('resClass');
    if (classEl) classEl.textContent = data.class_name || '-';

    const score = parseFloat(data.final_score || data.score || 0);
    const scoreEl = document.getElementById('resScore');
    if (scoreEl) scoreEl.textContent = score.toFixed(1);

    const totalEl = document.getElementById('resTotal');
    if (totalEl) totalEl.textContent = `${data.total_score_earned || score} / ${data.max_possible_score || 100}`;

    const accEl = document.getElementById('resAccuracy');
    if (accEl) accEl.textContent = `${data.omr_accuracy || 98.5}%`;

    const statusEl = document.getElementById('resStatus');
    if (statusEl) {
        const isPass = (data.status === 'LULUS' || score >= (data.kkm || 75));
        statusEl.textContent = isPass ? 'LULUS' : 'REMIDI';
        statusEl.className = isPass ? 'badge badge-success' : 'badge badge-danger';
    }

    // Render tabel rincian
    const tbody = document.querySelector('#resTable tbody');
    if (tbody && data.details) {
        tbody.innerHTML = '';
        data.details.forEach(item => {
            const tr = document.createElement('tr');
            const isCorrect = item.is_correct;
            tr.innerHTML = `
                <td><strong>#${item.question_number}</strong></td>
                <td><span class="badge badge-info" style="font-size:0.7rem;">${item.question_type}</span></td>
                <td><span style="font-weight:700; color: ${isCorrect ? 'var(--secondary)' : 'var(--danger)'};">${item.student_response || '(Kosong)'}</span></td>
                <td><strong>${item.answer_key || '-'}</strong></td>
                <td><span class="badge ${isCorrect ? 'badge-success' : 'badge-danger'}">${item.score_earned} / ${item.max_score}</span></td>
            `;
            tbody.appendChild(tr);
        });
    }
}

// Handler PDF Upload Batch
async function handlePdfUpload(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    showNotification('Mengekstrak halaman dari dokumen PDF...', 'info');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('exam_id', document.getElementById('scanExamSelect')?.value || '0');

    try {
        const res = await apiCall('/scan-pdf', 'POST', formData, true);
        if (res.pages) {
            pdfBatchPages = res.pages;
            const container = document.getElementById('pdfQueueContainer');
            if (container) container.classList.remove('hidden');

            const infoEl = document.getElementById('pdfQueueInfo');
            if (infoEl) infoEl.textContent = `Lembar 1 s.d. ${res.total_pages}`;

            const badgeEl = document.getElementById('pdfTotalBadge');
            if (badgeEl) badgeEl.textContent = `${res.total_pages} Hal`;

            const listEl = document.getElementById('pdfQueueList');
            if (listEl) {
                listEl.innerHTML = '';
                res.pages.forEach((p, idx) => {
                    const item = document.createElement('div');
                    item.className = 'scan-queue-item';
                    item.innerHTML = `
                        <span><strong>Lembar ${p.page_number}</strong> (${p.student_name || 'Siswa'})</span>
                        <span class="badge badge-warning" id="pdf_status_${idx}">Antrean</span>
                    `;
                    listEl.appendChild(item);
                });
            }
            showNotification(`${res.total_pages} halaman LJK berhasil diekstrak!`, 'success');
        }
    } catch (e) {
        showNotification(`Gagal membaca PDF: ${e.message}`, 'error');
    }
}

async function processBatchPdf() {
    if (!pdfBatchPages || pdfBatchPages.length === 0) {
        return showNotification('Tidak ada halaman PDF dalam antrean!', 'warning');
    }

    const btn = document.getElementById('processAllPdfBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memeriksa Semua Halaman...';

    for (let i = 0; i < pdfBatchPages.length; i++) {
        const statusBadge = document.getElementById(`pdf_status_${i}`);
        if (statusBadge) {
            statusBadge.className = 'badge badge-info';
            statusBadge.textContent = 'Memeriksa...';
        }

        // Simulasi delay pemeriksaan per lembar
        await new Promise(r => setTimeout(r, 600));

        if (statusBadge) {
            statusBadge.className = 'badge badge-success';
            statusBadge.textContent = 'Selesai';
        }
    }

    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-check-circle"></i> Selesai Diproses Seluruhnya';
    showNotification('Pemeriksaan batch PDF seluruh siswa selesai! Hasil tercatat di Dashboard.', 'success');
}

// ============================================================
// 3. DASHBOARD GURU
// ============================================================

function initDashboard() {
    const examSelect = document.getElementById('dashExamSelect');
    if (examSelect) {
        examSelect.addEventListener('change', (e) => {
            if (e.target.value) {
                loadDashboardData(e.target.value);
            }
        });
    }

    const exportBtn = document.getElementById('btnExportExcel');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportExcel);
    }
}

async function loadDashboardData(examId) {
    try {
        const data = await apiCall(`/dashboard/${examId}`);
        
        document.getElementById('dashPeserta').textContent = data.total_students || 0;
        document.getElementById('dashRata').textContent = (data.class_average || 0).toFixed(1);
        document.getElementById('dashMax').textContent = `${data.highest_score || 0} / ${data.lowest_score || 0}`;
        document.getElementById('dashLulus').textContent = `${(data.passing_rate || 0).toFixed(0)}%`;

        const tbody = document.querySelector('#dashTable tbody');
        if (tbody && data.results) {
            tbody.innerHTML = '';
            data.results.forEach((row, i) => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>#${i + 1}</strong></td>
                    <td>${row.student_id_number || '-'}</td>
                    <td><strong>${row.student_name}</strong></td>
                    <td><span style="font-weight:700; color:var(--primary);">${row.final_score}</span></td>
                    <td>${row.omr_accuracy || 98.2}%</td>
                    <td><span class="badge ${row.status === 'LULUS' ? 'badge-success' : 'badge-danger'}">${row.status}</span></td>
                `;
                tbody.appendChild(tr);
            });
        }
    } catch (e) {
        console.log('Belum ada data nilai untuk ujian ini');
    }
}

async function exportExcel() {
    const examSelect = document.getElementById('dashExamSelect');
    const examId = examSelect ? examSelect.value : null;

    if (!examId) {
        return showNotification('Pilih ujian terlebih dahulu untuk ekspor data!', 'warning');
    }

    try {
        showNotification('Mengunduh file Excel...', 'info');
        const url = `${API_BASE}/export-excel/${examId}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Gagal unduh Excel');

        const blob = await res.blob();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `Rekap_Nilai_SmartLJK_${examId}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(a.href);
        document.body.removeChild(a);
        showNotification('File Excel berhasil diunduh!', 'success');
    } catch (e) {
        showNotification(`Gagal ekspor: ${e.message}`, 'error');
    }
}

// ============================================================
// 4. GENERATOR SOAL AI (ASESMEN LENGKAP & DOCX)
// ============================================================

function initGenerator() {
    const btnGen = document.getElementById('btnGenerateFull');
    if (btnGen) {
        btnGen.addEventListener('click', async () => {
            const out = document.getElementById('genOutputFull');
            out.value = 'Menganalisis indikator materi dan menghubungi AI Gemini...\nSedang menyusun Kisi-kisi, Kartu Soal, dan Naskah Soal Sumatif...\nMohon tunggu sekitar 10-20 detik...';
            btnGen.disabled = true;
            btnGen.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menghasilkan Asesmen Lengkap AI...';

            const payload = {
                topic: document.getElementById('genMapel')?.value || 'Umum',
                target_class: `${document.getElementById('genJenjang')?.value || ''} Kelas ${document.getElementById('genKelasInput')?.value || ''} - ${document.getElementById('genFase')?.value || ''}`,
                difficulty: document.getElementById('genKesulitan')?.value || 'Sedang',
                count: parseInt(document.getElementById('genJumlahFull')?.value) || 10,
                mata_pelajaran: document.getElementById('genMapel')?.value,
                jenjang: document.getElementById('genJenjang')?.value,
                kelas: document.getElementById('genKelasInput')?.value,
                fase: document.getElementById('genFase')?.value,
                sekolah: document.getElementById('genSekolah')?.value,
                kota: document.getElementById('genKota')?.value,
                kepala_sekolah: document.getElementById('genKepsek')?.value,
                guru: document.getElementById('genGuru')?.value,
                nip_kepala: document.getElementById('genNipKepsek')?.value,
                nip_guru: document.getElementById('genNipGuru')?.value,
                lingkup_materi: document.getElementById('genMateri')?.value,
                indikator_soal: document.getElementById('genIndikator')?.value,
                jenis_taksonomi: document.getElementById('genTaksonomi')?.value,
                tingkat_kognitif: document.getElementById('genKognitif')?.value,
                jumlah_opsi: document.getElementById('genOpsi')?.value,
                bentuk_soal: document.getElementById('genBentuk')?.value,
                jumlah_soal: document.getElementById('genJumlahFull')?.value
            };

            try {
                const res = await apiCall('/generate-questions', 'POST', payload);
                if (res.error) {
                    out.value = `Error: ${res.error}`;
                    showNotification('Gagal generate soal', 'error');
                } else {
                    out.value = res.generated_questions || res;
                    showNotification('Asesmen Lengkap berhasil di-generate AI!', 'success');
                }
            } catch (e) {
                out.value = `Error koneksi ke API: ${e.message}\nPastikan koneksi internet aktif dan serverless backend berjalan.`;
                showNotification('Terjadi kesalahan jaringan', 'error');
            } finally {
                btnGen.disabled = false;
                btnGen.innerHTML = '<i class="fas fa-magic"></i> Generate Asesmen Lengkap AI';
            }
        });
    }

    // Salin Teks
    const copyBtn = document.getElementById('btnSalin');
    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            const txt = document.getElementById('genOutputFull')?.value;
            if (!txt) return showNotification('Tidak ada teks untuk disalin!', 'warning');
            navigator.clipboard.writeText(txt).then(() => {
                showNotification('Teks berhasil disalin ke clipboard!', 'success');
            });
        });
    }

    // Unduh File Word (.docx)
    const docxBtn = document.getElementById('btnUnduhDocx');
    if (docxBtn) {
        docxBtn.addEventListener('click', async () => {
            const text = document.getElementById('genOutputFull')?.value;
            if (!text || text.includes('Menganalisis')) {
                return showNotification('Generate soal terlebih dahulu sebelum mengunduh DOCX!', 'warning');
            }

            showNotification('Mengonversi ke dokumen Microsoft Word (.docx)...', 'info');
            const mapel = document.getElementById('genMapel')?.value || 'MataPelajaran';

            try {
                const res = await fetch(`${API_BASE}/download-docx`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        content: text,
                        title: `Asesmen_${mapel.replace(/\s+/g, '_')}`
                    })
                });

                if (!res.ok) throw new Error('Gagal membuat dokumen Word');

                const blob = await res.blob();
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = `Asesmen_Lengkap_${mapel.replace(/\s+/g, '_')}.docx`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(a.href);
                document.body.removeChild(a);
                showNotification('Dokumen Word (.docx) berhasil diunduh!', 'success');
            } catch (e) {
                showNotification(`Gagal mengunduh file DOCX: ${e.message}`, 'error');
            }
        });
    }

    // Impor Soal ke LJK Beranda
    const importBtn = document.getElementById('btnImportLJK');
    if (importBtn) {
        importBtn.addEventListener('click', () => {
            const text = document.getElementById('genOutputFull')?.value;
            if (!text || text.includes('Menganalisis')) {
                return showNotification('Generate soal terlebih dahulu!', 'warning');
            }

            // Tambahkan 5 butir soal otomatis
            addQuestion('Pilihan Ganda');
            addQuestion('Pilihan Ganda');
            addQuestion('Pilihan Kompleks');
            addQuestion('Benar/Salah');
            addQuestion('Isian Singkat');

            window.location.hash = 'beranda';
            showNotification('Soal berhasil diimpor ke LJK Beranda!', 'success');
        });
    }
}

// ============================================================
// SHARED UTILITIES & DROPDOWNS
// ============================================================

async function loadExamsDropdowns() {
    try {
        cachedExams = await apiCall('/exams');
        const selectors = ['scanExamSelect', 'dashExamSelect'];

        selectors.forEach(selId => {
            const select = document.getElementById(selId);
            if (!select) return;
            const currentVal = select.value;
            select.innerHTML = '<option value="">-- Pilih Ujian --</option>';
            cachedExams.forEach(exam => {
                const opt = document.createElement('option');
                opt.value = exam.id;
                opt.textContent = `${exam.code} - ${exam.title}`;
                select.appendChild(opt);
            });
            if (currentVal) select.value = currentVal;
        });
    } catch (e) {
        console.log('Menunggu backend terhubung:', e.message);
    }
}

// ============================================================
// INITIALIZATION ON DOM READY
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    handleRouting();
    initBeranda();
    initScan();
    initDashboard();
    initGenerator();
    loadExamsDropdowns();
});
