-- TapTrack database schema (MySQL)
CREATE DATABASE IF NOT EXISTS attendance_system;
USE attendance_system;

CREATE TABLE IF NOT EXISTS students (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  rollNo VARCHAR(30) NOT NULL,
  department VARCHAR(50) NOT NULL,
  email VARCHAR(100) NOT NULL,          -- parent's email for alerts
  uid VARCHAR(50) NOT NULL UNIQUE       -- RFID card UID
);

CREATE TABLE IF NOT EXISTS attendance (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  timestamp DATETIME NOT NULL,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  INDEX idx_student_time (student_id, timestamp)
);

CREATE TABLE IF NOT EXISTS admin (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL        -- bcrypt hash (generate with hashpassword.js)
);
