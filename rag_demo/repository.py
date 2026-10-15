"""Parameterized SQL for the dedicated local database; no schema creation."""
from contextlib import contextmanager
import json
import time
import uuid

from .config import validate_local_database


class Conflict(Exception):
    pass


class PostgresRepository:
    def __init__(self, settings):
        self.url = validate_local_database(settings.database_url)
        self.settings = settings

    @contextmanager
    def connection(self, owner=None):
        import psycopg
        from psycopg.rows import dict_row
        with psycopg.connect(self.url, connect_timeout=3, row_factory=dict_row,
                             options="-c statement_timeout=5000") as conn:
            if owner:
                conn.execute("SELECT set_config('rag.owner', %s, true)", (owner,))
            yield conn

    def check_contract(self, conn):
        row = conn.execute("SELECT model, dimensions FROM rag_demo.embedding_contract WHERE singleton = true").fetchone()
        if not row or (row["model"], row["dimensions"]) != (self.settings.embedding_model, self.settings.dimensions):
            raise Conflict("Embedding configuration differs from the local database contract")

    def create_account(self, username, password_hash):
        import psycopg
        owner = str(uuid.uuid4())
        try:
            with self.connection() as conn:
                conn.execute("INSERT INTO rag_demo.accounts (id, username, password_hash) VALUES (%s, %s, %s)",
                             (owner, username, password_hash))
        except psycopg.errors.UniqueViolation:
            raise Conflict("Demo username already exists") from None
        return owner

    def account(self, username):
        with self.connection() as conn:
            return conn.execute("SELECT id::text, password_hash FROM rag_demo.accounts WHERE username=%s", (username,)).fetchone()

    def create_session(self, owner, digest, expires):
        with self.connection() as conn:
            conn.execute("DELETE FROM rag_demo.sessions WHERE expires <= %s", (int(time.time()),))
            conn.execute("INSERT INTO rag_demo.sessions (digest, owner_id, expires) VALUES (%s, %s, %s)", (digest, owner, expires))

    def session_owner(self, digest, now):
        with self.connection() as conn:
            row = conn.execute("SELECT owner_id::text FROM rag_demo.sessions WHERE digest=%s AND expires>%s", (digest, now)).fetchone()
            return row["owner_id"] if row else None

    def revoke_session(self, digest):
        with self.connection() as conn:
            conn.execute("DELETE FROM rag_demo.sessions WHERE digest=%s", (digest,))

    def add_document(self, owner, filename, chunks, vectors):
        document = str(uuid.uuid4())
        with self.connection(owner) as conn:
            self.check_contract(conn)
            # Serialize account uploads to enforce a small local-demo quota.
            conn.execute("SELECT id FROM rag_demo.accounts WHERE id=%s FOR UPDATE", (owner,))
            count = conn.execute("SELECT COUNT(*) AS n FROM rag_demo.documents WHERE owner_id=%s", (owner,)).fetchone()["n"]
            if count >= 20:
                raise Conflict("Demo limit is 20 documents per account")
            conn.execute("INSERT INTO rag_demo.documents (id, owner_id, filename, model, dimensions) VALUES (%s,%s,%s,%s,%s)",
                         (document, owner, filename, self.settings.embedding_model, self.settings.dimensions))
            for chunk, vector in zip(chunks, vectors, strict=True):
                conn.execute("INSERT INTO rag_demo.chunks (document_id, owner_id, ordinal, page, text, model, dimensions, embedding) "
                             "VALUES (%s,%s,%s,%s,%s,%s,%s,%s::vector)",
                             (document, owner, chunk.ordinal, chunk.page, chunk.text, self.settings.embedding_model,
                              self.settings.dimensions, json.dumps(vector)))
        return {"id": document, "filename": filename, "chunks": len(chunks)}

    def list_documents(self, owner):
        with self.connection(owner) as conn:
            return conn.execute("SELECT d.id::text, d.filename, COUNT(c.ordinal) AS chunks "
                                "FROM rag_demo.documents d LEFT JOIN rag_demo.chunks c ON c.document_id=d.id AND c.owner_id=d.owner_id "
                                "WHERE d.owner_id=%s GROUP BY d.id ORDER BY d.created_at, d.id", (owner,)).fetchall()

    def delete_document(self, owner, document):
        with self.connection(owner) as conn:
            return conn.execute("DELETE FROM rag_demo.documents WHERE owner_id=%s AND id=%s RETURNING id", (owner, document)).fetchone() is not None

    def search(self, owner, vector, document_ids, limit, min_score):
        with self.connection(owner) as conn:
            self.check_contract(conn)
            # Check *every* explicitly requested document before embedding search.
            if document_ids:
                count = conn.execute("SELECT COUNT(*) AS n FROM rag_demo.documents WHERE owner_id=%s AND id=ANY(%s::uuid[])",
                                     (owner, document_ids)).fetchone()["n"]
                if count != len(set(document_ids)):
                    raise PermissionError("Document unavailable")
            sql = ("SELECT c.document_id::text, d.filename, c.page, c.text, c.ordinal, "
                   "1-(c.embedding <=> %s::vector) AS score FROM rag_demo.chunks c "
                   "JOIN rag_demo.documents d ON d.id=c.document_id AND d.owner_id=c.owner_id "
                   "WHERE c.owner_id=%s AND c.model=%s AND c.dimensions=%s "
                   "AND (%s::uuid[] IS NULL OR c.document_id=ANY(%s::uuid[])) "
                   "AND 1-(c.embedding <=> %s::vector)>=%s "
                   "ORDER BY c.embedding <=> %s::vector, c.document_id, c.ordinal LIMIT %s")
            encoded = json.dumps(vector)
            return conn.execute(sql, (encoded, owner, self.settings.embedding_model, self.settings.dimensions,
                                      document_ids or None, document_ids or None, encoded, min_score, encoded, limit)).fetchall()
