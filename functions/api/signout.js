import { envConfig } from '../_baserow.js';
import { authenticatedMember, clearSessionCookie, revokeSession } from '../_auth.js';

export async function onRequestGet({request,env}){
  try{
    const cfg=envConfig(env);
    const auth=await authenticatedMember(cfg,request,env);
    if(auth && String(auth.session?.Purpose||'')==='Device session') await revokeSession(cfg,auth.session);
  }catch(error){
    console.error('signout revoke failed',error);
  }
  const headers=new Headers({
    Location:new URL('/',request.url).toString(),
    'Set-Cookie':clearSessionCookie(),
    'Cache-Control':'no-store'
  });
  return new Response(null,{status:302,headers});
}
