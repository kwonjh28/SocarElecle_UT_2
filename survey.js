const root=document.getElementById('app');
const endpoint=window.UT_CONFIG.endpoint;
const storageKey='elecle-ut-v4';
let state;try{state=JSON.parse(sessionStorage.getItem(storageKey))}catch{}
state=state||{step:1,session:crypto.randomUUID(),answers:{ageGroup:'',usage:[],usageOther:'',gender:'',experience:'',frequency:'',criteria:[],other:'',postPositive:'',postNegative:''},participantId:null};
if(state.step===0)state.step=1;
function detectDevice(nav){const ua=nav.userAgent||'';if(/iPad|Tablet|PlayBook|Silk/i.test(ua)||(/Macintosh/i.test(ua)&&nav.maxTouchPoints>1)||(/Android/i.test(ua)&&!/Mobile/i.test(ua)))return 'tablet';if(nav.userAgentData?.mobile||/Mobi|iPhone|iPod|Android/i.test(ua))return 'mobile';return 'desktop';}
state.client=state.client||{deviceType:detectDevice(navigator),viewportWidth:window.innerWidth,viewportHeight:window.innerHeight};

let busy=false;
function setButtonLoading(button,loading,label='응답 저장 중…'){if(!button)return;if(loading){button.dataset.label=button.textContent;button.innerHTML=`<span class="cta-spinner" aria-hidden="true"></span><span>${label}</span>`;}else button.textContent=button.dataset.label||button.textContent;button.disabled=loading;button.setAttribute('aria-busy',String(loading));}
const questions=[null,'연령대를 선택해 주세요.','성별을 선택해 주세요.','공유 전기자전거 서비스를 이용해 본 경험이 있나요?','공유 전기자전거를 얼마나 자주 이용하시나요?'];
const choices={1:['10대','20대','30대','40대','50대','60대 이상'],2:['남성','여성','응답하지 않음'],3:['있다','없다'],4:['주 3회 이상 이용','주 1~2회 이용','월 1~2회 정도 이용','과거에 여러 차례 이용했지만, 지금은 이용하지 않음','지금까지 한두번만 이용해 봄']};
const keys={1:'ageGroup',2:'gender',3:'experience',4:'frequency'};
const usageOptions=['출퇴근 또는 등하교할 때','대중교통 환승 및 연계 이동 시','가까운 목적지로 이동할 때','여가·산책·관광을 즐길 때','급하게 이동해야 할 때','기타'];
const criteria=['현재 위치에서 자전거까지의 거리','배터리 잔량','정비 상태','예상 이용 요금','주행 성능 및 승차감','반납 가능 지역','기타'];
if(state.answers.criteria.some(value=>!criteria.includes(value))){state.answers.criteria=[];state.answers.other='';}
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function persist(){sessionStorage.setItem(storageKey,JSON.stringify(state))}
function error(t){
  const help=document.getElementById('feedback-help');
  if(help){help.textContent=t||"특별히 없었다면 '없음'으로 작성해 주세요.";help.classList.toggle('feedback-error',!!t);document.getElementById('feedback')?.setAttribute('aria-invalid',String(!!t));document.getElementById('error').textContent='';if(t)help.scrollIntoView({block:'center',behavior:'smooth'});}
  else document.getElementById('error').textContent=t;
}
function api(action,extra={}){return new Promise((resolve,reject)=>{let cb='ut_'+crypto.randomUUID().replaceAll('-','');let script=document.createElement('script');let timer=setTimeout(()=>done(null),15000);function done(data){clearTimeout(timer);script.remove();delete window[cb];data?.ok?resolve(data):reject(Error(data?.error||'연결에 실패했어요. 잠시 후 다시 시도해 주세요.'))}window[cb]=done;script.onerror=()=>done(null);script.src=endpoint+'?'+new URLSearchParams({action,callback:cb,payload:JSON.stringify({session:state.session,client:state.client,...(action==='track'?{}:{answers:state.answers}),...extra})});document.head.append(script)})}
let registrationPromise=null;
function ensureParticipant(){
  if(state.participantId)return Promise.resolve(state.participantId);
  if(registrationPromise)return registrationPromise;
  registrationPromise=(async()=>{
    if(endpoint)state.participantId=(await api('register')).participantId;
    else{const n=Number(localStorage.getItem('elecle-preview-count')||0)+1;localStorage.setItem('elecle-preview-count',n);state.participantId='PREVIEW-P'+String(n).padStart(2,'0');}
    persist();tracker.flush();return state.participantId;
  })().finally(()=>{registrationPromise=null});
  return registrationPromise;
}
// Serialize snapshots; retries preserve the latest answers without blocking navigation.
state.answerRevision=state.answerRevision||0;
state.savedAnswerRevision=state.savedAnswerRevision||0;
let draftTimer=null,draftInFlight=false;
function queueDraft(immediate=false){
  if(state.step>=10)return;
  state.answerRevision++;persist();clearTimeout(draftTimer);
  draftTimer=setTimeout(flushDraft,immediate?0:800);
}
async function flushDraft(){
  if(!endpoint||draftInFlight||state.step>=10||state.savedAnswerRevision>=state.answerRevision)return;
  draftInFlight=true;
  const revision=state.answerRevision,answers=JSON.parse(JSON.stringify(state.answers)),step=state.step;
  try{const result=await api('save',{answers,revision,step});state.participantId=result.participantId;state.savedAnswerRevision=Math.max(state.savedAnswerRevision,revision);persist();tracker.flush();}
  catch{/* Keep pending answers locally for retry. */}
  finally{draftInFlight=false;if(state.step<10&&state.savedAnswerRevision<state.answerRevision){clearTimeout(draftTimer);draftTimer=setTimeout(flushDraft,3000);}}
}
window.addEventListener('online',flushDraft);
document.addEventListener('visibilitychange',()=>{if(document.hidden)flushDraft()});
window.addEventListener('pagehide',flushDraft);
function option(label,checked,multi=false,rank=0){return `<button type="button" class="choice ${multi?'multiple':''}" role="${multi?'checkbox':'radio'}" aria-checked="${checked}" data-choice="${esc(label)}" aria-label="${esc(label)}${multi&&rank?`, ${rank}순위`: ''}"><span class="dot" aria-hidden="true">${multi&&rank?rank:''}</span><span>${esc(label==='기타'?'기타 (직접 입력)':label)}</span></button>`}
function render(){persist();const s=state.step,a=state.answers,second=state.missionNumber===2;
if(s===7&&!state.missionStarted){root.innerHTML=`<section class="shell"><header class="header"><span class="brand">쏘카일레클</span><span class="status">사용성 테스트</span></header><div class="progress"><i style="width:75%"></i></div><section class="content"><div class="eyebrow">미션 ${second?2:1}</div>${second?'<p class="mission-intro">이번에는 필터를 이용해 자전거를 찾아주세요.</p><figure class="mission-filter-reference"><figcaption>지도 상단의 필터</figcaption><img src="assets/mission2-filter-reference.png" alt="최근 정비, 100m 이내, 50% 이상 필터" width="366" height="51"></figure>':''}<h1 class="mission-copy" tabindex="-1"><span class="mission-condition"><span class="condition-tag">조건 1</span><span>${second?'현재 위치에서 100m 이내에 있는 자전거 중,':'최근에 정비가 된 자전거들 중,'}</span></span><span class="mission-condition"><span class="condition-tag">조건 2</span><span>${second?'배터리 잔량이 가장 많은 자전거를':'사용자와 가장 가까이 위치한 자전거를'}</span></span><span class="mission-action">잠금해제 해주세요.</span></h1></section><footer class="footer"><button class="primary" id="start-mission">시작하기</button></footer></section>`;document.getElementById('start-mission').onclick=()=>{state.missionStarted=true;queueDraft(true);render();window.scrollTo(0,0)};return}
if(s===7){root.innerHTML=`<section class="test"><iframe title="쏘카일레클 프로토타입" src="prototype/index.html?v=20261104-filter-reference1&mission=${second?2:1}"></iframe><div class="prototype-loading" role="status"><span class="cta-spinner" aria-hidden="true"></span>화면 준비 중…</div></section>`;const frame=root.querySelector('iframe');frame.onload=()=>{root.querySelector('.prototype-loading')?.remove();tracker.ready()};return}
let title='',body='',tag='',next='다음';
if(s<=4){tag=`Q${s} 필수`;title=questions[s];body=`<div class="options" role="radiogroup" aria-label="${esc(title)}">${choices[s].map(x=>option(x,a[keys[s]]===x)).join('')}</div>`}
else if(s===5){tag='Q5 필수';title=a.experience==='없다'?'앞으로 공유 전기자전거를 이용한다면 어떤 상황에서 이용할 것 같나요?':'공유 전기자전거를 주로 어떤 상황에서 이용하시나요?';body=`<p>중요하게 생각하는 순서대로 최대 3개를 선택해 주세요. 1개 또는 2개만 선택해도 됩니다.<span class="selection-count">${a.usage.length}/3개 선택</span></p><div class="options" role="group" aria-label="이용 상황">${usageOptions.map(x=>option(x,a.usage.includes(x),true,a.usage.indexOf(x)+1)).join('')}</div>${a.usage.includes('기타')?`<input class="other" id="usageOther" aria-label="기타 이용 상황" placeholder="기타 이용 상황을 입력해 주세요" maxlength="500" value="${esc(a.usageOther)}">`:''}`;next='다음'}
else if(s===6){tag='Q6 필수';title=a.experience==='없다'?'공유 전기자전거를 이용한다면 자전거를 선택할 때 어떤 조건을 중요하게 고려할 것 같나요?':'공유 전기자전거를 선택할 때 주로 고려하는 조건은 무엇인가요?';body=`<p>중요하게 생각하는 순서대로 최대 3개를 선택해 주세요. 1개 또는 2개만 선택해도 됩니다.<span class="selection-count">${a.criteria.length}/3개 선택</span></p><div class="options" role="group" aria-label="선택 시 고려 조건">${criteria.map(x=>option(x,a.criteria.includes(x),true,a.criteria.indexOf(x)+1)).join('')}</div>${a.criteria.includes('기타')?`<input class="other" id="other" aria-label="기타 고려 조건" placeholder="기타 조건을 입력해 주세요" maxlength="500" value="${esc(a.other)}">`:''}`;next='미션 확인하기'}
else if(s===8||s===9){const key=s===8?'postPositive':'postNegative';tag=`사후 설문 Q${s-7} 필수`;title=s===8?'원하는 조건의 자전거를 찾는 과정에서 편리하거나 좋았던 점은 무엇인가요?':'원하는 조건의 자전거를 찾는 과정에서 어렵거나 불편했던 점은 무엇인가요?';body=`<p id="feedback-help" role="status" aria-live="polite">특별히 없었다면 '없음'으로 작성해 주세요.</p><textarea class="feedback" id="feedback" aria-describedby="feedback-help" aria-label="${esc(title)}" placeholder="답변을 입력해 주세요" maxlength="2000" rows="6">${esc(a[key]||'')}</textarea><section class="ui-references" aria-label="테스트 화면 참고"><h2>테스트 화면 참고</h2><figure><figcaption>지도 화면</figcaption><img src="assets/reference-map.png?v=cluster1" alt="자전거 위치와 필터가 표시된 지도 화면" width="393" height="759" loading="lazy"></figure><figure><figcaption>자전거 상세 화면</figcaption><img src="assets/reference-bike-details.png?v=cluster1" alt="자전거 아이콘 선택 후 배터리와 잠금해제 버튼이 표시된 상세 화면" width="393" height="759" loading="lazy"></figure></section>`;next=s===9?'응답 제출하기':'다음'}
else{tag='참여 완료';title='참여해 주셔서<br>감사합니다';body=`<div class="check">✓</div><p>${endpoint?'응답이 저장되었습니다.':'미리보기 응답을 이 브라우저에 보관했어요. 실제 시트에는 전송되지 않았습니다.'}</p>`}
root.innerHTML=`<section class="shell"><header class="header"><span class="brand">쏘카일레클</span><span class="status">사용성 테스트</span></header><div class="progress"><i style="width:${[0,10,20,30,40,50,60,70,80,90,100][s]}%"></i></div><section class="content"><div class="eyebrow">${tag}</div><h1 tabindex="-1">${title}</h1>${body}${!endpoint&&s===1?'<div class="preview">미리보기 Google Sheets 연결 전입니다.</div>':''}<div class="error" id="error" role="alert"></div></section>${s<10?`<footer class="footer">${(s>1&&s<=6)||s===9?'<button class="back" id="back">이전</button>':''}<button class="primary" id="next">${next}</button></footer>`:''}</section>`;
root.querySelector('#feedback')?.addEventListener('input',e=>{a[s===8?'postPositive':'postNegative']=e.target.value;persist();queueDraft();error('')});root.querySelector('#usageOther')?.addEventListener('input',e=>{a.usageOther=e.target.value;persist();queueDraft();error('')});root.querySelector('#other')?.addEventListener('input',e=>{a.other=e.target.value;persist();queueDraft();error('')});root.querySelectorAll('[data-choice]').forEach(b=>b.onclick=()=>{let value=b.dataset.choice;if(s===5){if(!a.usage.includes(value)&&a.usage.length>=3)return error('최대 3개까지 선택할 수 있어요.');a.usage=a.usage.includes(value)?a.usage.filter(x=>x!==value):[...a.usage,value];if(!a.usage.includes('기타'))a.usageOther=''}else if(s===6){if(!a.criteria.includes(value)&&a.criteria.length>=3)return error('최대 3개까지 선택할 수 있어요.');a.criteria=a.criteria.includes(value)?a.criteria.filter(x=>x!==value):[...a.criteria,value];if(!a.criteria.includes('기타'))a.other=''}else{a[keys[s]]=value;if(s===1)ensureParticipant().catch(()=>{});if(s===3){a.frequency=value==='없다'?'0회':'';a.usage=[];a.usageOther=''}}queueDraft();render();root.querySelectorAll('[data-choice]').forEach(x=>{if(x.dataset.choice===value)x.focus()})});root.querySelector('#back')?.addEventListener('click',()=>{state.step=s===5&&a.experience==='없다'?3:s-1;queueDraft(true);render()});root.querySelector('#next')?.addEventListener('click',advance)
}
async function advance(){if(busy)return;const a=state.answers,s=state.step;if(s>=1&&s<=4&&!choices[s].includes(a[keys[s]]))return error('답변을 선택해 주세요.');if(s===5&&(!a.usage.length||a.usage.length>3||(a.usage.includes('기타')&&!a.usageOther.trim())))return error('이용 상황을 최대 3개 선택하고, 기타를 선택했다면 내용을 입력해 주세요.');if(s===6&&(!a.criteria.length||a.criteria.length>3||(a.criteria.includes('기타')&&!a.other.trim())))return error('조건을 최대 3개 선택하고, 기타를 선택했다면 내용을 입력해 주세요.');if((s===8||s===9)&&!(a[s===8?'postPositive':'postNegative']||'').trim())return error('답변을 입력해 주세요. 특별히 없다면 없음으로 작성해 주세요.');busy=true;let button=document.getElementById('next');setButtonLoading(button,true,s===9?'응답 저장 중…':'다음 화면으로 이동 중…');if(s===9)root.querySelector('#back')?.setAttribute('disabled','');try{ensureParticipant().catch(()=>{});if(s===9){if(endpoint){state.participantId=(await api('submit',{missions:tracker.summaries(),revision:state.answerRevision+1,step:10})).participantId;tracker.flush();}else localStorage.setItem('elecle-preview-response-'+state.session,JSON.stringify(state))}state.step=s===3&&a.experience==='없다'?5:s+1;if(state.step<10)queueDraft(true);else clearTimeout(draftTimer);render();window.scrollTo(0,0);root.querySelector('h1')?.focus()}catch(e){error(e.message);setButtonLoading(button,false);root.querySelector('#back')?.removeAttribute('disabled')}finally{busy=false}}
const tracker=window.createMissionTracker(state,persist,api,()=>{
  if(state.missionNumber===1&&state.mission.firstFilterSeconds===null){state.missionNumber=2;state.mission=null;state.missionStarted=false;state.step=7;}
  else state.step=8;
  queueDraft(true);render();window.scrollTo(0,0);root.querySelector('h1')?.focus();
});
render();

if(endpoint&&state.step<10&&state.answerRevision>state.savedAnswerRevision)draftTimer=setTimeout(flushDraft,0);
