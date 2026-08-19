import { envConfig, listRows, createRow, linkedIds, number, truthy, unwrap, updateRow } from '../../_baserow.js';
import { refreshedConnection } from './_oauth.js';
import { fetchRecentReceives, isImportableMemberPayment, paymentReference, xeroDate } from './_payments.js';
import { expectedAmount, nextExpectedPayment } from '../../_membership-lifecycle.js';

function memberReference(member) {
  const explicit = String(member?.['Member number'] || '').trim().toUpperCase();
  return explicit || `RC-${member.id}`;
}

function transactionBelongsToMember(row, memberId) {
  return linkedIds(row?.Member).includes(Number(memberId));
}

async function fetchReceivePages(accessToken, tenantId, maxPages = 5) {
  const all = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const rows = await fetchRecentReceives(accessToken, tenantId, { page });
    all.push(...rows);
    if (rows.length < 100) break;
  }
  return all;
}

export async function syncMemberPayments(env, { maxPages = 5 } = {}) {
  const cfg = envConfig(env);
  if (!cfg.members || !cfg.transactions || !cfg.xeroSyncState) {
    throw new Error('Members, Account Transactions or Xero Sync State Baserow table ID is missing');
  }

  const attemptedAt = new Date().toISOString();
  let connection;
  try {
    connection = await refreshedConnection(env);
    await updateRow(cfg, cfg.xeroSyncState, connection.row.id, {
      'Last attempted sync': attemptedAt
    });

    const [xeroTransactions, members, accountTransactions] = await Promise.all([
      fetchReceivePages(connection.accessToken, connection.tenantId, maxPages),
      listRows(cfg, cfg.members),
      listRows(cfg, cfg.transactions)
    ]);

    const existingIds = new Set(
      accountTransactions
        .map(row => String(row['Xero BankTransactionsID'] || '').trim())
        .filter(Boolean)
    );

    const imported = [];
    const unmatched = [];
    const duplicates = [];
    const ignored = [];

    for (const tx of xeroTransactions) {
      const txId = String(tx?.BankTransactionID || '').trim();
      const reference = paymentReference(tx);

      // This integration is deliberately narrow: only exact RC-number member
      // references belong in the member-credit ledger. Other business receipts
      // remain in Xero and are ignored here.
      if (!reference || !isImportableMemberPayment(tx) || !txId) {
        ignored.push({ id: txId, reference: String(tx?.Reference || '') });
        continue;
      }

      if (existingIds.has(txId)) {
        duplicates.push({ id: txId, reference });
        continue;
      }

      const member = members.find(row => memberReference(row) === reference);
      const now = new Date().toISOString();

      if (!member) {
        const created = await createRow(cfg, cfg.transactions, {
          'Date': xeroDate(tx),
          'Type': 'Payment',
          'Amount': Math.round(Number(tx.Total) * 100) / 100,
          'Xero BankTransactionsID': txId,
          'Notes': `Xero member payment · no member matched ${reference}${tx.Contact?.Name ? ` · ${tx.Contact.Name}` : ''}`,
          'Payment reference': reference,
          'Updated': now,
          'Match status': 'Unmatched',
          'Reconciled': true,
          'Included in credit': false,
          'Source': 'Xero'
        });
        existingIds.add(txId);
        unmatched.push({ id: txId, reference, rowId: created?.id ?? null });
        continue;
      }

      const sameReferenceOtherMember = accountTransactions.find(row =>
        String(row['Payment reference'] || '').trim().toUpperCase() === reference &&
        linkedIds(row.Member).length &&
        !transactionBelongsToMember(row, member.id)
      );
      if (sameReferenceOtherMember) {
        throw new Error(`Safety check failed: ${reference} is already attached to a different member transaction (row ${sameReferenceOtherMember.id})`);
      }

      const created = await createRow(cfg, cfg.transactions, {
        'Date': xeroDate(tx),
        'Type': 'Payment',
        'Amount': Math.round(Number(tx.Total) * 100) / 100,
        'Xero BankTransactionsID': txId,
        'Notes': `Xero member payment${tx.Contact?.Name ? ` · ${tx.Contact.Name}` : ''}`,
        'Payment reference': reference,
        'Member': [Number(member.id)],
        'Updated': now,
        'Match status': 'Matched',
        'Reconciled': true,
        'Included in credit': true,
        'Source': 'Xero'
      });
      existingIds.add(txId);

      const regular=expectedAmount(member);
      const received=Math.round(Number(tx.Total) * 100) / 100;
      const isRegular=regular.amount > 0 && Math.abs(received-regular.amount) < 0.005;
      if(isRegular){
        const status=unwrap(member['Membership status']) || 'Active';
        const commitmentStopped=Boolean(String(member['Regular commitment stopped at']||'').trim());
        const memberPatch={};
        if(status!=='Closed'&&!commitmentStopped){
          const paymentDate=xeroDate(tx).slice(0,10);
          const anchor=String(member['Streak credited through']||'').slice(0,10);
          const frozenSince=String(member['Streak frozen since']||member['Regular payment overdue since']||'').slice(0,10);
          if(status==='Inactive'){
            memberPatch['Consecutive weeks']=0;
            memberPatch['Streak credited through']=paymentDate;
            memberPatch['Streak frozen since']=null;
            memberPatch['Streak status']='Active';
            memberPatch['Membership status']='Active';
          }else if(!anchor){
            // First qualifying commitment payment starts the streak clock at zero.
            memberPatch['Streak credited through']=paymentDate;
            if(status!=='Paused'){memberPatch['Streak frozen since']=null;memberPatch['Streak status']='Active';}
          }else if(status!=='Paused'&&frozenSince){
            // Resume after the complete frozen interval (missed payment and/or pause).
            const gapDays=Math.max(0,Math.round((new Date(`${paymentDate}T12:00:00Z`)-new Date(`${frozenSince}T12:00:00Z`))/86400000));
            const shifted=new Date(`${anchor}T12:00:00Z`);shifted.setUTCDate(shifted.getUTCDate()+gapDays);
            memberPatch['Streak credited through']=shifted.toISOString().slice(0,10);
            memberPatch['Streak frozen since']=null;
            memberPatch['Streak status']='Active';
            memberPatch['Membership status']='Active';
          }
          // A payment received during an approved pause can resolve a pre-pause overdue
          // payment, but it must not unfreeze the streak or end the pause.
          memberPatch['Regular payment expected at']=nextExpectedPayment(paymentDate,regular.frequency);
          memberPatch['Regular payment overdue since']=null;
          memberPatch['Membership inactive at']=null;
          memberPatch['Payment overdue email sent at']=null;
          memberPatch['Membership inactive email sent at']=null;
          memberPatch['Membership follow-up email sent at']=null;
        }
        if (!commitmentStopped && truthy(member['Commitment payment pending'], false)) {
          const changedDate=member['Commitment changed at'] ? new Date(member['Commitment changed at']).toISOString().slice(0,10) : '';
          const paymentDate=xeroDate(tx).slice(0,10);
          if(!changedDate || paymentDate >= changedDate) memberPatch['Commitment payment pending']=false;
        }
        if(Object.keys(memberPatch).length){
          await updateRow(cfg,cfg.members,member.id,memberPatch);
          Object.assign(member,memberPatch);
        }
      }

      imported.push({
        id: txId,
        reference,
        amount: Math.round(Number(tx.Total) * 100) / 100,
        memberId: Number(member.id),
        rowId: created?.id ?? null
      });
    }

    const successfulAt = new Date().toISOString();
    await updateRow(cfg, cfg.xeroSyncState, connection.row.id, {
      'Last successful sync': successfulAt,
      'Connection status': 'Connected',
      'Last error': '',
      'Consecutive failures': 0
    });

    return {
      ok: true,
      attemptedAt,
      successfulAt,
      scanned: xeroTransactions.length,
      imported,
      unmatched,
      duplicates: duplicates.length,
      ignored: ignored.length
    };
  } catch (error) {
    const message = String(error?.message || error);
    if (connection?.row?.id) {
      const failures = Number(connection.row['Consecutive failures'] || 0) + 1;
      await updateRow(cfg, cfg.xeroSyncState, connection.row.id, {
        'Last attempted sync': attemptedAt,
        'Connection status': 'Error',
        'Last error': message.slice(0, 4000),
        'Consecutive failures': failures
      }).catch(() => {});
    }
    throw error;
  }
}
