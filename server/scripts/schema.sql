CREATE TABLE IF NOT EXISTS admins (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(120)  NOT NULL,
  email         VARCHAR(190)  NOT NULL UNIQUE,
  password_hash VARCHAR(255)  NOT NULL,
  role          ENUM('super','sub') NOT NULL DEFAULT 'sub',
  status        ENUM('active','disabled') NOT NULL DEFAULT 'active',
  created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS templates (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  owner_id    INT           NOT NULL,
  name        VARCHAR(200)  NOT NULL,
  description TEXT          NULL,
  category    VARCHAR(100)  NOT NULL DEFAULT 'General',
  status      ENUM('active','inactive','draft') NOT NULL DEFAULT 'draft',
  questions   JSON          NOT NULL,
  created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_templates_owner (owner_id),
  CONSTRAINT fk_templates_owner FOREIGN KEY (owner_id) REFERENCES admins(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS devices (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  owner_id         INT           NOT NULL,
  name             VARCHAR(120)  NOT NULL,
  location         VARCHAR(200)  NULL,
  status           ENUM('online','offline','syncing') NOT NULL DEFAULT 'offline',
  android_version  VARCHAR(40)   NULL,
  pairing_code     VARCHAR(12)   NULL,
  device_token     VARCHAR(64)   NULL UNIQUE,
  last_sync        TIMESTAMP     NULL,
  template_id      INT           NULL,
  responses_today  INT           NOT NULL DEFAULT 0,
  created_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_devices_owner (owner_id),
  CONSTRAINT fk_devices_owner    FOREIGN KEY (owner_id)    REFERENCES admins(id)    ON DELETE CASCADE,
  CONSTRAINT fk_devices_template FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS responses (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  template_id       INT           NOT NULL,
  device_id         INT           NOT NULL,
  rating            INT           NULL,
  duration_seconds  INT           NOT NULL DEFAULT 0,
  answers           JSON          NOT NULL,
  submitted_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_responses_template (template_id),
  KEY idx_responses_device   (device_id),
  KEY idx_responses_time     (submitted_at),
  CONSTRAINT fk_responses_template FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE,
  CONSTRAINT fk_responses_device   FOREIGN KEY (device_id)   REFERENCES devices(id)   ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
