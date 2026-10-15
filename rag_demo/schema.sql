-- LOCAL ARTIFACT ONLY. Dedicated fft_rag_demo database; never production.
-- Run as the local bootstrap administrator. This file is not auto-executed.
CREATE EXTENSION IF NOT EXISTS vector;
CREATE SCHEMA rag_demo;
REVOKE ALL ON SCHEMA rag_demo FROM PUBLIC;
CREATE TABLE rag_demo.accounts (
    id uuid PRIMARY KEY,
    username varchar(32) UNIQUE NOT NULL,
    password_hash text NOT NULL
);
CREATE TABLE rag_demo.sessions (
    digest char(64) PRIMARY KEY,
    owner_id uuid NOT NULL REFERENCES rag_demo.accounts(id) ON DELETE CASCADE,
    expires bigint NOT NULL
);
CREATE INDEX sessions_owner_idx ON rag_demo.sessions(owner_id);
CREATE INDEX sessions_expiry_idx ON rag_demo.sessions(expires);
CREATE TABLE rag_demo.embedding_contract (
    singleton boolean PRIMARY KEY CHECK (singleton),
    model text NOT NULL,
    dimensions integer NOT NULL CHECK (dimensions BETWEEN 128 AND 3072)
);
INSERT INTO rag_demo.embedding_contract VALUES (true, 'gemini-embedding-001', 768);
CREATE TABLE rag_demo.documents (
    id uuid PRIMARY KEY,
    owner_id uuid NOT NULL REFERENCES rag_demo.accounts(id),
    filename varchar(100) NOT NULL,
    model text NOT NULL,
    dimensions integer NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(id, owner_id, model, dimensions)
);
CREATE INDEX documents_owner_idx ON rag_demo.documents(owner_id);
CREATE TABLE rag_demo.chunks (
    document_id uuid NOT NULL,
    owner_id uuid NOT NULL,
    ordinal integer NOT NULL CHECK (ordinal >= 0),
    page integer NOT NULL CHECK (page >= 1),
    text text NOT NULL,
    model text NOT NULL,
    dimensions integer NOT NULL,
    embedding vector NOT NULL CHECK (vector_dims(embedding) = dimensions),
    PRIMARY KEY(document_id, ordinal),
    FOREIGN KEY(document_id, owner_id, model, dimensions)
        REFERENCES rag_demo.documents(id, owner_id, model, dimensions) ON DELETE CASCADE
);
CREATE INDEX chunks_owner_idx ON rag_demo.chunks(owner_id);
-- Exact cosine search suits this bounded demo; no unmeasured ANN claims.
ALTER TABLE rag_demo.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag_demo.documents FORCE ROW LEVEL SECURITY;
ALTER TABLE rag_demo.chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag_demo.chunks FORCE ROW LEVEL SECURITY;
CREATE POLICY document_owner ON rag_demo.documents
    USING (owner_id::text = current_setting('rag.owner', true))
    WITH CHECK (owner_id::text = current_setting('rag.owner', true));
CREATE POLICY chunk_owner ON rag_demo.chunks
    USING (owner_id::text = current_setting('rag.owner', true))
    WITH CHECK (owner_id::text = current_setting('rag.owner', true));
-- Create rag_app LOGIN separately with \password; no passwords in source.
GRANT USAGE ON SCHEMA rag_demo TO rag_app;
GRANT SELECT, INSERT ON rag_demo.accounts TO rag_app;
-- Required solely for SELECT FOR UPDATE of account upload quota.
GRANT UPDATE(id) ON rag_demo.accounts TO rag_app;
GRANT SELECT, INSERT, DELETE ON rag_demo.sessions TO rag_app;
GRANT SELECT ON rag_demo.embedding_contract TO rag_app;
GRANT SELECT, INSERT, DELETE ON rag_demo.documents, rag_demo.chunks TO rag_app;
