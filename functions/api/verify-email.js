import { envConfig, updateRow } from '../_baserow.js';
import { authenticatedMember, createDeviceSession, safeReturnPath, sessionCookie } from '../_auth.js';

function redirectWithCookie(request,path,cookie=''){
  const headers=new Headers({Location:new URL(path,request.url).toString(),'Cache-Control':'no-store','Referrer-Policy':'no-referrer'});
  if(cookie)headers.set('Set-Cookie',cookie);
  return new Response(null,{status:302,headers});
}

export async function onRequestGet({request,env}){
  try{
    const url=new URL(request.url);
    const token=url.searchParams.get('token')||'';
    const returnPath=safeReturnPath(url.searchParams.get('return')||'/dashboard/');
    if(!token)return redirectWithCookie(request,'/signup/?verification=invalid');
    const cfg=envConfig(env);
    const auth=await authenticatedMember(cfg,request,env,token);
    if(!auth)return redirectWithCookie(request,'/signup/?verification=invalid');
    await updateRow(cfg,cfg.members,auth.member.id,{'Email verified at':new Date().toISOString()});
    const device=await createDeviceSession(cfg,auth.member.id,env);
    const destination=returnPath==='/dashboard/'?'/dashboard/?verified=1':returnPath;
    return redirectWithCookie(request,destination,sessionCookie(device.token,device.session['Expires at']));
  }catch(error){
    console.error('email verification failed',error);
    return redirectWithCookie(request,'/signup/?verification=error');
  }
}
