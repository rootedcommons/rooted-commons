const configNode=document.querySelector('#signup-config');
const {collectionPoints=[]}=JSON.parse(configNode?.textContent||'{}');
    const form=document.querySelector('#signup-form');
    const message=document.querySelector('#signup-message');
    const success=document.querySelector('#signup-success');
    const daySelect=document.querySelector('#signup-collection-day');
    const pointSelect=document.querySelector('#signup-collection-point');
    const lateNote=document.querySelector('#signup-late-collection-note');
    const amountInput=document.querySelector('#signup-contribution-amount');
    const amountLabel=document.querySelector('#signup-contribution-label');
    const amountSuffix=document.querySelector('#signup-contribution-suffix');
    const amountHelp=document.querySelector('#signup-contribution-help');
    const frequencyInputs=[...document.querySelectorAll('input[name="contributionFrequency"]')];
    const contributionStepButtons=[...document.querySelectorAll('[data-contribution-step]')];
    const existingMember=document.querySelector('#signup-existing-member');
    const existingMemberStatus=document.querySelector('#signup-existing-member-status');
    const sendLoginButton=document.querySelector('#signup-send-login');
    const SIGNUP_DRAFT_KEY='rooted-commons-signup-draft-v1';
    const savedMapPoint=Number(localStorage.getItem('rooted-commons-signup-collection-point')||0);
    try{
      const draft=JSON.parse(sessionStorage.getItem(SIGNUP_DRAFT_KEY)||'null');
      if(draft){
        Object.entries(draft).forEach(([name,value])=>{
          const fields=[...form.querySelectorAll(`[name="${name}"]`)];
          fields.forEach(field=>{
            if(field.type==='radio')field.checked=field.value===value;
            else if(field.type==='checkbox')field.checked=Boolean(value);
            else field.value=value??'';
          });
        });
      }
    }catch{}
    document.querySelector('.signup-map-link')?.addEventListener('click',()=>{
      const draft={};
      new FormData(form).forEach((value,key)=>{if(key!=='cf-turnstile-response')draft[key]=value;});
      draft.membershipConsent=Boolean(form.querySelector('[name="membershipConsent"]')?.checked);
      draft.weeklyNewsletter=Boolean(form.querySelector('[name="weeklyNewsletter"]')?.checked);
      sessionStorage.setItem(SIGNUP_DRAFT_KEY,JSON.stringify(draft));
    });

    const escapeHtml=(value)=>String(value??'').replace(/[&<>'\"]/g,(char)=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[char]));
    const roundMoney=(value)=>Math.round((Number(value)+Number.EPSILON)*100)/100;
    function refreshCollectionPoints(){
      if(!pointSelect)return;
      const existing=pointSelect.value;
      pointSelect.innerHTML='<option value="">Choose a collection point</option>'+(collectionPoints||[]).map(point=>`<option value="${point.id}">${escapeHtml(point.name)}</option>`).join('');
      if((collectionPoints||[]).some(point=>String(point.id)===String(existing)))pointSelect.value=existing;
      refreshCollectionDays();
    }
    function refreshCollectionDays(preferredDay=''){
      if(!daySelect)return;
      const point=(collectionPoints||[]).find(item=>String(item.id)===String(pointSelect?.value||''));
      const slots=point?.collectionSlots||[];
      const prior=preferredDay||daySelect.value||'Thursday';
      daySelect.innerHTML=slots.length
        ? slots.map(slot=>`<option value="${escapeHtml(slot.day)}">${escapeHtml(slot.day)} — ${escapeHtml(slot.time)}</option>`).join('')
        : '<option value="">Choose a collection point first</option>';
      if(slots.some(slot=>slot.day===prior))daySelect.value=prior;
      const day=daySelect.value||'';
      if(lateNote)lateNote.hidden=!day||day==='Thursday';
    }
    function selectedFrequency(){return frequencyInputs.find(input=>input.checked)?.value||'Weekly';}
    function refreshContribution(previousFrequency){
      if(!amountInput)return;
      const frequency=selectedFrequency();
      let current=Number(amountInput.value);
      if(Number.isFinite(current) && previousFrequency && previousFrequency!==frequency){
        current=frequency==='Monthly' ? roundMoney(current*52/12) : roundMoney(current*12/52);
      }
      if(frequency==='Monthly'){
        amountInput.min='43.33'; amountInput.step='0.01'; amountInput.value=(Number.isFinite(current)&&current>=43.33?current:43.33).toFixed(2);
        if(amountLabel)amountLabel.textContent=amountLabel.dataset.monthly||'Monthly commitment';
        if(amountSuffix)amountSuffix.textContent='/ month';
        if(amountHelp)amountHelp.textContent=amountHelp.dataset.monthly||'';
      }else{
        amountInput.min='10'; amountInput.step='0.01'; amountInput.value=(Number.isFinite(current)&&current>=10?current:10).toFixed(2);
        if(amountLabel)amountLabel.textContent=amountLabel.dataset.weekly||'Weekly commitment';
        if(amountSuffix)amountSuffix.textContent='/ week';
        if(amountHelp)amountHelp.textContent=amountHelp.dataset.weekly||'';
      }
    }
    pointSelect?.addEventListener('change',()=>refreshCollectionDays('Thursday'));
    daySelect?.addEventListener('change',()=>{if(lateNote)lateNote.hidden=!daySelect.value||daySelect.value==='Thursday';});
    let priorFrequency=selectedFrequency();
    frequencyInputs.forEach(input=>input.addEventListener('change',()=>{const old=priorFrequency;priorFrequency=selectedFrequency();refreshContribution(old);}));
    refreshCollectionPoints();
    if(savedMapPoint && pointSelect?.querySelector(`option[value="${savedMapPoint}"]`)){
      pointSelect.value=String(savedMapPoint);
      refreshCollectionDays('Thursday');
      localStorage.removeItem('rooted-commons-signup-collection-point');
    }
    refreshContribution();
    contributionStepButtons.forEach(button=>button.addEventListener('click',()=>{
      const delta=Number(button.dataset.contributionStep||0);
      const min=selectedFrequency()==='Monthly'?43.33:10;
      const current=Number(amountInput?.value||min);
      let next=min;
      if(delta>0){
        next=Math.abs(current-Math.round(current))<0.000001 ? current+1 : Math.ceil(current);
      }else if(delta<0){
        next=Math.abs(current-Math.round(current))<0.000001 ? current-1 : Math.floor(current);
      }
      next=Math.max(min,next);
      if(amountInput)amountInput.value=Number(next).toFixed(2);
    }));
    form?.addEventListener('submit',async(event)=>{
      event.preventDefault();message.textContent='';const button=form.querySelector('button[type="submit"]');button.disabled=true;
      try{
        const fd=new FormData(form);
        if(String(fd.get('email')||'').trim().toLowerCase()!==String(fd.get('confirmEmail')||'').trim().toLowerCase())throw new Error('Email addresses do not match.');
        const turnstileToken=fd.get('cf-turnstile-response')||document.querySelector('input[name="cf-turnstile-response"]')?.value||'';
        if(!turnstileToken)throw new Error('Please complete the security check and try again.');
        const response=await fetch('/api/signup',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({firstName:fd.get('firstName'),lastName:fd.get('lastName'),email:fd.get('email'),confirmEmail:fd.get('confirmEmail'),phone:fd.get('phone'),preferredCollectionDay:fd.get('preferredCollectionDay'),collectionPointId:Number(fd.get('collectionPointId')),contributionFrequency:fd.get('contributionFrequency'),contributionAmount:fd.get('contributionAmount'),membershipConsent:fd.get('membershipConsent')==='on',weeklyNewsletter:fd.get('weeklyNewsletter')==='on',productRequests:fd.get('productRequests'),turnstileToken})});
        const payload=await response.json();
        if(!response.ok){
          if(response.status===409&&payload.code==='existing_member'){
            message.textContent='';
            if(existingMember)existingMember.hidden=false;
            if(existingMemberStatus)existingMemberStatus.textContent='';
            button.disabled=false;
            if(window.turnstile)window.turnstile.reset();
            return;
          }
          throw new Error(payload.message||'Signup failed.');
        }
        if(existingMember)existingMember.hidden=true;
        const dashboardLink=document.querySelector('#signup-dashboard-link');
        if(dashboardLink&&payload.dashboardUrl)dashboardLink.href=payload.dashboardUrl;
        sessionStorage.removeItem(SIGNUP_DRAFT_KEY);form.hidden=true;document.querySelector('#signup-copy').hidden=true;success.hidden=false;
      }catch(error){message.textContent=error.message||'We could not create your membership. Please try again.';button.disabled=false;if(window.turnstile)window.turnstile.reset();}
    });

    sendLoginButton?.addEventListener('click',async()=>{
      const email=String(form.querySelector('[name="email"]')?.value||'').trim();
      sendLoginButton.disabled=true;
      if(existingMemberStatus)existingMemberStatus.textContent='Sending…';
      try{
        const response=await fetch('/api/request-link',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,returnPath:'/dashboard/'})});
        const payload=await response.json();
        if(existingMemberStatus)existingMemberStatus.textContent=payload.message||'If that email belongs to an active member, a secure login link will be sent.';
      }catch{
        if(existingMemberStatus)existingMemberStatus.textContent='We could not send a login link just now. Please try again.';
      }
      sendLoginButton.disabled=false;
    });
  
