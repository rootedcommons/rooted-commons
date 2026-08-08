import { envConfig, updateRow } from '../_baserow.js';
import { authenticatedMember, createDeviceSession, sessionCookie } from '../_auth.js';

function redirectWithCookie(request,path,cookie=''){
  const headers=new Headers({Location:new URL(path,request.url).toString(),'Cache-Control':'no-store','Referrer-Policy':'no-referrer'});
  if(cookie)headers.set('Set-Cookie',cookie);
  return new Response(null,{status:302,headers});
}

export async function onRequestGet({request,env}){
  try{
    const token=new URL(request.url).searchParams.get('token')||'';
    if(!token)return redirectWithCookie(request,'/signup/?verification=invalid');
    const cfg=envConfig(env);
    const auth=await authenticatedMember(cfg,request,env,token);
    if(!auth)return redirectWithCookie(request,'/signup/?verification=invalid');
    await updateRow(cfg,cfg.members,auth.member.id,{'Email verified':true,'Email verified at':new Date().toISOString()});
    const device=await createDeviceSession(cfg,auth.member.id,env);
    return redirectWithCookie(request,'/dashboard/?verified=1',sessionCookie(device.token,device.session['Expires at']));
  }catch(error){
    console.error('email verification failed',error);
    return redirectWithCookie(request,'/signup/?verification=error');
  }
}
