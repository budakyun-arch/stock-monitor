-- Stock monitor schema (Postgres / Supabase)
-- Run this once in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS prices (
  bas_dt       TEXT    NOT NULL,
  srtn_cd      TEXT    NOT NULL,
  isin_cd      TEXT    NOT NULL,
  itms_nm      TEXT    NOT NULL,
  mrkt_ctg     TEXT    NOT NULL,
  clpr         BIGINT  NOT NULL,
  vs           BIGINT,
  flt_rt       NUMERIC,
  mkp          BIGINT,
  hipr         BIGINT,
  lopr         BIGINT,
  trqu         BIGINT,
  tr_prc       BIGINT,
  lstg_st_cnt  BIGINT,
  mrkt_tot_amt BIGINT,
  fetched_at   TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (bas_dt, srtn_cd)
);

CREATE INDEX IF NOT EXISTS idx_prices_srtn_dt ON prices (srtn_cd, bas_dt DESC);

CREATE TABLE IF NOT EXISTS comments (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bas_dt     TEXT        NOT NULL,
  author     TEXT        NOT NULL,
  body       TEXT        NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_dt ON comments (bas_dt, created_at DESC);
