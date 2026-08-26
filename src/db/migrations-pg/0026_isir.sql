-- ISIR insolvency events and polls

CREATE TABLE IF NOT EXISTS insolvency_events (
  id TEXT PRIMARY KEY,
  podnet_id BIGINT NOT NULL UNIQUE,
  spisova_znacka TEXT NOT NULL,
  court TEXT,
  event_type TEXT NOT NULL,
  event_desc TEXT,
  section TEXT,
  section_order INTEGER,
  document_url TEXT,
  notes TEXT,
  published_at BIGINT NOT NULL,
  apartment_found INTEGER DEFAULT 0 NOT NULL,
  apartment_data JSONB DEFAULT '{}',
  score INTEGER DEFAULT 0 NOT NULL,
  status TEXT DEFAULT 'new' NOT NULL,
  notes_user TEXT,
  contacted_at BIGINT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_insolvency_events_podnet_id ON insolvency_events(podnet_id);
CREATE INDEX IF NOT EXISTS idx_insolvency_events_spisova_znacka ON insolvency_events(spisova_znacka);
CREATE INDEX IF NOT EXISTS idx_insolvency_events_section ON insolvency_events(section);
CREATE INDEX IF NOT EXISTS idx_insolvency_events_score ON insolvency_events(score DESC);
CREATE INDEX IF NOT EXISTS idx_insolvency_events_apartment_found ON insolvency_events(apartment_found);
CREATE INDEX IF NOT EXISTS idx_insolvency_events_status ON insolvency_events(status);

CREATE TABLE IF NOT EXISTS isir_polls (
  id TEXT PRIMARY KEY,
  started_at BIGINT NOT NULL,
  finished_at BIGINT,
  last_podnet_id BIGINT,
  events_found INTEGER DEFAULT 0 NOT NULL,
  apartments_found INTEGER DEFAULT 0 NOT NULL,
  error TEXT,
  status TEXT DEFAULT 'running' NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_isir_polls_status ON isir_polls(status);
CREATE INDEX IF NOT EXISTS idx_isir_polls_started_at ON isir_polls(started_at DESC);
