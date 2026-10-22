CREATE TABLE organizations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  org_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin','agent','customer') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (org_id) REFERENCES organizations(id)
);

CREATE TABLE tickets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  org_id INT NOT NULL,
  requester_id INT NOT NULL,
  assignee_id INT NULL,
  subject VARCHAR(200) NOT NULL,
  body TEXT NOT NULL,
  status ENUM('open','pending','resolved','closed') DEFAULT 'open',
  priority ENUM('low','medium','high','urgent') NULL,
  category VARCHAR(80) NULL,
  triage_status ENUM('pending', 'queued', 'completed', 'failed', 'skipped')
  NOT NULL DEFAULT 'pending',
  sla_due_at DATETIME NULL,
  first_response_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_org_status (org_id, status),
  INDEX idx_triage_recovery (triage_status, id),
  FOREIGN KEY (org_id) REFERENCES organizations(id),
  FOREIGN KEY (requester_id) REFERENCES users(id),
  FOREIGN KEY (assignee_id) REFERENCES users(id)
);

CREATE TABLE ticket_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ticket_id INT NOT NULL,
  author_id INT NOT NULL,
  body TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ticket_id) REFERENCES tickets(id),
  FOREIGN KEY (author_id) REFERENCES users(id)
);

CREATE TABLE kb_articles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  org_id INT NOT NULL,
  title VARCHAR(200) NOT NULL,
  content MEDIUMTEXT NOT NULL,
  status ENUM('draft','published') DEFAULT 'draft',
  embedded_at DATETIME NULL,
  UNIQUE KEY uq_kb_articles_org_id_id (org_id, id),
  FOREIGN KEY (org_id) REFERENCES organizations(id)
);

CREATE TABLE ai_suggestions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ticket_id INT NOT NULL,
  type ENUM('triage','reply_draft','summary') NOT NULL,
  source VARCHAR(40) NOT NULL,
  payload JSON NOT NULL,
  confidence DECIMAL(4,3) NULL,
  accepted BOOLEAN NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ticket_id) REFERENCES tickets(id)
);

CREATE TABLE kb_article_chunks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  org_id INT NOT NULL,
  article_id INT NOT NULL,
  chunk_index INT NOT NULL,
  chunk_text TEXT NOT NULL,
  embedding JSON NOT NULL,
  embedding_model VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_kb_article_chunk (org_id, article_id, chunk_index),
  KEY idx_kb_chunks_org_article (org_id, article_id),
  CONSTRAINT fk_kb_chunks_article_org
    FOREIGN KEY (org_id, article_id)
    REFERENCES kb_articles (org_id, id)
);
