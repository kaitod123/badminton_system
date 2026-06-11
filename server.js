import express from 'express';
import pg from 'pg';
import cors from 'cors';

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

// Endpoint ดึงข้อมูล (โหลดไปโชว์ที่เครื่องผู้ใช้) - เส้นทางนี้คือที่ React เรียกหา!
app.get('/api/sync', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT data FROM "AppData" WHERE id = 1');
    res.json(rows[0] ? rows[0].data : {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint รับข้อมูล (เวลามีกดเพิ่มคน/ใส่คะแนน) - เส้นทางนี้คือที่ React เรียกหา!
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));