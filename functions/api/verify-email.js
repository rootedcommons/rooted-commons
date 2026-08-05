import { envConfig, listRows, tokenValid, updateRow } from '../_baserow.js';

function redirect(request, path) {
  return Response.redirect(new URL(path, request.url).toString(), 302);
}

export async function onRequestGet({ request, env }) {
  try {
    const token=new URL(request.url).searchParams.get('token')||'';
    if(!token)return redirect(request,'/signup/?verification=invalid');
    const cfg=envConfig(env);
    const members=await listRows(cfg,cfg.members);
    const member=members.find(row=>tokenValid(row,token));
    if(!member)return redirect(request,'/signup/?verification=invalid');
    await updateRow(cfg,cfg.members,member.id,{
      'Email verified':true,
      'Email verified at':new Date().toISOString()
    });
    return redirect(request,`/dashboard/?token=${encodeURIComponent(token)}&verified=1`);
  } catch {
    return redirect(request,'/signup/?verification=error');
  }
}
