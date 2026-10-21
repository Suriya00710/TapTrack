require("dotenv").config();
const express = require("express");
const mysql = require("mysql2/promise");
const bodyParser = require("body-parser");
const cors = require("cors");
const nodemailer = require("nodemailer");
const WebSocket = require("ws");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const path = require("path");

// All credentials come from environment variables (.env). Never hard-code them.
const REQUIRED_ENV = ["DB_USER", "DB_NAME", "JWT_SECRET", "EMAIL_USER", "EMAIL_PASSWORD"];
const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`❌ Missing environment variables: ${missing.join(", ")}. Copy .env.example to .env and fill them in.`);
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;
const WS_PORT = process.env.WS_PORT || 3001;
const SECRET_KEY = process.env.JWT_SECRET;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

// Database Connection
const db = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER,
  password: process.env.DB_PASS || "",
  database: process.env.DB_NAME,
});

db.getConnection()
  .then(() => console.log("✅ Connected to MySQL Database"))
  .catch((err) => {
    console.error("❌ Database connection failed:", err);
    process.exit(1);
  });

// Email Configuration (use a Gmail App Password, not your account password)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// WebSocket Server
const wss = new WebSocket.Server({ port: WS_PORT });
const broadcastAttendance = (attendanceData) => {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(attendanceData));
    }
  });
};

wss.on("connection", (ws) => {
  ws.send(JSON.stringify({ message: "Connected to WebSocket Server" }));
});

// Student Registration Route
app.post("/api/registerStudent", async (req, res) => {
  const { name, rollNo, department, email, uid } = req.body;
  if (!name || !rollNo || !department || !email || !uid) {
    return res.status(400).json({ error: "All fields are required" });
  }
  try {
    const [existing] = await db.query("SELECT * FROM students WHERE uid = ?", [uid]);
    if (existing.length > 0) {
      return res.status(400).json({ error: "UID is already registered to another student" });
    }
    await db.query("INSERT INTO students (name, rollNo, department, email, uid) VALUES (?, ?, ?, ?, ?)",
      [name, rollNo, department, email, uid]
    );
    res.json({ message: "✅ Student registered successfully!" });
  } catch (error) {
    res.status(500).json({ error: "Database error", details: error.message });
  }
});

// List registered students (used by the dashboard's "Registered students" count).
// Parent emails are left out on purpose: the dashboard doesn't need them.
app.get("/api/students", async (req, res) => {
  try {
    const [students] = await db.query(
      "SELECT id, name, rollNo, department, uid FROM students ORDER BY name"
    );
    res.json(students);
  } catch (error) {
    res.status(500).json({ error: "Database error", details: error.message });
  }
});

// Fetch Attendance Records
app.get("/api/attendanceRecords", async (req, res) => {
  try {
    const [records] = await db.query(
      `SELECT students.name, students.rollNo, students.department, attendance.timestamp
       FROM attendance
       JOIN students ON attendance.student_id = students.id
       ORDER BY attendance.timestamp DESC`
    );
    res.json(records);
  } catch (error) {
    res.status(500).json({ error: "Database error", details: error.message });
  }
});

// Mark Attendance (called by the ESP32 when a card is scanned)
app.post("/api/markAttendance", async (req, res) => {
  const { uid } = req.body;
  if (!uid) return res.status(400).json({ error: "UID is required" });
  try {
    const [students] = await db.query("SELECT * FROM students WHERE uid = ?", [uid]);
    if (students.length === 0) return res.status(404).json({ error: "Student Not Found" });
    const student = students[0];

    // Prevent duplicate attendance on the same day
    const [existing] = await db.query(
      "SELECT * FROM attendance WHERE student_id = ? AND DATE(timestamp) = CURDATE()",
      [student.id]
    );
    if (existing.length > 0) {
      return res.status(400).json({ error: "Attendance already marked today" });
    }

    // Insert new attendance record
    const timestamp = new Date();
    await db.query("INSERT INTO attendance (student_id, timestamp) VALUES (?, ?)", [student.id, timestamp]);

    // Send email notification to the parent
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: student.email,
      subject: "Attendance Marked",
      html: `<p>Dear Parent,</p>
             <p>Your child, <strong>${student.name}</strong>, has marked attendance at <strong>${timestamp.toLocaleString()}</strong>.</p>
             <p>Best Regards,<br>School Attendance System</p>`,
    });

    // Broadcast update to WebSocket clients
    broadcastAttendance({ name: student.name, rollNo: student.rollNo, department: student.department, timestamp });
    res.json({ message: "✅ Attendance Recorded & Email Sent" });
  } catch (error) {
    res.status(500).json({ error: "Database error", details: error.message });
  }
});

// Admin Login Route
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: "Username and password are required" });
  }
  try {
    const [admins] = await db.query("SELECT * FROM admin WHERE username = ?", [username]);
    if (admins.length === 0) return res.status(401).json({ message: "Invalid credentials" });

    const match = await bcrypt.compare(password, admins[0].password);
    if (!match) return res.status(401).json({ message: "Invalid credentials" });

    const token = jwt.sign({ username }, SECRET_KEY, { expiresIn: "1h" });
    res.json({ message: "Login successful", token });
  } catch (error) {
    res.status(500).json({ message: "Server error", details: error.message });
  }
});

// Start Server
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
