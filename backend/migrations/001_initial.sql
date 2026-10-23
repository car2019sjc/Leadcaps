CREATE TABLE app_users (
  id uuid PRIMARY KEY,
  login text NOT NULL UNIQUE,
  display_name text NOT NULL,
  password_hash text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE app_sessions (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES app_users(id),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX app_sessions_expiry ON app_sessions(expires_at);
CREATE TABLE lead_imports (
  id uuid PRIMARY KEY,
  request_id uuid NOT NULL,
  description text NOT NULL CHECK (length(trim(description)) BETWEEN 5 AND 500),
  filename text NOT NULL,
  source_sha256 text NOT NULL,
  payload_sha256 text NOT NULL,
  imported_by uuid NOT NULL REFERENCES app_users(id),
  imported_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  record_count integer NOT NULL CHECK (record_count BETWEEN 1 AND 100000),
  pack_version integer NOT NULL DEFAULT 1,
  pack jsonb NOT NULL,
  UNIQUE(imported_by, request_id)
);
CREATE INDEX lead_imports_date ON lead_imports(imported_at DESC, id DESC);
-- Uma carga é um snapshot completo, sem atualização por contato.
-- A API permite exclusão explícita e confirmada pelo usuário que a importou.
-- Não há contato global que sobrescreva os atributos de pesquisas anteriores.
