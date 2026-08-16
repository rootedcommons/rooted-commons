import { listRows, number, truthy, unwrap, updateRow } from './_baserow.js';

const MEMBER_TOKENS=['{{members}}','{{total_members}}','{{total_commitments}}'];
const TRANSACTION_TOKENS=['{{member_spending}}'];

export function metricTemplate(row){
  return unwrap(row['Display value']) || unwrap(row.Value);
}
export function hasComputedValueField(row){
  return row && Object.prototype.hasOwnProperty.call(row,'Computed value');
}
export function needsMemberStats(row){
  const template=metricTemplate(row);
  return MEMBER_TOKENS.some(token=>template.includes(token));
}
export function needsTransactionStats(row){
  const template=metricTemplate(row);
  return TRANSACTION_TOKENS.some(token=>template.includes(token));
}
export function memberStats(rows=[]){
  const active=rows.filter(row=>(unwrap(row['Membership status'])||'Active')!=='Closed');
  return {
    totalMembers:active.length,
    totalCommitments:active.reduce((sum,row)=>sum+number(row['Weekly commitment'],0),0)
  };
}
export function transactionStats(rows=[]){
  const orderChargeTotal=Math.abs(rows
    .filter(row=>['order-charge','order-charges'].includes(unwrap(row.Type).trim().toLowerCase().replace(/\s+/g,'-')))
    .reduce((sum,row)=>sum+number(row.Amount,0),0));
  return {memberSpending:orderChargeTotal};
}
export function resolveMetricTemplate(template,{members=null,transactions=null,partnerCount=null}={}){
  const replacements={
    '{{members}}':members?members.totalMembers.toLocaleString('en-GB'):'—',
    '{{total_members}}':members?members.totalMembers.toLocaleString('en-GB'):'—',
    '{{total_commitments}}':members?members.totalCommitments.toLocaleString('en-GB',{maximumFractionDigits:2}):'—',
    '{{member_spending}}':transactions?transactions.memberSpending.toLocaleString('en-GB',{maximumFractionDigits:0}):'—',
    '{{network_partners}}':Number.isFinite(partnerCount)?Number(partnerCount).toLocaleString('en-GB'):'—'
  };
  return Object.entries(replacements).reduce((result,[token,value])=>result.replaceAll(token,value),String(template||''));
}

export async function refreshMemberMetricCache(cfg,{memberRows=null}={}){
  if(!cfg.metrics||!cfg.members)return false;
  const metrics=await listRows(cfg,cfg.metrics);
  const target=metrics.filter(row=>hasComputedValueField(row)&&needsMemberStats(row));
  if(!target.length)return false;
  const members=memberStats(memberRows||await listRows(cfg,cfg.members));
  await Promise.all(target.map(row=>updateRow(cfg,cfg.metrics,row.id,{
    'Computed value':resolveMetricTemplate(metricTemplate(row),{members})
  })));
  return true;
}

export async function refreshTransactionMetricCache(cfg,{transactionRows=null}={}){
  if(!cfg.metrics||!cfg.transactions)return false;
  const metrics=await listRows(cfg,cfg.metrics);
  const target=metrics.filter(row=>hasComputedValueField(row)&&needsTransactionStats(row));
  if(!target.length)return false;
  const transactions=transactionStats(transactionRows||await listRows(cfg,cfg.transactions));
  await Promise.all(target.map(row=>updateRow(cfg,cfg.metrics,row.id,{
    'Computed value':resolveMetricTemplate(metricTemplate(row),{transactions})
  })));
  return true;
}
