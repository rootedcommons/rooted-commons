
  const closeToggle=document.querySelector('#account-close-toggle'), closePanel=document.querySelector('#account-close-panel');
  closeToggle?.addEventListener('click',()=>{
    const willOpen=closePanel?.hidden ?? false;
    if (closePanel) closePanel.hidden=!willOpen;
    closeToggle.setAttribute('aria-expanded',String(willOpen));
  });
(()=>{
  const config=JSON.parse(document.querySelector('#account-config')?.textContent||'{}');
  const copy=config.copy||{};
  const loading=document.querySelector('#account-loading'),content=document.querySelector('#account-content'),form=document.querySelector('#account-details-form'),message=document.querySelector('#account-message');
  const money=value=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(Number(value)||0);
  const interpolate=(text,values={})=>String(text||'').replace(/\{(\w+)\}/g,(_,key)=>values[key]??'');
  let member=null,closeMode='close';
  const params=new URLSearchParams(location.search);
  const result=params.get('email_change');
  const resultMessages={confirmed:'Your new email address has been confirmed.',invalid:'That email-change link is invalid or has expired.',stale:'That email-change request is no longer current.',taken:'That email address is already used by another membership.',error:'We could not confirm the new email address.'};

  const loadDonationRecipients=async()=>{
    const select=document.querySelector('#account-donation-recipient');
    try{
      const response=await fetch('/api/public-network',{cache:'no-store'});
      if(!response.ok)return;
      const payload=await response.json();
      (payload.partners||[]).filter(partner=>partner?.id&&partner?.name&&partner.acceptsMemberCreditDonations&&String(partner.name).toLowerCase()!=='rooted commons').forEach(partner=>{
        const option=document.createElement('option');option.value=`partner:${partner.id}`;option.textContent=partner.name;select.append(option);
      });
    }catch(error){console.warn('Could not load network donation recipients',error);}
  };

  const renderClosureState=()=>{
    const credit=Number(member?.credit)||0;
    const positive=document.querySelector('#account-positive-credit'),negative=document.querySelector('#account-negative-credit'),zero=document.querySelector('#account-zero-credit');
    positive.hidden=true;negative.hidden=true;zero.hidden=true;
    if(credit>0.005){
      positive.hidden=false;
      document.querySelector('#account-credit-heading').textContent=interpolate(copy.creditHeading,{credit:money(credit)});
      document.querySelector('#account-donate-open').textContent=interpolate(copy.donateButton,{credit:money(credit)});
      const stopped=Boolean(member.regularCommitmentStoppedAt);
      document.querySelector('#account-stop-commitment').hidden=stopped;
      document.querySelector('#account-stopped-message').hidden=!stopped;
    }else if(credit<-0.005){
      negative.hidden=false;document.querySelector('#account-negative-credit-copy').textContent=interpolate(copy.negativeCredit,{credit:money(credit)});
    }else{
      zero.hidden=false;
      const notes=[];
      if(member.currentOrder)notes.push(`You currently have order ${member.currentOrder.orderNumber||member.currentOrder.id} in progress. Closing your membership will not cancel that order.`);
      document.querySelector('#account-close-context').textContent=notes.join(' ');
    }
  };

  const load=async()=>{
    const response=await fetch('/api/member',{cache:'no-store'});
    if(!response.ok){location.href='/signin/?return=/account/';return;}
    ({member}=await response.json());
    document.querySelector('#account-first-name').value=member.firstName||'';
    document.querySelector('#account-last-name').value=member.lastName||'';
    document.querySelector('#account-email').value=member.email||'';
    document.querySelector('#account-confirm-email').value=member.email||'';
    document.querySelector('#account-phone').value=member.phone||'';
    document.querySelector('#account-newsletter').checked=Boolean(member.weeklyNewsletter);
    renderClosureState();
    loading.hidden=true;content.hidden=false;
    if(result&&resultMessages[result])message.textContent=resultMessages[result];
    loadDonationRecipients();
  };

  form?.addEventListener('submit',async event=>{
    event.preventDefault();
    const email=document.querySelector('#account-email').value.trim(),confirmEmail=document.querySelector('#account-confirm-email').value.trim();
    if(email.toLowerCase()!==confirmEmail.toLowerCase()){message.textContent='The two email addresses do not match.';return;}
    const button=document.querySelector('#account-save');button.disabled=true;button.textContent=copy.saving||'Saving…';message.textContent='';
    try{
      const response=await fetch('/api/member',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({action:'details',firstName:document.querySelector('#account-first-name').value,lastName:document.querySelector('#account-last-name').value,email,confirmEmail,phone:document.querySelector('#account-phone').value,weeklyNewsletter:document.querySelector('#account-newsletter').checked})});
      const payload=await response.json();if(!response.ok||!payload.ok)throw new Error(payload.message||'Your details could not be updated.');
      member.firstName=payload.firstName;member.lastName=payload.lastName;member.phone=payload.phone;member.weeklyNewsletter=payload.weeklyNewsletter;message.textContent=payload.message||'Your details were saved.';
      if(!payload.emailChanged){member.email=email;document.querySelector('#account-confirm-email').value=email;}
    }catch(error){message.textContent=error?.message||'Your details could not be updated.';}
    button.disabled=false;button.textContent=copy.save||'Save changes';
  });

  document.querySelector('#account-stop-commitment')?.addEventListener('click',async()=>{
    const button=document.querySelector('#account-stop-commitment'),status=document.querySelector('#account-resolution-message');button.disabled=true;status.textContent='';
    try{
      const response=await fetch('/api/member',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({action:'stop-commitment'})});
      const payload=await response.json();if(!response.ok||!payload.ok)throw new Error(payload.message||'Your regular commitment could not be stopped.');
      member.regularCommitmentStoppedAt=payload.regularCommitmentStoppedAt||new Date().toISOString().slice(0,10);status.textContent=payload.message||'';renderClosureState();
    }catch(error){status.textContent=error?.message||'Your regular commitment could not be stopped.';button.disabled=false;}
  });

  const dialog=document.querySelector('#account-close-dialog');
  const openDialog=mode=>{
    closeMode=mode;
    const heading=document.querySelector('#account-close-dialog-heading'),body=document.querySelector('#account-close-confirm-body'),confirm=document.querySelector('#account-close-confirm'),select=document.querySelector('#account-donation-recipient');
    document.querySelector('#account-close-message').textContent='';
    if(mode==='donate'){
      const recipient=select.options[select.selectedIndex]?.textContent||'the selected organisation';
      heading.textContent=copy.donateConfirmHeading||'Donate your remaining Member Credit and close?';
      body.textContent=interpolate(copy.donateConfirmBody,{credit:money(member.credit),recipient});
      confirm.textContent=copy.confirmDonate||'Donate and close';
    }else{
      heading.textContent=copy.closeConfirmHeading||'Close your membership?';body.textContent=copy.closeConfirmBody||'';confirm.textContent=copy.confirmClose||'Close my membership';
    }
    dialog?.showModal();
  };
  document.querySelector('#account-close-open')?.addEventListener('click',()=>openDialog('close'));
  document.querySelector('#account-donate-open')?.addEventListener('click',()=>openDialog('donate'));
  document.querySelector('#account-close-keep')?.addEventListener('click',()=>dialog?.close());
  dialog?.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
  document.querySelector('#account-close-confirm')?.addEventListener('click',async()=>{
    const confirm=document.querySelector('#account-close-confirm'),keep=document.querySelector('#account-close-keep'),closeMessage=document.querySelector('#account-close-message');confirm.disabled=true;keep.disabled=true;closeMessage.textContent='';
    try{
      const body=closeMode==='donate'?{action:'resolve-credit-and-close',confirmClose:true,recipient:document.querySelector('#account-donation-recipient').value}:{action:'close-account',confirmClose:true};
      const response=await fetch('/api/member',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
      const payload=await response.json();if(!response.ok||!payload.ok)throw new Error(payload.message||'Your membership could not be closed.');
      location.href='/?membership=closed';
    }catch(error){closeMessage.textContent=error?.message||'Your membership could not be closed.';confirm.disabled=false;keep.disabled=false;}
  });
  load();
})();
