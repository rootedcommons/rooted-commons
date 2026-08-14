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

    const pointSelect=document.querySelector('#dashboard-point-select');
    const pointForm=document.querySelector('#dashboard-point-form');
    const daySelect=document.querySelector('#dashboard-day-select');
    const pointMessage=document.querySelector('#dashboard-point-message');

    const populatePointSelect=(selectedId)=>{
      pointSelect.innerHTML=(collectionPoints||[]).map(point=>`<option value="${point.id}" ${Number(point.id)===Number(selectedId)?'selected':''}>${point.name}</option>`).join('');
    };
    const populateDaySelect=(selectedDay='')=>{
      const point=(collectionPoints||[]).find(item=>Number(item.id)===Number(pointSelect.value));
      const slots=point?.collectionSlots||[];
      daySelect.innerHTML=slots.map(slot=>`<option value="${slot.day}">${slot.day} — ${slot.time}</option>`).join('');
      if(slots.some(slot=>slot.day===selectedDay))daySelect.value=selectedDay;
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
        document.querySelector('#dashboard-point-name').textContent=point.name||copy.collectionNotSelected;
        const slot=(point.collectionSlots||[]).find(item=>item.day===payload.preferredCollectionDay)||(point.collectionSlots||[])[0];
        document.querySelector('#dashboard-point-time').textContent=slot?`${slot.day} · ${slot.time}`:(point.collectionTime||'');
        document.querySelector('#dashboard-point-address').textContent=point.address||'';
        const pointImage=document.querySelector('#dashboard-point-image');
        if(point.image){pointImage.src=point.image;pointImage.alt=point.name?interpolate(copy.collectionImageAlt,{name:point.name}):'';pointImage.hidden=false;}else{pointImage.hidden=true;pointImage.removeAttribute('src');}
        pointMessage.textContent=copy.collectionUpdated;
        setTimeout(()=>{pointForm.hidden=true;pointMessage.textContent='';},900);
      }else pointMessage.textContent=payload.message||copy.collectionFailed;
      button.disabled=false;
    });

    const renderPerks=(weeks,isNew)=>{
      const container=document.querySelector('#dashboard-perks');
      if(isNew){container.hidden=true;return;}
      const perks=(membershipPerks||[])
        .map(item=>({label:item.label,unlockWeeks:Number(item.unlockWeeks)||0}))
        .filter(item=>item.label)
        .sort((a,b)=>a.unlockWeeks-b.unlockWeeks);
      if(!perks.length){container.hidden=true;return;}
      const unlocked=perks.filter(item=>weeks>=item.unlockWeeks);
      const upcoming=perks.filter(item=>weeks<item.unlockWeeks);
      const unlockedHtml=unlocked.length
        ? `<h3>${copy.perksUnlocked}</h3><ul>${unlocked.map(item=>`<li>${item.label}</li>`).join('')}</ul>`
        : '';
      const upcomingHtml=upcoming.length
        ? `<h3 class="dashboard-upcoming-perks-heading">${copy.perksUpcoming}</h3><ul class="dashboard-upcoming-perks">${upcoming.map(item=>{
            const remaining=item.unlockWeeks-weeks;
            return `<li><span>${item.label}</span><strong>${interpolate(copy.perkInWeeks,{weeks:remaining,plural:remaining===1?'':'s'})}</strong></li>`;
          }).join('')}</ul>`
        : '';
      container.innerHTML=unlockedHtml+upcomingHtml;
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
        if(currentMember){currentMember.weeklyCommitment=currentCommitment.weekly;currentMember.monthlyEquivalent=currentCommitment.monthly;currentMember.contributionFrequency=currentCommitment.frequency;currentMember.commitmentPaymentPending=true;currentMember.commitmentChangedAt=payload.commitmentChangedAt||new Date().toISOString();}
        setCommitmentDisplay();
        document.querySelector('#dashboard-regular-payment-heading').textContent=copy.updateRegularPaymentHeading;
        regularPaymentDetails.hidden=false;
        renderRegularPaymentState();
        commitmentMessage.textContent=copy.commitmentUpdated;
        updateCommitmentPrompt();
      }catch(error){commitmentMessage.textContent=error?.message||copy.commitmentFailed;}
      button.disabled=false;
    });

    const renderRegularPaymentState=()=>{
      const pending=Boolean(currentMember?.commitmentPaymentPending);
      const reminder=document.querySelector('#dashboard-regular-payment-reminder');
      const body=document.querySelector('#dashboard-regular-payment-body');
      if(pending){
        const frequency=currentCommitment.frequency==='Monthly'?'monthly':'weekly';
        const amount=currentCommitment.frequency==='Monthly'?currentCommitment.monthly:currentCommitment.weekly;
        document.querySelector('#dashboard-regular-payment-heading').textContent=copy.updateRegularPaymentHeading;
        reminder.textContent=interpolate(copy.commitmentPaymentReminder,{frequency,amount:displayMoney(amount),period:frequency==='monthly'?'month':'week'});
        reminder.hidden=false;
        if(body)body.hidden=true;
        regularPaymentDetails.hidden=false;
      }else{
        reminder.hidden=true;
        if(body)body.hidden=false;
        document.querySelector('#dashboard-regular-payment-heading').textContent=currentIsNew?copy.setupRegularPaymentHeading:copy.regularPaymentHeading;
        regularPaymentDetails.hidden=!currentIsNew;
      }
    };

    const updateCommitmentPrompt=()=>{
      const weeks=Number(currentMember?.membershipWeeks)||0;
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
      const mappedPointId=Number(localStorage.getItem('rooted-commons-dashboard-collection-point')||0);
      if(mappedPointId)localStorage.removeItem('rooted-commons-dashboard-collection-point');
      const mappedPoint=(collectionPoints||[]).find(item=>Number(item.id)===mappedPointId);
      populatePointSelect(mappedPoint?.id||point.id);
      populateDaySelect(mappedPoint ? '' : (member.preferredCollectionDay||'Thursday'));
      if(mappedPoint){pointForm.hidden=false;pointMessage.textContent='';}
      document.querySelector('#dashboard-point-name').textContent=point.name||copy.collectionNotSelected;
      const preferredSlot=(point.collectionSlots||[]).find(item=>item.day===member.preferredCollectionDay)||(point.collectionSlots||[])[0];
      document.querySelector('#dashboard-point-time').textContent=preferredSlot?`${preferredSlot.day} · ${preferredSlot.time}`:(point.collectionTime||'');
      document.querySelector('#dashboard-point-address').textContent=point.address||'';
      const pointImage=document.querySelector('#dashboard-point-image');
      if(point.image){pointImage.src=point.image;pointImage.alt=point.name?interpolate(copy.collectionImageAlt,{name:point.name}):'';pointImage.hidden=false;}else{pointImage.hidden=true;pointImage.removeAttribute('src');}

      const logo=member.founderBadge?badgeLogos[member.founderBadge]:memberBadge;
      const badgeLabel=member.founderBadge||copy.defaultMemberLevel;
      const badge=document.querySelector('#dashboard-badge');
      if(logo){badge.innerHTML=`<img src="${logo}" alt="${badgeLabel}">`;badge.hidden=false;}else{badge.innerHTML='';badge.hidden=true;}

      const weeks=Number(member.membershipWeeks)||0;
      document.querySelector('#dashboard-member-weeks').textContent=`${weeks} ${weeks===1?copy.weekUnit:copy.weeksUnit}`;
      const totalImpact=Number(member.account?.totalOrderSpend)||0;
      document.querySelector('#dashboard-impact').textContent=money.format(totalImpact).replace('.00','');
      const volunteerDays=Number(member.volunteerDays)||0;
      document.querySelector('#dashboard-volunteer-days').textContent=`${volunteerDays} ${volunteerDays===1?copy.dayUnit:copy.daysUnit}`;
      const workshops=Number(member.workshopsAttended)||0;
      document.querySelector('#dashboard-workshops-attended').textContent=String(workshops);
      const events=Number(member.eventsAttended)||0;
      document.querySelector('#dashboard-events-attended').textContent=String(events);
      renderPerks(weeks,isNew);

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
  
