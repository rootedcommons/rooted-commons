const configNode=document.querySelector('#dashboard-config');
const {badgeLogos,memberBadge,membershipPerks,collectionPoints,bankAccountName,bankSortCode,bankAccountNumber,copy}=JSON.parse(configNode?.textContent||'{}');
    const params=new URLSearchParams(location.search);
    const urlToken=params.get('token');
    if(urlToken){
      localStorage.removeItem('rooted-commons-order-token-v1');
      location.replace(`/api/access?token=${encodeURIComponent(urlToken)}&return=${encodeURIComponent('/dashboard/')}`);
    }
    const token='';
    const verifiedNotice=document.querySelector('#dashboard-email-verified');
    if(params.get('verified')==='1'&&verifiedNotice)verifiedNotice.hidden=false;

    const money=new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'});
    const formatDate=value=>value?new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric'}).format(new Date(value)):'';
    const interpolate=(template,values={})=>String(template||'').replace(/\{(\w+)\}/g,(_,key)=>values[key]??'');
    const escapeHtml=value=>String(value??'').replace(/[&<>\"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[ch]));
    const safeHref=value=>/^(?:\/|#|https?:\/\/|mailto:|tel:)/i.test(String(value||'').trim())?String(value).trim():'#';
    const richHtml=(template,values={})=>{
      let out=escapeHtml(interpolate(template,values));
      out=out.replace(/\[([^\]]+)\]\(([^)]+)\)/g,(_m,label,href)=>`<a href=\"${escapeHtml(safeHref(href))}\">${label}</a>`);
      out=out.replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>');
      out=out.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g,'<em>$1</em>');
      return out.replace(/\r?\n/g,'<br>');
    };

    const pointSelect=document.querySelector('#dashboard-point-select');
    const pointForm=document.querySelector('#dashboard-point-form');
    const daySelect=document.querySelector('#dashboard-day-select');
    const pointMessage=document.querySelector('#dashboard-point-message');
    const pauseArea=document.querySelector('#dashboard-pause-area');
    const pauseIntro=document.querySelector('#dashboard-pause-intro');
    const pauseActive=document.querySelector('#dashboard-pause-active');
    const pauseForm=document.querySelector('#dashboard-pause-form');
    const pauseStart=document.querySelector('#dashboard-pause-start');
    const pauseEnd=document.querySelector('#dashboard-pause-end');
    const pauseMessage=document.querySelector('#dashboard-pause-message');

    const populatePointSelect=(selectedId)=>{
      pointSelect.innerHTML=(collectionPoints||[]).map(point=>`<option value="${point.id}" ${Number(point.id)===Number(selectedId)?'selected':''}>${point.name}</option>`).join('');
    };
    const populateDaySelect=(selectedDay='')=>{
      const point=(collectionPoints||[]).find(item=>Number(item.id)===Number(pointSelect.value));
      const slots=point?.collectionSlots||[];
      daySelect.innerHTML=slots.map(slot=>`<option value="${slot.day}">${slot.day} — ${slot.time}</option>`).join('');
      if(slots.some(slot=>slot.day===selectedDay))daySelect.value=selectedDay;
    };
    const renderPointPreview=(point,selectedDay='')=>{
      point=point||{};
      document.querySelector('#dashboard-point-name').textContent=point.name||copy.collectionNotSelected;
      const slot=(point.collectionSlots||[]).find(item=>item.day===selectedDay)||(point.collectionSlots||[])[0];
      document.querySelector('#dashboard-point-time').textContent=slot?`${slot.day} · ${slot.time}`:(point.collectionTime||'');
      document.querySelector('#dashboard-point-address').textContent=point.address||'';
      const pointImage=document.querySelector('#dashboard-point-image');
      if(point.image){pointImage.src=point.image;pointImage.alt=point.name?interpolate(copy.collectionImageAlt,{name:point.name}):'';pointImage.hidden=false;}else{pointImage.hidden=true;pointImage.removeAttribute('src');}
    };
    pointSelect.addEventListener('change',()=>populateDaySelect(''));
    document.querySelector('#dashboard-change-point').addEventListener('click',()=>{pointForm.hidden=false;pointMessage.textContent='';pointSelect.focus();});
    document.querySelector('#dashboard-cancel-point').addEventListener('click',()=>{pointForm.hidden=true;pointMessage.textContent='';});

    pointForm.addEventListener('submit',async event=>{
      event.preventDefault();
      const button=pointForm.querySelector('button[type="submit"]');
      button.disabled=true;
      pointMessage.textContent=copy.collectionSaving;
      const response=await fetch('/api/member',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({collectionPointId:Number(pointSelect.value),preferredCollectionDay:daySelect.value})});
      const payload=await response.json();
      if(response.ok&&payload.ok){
        window.RootedData?.invalidate?.('member');
        const point=payload.collectionPoint||{};
        renderPointPreview(point,payload.preferredCollectionDay);
        pointMessage.textContent=copy.collectionUpdated;
        setTimeout(()=>{pointForm.hidden=true;pointMessage.textContent='';},900);
      }else pointMessage.textContent=payload.message||copy.collectionFailed;
      button.disabled=false;
    });

    const pauseRemaining=member=>{
      const year=new Date().getFullYear();
      return Number(member?.pauseAllowanceYear)===year?Math.max(0,8-(Number(member?.pauseWeeksUsed)||0)):8;
    };
    const renderPauseState=member=>{
      if(!pauseArea)return;
      const status=member?.membershipStatus||'Active';
      const remaining=pauseRemaining(member);
      if(status==='Inactive'||status==='Closed'){
        pauseArea.hidden=true;return;
      }
      pauseArea.hidden=false;
      const paused=status==='Paused';
      const futurePause=status==='Active'&&member?.pauseStarts&&new Date(`${String(member.pauseStarts).slice(0,10)}T23:59:59Z`).getTime()>Date.now();
      const showPauseState=paused||futurePause;
      pauseIntro.hidden=showPauseState;
      pauseActive.hidden=!showPauseState;
      pauseForm.hidden=true;
      if(paused){
        const date=formatDate(member.pauseEnds);
        document.querySelector('#dashboard-pause-active-heading').textContent=interpolate(copy.pauseActiveHeading,{date});
        document.querySelector('#dashboard-pause-active-body').innerHTML=richHtml(copy.pauseActiveBody,{weeks:Number(member.consecutiveWeeks)||0,remaining});
        document.querySelector('#dashboard-pause-end').textContent=copy.pauseEndEarly;
      }else if(futurePause){
        document.querySelector('#dashboard-pause-active-heading').textContent=copy.pauseScheduledHeading;
        document.querySelector('#dashboard-pause-active-body').innerHTML=richHtml(copy.pauseScheduledBody,{start:formatDate(member.pauseStarts),end:formatDate(member.pauseEnds),remaining});
        document.querySelector('#dashboard-pause-end').textContent=copy.pauseCancelScheduled;
      }else{
        document.querySelector('#dashboard-pause-allowance').textContent=interpolate(copy.pauseAllowance,{weeks:remaining});
      }
    };
    document.querySelector('#dashboard-pause-open')?.addEventListener('click',()=>{
      if(!currentMember)return;
      const today=new Date().toISOString().slice(0,10);
      pauseStart.min=today;pauseEnd.min=today;pauseStart.value=today;
      const defaultEnd=new Date(`${today}T12:00:00Z`);defaultEnd.setUTCDate(defaultEnd.getUTCDate()+7);pauseEnd.value=defaultEnd.toISOString().slice(0,10);
      pauseIntro.hidden=true;pauseForm.hidden=false;pauseMessage.textContent='';pauseStart.focus();
    });
    pauseStart?.addEventListener('change',()=>{if(pauseStart.value){pauseEnd.min=pauseStart.value;if(pauseEnd.value<=pauseStart.value){const d=new Date(`${pauseStart.value}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+7);pauseEnd.value=d.toISOString().slice(0,10);}}});
    document.querySelector('#dashboard-pause-form-cancel')?.addEventListener('click',()=>{pauseForm.hidden=true;pauseIntro.hidden=false;pauseMessage.textContent='';pauseStart.value='';pauseEnd.value='';});
    pauseForm?.addEventListener('submit',async event=>{
      event.preventDefault();
      const button=pauseForm.querySelector('button[type="submit"]');button.disabled=true;pauseMessage.textContent=copy.pauseSaving;
      try{
        const response=await fetch('/api/member',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({action:'pause',pauseStart:pauseStart.value,pauseEnd:pauseEnd.value})});
        const payload=await response.json();if(!response.ok||!payload.ok)throw new Error(payload.message||copy.pauseFailed);
        window.RootedData?.invalidate?.('member');location.reload();
      }catch(error){pauseMessage.textContent=error?.message||copy.pauseFailed;button.disabled=false;}
    });
    const pauseConfirmDialog=document.querySelector('#dashboard-pause-confirm-dialog');
    const pauseConfirmHeading=document.querySelector('#dashboard-pause-confirm-heading');
    const pauseConfirmBody=document.querySelector('#dashboard-pause-confirm-body');
    const pauseConfirmKeep=document.querySelector('#dashboard-pause-confirm-keep');
    const pauseConfirmAction=document.querySelector('#dashboard-pause-confirm-action');
    const pauseConfirmMessage=document.querySelector('#dashboard-pause-confirm-message');
    document.querySelector('#dashboard-pause-end')?.addEventListener('click',()=>{
      if(!currentMember||!pauseConfirmDialog)return;
      const scheduled=(currentMember.membershipStatus||'Active')!=='Paused';
      pauseConfirmHeading.textContent=scheduled?copy.pauseCancelScheduledConfirmHeading:copy.pauseEndEarlyConfirmHeading;
      pauseConfirmBody.textContent=scheduled?copy.pauseCancelScheduledConfirmBody:copy.pauseEndEarlyConfirmBody;
      pauseConfirmAction.textContent=scheduled?copy.pauseConfirmCancelScheduled:copy.pauseConfirmEnd;
      pauseConfirmMessage.textContent='';
      pauseConfirmDialog.showModal();
    });
    pauseConfirmKeep?.addEventListener('click',()=>pauseConfirmDialog?.close());
    pauseConfirmDialog?.addEventListener('click',event=>{if(event.target===pauseConfirmDialog)pauseConfirmDialog.close();});
    pauseConfirmAction?.addEventListener('click',async()=>{
      pauseConfirmAction.disabled=true;pauseConfirmKeep.disabled=true;pauseConfirmMessage.textContent='';
      try{
        const response=await fetch('/api/member',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({action:'end-pause'})});
        const payload=await response.json();if(!response.ok||!payload.ok)throw new Error(payload.message||copy.pauseFailed);
        window.RootedData?.invalidate?.('member');location.reload();
      }catch(error){pauseConfirmMessage.textContent=error?.message||copy.pauseFailed;pauseConfirmAction.disabled=false;pauseConfirmKeep.disabled=false;}
    });


    const addCalendarMonths=(value,months)=>{
      const raw=String(value||'').slice(0,10); if(!raw)return null;
      const parts=raw.split('-').map(Number); if(parts.length!==3||parts.some(n=>!Number.isFinite(n)))return null;
      const [year,month,day]=parts; const targetMonth=month-1+months;
      const targetYear=year+Math.floor(targetMonth/12); const normalizedMonth=((targetMonth%12)+12)%12;
      const lastDay=new Date(Date.UTC(targetYear,normalizedMonth+1,0)).getUTCDate();
      return new Date(Date.UTC(targetYear,normalizedMonth,Math.min(day,lastDay),12));
    };
    const freeWorkshopStatus=(unlocked)=>{
      if(!unlocked)return '';
      const next=addCalendarMonths(currentMember?.lastFreeWorkshopClaimed,6);
      if(!next||next.getTime()<=Date.now())return '\n\n**Available now**';
      const formatted=new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(next);
      return `\n\n**Next available ${formatted}**`;
    };
    const resolvePerkExplainer=(item,unlocked)=>String(item.explainer||'').replace(/\{\{free_workshop_status\}\}/g,freeWorkshopStatus(unlocked));

    const perkHtml=(item,countdown='',unlocked=false)=>{
      const id=`dashboard-perk-${Number(item.order)||0}-explainer`;
      const explainer=resolvePerkExplainer(item,unlocked).trimEnd();
      const info=explainer?`<button class="dashboard-perk-info-toggle" type="button" aria-label="More information about ${escapeHtml(item.label)}" aria-expanded="false" aria-controls="${id}" data-perk-info="${id}">ⓘ</button>`:'';
      const detail=explainer?`<div id="${id}" class="dashboard-perk-explainer" hidden>${richHtml(explainer)}</div>`:'';
      return `<li class="dashboard-perk-item"><div class="dashboard-perk-main"><div class="dashboard-perk-label-row"><span>${escapeHtml(item.label)}</span>${info}</div>${countdown?`<strong class="dashboard-perk-countdown">${escapeHtml(countdown)}</strong>`:''}</div>${detail}</li>`;
    };
    const renderPerks=(weeks,isNew)=>{
      const container=document.querySelector('#dashboard-perks');
      if(isNew){container.hidden=true;return;}
      const perks=(membershipPerks||[])
        .map(item=>({order:Number(item.order)||0,label:item.label,unlockWeeks:Number(item.unlockWeeks)||0,explainer:item.explainer||''}))
        .filter(item=>item.label)
        .sort((a,b)=>a.unlockWeeks-b.unlockWeeks||a.order-b.order);
      if(!perks.length){container.hidden=true;return;}
      const unlocked=perks.filter(item=>weeks>=item.unlockWeeks);
      const upcoming=perks.filter(item=>weeks<item.unlockWeeks);
      const unlockedHtml=unlocked.length
        ? `<h3>${copy.perksUnlocked}</h3><ul>${unlocked.map(item=>perkHtml(item,'',true)).join('')}</ul>`
        : '';
      const upcomingHtml=upcoming.length
        ? `<h3 class="dashboard-upcoming-perks-heading">${copy.perksUpcoming}</h3><ul class="dashboard-upcoming-perks">${upcoming.map(item=>{
            const remaining=item.unlockWeeks-weeks;
            return perkHtml(item,interpolate(copy.perkInWeeks,{weeks:remaining,plural:remaining===1?'':'s'}),false);
          }).join('')}</ul>`
        : '';
      container.innerHTML=unlockedHtml+upcomingHtml;
      container.querySelectorAll('[data-perk-info]').forEach(button=>button.addEventListener('click',()=>{
        const panel=document.getElementById(button.dataset.perkInfo||'');
        if(!panel)return;
        const willOpen=panel.hidden;
        container.querySelectorAll('[data-perk-info]').forEach(other=>{
          const otherPanel=document.getElementById(other.dataset.perkInfo||'');
          if(otherPanel)otherPanel.hidden=true;
          other.setAttribute('aria-expanded','false');
        });
        if(willOpen){
          panel.hidden=false;
          button.setAttribute('aria-expanded','true');
        }
      }));
      container.hidden=false;
    };

    const renderTopups=payments=>{
      const container=document.querySelector('#dashboard-topups');
      if(!payments?.length){container.innerHTML=`<p class="small-print">${copy.noPayments}</p>`;return;}
      container.innerHTML=payments.map(item=>`<div class="topup-line"><span>${formatDate(item.date)}${item.type?` · ${item.type}`:''}</span><strong>+${money.format(Math.abs(item.amount||0))}</strong></div>`).join('');
    };

    const renderActivity=activity=>{
      const container=document.querySelector('#dashboard-activity');
      if(!activity?.length){document.querySelector('#dashboard-account-activity').hidden=true;return;}
      container.innerHTML=activity.map(item=>{
        const amount=Number(item.amount)||0;
        const sign=amount>0?'+':'';
        return `<div class="activity-line"><span>${formatDate(item.date)}<small>${item.type||item.notes||''}</small></span><strong class="${amount<0?'amount-negative':'amount-positive'}">${sign}${money.format(amount)}</strong></div>`;
      }).join('');
    };

    const commitmentForm=document.querySelector('#dashboard-commitment-form');
    const commitmentInput=document.querySelector('#dashboard-commitment-input');
    const commitmentHelp=document.querySelector('#dashboard-commitment-help');
    const commitmentMessage=document.querySelector('#dashboard-commitment-message');
    const regularPaymentDetails=document.querySelector('#dashboard-regular-payment-details');
    const changeCommitmentButton=document.querySelector('#dashboard-change-commitment');
    const promptChangeCommitmentButton=document.querySelector('#dashboard-prompt-change-commitment');
    let currentMember=null;
    let currentCommitment={weekly:10,monthly:43.33,frequency:'Weekly'};
    let currentIsNew=false;

    const selectedCommitmentFrequency=()=>commitmentForm?.querySelector('input[name="commitmentFrequency"]:checked')?.value||'Weekly';
    const enteredCommitmentAmount=()=>Number(commitmentInput?.value||0);
    const displayMoney=value=>money.format(Number(value)||0).replace(/\.00$/,'');
    const setCommitmentDisplay=()=>{
      const frequency=currentCommitment.frequency==='Monthly'?'Monthly':'Weekly';
      const amount=frequency==='Monthly'?currentCommitment.monthly:currentCommitment.weekly;
      document.querySelector('#dashboard-commitment').textContent=displayMoney(amount);
      document.querySelector('#dashboard-commitment-suffix').textContent=frequency==='Monthly'?'/month':'/week';
    };
    const refreshCommitmentEditor=(frequency=selectedCommitmentFrequency(),previousFrequency='')=>{
      const monthly=frequency==='Monthly';
      const minimum=monthly?43.33:10;
      if(commitmentInput){
        commitmentInput.min=String(minimum);
        commitmentInput.step='0.01';
        let desired=monthly?currentCommitment.monthly:currentCommitment.weekly;
        const entered=Number(commitmentInput.value);
        if(previousFrequency&&previousFrequency!==frequency&&Number.isFinite(entered)){
          desired=monthly?entered*52/12:entered*12/52;
        }
        commitmentInput.value=Math.max(minimum,Math.round((desired+Number.EPSILON)*100)/100).toFixed(2);
      }
      if(commitmentHelp)commitmentHelp.textContent=monthly?copy.monthlyMinimum:copy.weeklyMinimum;
    };
    const openCommitmentEditor=()=>{
      if(!commitmentForm)return;
      const frequency=currentCommitment.frequency==='Monthly'?'Monthly':'Weekly';
      const radio=commitmentForm.querySelector(`input[name="commitmentFrequency"][value="${frequency}"]`);
      if(radio)radio.checked=true;
      editorFrequency=frequency;
      refreshCommitmentEditor(frequency);
      commitmentMessage.textContent='';
      commitmentForm.hidden=false;
      regularPaymentDetails.hidden=false;
      document.querySelector('#dashboard-regular-payment-heading').textContent=currentIsNew?copy.setupRegularPaymentHeading:copy.regularPaymentHeading;
      commitmentInput?.focus();
    };
    const closeCommitmentEditor=()=>{
      if(commitmentForm)commitmentForm.hidden=true;
      if(commitmentMessage)commitmentMessage.textContent='';
      renderRegularPaymentState();
    };
    changeCommitmentButton?.addEventListener('click',openCommitmentEditor);
    promptChangeCommitmentButton?.addEventListener('click',openCommitmentEditor);
    document.querySelector('#dashboard-cancel-commitment')?.addEventListener('click',closeCommitmentEditor);
    let editorFrequency='Weekly';
    commitmentForm?.querySelectorAll('input[name="commitmentFrequency"]').forEach(input=>input.addEventListener('change',()=>{
      const previous=editorFrequency;
      editorFrequency=input.value;
      refreshCommitmentEditor(input.value,previous);
    }));
    commitmentForm?.querySelectorAll('[data-commitment-step]').forEach(button=>button.addEventListener('click',()=>{
      const delta=Number(button.dataset.commitmentStep||0);
      const min=selectedCommitmentFrequency()==='Monthly'?43.33:10;
      const current=Number(commitmentInput?.value||min);
      let next=min;
      if(delta>0)next=Math.abs(current-Math.round(current))<0.000001?current+1:Math.ceil(current);
      else if(delta<0)next=Math.abs(current-Math.round(current))<0.000001?current-1:Math.floor(current);
      next=Math.max(min,next);
      if(commitmentInput)commitmentInput.value=Number(next).toFixed(2);
    }));
    commitmentForm?.addEventListener('submit',async event=>{
      event.preventDefault();
      const frequency=selectedCommitmentFrequency();
      const amount=enteredCommitmentAmount();
      const minimum=frequency==='Monthly'?43.33:10;
      if(!Number.isFinite(amount)||amount<minimum){
        commitmentMessage.textContent=frequency==='Monthly'?copy.monthlyMinimum:copy.weeklyMinimum;
        return;
      }
      const button=commitmentForm.querySelector('button[type="submit"]');
      button.disabled=true;
      commitmentMessage.textContent=copy.commitmentSaving;
      try{
        const response=await fetch('/api/member',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({action:'commitment',contributionFrequency:frequency,contributionAmount:amount})});
        const payload=await response.json();
        if(!response.ok||!payload.ok)throw new Error(payload.message||copy.commitmentFailed);
        window.RootedData?.invalidate?.('member');
        currentCommitment={weekly:Number(payload.weeklyCommitment)||10,monthly:Number(payload.monthlyEquivalent)||43.33,frequency:payload.contributionFrequency||frequency};
        if(currentMember){currentMember.weeklyCommitment=currentCommitment.weekly;currentMember.monthlyEquivalent=currentCommitment.monthly;currentMember.contributionFrequency=currentCommitment.frequency;currentMember.commitmentPaymentPending=Boolean(payload.commitmentPaymentPending);currentMember.commitmentChangedAt=payload.commitmentChangedAt||new Date().toISOString();currentMember.regularPaymentOverdueSince='';currentMember.regularPaymentExpectedAt=payload.regularPaymentExpectedAt||currentMember.regularPaymentExpectedAt;currentMember.regularCommitmentStoppedAt='';}
        setCommitmentDisplay();
        document.querySelector('#dashboard-regular-payment-heading').textContent=copy.regularPaymentHeading;
        renderRegularPaymentState();
        if(payload.revertedToConfirmed){commitmentForm.hidden=true;commitmentMessage.textContent='';}
        else commitmentMessage.textContent=copy.commitmentUpdated;
        updateCommitmentPrompt();
      }catch(error){commitmentMessage.textContent=error?.message||copy.commitmentFailed;}
      button.disabled=false;
    });

    const renderRegularPaymentState=()=>{
      const pending=Boolean(currentMember?.commitmentPaymentPending);
      const stopped=Boolean(currentMember?.regularCommitmentStoppedAt);
      const status=currentMember?.membershipStatus||'Active';
      const overdue=Boolean(currentMember?.regularPaymentOverdueSince)&&status==='Active';
      const inactive=status==='Inactive';
      const paused=status==='Paused';
      const reminder=document.querySelector('#dashboard-regular-payment-reminder');
      const reminderHeading=document.querySelector('#dashboard-regular-payment-reminder-heading');
      const reminderBody=document.querySelector('#dashboard-regular-payment-reminder-body');
      const body=document.querySelector('#dashboard-regular-payment-body');
      const showReminder=(heading,content)=>{reminderHeading.textContent=heading;reminderBody.innerHTML=richHtml(content);reminder.hidden=false;if(body)body.hidden=true;regularPaymentDetails.hidden=false;};
      if(paused){
        reminder.hidden=true;if(body)body.hidden=false;regularPaymentDetails.hidden=true;
      }else if(inactive){
        document.querySelector('#dashboard-regular-payment-heading').textContent=copy.regularPaymentHeading;
        showReminder(copy.inactiveHeading,copy.inactiveBody);
      }else if(overdue){
        document.querySelector('#dashboard-regular-payment-heading').textContent=copy.regularPaymentHeading;
        showReminder(copy.paymentOverdueHeading,copy.paymentOverdueBody);
      }else if(stopped){
        document.querySelector('#dashboard-regular-payment-heading').textContent=copy.regularPaymentHeading;
        showReminder(copy.commitmentStoppedHeading,copy.commitmentStoppedBody);
      }else if(pending){
        const frequency=currentCommitment.frequency==='Monthly'?'monthly':'weekly';
        const amount=currentCommitment.frequency==='Monthly'?currentCommitment.monthly:currentCommitment.weekly;
        document.querySelector('#dashboard-regular-payment-heading').textContent=copy.regularPaymentHeading;
        showReminder(copy.updateRegularPaymentHeading,interpolate(copy.commitmentPaymentReminder,{frequency,amount:displayMoney(amount),period:frequency==='monthly'?'month':'week'}));
      }else{
        reminder.hidden=true;
        if(body)body.hidden=false;
        document.querySelector('#dashboard-regular-payment-heading').textContent=currentIsNew?copy.setupRegularPaymentHeading:copy.regularPaymentHeading;
        regularPaymentDetails.hidden=!currentIsNew;
      }
    };

    const updateCommitmentPrompt=()=>{
      const weeks=Number(currentMember?.consecutiveWeeks)||0;
      const metrics=document.querySelector('#dashboard-commitment-metrics');
      const prompt=document.querySelector('#dashboard-increase-prompt');
      if(weeks<8){metrics.hidden=true;prompt.hidden=true;return;}
      const average=Number(currentMember?.account?.averageWeeklySpend)||0;
      metrics.hidden=false;
      document.querySelector('#dashboard-average-spend').textContent=money.format(average);
      const weekly=Number(currentCommitment.weekly)||0;
      const threshold=Math.max(2,weekly*.15);
      const show=average>=weekly+threshold;
      prompt.hidden=!show;
      if(show)document.querySelector('#dashboard-increase-copy').textContent=interpolate(copy.increasePrompt,{average:money.format(average),commitment:displayMoney(weekly)});
    };

    document.querySelectorAll('input[name="dashboard-payment-method"]').forEach(input=>input.addEventListener('change',()=>{
      if(!input.checked)return;
      document.querySelector('#dashboard-payment-bank').hidden=input.value!=='bank';
      document.querySelector('#dashboard-payment-card').hidden=input.value!=='card';
      document.querySelector('#dashboard-payment-open-banking').hidden=input.value!=='open-banking';
    }));

    async function load(){
      const response=await (window.RootedData?.member?.() || fetch('/api/member',{cache:'no-store'}));
      if(!response.ok){
        if(response.status===401)window.__rootedSetAuthState?.(false);
        document.querySelector('#dashboard-loading').innerHTML=`<h2>${copy.invalidHeading}</h2><p>${copy.invalidBody}</p>`;
        return;
      }
      window.__rootedSetAuthState?.(true);
      const {member}=await response.json();
      const totalPayments=Number(member.account?.totalPaymentsReceived)||0;
      const isNew=totalPayments<=0;

      document.querySelector('#dashboard-loading').hidden=true;
      document.querySelector('#dashboard-content').hidden=false;
      document.querySelector('#dashboard-greeting').textContent=interpolate(isNew?copy.welcome:copy.greeting,{name:member.firstName||'there'});
      document.querySelector('#dashboard-credit-value').textContent=money.format(member.credit||0);

      const point=member.collectionPoint||{};
      const legacyMappedPointId=Number(localStorage.getItem('rooted-commons-dashboard-collection-point')||0);
      if(legacyMappedPointId)localStorage.removeItem('rooted-commons-dashboard-collection-point');
      const mappedPointId=Number(params.get('collection_point')||legacyMappedPointId||0);
      const mappedPoint=(collectionPoints||[]).find(item=>Number(item.id)===mappedPointId);
      populatePointSelect(mappedPoint?.id||point.id);
      populateDaySelect(mappedPoint ? '' : (member.preferredCollectionDay||'Thursday'));
      if(mappedPoint){
        pointForm.hidden=false;
        pointMessage.textContent='';
        renderPointPreview(mappedPoint,daySelect.value);
        requestAnimationFrame(()=>document.querySelector('#collection-point')?.scrollIntoView({block:'start'}));
      }else renderPointPreview(point,member.preferredCollectionDay||'Thursday');

      const logo=member.founderBadge?badgeLogos[member.founderBadge]:memberBadge;
      const badgeLabel=member.founderBadge||copy.defaultMemberLevel;
      const badge=document.querySelector('#dashboard-badge');
      if(logo){badge.innerHTML=`<img src="${logo}" alt="${badgeLabel}">`;badge.hidden=false;}else{badge.innerHTML='';badge.hidden=true;}

      const weeks=Number(member.consecutiveWeeks)||0;
      document.querySelector('#dashboard-member-weeks').textContent=String(weeks);
      const totalImpact=Number(member.account?.totalOrderSpend)||0;
      const impactEl=document.querySelector('#dashboard-impact');
      if(impactEl)impactEl.textContent=money.format(totalImpact).replace('.00','');
      const volunteerDays=Number(member.volunteerDays)||0;
      const volunteerDaysEl=document.querySelector('#dashboard-volunteer-days');
      if(volunteerDaysEl)volunteerDaysEl.textContent=`${volunteerDays} ${volunteerDays===1?copy.dayUnit:copy.daysUnit}`;
      const workshops=Number(member.workshopsAttended)||0;
      const workshopsEl=document.querySelector('#dashboard-workshops-attended');
      if(workshopsEl)workshopsEl.textContent=String(workshops);
      const events=Number(member.eventsAttended)||0;
      const eventsEl=document.querySelector('#dashboard-events-attended');
      if(eventsEl)eventsEl.textContent=String(events);
      renderPerks(weeks,isNew);
      renderPauseState(member);

      const shop=document.querySelector('#dashboard-shop-link');
      shop.href='/orders/';
      shop.textContent=copy.browseMarket;

      currentMember=member;
      currentIsNew=isNew;
      const contributionFrequency=member.contributionFrequency==='Monthly'?'Monthly':'Weekly';
      currentCommitment={
        weekly:Number(member.weeklyCommitment)||10,
        monthly:Number(member.monthlyEquivalent)||(Number(member.weeklyCommitment)||10)*52/12,
        frequency:contributionFrequency
      };
      setCommitmentDisplay();

      document.querySelector('#dashboard-regular-bank-name').textContent=bankAccountName||'—';
      document.querySelector('#dashboard-regular-sort-code').textContent=bankSortCode||'—';
      document.querySelector('#dashboard-regular-account-number').textContent=bankAccountNumber||'—';
      document.querySelector('#dashboard-regular-payment-reference').textContent=member.paymentReference||`RC-${member.id}`;
      renderRegularPaymentState();

      document.querySelector('#dashboard-topup-bank-name').textContent=bankAccountName||'—';
      document.querySelector('#dashboard-topup-sort-code').textContent=bankSortCode||'—';
      document.querySelector('#dashboard-topup-account-number').textContent=bankAccountNumber||'—';
      document.querySelector('#dashboard-topup-reference').textContent=member.paymentReference||`RC-${member.id}`;

      const existingDetail=document.querySelector('#dashboard-existing-commitment-detail');
      existingDetail.hidden=isNew;
      if(!isNew){
        renderTopups(member.account?.payments||[]);
        renderActivity(member.account?.activity||[]);
        updateCommitmentPrompt();
      }

      const credit=Number(member.credit)||0;
      const paymentPrompt=document.querySelector('#dashboard-payment-prompt');
      if(credit<0){
        document.querySelector('#dashboard-topup-needed').textContent=interpolate(copy.topupNeeded,{amount:money.format(Math.abs(credit))});
        paymentPrompt.hidden=false;
      }else paymentPrompt.hidden=true;
    }
    load();
  
