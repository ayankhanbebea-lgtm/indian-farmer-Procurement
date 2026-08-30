-- Smart Procurement Platform schema (SQLite via node:sqlite for this prototype).
-- Written to be straightforward to port to Postgres/Supabase later:
-- TEXT ids (cuid-style), explicit FKs, indexes, timestamps.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  phone TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  role TEXT NOT NULL CHECK (role IN ('FARMER','STAFF','ADMIN')),
  name TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'en',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS farmer_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT UNIQUE NOT NULL REFERENCES users(id),
  address TEXT,
  district TEXT,
  state TEXT NOT NULL DEFAULT 'Rajasthan',
  farmer_code TEXT UNIQUE,
  language TEXT NOT NULL DEFAULT 'en',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS otps (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  otp_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_otps_phone_created ON otps(phone, created_at);

CREATE TABLE IF NOT EXISTS procurement_centres (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  district TEXT NOT NULL,
  latitude REAL,
  longitude REAL,
  distance_km REAL DEFAULT 10,
  daily_capacity INTEGER NOT NULL DEFAULT 120,
  avg_service_time_mins INTEGER NOT NULL DEFAULT 5,
  high_load_threshold INTEGER NOT NULL DEFAULT 50,
  open_time TEXT NOT NULL DEFAULT '09:00',
  close_time TEXT NOT NULL DEFAULT '17:00',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  active INTEGER NOT NULL DEFAULT 1,
  location TEXT
);

CREATE TABLE IF NOT EXISTS centre_staff (
  id TEXT PRIMARY KEY,
  user_id TEXT UNIQUE NOT NULL REFERENCES users(id),
  centre_id TEXT NOT NULL REFERENCES procurement_centres(id)
);

CREATE TABLE IF NOT EXISTS crops (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  code TEXT UNIQUE NOT NULL,
  msp_rate REAL NOT NULL DEFAULT 2275
);

CREATE TABLE IF NOT EXISTS slots (
  id TEXT PRIMARY KEY,
  centre_id TEXT NOT NULL REFERENCES procurement_centres(id),
  date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 30,
  UNIQUE(centre_id, date, start_time)
);

CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  farmer_id TEXT NOT NULL REFERENCES farmer_profiles(id),
  centre_id TEXT NOT NULL REFERENCES procurement_centres(id),
  crop_id TEXT NOT NULL REFERENCES crops(id),
  slot_id TEXT NOT NULL REFERENCES slots(id),
  quantity_quintal REAL NOT NULL,
  token TEXT UNIQUE NOT NULL,
  token_seq INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'BOOKED' CHECK (status IN (
    'BOOKED','ARRIVED','VERIFIED','WEIGHING','PROCUREMENT_IN_PROGRESS',
    'PROCUREMENT_COMPLETED','PAYMENT_PROCESSING','PAYMENT_COMPLETED','CANCELLED','NO_SHOW'
  )),
  actual_quantity REAL,
  quality_grade TEXT,
  remarks TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_bookings_centre_status ON bookings(centre_id, status);

CREATE TABLE IF NOT EXISTS queue_entries (
  id TEXT PRIMARY KEY,
  booking_id TEXT UNIQUE NOT NULL REFERENCES bookings(id),
  centre_id TEXT NOT NULL REFERENCES procurement_centres(id),
  date TEXT NOT NULL,
  position INTEGER NOT NULL,
  called_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_queue_centre_date ON queue_entries(centre_id, date);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  booking_id TEXT UNIQUE NOT NULL REFERENCES bookings(id),
  token_number TEXT,
  farmer_id TEXT NOT NULL REFERENCES farmer_profiles(id),
  farmer_name TEXT NOT NULL,
  procurement_centre_id TEXT NOT NULL REFERENCES procurement_centres(id),
  crop TEXT NOT NULL,
  final_quantity REAL NOT NULL,
  quantity_unit TEXT NOT NULL DEFAULT 'Quintal',
  rate_per_unit REAL NOT NULL,
  deductions REAL NOT NULL DEFAULT 0,
  final_payable_amount REAL NOT NULL,
  total_amount REAL NOT NULL,
  amount REAL,
  account_holder_name TEXT,
  bank_name TEXT,
  account_number TEXT,
  ifsc_code TEXT,
  upi_id TEXT,
  payment_status TEXT NOT NULL DEFAULT 'BANK_DETAILS_REQUIRED' CHECK (payment_status IN ('BANK_DETAILS_REQUIRED','BANK_DETAILS_SUBMITTED','PENDING','PROCESSING','PAID','FAILED','ON_HOLD')),
  status TEXT DEFAULT 'PENDING',
  payment_method TEXT,
  bank_account_last4 TEXT,
  transaction_reference TEXT,
  transaction_id TEXT,
  reference_no TEXT,
  failure_reason TEXT,
  hold_reason TEXT,
  submitted_at TEXT,
  processed_at TEXT,
  initiated_at TEXT,
  paid_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_payments_farmer_id ON payments(farmer_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(payment_status);
CREATE INDEX IF NOT EXISTS idx_payments_centre ON payments(procurement_centre_id);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  booking_id TEXT REFERENCES bookings(id),
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_active_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

