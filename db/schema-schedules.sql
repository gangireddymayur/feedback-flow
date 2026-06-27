-- ============================================================
--  ReviewOS — Schedule feature delta
--  Run this in phpMyAdmin → SQL  (uncheck "Enable FK checks" off)
-- ============================================================

SET NAMES utf8mb4;

DROP TABLE IF EXISTS device_schedules;

CREATE TABLE device_schedules (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  owner_id        INT NULL,
  device_id       INT NOT NULL,
  template_id     INT NOT NULL,
  -- HH:MM:SS — 15-min granularity enforced in app code
  start_time      TIME NOT NULL,
  end_time        TIME NOT NULL,
  -- 'once' | 'every_day' | 'weekdays' | 'n_days'
  repeat_mode     ENUM('once','every_day','weekdays','n_days') NOT NULL DEFAULT 'once',
  -- anchor date (the day the user clicked when creating)
  start_date      DATE NOT NULL,
  -- JSON array of weekday integers 0=Sun..6=Sat (for repeat_mode='weekdays')
  weekdays        JSON NULL,
  -- N days inclusive starting at start_date (for repeat_mode='n_days')
  days_count      INT NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_sched_device (device_id),
  INDEX idx_sched_owner  (owner_id),
  CONSTRAINT fk_sched_owner    FOREIGN KEY (owner_id)    REFERENCES users(id)     ON DELETE CASCADE,
  CONSTRAINT fk_sched_device   FOREIGN KEY (device_id)   REFERENCES devices(id)   ON DELETE CASCADE,
  CONSTRAINT fk_sched_template FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
