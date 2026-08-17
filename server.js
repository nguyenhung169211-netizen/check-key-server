const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Sử dụng file db lưu trong RAM hoặc thư mục tạm
const db = new sqlite3.Database('./keys.db', (err) => {
    if (err) console.error('Lỗi kết nối SQLite:', err.message);
    else console.log('Kết nối SQLite thành công!');
});

// Tạo bảng lưu Key
db.run(`CREATE TABLE IF NOT EXISTS keys (
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

    db.get('SELECT * FROM keys WHERE key_code = ?', [key_code], (err, row) => {
        if (err) return res.json({ success: false, message: 'Lỗi Server!' });

        if (!row) {
            return res.json({ success: false, message: 'Key không tồn tại!' });
        }

        if (row.status !== 'ACTIVE') {
            return res.json({ success: false, message: 'Key đã bị khóa!' });
        }

        if (!row.hardware_id || row.hardware_id === '') {
            db.run('UPDATE keys SET hardware_id = ? WHERE key_code = ?', [hardware_id, key_code]);
            return res.json({ success: true, message: 'Kích hoạt thành công!' });
        }

        if (row.hardware_id === hardware_id) {
            return res.json({ success: true, message: 'Đăng nhập thành công!' });
        } else {
            return res.json({ success: false, message: 'Key đã dùng cho máy khác!' });
        }
    });
});

// Sửa cổng kết nối theo PORT của Render cấp
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`>>> Server Đang Chạy Tại Port ${PORT}`);
});
