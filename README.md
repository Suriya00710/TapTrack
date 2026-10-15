# TapTrack: RFID-Based Smart Attendance System

TapTrack automates attendance with RFID cards. A student taps their card on a reader connected to an **ESP32**, which sends the card's UID to a **Node.js / Express** backend. The server records the attendance in **MySQL**, blocks duplicate scans on the same day, and **emails the parent automatically**. Admins log in to a web dashboard to register students and view attendance records.

## Features

- RFID card scan → attendance recorded in real time
- Once-per-day duplicate-scan prevention
- Automatic email alert to parents (Nodemailer)
- Admin login with **bcrypt**-hashed passwords and **JWT** tokens
- Student registration with unique card UIDs
- Attendance records with date filtering
- Parameterised SQL queries (protection against SQL injection)
- WebSocket server that broadcasts each new attendance event

## Tech Stack

| Layer | Technology |
|---|---|
| Hardware | ESP32, RFID reader, buzzer |
| Backend | Node.js, Express.js, WebSocket (`ws`) |
| Database | MySQL (`mysql2`) |
| Auth | bcrypt, JSON Web Tokens |
| Email | Nodemailer (Gmail) |
| Frontend | HTML, Tailwind CSS, GSAP |

## How it works

```
[RFID card] → [ESP32] --HTTP POST {uid}--> [Express API] → [MySQL]
                                                 ├─→ Email to parent
                                                 └─→ WebSocket broadcast
[Admin browser] ←→ [Dashboard pages] ←→ [Express API]
```

## API

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/markAttendance` | Body `{ "uid": "..." }`. Called by the ESP32 on each scan |
| POST | `/api/registerStudent` | Body `{ name, rollNo, department, email, uid }` |
| GET | `/api/attendanceRecords` | All attendance records, newest first |
| POST | `/api/login` | Body `{ username, password }`. Returns a JWT |

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```
2. **Create the database**
   ```bash
   mysql -u root -p < database/schema.sql
   ```
3. **Configure environment variables**: copy `.env.example` to `.env` and fill in your MySQL credentials, a JWT secret, and a Gmail address with a [Gmail App Password](https://myaccount.google.com/apppasswords).
4. **Create an admin user**: put your chosen password in `hashpassword.js`, run `npm run hash-password`, then insert the printed hash:
   ```sql
   INSERT INTO admin (username, password) VALUES ('admin', '<bcrypt-hash>');
   ```
5. **Start the server**
   ```bash
   npm start
   ```
   Open `http://localhost:3000` to reach the admin login.

6. **ESP32**: point the firmware's HTTP request at `http://<server-ip>:3000/api/markAttendance` with JSON `{"uid": "<card UID>"}`.

## Roadmap

- JWT-verification middleware on all admin API routes
- Live dashboard updates using the existing WebSocket server
- Server-side date filtering
- Offline buffering of scans on the ESP32

## Author

**Suriya K**, B.E. Electronics and Communication Engineering, Velammal Engineering College
