// ============================================================
// APLIKASI INPUT LAPORAN KEGIATAN PENYULUHAN PERTANIAN
// VERSI FINAL - DENGAN TTD DIGITAL TOUCHSCREEN
// ============================================================

// Storage keys
const STORAGE_KEY = 'laporan_penyuluhan_kegiatan_v9';
const HEADER_KEY = 'laporan_penyuluhan_header_v9';
const TTD_KEY = 'laporan_penyuluhan_ttd_v9';

// Global state
let headerData = {
    namaPenyuluh: '',
    nipPenyuluh: '',
    provinsi: '',
    kabupatenKota: '',
    wilayahKerja: '',
    wilayahBinaan: ''
};

let ttdData = {
    nama: '',
    nip: '',
    tandaTangan: null  // Base64 string dari signature
};

let kegiatanData = [];
let editingId = null;
let currentPhotos = [];
let searchQuery = '';
let filterJenisKegiatan = '';
let filterBulan = '';
let selectedIds = new Set();
let signaturePad = null;
let isDrawing = false;

// Daftar pilihan
const daftarJenisKegiatan = [
    'Pendampingan Peningkatan Produksi Hortikultura (Cabai, Bawang Merah/Putih)',
    'Pendampingan Hilirisasi Perkebunan (Kelapa, Kopi)',
    'Pendampingan Penyediaan Benih Dan Bibit Serta Peningkatan Produksi Ternak (Sapi/Kerbau, Kambing/Domba, Unggas)',
    'Pendampingan Pemanfaatan Alat dan Mesin Pertanian',
    'Pendampingan RDKK Pupuk Subsidi',
    'Pendampingan Pemanfaatan Irigasi Perpompaan Dan Perpipaan',
    'Penderasan Materi dan Informasi Pembangunan Pertanian serta Kelompencapir Digital',
    'Pendampingan Kinerja Brigade Pangan (BP)',
    'Persentase Pengawalan dan Pendampingan CPCL Bantuan Pemerintah',
    'Persentase Pelaksanaan Verifikasi dan Validasi Distribusi Pupuk Subsidi',
    'Pelaksanaan Tugas Fungsi Penyuluhan Pertanian'
];

const daftarMetode = [
    'Pertemuan',
    'Kunjungan',
    'Rapat koordinasi offline',
    'Rapat koordinasi online/ zoom meeting',
    'Pemanfaatan media digital/sosial media'
];

// ============================================================
// FUNGSI KOMPRESI FOTO
// ============================================================
function compressImage(base64String, maxWidth = 800, maxHeight = 800, quality = 0.7) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            let width = img.width;
            let height = img.height;
            
            if (width > height) {
                if (width > maxWidth) {
                    height = (height * maxWidth) / width;
                    width = maxWidth;
                }
            } else {
                if (height > maxHeight) {
                    width = (width * maxHeight) / height;
                    height = maxHeight;
                }
            }
            
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            
            const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
            resolve(compressedBase64);
        };
        img.onerror = reject;
        img.src = base64String;
    });
}

async function compressPhotos(photos) {
    const compressed = [];
    for (const photo of photos) {
        try {
            const estimatedSize = photo.length * 0.75;
            if (estimatedSize > 500 * 1024) {
                const compressedPhoto = await compressImage(photo, 800, 800, 0.6);
                compressed.push(compressedPhoto);
            } else {
                compressed.push(photo);
            }
        } catch (e) {
            console.error('Gagal kompres foto:', e);
            compressed.push(photo);
        }
    }
    return compressed;
}

// ============================================================
// FUNGSI UTILITY
// ============================================================
function formatTanggal(dateString) {
    if (!dateString) return '-';
    const tanggal = new Date(dateString);
    const bulan = ['JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI', 
               'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'];
    return `${tanggal.getDate()} ${bulan[tanggal.getMonth()]} ${tanggal.getFullYear()}`;
}

// Tambahkan fungsi ini setelah formatTanggalUntukLaporan
function formatTanggalUntukLaporanTanpaHari(dateString) {
    if (!dateString) return '-';
    const tanggal = new Date(dateString);
    const bulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 
                   'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    return `${tanggal.getDate()} ${bulan[tanggal.getMonth()]} ${tanggal.getFullYear()}`;
}

function loadData() {
    const savedHeader = localStorage.getItem(HEADER_KEY);
    const savedKegiatan = localStorage.getItem(STORAGE_KEY);
    const savedTtd = localStorage.getItem(TTD_KEY);
    
    if (savedHeader) headerData = JSON.parse(savedHeader);
    if (savedKegiatan) kegiatanData = JSON.parse(savedKegiatan);
    if (savedTtd) ttdData = JSON.parse(savedTtd);
}

function saveHeader() { localStorage.setItem(HEADER_KEY, JSON.stringify(headerData)); }
function saveKegiatan() { 
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(kegiatanData));
    } catch (e) {
        if (e.name === 'QuotaExceededError') {
            showToast('Peringatan: Data terlalu besar! Hapus beberapa foto atau gunakan foto yang lebih kecil.');
        } else {
            showToast('Gagal menyimpan data!');
        }
    }
}
function saveTtd() { localStorage.setItem(TTD_KEY, JSON.stringify(ttdData)); }

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function showToast(message, isError = false) {
    const existingToast = document.querySelector('.toast');
    if (existingToast) existingToast.remove();
    
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.style.background = isError ? '#e53935' : '#333';
    toast.innerHTML = `<span>${message}</span>`;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        if (toast.parentNode) toast.remove();
    }, 3000);
}

// Filter kegiatan
function getFilteredKegiatan() {
    let filtered = [...kegiatanData];
    
    if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filtered = filtered.filter(k => 
            (k.jenisKegiatan && k.jenisKegiatan.toLowerCase().includes(query)) ||
            (k.materi && k.materi.toLowerCase().includes(query)) ||
            (k.sasaranJumlah && k.sasaranJumlah.toLowerCase().includes(query)) ||
            (k.masalah && k.masalah.toLowerCase().includes(query))
        );
    }
    
    if (filterJenisKegiatan) {
        filtered = filtered.filter(k => k.jenisKegiatan === filterJenisKegiatan);
    }
    
    if (filterBulan) {
        filtered = filtered.filter(k => {
            if (!k.tanggal) return false;
            const bulan = new Date(k.tanggal).getMonth() + 1;
            return bulan.toString() === filterBulan;
        });
    }
    
    return filtered;
}

function getNamaBulan(bulanAngka) {
    if (!bulanAngka) return '';
    const bulan = ['JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI', 
               'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'];
    return bulan[parseInt(bulanAngka) - 1] || '';
}

// ============================================================
// GENERATE TABEL UNTUK PRINT/PDF DENGAN TTD
// ============================================================
function generateTableHTML() {
    const filtered = getFilteredKegiatan();
    const tahunSekarang = new Date().getFullYear();
    const tanggalCetak = formatTanggalUntukLaporanTanpaHari(new Date());
    const kota = headerData.kabupatenKota || '__________';
    const namaPenyuluh = ttdData.nama || headerData.namaPenyuluh || '_____________________';
    const nipPenyuluh = ttdData.nip || headerData.nipPenyuluh || '________________';
    const ttdImage = ttdData.tandaTangan || '';
    
    let html = `<!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Laporan Kegiatan Penyuluhan Pertanian</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
                font-family: 'Times New Roman', Times, serif, Arial;
                margin: 0;
                padding: 10px;
                background: white;
            }
            .report-container {
                max-width: 100%;
                overflow-x: visible;
            }
            h1 {
                text-align: center;
                font-size: 14pt;
                margin-bottom: 5px;
                font-weight: bold;
            }
            .subtitle {
                text-align: center;
                font-size: 10pt;
                margin-bottom: 10px;
            }
            .header-info {
                margin-bottom: 10px;
                font-size: 8pt;
                border: 1px solid #000;
                padding: 6px;
            }
            .header-info table {
                width: 100%;
                border-collapse: collapse;
            }
            .header-info td {
                padding: 2px 4px;
                vertical-align: top;
            }
            .header-info td.label {
                width: 120px;
                font-weight: bold;
            }
            table.data {
                width: 100%;
                border-collapse: collapse;
                font-size: 7pt;
                margin-top: 8px;
                table-layout: fixed;
            }
            table.data th, table.data td {
                border: 1px solid #000;
                padding: 4px 3px;
                vertical-align: top;
                text-align: left;
                word-wrap: break-word;
                word-break: break-word;
            }
            table.data th {
                background: #f0f0f0;
                font-weight: bold;
                text-align: center;
            }
            table.data th:nth-child(1) { width: 3%; }
            table.data th:nth-child(2) { width: 7%; }
            table.data th:nth-child(3) { width: 14%; }
            table.data th:nth-child(4) { width: 10%; }
            table.data th:nth-child(5) { width: 8%; }
            table.data th:nth-child(6) { width: 8%; }
            table.data th:nth-child(7) { width: 10%; }
            table.data th:nth-child(8) { width: 10%; }
            table.data th:nth-child(9) { width: 10%; }
            table.data th:nth-child(10) { width: 10%; }
            
            .documentation img {
                max-width: 40px;
                max-height: 30px;
                object-fit: cover;
            }
            .footer-report {
                margin-top: 40px;
                display: flex;
                justify-content: flex-end;
            }
            .footer-right {
                text-align: center;
                width: 280px;
            }
            .footer-right .kota-tanggal {
                font-size: 9pt;
                margin-bottom: 25px;
                text-align: center;
            }
            .footer-right .jabatan {
                font-size: 10pt;
                margin-bottom: 15px;
                text-align: center;
            }
            .footer-right .ttd-image {
                margin-bottom: 10px;
                text-align: center;
            }
            .footer-right .ttd-image img {
                max-width: 180px;
                max-height: 60px;
                object-fit: contain;
            }
            .footer-right .nama {
                font-size: 10pt;
                font-weight: bold;
                margin-top: 5px;
                text-align: center;
            }
            .footer-right .nip {
                font-size: 9pt;
                margin-top: 3px;
                text-align: center;
            }
            .print-date {
                margin-top: 20px;
                font-size: 7pt;
                text-align: right;
                border-top: 1px solid #ccc;
                padding-top: 5px;
            }
            @media print {
                body { margin: 0; padding: 0; }
                .no-print { display: none; }
                table.data th {
                    background: #f0f0f0 !important;
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }
                .report-container { width: 100%; overflow: visible; }
            }
            @page {
                size: A4 landscape;
                margin: 0.5cm;
            }
        </style>
    </head>
    <body>
        <div class="report-container">
            <h1>LAPORAN KEGIATAN PENYULUHAN PERTANIAN</h1>
            <div class="subtitle">BULAN ${getNamaBulan(filterBulan) || 'SEMUA BULAN'} TAHUN ${tahunSekarang}</div>
            
            <div class="header-info">
                <table>
                    <tr><td class="label">Nama Penyuluh</td><td>: ${escapeHtml(headerData.namaPenyuluh || '-')}</td>
                        <td class="label">Provinsi</td><td>: ${escapeHtml(headerData.provinsi || '-')}</td>
                    </tr>
                    <tr><td class="label">NIP</td><td>: ${escapeHtml(headerData.nipPenyuluh || '-')}</td>
                        <td class="label">Kabupaten/Kota</td><td>: ${escapeHtml(headerData.kabupatenKota || '-')}</td>
                    </tr>
                    <tr><td class="label">Wilayah Kerja</td><td>: ${escapeHtml(headerData.wilayahKerja || '-')}</td>
                        <td class="label">Wilayah Binaan</td><td>: ${escapeHtml(headerData.wilayahBinaan || '-')}</td>
                    </tr>
                </table>
            </div>`;
    
    if (filtered.length === 0) {
        html += `<p style="text-align:center; padding:40px;">Tidak ada data kegiatan untuk periode ini.</p>`;
    } else {
        html += `<table class="data">
            <thead>
                <tr>
                    <th>NO</th><th>TANGGAL</th><th>JENIS KEGIATAN</th><th>MATERI</th>
                    <th>METODE</th><th>SASARAN</th><th>TUJUAN</th>
                    <th>HASIL</th><th>MASALAH</th><th>EVIDEN</th>
                </tr>
            </thead>
            <tbody>`;
        
        filtered.forEach((item, idx) => {
            const fotoList = (item.foto || []).slice(0, 2);
            let fotoHtml = fotoList.length > 0 ? fotoList.map(foto => `<img src="${foto}" alt="foto">`).join('') : '-';
            
            html += `<tr>
                <td style="text-align:center">${idx + 1}</td>
                <td>${formatTanggal(item.tanggal)}</td>
                <td>${escapeHtml(item.jenisKegiatan || '-')}</td>
                <td>${escapeHtml(item.materi || '-')}</td>
                <td>${escapeHtml(item.metode || '-')}</td>
                <td>${escapeHtml(item.sasaranJumlah || '-')}</td>
                <td>${escapeHtml(item.tujuan || '-')}</td>
                <td>${escapeHtml(item.hasil || '-')}</td>
                <td>${escapeHtml(item.masalah || '-')}</td>
                <td class="documentation">${fotoHtml}</td>
            </tr>`;
        });
        
        html += `</tbody>
        </table>`;
    }
    
    // Footer dengan TTD digital (tanpa hari)
    html += `<div class="footer-report">
        <div class="footer-right">
            <div class="kota-tanggal">${kota}, ${tanggalCetak}</div>
            <div class="jabatan">Penyuluh Pertanian,</div>
            <div class="ttd-image">${ttdImage ? `<img src="${ttdImage}" alt="Tanda Tangan">` : ''}</div>
            <div class="nama">${escapeHtml(namaPenyuluh)}</div>
            <div class="nip">NIP. ${escapeHtml(nipPenyuluh)}</div>
        </div>
    </div>`;
    
    html += `<div class="print-date">Dicetak: ${new Date().toLocaleString('id-ID')} | Total ${filtered.length} kegiatan</div>
    <div class="no-print" style="text-align:center; margin-top:15px;">
        <button onclick="window.print()" style="padding:6px 12px; margin:4px; cursor:pointer;">🖨️ Cetak</button>
        <button onclick="window.close()" style="padding:6px 12px; margin:4px; cursor:pointer;">✖️ Tutup</button>
    </div>
    </div></body></html>`;
    
    return html;
}

function exportToPDF() {
    if (!headerData.namaPenyuluh) {
        showToast('Isi data penyuluh terlebih dahulu!');
        return;
    }
    
    // Simpan filter lama dan reset ke semua data
    const oldFilters = {
        oldSearch: searchQuery,
        oldJenis: filterJenisKegiatan,
        oldBulan: filterBulan
    };
    searchQuery = '';
    filterJenisKegiatan = '';
    filterBulan = '';
    
    const filtered = getFilteredKegiatan(); // sekarang semua data
    
    if (filtered.length === 0) {
        showToast('Tidak ada data kegiatan! Silakan tambah kegiatan terlebih dahulu.');
        // Kembalikan filter
        searchQuery = oldFilters.oldSearch;
        filterJenisKegiatan = oldFilters.oldJenis;
        filterBulan = oldFilters.oldBulan;
        return;
    }
    
    showToast(`Mengekspor ${filtered.length} kegiatan ke PDF...`);
    const htmlContent = generateTableHTML();
    const tempDiv = document.createElement('div');
    tempDiv.style.position = 'absolute';
    tempDiv.style.left = '-9999px';
    tempDiv.style.top = '-9999px';
    tempDiv.innerHTML = htmlContent;
    document.body.appendChild(tempDiv);
    
    const opt = {
        margin: [0.3, 0.3, 0.3, 0.3],
        filename: `Laporan_Kegiatan_${headerData.namaPenyuluh || 'Penyuluh'}_${new Date().toISOString().slice(0,10)}.pdf`,
        image: { type: 'jpeg', quality: 0.85 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'in', format: 'a4', orientation: 'landscape' }
    };
    
    html2pdf().set(opt).from(tempDiv).save().then(() => {
        document.body.removeChild(tempDiv);
        showToast('PDF berhasil diexport!');
        // Kembalikan filter setelah export selesai
        searchQuery = oldFilters.oldSearch;
        filterJenisKegiatan = oldFilters.oldJenis;
        filterBulan = oldFilters.oldBulan;
        renderFullApp(); // refresh tampilan
    }).catch(err => {
        document.body.removeChild(tempDiv);
        console.error('PDF Error:', err);
        showToast('Gagal export PDF, coba pakai Print saja');
        // Kembalikan filter
        searchQuery = oldFilters.oldSearch;
        filterJenisKegiatan = oldFilters.oldJenis;
        filterBulan = oldFilters.oldBulan;
        renderFullApp();
    });
}

function printReport() {
    if (!headerData.namaPenyuluh) {
        showToast('Isi data penyuluh terlebih dahulu!');
        return;
    }
    const filtered = getFilteredKegiatan();
    if (filtered.length === 0) {
        showToast('Tidak ada data untuk dicetak!');
        return;
    }
    const printWindow = window.open('', '_blank');
    printWindow.document.write(generateTableHTML());
    printWindow.document.close();
    printWindow.focus();
}

function exportToExcel() {
    if (!headerData.namaPenyuluh) {
        showToast('Isi data penyuluh terlebih dahulu!');
        return;
    }
    
    // Simpan filter dan reset
    const oldFilters = {
        oldSearch: searchQuery,
        oldJenis: filterJenisKegiatan,
        oldBulan: filterBulan
    };
    searchQuery = '';
    filterJenisKegiatan = '';
    filterBulan = '';
    
    const filtered = getFilteredKegiatan();
    
    if (filtered.length === 0) {
        showToast('Tidak ada data kegiatan! Silakan tambah kegiatan terlebih dahulu.');
        searchQuery = oldFilters.oldSearch;
        filterJenisKegiatan = oldFilters.oldJenis;
        filterBulan = oldFilters.oldBulan;
        return;
    }
    
    const data = filtered.map((k, idx) => ({
        'NO': idx + 1,
        'TANGGAL': formatTanggal(k.tanggal),
        'JENIS KEGIATAN': k.jenisKegiatan || '-',
        'MATERI': k.materi || '-',
        'METODE': k.metode || '-',
        'SASARAN/JUMLAH': k.sasaranJumlah || '-',
        'TUJUAN': k.tujuan || '-',
        'HASIL': k.hasil || '-',
        'MASALAH': k.masalah || '-',
        'JUMLAH FOTO': (k.foto || []).length
    }));
    
    const infoData = [
        { 'Informasi': 'Nama Penyuluh', 'Nilai': headerData.namaPenyuluh || '-' },
        { 'Informasi': 'NIP', 'Nilai': headerData.nipPenyuluh || '-' },
        { 'Informasi': 'Provinsi', 'Nilai': headerData.provinsi || '-' },
        { 'Informasi': 'Kabupaten/Kota', 'Nilai': headerData.kabupatenKota || '-' },
        { 'Informasi': 'Wilayah Kerja', 'Nilai': headerData.wilayahKerja || '-' },
        { 'Informasi': 'Wilayah Binaan', 'Nilai': headerData.wilayahBinaan || '-' },
        { 'Informasi': 'Periode', 'Nilai': 'SEMUA BULAN' },
        { 'Informasi': 'Total Kegiatan', 'Nilai': filtered.length.toString() },
        { 'Informasi': 'Tanggal Export', 'Nilai': new Date().toLocaleString('id-ID') }
    ];
    
    const wsData = XLSX.utils.json_to_sheet(data);
    const wsInfo = XLSX.utils.json_to_sheet(infoData);
    wsData['!cols'] = [{wch:5},{wch:12},{wch:40},{wch:25},{wch:20},{wch:20},{wch:30},{wch:30},{wch:30},{wch:10}];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsData, 'Data Kegiatan');
    XLSX.utils.book_append_sheet(wb, wsInfo, 'Info Penyuluh');
    XLSX.writeFile(wb, `Laporan_Kegiatan_${headerData.namaPenyuluh || 'Penyuluh'}_${new Date().toISOString().slice(0,10)}.xlsx`);
    showToast(`Export Excel berhasil! ${filtered.length} kegiatan diexport.`);
    
    // Kembalikan filter
    searchQuery = oldFilters.oldSearch;
    filterJenisKegiatan = oldFilters.oldJenis;
    filterBulan = oldFilters.oldBulan;
    renderFullApp();
}

// ============================================================
// RENDER FUNCTIONS
// ============================================================
function renderStats() {
    const total = kegiatanData.length;
    const totalFoto = kegiatanData.reduce((sum, k) => sum + (k.foto ? k.foto.length : 0), 0);
    return `<div class="stats-container">
        <div class="stat-card" onclick="clearFilters()"><i class="fas fa-calendar-alt"></i><div class="stat-number">${total}</div><div class="stat-label">Total Kegiatan</div></div>
        <div class="stat-card"><i class="fas fa-camera"></i><div class="stat-number">${totalFoto}</div><div class="stat-label">Total Foto</div></div>
    </div>`;
}

function renderHeaderSection() {
    if (!headerData.namaPenyuluh && !headerData.nipPenyuluh && !headerData.provinsi) {
        return `<div class="info-card"><div class="info-header"><h3><i class="fas fa-user-tie"></i> Informasi Penyuluh</h3></div>
            <div class="form-row"><div class="form-group"><label><i class="fas fa-user"></i> Nama Penyuluh *</label><input type="text" id="header_nama" placeholder="Contoh: FERRY TAMALLUDDIN, S.Pt." value="${escapeHtml(headerData.namaPenyuluh)}"></div>
            <div class="form-group"><label><i class="fas fa-id-card"></i> NIP</label><input type="text" id="header_nip" placeholder="Contoh: 198002042010011008" value="${escapeHtml(headerData.nipPenyuluh)}"></div>
            <div class="form-group"><label><i class="fas fa-map-marker-alt"></i> Provinsi</label><input type="text" id="header_provinsi" placeholder="JAWA BARAT" value="${escapeHtml(headerData.provinsi)}"></div>
            <div class="form-group"><label><i class="fas fa-city"></i> Kabupaten/Kota</label><input type="text" id="header_kabupaten" placeholder="KAB. TASIKMALAYA" value="${escapeHtml(headerData.kabupatenKota)}"></div>
            <div class="form-group"><label><i class="fas fa-briefcase"></i> Wilayah Kerja</label><input type="text" id="header_wilayahKerja" placeholder="PENYULUH KABKOTA" value="${escapeHtml(headerData.wilayahKerja)}"></div>
            <div class="form-group"><label><i class="fas fa-tree"></i> Wilayah Binaan</label><input type="text" id="header_wilayahBinaan" placeholder="Cineam, Gunung Tanjung, Sukaresik" value="${escapeHtml(headerData.wilayahBinaan)}"></div></div>
            <div class="form-actions"><button class="btn btn-primary" id="btn_save_header"><i class="fas fa-save"></i> Simpan Data Penyuluh</button></div></div>`;
    }
    return `<div class="info-card"><div class="info-header"><h3><i class="fas fa-user-tie"></i> Informasi Penyuluh</h3><button class="btn btn-outline btn-sm" id="btn_edit_header"><i class="fas fa-edit"></i> Edit</button></div>
        <div class="info-grid"><div class="info-item"><span class="label">Nama Penyuluh</span><span class="value">${escapeHtml(headerData.namaPenyuluh) || '-'}</span></div>
        <div class="info-item"><span class="label">NIP</span><span class="value">${escapeHtml(headerData.nipPenyuluh) || '-'}</span></div>
        <div class="info-item"><span class="label">Provinsi</span><span class="value">${escapeHtml(headerData.provinsi) || '-'}</span></div>
        <div class="info-item"><span class="label">Kabupaten/Kota</span><span class="value">${escapeHtml(headerData.kabupatenKota) || '-'}</span></div>
        <div class="info-item"><span class="label">Wilayah Kerja</span><span class="value">${escapeHtml(headerData.wilayahKerja) || '-'}</span></div>
        <div class="info-item"><span class="label">Wilayah Binaan</span><span class="value">${escapeHtml(headerData.wilayahBinaan) || '-'}</span></div></div>
        <div class="form-actions" style="margin-top:16px;"><button class="btn btn-outline btn-sm" id="btn_ttd_settings"><i class="fas fa-signature"></i> Pengaturan TTD Digital</button></div></div>`;
}

function renderSearchBar() {
    const bulanOptions = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const selectedCount = selectedIds.size;
    return `<div class="search-bar"><div class="search-row"><div class="search-input-wrapper"><i class="fas fa-search"></i><input type="text" class="search-input" id="searchInput" placeholder="Cari kegiatan, materi, sasaran..." value="${escapeHtml(searchQuery)}"></div>
        <div class="filter-group"><select class="filter-select" id="filterJenisKegiatan"><option value="">Semua Jenis Kegiatan</option>${daftarJenisKegiatan.map(item => `<option value="${escapeHtml(item)}" ${filterJenisKegiatan === item ? 'selected' : ''}>${escapeHtml(item.length > 40 ? item.substring(0,40)+'...' : item)}</option>`).join('')}</select>
        <select class="filter-select" id="filterBulan"><option value="">Semua Bulan</option>${bulanOptions.slice(1).map((bulan, i) => `<option value="${i+1}" ${filterBulan === (i+1).toString() ? 'selected' : ''}>${bulan}</option>`).join('')}</select></div></div>
        <div class="action-row"><div class="action-buttons"><button class="btn btn-primary btn-sm" id="exportExcelBtn"><i class="fas fa-file-excel"></i> Excel</button>
        <button class="btn btn-primary btn-sm" id="exportPdfBtn"><i class="fas fa-file-pdf"></i> PDF</button>
        <button class="btn btn-primary btn-sm" id="printBtn"><i class="fas fa-print"></i> Print</button></div>
        ${selectedCount > 0 ? `<div class="action-buttons"><button class="btn btn-danger btn-sm" id="batchDeleteBtn"><i class="fas fa-trash"></i> Hapus (${selectedCount})</button>
        <button class="btn btn-secondary btn-sm" id="clearSelectionBtn"><i class="fas fa-times"></i> Batal</button></div>` : ''}</div></div>`;
}

function renderKegiatanCards() {
    const filtered = getFilteredKegiatan();
    if (filtered.length === 0 && kegiatanData.length > 0) {
        return `<div class="empty-state"><i class="fas fa-search"></i><p>Tidak ada kegiatan yang sesuai dengan pencarian</p><button class="btn btn-outline btn-sm" id="clearFiltersBtn" style="margin-top: 12px;"><i class="fas fa-undo"></i> Hapus Filter</button></div>`;
    }
    if (filtered.length === 0) {
        return `<div class="empty-state"><i class="fas fa-clipboard-list"></i><p>Belum ada data kegiatan</p><p style="font-size: 0.8rem;">Klik tombol + di pojok kanan bawah untuk menambah kegiatan</p></div>`;
    }
    let html = '<div class="kegiatan-grid">';
    filtered.forEach((item, idx) => {
        const fotoList = item.foto || [];
        const isSelected = selectedIds.has(item.id);
        let jenisKegiatanDisplay = item.jenisKegiatan || '-';
        if (jenisKegiatanDisplay.length > 50) jenisKegiatanDisplay = jenisKegiatanDisplay.substring(0, 47) + '...';
        html += `<div class="kegiatan-card ${isSelected ? 'selected' : ''}" data-id="${item.id}">
            <div class="card-checkbox-wrapper"><input type="checkbox" class="card-checkbox" data-id="${item.id}" ${isSelected ? 'checked' : ''} onclick="toggleSelectKegiatan(${item.id})"></div>
            <div class="card-header"><span class="card-number">#${idx + 1}</span><h4 title="${escapeHtml(item.jenisKegiatan || '-')}">${escapeHtml(jenisKegiatanDisplay)}</h4>
            <div class="card-date"><i class="far fa-calendar-alt"></i> ${formatTanggal(item.tanggal)}</div></div>
            <div class="card-body"><div class="card-info-row"><div class="card-info-icon"><i class="fas fa-chalkboard"></i></div><div class="card-info-text"><strong>Materi:</strong> ${escapeHtml(item.materi || '-')}</div></div>
            <div class="card-info-row"><div class="card-info-icon"><i class="fas fa-users"></i></div><div class="card-info-text"><strong>Sasaran/Jumlah:</strong> ${escapeHtml(item.sasaranJumlah || '-')}</div></div>
            <div class="card-info-row"><div class="card-info-icon"><i class="fas fa-bullseye"></i></div><div class="card-info-text"><strong>Tujuan:</strong> ${escapeHtml(item.tujuan || '-')}</div></div>
            <div class="card-info-row"><div class="card-info-icon"><i class="fas fa-chart-line"></i></div><div class="card-info-text"><strong>Hasil:</strong> ${escapeHtml(item.hasil || '-')}</div></div>
            <div class="card-info-row"><div class="card-info-icon"><i class="fas fa-exclamation-triangle"></i></div><div class="card-info-text"><strong>Masalah:</strong> ${escapeHtml(item.masalah || '-')}</div></div>`;
        if (fotoList.length > 0) {
            html += `<div class="card-photos">`;
            fotoList.slice(0, 4).forEach((foto) => { html += `<img src="${foto}" class="photo-thumb" onclick="viewPhoto('${foto.replace(/'/g, "\\'")}')">`; });
            if (fotoList.length > 4) html += `<span class="photo-more">+${fotoList.length - 4}</span>`;
            html += `</div>`;
        }
        html += `</div><div class="card-actions"><button class="btn-edit" onclick="editKegiatan(${item.id})"><i class="fas fa-edit"></i> Edit</button>
        <button class="btn-photo" onclick="viewKegiatanPhotos(${item.id})"><i class="fas fa-images"></i> Foto</button>
        <button class="btn-delete" onclick="deleteKegiatan(${item.id})"><i class="fas fa-trash"></i> Hapus</button></div></div>`;
    });
    html += '</div>';
    return html;
}

function viewKegiatanPhotos(id) {
    const kegiatan = kegiatanData.find(k => k.id === id);
    if (!kegiatan || !kegiatan.foto || kegiatan.foto.length === 0) { showToast('Tidak ada foto untuk kegiatan ini'); return; }
    const fotoList = kegiatan.foto;
    let currentIndex = 0;
    function showLightbox(index) {
        const src = fotoList[index];
        const lightbox = document.createElement('div');
        lightbox.className = 'lightbox';
        lightbox.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);display:flex;align-items:center;justify-content:center;z-index:2000;cursor:pointer;flex-direction:column;';
        const img = document.createElement('img'); img.src = src; img.style.cssText = 'max-width:90%;max-height:80%;object-fit:contain;';
        const caption = document.createElement('div'); caption.style.cssText = 'color:white;margin-top:10px;font-size:14px;'; caption.innerHTML = `${index + 1} dari ${fotoList.length}`;
        const navDiv = document.createElement('div'); navDiv.style.cssText = 'margin-top:15px;display:flex;gap:20px;';
        if (fotoList.length > 1) {
            const prevBtn = document.createElement('button'); prevBtn.innerHTML = '◀ Sebelumnya'; prevBtn.style.cssText = 'padding:8px 16px;background:#2e7d32;color:white;border:none;border-radius:8px;cursor:pointer;';
            prevBtn.onclick = (e) => { e.stopPropagation(); currentIndex = (currentIndex - 1 + fotoList.length) % fotoList.length; lightbox.remove(); showLightbox(currentIndex); };
            const nextBtn = document.createElement('button'); nextBtn.innerHTML = 'Selanjutnya ▶'; nextBtn.style.cssText = 'padding:8px 16px;background:#2e7d32;color:white;border:none;border-radius:8px;cursor:pointer;';
            nextBtn.onclick = (e) => { e.stopPropagation(); currentIndex = (currentIndex + 1) % fotoList.length; lightbox.remove(); showLightbox(currentIndex); };
            navDiv.appendChild(prevBtn); navDiv.appendChild(nextBtn);
        }
        const closeBtn = document.createElement('button'); closeBtn.innerHTML = '✖ Tutup'; closeBtn.style.cssText = 'margin-top:15px;padding:8px 20px;background:#ef5350;color:white;border:none;border-radius:8px;cursor:pointer;';
        closeBtn.onclick = () => lightbox.remove();
        lightbox.appendChild(img); lightbox.appendChild(caption); lightbox.appendChild(navDiv); lightbox.appendChild(closeBtn);
        lightbox.onclick = (e) => { if (e.target === lightbox) lightbox.remove(); };
        document.body.appendChild(lightbox);
    }
    showLightbox(0);
}

// ============================================================
// MODAL FORM KEGIATAN
// ============================================================
function showKegiatanModal(editId = null) {
    const isEdit = editId !== null;
    const kegiatan = isEdit ? kegiatanData.find(k => k.id === editId) : null;
    
    if (isEdit && kegiatan) {
        editingId = kegiatan.id;
        currentPhotos = [...(kegiatan.foto || [])];
    } else {
        editingId = null;
        currentPhotos = [];
    }
    
    const jenisKegiatanOptions = daftarJenisKegiatan.map(item => `<option value="${escapeHtml(item)}" ${isEdit && kegiatan?.jenisKegiatan === item ? 'selected' : ''}>${escapeHtml(item)}</option>`).join('');
    const jenisKegiatanSelect = `<select id="modal_jenisKegiatan"><option value="">-- Pilih Jenis Kegiatan --</option>${jenisKegiatanOptions}<option value="custom" ${isEdit && kegiatan && !daftarJenisKegiatan.includes(kegiatan.jenisKegiatan) && kegiatan.jenisKegiatan ? 'selected' : ''}>-- Input Manual --</option></select>
        <input type="text" id="modal_jenisKegiatan_custom" placeholder="Atau tulis jenis kegiatan sendiri" style="margin-top:8px; display:${isEdit && kegiatan && !daftarJenisKegiatan.includes(kegiatan.jenisKegiatan) && kegiatan.jenisKegiatan ? 'block' : 'none'};" value="${isEdit && kegiatan && !daftarJenisKegiatan.includes(kegiatan.jenisKegiatan) ? escapeHtml(kegiatan.jenisKegiatan) : ''}">`;
    
    const metodeOptions = daftarMetode.map(item => `<option value="${escapeHtml(item)}" ${isEdit && kegiatan?.metode === item ? 'selected' : ''}>${escapeHtml(item)}</option>`).join('');
    const metodeSelect = `<select id="modal_metode"><option value="">-- Pilih Metode --</option>${metodeOptions}<option value="custom" ${isEdit && kegiatan && !daftarMetode.includes(kegiatan.metode) && kegiatan.metode ? 'selected' : ''}>-- Input Manual --</option></select>
        <input type="text" id="modal_metode_custom" placeholder="Atau tulis metode sendiri" style="margin-top:8px; display:${isEdit && kegiatan && !daftarMetode.includes(kegiatan.metode) && kegiatan.metode ? 'block' : 'none'};" value="${isEdit && kegiatan && !daftarMetode.includes(kegiatan.metode) ? escapeHtml(kegiatan.metode) : ''}">`;
    
    const modalHtml = `<div id="kegiatanModal" class="modal"><div class="modal-content"><div class="modal-header"><h3><i class="fas ${isEdit ? 'fa-edit' : 'fa-plus-circle'}"></i> ${isEdit ? 'Edit Kegiatan' : 'Tambah Kegiatan Baru'}</h3><button class="modal-close" onclick="closeModal()">&times;</button></div>
        <div class="form-group"><label><i class="fas fa-calendar"></i> TANGGAL *</label><input type="date" id="modal_tanggal" value="${isEdit ? (kegiatan?.tanggal || '') : ''}"></div>
        <div class="form-group"><label><i class="fas fa-tag"></i> JENIS KEGIATAN *</label>${jenisKegiatanSelect}</div>
        <div class="form-group"><label><i class="fas fa-book"></i> MATERI</label><input type="text" id="modal_materi" value="${escapeHtml(isEdit ? (kegiatan?.materi || '') : '')}" placeholder="Contoh: Pengembangan pembibitan ayam"></div>
        <div class="form-group"><label><i class="fas fa-tasks"></i> METODE</label>${metodeSelect}</div>
        <div class="form-group"><label><i class="fas fa-users"></i> SASARAN/JUMLAH</label><input type="text" id="modal_sasaranJumlah" value="${escapeHtml(isEdit ? (kegiatan?.sasaranJumlah || '') : '')}" placeholder="Contoh: Petani Usia 19-39 Tahun - 10 orang"></div>
        <div class="form-group"><label><i class="fas fa-bullseye"></i> TUJUAN</label><input type="text" id="modal_tujuan" value="${escapeHtml(isEdit ? (kegiatan?.tujuan || '') : '')}" placeholder="Contoh: Meningkatkan kapasitas petani"></div>
        <div class="form-group"><label><i class="fas fa-chart-line"></i> HASIL</label><textarea id="modal_hasil" rows="2" placeholder="Contoh: Terlaksananya pendampingan">${escapeHtml(isEdit ? (kegiatan?.hasil || '') : '')}</textarea></div>
        <div class="form-group"><label><i class="fas fa-exclamation-triangle"></i> MASALAH</label><textarea id="modal_masalah" rows="2" placeholder="Contoh: Kendala cuaca">${escapeHtml(isEdit ? (kegiatan?.masalah || '') : '')}</textarea></div>
        <div class="form-group"><label><i class="fas fa-camera"></i> EVIDEN/DOKUMENTASI</label>
            <div class="photo-upload" id="photoUploadArea">
                <i class="fas fa-cloud-upload-alt" style="font-size: 24px;"></i>
                <p>Klik atau taruh file foto di sini</p>
                <input type="file" id="photoInput" accept="image/*" multiple style="display: none;">
            </div>
            <div class="photo-preview" id="photoPreview"></div>
        </div>
        <div class="form-actions"><button class="btn btn-secondary" onclick="closeModal()"><i class="fas fa-times"></i> Batal</button><button class="btn btn-primary" id="btn_save_modal"><i class="fas fa-save"></i> Simpan</button></div></div></div>`;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Event listener untuk dropdown
    const jenisSelect = document.getElementById('modal_jenisKegiatan');
    const jenisCustom = document.getElementById('modal_jenisKegiatan_custom');
    if (jenisSelect && jenisCustom) {
        jenisSelect.addEventListener('change', function() { 
            if (this.value === 'custom') { 
                jenisCustom.style.display = 'block'; 
                jenisCustom.focus(); 
            } else { 
                jenisCustom.style.display = 'none'; 
                jenisCustom.value = ''; 
            } 
        });
    }
    
    const metodeSelectEl = document.getElementById('modal_metode');
    const metodeCustomEl = document.getElementById('modal_metode_custom');
    if (metodeSelectEl && metodeCustomEl) {
        metodeSelectEl.addEventListener('change', function() { 
            if (this.value === 'custom') { 
                metodeCustomEl.style.display = 'block'; 
                metodeCustomEl.focus(); 
            } else { 
                metodeCustomEl.style.display = 'none'; 
                metodeCustomEl.value = ''; 
            } 
        });
    }
    
    // Inisialisasi upload foto
    initPhotoUpload();
    
    // Pasang event listener untuk tombol simpan
    const saveBtn = document.getElementById('btn_save_modal');
    if (saveBtn) {
        saveBtn.onclick = function(e) {
            e.preventDefault();
            saveFromModal();
        };
    }
}

// ============================================================
// UPLOAD FOTO DENGAN KOMPRESI
// ============================================================
function initPhotoUpload() {
    const uploadArea = document.getElementById('photoUploadArea');
    const fileInput = document.getElementById('photoInput');
    
    if (!uploadArea || !fileInput) return;
    
    updatePhotoPreview();
    
    uploadArea.onclick = function() {
        fileInput.click();
    };
    
    uploadArea.ondragover = function(e) {
        e.preventDefault();
        uploadArea.style.borderColor = '#2e7d32';
        uploadArea.style.background = '#e8f5e9';
    };
    
    uploadArea.ondragleave = function() {
        uploadArea.style.borderColor = 'var(--border)';
        uploadArea.style.background = 'var(--bg-light)';
    };
    
    uploadArea.ondrop = async function(e) {
        e.preventDefault();
        uploadArea.style.borderColor = 'var(--border)';
        uploadArea.style.background = 'var(--bg-light)';
        
        showToast('Memproses foto...');
        const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
        
        for (const file of files) {
            const base64 = await fileToBase64(file);
            const compressed = await compressImage(base64, 800, 800, 0.6);
            currentPhotos.push(compressed);
        }
        updatePhotoPreview();
        showToast(`${files.length} foto ditambahkan`);
    };
    
    fileInput.onchange = async function(e) {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;
        
        showToast(`Memproses ${files.length} foto...`);
        
        for (const file of files) {
            const base64 = await fileToBase64(file);
            const compressed = await compressImage(base64, 800, 800, 0.6);
            currentPhotos.push(compressed);
        }
        updatePhotoPreview();
        fileInput.value = '';
        showToast(`${files.length} foto ditambahkan`);
    };
}

function updatePhotoPreview() {
    const preview = document.getElementById('photoPreview');
    if (!preview) return;
    
    if (currentPhotos.length === 0) {
        preview.innerHTML = '';
        return;
    }
    
    preview.innerHTML = currentPhotos.map((photo, idx) => `
        <div class="photo-item">
            <img src="${photo}" alt="Foto ${idx + 1}">
            <button class="remove-photo" onclick="removePhoto(${idx})">×</button>
        </div>
    `).join('');
}

function removePhoto(index) {
    currentPhotos.splice(index, 1);
    updatePhotoPreview();
}

function closeModal() { 
    const modal = document.getElementById('kegiatanModal'); 
    if (modal) modal.remove(); 
    editingId = null; 
    currentPhotos = []; 
}

// ============================================================
// SAVE FROM MODAL
// ============================================================
async function saveFromModal() {
    const tanggal = document.getElementById('modal_tanggal')?.value || '';
    
    let jenisKegiatan = '';
    const jenisSelect = document.getElementById('modal_jenisKegiatan')?.value;
    const jenisCustom = document.getElementById('modal_jenisKegiatan_custom')?.value;
    if (jenisSelect === 'custom') {
        jenisKegiatan = jenisCustom;
    } else if (jenisSelect && jenisSelect !== '') {
        jenisKegiatan = jenisSelect;
    }
    
    let metode = '';
    const metodeSelect = document.getElementById('modal_metode')?.value;
    const metodeCustom = document.getElementById('modal_metode_custom')?.value;
    if (metodeSelect === 'custom') {
        metode = metodeCustom;
    } else if (metodeSelect && metodeSelect !== '') {
        metode = metodeSelect;
    }
    
    if (!tanggal) { 
        showToast('Tanggal wajib diisi!'); 
        return; 
    }
    if (!jenisKegiatan) { 
        showToast('Jenis Kegiatan wajib diisi!'); 
        return; 
    }
    
    const materi = document.getElementById('modal_materi')?.value || '';
    const sasaranJumlah = document.getElementById('modal_sasaranJumlah')?.value || '';
    const tujuan = document.getElementById('modal_tujuan')?.value || '';
    const hasil = document.getElementById('modal_hasil')?.value || '';
    const masalah = document.getElementById('modal_masalah')?.value || '';
    
    const newKegiatan = {
        id: editingId !== null ? editingId : Date.now(),
        tanggal: tanggal,
        jenisKegiatan: jenisKegiatan,
        materi: materi,
        metode: metode,
        sasaranJumlah: sasaranJumlah,
        tujuan: tujuan,
        hasil: hasil,
        masalah: masalah,
        foto: [...currentPhotos]
    };
    
    if (editingId !== null) {
        const index = kegiatanData.findIndex(k => k.id === editingId);
        if (index !== -1) {
            kegiatanData[index] = newKegiatan;
            showToast('Kegiatan berhasil diperbarui!');
        } else {
            showToast('Error: Data tidak ditemukan!');
            return;
        }
    } else {
        kegiatanData.push(newKegiatan);
        showToast('Kegiatan berhasil ditambahkan!');
    }
    
    saveKegiatan();
    closeModal();
    renderFullApp();
}

// ============================================================
// FUNGSI LAINNYA
// ============================================================
function editKegiatan(id) { 
    closeModal(); 
    showKegiatanModal(id); 
}

function deleteKegiatan(id) {
    if (confirm('Hapus kegiatan ini?')) {
        kegiatanData = kegiatanData.filter(k => k.id !== id);
        selectedIds.delete(id);
        saveKegiatan();
        renderFullApp();
        showToast('Kegiatan dihapus');
    }
}

function batchDeleteKegiatan() { 
    const idsToDelete = Array.from(selectedIds); 
    if (idsToDelete.length === 0) return; 
    if (confirm(`Hapus ${idsToDelete.length} kegiatan yang dipilih?`)) { 
        kegiatanData = kegiatanData.filter(k => !selectedIds.has(k.id)); 
        selectedIds.clear(); 
        saveKegiatan(); 
        renderFullApp(); 
        showToast(`${idsToDelete.length} kegiatan berhasil dihapus`); 
    } 
}

function toggleSelectKegiatan(id) { 
    if (selectedIds.has(id)) selectedIds.delete(id); 
    else selectedIds.add(id); 
    renderFullApp(); 
}

function clearSelection() { 
    selectedIds.clear(); 
    renderFullApp(); 
}

function clearFilters() { 
    searchQuery = ''; 
    filterJenisKegiatan = ''; 
    filterBulan = ''; 
    renderFullApp(); 
}

function toggleDarkMode() { 
    document.body.classList.toggle('dark-mode'); 
    const isDark = document.body.classList.contains('dark-mode'); 
    localStorage.setItem('darkMode', isDark); 
    showToast(isDark ? 'Mode Gelap aktif' : 'Mode Terang aktif'); 
}

function refreshData() { 
    loadData(); 
    renderFullApp(); 
    showToast('Data berhasil dimuat ulang'); 
}

function viewPhoto(src) { 
    const lightbox = document.createElement('div'); 
    lightbox.className = 'lightbox'; 
    lightbox.onclick = () => lightbox.remove(); 
    lightbox.innerHTML = `<img src="${src}" style="max-width:90%;max-height:90%;">`; 
    document.body.appendChild(lightbox); 
}

// ============================================================
// MODAL TTD DIGITAL DENGAN TOUCHSCREEN
// ============================================================
function showTtdModal() {
    const modalHtml = `<div id="ttdModal" class="modal"><div class="modal-content" style="max-width: 500px;"><div class="modal-header"><h3><i class="fas fa-signature"></i> Tanda Tangan Digital</h3><button class="modal-close" onclick="closeTtdModal()">&times;</button></div>
        <div class="form-group"><label><i class="fas fa-user"></i> Nama Penandatangan</label>
            <input type="text" id="ttd_nama" placeholder="Contoh: Dr. Ir. FAJRIN SIDIK MARZUKI, M.Si" value="${escapeHtml(ttdData.nama || '')}">
        </div>
        <div class="form-group"><label><i class="fas fa-id-card"></i> NIP Penandatangan</label>
            <input type="text" id="ttd_nip" placeholder="Contoh: 197501012005011002" value="${escapeHtml(ttdData.nip || '')}">
        </div>
        <div class="form-group"><label><i class="fas fa-pen-fancy"></i> Tanda Tangan (Coret di area bawah)</label>
            <div style="border: 2px dashed var(--border); border-radius: 12px; padding: 10px; background: white;">
                <canvas id="signatureCanvas" width="450" height="200" style="width:100%; height:auto; max-width:450px; border:1px solid #ccc; border-radius:8px; touch-action: none; background: white; cursor: crosshair;"></canvas>
                <div style="display: flex; gap: 10px; margin-top: 10px; justify-content: center;">
                    <button type="button" class="btn btn-secondary btn-sm" id="clearSignatureBtn" style="padding: 6px 12px;"><i class="fas fa-eraser"></i> Hapus</button>
                </div>
                <p style="font-size: 0.65rem; color: var(--text-muted); margin-top: 8px; text-align: center;">Gunakan jari atau stylus untuk menandatangani di area kotak putih</p>
            </div>
        </div>
        <div class="form-group"><label><i class="fas fa-info-circle"></i> Catatan</label>
            <p style="font-size:0.7rem; color:var(--text-muted);">Jika nama dan NIP kosong, akan menggunakan data penyuluh yang sudah diisi.</p>
        </div>
        <div class="form-actions"><button class="btn btn-secondary" onclick="closeTtdModal()"><i class="fas fa-times"></i> Batal</button><button class="btn btn-primary" id="btn_save_ttd"><i class="fas fa-save"></i> Simpan TTD</button></div></div></div>`;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Inisialisasi canvas untuk signature
    initSignaturePad();
    
    const saveBtn = document.getElementById('btn_save_ttd');
    if (saveBtn) {
        saveBtn.onclick = function() {
            // Simpan nama dan NIP
            ttdData.nama = document.getElementById('ttd_nama')?.value || '';
            ttdData.nip = document.getElementById('ttd_nip')?.value || '';
            
            // Simpan gambar tanda tangan dari canvas
            const canvas = document.getElementById('signatureCanvas');
            if (canvas && !isCanvasBlank(canvas)) {
                ttdData.tandaTangan = canvas.toDataURL('image/png');
            }
            
            saveTtd();
            closeTtdModal();
            showToast('TTD Digital berhasil disimpan!');
        };
    }
    
    const clearBtn = document.getElementById('clearSignatureBtn');
    if (clearBtn) {
        clearBtn.onclick = function() {
            clearSignature();
        };
    }
}

function initSignaturePad() {
    const canvas = document.getElementById('signatureCanvas');
    if (!canvas) return;
    
    // Set ukuran canvas yang benar
    const container = canvas.parentElement;
    const containerWidth = container.clientWidth - 20;
    canvas.width = 450;
    canvas.height = 200;
    canvas.style.width = '100%';
    canvas.style.height = 'auto';
    
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // Load existing signature if any
    if (ttdData.tandaTangan) {
        const img = new Image();
        img.onload = function() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        };
        img.src = ttdData.tandaTangan;
    }
    
    let drawing = false;
    let lastX = 0, lastY = 0;
    
    function getCoordinates(e) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        
        let clientX, clientY;
        
        if (e.touches) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
            e.preventDefault();
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }
        
        let x = (clientX - rect.left) * scaleX;
        let y = (clientY - rect.top) * scaleY;
        
        x = Math.max(0, Math.min(canvas.width, x));
        y = Math.max(0, Math.min(canvas.height, y));
        
        return { x, y };
    }
    
    function startDrawing(e) {
        drawing = true;
        const coords = getCoordinates(e);
        lastX = coords.x;
        lastY = coords.y;
        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(lastX, lastY);
        ctx.stroke();
    }
    
    function draw(e) {
        if (!drawing) return;
        e.preventDefault();
        
        const coords = getCoordinates(e);
        const currentX = coords.x;
        const currentY = coords.y;
        
        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(currentX, currentY);
        ctx.stroke();
        
        lastX = currentX;
        lastY = currentY;
    }
    
    function stopDrawing() {
        drawing = false;
        ctx.beginPath();
    }
    
    // Mouse events
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseleave', stopDrawing);
    
    // Touch events untuk smartphone
    canvas.addEventListener('touchstart', startDrawing, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', stopDrawing);
    canvas.addEventListener('touchcancel', stopDrawing);
}

function isCanvasBlank(canvas) {
    const ctx = canvas.getContext('2d');
    const pixelBuffer = new Uint32Array(
        ctx.getImageData(0, 0, canvas.width, canvas.height).data.buffer
    );
    return !pixelBuffer.some(color => color !== 0xFFFFFFFF);
}

function clearSignature() {
    const canvas = document.getElementById('signatureCanvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.beginPath();
        showToast('TTD dihapus');
    }
}

function closeTtdModal() {
    const modal = document.getElementById('ttdModal');
    if (modal) modal.remove();
    signaturePad = null;
}

// ============================================================
// RENDER FULL APP
// ============================================================
function renderFullApp() {
    const app = document.getElementById('app');
    const isDark = localStorage.getItem('darkMode') === 'true';
    if (isDark) document.body.classList.add('dark-mode');
    
    const html = `<div class="header-modern"><div class="header-content"><div class="header-row"><div class="header-left"><div class="header-logo"><i class="fas fa-leaf"></i></div><div class="header-title"><h1>SiPetan</h1><p style="font-size:0.6rem; opacity:0.8;">Laporan Penyuluhan Pertanian</p></div></div><div class="header-right"><button class="icon-btn" id="darkModeToggle" title="Mode Gelap/Terang"><i class="fas fa-moon"></i></button><button class="icon-btn" id="refreshBtn" title="Refresh"><i class="fas fa-sync-alt"></i></button></div></div><div class="header-sub"><span><i class="fas fa-calendar-alt"></i> Periode: ${new Date().getFullYear()}</span><span><i class="fas fa-database"></i> Data tersimpan otomatis</span></div></div></div>
        <div class="container"><div id="header-section">${renderHeaderSection()}</div>${headerData.namaPenyuluh ? renderStats() : ''}${headerData.namaPenyuluh ? renderSearchBar() : ''}<div id="kegiatan-section">${renderKegiatanCards()}</div>
        <div class="footer"><p><i class="fas fa-clipboard-list"></i> Total ${kegiatanData.length} kegiatan | Data tersimpan di browser Anda</p></div></div><button class="fab" id="fabButton"><i class="fas fa-plus"></i></button>`;
    
    app.innerHTML = html;
    
    // Event listeners
    document.getElementById('fabButton')?.addEventListener('click', () => showKegiatanModal());
    document.getElementById('darkModeToggle')?.addEventListener('click', toggleDarkMode);
    document.getElementById('refreshBtn')?.addEventListener('click', refreshData);
    
    document.getElementById('btn_save_header')?.addEventListener('click', () => { 
        headerData = { 
            namaPenyuluh: document.getElementById('header_nama')?.value || '', 
            nipPenyuluh: document.getElementById('header_nip')?.value || '', 
            provinsi: document.getElementById('header_provinsi')?.value || '', 
            kabupatenKota: document.getElementById('header_kabupaten')?.value || '', 
            wilayahKerja: document.getElementById('header_wilayahKerja')?.value || '', 
            wilayahBinaan: document.getElementById('header_wilayahBinaan')?.value || '' 
        }; 
        saveHeader(); 
        renderFullApp(); 
        showToast('Data penyuluh disimpan'); 
    });
    
    document.getElementById('btn_edit_header')?.addEventListener('click', () => { 
        headerData = { namaPenyuluh: '', nipPenyuluh: '', provinsi: '', kabupatenKota: '', wilayahKerja: '', wilayahBinaan: '' }; 
        saveHeader(); 
        renderFullApp(); 
    });
    
    document.getElementById('btn_ttd_settings')?.addEventListener('click', showTtdModal);
    
    document.getElementById('searchInput')?.addEventListener('input', (e) => { 
        searchQuery = e.target.value; 
        renderFullApp(); 
    });
    
    document.getElementById('filterJenisKegiatan')?.addEventListener('change', (e) => { 
        filterJenisKegiatan = e.target.value; 
        renderFullApp(); 
    });
    
    document.getElementById('filterBulan')?.addEventListener('change', (e) => { 
        filterBulan = e.target.value; 
        renderFullApp(); 
    });
    
    document.getElementById('batchDeleteBtn')?.addEventListener('click', batchDeleteKegiatan);
    document.getElementById('clearSelectionBtn')?.addEventListener('click', clearSelection);
    document.getElementById('clearFiltersBtn')?.addEventListener('click', clearFilters);
    document.getElementById('exportExcelBtn')?.addEventListener('click', exportToExcel);
    document.getElementById('exportPdfBtn')?.addEventListener('click', exportToPDF);
    document.getElementById('printBtn')?.addEventListener('click', printReport);
}

// ============================================================
// GENERATE SIMPLE ICONS (jika tidak ada file icon)
// ============================================================
function generateSimpleIcon() {
    // Buat canvas untuk generate icon sederhana
    const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
    
    sizes.forEach(size => {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        
        // Background gradient
        const gradient = ctx.createLinearGradient(0, 0, size, size);
        gradient.addColorStop(0, '#2e7d32');
        gradient.addColorStop(1, '#1b5e20');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);
        
        // Lingkaran putih di tengah
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.beginPath();
        ctx.arc(size/2, size/2, size * 0.35, 0, 2 * Math.PI);
        ctx.fill();
        
        // Icon daun
        ctx.fillStyle = '#2e7d32';
        ctx.font = `bold ${size * 0.4}px "Inter", "Segoe UI", Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🌿', size/2, size/2);
        
        // Simpan ke localStorage sebagai fallback
        const iconData = canvas.toDataURL('image/png');
        
        // Cek apakah folder icons ada, jika tidak pakai dataURL
        console.log(`Icon ${size}x${size} generated`);
    });
}

// Panggil fungsi generate icon (opsional, untuk fallback)
// generateSimpleIcon();

// Global functions
window.editKegiatan = editKegiatan;
window.deleteKegiatan = deleteKegiatan;
window.viewKegiatanPhotos = viewKegiatanPhotos;
window.closeModal = closeModal;
window.removePhoto = removePhoto;
window.toggleSelectKegiatan = toggleSelectKegiatan;
window.viewPhoto = viewPhoto;
window.closeTtdModal = closeTtdModal;
window.clearSignature = clearSignature;

// Init
loadData();
renderFullApp();