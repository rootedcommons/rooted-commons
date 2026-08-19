import { envConfig, listRowsFiltered, normaliseEmail, truthy, unwrap, updateRow } from '../_baserow.js';
import { createDeviceSession, sessionCookie } from '../_auth.js';
import { hashEmailChangeToken } from '../_email-change.js';
function redirect(request,path,cookie=''){const headers=new Headers({Location:new URL(path,request.url).toString(),'Cache-Control':'no-store','Referrer-Policy':'no-referrer'});if(cookie)headers.set('Set-Cookie',cookie);return new Response(null,{status:302,headers});}
export async function onRequestGet({request,env}){
  try{
    const token=new URL(request.url).searchParams.get('token')||'';
    if(!token)return redirect(request,'/account/?email_change=invalid');
    const cfg=envConfig(env),hash=await hashEmailChangeToken(token);
    const matches=await listRowsFiltered(cfg,cfg.members,{'Email change token hash':hash},{size:2});
    const member=matches[0];
    if(!member)return redirect(request,'/account/?email_change=invalid');
    const expires=new Date(member['Email change expires at']||0).getTime();
    const pending=normaliseEmail(member['Pending email']);
    if(!pending||!Number.isFinite(expires)||Date.now()>expires){await updateRow(cfg,cfg.members,member.id,{'Pending email':null,'Email change token hash':'','Email change expires at':null}).catch(()=>{});return redirect(request,'/account/?email_change=invalid');}
    const duplicate=await listRowsFiltered(cfg,cfg.members,{Email:pending},{size:5});
    if(duplicate.some(row=>Number(row.id)!==Number(member.id)&&normaliseEmail(row.Email)===pending))return redirect(request,'/account/?email_change=taken');
    await updateRow(cfg,cfg.members,member.id,{Email:pending,'Email verified':true,'Email verified at':new Date().toISOString(),'Pending email':null,'Email change token hash':'','Email change expires at':null});
    if(cfg.sessions){
      const sessions=await listRowsFiltered(cfg,cfg.sessions,{Member:{operator:'link_row_has',value:Number(member.id)}},{size:100,all:true});
      const revokedAt=new Date().toISOString();
      for(const session of sessions){
        if(unwrap(session.Purpose)==='Weekly access'&&truthy(session.Active,true)&&!session['Revoked at'])await updateRow(cfg,cfg.sessions,session.id,{'Revoked at':revokedAt,Active:false});
      }
    }
    const device=await createDeviceSession(cfg,member.id,env);
    return redirect(request,'/account/?email_change=confirmed',sessionCookie(device.token,device.session['Expires at']));
  }catch(error){console.error('email change confirmation failed',error);return redirect(request,'/account/?email_change=error');}
}
