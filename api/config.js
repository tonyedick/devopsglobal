// Vercel Serverless Function — /api/config
// Serves runtime config to all DevOps.global pages.
// Values come from Vercel environment variables (never in code).

export default function handler(req, res) {
  const missing = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'TURNSTILE_SITE_KEY']
    .filter(k => !process.env[k]);

  if (missing.length) {
    return res
      .setHeader('Content-Type', 'application/javascript')
      .status(200)
      .send(`window.DEVOPS_GLOBAL_CONFIG = null; console.error("Missing env vars: ${missing.join(', ')}")`);
  }

  const config = {
    SUPABASE_FUNCTIONS_BASE: process.env.SUPABASE_URL.replace(/\/$/, '') + '/functions/v1',
    SUPABASE_ANON_KEY:       process.env.SUPABASE_ANON_KEY,
    TURNSTILE_SITE_KEY:      process.env.TURNSTILE_SITE_KEY,
  };

  res
    .setHeader('Content-Type', 'application/javascript; charset=utf-8')
    .setHeader('Cache-Control', 'no-store, no-cache')
    .status(200)
    .send(`window.DEVOPS_GLOBAL_CONFIG = ${JSON.stringify(config)};`);
}