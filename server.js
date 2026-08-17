const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

const db = new Database('./keys.db');

// 1. Khởi tạo bảng dữ liệu
db.exec(`CREATE TABLE IF NOT EXISTS keys (
    key_code TEXT PRIMARY KEY,
    hardware_id TEXT DEFAULT '',
    status TEXT DEFAULT 'ACTIVE',
    type TEXT DEFAULT 'PERMANENT',
    expire_at DATETIME DEFAULT NULL
)`);

// 2. Hàm sinh Key ngẫu nhiên
function generateRandomKey(prefix = '') {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let key = '';
    for (let i = 0; i < 16; i++) {
        if (i > 0 && i % 4 === 0) key += '-';
        key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return prefix ? `${prefix}-${key}` : key;
}

// 3. Tự động khởi tạo 100 Key Vĩnh viễn & 100 Key 1 tháng nếu Database trống
const count = db.prepare("SELECT COUNT(*) as total FROM keys").get().total;
if (count === 0) {
    const insertStmt = db.prepare("INSERT OR IGNORE INTO keys (key_code, type, status) VALUES (?, ?, 'ACTIVE')");
    
    // 100 Key Vĩnh viễn
    for (let i = 0; i < 100; i++) {
        insertStmt.run(generateRandomKey(), 'PERMANENT');
    }
    
    // 100 Key 1 tháng
    for (let i = 0; i < 100; i++) {
        insertStmt.run(generateRandomKey('M1TH'), '1MONTH');
    }
    console.log(">>> Đã khởi tạo danh sách 200 Key thành công!");
}

// 4. API Kiểm Tra Key
app.post('/verify-key', (req, res) => {
    const { key_code, hardware_id } = req.body || {};

    if (!key_code) {
        return res.json({ success: false, message: 'KEY ĐÃ NHẬP SAI' });
    }

    try {
        const cleanKey = key_code.trim();
        const row = db.prepare('SELECT * FROM keys WHERE key_code = ?').get(cleanKey);

        // Trường hợp 1: Viết sai Key hoặc Key không tồn tại
        if (!row) {
            return res.json({ success: false, message: 'KEY ĐÃ NHẬP SAI' });
        }

        // Trường hợp 2: Key đã bị khóa thủ công
        if (row.status !== 'ACTIVE') {
            return res.json({ success: false, message: 'KEY ĐÃ HẾT HẠN' });
        }

        const now = new Date();

        // Trường hợp 3: Key 1 tháng đã hết hạn 30 ngày
        if (row.type === '1MONTH' && row.expire_at) {
            const expireDate = new Date(row.expire_at);
            if (now > expireDate) {
                db.prepare("UPDATE keys SET status = 'EXPIRED' WHERE key_code = ?").run(cleanKey);
                return res.json({ success: false, message: 'KEY ĐÃ HẾT HẠN' });
            }
        }

        // Trường hợp 4: Lần đầu tiên kích hoạt Key trên thiết bị
        if (!row.hardware_id || row.hardware_id === '') {
            let expireDateStr = null;
            if (row.type === '1MONTH') {
                const expireDate = new Date();
                expireDate.setDate(expireDate.getDate() + 30); // Tự động tính đúng 30 ngày
                expireDateStr = expireDate.toISOString();
            }

            db.prepare('UPDATE keys SET hardware_id = ?, expire_at = ? WHERE key_code = ?')
              .run(hardware_id || 'DEFAULT_ID', expireDateStr, cleanKey);

            return res.json({ success: true, message: 'ĐÃ NHẬP KEY THÀNH CÔNG' });
        }

        // Trường hợp 5: Kiểm tra đúng máy đã kích hoạt hay bị Share sang máy khác
        if (row.hardware_id === hardware_id) {
            return res.json({ success: true, message: 'ĐÃ NHẬP KEY THÀNH CÔNG' });
        } else {
            return res.json({ success: false, message: 'KEY ĐÃ NHẬP SAI' });
        }

    } catch (err) {
        return res.json({ success: false, message: 'KEY ĐÃ NHẬP SAI' });
    }
});

// 5. Trang Admin kiểm tra danh sách Key
app.get('/admin-keys', (req, res) => {
    const keys = db.prepare("SELECT key_code, type, status, hardware_id, expire_at FROM keys").all();
    res.json({ total: keys.length, keys: keys });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
