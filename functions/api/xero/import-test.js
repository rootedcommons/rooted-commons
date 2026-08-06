import { envConfig, listRows, createRow, linkedIds } from '../../_baserow.js';
import { refreshedConnection } from './_oauth.js';
import { fetchRecentReceives, isImportableMemberPayment, paymentReference, xeroDate } from './_payments.js';

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, char => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  }[char]));
}

function page(message = '', status = 200, detail = '') {
  const notice = message ? `<p class="notice">${escapeHtml(message)}</p>` : '';
  const extra = detail ? `<p>${escapeHtml(detail)}</p>` : '';
  return new Response(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>Xero import test · Rooted Commons</title>
<style>
body{font-family:system-ui,sans-serif;max-width:760px;margin:3rem auto;padding:0 1.25rem;color:#2d2528;line-height:1.5}
form{display:grid;gap:.8rem;max-width:460px}label{font-weight:700}input,button{font:inherit;padding:.75rem;border-radius:.6rem;border:1px solid #b9aeb3}button{cursor:pointer;background:#5a2d4d;color:#fff;border-color:#5a2d4d;font-weight:700}.notice{padding:.8rem 1rem;background:#f3eeee;border-radius:.6rem}small{color:#685f63}code{font-size:.9em}
</style></head><body>
<h1>Xero member-payment import test</h1>
<p>This imports only the newest recent Xero RECEIVE transaction that is reconciled, AUTHORISED, positive, and has an exact <code>RC-number</code> Reference.</p>
${notice}${extra}
<form method="post">
<label for="key">Diagnostic key</label>
<input id="key" name="key" type="password" autocomplete="current-password" required>
<button type="submit">Import newest safe member payment</button>
</form>
<p><small>Run this once for the £1.23 RC-1 test payment. Running it again is safe: Xero BankTransactionID is checked before any row is created.</small></p>
</body></html>`, { status, headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store'} });
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

function memberReference(member) {
  const explicit = String(member?.['Member number'] || '').trim().toUpperCase();
  return explicit || `RC-${member.id}`;
}

function transactionBelongsToMember(row, memberId) {
  return linkedIds(row?.Member).includes(Number(memberId));
}

export async function onRequestGet() {
  return page();
}

export async function onRequestPost({ request, env }) {
  try {
    const key = await submittedKey(request);
    if (!String(env.XERO_DIAGNOSTIC_KEY || '').trim()) return page('XERO_DIAGNOSTIC_KEY has not been configured in Cloudflare yet.', 503);
    if (!keyMatches(env, key)) return page('That diagnostic key was not accepted.', 403);

    const cfg = envConfig(env);
    if (!cfg.members || !cfg.transactions) throw new Error('Members or Account Transactions Baserow table ID is missing');

    const connection = await refreshedConnection(env);
    const [xeroTransactions, members, accountTransactions] = await Promise.all([
      fetchRecentReceives(connection.accessToken, connection.tenantId),
      listRows(cfg, cfg.members),
      listRows(cfg, cfg.transactions)
    ]);

    const candidates = xeroTransactions.filter(isImportableMemberPayment);
    if (!candidates.length) return page('No safe RC-number member payment was found in the recent Xero RECEIVE transactions.', 404);

    const tx = candidates[0];
    const txId = String(tx.BankTransactionID || '').trim();
    const reference = paymentReference(tx);
    if (!txId) throw new Error('The Xero transaction has no BankTransactionID');

    const duplicate = accountTransactions.find(row => String(row['Xero BankTransactionsID'] || '').trim() === txId);
    if (duplicate) {
      return page(
        'No duplicate created — this Xero payment is already in Account Transactions.',
        200,
        `${reference} · £${Number(tx.Total).toFixed(2)} · existing Account Transactions row ${duplicate.id}`
      );
    }

    const member = members.find(row => memberReference(row) === reference);
    if (!member) {
      return page(
        'Payment found, but no member matched its RC reference. Nothing was imported.',
        409,
        `${reference} · £${Number(tx.Total).toFixed(2)} · Xero BankTransactionID ${txId}`
      );
    }

    const sameReferenceOtherMember = accountTransactions.find(row =>
      String(row['Payment reference'] || '').trim().toUpperCase() === reference &&
      linkedIds(row.Member).length &&
      !transactionBelongsToMember(row, member.id)
    );
    if (sameReferenceOtherMember) {
      return page('Safety check failed: this payment reference is already attached to a different member transaction. Nothing was imported.', 409);
    }

    const now = new Date().toISOString();
    const fields = {
      'Date': xeroDate(tx),
      'Xero Reference': String(tx.Reference || '').trim(),
      'Type': 'Xero payment',
      'Amount': Math.round(Number(tx.Total) * 100) / 100,
      'Xero BankTransactionsID': txId,
      'Notes': `Xero member payment${tx.Contact?.Name ? ` · ${tx.Contact.Name}` : ''}`,
      'Payment reference': reference,
      'Member': [Number(member.id)],
      'Updated': now,
      'Match status': 'Matched',
      'Reconciled': true,
      'Included in credit': true
    };

    const created = await createRow(cfg, cfg.transactions, fields);
    return page(
      'Imported successfully.',
      200,
      `${reference} · £${Number(tx.Total).toFixed(2)} · ${memberReference(member)} · Account Transactions row ${created?.id ?? 'created'}`
    );
  } catch (error) {
    return page(`Import test failed: ${String(error.message || error)}`, 500);
  }
}
