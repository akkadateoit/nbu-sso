-- 1. สร้างตารางเก็บรายชื่อแอปพลิเคชันย่อย
CREATE TABLE apps (
    id SERIAL PRIMARY KEY,
    app_name VARCHAR(100) NOT NULL UNIQUE,
    app_secret VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. สร้างตารางมาสเตอร์บทบาท/ตำแหน่งสิทธิ์ (แกนที่ 1)
CREATE TABLE roles (
    role_key VARCHAR(50) PRIMARY KEY,
    role_name VARCHAR(100) NOT NULL,
    description TEXT
);

-- 3. สร้างตารางมาสเตอร์โครงสร้างหน่วยงาน คณะ/สาขา (แกนที่ 2)
CREATE TABLE departments (
    id SERIAL PRIMARY KEY,
    dept_name VARCHAR(150) NOT NULL,
    dept_type VARCHAR(50) NOT NULL, -- เช่น 'FACULTY', 'BRANCH', 'OFFICE'
    parent_id INTEGER REFERENCES departments(id) ON DELETE SET NULL, -- Self-Join ทำโครงสร้างต้นไม้
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. สร้างตารางเก็บข้อมูลผู้ใช้/บุคลากรหลักที่ผ่าน Google SSO
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(150) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. ตารางศูนย์กลางจุดตัดสิทธิ์ 2 แกน (Many-to-Many Junction Table)
CREATE TABLE user_app_permissions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    app_id INTEGER NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
    role_key VARCHAR(50) NOT NULL REFERENCES roles(role_key) ON DELETE RESTRICT,
    scope_dept_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- ทำ Unique Constraint ป้องกันการผูกสิทธิ์ซ้ำซ้อนในแอปและหน่วยงานเดียวกัน
    CONSTRAINT unique_user_app_dept_permission UNIQUE (user_id, app_id, scope_dept_id)
);

-- สร้าง Index เพื่อความเร็วในการ Query ตรวจสอบสิทธิ์ยามที่แอปย่อยยิงมาถามบ่อยๆ
CREATE INDEX idx_permission_search ON user_app_permissions(user_id, app_id);

-- --- เพิ่มข้อมูลตั้งต้น (Mock Data) สำหรับการทดสอบระบบ ---
INSERT INTO roles (role_key, role_name, description) VALUES
('DEAN', 'คณบดี / ผู้อำนวยการสำนัก', 'สิทธิ์บริหารสูงสุดในระดับคณะหรือหน่วยงานใหญ่'),
('HEAD_OF_BRANCH', 'หัวหน้าสาขาวิชา / หัวหน้าฝ่าย', 'สิทธิ์บริหารเฉพาะสาขาหรือฝ่ายงานย่อย'),
('STAFF', 'เจ้าหน้าที่ปฏิบัติการ', 'สิทธิ์เจ้าหน้าที่ผู้ดูแลระบบงานเฉพาะส่วน'),
('USER', 'ผู้ใช้งานทั่วไป / อาจารย์ประจำ', 'สิทธิ์เข้าถึงพื้นฐานสำหรับผู้ส่งข้อมูล');