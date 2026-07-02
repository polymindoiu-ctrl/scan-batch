// ============================================
// 1. KONFIGURASI FIREBASE
// ============================================
// GANTI dengan data dari Firebase Console Anda!
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBn799uLE01yJO68bgvFY8bnuykUUByf74",
  authDomain: "ambil-data-dd0d1.firebaseapp.com",
  databaseURL: "https://ambil-data-dd0d1-default-rtdb.asia-southeast1.firebasedatabase.app", // ← TAMBAHKAN INI
  projectId: "ambil-data-dd0d1",
  storageBucket: "ambil-data-dd0d1.firebasestorage.app",
  messagingSenderId: "107971509723",
  appId: "1:107971509723:web:ad27240062a3d34e3c7bfe",
  measurementId: "G-HS76ZXYJNJ"
};

// Inisialisasi Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// ============================================
// 2. VARIABEL GLOBAL
// ============================================
let html5QrCode = null;
let isScanning = false;
let currentItemNumber = '';

// ============================================
// 3. DOM ELEMENTS
// ============================================
const readerEl = document.getElementById('reader');
const startBtn = document.getElementById('startScanBtn');
const stopBtn = document.getElementById('stopScanBtn');
const errorEl = document.getElementById('error');
const loadingEl = document.getElementById('loading');
const resultCard = document.getElementById('resultCard');

// Result elements
const itemNameDisplay = document.getElementById('itemNameDisplay');
const itemNumberDisplay = document.getElementById('itemNumberDisplay');
const batchDisplay = document.getElementById('batchDisplay');
const stokDisplay = document.getElementById('stokDisplay');
const remarkDisplay = document.getElementById('remarkDisplay');
const tanggalDisplay = document.getElementById('tanggalDisplay');
const historyContent = document.getElementById('historyContent');

// ============================================
// 4. HELPER FUNCTIONS
// ============================================

// Konversi tanggal dd/mmm/yy ke Date object
function parseDateCustom(dateStr) {
    if (!dateStr) return new Date(0);
    
    const parts = dateStr.split('/');
    if (parts.length !== 3) return new Date(0);
    
    const day = parseInt(parts[0]);
    const monthStr = parts[1].toLowerCase();
    const year = parseInt(parts[2]) + 2000;
    
    const monthMap = {
        'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
        'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
    };
    
    const month = monthMap[monthStr];
    if (month === undefined) return new Date(0);
    
    return new Date(year, month, day);
}

// Format Date ke dd/mmm/yy
function formatDateToCustom(date) {
    if (!date || isNaN(date.getTime())) return '-';
    
    const day = String(date.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    const year = String(date.getFullYear()).slice(2);
    
    return `${day}/${month}/${year}`;
}

// Tampilkan error
function showError(msg) {
    errorEl.textContent = '⚠️ ' + msg;
    errorEl.style.display = 'block';
    setTimeout(() => {
        errorEl.style.display = 'none';
    }, 5000);
}

// Tampilkan loading
function showLoading(show) {
    loadingEl.style.display = show ? 'block' : 'none';
}

// ============================================
// 5. FIREBASE QUERY
// ============================================

// Normalisasi string untuk perbandingan: lowercase + hapus semua whitespace
// (termasuk whitespace "aneh" seperti non-breaking space / zero-width space)
function normalizeItemNumber(str) {
    if (!str) return '';
    return String(str)
        .replace(/[\s\u200B-\u200D\uFEFF]/g, '') // hapus spasi & zero-width chars
        .toLowerCase();
}

async function fetchItemData(itemNumber) {
    showLoading(true);
    resultCard.style.display = 'none';
    errorEl.style.display = 'none';
    
    try {
        const targetNormalized = normalizeItemNumber(itemNumber);
        
        // Ambil SEMUA data lalu filter manual (case-insensitive & toleran whitespace)
        // Ini menggantikan query orderByChild().equalTo() yang exact-match & case-sensitive
        const snapshot = await db.ref('/').once('value');
        
        const data = snapshot.val();
        
        if (!data) {
            showError(`Item "${itemNumber}" tidak ada !`);
            showLoading(false);
            return;
        }
        
        // Konversi ke array
        const allItems = Object.keys(data).map(key => ({
            id: key,
            ...data[key]
        }));
        
        // Filter berdasarkan itemnumber yang sudah dinormalisasi
        const items = allItems.filter(item => 
            normalizeItemNumber(item.itemnumber) === targetNormalized
        );
        
        if (items.length === 0) {
            console.warn('📌 Item tidak ditemukan. Target (normalized):', targetNormalized);
            console.warn('📌 Contoh itemnumber yang ada di DB:', 
                allItems.slice(0, 10).map(i => i.itemnumber));
            showError(`Item "${itemNumber}" tidak ditemukan!`);
            showLoading(false);
            return;
        }
        
        // Filter yang punya tanggal valid
        const validItems = items.filter(item => item.tanggal);
        
        if (validItems.length === 0) {
            showError(`Data untuk item "${itemNumber}" tidak memiliki tanggal!`);
            showLoading(false);
            return;
        }
        
        // Sort by tanggal (descending - terbaru di atas)
        validItems.sort((a, b) => {
            const dateA = parseDateCustom(a.tanggal);
            const dateB = parseDateCustom(b.tanggal);
            return dateB - dateA;
        });
        
        // Ambil 30 data terakhir
        const last30 = validItems.slice(0, 30);
        
        // Data terbaru
        const latest = last30[0];
        
        // Tampilkan
        displayItemData(latest, itemNumber);
        displayHistory(last30);
        
        resultCard.style.display = 'block';
        showLoading(false);
        
    } catch (err) {
        console.error('Error fetching data:', err);
        showError('Gagal mengambil data: ' + err.message);
        showLoading(false);
    }
}

// ============================================
// 6. DISPLAY FUNCTIONS
// ============================================

function displayItemData(data, itemNumber) {
    itemNumberDisplay.textContent = itemNumber;
    itemNameDisplay.textContent = data.itemname || '-';
    batchDisplay.textContent = data.batch || '-';
    stokDisplay.textContent = data.stok ? data.stok + ' kg' : '-';
    remarkDisplay.textContent = data.remark || '-';
    tanggalDisplay.textContent = data.tanggal || '-';
}

function displayHistory(items) {
    if (!items || items.length === 0) {
        historyContent.innerHTML = '<p class="empty-state">Tidak ada data history</p>';
        return;
    }
    
    // Items sudah terurut descending (terbaru di atas)
    let html = `
        <div class="history-table-wrapper">
            <table class="history-table">
                <thead>
                    <tr>
                        <th>Tanggal</th>
                        <th>Batch</th>
                        <th>Stok</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    items.forEach(item => {
        const stok = item.stok ? item.stok + ' kg' : '-';
        html += `
            <tr>
                <td>${item.tanggal || '-'}</td>
                <td>${item.batch || '-'}</td>
                <td>${stok}</td>
            </tr>
        `;
    });
    
    html += `
                </tbody>
            </table>
        </div>
    `;
    
    // Tambahkan info jumlah data
    const totalData = items.length;
    const infoText = totalData === 30 ? 
        'Menampilkan 30 data terakhir' : 
        `Menampilkan ${totalData} data (semua data tersedia)`;
    
    html += `<p style="margin-top: 12px; font-size: 12px; color: #6b7a8f; text-align: center;">${infoText}</p>`;
    
    historyContent.innerHTML = html;
}

// ============================================
// 7. QR SCANNER FUNCTIONS
// ============================================

async function startScanner() {
    try {
        // Cek dukungan kamera
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            showError('Browser tidak mendukung akses kamera. Gunakan Chrome/Edge di HP.');
            return;
        }
        
        if (html5QrCode) {
            await html5QrCode.stop();
            html5QrCode.clear();
        }
        
        html5QrCode = new Html5Qrcode("reader");
        
        const config = {
            fps: 15,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0
        };
        
        await html5QrCode.start(
            { facingMode: "environment" },
            config,
            onScanSuccess,
            onScanError
        );
        
        isScanning = true;
        startBtn.disabled = true;
        stopBtn.disabled = false;
        errorEl.style.display = 'none';
        
    } catch (err) {
        console.error('Error starting scanner:', err);
        showError('Gagal mengakses kamera: ' + err.message);
    }
}

async function stopScanner() {
    try {
        if (html5QrCode) {
            await html5QrCode.stop();
            await html5QrCode.clear();
            html5QrCode = null;
        }
        isScanning = false;
        startBtn.disabled = false;
        stopBtn.disabled = true;
    } catch (err) {
        console.error('Error stopping scanner:', err);
    }
}

function onScanSuccess(decodedText) {
    // ===== DEBUG: Tampilkan hasil scan =====
    console.log('📌 HASIL SCAN:', decodedText);
    console.log('📌 PANJANG TEXT:', decodedText.length);
    console.log('📌 KARAKTER:', decodedText.split('').map(c => c.charCodeAt(0)));
    // =======================================
    
    const itemNumber = decodedText.trim();
    
    console.log('📌 SETELAH TRIM:', itemNumber);
    console.log('📌 PANJANG SETELAH TRIM:', itemNumber.length);
    
    if (itemNumber) {
        stopScanner();
        fetchItemData(itemNumber);
    } else {
        showError('QR Code tidak valid!');
    }
}

function onScanError(err) {
    // Error scanning - ignore (ini normal)
    // console.warn(err);
}

// ============================================
// 8. EVENT LISTENERS
// ============================================

startBtn.addEventListener('click', startScanner);
stopBtn.addEventListener('click', stopScanner);

// ============================================
// 9. CLEANUP
// ============================================

window.addEventListener('beforeunload', async () => {
    if (html5QrCode) {
        try {
            await html5QrCode.stop();
        } catch (e) {
            // ignore
        }
    }
});

// ============================================
// 10. INITIALIZATION
// ============================================

console.log('✅ Aplikasi Scan QR Inventory siap!');
console.log('📌 Pastikan konfigurasi Firebase sudah diisi di script.js');
console.log('📌 Struktur data: /{pushId} dengan field: itemnumber, batch, itemname, remark, stok, tanggal');
console.log('📌 Format tanggal: dd/mmm/yy (contoh: 01/Jul/26)');
console.log('📌 QR Code berisi: itemnumber (contoh: R90878)');