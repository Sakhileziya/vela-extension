-- ─── Vela Database Schema ─────────────────────────────────────────────────────
-- Phase 2: Run this when you add Supabase for team accounts and cross-device sync.
-- For MVP (Phase 1): everything runs in Chrome local storage — no Supabase needed.
--
-- Conventions:
--   - UUIDs for all primary keys (gen_random_uuid())
--   - created_at / updated_at on all tables
--   - RLS (Row Level Security) enabled on all tables — users only see their own data
--   - All PII fields named explicitly for POPIA documentation
-- ──────────────────────────────────────────────────────────────────────────────

-- Enable pgvector for embedding-based memory retrieval
CREATE EXTENSION IF NOT EXISTS vector;

-- ─── POPIA Consent Records ─────────────────────────────────────────────────��──
-- Immutable. Every consent event is appended, never updated.
CREATE TABLE IF NOT EXISTS popia_consents (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consented         boolean NOT NULL,
  purpose           text NOT NULL,
  ip_address_hash   text,                        -- Hashed, not stored in plain text
  user_agent_hash   text,                        -- Hashed, not stored in plain text
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- Index for audit queries
CREATE INDEX idx_popia_consents_user_id ON popia_consents(user_id);
CREATE INDEX idx_popia_consents_created_at ON popia_consents(created_at DESC);

-- RLS: users can only read their own consent records
ALTER TABLE popia_consents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own consents"
  ON popia_consents FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own consents"
  ON popia_consents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ─── Companions ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS companions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name              varchar(50) NOT NULL,
  role              varchar(100) NOT NULL,
  system_prompt     text NOT NULL,
  color             varchar(7) NOT NULL DEFAULT '#1B7A4A',
  language          varchar(5) NOT NULL DEFAULT 'en',
  tools             text[] NOT NULL DEFAULT ARRAY['read_page', 'summarise'],
  is_default        boolean NOT NULL DEFAULT false,
  is_shared         boolean NOT NULL DEFAULT false,  -- Phase 2: team sharing
  team_id           uuid,                             -- Phase 2: team accounts
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_companions_user_id ON companions(user_id);

ALTER TABLE companions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own companions"
  ON companions FOR ALL
  USING (auth.uid() = user_id);

-- Auto-update updated_at on every change
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER companions_updated_at
  BEFORE UPDATE ON companions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── Long-term Memories ───────────────────��───────────────────────────────────
CREATE TABLE IF NOT EXISTS memories (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  companion_id      uuid NOT NULL REFERENCES companions(id) ON DELETE CASCADE,
  fact              text NOT NULL,
  category          varchar(50) NOT NULL DEFAULT 'general',
  embedding         vector(768),   -- nomic-embed-text outputs 768 dimensions
  source_message    text,          -- Original message that produced this memory
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_memories_companion_id ON memories(companion_id);
CREATE INDEX idx_memories_user_id ON memories(user_id);

-- Vector similarity index for fast semantic retrieval (IVFFlat for large datasets)
-- Only create when you have > 1000 rows for optimal performance
-- CREATE INDEX idx_memories_embedding ON memories USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

ALTER TABLE memories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own memories"
  ON memories FOR ALL
  USING (auth.uid() = user_id);

-- ─── Conversations ─────────────────────────────────────────���──────────────────
CREATE TABLE IF NOT EXISTS conversations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  companion_id      uuid NOT NULL REFERENCES companions(id) ON DELETE CASCADE,
  role              varchar(10) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content           text NOT NULL,
  page_url          text,          -- URL of the page when the message was sent
  page_title        text,          -- Title of the page
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_conversations_companion_id ON conversations(companion_id, created_at DESC);
CREATE INDEX idx_conversations_user_id ON conversations(user_id);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own conversations"
  ON conversations FOR ALL
  USING (auth.uid() = user_id);

-- ─── Audit Logs (POPIA Section 22 — Security Measures) ───────────────────────
-- Immutable record of all AI actions taken on behalf of users.
CREATE TABLE IF NOT EXISTS audit_logs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  action_type       varchar(50) NOT NULL,   -- e.g. 'click', 'form_fill', 'navigate'
  action_payload    jsonb,                   -- Parameters of the action (no PII)
  page_url          text,
  success           boolean NOT NULL,
  error_message     text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- Audit logs: users can read but never update or delete (immutability by design)
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own audit logs"
  ON audit_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System inserts audit logs"
  ON audit_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ─── Memory Retrieval Function ────────────────────────────────────────────────
-- Server-side semantic search — faster than fetching all embeddings to the client.
CREATE OR REPLACE FUNCTION match_memories(
  query_embedding   vector(768),
  companion_id_param uuid,
  match_threshold   float DEFAULT 0.72,
  match_count       int DEFAULT 8
)
RETURNS TABLE (
  id          uuid,
  fact        text,
  category    varchar,
  similarity  float
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    m.id,
    m.fact,
    m.category,
    1 - (m.embedding <=> query_embedding) AS similarity
  FROM memories m
  WHERE
    m.companion_id = companion_id_param
    AND m.embedding IS NOT NULL
    AND 1 - (m.embedding <=> query_embedding) > match_threshold
  ORDER BY m.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- ─── Grants ───────────────────────────────────────────────────────────────────
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON FUNCTION match_memories TO authenticated;
