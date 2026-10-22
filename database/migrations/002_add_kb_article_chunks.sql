-- SupportDesk AI Pro: store RAG chunks and Gemini embeddings in MySQL.
-- Apply only after verifying the target database and taking a database backup.

ALTER TABLE kb_articles
  ADD UNIQUE KEY uq_kb_articles_org_id_id (org_id, id);

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