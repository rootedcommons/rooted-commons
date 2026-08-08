import { envConfig } from '../_baserow.js';
import { authenticatedMember, createDeviceSession, safeReturnPath, sessionCookie } from '../_auth.js';

export async function onRequestGet({request,env}){
  const url=new URL(request.url);
  const token=url.searchParams.get('token')||'';
  const returnPath=safeReturnPath(url.searchParams.get('return')||'/dashboard/');
  if(!token)return Response.redirect(new URL('/signin/?status=invalid',request.url),302);
  try{
    const cfg=envConfig(env);
    const auth=await authenticatedMember(cfg,request,env,token);
    if(!auth)return Response.redirect(new URL('/signin/?status=invalid',request.url),302);

    // A weekly access link is only the entry credential. Exchange it for a
    // separate remembered-device session so weekly link rotation does not sign out
    // devices that have already authenticated.
    const purpose=String(auth.session?.Purpose||'');
    const device=(purpose==='Device session' && !auth.legacy)
      ? {token,session:auth.session}
      : await createDeviceSession(cfg,auth.member.id,env);

    const headers=new Headers({
      Location:new URL(returnPath,request.url).toString(),
      'Set-Cookie':sessionCookie(device.token,device.session['Expires at']),
      'Cache-Control':'no-store',
      'Referrer-Policy':'no-referrer'
    });
    return new Response(null,{status:302,headers});
  }catch(error){
    console.error('access failed',error);
    return Response.redirect(new URL('/signin/?status=error',request.url),302);
  }
}
