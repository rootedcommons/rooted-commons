// Rooted Commons Xero sync scheduler.
// Deploy this as a separate Cloudflare Worker and add a Cron Trigger:
//   */15 * * * *
// Add two Worker secrets/variables:
//   ROOTED_SYNC_URL = https://rootedcommons.uk/api/xero/sync
//   XERO_SYNC_KEY   = the same secret configured on the Pages project

export default {
  async scheduled(controller, env, ctx) {
    const url = String(env.ROOTED_SYNC_URL || '').trim();
    const key = String(env.XERO_SYNC_KEY || '').trim();
    if (!url || !key) throw new Error('ROOTED_SYNC_URL or XERO_SYNC_KEY is missing');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${key}`,
        accept: 'application/json'
      }
    });

    const body = await response.text();
    if (!response.ok) {
      throw new Error(`Rooted Commons Xero sync ${response.status}: ${body.slice(0, 1000)}`);
    }

    console.log(`Rooted Commons Xero sync complete: ${body.slice(0, 2000)}`);
  }
};
