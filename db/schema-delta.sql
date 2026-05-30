-- ============================================================
--  ReviewOS — schema delta (add-on)
--
--  Run this AFTER db/schema.sql is already imported.
--  Safe to re-run: uses IF NOT EXISTS / INSERT IGNORE.
--
--  Adds tables needed by the new UI:
--    • user_profiles        — organization + timezone (Settings page)
--    • notification_prefs   — per-user notification toggles (Settings page)
--    • device_pairing_codes — 6-digit pair flow (Devices page)
-- ============================================================

SET NAMES utf8mb4;

-- ---------------- user profiles ----------------
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id      INT PRIMARY KEY,
  organization VARCHAR(255) NULL,
  timezone     VARCHAR(64)  NULL DEFAULT 'UTC',
  avatar_url   VARCHAR(512) NULL,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_profile_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------- notification preferences ----------------
-- One row per (user, key) so we can add new toggles without migrations.
CREATE TABLE IF NOT EXISTS notification_prefs (
  user_id    INT NOT NULL,
  pref_key   VARCHAR(64)  NOT NULL,
  enabled    TINYINT(1)   NOT NULL DEFAULT 1,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, pref_key),
  CONSTRAINT fk_pref_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed default toggles for the super admin (id=1). Safe to skip if not present.
INSERT IGNORE INTO notification_prefs (user_id, pref_key, enabled) VALUES
  (1, 'new_sub_admin',  1),
  (1, 'sub_disabled',   1),
  (1, 'weekly_summary', 1),
  (1, 'billing',        1),
  (1, 'security',       1);

-- ---------------- device pairing codes ----------------
CREATE TABLE IF NOT EXISTS device_pairing_codes (
  code       CHAR(6)  PRIMARY KEY,
  owner_id   INT      NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at    DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pair_user FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE INDEX IF NOT EXISTS idx_pair_expires ON device_pairing_codes(expires_at);

