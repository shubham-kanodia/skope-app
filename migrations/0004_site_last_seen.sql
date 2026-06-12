-- "Liveness" by observation: skope.js calls /api/cfg from the customer's page,
-- so we record when we last saw a real load and from which origin. This is a
-- far better signal than fetching+grepping HTML, and it works on localhost
-- (the browser hits us, not our server) and lets us flag domain mismatches.
alter table sites add column if not exists last_seen_at timestamptz;
alter table sites add column if not exists last_seen_origin text;
