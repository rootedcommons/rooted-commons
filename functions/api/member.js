import { envConfig, json, listRows, tokenValid, publicMember } from '../_baserow.js';
export async function onRequestGet({ request, env }) {
  try {
    const token = new URL(request.url).searchParams.get('token') || '';
    if (!token) return json({authenticated:false}, 401);
    const cfg=envConfig(env); const members=await listRows(cfg,cfg.members);
    const member=members.find(row=>tokenValid(row,token));
    if (!member) return json({authenticated:false},401);
    return json({authenticated:true, member:publicMember(member)});
  } catch (error) { return json({error:'Member lookup failed', detail:String(error.message||error)},500); }
}
