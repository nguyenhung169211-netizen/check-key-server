const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Khoi tao Database SQLite
const db = new sqlite3.Database('./keys.db');

// Tao bang luu Key
db.run(`CREATE TABLE IF NOT EXISTS keys (
    key_code TEXT PRIMARY KEY,
    hardware_id TEXT DEFAULT '',
    status TEXT DEFAULT 'ACTIVE'
)`);

// API Kiem tra Key
app.post('/verify-key', (req, res) => {
    const { key_code, hardware_id } = req.body;

    if (!key_code || !hardware_id) {
        return res.json({ success: false, message: 'Vui long nhap Key va Hardware ID!' });
    }

    db.get('SELECT * FROM keys WHERE key_code = ?', [key_code], (err, row) => {
        if (err) return res.json({ success: false, message: 'Loi Server!' });

        if (!row) {
            return res.json({ success: false, message: 'Key khong ton tai!' });
        }

        if (row.status !== 'ACTIVE') {
            return res.json({ success: false, message: 'Key da bi khoia!' });
        }

        if (!row.hardware_id || row.hardware_id === '') {
            db.run('UPDATE keys SET hardware_id = ? WHERE key_code = ?', [hardware_id, key_code]);
            return res.json({ success: true, message: 'Kich hoat thanh cong!' });
        }

        if (row.hardware_id === hardware_id) {
            return res.json({ success: true, message: 'Dang nhap thanh cong!' });
        } else {
            return res.json({ success: false, message: 'Key da dung cho may khac!' });
        }
    });
});

app.listen(3000, () => {
    console.log('>>> Server Dang Chay Tai Port 3000');
});