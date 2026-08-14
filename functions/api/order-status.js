import { envConfig, json, listRows, truthy, unwrap } from '../_baserow.js';

export async function onRequestGet({ env }) {
  try {
    const cfg=envConfig(env);
    if(!cfg.settings)return json({ok:true,closed:false,message:''},200);
    const rows=await listRows(cfg,cfg.settings);
    const row=rows.find(item=>unwrap(item['Site title']) || item['Header logo']) || rows[0];
    const closed=row ? truthy(row['Orders temporarily closed'],false) : false;
    const message=unwrap(row?.['Orders closed message']) || 'Orders are currently closed. Please check back when the next market opens.';
    return json({ok:true,closed,message},200);
  } catch(error) {
    console.error('order status lookup failed',error);
    return json({ok:false,closed:false,message:''},500);
  }
}
