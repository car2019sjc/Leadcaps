CREATE TABLE search_runs (
  id uuid PRIMARY KEY,
  request_id uuid NOT NULL,
  payload_hash text NOT NULL,
  created_by uuid NOT NULL REFERENCES app_users(id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  finished_at timestamptz,
  status text NOT NULL CHECK(status IN ('queued','running','completed','partial','failed','unknown')),
  data jsonb NOT NULL,
  latest_revision integer NOT NULL DEFAULT 1,
  UNIQUE(created_by,request_id)
);
CREATE TABLE search_queries (
  id uuid PRIMARY KEY,
  run_id uuid NOT NULL REFERENCES search_runs(id),
  position integer NOT NULL,
  query_text text NOT NULL,
  status text NOT NULL CHECK(status IN ('queued','running','completed','empty','failed','unknown','skipped')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  started_at timestamptz,
  finished_at timestamptz,
  result jsonb,
  provider_id text,
  provider_created_at timestamptz,
  error_code text,
  error_message text,
  UNIQUE(run_id,position)
);
CREATE INDEX search_queries_queue ON search_queries(created_at,position) WHERE status='queued';
CREATE TABLE search_run_revisions (
  run_id uuid NOT NULL REFERENCES search_runs(id),
  revision integer NOT NULL,
  reviews jsonb NOT NULL,
  created_by uuid NOT NULL REFERENCES app_users(id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(run_id,revision)
);
CREATE TABLE search_exports (
  run_id uuid NOT NULL REFERENCES search_runs(id),
  research_id uuid NOT NULL UNIQUE REFERENCES content_researches(id),
  revision integer NOT NULL,
  created_by uuid NOT NULL REFERENCES app_users(id),
  request_id uuid NOT NULL,
  payload_hash text NOT NULL,
  signal_ids jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(created_by,request_id)
);
