import { connect } from 'cloudflare:sockets';

const enc=new TextEncoder();
const dec=new TextDecoder();
const b64=value=>{const bytes=enc.encode(String(value));let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);return btoa(binary);};
const dotStuff=value=>String(value).replace(/^\./gm,'..');

async function smtpResponse(reader){
  let text='';
  while(true){
    const {value,done}=await reader.read();
    if(done) break;
    text+=dec.decode(value,{stream:true});
    const lines=text.split(/\r?\n/).filter(Boolean);
    const last=lines[lines.length-1]||'';
    if(/^\d{3} /.test(last)) return {code:Number(last.slice(0,3)),text};
  }
  return {code:0,text};
}
async function command(writer,reader,value,expected){
  if(value!=null) await writer.write(enc.encode(`${value}\r\n`));
  const response=await smtpResponse(reader);
  const allowed=Array.isArray(expected)?expected:[expected];
  if(!allowed.includes(response.code)) throw new Error(`SMTP command failed (${response.code||'no response'})`);
  return response;
}

export async function sendMail(env,{to,subject,html,text}){
  const host=env.SMTP_HOST||'smtp.mailbox.org';
  const port=Number(env.SMTP_PORT||465);
  const username=env.SMTP_USERNAME;
  const password=env.SMTP_PASSWORD;
  const from=env.ACCESS_EMAIL_FROM||username;
  const fromName=env.EMAIL_FROM_NAME||'Rooted Commons';
  if(!username||!password||!from) throw new Error('SMTP email is not configured');

  const socket=connect({hostname:host,port},{secureTransport:'on'});
  await socket.opened;
  const reader=socket.readable.getReader();
  const writer=socket.writable.getWriter();
  try{
    await command(writer,reader,null,220);
    await command(writer,reader,'EHLO rootedcommons.uk',250);
    await command(writer,reader,'AUTH LOGIN',334);
    await command(writer,reader,b64(username),334);
    await command(writer,reader,b64(password),235);
    await command(writer,reader,`MAIL FROM:<${from}>`,250);
    await command(writer,reader,`RCPT TO:<${to}>`,[250,251]);
    await command(writer,reader,'DATA',354);
    const boundary=`rc_${crypto.randomUUID().replace(/-/g,'')}`;
    const messageId=`<${crypto.randomUUID()}@rootedcommons.uk>`;
    const message=[
      `From: ${fromName} <${from}>`,
      `To: <${to}>`,
      `Subject: ${subject}`,
      `Date: ${new Date().toUTCString()}`,
      `Message-ID: ${messageId}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: 8bit','',dotStuff(text||''),'',
      `--${boundary}`,
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: 8bit','',dotStuff(html||''),'',
      `--${boundary}--`,'','.'
    ].join('\r\n');
    await writer.write(enc.encode(`${message}\r\n`));
    const accepted=await smtpResponse(reader);
    if(accepted.code!==250) throw new Error(`SMTP message rejected (${accepted.code||'no response'})`);
    await writer.write(enc.encode('QUIT\r\n'));
    return true;
  } finally {
    try{writer.releaseLock();}catch{}
    try{reader.releaseLock();}catch{}
    try{await socket.close();}catch{}
  }
}
