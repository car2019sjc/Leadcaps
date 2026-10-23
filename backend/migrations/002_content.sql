CREATE TABLE content_researches (
  id uuid PRIMARY KEY,
  request_id uuid NOT NULL,
  payload_hash text NOT NULL,
  created_by uuid NOT NULL REFERENCES app_users(id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  data jsonb NOT NULL,
  UNIQUE(created_by, request_id)
);
CREATE TABLE content_jobs (
  id uuid PRIMARY KEY,
  request_id uuid NOT NULL,
  payload_hash text NOT NULL,
  research_id uuid NOT NULL REFERENCES content_researches(id),
  created_by uuid NOT NULL REFERENCES app_users(id),
  action text NOT NULL CHECK (action IN ('opportunities', 'brief')),
  status text NOT NULL CHECK (status IN ('queued','running','completed','failed','unknown')),
  input jsonb NOT NULL,
  result jsonb,
  usage jsonb,
  model text NOT NULL,
  prompt_version text NOT NULL DEFAULT 'leadcaps.content.v1',
  provider_request_id text,
  error_code text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  started_at timestamptz,
  finished_at timestamptz,
  UNIQUE(created_by, request_id)
);
CREATE INDEX content_jobs_queue ON content_jobs(created_at) WHERE status='queued';
CREATE INDEX content_jobs_research ON content_jobs(research_id, created_at DESC);
CREATE TABLE content_opportunities (
  id uuid PRIMARY KEY,
  research_id uuid NOT NULL REFERENCES content_researches(id),
  job_id uuid NOT NULL REFERENCES content_jobs(id),
  latest_revision integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE content_opportunity_revisions (
  opportunity_id uuid NOT NULL REFERENCES content_opportunities(id),
  revision integer NOT NULL,
  data jsonb NOT NULL,
  author_type text NOT NULL CHECK(author_type IN ('ai','human')),
  author_id uuid REFERENCES app_users(id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(opportunity_id, revision)
);
CREATE TABLE content_briefs (
  id uuid PRIMARY KEY,
  research_id uuid NOT NULL REFERENCES content_researches(id),
  opportunity_id uuid NOT NULL REFERENCES content_opportunities(id),
  opportunity_revision integer NOT NULL,
  job_id uuid NOT NULL REFERENCES content_jobs(id),
  latest_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE content_brief_versions (
  brief_id uuid NOT NULL REFERENCES content_briefs(id),
  version integer NOT NULL,
  data jsonb NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','approved')),
  created_by uuid NOT NULL REFERENCES app_users(id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  approved_by uuid REFERENCES app_users(id),
  approved_at timestamptz,
  PRIMARY KEY(brief_id, version)
);
