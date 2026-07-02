// ============================================
// 1. KONFIGURASI FIREBASE
// ============================================
const firebaseConfig = {
    apiKey: "AIzaSyBn799uLE01yJO68bgvFY8bnuykUUByf74",
    authDomain: "ambil-data-dd0d1.firebaseapp.com",
    databaseURL: "https://ambil-data-dd0d1-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "ambil-data-dd0d1",
    storageBucket: "ambil-data-dd0d1.firebasestorage.app",
    messagingSenderId: "107971509723",
    appId: "1:107971509723:web:ad27240062a3d34e3c7bfe",
    measurementId: "G-HS76ZXYJNJ"
};

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

// Konversi tanggal ke Date object - SUPPORT FORMAT ISO (YYYY-MM-DD)
function parseDateCustom(dateStr) {
    if (!dateStr) return new Date(0);
    
    // Coba parse sebagai ISO format (YYYY-MM-DD)
    const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
        const year = parseInt(isoMatch[1]);
        const month = parseInt(isoMatch[2]) - 1;
        const day = parseInt(isoMatch[3]);
        return new Date(year, month, day);
    }
    
    // Fallback: dd/mmm/yy (format lama)
    const parts = dateStr.split('/');
    if (parts.length === 3) {
        const day = parseInt(parts[0]);
        const monthStr = parts[1].toLowerCase();
        const year = parseInt(parts[2]) + 2000;
        
        const monthMap = {
            'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
            'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
        };
        
        const month = monthMap[monthStr];
        if (month !== undefined) {
            return new Date(year, month, day);
        }
    }
    
    // Last resort
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
        return parsed;
    }
    
    return new Date(0);
}

// Format Date ke YYYY-MM-DD (untuk display)
function formatDateDisplay(date) {
    if (!date || isNaN(date.getTime())) return '-';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function showError(msg) {
    errorEl.textContent = '⚠️ ' + msg;
    errorEl.style.display = 'block';
    setTimeout(() => {
        errorEl.style.display = 'none';
    }, 5000);
}

function showLoading(show) {
    loadingEl.style.display = show ? 'block' : 'none';
}

function normalizeItemNumber(str) {
    if (!str) return '';
    return String(str)
        .replace(/[\s\u200B-\u200D\uFEFF]/g, '')
        .toLowerCase();
}

// ============================================
// 5. FIREBASE QUERY
// ============================================

async function fetchItemData(itemNumber) {
    showLoading(true);
    resultCard.style.display = 'none';
    errorEl.style.display = 'none';
    
    try {
        const targetNormalized = normalizeItemNumber(itemNumber);
        
        console.log('🔍 Mencari item:', itemNumber);
        
        const snapshot = await db.ref('data_stok').once('value');
        const data = snapshot.val();
        
        if (!data) {
            showError(`Item "${itemNumber}" tidak ditemukan!`);
            showLoading(false);
            return;
        }
        
        const allItems = Object.keys(data).map(key => ({
            id: key,
            ...data[key]
        }));
        
        console.log('📊 Total data di DB:', allItems.length);
        
        const items = allItems.filter(item => 
            normalizeItemNumber(item.itemnumber) === targetNormalized
        );
        
        console.log('🎯 Item ditemukan:', items.length);
        
        if (items.length === 0) {
            showError(`Item "${itemNumber}" tidak ditemukan!`);
            showLoading(false);
            return;
        }
        
        const validItems = items.filter(item => item.tanggal);
        
        if (validItems.length === 0) {
            showError(`Data untuk item "${itemNumber}" tidak memiliki tanggal!`);
            showLoading(false);
            return;
        }
        
        // SORT DESCENDING (terbaru di atas)
        validItems.sort((a, b) => {
            const dateA = parseDateCustom(a.tanggal);
            const dateB = parseDateCustom(b.tanggal);
            return dateB - dateA;
        });
        
        console.log('📅 Data setelah sorting (terbaru di atas):', 
            validItems.map(i => `${i.tanggal} (${i.batch})`));
        
        const last30 = validItems.slice(0, 30);
        const latest = last30[0];
        
        console.log('✅ Data terbaru:', latest.tanggal, '-', latest.batch);
        
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
    
    const tanggalLabel = document.querySelector('.tanggal-label');
    if (tanggalLabel) {
        tanggalLabel.innerHTML = `📅 Tanggal Update <span style="background: #2563eb; color: white; padding: 2px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; margin-left: 8px;">TERBARU</span>`;
    }
}

function displayHistory(items) {
    if (!items || items.length === 0) {
        historyContent.innerHTML = '<p class="empty-state">Tidak ada data history</p>';
        return;
    }
    
    let html = `
        <div class="history-table-wrapper">
            <table class="history-table">
                <thead>
                    <tr>
                        <th>Tanggal</th>
                        <th>Batch</th>
                        <th>Stok</th>
                        <th style="text-align: center;">Status</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    items.forEach((item, index) => {
        const stok = item.stok ? item.stok + ' kg' : '-';
        const badge = index === 0 ? 
            '<span style="background: #2563eb; color: white; padding: 2px 10px; border-radius: 12px; font-size: 11px; font-weight: 600;">TERBARU</span>' : 
            '-';
        
        html += `
            <tr ${index === 0 ? 'style="background: #eff6ff;"' : ''}>
                <td style="text-wrap: nowrap;"><strong>${item.tanggal || '-'}</strong></td>
                <td>${item.batch || '-'}</td>
                <td>${stok}</td>
                <td style="text-align: center;">${badge}</td>
            </tr>
        `;
    });
    
    html += `
                </tbody>
            </table>
        </div>
    `;
    
    const totalData = items.length;
    const firstDate = items[0]?.tanggal || '-';
    const lastDate = items[items.length - 1]?.tanggal || '-';
    
    const infoText = totalData === 30 ? 
        `Menampilkan 30 data terakhir (${firstDate} s/d ${lastDate})` : 
        `Menampilkan ${totalData} data (${firstDate} s/d ${lastDate})`;
    
    html += `<p style="margin-top: 12px; font-size: 12px; color: #6b7a8f; text-align: center;">📊 ${infoText}</p>`;
    
    historyContent.innerHTML = html;
}

// ============================================
// 7. QR SCANNER FUNCTIONS
// ============================================

async function startScanner() {
    try {
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
    console.log('📌 HASIL SCAN:', decodedText);
    
    const itemNumber = decodedText.trim();
    
    if (itemNumber) {
        stopScanner();
        fetchItemData(itemNumber);
    } else {
        showError('QR Code tidak valid!');
    }
}

function onScanError(err) {
    // ignore
}

// ============================================
// 8. EVENT LISTENERS
// ============================================

startBtn.addEventListener('click', startScanner);
stopBtn.addEventListener('click', stopScanner);

window.addEventListener('beforeunload', async () => {
    if (html5QrCode) {
        try {
            await html5QrCode.stop();
        } catch (e) {}
    }
});

console.log('✅ Aplikasi Scan QR Inventory siap!');
console.log('📌 Format tanggal: YYYY-MM-DD (contoh: 2026-07-01)');
