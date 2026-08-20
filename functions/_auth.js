import { createRow, deleteRow, getRow, linkedIds, listRows, listRowsFiltered, unwrap, updateRow } from './_baserow.js';

const SESSION_PREFIX='rcs_';
const COOKIE_NAME='rc_session';
const ACCESS_PURPOSE='Weekly access';
const DEVICE_PURPOSE='Device session';
const DEVICE_SESSION_DAYS=90;
const encoder=new TextEncoder();

const bytesToBase64Url=bytes=>{
  let binary='';
  for(const b of bytes) binary+=String.fromCharCode(b);
  return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
};
const base64UrlToBytes=value=>{
  const padded=String(value).replace(/-/g,'+').replace(/_/g,'/')+'==='.slice((String(value).length+3)%4);
  const binary=atob(padded);
  return Uint8Array.from(binary,c=>c.charCodeAt(0));
};
const randomId=(bytes=18)=>bytesToBase64Url(crypto.getRandomValues(new Uint8Array(bytes)));

async function hmacKey(secret){
  if(!secret) throw new Error('AUTH_SESSION_SECRET is missing');
  return crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
}
async function signatureFor(sessionId,secret){
  const key=await hmacKey(secret);
  return bytesToBase64Url(new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(sessionId))));
}
export async function buildSessionToken(sessionId,secret){
  return `${SESSION_PREFIX}${sessionId}.${await signatureFor(sessionId,secret)}`;
}
async function verifySignedToken(token,secret){
  if(!String(token).startsWith(SESSION_PREFIX)) return null;
  const raw=String(token).slice(SESSION_PREFIX.length);
  const dot=raw.indexOf('.');
  if(dot<1) return null;
  const sessionId=raw.slice(0,dot);
  const signature=raw.slice(dot+1);
  if(!sessionId||!signature) return null;
  try{
    const key=await hmacKey(secret);
    const ok=await crypto.subtle.verify('HMAC',key,base64UrlToBytes(signature),encoder.encode(sessionId));
    return ok?sessionId:null;
  }catch{return null;}
}

export function nextWednesdayExpiry(from=new Date()){
  const format=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
  const parts=Object.fromEntries(format.formatToParts(from).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
  const weekday={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6}[parts.weekday];
  const localMinutes=Number(parts.hour)*60+Number(parts.minute);
  let days=(3-weekday+7)%7;
  if(days===0 && localMinutes>=18*60+5) days=7;
  const localDate=new Date(Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day)));
  localDate.setUTCDate(localDate.getUTCDate()+days);
  const y=localDate.getUTCFullYear(),m=localDate.getUTCMonth()+1,d=localDate.getUTCDate();
  const targetAsUtc=Date.UTC(y,m-1,d,18,5,0,0);
  let guess=new Date(targetAsUtc);
  for(let i=0;i<3;i+=1){
    const seen=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(guess).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
    const seenAsUtc=Date.UTC(Number(seen.year),Number(seen.month)-1,Number(seen.day),Number(seen.hour),Number(seen.minute));
    guess=new Date(guess.getTime()+(targetAsUtc-seenAsUtc));
  }
  return guess.toISOString();
}

export function deviceSessionExpiry(from=new Date()){
  return new Date(from.getTime()+DEVICE_SESSION_DAYS*86400000).toISOString();
}

export function sessionUsable(session,now=new Date()){
  if(!session) return false;
  const expiry=new Date(session['Expires at']||0).getTime();
  return Number.isFinite(expiry)&&expiry>now.getTime();
}

const LAST_USED_WRITE_INTERVAL_MS=24*60*60*1000;
async function touchSessionLastUsed(cfg,session,now=new Date()){
  if(!session?.id)return;
  const previous=new Date(session['Last used at']||0).getTime();
  if(Number.isFinite(previous)&&now.getTime()-previous>=0&&now.getTime()-previous<LAST_USED_WRITE_INTERVAL_MS)return;
  const usedAt=now.toISOString();
  try{
    await updateRow(cfg,cfg.sessions,session.id,{'Last used at':usedAt});
    session['Last used at']=usedAt;
  }catch(error){
    console.warn('Unable to update session last-used timestamp',{sessionId:session.id,error});
  }
}

export async function createSignedSession(cfg,memberId,env,{purpose=ACCESS_PURPOSE,expiresAt=nextWednesdayExpiry()}={}){
  if(!cfg.sessions) throw new Error('BASEROW_MEMBER_SESSIONS_TABLE_ID is missing');
  const sessionId=randomId();
  const createdAt=new Date().toISOString();
  const session=await createRow(cfg,cfg.sessions,{
    Name:`Member ${memberId} · ${purpose}`,
    Member:[Number(memberId)],
    'Session ID':sessionId,
    'Created at':createdAt,
    'Expires at':expiresAt,
    ...(purpose===DEVICE_PURPOSE?{'Last used at':createdAt}:{}),
    Purpose:purpose
  });
  return {session,token:await buildSessionToken(sessionId,env.AUTH_SESSION_SECRET)};
}

export async function getOrCreateCurrentAccessSession(cfg,memberId,env){
  if(!cfg.sessions) throw new Error('BASEROW_MEMBER_SESSIONS_TABLE_ID is missing');
  const sessions=await listRowsFiltered(cfg,cfg.sessions,{Member:{operator:'link_row_has',value:Number(memberId)}},{size:50});
  const current=sessions
    .filter(s=>linkedIds(s.Member).includes(Number(memberId)) && s['Session ID'] && sessionUsable(s) && String(s.Purpose||'')===ACCESS_PURPOSE)
    .sort((a,b)=>new Date(b['Created at']||0)-new Date(a['Created at']||0))[0];
  if(current) return {session:current,token:await buildSessionToken(String(current['Session ID']),env.AUTH_SESSION_SECRET)};
  return replaceWeeklyAccessSession(cfg,memberId,env,{existingSessions:sessions,expiresAt:nextWednesdayExpiry()});
}


export async function createDeviceSession(cfg,memberId,env){
  return createSignedSession(cfg,memberId,env,{purpose:DEVICE_PURPOSE,expiresAt:deviceSessionExpiry()});
}

export async function replaceWeeklyAccessSession(cfg,memberId,env,{existingSessions=null,expiresAt=nextWednesdayExpiry()}={}){
  if(!cfg.sessions) throw new Error('BASEROW_MEMBER_SESSIONS_TABLE_ID is missing');
  const sessions=existingSessions||await listRows(cfg,cfg.sessions);
  const current=sessions.filter(s=>
    linkedIds(s.Member).includes(Number(memberId)) &&
    String(s.Purpose||'')===ACCESS_PURPOSE
  );
  for(const session of current){
    if(session.id) await deleteRow(cfg,cfg.sessions,session.id);
  }
  return createSignedSession(cfg,memberId,env,{purpose:ACCESS_PURPOSE,expiresAt});
}

function cookieValue(request){
  const raw=request.headers.get('Cookie')||'';
  for(const piece of raw.split(';')){
    const [name,...rest]=piece.trim().split('=');
    if(name===COOKIE_NAME) return decodeURIComponent(rest.join('='));
  }
  return '';
}
export function tokenFromRequest(request,explicit=''){ return String(explicit||cookieValue(request)||''); }

async function sessionForToken(cfg,token,env){
  if(!token||!cfg.sessions) return null;
  const sessionId=await verifySignedToken(token,env.AUTH_SESSION_SECRET);
  if(!sessionId) return null;
  const matches=await listRowsFiltered(cfg,cfg.sessions,{'Session ID':sessionId},{size:2});
  const session=matches[0];
  return sessionUsable(session)?session:null;
}

export async function authenticatedMember(cfg,request,env,explicitToken=''){
  const token=tokenFromRequest(request,explicitToken);
  if(!token) return null;
  const session=await sessionForToken(cfg,token,env);
  if(!session) return null;
  const memberId=linkedIds(session.Member)[0];
  if(!memberId) return null;
  const member=await getRow(cfg,cfg.members,memberId);
  if(!member||unwrap(member['Membership status'])==='Closed') return null;
  await touchSessionLastUsed(cfg,session);
  return {member,session,token};
}

export function sessionCookie(token,expiresAt){
  const attrs=[`${COOKIE_NAME}=${encodeURIComponent(token)}`,'Path=/','HttpOnly','Secure','SameSite=Lax'];
  if(expiresAt){
    const d=new Date(expiresAt);
    if(Number.isFinite(d.getTime())) attrs.push(`Expires=${d.toUTCString()}`);
  }
  return attrs.join('; ');
}
export function clearSessionCookie(){return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;}
export function safeReturnPath(value='/dashboard/'){
  const path=String(value||'/dashboard/');
  return path.startsWith('/')&&!path.startsWith('//')?path:'/dashboard/';
}

export async function deleteExpiredSessions(cfg,sessions=[],now=new Date()){
  if(!cfg.sessions)return 0;
  let deleted=0;
  for(const session of sessions){
    if(!session?.id||sessionUsable(session,now))continue;
    try{
      await deleteRow(cfg,cfg.sessions,session.id);
      deleted+=1;
    }catch(error){
      console.warn('Unable to delete expired session',{sessionRowId:session.id,error});
    }
  }
  return deleted;
}

export async function deleteSession(cfg,session){
  if(!session?.id)return;
  await deleteRow(cfg,cfg.sessions,session.id);
}
