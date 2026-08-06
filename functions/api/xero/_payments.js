const BANK_TRANSACTIONS_URL = 'https://api.xero.com/api.xro/2.0/BankTransactions';

export async function fetchRecentReceives(accessToken, tenantId, { page = 1 } = {}) {
  const url = new URL(BANK_TRANSACTIONS_URL);
  url.searchParams.set('where', 'Type=="RECEIVE"');
  url.searchParams.set('order', 'Date DESC');
  url.searchParams.set('page', String(page));
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

export function paymentReference(tx) {
  const reference = String(tx?.Reference || '').trim().toUpperCase();
  return /^RC-\d+$/.test(reference) ? reference : '';
}

export function isImportableMemberPayment(tx) {
  return Boolean(
    tx &&
    tx.Type === 'RECEIVE' &&
    tx.IsReconciled === true &&
    String(tx.Status || '').toUpperCase() === 'AUTHORISED' &&
    Number(tx.Total) > 0 &&
    paymentReference(tx)
  );
}

export function xeroDate(tx) {
  const raw = String(tx?.DateString || tx?.Date || '').trim();
  if (!raw) return new Date().toISOString();
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}
