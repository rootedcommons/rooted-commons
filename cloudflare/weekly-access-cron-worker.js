function londonWindow(date=new Date()){
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{
    timeZone:'Europe/London',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'
  }).formatToParts(date).filter(part=>part.type!=='literal').map(part=>[part.type,part.value]));
  return parts.weekday==='Wed' && Number(parts.hour)===18 && Number(parts.minute)>=5 && Number(parts.minute)<35;
}

export default {
  async scheduled(_event,env,ctx){
    if(!londonWindow()) return;
    ctx.waitUntil(fetch(env.ROOTED_WEEKLY_ACCESS_URL,{
      method:'POST',
      headers:{'x-weekly-access-key':env.WEEKLY_ACCESS_SYNC_KEY}
    }).then(async response=>{
      if(!response.ok) throw new Error(`Weekly access sync failed (${response.status}): ${(await response.text()).slice(0,500)}`);
    }));
  }
};
