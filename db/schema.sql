-- ============================================================
--  ReviewOS — MariaDB schema + seed
--  Import via Plesk → Databases → phpMyAdmin → Import
-- ============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS responses;
DROP TABLE IF EXISTS device_pairing_codes;
DROP TABLE IF EXISTS devices;
DROP TABLE IF EXISTS templates;
DROP TABLE IF EXISTS users;

-- ---------------- users (admins) ----------------
CREATE TABLE users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(255) NOT NULL,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('super','sub') NOT NULL DEFAULT 'sub',
  status        ENUM('active','disabled') NOT NULL DEFAULT 'active',
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------- templates ----------------
CREATE TABLE templates (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  owner_id    INT NULL,
  name        VARCHAR(255) NOT NULL,
  description TEXT,
  category    VARCHAR(64) DEFAULT 'General',
  status      ENUM('active','inactive','draft') NOT NULL DEFAULT 'draft',
  questions   JSON NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_templates_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------- devices ----------------
CREATE TABLE devices (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  owner_id        INT NULL,
  name            VARCHAR(255) NOT NULL,
  location        VARCHAR(255),
  status          ENUM('online','offline','syncing') NOT NULL DEFAULT 'offline',
  android_version VARCHAR(64),
  last_sync       DATETIME NULL,
  template_id     INT NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_devices_owner    FOREIGN KEY (owner_id)    REFERENCES users(id)     ON DELETE SET NULL,
  CONSTRAINT fk_devices_template FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------- device pairing codes ----------------
CREATE TABLE device_pairing_codes (
  code       CHAR(6) PRIMARY KEY,
  owner_id   INT NULL,
  device_id  INT NULL,
  expires_at DATETIME NOT NULL,
  used_at    DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_pair_expires (expires_at),
  CONSTRAINT fk_pair_user   FOREIGN KEY (owner_id)  REFERENCES users(id)   ON DELETE CASCADE,
  CONSTRAINT fk_pair_device FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------- responses ----------------
CREATE TABLE responses (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  template_id      INT NULL,
  device_id        INT NULL,
  rating           TINYINT NULL,
  answers          JSON,
  duration_seconds INT DEFAULT 0,
  submitted_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_responses_submitted (submitted_at),
  CONSTRAINT fk_resp_template FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE SET NULL,
  CONSTRAINT fk_resp_device   FOREIGN KEY (device_id)   REFERENCES devices(id)   ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
--  SEED
--  Super admin: admin@reviewos.app  /  password: 1m2a3y4u5r
--  (bcrypt hash below, cost 10)
-- ============================================================
INSERT INTO users (name, email, password_hash, role, status) VALUES
  ('Therese',  'admin@reviewos.app', '$2b$10$alt8uoHymwrSMN4fPJFw0uUFGeKLIpAm9L3B8PCOn1Li8YXj2Dzeu', 'super', 'active');

-- A couple of demo sub-admins (password for all demo subs: ChangeMe!2026)
INSERT INTO users (name, email, password_hash, role, status) VALUES
  ('Aisha Khan',  'aisha@brand.co',         '$2b$10$kZI0O2y9tQWaLQdzwk.iNuISlHrHdMlTxIaCwEa6RFbA6rZROsdgq', 'sub', 'active'),
  ('Marco Rossi', 'marco@hotelnorth.com',   '$2b$10$kZI0O2y9tQWaLQdzwk.iNuISlHrHdMlTxIaCwEa6RFbA6rZROsdgq', 'sub', 'active'),
  ('Priya Shah',  'priya@retailgroup.in',   '$2b$10$kZI0O2y9tQWaLQdzwk.iNuISlHrHdMlTxIaCwEa6RFbA6rZROsdgq', 'sub', 'active');

-- Demo templates owned by Aisha (user id 2)
INSERT INTO templates (owner_id, name, description, category, status, questions) VALUES
  (2, 'Restaurant Feedback', 'Post-meal customer experience', 'F&B',         'active',
    JSON_ARRAY(
      JSON_OBJECT('id','q1','type','rating','label','How was your meal?','required',true),
      JSON_OBJECT('id','q2','type','long_text','label','Any comments?','required',false)
    )),
  (2, 'Retail Store Visit',  'Quick 3-tap rating',           'Retail',      'active',
    JSON_ARRAY(
      JSON_OBJECT('id','q1','type','emoji','label','How was your visit?','required',true)
    )),
  (3, 'Hotel Check-out Survey','Stay satisfaction & NPS',    'Hospitality', 'active',
    JSON_ARRAY(
      JSON_OBJECT('id','q1','type','nps','label','Would you recommend us?','required',true),
      JSON_OBJECT('id','q2','type','long_text','label','Tell us more','required',false)
    ));

-- Demo devices
INSERT INTO devices (owner_id, name, location, status, android_version, last_sync, template_id) VALUES
  (2, 'Device — Lobby',     'Downtown Branch', 'online',  'Android 13', NOW(), 1),
  (2, 'Device — Entrance',  'Mall Outlet',     'online',  'Android 12', NOW(), 2),
  (3, 'Device — Reception', 'Hotel North',     'syncing', 'Android 14', NOW(), 3),
  (2, 'Device — Counter',   'Cafe Central',    'online',  'Android 13', NOW(), 2);

-- A few demo responses
INSERT INTO responses (template_id, device_id, rating, answers, duration_seconds, submitted_at) VALUES
  (1, 1, 5, JSON_OBJECT('comment','Amazing service, fast and friendly.'), 42, NOW() - INTERVAL 2  MINUTE),
  (2, 2, 4, JSON_OBJECT(),                                                18, NOW() - INTERVAL 5  MINUTE),
  (3, 3, 2, JSON_OBJECT('comment','Room was not ready on time.'),         84, NOW() - INTERVAL 9  MINUTE),
  (1, 4, 5, JSON_OBJECT(),                                                51, NOW() - INTERVAL 12 MINUTE),
  (2, 4, 3, JSON_OBJECT(),                                                22, NOW() - INTERVAL 18 MINUTE);
