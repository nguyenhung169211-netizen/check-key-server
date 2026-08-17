const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

const db = new Database('./keys.db');

// 1. Khởi tạo bảng dữ liệu hỗ trợ loại Key và ngày hết hạn
db.exec(`CREATE TABLE IF NOT EXISTS keys (
    key_code TEXT PRIMARY KEY,
    hardware_id TEXT DEFAULT '',
    status TEXT DEFAULT 'ACTIVE',
    type TEXT DEFAULT 'PERMANENT',
    expire_at DATETIME DEFAULT NULL
)`);

// 2. Hàm sinh Key ngẫu nhiên (XXXX-XXXX-XXXX-XXXX)
function generateRandomKey(prefix = '') {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let key = '';
    for (let i = 0; i < 16; i++) {
        if (i > 0 && i % 4 === 0) key += '-';
        key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return prefix ? `${prefix}-${key}` : key;
}

// 3. Tự động nạp 100 Key Vĩnh Viễn & 100 Key 1 Tháng nếu DB trống
const count = db.prepare("SELECT COUNT(*) as total FROM keys").get().total;
if (count === 0) {
    const insertStmt = db.prepare("INSERT OR IGNORE INTO keys (key_code, type, status) VALUES (?, ?, 'ACTIVE')");
    
    // Tạo 100 Key Vĩnh viễn
    for (let i = 0; i < 100; i++) {
        insertStmt.run(generateRandomKey(), 'PERMANENT');
    }
    
    // Tạo 100 Key 1 tháng (tiền tố M1TH)
    for (let i = 0; i < 100; i++) {
        insertStmt.run(generateRandomKey('M1TH'), '1MONTH');
    }
    console.log(">>> Đã khởi tạo thành công 100 Key Vĩnh Viễn và 100 Key 1 Tháng!");
}

// 4. API Kiểm Tra & Kích Hoạt Key (Gọi từ Kodular)
app.post('/verify-key', (req, res) => {
    const { key_code, hardware_id } = req.body || {};

    if (!key_code) {
        return res.json({ success: false, message: 'Vui lòng nhập Key!' });
    }

    try {
        const cleanKey = key_code.trim();
        const row = db.prepare('SELECT * FROM keys WHERE key_code = ?').get(cleanKey);

        if (!row) {
            return res.json({ success: false, message: 'Key không tồn tại trên hệ thống!' });
        }

        if (row.status !== 'ACTIVE') {
            return res.json({ success: false, message: 'Key này đã bị khóa!' });
        }

        const now = new Date();

        // Kiềm tra hạn sử dụng đối với Key 1 tháng
        if (row.type === '1MONTH' && row.expire_at) {
            const expireDate = new Date(row.expire_at);
            if (now > expireDate) {
                // Cập nhật trạng thái sang EXPIRED nếu đã hết hạn
                db.prepare("UPDATE keys SET status = 'EXPIRED' WHERE key_code = ?").run(cleanKey);
                return res.json({ success: false, message: 'Key 1 tháng của bạn đã HẾT HẠN sử dụng!' });
            }
        }

        // LẦN ĐẦU KÍCH HOẠT: Khóa Hardware ID & Tính ngày hết hạn (nếu là Key 1 tháng)
        if (!row.hardware_id || row.hardware_id === '') {
            let expireDateStr = null;

            if (row.type === '1MONTH') {
                const expireDate = new Date();
                expireDate.setDate(expireDate.getDate() + 30); // Cộng đúng 30 ngày
                expireDateStr = expireDate.toISOString();
            }

            db.prepare('UPDATE keys SET hardware_id = ?, expire_at = ? WHERE key_code = ?')
              .run(hardware_id || 'DEFAULT_ID', expireDateStr, cleanKey);

            const msg = row.type === 'PERMANENT' 
                ? 'Kích hoạt thành công Key VĨNH VIỄN!' 
                : 'Kích hoạt thành công Key 1 THÁNG (Tính 30 ngày từ hôm nay)!';

            return res.json({ success: true, message: msg });
        }

        // CÁC LẦN ĐĂNG NHẬP SAU: Kiểm tra đúng thiết bị
        if (row.hardware_id === hardware_id) {
            return res.json({ success: true, message: 'Đăng nhập thành công!' });
        } else {
            return res.json({ success: false, message: 'Key đã được kích hoạt trên thiết bị khác!' });
        }

    } catch (err) {
        return res.json({ success: false, message: 'Lỗi xử lý máy chủ!' });
    }
});

// 5. Trang Admin kiểm tra tình trạng danh sách Key
app.get('/admin-keys', (req, res) => {
    const keys = db.prepare("SELECT key_code, type, status, hardware_id, expire_at FROM keys").all();
    res.json({ total: keys.length, keys: keys });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
