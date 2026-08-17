const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Khởi tạo SQLite
const db = new Database('./keys.db');

// Tạo bảng lưu Key
db.exec(`CREATE TABLE IF NOT EXISTS keys (
    key_code TEXT PRIMARY KEY,
    hardware_id TEXT DEFAULT '',
    status TEXT DEFAULT 'ACTIVE'
)`);

// API Kiểm tra Key
app.post('/verify-key', (req, res) => {
    const { key_code, hardware_id } = req.body;

    if (!key_code || !hardware_id) {
        return res.json({ success: false, message: 'Vui lòng nhập Key và Hardware ID!' });
    }

    try {
        const row = db.prepare('SELECT * FROM keys WHERE key_code = ?').get(key_code);

        if (!row) {
            return res.json({ success: false, message: 'Key không tồn tại!' });
        }

        if (row.status !== 'ACTIVE') {
            return res.json({ success: false, message: 'Key đã bị khóa!' });
        }

        if (!row.hardware_id || row.hardware_id === '') {
            db.prepare('UPDATE keys SET hardware_id = ? WHERE key_code = ?').run(hardware_id, key_code);
            return res.json({ success: true, message: 'Kích hoạt thành công!' });
        }

        if (row.hardware_id === hardware_id) {
            return res.json({ success: true, message: 'Đăng nhập thành công!' });
        } else {
            return res.json({ success: false, message: 'Key đã dùng cho máy khác!' });
        }
    } catch (err) {
        return res.json({ success: false, message: 'Lỗi Server!' });
    }
});

// Port cho Render
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`>>> Server Đang Chạy Tại Port ${PORT}`);
});
