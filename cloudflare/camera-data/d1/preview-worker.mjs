// Read-only local preview of the test database camalert-operational.
// Run with preview.wrangler.jsonc. Do not deploy this worker and do not copy
// its D1 binding into wrangler.jsonc.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: cors });
}

function countryOf(url) {
  const value = (url.searchParams.get("country") || "").toUpperCase();
  if (!/^[A-Z]{2}$/.test(value)) return null;
  return value;
}

function limitOf(url) {
  const value = Number(url.searchParams.get("limit") || "5");
  if (!Number.isInteger(value) || value < 1 || value > 20) return null;
  return value;
}

async function all(env, sql, bindings = []) {
  const statement = env.CAMALERT_D1.prepare(sql);
  const bound = bindings.length ? statement.bind(...bindings) : statement;
  const result = await bound.all();
  return result.results || [];
}

async function status(env) {
  const [counts] = await all(env, `SELECT
    (SELECT COUNT(*) FROM cameras) AS cameras,
    (SELECT SUM(published) FROM cameras) AS published,
    (SELECT COUNT(*) FROM cameras WHERE published = 0) AS unpublished,
    (SELECT COUNT(*) FROM cameras WHERE status = 'candidate') AS candidates,
    (SELECT COUNT(*) FROM sources) AS sources,
    (SELECT COUNT(*) FROM camera_export_ids) AS export_ids,
    (SELECT COUNT(*) FROM camera_moderation) AS moderation`);
  const [control] = await all(env, `SELECT normalized_manifest, master_decoded_sha256, master_record_count, manifest_sha256, delivery_pending
    FROM storage_control WHERE id = 1`);
  return { counts, storage_control: control || null };
}

async function published(env, url) {
  const country = countryOf(url);
  const limit = limitOf(url);
  if (!country || !limit) return json({ error: "country_and_limit_required" }, 400);
  const [summary] = await all(env, `SELECT COUNT(*) AS cameras, SUM(published) AS published
    FROM cameras WHERE country_code = ?1 AND published = 1`, [country]);
  const rows = await all(env, `SELECT canonical_id, country_code, camera_type, status, confidence, published
    FROM cameras WHERE country_code = ?1 AND published = 1 ORDER BY canonical_id LIMIT ?2`, [country, limit]);
  return { country, summary, rows };
}

async function candidates(env, url) {
  const country = countryOf(url);
  const limit = limitOf(url);
  if (!country || !limit) return json({ error: "country_and_limit_required" }, 400);
  const [summary] = await all(env, `SELECT COUNT(*) AS candidates, SUM(published) AS published_candidates
    FROM cameras WHERE country_code = ?1 AND status = 'candidate'`, [country]);
  const rows = await all(env, `SELECT canonical_id, country_code, camera_type, status, confidence, published
    FROM cameras WHERE country_code = ?1 AND status = 'candidate' ORDER BY canonical_id LIMIT ?2`, [country, limit]);
  return { country, summary, rows };
}

async function sources(env, url) {
  const limit = limitOf(url);
  if (!limit) return json({ error: "limit_required" }, 400);
  const [summary] = await all(env, "SELECT COUNT(*) AS sources FROM sources");
  const rows = await all(env, `SELECT source_code, source_name, country_code, in_public_manifest
    FROM sources ORDER BY source_code LIMIT ?1`, [limit]);
  return { summary, rows };
}

async function exportsFor(env, url) {
  const country = countryOf(url);
  const limit = limitOf(url);
  if (!country || !limit) return json({ error: "country_and_limit_required" }, 400);
  const [summary] = await all(env, `SELECT COUNT(*) AS export_ids,
      SUM(CASE WHEN role = 'delivery' THEN 1 ELSE 0 END) AS delivery,
      SUM(CASE WHEN role = 'render_projection' THEN 1 ELSE 0 END) AS render_projections
    FROM camera_export_ids WHERE country_code = ?1`, [country]);
  const rows = await all(env, `SELECT country_code, export_group, export_id, canonical_id, role
    FROM camera_export_ids WHERE country_code = ?1
    ORDER BY export_group, export_id, canonical_key LIMIT ?2`, [country, limit]);
  return { country, summary, rows };
}

async function statuses(env) {
  const rows = await all(env, `SELECT status, lower(confidence) AS confidence, published, COUNT(*) AS n
    FROM cameras GROUP BY status, lower(confidence), published
    ORDER BY status, confidence, published`);
  return { rows };
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", { status: 405, headers: { ...cors, Allow: "GET, HEAD, OPTIONS" } });
    }
    const url = new URL(request.url);
    const routes = {
      "/v1/status": () => status(env),
      "/v1/published": () => published(env, url),
      "/v1/candidates": () => candidates(env, url),
      "/v1/sources": () => sources(env, url),
      "/v1/exports": () => exportsFor(env, url),
      "/v1/statuses": () => statuses(env),
    };
    const handler = routes[url.pathname];
    if (!handler) return json({ error: "not_found" }, 404);
    const payload = await handler();
    if (payload instanceof Response) return payload;
    if (request.method === "HEAD") return new Response(null, { status: 200, headers: cors });
    return json(payload);
  },
};
