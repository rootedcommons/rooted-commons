import { envConfig } from '../_baserow.js';
import { authenticatedMember, createDeviceSession, revokeSession, safeReturnPath, sessionCookie } from '../_auth.js';

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
    let device;
    if(purpose==='Device session'){
      device={token,session:auth.session};
    }else{
      // If this browser already has a valid device session for the same member,
      // keep it rather than creating an orphaned replacement each time the
      // weekly email link is opened. If the browser is switching members,
      // revoke the previous browser session before creating the new one.
      const existingDevice=await authenticatedMember(cfg,request,env);
      if(existingDevice && String(existingDevice.session?.Purpose||'')==='Device session'){
        if(Number(existingDevice.member.id)===Number(auth.member.id)){
          device={token:existingDevice.token,session:existingDevice.session};
        }else{
          await revokeSession(cfg,existingDevice.session);
          device=await createDeviceSession(cfg,auth.member.id,env);
        }
      }else{
        device=await createDeviceSession(cfg,auth.member.id,env);
      }
    }

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
