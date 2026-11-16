/** Numbered migrations. Append only; never edit one that has shipped. */
export const MIGRATIONS: string[] = [
  /* 1: accounts */ `
  CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );
  CREATE TABLE watchlist (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ticker TEXT NOT NULL,
    added_at TEXT NOT NULL,
    PRIMARY KEY (user_id, ticker)
  );`,

  /* 2: companies, quotes, bars */ `
  CREATE TABLE companies (
    ticker TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    cik TEXT,
    exchange TEXT,
    sector TEXT,
    sub_industry TEXT,
    in_sp500 INTEGER NOT NULL DEFAULT 0,
    is_etf INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX companies_cik ON companies(cik);
  CREATE TABLE quotes (
    ticker TEXT PRIMARY KEY,
    price REAL NOT NULL,
    prev_close REAL,
    as_of TEXT NOT NULL,
    source TEXT NOT NULL,
    freshness TEXT NOT NULL CHECK (freshness IN ('real-time', 'delayed')),
    delay_minutes INTEGER,
    fetched_at TEXT NOT NULL
  );
  CREATE TABLE quote_refresh (
    ticker TEXT PRIMARY KEY,
    last_attempt_at TEXT NOT NULL,
    last_success_at TEXT,
    last_error TEXT
  );
  CREATE TABLE bars (
    ticker TEXT NOT NULL,
    date TEXT NOT NULL,
    open REAL NOT NULL,
    high REAL NOT NULL,
    low REAL NOT NULL,
    close REAL NOT NULL,
    volume REAL NOT NULL,
    source TEXT NOT NULL,
    PRIMARY KEY (ticker, date)
  );`,

  /* 3: EDGAR facts and filings */ `
  CREATE TABLE facts (
    cik TEXT NOT NULL,
    concept TEXT NOT NULL,
    period_end TEXT NOT NULL,
    period_start TEXT,
    value REAL NOT NULL,
    unit TEXT NOT NULL,
    tag TEXT NOT NULL,
    accn TEXT NOT NULL,
    form TEXT NOT NULL,
    filed TEXT NOT NULL,
    origin TEXT NOT NULL CHECK (origin IN ('companyfacts', 'frames')),
    PRIMARY KEY (cik, concept, period_end, origin)
  );
  CREATE TABLE facts_loaded (
    cik TEXT PRIMARY KEY,
    loaded_at TEXT NOT NULL,
    status TEXT NOT NULL,
    error TEXT
  );
  CREATE TABLE filings (
    accn TEXT PRIMARY KEY,
    cik TEXT NOT NULL,
    form TEXT NOT NULL,
    filed TEXT NOT NULL,
    report_date TEXT,
    primary_doc TEXT,
    description TEXT
  );
  CREATE INDEX filings_cik ON filings(cik, filed);`,

  /* 4: AI reviews, usage and provider logs */ `
  CREATE TABLE ai_reviews (
    id INTEGER PRIMARY KEY,
    ticker TEXT NOT NULL,
    created_at TEXT NOT NULL,
    evidence_date TEXT NOT NULL,
    model TEXT NOT NULL,
    status TEXT NOT NULL,
    summary TEXT NOT NULL,
    points_json TEXT NOT NULL,
    sources_json TEXT NOT NULL,
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    cost_usd REAL NOT NULL DEFAULT 0
  );
  CREATE INDEX ai_reviews_ticker ON ai_reviews(ticker, created_at);
  CREATE TABLE provider_log (
    id INTEGER PRIMARY KEY,
    provider TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    ok INTEGER NOT NULL,
    status INTEGER,
    ms INTEGER NOT NULL,
    error TEXT,
    at TEXT NOT NULL
  );
  CREATE INDEX provider_log_at ON provider_log(provider, at);
  CREATE TABLE job_runs (
    job TEXT PRIMARY KEY,
    last_run_at TEXT NOT NULL,
    last_ok_at TEXT,
    last_error TEXT
  );`,
];
