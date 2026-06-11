import express from 'express';
import pg from 'pg';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

// สร้างตัวแปรพาธสำหรับ ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;
const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// สร้างตารางเก็บข้อมูลแอปอัตโนมัติ (ถ้ายังไม่มี)
pool.query(`CREATE TABLE IF NOT EXISTS "AppData" (id INT PRIMARY KEY, data JSONB)`);

// Endpoint ดึงและรับข้อมูล API
app.get('/api/sync', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT data FROM "AppData" WHERE id = 1');
    res.json(rows[0] ? rows[0].data : {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/sync', async (req, res) => {
  try {
    const jsonData = req.body;
    await pool.query(
      `INSERT INTO "AppData" (id, data) VALUES (1, $1) 
       ON CONFLICT (id) DO UPDATE SET data = $1`,
      [jsonData]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==== ส่วนที่เพิ่มมาใหม่: เสิร์ฟหน้าเว็บ React จาก Backend เลย ====
app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});
// ==========================================================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));