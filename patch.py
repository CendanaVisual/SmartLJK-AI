import re

with open('public/js/app.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace updatePreview function
start_marker = "function updatePreview() {"
end_marker = "ansContainer.appendChild(row);\n    });\n}"

start_idx = content.find(start_marker)
end_idx = content.find(end_marker) + len(end_marker)

if start_idx != -1 and end_idx != -1:
    new_updatePreview = """function updatePreview() {
    document.getElementById('prevInstansi').innerText = document.getElementById('examInstansi')?.value || 'DINAS PENDIDIKAN';
    document.getElementById('prevTitle').innerText = document.getElementById('examTitle')?.value || 'Ujian...';
    document.getElementById('prevCode').innerText = document.getElementById('examCode')?.value || 'KODE-01';
    document.getElementById('prevSubject').innerText = document.getElementById('examSubject')?.value || 'Mata Pelajaran';
    document.getElementById('prevClass').innerText = document.getElementById('examClass')?.value || 'Kelas';
    document.getElementById('prevKKM').innerText = document.getElementById('examKKM')?.value || '75';

    const qrBox = document.getElementById('qrcode');
    if(qrBox) {
        qrBox.innerHTML = '';
        try {
            new QRCode(qrBox, { text: document.getElementById('examCode')?.value || 'test', width: 35, height: 35, colorDark: '#000', colorLight: '#fff' });
        } catch(e){}
    }

    const ng1 = document.getElementById('nameGrid1');
    const ng2 = document.getElementById('nameGrid2');
    if(ng1 && ng2) {
        ng1.innerHTML = ''; ng2.innerHTML = '';
        for(let i=0; i<20; i++) ng1.innerHTML += '<div class="char-box"></div>';
        for(let i=0; i<20; i++) ng2.innerHTML += '<div class="char-box"></div>';
    }

    const qContainer = document.getElementById('previewQuestions');
    if(!qContainer) return;
    qContainer.innerHTML = '';

    questions.forEach((q, i) => {
        const type = q.type;
        let row = document.createElement('div');
        row.className = 'ljk-q-row';
        let contentHtml = '<div class="ljk-q-num">' + (i+1) + '.</div><div class="ljk-bubbles">';

        if (type === 'Pilihan Ganda') {
            ['A','B','C','D'].forEach(o => contentHtml += '<div class="ljk-bubble">'+o+'</div>');
        } else if (type === 'Pilihan Ganda Kompleks') {
            ['A','B','C','D'].forEach(o => contentHtml += '<div class="ljk-square">'+o+'</div>');
        } else if (type === 'Benar/Salah') {
            ['B','S'].forEach(o => contentHtml += '<div class="ljk-bubble">'+o+'</div>');
        } else if (type === 'Isian Singkat') {
            contentHtml += '<div class="ljk-isian"></div>';
        } else if (type === 'Menjodohkan') {
            contentHtml += '<div style="font-size: 8px;">[Grid Menjodohkan]</div>';
        }
        contentHtml += '</div>';
        row.innerHTML = contentHtml;
        qContainer.appendChild(row);
    });
}"""
    content = content[:start_idx] + new_updatePreview + content[end_idx:]

start_gen = "function initGenerator() {"
end_gen = "showNotification('Tidak ditemukan soal untuk diimpor dari teks', 'warning');\n    }\n}"
start_idx_gen = content.find(start_gen)
end_idx_gen = content.find(end_gen) + len(end_gen)

if start_idx_gen != -1 and end_idx_gen != -1:
    new_generator = """function initGenerator() {
    const btnGen = document.getElementById('btnGenerateFull');
    if (btnGen) {
        btnGen.addEventListener('click', async () => {
            const out = document.getElementById('genOutputFull');
            out.value = 'Menganalisis permintaan dan menghubungi AI Gemini...\\nMohon tunggu sekitar 10-20 detik...';
            btnGen.disabled = true;
            btnGen.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Memproses...';
            
            const payload = {
                topic: document.getElementById('genMapel')?.value || 'Umum',
                target_class: (document.getElementById('genJenjang')?.value || '') + ' Kelas ' + (document.getElementById('genKelasInput')?.value || '') + ' - ' + (document.getElementById('genFase')?.value || ''),
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
                    out.value = 'Error: ' + res.error;
                    showNotification('Gagal generate soal', 'error');
                } else {
                    out.value = res.generated_questions || res;
                    showNotification('Generate berhasil!', 'success');
                }
            } catch(e) {
                out.value = 'Error koneksi ke API: ' + e.message;
                showNotification('Terjadi kesalahan jaringan', 'error');
            }
            btnGen.disabled = false;
            btnGen.innerHTML = '<i class="fas fa-magic"></i> Generate Asesmen Lengkap AI';
        });
    }

    document.getElementById('btnSalin')?.addEventListener('click', () => {
        const txt = document.getElementById('genOutputFull').value;
        if(!txt) return;
        navigator.clipboard.writeText(txt).then(() => showNotification('Disalin ke clipboard!', 'success'));
    });

    document.getElementById('btnUnduhDocx')?.addEventListener('click', async () => {
        const text = document.getElementById('genOutputFull').value;
        if(!text || text.includes('menunggu')) return showNotification('Tidak ada hasil untuk diunduh', 'error');
        
        showNotification('Membuat file Word...', 'info');
        try {
            const res = await fetch(API_BASE + '/download-docx', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ 
                    content: text, 
                    title: 'Asesmen_' + (document.getElementById('genMapel')?.value || 'AI').replace(/\\s+/g,'_')
                })
            });
            
            if (!res.ok) throw new Error('Gagal download');
            
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'Asesmen_' + (document.getElementById('genMapel')?.value || 'AI').replace(/\\s+/g,'_') + '.docx';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            showNotification('Unduhan DOCX berhasil', 'success');
        } catch (e) {
            showNotification('Gagal mengunduh file DOCX: ' + e.message, 'error');
        }
    });
}"""
    content = content[:start_idx_gen] + new_generator + content[end_idx_gen:]


# Now update the Event Listeners for updatePreview()
# Originally: ['judulUjian', 'mataPelajaran', 'kelas', 'kodeUjian'].forEach(...)
start_ev = "['judulUjian', 'mataPelajaran', 'kelas', 'kodeUjian'].forEach("
end_ev = "});"
start_idx_ev = content.find(start_ev)
end_idx_ev = content.find(end_ev, start_idx_ev) + len(end_ev)
if start_idx_ev != -1 and end_idx_ev != -1:
    new_ev = "['examInstansi', 'examTitle', 'examCode', 'examSubject', 'examClass', 'examKKM'].forEach(id => { const el = document.getElementById(id); if(el) el.addEventListener('input', updatePreview); });"
    content = content[:start_idx_ev] + new_ev + content[end_idx_ev:]


with open('public/js/app.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("Patcher finished")
