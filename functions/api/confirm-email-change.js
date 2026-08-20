import { deleteRow, envConfig, fileUrl, listRows, listRowsFiltered, normaliseEmail, unwrap, updateRow } from '../_baserow.js';
import { createDeviceSession, sessionCookie } from '../_auth.js';
import { emailChangeSecurityNotice, hashEmailChangeToken } from '../_email-change.js';
import { sendMail } from '../_smtp.js';
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
    const previousEmail=normaliseEmail(member.Email);
    const duplicate=await listRowsFiltered(cfg,cfg.members,{Email:pending},{size:5});
    if(duplicate.some(row=>Number(row.id)!==Number(member.id)&&normaliseEmail(row.Email)===pending))return redirect(request,'/account/?email_change=taken');
    await updateRow(cfg,cfg.members,member.id,{Email:pending,'Email verified at':new Date().toISOString(),'Pending email':null,'Email change token hash':'','Email change expires at':null});
    if(cfg.sessions){
      const sessions=await listRowsFiltered(cfg,cfg.sessions,{Member:{operator:'link_row_has',value:Number(member.id)}},{size:100,all:true});
      for(const session of sessions){
        if(session.id)await deleteRow(cfg,cfg.sessions,session.id);
      }
    }
    const device=await createDeviceSession(cfg,member.id,env);
    if(previousEmail&&previousEmail!==pending){
      try{
        const settingsRows=cfg.settings?await listRows(cfg,cfg.settings):[];
        const settings=settingsRows.find(row=>unwrap(row['Site title']))||settingsRows[0]||{};
        const notice=emailChangeSecurityNotice({newEmail:pending,headerLogoUrl:fileUrl(settings['Header logo'])});
        await sendMail(env,{to:previousEmail,subject:'Your Rooted Commons email address was changed',html:notice.html,text:notice.text});
      }catch(error){
        console.error('old-address email-change security notification failed',{memberId:member.id,error});
      }
    }
    return redirect(request,'/account/?email_change=confirmed',sessionCookie(device.token,device.session['Expires at']));
  }catch(error){console.error('email change confirmation failed',error);return redirect(request,'/account/?email_change=error');}
}
