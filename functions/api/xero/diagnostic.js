import { refreshedConnection } from './_oauth.js';

const BANK_TRANSACTIONS_URL = 'https://api.xero.com/api.xro/2.0/BankTransactions';

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, char => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  }[char]));
}

function page(message = '', status = 200) {
  const notice = message ? `<p class="notice">${escapeHtml(message)}</p>` : '';
  return new Response(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>Xero diagnostic · Rooted Commons</title>
<style>
body{font-family:system-ui,sans-serif;max-width:760px;margin:3rem auto;padding:0 1.25rem;color:#2d2528;line-height:1.5}
form{display:grid;gap:.8rem;max-width:440px}label{font-weight:700}input,button{font:inherit;padding:.75rem;border-radius:.6rem;border:1px solid #b9aeb3}button{cursor:pointer;background:#5a2d4d;color:#fff;border-color:#5a2d4d;font-weight:700}.notice{padding:.8rem 1rem;background:#f3eeee;border-radius:.6rem}small{color:#685f63}
</style></head><body>
<h1>Xero payment diagnostic</h1>
<p>This temporary admin tool reads recent reconciled Xero RECEIVE transactions. It does not write to Account Transactions.</p>
${notice}
<form method="post">
<label for="key">Diagnostic key</label>
<input id="key" name="key" type="password" autocomplete="current-password" required>
<button type="submit">Read recent Xero payments</button>
</form>
<p><small>The key is checked against the server-side XERO_DIAGNOSTIC_KEY secret and is never placed in the URL.</small></p>
</body></html>`, { status, headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store'} });
}

function report(transactions) {
  const rows = transactions.map(tx => {
    const refs = findRcReferences(tx);
    const refsHtml = refs.length
      ? refs.map(ref => `<code>${escapeHtml(ref.value)}</code> <small>${escapeHtml(ref.path)}</small>`).join('<br>')
      : '<span>—</span>';
    return `<tr>
      <td><code>${escapeHtml(tx.BankTransactionID || '')}</code></td>
      <td>${escapeHtml(tx.DateString || tx.Date || '')}</td>
      <td>${escapeHtml(tx.Total ?? '')}</td>
      <td>${escapeHtml(tx.Reference || '')}</td>
      <td>${escapeHtml(tx.Contact?.Name || '')}</td>
      <td>${escapeHtml(tx.BankAccount?.Name || '')}</td>
      <td>${escapeHtml(tx.Status || '')}</td>
      <td>${tx.IsReconciled === true ? 'Yes' : tx.IsReconciled === false ? 'No' : escapeHtml(tx.IsReconciled ?? '')}</td>
      <td>${refsHtml}</td>
    </tr>`;
  }).join('');

  return new Response(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>Xero diagnostic results · Rooted Commons</title>
<style>
body{font-family:system-ui,sans-serif;max-width:1180px;margin:2rem auto;padding:0 1rem;color:#2d2528;line-height:1.45}table{width:100%;border-collapse:collapse;font-size:.9rem}th,td{padding:.65rem;border-bottom:1px solid #ddd;text-align:left;vertical-align:top}th{position:sticky;top:0;background:#fff}code{font-size:.82em;word-break:break-all}small{color:#685f63}a{color:#5a2d4d;font-weight:700}.ok{padding:.75rem 1rem;background:#f3eeee;border-radius:.6rem}div.scroll{overflow:auto}
</style></head><body>
<h1>Xero payment diagnostic</h1>
<p class="ok">Read-only test complete. ${transactions.length} recent RECEIVE transaction${transactions.length === 1 ? '' : 's'} returned. No Account Transactions were created or changed.</p>
<p>Look for the £1.23 test payment and, especially, where <strong>RC-1</strong> appears in the final column.</p>
<div class="scroll"><table><thead><tr><th>BankTransactionID</th><th>Date</th><th>Total</th><th>Reference</th><th>Contact</th><th>Bank account</th><th>Status</th><th>Reconciled</th><th>RC reference found</th></tr></thead><tbody>${rows || '<tr><td colspan="9">No RECEIVE transactions returned.</td></tr>'}</tbody></table></div>
<p><a href="/api/xero/diagnostic">Run again</a></p>
</body></html>`, { headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store'} });
}

function findRcReferences(value, path = '$', found = []) {
  if (typeof value === 'string') {
    const matches = value.match(/\bRC-\d+\b/gi) || [];
    for (const match of matches) {
      if (!found.some(item => item.path === path && item.value.toUpperCase() === match.toUpperCase())) {
        found.push({ path, value: match });
      }
    }
    return found;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => findRcReferences(item, `${path}[${index}]`, found));
    return found;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) findRcReferences(child, `${path}.${key}`, found);
  }
  return found;
}

async function fetchRecentReceives(accessToken, tenantId) {
  const url = new URL(BANK_TRANSACTIONS_URL);
  url.searchParams.set('where', 'Type=="RECEIVE"');
  url.searchParams.set('order', 'Date DESC');
  url.searchParams.set('page', '1');
  const response = await fetch(url, {
    headers: {
      authorization: `Bearer ${accessToken}`,
      'xero-tenant-id': tenantId,
      accept: 'application/json'
    }
  });
  if (!response.ok) throw new Error(`Xero BankTransactions ${response.status}: ${await response.text()}`);
  const payload = await response.json();
  return Array.isArray(payload.BankTransactions) ? payload.BankTransactions : [];
}

async function submittedKey(request) {
  const type = request.headers.get('content-type') || '';
  if (type.includes('application/json')) {
    const body = await request.json().catch(() => ({}));
    return String(body.key || '');
  }
  const form = await request.formData();
  return String(form.get('key') || '');
}

function keyMatches(env, supplied) {
  const expected = String(env.XERO_DIAGNOSTIC_KEY || '');
  if (!expected || !supplied || expected.length !== supplied.length) return false;
  let difference = 0;
  for (let i = 0; i < expected.length; i += 1) difference |= expected.charCodeAt(i) ^ supplied.charCodeAt(i);
  return difference === 0;
}

export async function onRequestGet() {
  return page();
}

export async function onRequestPost({ request, env }) {
  try {
    const key = await submittedKey(request);
    if (!String(env.XERO_DIAGNOSTIC_KEY || '').trim()) return page('XERO_DIAGNOSTIC_KEY has not been configured in Cloudflare yet.', 503);
    if (!keyMatches(env, key)) return page('That diagnostic key was not accepted.', 403);

    const connection = await refreshedConnection(env);
    const transactions = await fetchRecentReceives(connection.accessToken, connection.tenantId);
    return report(transactions.slice(0, 100));
  } catch (error) {
    return page(`Diagnostic failed: ${String(error.message || error)}`, 500);
  }
}
