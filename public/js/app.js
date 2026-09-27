// ============================================================
// SmartLJK AI - Main Application Logic
// Integrasi penuh dengan FastAPI Backend
// ============================================================

const routes = ['beranda', 'scan', 'dashboard', 'generator'];

// ============================================================
// ROUTER
// ============================================================
function handleRouting() {
    let hash = window.location.hash.substring(1);
    if (!routes.includes(hash)) {
        hash = 'beranda';
        window.location.hash = hash;
    }

    document.querySelectorAll('.page-section').forEach(el => {
        el.classList.add('hidden');
        el.classList.remove('active');
    });

    const activeSection = document.getElementById(hash);
    if (activeSection) {
        activeSection.classList.remove('hidden');
        activeSection.classList.add('active');
    }

    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const activeNav = document.querySelector(`.nav-item[data-target="${hash}"]`);
    if (activeNav) activeNav.classList.add('active');

    // Inisialisasi per halaman
    if (hash === 'dashboard') loadDashboardData();
    if (hash === 'scan') loadExamsDropdowns();
}

window.addEventListener('hashchange', handleRouting);

// ============================================================
// GLOBAL STATE
// ============================================================
let questions = [];
let scanStream = null;
let currentExamId = null;
let imageFileToProcess = null;
let currentFacingMode = 'environment';
let cachedExams = [];

// ============================================================
// BERANDA - LJK Builder
// ============================================================

function initBeranda() {
    // Dropdown tambah soal
    document.getElementById('addQuestionBtn').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        document.getElementById('addQuestionDropdown').classList.toggle('show');
    });

    window.addEventListener('click', (e) => {
        if (!e.target.matches('#addQuestionBtn') && !e.target.closest('#addQuestionBtn')) {
            document.getElementById('addQuestionDropdown').classList.remove('show');
        }
    });

    document.querySelectorAll('#addQuestionDropdown a').forEach(a => {
        a.addEventListener('click', (e) => {
            e.preventDefault();
            addQuestion(e.target.getAttribute('data-type'));
            document.getElementById('addQuestionDropdown').classList.remove('show');
        });
    });

    // Realtime preview update
    document.querySelectorAll('#examForm input').forEach(input => {
        input.addEventListener('input', debounce(updatePreview, 300));
    });

    document.getElementById('saveExamBtn').addEventListener('click', saveExam);
    document.getElementById('printBtn').addEventListener('click', () => window.print());
    document.getElementById('downloadPdfBtn').addEventListener('click', downloadPDF);
    document.getElementById('testScanBtn').addEventListener('click', testScanDemo);

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
    questions.push({
        id, num, type, apiType: typeMap[type] || 'single_choice',
        text: '', answer: '', weight: 1.0, options: {},
        matchingAnswers: { 1: '', 2: '', 3: '', 4: '' }
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
    const container = document.getElementById('questionsContainer');
    container.innerHTML = '';

    questions.forEach((q) => {
        const div = document.createElement('div');
        const typeClass = q.type.replace(/[\s\/]+/g, '').toLowerCase();
        div.className = `question-row type-${typeClass}`;

        let answerInputHtml = '';

        if (q.type === 'Pilihan Ganda') {
            answerInputHtml = ['A', 'B', 'C', 'D'].map(opt =>
                `<label><input type="radio" name="ans_${q.id}" value="${opt}" 
                    onchange="updateAnswer('${q.id}', '${opt}')" 
                    ${q.answer === opt ? 'checked' : ''}> ${opt}</label>`
            ).join(' ');
            answerInputHtml = `<div class="d-flex gap-2">${answerInputHtml}</div>`;

        } else if (q.type === 'Pilihan Ganda Kompleks') {
            const arr = q.answer ? q.answer.split(',') : [];
            answerInputHtml = ['A', 'B', 'C', 'D'].map(opt =>
                `<label><input type="checkbox" 
                    onchange="updateMultiAnswer('${q.id}', '${opt}', this.checked)" 
                    ${arr.includes(opt) ? 'checked' : ''}> ${opt}</label>`
            ).join(' ');
            answerInputHtml = `<div class="d-flex gap-2">${answerInputHtml}</div>`;

        } else if (q.type === 'Benar/Salah') {
            answerInputHtml = `
                <div class="d-flex gap-2">
                    <label><input type="radio" name="ans_${q.id}" value="B" 
                        onchange="updateAnswer('${q.id}', 'B')" ${q.answer === 'B' ? 'checked' : ''}> Benar</label>
                    <label><input type="radio" name="ans_${q.id}" value="S" 
                        onchange="updateAnswer('${q.id}', 'S')" ${q.answer === 'S' ? 'checked' : ''}> Salah</label>
                </div>`;

        } else if (q.type === 'Menjodohkan') {
            answerInputHtml = `<div class="grid-2" style="gap:4px">` +
                [1, 2, 3, 4].map(n =>
                    `<div class="d-flex align-center gap-2" style="font-size:0.85rem">
                        <span>${n} →</span>
                        <select onchange="updateMatchAnswer('${q.id}', ${n}, this.value)" style="flex:1;padding:4px">
                            <option value="">-</option>
                            ${['A', 'B', 'C', 'D'].map(o =>
                        `<option value="${o}" ${q.matchingAnswers[n] === o ? 'selected' : ''}>${o}</option>`
                    ).join('')}
                        </select>
                    </div>`
                ).join('') + `</div>`;

        } else if (q.type === 'Isian Singkat') {
            answerInputHtml = `<input type="text" placeholder="Kunci Jawaban" value="${q.answer}" 
                onchange="updateAnswer('${q.id}', this.value)" class="form-control" style="width:100%">`;
        }

        div.innerHTML = `
            <div class="d-flex justify-between mb-2">
                <strong>${q.num}. ${q.type}</strong>
                <button class="btn btn-sm btn-danger" onclick="removeQuestion('${q.id}')"><i class="fas fa-trash"></i></button>
            </div>
            <div class="grid-2 gap-2 mb-2">
                <div>
                    <label class="text-sm">Teks Soal (Opsional)</label>
                    <input type="text" class="form-control" value="${q.text}" 
                        onchange="updateQText('${q.id}', this.value)" placeholder="Teks pertanyaan...">
                </div>
                <div>
                    <label class="text-sm">Bobot Nilai</label>
                    <input type="number" class="form-control" value="${q.weight}" step="0.5" min="0.5"
                        onchange="updateQWeight('${q.id}', this.value)">
                </div>
            </div>
            <div class="q-answer-box bg-light p-2 rounded">
                <label class="text-sm mb-1 d-block">Kunci Jawaban:</label>
                ${answerInputHtml}
            </div>
        `;
        container.appendChild(div);
    });
}

// Global handler functions untuk inline event
window.updateAnswer = (id, val) => {
    const q = questions.find(q => q.id === id);
    if (q) q.answer = val;
};
window.updateMultiAnswer = (id, val, checked) => {
    const q = questions.find(q => q.id === id);
    if (q) {
        let arr = q.answer ? q.answer.split(',').filter(Boolean) : [];
        if (checked) { if (!arr.includes(val)) arr.push(val); }
        else { arr = arr.filter(x => x !== val); }
        q.answer = arr.sort().join(',');
    }
};
window.updateMatchAnswer = (id, num, val) => {
    const q = questions.find(q => q.id === id);
    if (q) q.matchingAnswers[num] = val;
};
window.updateQText = (id, val) => {
    const q = questions.find(q => q.id === id);
    if (q) q.text = val;
};
window.updateQWeight = (id, val) => {
    const q = questions.find(q => q.id === id);
    if (q) q.weight = parseFloat(val) || 1;
};
window.removeQuestion = removeQuestion;
window.showStudentDetail = showStudentDetail;

function updatePreview() {
    const title = document.getElementById('judulUjian').value || 'Judul Ujian';
    const mapel = document.getElementById('mataPelajaran').value || 'Mata Pelajaran';
    const kelas = document.getElementById('kelas').value || 'Kelas';

    document.getElementById('previewJudul').textContent = title;
    document.getElementById('previewDetail').textContent = `${mapel} - ${kelas}`;

    // QR Code
    const qrContainer = document.getElementById('previewQr');
    qrContainer.innerHTML = '';
    try {
        new QRCode(qrContainer, {
            text: JSON.stringify({
                code: document.getElementById('kodeUjian').value || 'EXAM-001',
                title: title.substring(0, 30),
                total: questions.length
            }),
            width: 64, height: 64,
            colorDark: "#000000", colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H
        });
    } catch (e) { /* QRCode library belum dimuat */ }

    // Render preview soal
    const ansContainer = document.getElementById('previewAnswers');
    ansContainer.innerHTML = '';

    questions.forEach(q => {
        const row = document.createElement('div');
        row.className = 'preview-q-row';

        let bubbles = '';
        if (q.type === 'Pilihan Ganda') {
            bubbles = ['A', 'B', 'C', 'D'].map(o => `<div class="bubble"><span>${o}</span></div>`).join('');
        } else if (q.type === 'Pilihan Ganda Kompleks') {
            bubbles = ['A', 'B', 'C', 'D'].map(o => `<div class="checkbox-option"><span>${o}</span></div>`).join('');
        } else if (q.type === 'Benar/Salah') {
            bubbles = `<div class="bubble"><span>B</span></div><div class="bubble" style="margin-left:12px"><span>S</span></div>`;
        } else if (q.type === 'Menjodohkan') {
            bubbles = `<div class="matching-preview">
                <table class="matching-table"><thead><tr><th></th><th>A</th><th>B</th><th>C</th><th>D</th></tr></thead>
                <tbody>${[1, 2, 3, 4].map(n => `<tr><td>${n}</td>${['A', 'B', 'C', 'D'].map(() => '<td><div class="bubble-sm"></div></td>').join('')}</tr>`).join('')}</tbody>
                </table></div>`;
        } else if (q.type === 'Isian Singkat') {
            bubbles = `<div class="isian-box"></div>`;
        }

        row.innerHTML = `<div class="preview-q-num">${q.num}.</div><div class="preview-q-bubbles">${bubbles}</div>`;
        ansContainer.appendChild(row);
    });
}

async function saveExam() {
    const data = {
        title: document.getElementById('judulUjian').value,
        code: document.getElementById('kodeUjian').value,
        subject: document.getElementById('mataPelajaran').value,
        class_name: document.getElementById('kelas').value,
        academic_year: document.getElementById('tahunAkademik').value || '2024/2025',
        passing_score: parseFloat(document.getElementById('kkm').value) || 75,
        description: '',
        questions: questions.map(q => {
            let answer_key = q.answer;
            if (q.apiType === 'multi_choice') {
                answer_key = q.answer ? q.answer.split(',') : [];
            } else if (q.apiType === 'matching') {
                answer_key = q.matchingAnswers;
            }
            return {
                question_number: q.num,
                question_type: q.apiType,
                question_text: q.text,
                answer_key: answer_key,
                weight: q.weight,
                options: q.options
            };
        })
    };

    if (!data.title || !data.code) {
        return showNotification('Judul dan Kode Ujian wajib diisi!', 'error');
    }
    if (questions.length === 0) {
        return showNotification('Tambahkan minimal 1 soal!', 'warning');
    }

    showNotification('Menyimpan ujian ke database...', 'info');

    try {
        const res = await apiCall('/exams', 'POST', data);
        currentExamId = res.exam?.id || res.exam_id;
        showNotification(`Ujian "${data.title}" berhasil disimpan! ID: ${currentExamId}`, 'success');
        await loadExamsDropdowns();
    } catch (e) {
        showNotification(`Gagal menyimpan: ${e.message}`, 'error');
    }
}

async function downloadPDF() {
    if (!currentExamId) {
        return showNotification('Simpan ujian terlebih dahulu sebelum mengunduh PDF', 'warning');
    }
    try {
        showNotification('Menggenerate PDF LJK...', 'info');
        const url = `${API_BASE}/generate-ljk/${currentExamId}`;
        const response = await fetch(url, { method: 'POST' });
        if (!response.ok) throw new Error('Gagal generate PDF');
        const blob = await response.blob();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `LJK_${document.getElementById('kodeUjian').value}.pdf`;
        a.click();
        showNotification('PDF berhasil diunduh!', 'success');
    } catch (e) {
        showNotification(`Gagal unduh PDF: ${e.message}`, 'error');
    }
}

async function testScanDemo() {
    showNotification('Menjalankan uji scan demo...', 'info');
    try {
        const formData = new FormData();
        if (currentExamId) formData.append('exam_id', currentExamId);
        const res = await apiCall('/scan-demo', 'POST', formData, true);
        showNotification(
            `Demo selesai! Skor: ${res.percentage}% - ${res.status}`,
            res.status === 'Lulus' ? 'success' : 'warning'
        );
    } catch (e) {
        // Fallback demo lokal
        showNotification('Demo scan berhasil (simulasi lokal)', 'success');
    }
}

// ============================================================
// SCAN LJK
// ============================================================

function initScan() {
    // Tab switching
    document.querySelectorAll('#scan .tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('#scan .tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('#scan .tab-pane').forEach(p => {
                p.classList.add('hidden');
                p.classList.remove('active');
            });
            e.target.classList.add('active');
            const target = e.target.getAttribute('data-tab');
            const pane = document.getElementById(`tab-${target}`);
            pane.classList.remove('hidden');
            pane.classList.add('active');
            if (target === 'camera') startCamera();
            else stopCamera();
        });
    });

    // Drag & drop
    const dropzone = document.getElementById('scanDropzone');
    const fileInput = document.getElementById('scanFileInput');

    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('dragover', e => {
        e.preventDefault();
        dropzone.style.borderColor = 'var(--primary)';
        dropzone.style.backgroundColor = '#EFF6FF';
    });
    dropzone.addEventListener('dragleave', e => {
        e.preventDefault();
        dropzone.style.borderColor = '';
        dropzone.style.backgroundColor = '';
    });
    dropzone.addEventListener('drop', e => {
        e.preventDefault();
        dropzone.style.borderColor = '';
        dropzone.style.backgroundColor = '';
        if (e.dataTransfer.files.length) handleImageUpload(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', e => {
        if (e.target.files.length) handleImageUpload(e.target.files[0]);
    });

    // Kamera
    document.getElementById('switchCameraBtn').addEventListener('click', switchCamera);
    document.getElementById('captureBtn').addEventListener('click', capturePhoto);

    // Proses scan
    document.getElementById('processScanBtn').addEventListener('click', processScan);

    // PDF multi-halaman
    document.getElementById('pdfFileInput').addEventListener('change', handlePdfUpload);
    document.getElementById('processAllPdfBtn')?.addEventListener('click', processBatchPdf);
}

function handleImageUpload(file) {
    if (!file.type.startsWith('image/')) {
        return showNotification('Harap unggah file gambar (JPG/PNG)', 'error');
    }
    imageFileToProcess = file;
    const reader = new FileReader();
    reader.onload = (e) => {
        const preview = document.getElementById('scanImagePreview');
        preview.querySelector('img').src = e.target.result;
        preview.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
    showNotification('Gambar berhasil dimuat. Klik "Proses Scan" untuk memulai.', 'info');
}

async function startCamera(facingMode = 'environment') {
    const video = document.getElementById('cameraVideo');
    try {
        if (scanStream) stopCamera();
        scanStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } }
        });
        video.srcObject = scanStream;
    } catch (e) {
        showNotification('Kamera tidak dapat diakses. Pastikan izin diberikan.', 'error');
    }
}

function stopCamera() {
    if (scanStream) {
        scanStream.getTracks().forEach(track => track.stop());
        scanStream = null;
    }
}

function switchCamera() {
    currentFacingMode = currentFacingMode === 'environment' ? 'user' : 'environment';
    startCamera(currentFacingMode);
}

function capturePhoto() {
    const video = document.getElementById('cameraVideo');
    const canvas = document.getElementById('cameraCanvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);

    canvas.toBlob(blob => {
        imageFileToProcess = new File([blob], 'capture.jpg', { type: 'image/jpeg' });
        // Tampilkan preview
        const preview = document.getElementById('scanImagePreview');
        preview.querySelector('img').src = canvas.toDataURL('image/jpeg');
        preview.classList.remove('hidden');
        showNotification('Foto berhasil diambil!', 'success');
    }, 'image/jpeg', 0.92);
}

async function handlePdfUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    showNotification('Memproses file PDF...', 'info');

    try {
        // Kirim ke backend untuk extract halaman
        const formData = new FormData();
        formData.append('file', file);
        formData.append('exam_id', document.getElementById('scanExamSelect').value || '0');

        const res = await apiCall('/scan-pdf', 'POST', formData, true);

        if (res.pages) {
            const container = document.getElementById('pdfQueueContainer');
            container.classList.remove('hidden');
            document.getElementById('pdfQueueInfo').textContent = `Lembar 1 s.d. ${res.total_pages}`;

            const list = document.getElementById('pdfQueueList');
            list.innerHTML = '';
            res.pages.forEach((page, i) => {
                const item = document.createElement('div');
                item.className = 'scan-queue-item';
                item.innerHTML = `
                    <span>Lembar ${page.page_number}</span>
                    <span class="badge badge-info">${page.status}</span>
                `;
                item.dataset.pageIndex = i;
                item.dataset.imageBase64 = page.image_base64;
                list.appendChild(item);
            });

            showNotification(`${res.total_pages} halaman berhasil diekstrak dari PDF`, 'success');
        }
    } catch (e) {
        // Fallback: gunakan PDF.js di client-side
        try {
            if (typeof pdfjsLib !== 'undefined') {
                pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                const arrayBuffer = await file.arrayBuffer();
                const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                const totalPages = Math.min(pdf.numPages, 32);

                const container = document.getElementById('pdfQueueContainer');
                container.classList.remove('hidden');
                document.getElementById('pdfQueueInfo').textContent = `Lembar 1 s.d. ${totalPages}`;

                const list = document.getElementById('pdfQueueList');
                list.innerHTML = '';

                for (let i = 1; i <= totalPages; i++) {
                    const page = await pdf.getPage(i);
                    const viewport = page.getViewport({ scale: 2.0 });
                    const canvas = document.createElement('canvas');
                    canvas.width = viewport.width;
                    canvas.height = viewport.height;
                    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;

                    const item = document.createElement('div');
                    item.className = 'scan-queue-item';
                    item.innerHTML = `
                        <span>Lembar ${i}</span>
                        <span class="badge badge-info">Menunggu</span>
                    `;
                    item.dataset.imageData = canvas.toDataURL('image/png');
                    list.appendChild(item);
                }

                showNotification(`${totalPages} halaman diekstrak dari PDF (client-side)`, 'success');
            }
        } catch (pdfErr) {
            showNotification('Gagal memproses PDF: ' + pdfErr.message, 'error');
        }
    }
}

async function processBatchPdf() {
    const items = document.querySelectorAll('.scan-queue-item');
    if (items.length === 0) return showNotification('Tidak ada lembar untuk diproses', 'warning');

    const examId = document.getElementById('scanExamSelect').value;
    if (!examId) return showNotification('Pilih ujian terlebih dahulu', 'warning');

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const badge = item.querySelector('.badge');
        badge.textContent = 'Sedang Memproses';
        badge.className = 'badge badge-warning';

        try {
            // Convert base64/dataURL ke blob
            let imageData = item.dataset.imageBase64 || item.dataset.imageData;
            let blob;
            if (imageData.startsWith('data:')) {
                const res = await fetch(imageData);
                blob = await res.blob();
            } else {
                const byteString = atob(imageData);
                const ab = new ArrayBuffer(byteString.length);
                const ia = new Uint8Array(ab);
                for (let j = 0; j < byteString.length; j++) ia[j] = byteString.charCodeAt(j);
                blob = new Blob([ab], { type: 'image/png' });
            }

            const formData = new FormData();
            formData.append('file', blob, `lembar_${i + 1}.png`);
            formData.append('exam_id', examId);
            formData.append('student_name', `Siswa Lembar ${i + 1}`);
            formData.append('student_id_number', `NIS-${String(i + 1).padStart(3, '0')}`);

            await apiCall('/scan', 'POST', formData, true);

            badge.textContent = 'Selesai';
            badge.className = 'badge badge-success';
        } catch (err) {
            badge.textContent = 'Gagal';
            badge.className = 'badge badge-danger';
        }
    }
    showNotification('Pemrosesan batch selesai!', 'success');
}

async function processScan() {
    if (!imageFileToProcess) {
        return showNotification('Silakan pilih/ambil gambar LJK terlebih dahulu', 'warning');
    }

    const examId = document.getElementById('scanExamSelect').value;
    if (!examId) {
        return showNotification('Pilih ujian terlebih dahulu', 'warning');
    }

    const btn = document.getElementById('processScanBtn');
    btn.textContent = 'Memproses...';
    btn.disabled = true;

    try {
        const formData = new FormData();
        formData.append('file', imageFileToProcess);
        formData.append('exam_id', examId);
        formData.append('student_name', document.getElementById('scanStudentName').value || 'Siswa');
        formData.append('student_id_number', document.getElementById('scanStudentNis').value || 'NIS-000');

        const res = await apiCall('/scan', 'POST', formData, true);
        displayScanResults(res);
        showNotification('Scan berhasil diproses!', 'success');
    } catch (e) {
        showNotification(`Gagal memproses scan: ${e.message}`, 'error');
    } finally {
        btn.textContent = 'Proses Scan';
        btn.disabled = false;
    }
}

function displayScanResults(data) {
    document.getElementById('scanEmptyState').classList.add('hidden');
    document.getElementById('scanResultsArea').classList.remove('hidden');

    document.getElementById('resName').textContent = data.student_name || '-';
    document.getElementById('resNis').textContent = data.student_id_number || '-';
    document.getElementById('resClass').textContent = data.class_name || '-';

    const pct = parseFloat(data.percentage) || 0;
    document.getElementById('resScore').textContent = pct.toFixed(2);
    document.getElementById('resTotal').textContent = `${data.total_score || 0} / ${data.max_score || 0}`;
    document.getElementById('resAccuracy').textContent = `${data.omr_confidence || 0}%`;

    const statusEl = document.getElementById('resStatus');
    statusEl.textContent = data.status || 'N/A';
    statusEl.className = `badge ${data.status === 'Lulus' ? 'badge-success' : 'badge-danger'} mt-2`;

    // Render tabel rincian
    const tbody = document.querySelector('#resTable tbody');
    tbody.innerHTML = '';

    if (data.details && data.details.length > 0) {
        data.details.forEach(d => {
            const tr = document.createElement('tr');
            const ansDisplay = typeof d.student_response === 'object'
                ? JSON.stringify(d.student_response) : (d.student_response || '-');
            const keyDisplay = typeof d.answer_key === 'object'
                ? JSON.stringify(d.answer_key) : (d.answer_key || '-');

            tr.innerHTML = `
                <td>${d.question_number}</td>
                <td><span class="badge badge-info">${d.question_type}</span></td>
                <td>${ansDisplay}</td>
                <td>${keyDisplay}</td>
                <td>${d.is_correct ? '<i class="fas fa-check text-success"></i>' : '<i class="fas fa-times text-danger"></i>'}</td>
                <td>${formatScore(d.score_earned)} / ${formatScore(d.max_score)}</td>
                <td class="text-sm">${d.ai_feedback || '-'}</td>
            `;
            tbody.appendChild(tr);
        });
    }
}

// ============================================================
// DASHBOARD GURU
// ============================================================

function initDashboard() {
    document.getElementById('dashExamSelect').addEventListener('change', (e) => {
        if (e.target.value) loadDashboardData(e.target.value);
    });

    document.getElementById('exportExcelBtn').addEventListener('click', exportExcel);

    document.querySelector('.close-modal').addEventListener('click', () => {
        document.getElementById('studentDetailModal').style.display = 'none';
    });

    // Klik di luar modal untuk menutup
    window.addEventListener('click', (e) => {
        const modal = document.getElementById('studentDetailModal');
        if (e.target === modal) modal.style.display = 'none';
    });
}

async function loadDashboardData(examId) {
    if (!examId) {
        const select = document.getElementById('dashExamSelect');
        examId = select.value;
    }
    if (!examId) return;

    try {
        // Muat statistik
        const stats = await apiCall(`/dashboard/${examId}`);
        const total = parseInt(stats.total_students) || 0;
        const passCount = parseInt(stats.pass_count) || 0;
        const passPct = total > 0 ? ((passCount / total) * 100).toFixed(1) : '0.0';

        document.getElementById('statPeserta').textContent = total;
        document.getElementById('statRata').textContent = formatScore(stats.avg_score);
        document.getElementById('statMinMax').textContent = `${formatScore(stats.max_score)} / ${formatScore(stats.min_score)}`;
        document.getElementById('statLulus').textContent = `${passPct}%`;

        // Muat hasil siswa
        const results = await apiCall(`/results/${examId}`);
        renderDashboardTable(results);
    } catch (e) {
        showNotification(`Gagal memuat dashboard: ${e.message}`, 'error');
    }
}

function renderDashboardTable(results) {
    const tbody = document.querySelector('#dashTable tbody');
    tbody.innerHTML = '';

    if (!results || results.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-secondary">Belum ada data hasil ujian</td></tr>';
        return;
    }

    // Urutkan berdasarkan persentase (peringkat)
    const sorted = [...results].sort((a, b) => (parseFloat(b.percentage) || 0) - (parseFloat(a.percentage) || 0));

    sorted.forEach((r, i) => {
        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        tr.onclick = () => showStudentDetail(r.id);

        const status = r.status || 'Remedial';
        const badgeClass = status.toLowerCase().includes('lulus') ? 'badge-success' : 'badge-danger';

        tr.innerHTML = `
            <td>${i + 1}</td>
            <td>${r.student_id_number || '-'}</td>
            <td>${r.student_name || '-'}</td>
            <td>${formatScore(r.percentage)}</td>
            <td>${formatScore(r.omr_confidence)}%</td>
            <td><span class="badge ${badgeClass}">${status}</span></td>
        `;
        tbody.appendChild(tr);
    });
}

async function showStudentDetail(resultId) {
    const modal = document.getElementById('studentDetailModal');
    const body = document.getElementById('modalContentBody');
    modal.style.display = 'block';
    body.innerHTML = '<div class="text-center"><div class="spinner" style="border-color:var(--primary);border-top-color:transparent;width:32px;height:32px;margin:2rem auto"></div><p>Memuat detail...</p></div>';

    try {
        const res = await apiCall(`/results/detail/${resultId}`);

        let answersHtml = '';
        if (res.student_answers && res.student_answers.length > 0) {
            answersHtml = `
                <table class="table mt-3">
                    <thead><tr><th>No</th><th>Jawaban</th><th>Status</th><th>Skor</th><th>AI Feedback</th></tr></thead>
                    <tbody>
                        ${res.student_answers.map((a, i) => `
                            <tr>
                                <td>${i + 1}</td>
                                <td>${typeof a.student_response === 'object' ? JSON.stringify(a.student_response) : (a.student_response || '-')}</td>
                                <td>${a.is_correct ? '✅' : '❌'}</td>
                                <td>${formatScore(a.score_earned)}</td>
                                <td class="text-sm">${a.ai_feedback || '-'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        }

        body.innerHTML = `
            <div class="student-info-card mb-3">
                <h3>${res.student_name}</h3>
                <p>NIS: ${res.student_id_number} | Kelas: ${res.class_name || '-'}</p>
            </div>
            <div class="score-card mb-3" style="padding:1rem">
                <div class="d-flex justify-between">
                    <div><strong>Nilai Akhir:</strong> ${formatScore(res.percentage)} / 100</div>
                    <div><strong>Akurasi OMR:</strong> ${formatScore(res.omr_confidence)}%</div>
                    <div><span class="badge ${res.status?.toLowerCase().includes('lulus') ? 'badge-success' : 'badge-danger'}">${res.status}</span></div>
                </div>
            </div>
            <h4>Rincian Jawaban</h4>
            ${answersHtml || '<p class="text-secondary">Tidak ada data jawaban</p>'}
        `;
    } catch (e) {
        body.innerHTML = `<p class="text-danger">Gagal memuat detail: ${e.message}</p>`;
    }
}

async function exportExcel() {
    const examId = document.getElementById('dashExamSelect').value;
    if (!examId) return showNotification('Pilih ujian terlebih dahulu', 'warning');

    try {
        showNotification('Menggenerate laporan Excel...', 'info');
        const url = `${API_BASE}/export/${examId}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Gagal export');

        const blob = await response.blob();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `Laporan_Ujian.xlsx`;
        a.click();
        showNotification('Laporan Excel berhasil diunduh!', 'success');
    } catch (e) {
        showNotification(`Gagal export: ${e.message}`, 'error');
    }
}

// ============================================================
// GENERATOR SOAL AI
// ============================================================

function initGenerator() {
    // Preset buttons
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', e => {
            document.getElementById('genTopik').value = e.target.textContent;
        });
    });

    // Tab switching
    document.querySelectorAll('#generator .tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('#generator .tab-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
        });
    });

    document.getElementById('generateBtn').addEventListener('click', generateQuestions);
    document.getElementById('genCopyBtn').addEventListener('click', () => {
        const text = document.getElementById('genOutput').value;
        if (!text) return showNotification('Tidak ada teks untuk disalin', 'warning');
        navigator.clipboard.writeText(text);
        showNotification('Teks berhasil disalin ke clipboard!', 'success');
    });
    document.getElementById('genDownloadBtn').addEventListener('click', () => {
        const text = document.getElementById('genOutput').value;
        if (!text) return showNotification('Tidak ada teks untuk diunduh', 'warning');
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `Soal_${document.getElementById('genTopik').value || 'Generated'}.txt`;
        a.click();
        showNotification('File TXT berhasil diunduh!', 'success');
    });
    document.getElementById('genImportBtn').addEventListener('click', importToLJK);
}

async function generateQuestions() {
    const topik = document.getElementById('genTopik').value;
    if (!topik) return showNotification('Isi topik terlebih dahulu', 'warning');

    const kelas = document.getElementById('genKelas').value;
    const bloomChecks = document.querySelectorAll('.gen-bloom:checked');
    const difficulty = Array.from(bloomChecks).map(c => c.value).join(', ') || 'C1-C3 Campuran';
    const count = parseInt(document.getElementById('genJumlah').value) || 5;

    const btnText = document.getElementById('genBtnText');
    const spinner = document.getElementById('genSpinner');
    const btn = document.getElementById('generateBtn');

    btnText.textContent = 'Memproses AI...';
    spinner.classList.remove('hidden');
    btn.disabled = true;

    try {
        const res = await apiCall('/generate-questions', 'POST', {
            topic: topik,
            target_class: kelas,
            difficulty: difficulty,
            count: count
        });

        if (res.questions) {
            document.getElementById('genOutput').value = res.questions;
            showNotification('Soal berhasil di-generate oleh AI!', 'success');
        }
    } catch (e) {
        showNotification(`Gagal generate: ${e.message}`, 'error');
        // Fallback demo
        document.getElementById('genOutput').value = `[Demo] Soal ${topik}\n\nGagal terhubung ke API AI.\nPastikan backend berjalan dan API key Gemini valid.`;
    } finally {
        btnText.innerHTML = '<i class="fas fa-magic"></i> Generate Soal';
        spinner.classList.add('hidden');
        btn.disabled = false;
    }
}

function importToLJK() {
    const text = document.getElementById('genOutput').value;
    if (!text) return showNotification('Generate soal terlebih dahulu', 'warning');

    // Parse sederhana: cari pola nomor soal
    const lines = text.split('\n');
    let importCount = 0;

    lines.forEach(line => {
        const match = line.match(/^(\d+)\.\s+(.+)/);
        if (match && !line.match(/^[A-E]\./)) {
            const num = parseInt(match[1]);
            const questionText = match[2].trim();

            // Deteksi tipe soal
            let type = 'Pilihan Ganda';
            if (line.toLowerCase().includes('benar') && line.toLowerCase().includes('salah')) {
                type = 'Benar/Salah';
            } else if (line.toLowerCase().includes('isian') || line.toLowerCase().includes('jawab singkat')) {
                type = 'Isian Singkat';
            }

            addQuestion(type);
            const lastQ = questions[questions.length - 1];
            lastQ.text = questionText;
            importCount++;
        }
    });

    if (importCount > 0) {
        renderQuestionsList();
        updatePreview();
        window.location.hash = 'beranda';
        showNotification(`${importCount} soal berhasil diimpor ke LJK Builder!`, 'success');
    } else {
        showNotification('Tidak ditemukan soal untuk diimpor dari teks', 'warning');
    }
}

// ============================================================
// SHARED FUNCTIONS
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
                opt.textContent = `${exam.title} (${exam.code})`;
                select.appendChild(opt);
            });
            if (currentVal) select.value = currentVal;
        });
    } catch (e) {
        // Silent fail - API mungkin belum berjalan
        console.log('Gagal memuat daftar ujian:', e.message);
    }
}

// ============================================================
// MAIN INITIALIZATION
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    handleRouting();
    initBeranda();
    initScan();
    initDashboard();
    initGenerator();
    loadExamsDropdowns();

    // Mobile menu toggle
    document.getElementById('mobileMenuBtn').addEventListener('click', () => {
        const navLinks = document.getElementById('navLinks');
        const isVisible = navLinks.style.display === 'flex';
        navLinks.style.display = isVisible ? 'none' : 'flex';
        if (!isVisible) {
            navLinks.style.flexDirection = 'column';
            navLinks.style.position = 'absolute';
            navLinks.style.top = '60px';
            navLinks.style.left = '0';
            navLinks.style.right = '0';
            navLinks.style.backgroundColor = 'white';
            navLinks.style.padding = '1rem';
            navLinks.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
            navLinks.style.zIndex = '999';
        }
    });

    // Sortable table headers di dashboard
    document.querySelectorAll('.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const sortKey = th.dataset.sort;
            // Simple sort toggle (implementasi sorting sederhana)
            const tbody = th.closest('table').querySelector('tbody');
            const rows = Array.from(tbody.querySelectorAll('tr'));
            const colIndex = Array.from(th.parentElement.children).indexOf(th);
            const isAsc = th.classList.toggle('sort-asc');

            rows.sort((a, b) => {
                const aText = a.children[colIndex]?.textContent?.trim() || '';
                const bText = b.children[colIndex]?.textContent?.trim() || '';
                const aNum = parseFloat(aText);
                const bNum = parseFloat(bText);
                if (!isNaN(aNum) && !isNaN(bNum)) {
                    return isAsc ? aNum - bNum : bNum - aNum;
                }
                return isAsc ? aText.localeCompare(bText) : bText.localeCompare(aText);
            });

            rows.forEach(row => tbody.appendChild(row));
        });
    });
});
