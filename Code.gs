const SPREADSHEET_ID = '1qbqs7qk_Y_sr6Qq8bAV2eh6YbM2PexjENcTQ5SlU_VU';
const HEADERS = ['session_key','participant_id','status','submitted_at','age','gender','experience','frequency','criteria','other','age_group','usage_question_type','usage_situations','usage_other','criteria_rank_1','criteria_rank_2','criteria_rank_3','usage_rank_1','usage_rank_2','usage_rank_3','post_positive','post_negative','answers_saved_at','answer_revision','last_step'];
function doGet(e) {
  const callback = e.parameter.callback || '';
  if (!/^ut_[a-zA-Z0-9_]+$/.test(callback)) return ContentService.createTextOutput('Invalid callback');
  let result;
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const payload = JSON.parse(e.parameter.payload || '{}');
    if (!/^[a-f0-9-]{36}$/.test(payload.session || '')) throw Error('잘못된 세션입니다.');
    if (!['register','save','submit','track'].includes(e.parameter.action)) throw Error('지원하지 않는 요청입니다.');
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = ss.getSheetByName('UT_responses');
    if (!sheet) { sheet=ss.insertSheet('UT_responses'); sheet.appendRow(HEADERS); sheet.setFrozenRows(1); }
    sheet.getRange(1,1,1,HEADERS.length).setValues([HEADERS]);
    const rows = sheet.getDataRange().getValues();
    let index = rows.findIndex((row,i)=>i>0&&row[0]===payload.session);
    if(index<0){
      const last = rows.slice(1).reduce((n,row)=>Math.max(n,Number(String(row[1]).replace(/^P/,''))||0),0);
      sheet.appendRow([payload.session,'P'+String(last+1).padStart(2,'0'),'started']);
      index=sheet.getLastRow()-1;
    }
    const rowNumber=index+1;
    const id=sheet.getRange(rowNumber,2).getValue();
    if(payload.mission) saveMission_(ss,payload.session,id,payload.mission,payload.events||[]);
    if(e.parameter.action==='save')saveDraftAnswers_(sheet,rowNumber,payload);
    if(e.parameter.action==='submit'){
      const a=payload.answers||{};
      const allowed=['현재 위치에서 자전거까지의 거리','배터리 잔량','정비 상태','예상 이용 요금','주행 성능 및 승차감','반납 가능 지역','기타','자전거의 이용 가능 상태','자전거의 외관 및 관리 상태'];
      if(!['10대','20대','30대','40대','50대','60대 이상'].includes(a.ageGroup))throw Error('연령대를 확인해 주세요.');
      if(!['남성','여성','응답하지 않음'].includes(a.gender)||!['있다','없다'].includes(a.experience))throw Error('필수 답변을 확인해 주세요.');
      const frequency=a.experience==='없다'?'0회':a.frequency==='과거에 여러 차례 이용했지만, 최근 1개월간 이용하지 않음'?'과거에 여러 차례 이용했지만, 지금은 이용하지 않음':a.frequency;
      if(!['0회','주 3회 이상 이용','주 1~2회 이용','월 1~2회 정도 이용','과거에 여러 차례 이용했지만, 지금은 이용하지 않음','지금까지 한두번만 이용해 봄'].includes(frequency))throw Error('이용 횟수를 확인해 주세요.');
      if(!Array.isArray(a.criteria)||!a.criteria.length||a.criteria.length>3||new Set(a.criteria).size!==a.criteria.length||a.criteria.some(x=>!allowed.includes(x)))throw Error('고려 조건을 선택해 주세요.');
      const other=a.criteria.includes('기타')?String(a.other||'').trim():'';
      if(a.criteria.includes('기타')&&(!other||other.length>500))throw Error('기타 내용을 확인해 주세요.');
      const usageAllowed=['출퇴근 또는 등하교할 때','대중교통 환승 및 연계 이동 시','가까운 목적지로 이동할 때','여가·산책·관광을 즐길 때','급하게 이동해야 할 때','기타'];
      if(!Array.isArray(a.usage)||!a.usage.length||a.usage.length>3||new Set(a.usage).size!==a.usage.length||a.usage.some(x=>!usageAllowed.includes(x)))throw Error('이용 상황은 1~3개 선택해 주세요.');
      const usageOther=a.usage.includes('기타')?String(a.usageOther||'').trim():'';
      if(a.usage.includes('기타')&&(!usageOther||usageOther.length>500))throw Error('기타 이용 상황을 확인해 주세요.');
      const positive=String(a.postPositive||'').trim(),negative=String(a.postNegative||'').trim();
      if(!positive||!negative||positive.length>2000||negative.length>2000)throw Error('사후 설문 두 문항을 모두 작성해 주세요.');
      const safeText=value=>/^[=+@-]/.test(value)?"'"+value:value;
      const safeUsageOther=/^[=+@-]/.test(usageOther)?"'"+usageOther:usageOther;
      const safeOther=/^[=+@-]/.test(other)?"'"+other:other;
      sheet.getRange(rowNumber,3,1,20).setValues([['completed',new Date().toISOString(),'',a.gender,a.experience,frequency,[...new Set(a.criteria)].join(' | '),safeOther,a.ageGroup,a.experience==='없다'?'expected':'experienced',a.usage.join(' | '),safeUsageOther,a.criteria[0]||'',a.criteria[1]||'',a.criteria[2]||'',a.usage[0]||'',a.usage[1]||'',a.usage[2]||'',safeText(positive),safeText(negative)]]);
      sheet.getRange(rowNumber,23,1,3).setValues([[new Date().toISOString(),Math.max(Number(sheet.getRange(rowNumber,24).getValue())||0,Number(payload.revision)||0),10]]);
    }
    result={ok:true,participantId:id};
  }catch(err){result={ok:false,error:String(err.message||err)}}finally{if(lock.hasLock())lock.releaseLock()}
  return ContentService.createTextOutput(callback+'('+JSON.stringify(result).replace(/</g,'\\u003c')+');').setMimeType(ContentService.MimeType.JAVASCRIPT);
}


function saveMission_(ss,session,participantId,m,events) {
  const uuid=/^[a-f0-9-]{36}$/;
  if(!uuid.test(m.attemptId||'')||!['running','success','failure'].includes(m.status))throw Error('잘못된 미션 기록입니다.');
  const numeric=['activeSeconds','totalSeconds','revision'];
  if(numeric.some(key=>!Number.isFinite(m[key])||m[key]<0)||!Number.isInteger(m.revision))throw Error('잘못된 측정값입니다.');
  if(!Number.isFinite(Date.parse(m.startedAt))||(m.endedAt&&!Number.isFinite(Date.parse(m.endedAt))))throw Error('잘못된 미션 시각입니다.');
  const first=(value)=>value===null||value===undefined?'':Number.isFinite(value)&&value>=0?value:'';
  const eventTypes=['prototype_ready','mission_open','mission_close','filter_toggle','bike_select','locate','inactive_click','unlock_attempt','mission_success','mission_failure','tab_hidden','tab_visible','page_exit'];
  if(!Array.isArray(events)||events.length>4||events.some(event=>!uuid.test(event.id||'')||!eventTypes.includes(event.type)||!Number.isInteger(event.seq)||event.seq<1||!Number.isFinite(event.seconds)||event.seconds<0||!Number.isFinite(Date.parse(event.at))))throw Error('잘못된 행동 기록입니다.');
  let summary=ss.getSheetByName('UT_missions');
  const summaryHeaders=['session_key','participant_id','attempt_id','mission_status','started_at','ended_at','total_seconds','active_seconds','first_filter_seconds','first_recent_filter_seconds','filter_discovery','revision','last_saved_at'];
  if(!summary){summary=ss.insertSheet('UT_missions');summary.appendRow(summaryHeaders);summary.setFrozenRows(1);}
  const rows=summary.getDataRange().getValues();
  const index=rows.findIndex((row,i)=>i>0&&row[0]===session&&row[2]===m.attemptId);
  const discovery=m.firstFilterSeconds===null||m.firstFilterSeconds===undefined?(m.status!=='running'?'발견하지 못함':'미확인'):'발견';
  const row=[session,participantId,m.attemptId,m.status,m.startedAt,m.endedAt||'',m.totalSeconds,m.activeSeconds,first(m.firstFilterSeconds),first(m.firstRecentFilterSeconds),discovery,m.revision,new Date().toISOString()];
  if(index<0)summary.appendRow(row);
  else if(m.revision>=Number(rows[index][11])&&!(rows[index][3]!=='running'&&m.status==='running'))summary.getRange(index+1,1,1,row.length).setValues([row]);
  if(events.length){
    const log=getEventStore_(ss);
    const seen=new Set(log.getDataRange().getValues().slice(1).map(row=>row[3]));
    const pending=[];
    events.forEach(event=>{if(!seen.has(event.id)){seen.add(event.id);pending.push([session,participantId,m.attemptId,event.id,event.seq,event.at,event.type,event.seconds,JSON.stringify(event.details||{}).slice(0,1500)]);}});
    if(pending.length)log.getRange(log.getLastRow()+1,1,pending.length,9).setValues(pending);
    rebuildClickPaths_(ss);
  }
}


function getEventStore_(ss){
  let store=ss.getSheetByName('UT_event_store');
  if(!store){
    const existing=ss.getSheetByName('UT_events');
    if(existing&&existing.getRange(1,4).getValue()==='event_id'){existing.setName('UT_event_store');store=existing;}
    else {store=ss.insertSheet('UT_event_store');store.appendRow(['session_key','participant_id','attempt_id','event_id','sequence','event_at','event_type','active_seconds','details']);store.setFrozenRows(1);}
  }
  if(!store.isSheetHidden())store.hideSheet();
  return store;
}
function pathLabels_(type,d){
  const filterNames={recent:'최근 정비',near:'100m 이내',charged:'50% 이상'};
  switch(type){
    case 'prototype_ready':return ['지도'];
    case 'bike_select':return ['자전거 마커'+(d.distance?' ('+d.distance+')':''),'상세 정보'];
    case 'filter_toggle':return [(filterNames[d.filter]||'필터')+(d.enabled?' 켜기':' 끄기')];
    case 'locate':return ['현재 위치','지도'];
    case 'mission_open':return ['미션 보기'];
    case 'mission_close':return ['미션 닫기'];
    case 'unlock_attempt':return ['잠금해제'+(d.success?'':' (다른 자전거)')];
    case 'mission_success':return ['미션 완료'];
    case 'mission_failure':return ['미션 종료 (오답)'];
    case 'inactive_click':return [({fare_info:'요금 안내',browse:'둘러보기',qr_scan:'QR 스캔',ring:'소리내기',report:'신고하기',reserve:'예약하기'})[d.button]||'버튼'];
    default:return [];
  }
}
function rebuildClickPaths_(ss){
  const store=getEventStore_(ss),events=store.getDataRange().getValues().slice(1),groups={};
  events.forEach(row=>{const id=String(row[1]);if(!id)return;(groups[id]||(groups[id]=[])).push(row);});
  let sheet=ss.getSheetByName('UT_events');
  if(!sheet)sheet=ss.insertSheet('UT_events');
  const headers=['participant_id','click_path','action_count','last_saved_at'];
  sheet.getRange(1,1,1,4).setValues([headers]);sheet.setFrozenRows(1);
  const data=Object.keys(groups).sort((a,b)=>Number(a.slice(1))-Number(b.slice(1))).map(id=>{
    const rows=groups[id].sort((a,b)=>a[2]===b[2]?Number(a[4])-Number(b[4]):Date.parse(a[5])-Date.parse(b[5]));
    const labels=[];
    rows.forEach(row=>{let d={};try{d=JSON.parse(row[8]||'{}');}catch(_){};pathLabels_(row[6],d).forEach(label=>{if(labels[labels.length-1]!==label)labels.push(label);});});
    return [id,labels.join(' → '),rows.length,new Date().toISOString()];
  });
  if(data.length)sheet.getRange(2,1,data.length,4).setValues(data);
  sheet.setColumnWidth(1,120);sheet.setColumnWidth(2,760);sheet.setColumnWidth(3,110);sheet.setColumnWidth(4,200);
  if(data.length)sheet.getRange(2,2,data.length,1).setWrap(true);
}
function migrateClickPaths(){rebuildClickPaths_(SpreadsheetApp.openById(SPREADSHEET_ID));}

// Editor-only maintenance; never exposed through doGet.
function resetParticipationRecords(){
  const lock=LockService.getScriptLock();lock.waitLock(20000);
  try{
    const ss=SpreadsheetApp.openById(SPREADSHEET_ID);
    ['UT_responses','UT_missions','UT_events','UT_event_store'].forEach(name=>{
      const sheet=ss.getSheetByName(name);
      if(sheet&&sheet.getLastRow()>1)sheet.getRange(2,1,sheet.getLastRow()-1,sheet.getLastColumn()).clearContent();
    });
    updateFieldGuide();
    console.log('참여 기록 초기화 완료. 헤더와 항목 설명은 유지됩니다.');
  }finally{lock.releaseLock();}
}

function updateFieldGuide(){
  const ss=SpreadsheetApp.openById(SPREADSHEET_ID);
  const responses=ss.getSheetByName('UT_responses');if(responses)responses.getRange(1,1,1,HEADERS.length).setValues([HEADERS]);
  const rows=[['시트','항목명','한글 이름','의미 / 기록 기준'],
    ['공통','session_key','참여 세션 키','익명 참여 세션을 연결하는 내부 식별자입니다. 개인정보가 아닙니다.'],
    ['공통','participant_id','참가자 ID','P01, P02 순서로 생성되는 익명 참가자 번호입니다. 각 시트의 같은 참가자를 연결합니다.'],
    ['UT_responses','answers_saved_at','답변 마지막 저장 시각','선택 또는 입력이 잠시 멈춘 뒤와 문항 이동 시 자동 저장한 시각입니다. 최종 제출 시에도 갱신됩니다. UTC(Z)입니다.'],
    ['UT_responses','answer_revision','답변 저장 버전','이전 답변이 늦게 도착해 최신 답변을 덮어쓰지 않도록 하는 내부 순번입니다.'],
    ['UT_responses','last_step','마지막 저장 단계','1 연령대 / 2 성별 / 3 경험 / 4 빈도 / 5 이용 상황 / 6 선택 조건 / 7 미션 안내·수행 / 8 사후 Q1 / 9 사후 Q2 / 10 최종 제출 완료. 이탈을 확정하는 값은 아닙니다.'],
    ['UT_responses','status','설문 제출 상태','started: 참여 등록됨 / in_progress: 답변 중간 저장됨 / completed: 마지막 설문까지 제출 완료. 미션 정답 여부와는 별개입니다.'],
    ['UT_responses','submitted_at','설문 제출 시각','마지막 설문 제출이 완료된 시각입니다. ISO 8601 UTC(Z)이며 한국·일본 시각은 9시간을 더합니다.'],
    ['UT_responses','age','만 나이 (미사용)','기존 호환용 빈 열입니다. 현재 연령대는 age_group에 저장합니다.'],
    ['UT_responses','age_group','연령대','10대 / 20대 / 30대 / 40대 / 50대 / 60대 이상'],
    ['UT_responses','gender','성별','남성 / 여성 / 응답하지 않음'],
    ['UT_responses','experience','이용 경험','공유 전기자전거 이용 경험: 있다 / 없다'],
    ['UT_responses','frequency','이용 빈도','선택한 이용 빈도입니다. 이용 경험이 없으면 0회로 자동 저장하며 experience도 함께 남깁니다.'],
    ['UT_responses','usage_question_type','이용 상황 질문 유형','experienced: 실제 이용 상황 / expected: 이용 경험이 없는 참가자의 예상 이용 상황'],
    ['UT_responses','usage_situations','이용 상황 응답 전체','선택한 순서(중요도 순)대로 1~3개를 | 로 구분해 저장합니다.'],
    ['UT_responses','usage_other','기타 이용 상황','이용 상황에서 기타를 선택했을 때 직접 입력한 내용입니다. 미선택이면 빈칸입니다.'],
    ['UT_responses','usage_rank_1','이용 상황 1순위','첫 번째로 선택한 이용 상황입니다.'],
    ['UT_responses','usage_rank_2','이용 상황 2순위','두 번째로 선택한 이용 상황입니다. 1개만 선택했다면 빈칸입니다.'],
    ['UT_responses','usage_rank_3','이용 상황 3순위','세 번째로 선택한 이용 상황입니다. 1~2개만 선택했다면 빈칸입니다.'],
    ['UT_responses','criteria','자전거 선택 조건 전체','사전 설문의 선택 조건을 중요도 순서대로 1~3개, | 로 구분해 저장합니다.'],
    ['UT_responses','post_positive','사후 Q1 좋았던 점','원하는 조건의 자전거를 찾는 과정에서 편리하거나 좋았던 점에 대한 필수 주관식 응답입니다. 특별히 없다면 없음으로 작성합니다.'],
    ['UT_responses','post_negative','사후 Q2 불편했던 점','원하는 조건의 자전거를 찾는 과정에서 어렵거나 불편했던 점에 대한 필수 주관식 응답입니다. 특별히 없다면 없음으로 작성합니다.'],
    ['UT_responses','other','기타 선택 조건','사전 설문 선택 조건에서 기타를 선택했을 때 직접 입력한 내용입니다. 테스트 전용 항목이 아닙니다.'],
    ['UT_responses','criteria_rank_1','선택 조건 1순위','첫 번째로 선택한 자전거 선택 조건입니다.'],
    ['UT_responses','criteria_rank_2','선택 조건 2순위','두 번째로 선택한 조건입니다. 1개만 선택했다면 빈칸입니다.'],
    ['UT_responses','criteria_rank_3','선택 조건 3순위','세 번째로 선택한 조건입니다. 1~2개만 선택했다면 빈칸입니다.'],
    ['UT_missions / UT_event_store','attempt_id','미션 시도 ID','하나의 미션 수행 기록을 연결하는 내부 식별자입니다.'],
    ['UT_missions','mission_status','미션 결과','running: 진행 중 / success: 정답 자전거 잠금해제 / failure: 다른 자전거 잠금해제. 어느 자전거든 잠금해제하면 마지막 설문으로 이동합니다.'],
    ['UT_missions','started_at','미션 시작 시각','시작하기를 누른 뒤 프로토타입이 준비된 시각입니다. UTC(Z)입니다.'],
    ['UT_missions','ended_at','미션 종료 시각','자전거 잠금해제를 누른 시각입니다. 진행 중이거나 화면을 끈 채 종료하면 빈칸입니다. UTC(Z)입니다.'],
    ['UT_missions','total_seconds','전체 소요 시간 (초)','미션 시작부터 종료까지 경과한 전체 시간입니다. 탭 숨김·미션 보기 시간도 포함합니다. 진행 중에는 마지막 저장 시점까지의 시간입니다.'],
    ['UT_missions','active_seconds','실제 수행 시간 (초)','전체 시간에서 탭이 가려진 시간과 미션 보기 팝업을 열어둔 시간을 제외합니다. 두 상태가 겹쳐도 한 번만 제외합니다.'],
    ['UT_missions','first_filter_seconds','첫 필터 활성화까지 시간 (초)','최근 정비·100m 이내·50% 이상 중 어떤 필터든 처음 켤 때까지의 실제 수행 시간입니다. 켠 적이 없으면 빈칸입니다.'],
    ['UT_missions','first_recent_filter_seconds','최근 정비 첫 활성화까지 시간 (초)','최근 정비 필터를 처음 켤 때까지의 실제 수행 시간입니다. 켠 적이 없으면 빈칸입니다.'],
    ['UT_missions','filter_discovery','필터 발견 여부','필터 3종 중 하나라도 켜면 발견. 종료까지 한 번도 켜지 않으면 발견하지 못함. 진행 중 아직 켜지 않았다면 미확인. 한 번 켠 뒤 꺼도 발견으로 유지합니다.'],
    ['UT_missions','revision','저장 버전 (내부용)','발생한 이벤트 수를 기준으로 최신 기록을 구분합니다. 늦게 도착한 과거 기록이 최신 기록을 덮어쓰는 것을 막습니다. 분석용 점수가 아닙니다.'],
    ['UT_missions / UT_events','last_saved_at','마지막 저장 시각','서버가 해당 기록을 마지막으로 저장한 시각입니다. UTC(Z)입니다.'],
    ['UT_events','click_path','화면·조작 순서','참가자 한 명당 한 행으로 주요 행동을 → 로 연결합니다. 예: 지도 → 100m 이내 켜기 → 자전거 마커 → 상세 정보 → 잠금해제. 지도 드래그는 기록하지 않습니다.'],
    ['UT_events','action_count','원본 이벤트 수','숨김·복귀 등 경로에 표시하지 않는 이벤트도 포함한 원본 기록 수입니다. 클릭 횟수나 경로 단계 수와 같지 않습니다.'],
    ['UT_event_store (숨김)','event_id','이벤트 ID','같은 이벤트가 재전송되어도 중복 저장하지 않도록 사용하는 내부 식별자입니다.'],
    ['UT_event_store (숨김)','sequence','이벤트 발생 순번','해당 미션에서 행동이 발생한 순서입니다.'],
    ['UT_event_store (숨김)','event_at','이벤트 발생 시각','행동이 발생한 시각입니다. UTC(Z)입니다.'],
    ['UT_event_store (숨김)','event_type','이벤트 종류','지도 준비, 필터 조작, 자전거 선택, 미션 보기/닫기, 잠금해제, 성공/오답 종료, 탭 숨김/복귀, 페이지 이탈 등입니다.'],
    ['UT_event_store (숨김)','active_seconds','이벤트 발생까지 실제 수행 시간 (초)','미션 시작부터 해당 이벤트까지, 탭 숨김·미션 보기 시간을 제외한 누적 시간입니다.'],
    ['UT_event_store (숨김)','details','이벤트 상세 정보','조작한 필터와 켜짐 여부, 선택 자전거 ID, 정답 여부 등을 JSON으로 저장하는 내부 원본입니다.'],
    ['운영 참고','저장 / 이탈','저장 시점과 해석','미션 행동은 일부 행동과 약 5초 주기로 저장합니다. 설문은 선택·입력 후 약 0.8초와 문항 이동 시 자동 저장하며, 최종 제출 전에는 in_progress입니다. 갑자기 창을 닫거나 통신이 끊기면 마지막 미전송 답변·기록이 누락될 수 있습니다.'],
    ['운영 참고','초기화','참가자 번호','참여 기록을 모두 초기화하면 다음 신규 참가자는 P01부터 시작합니다. 이전 테스트 문구는 설문 항목이 아니라 기타에 입력했던 테스트 답변이며 초기화로 제거했습니다.']
  ];
  let sheet=ss.getSheetByName('항목 설명');if(!sheet)sheet=ss.insertSheet('항목 설명');
  sheet.clearContents();sheet.getRange(1,1,rows.length,4).setValues(rows);
  sheet.setFrozenRows(1);sheet.setColumnWidth(1,210);sheet.setColumnWidth(2,230);sheet.setColumnWidth(3,250);sheet.setColumnWidth(4,730);
  sheet.getRange(1,1,1,4).setBackground('#1677ff').setFontColor('#ffffff').setFontWeight('bold');
  sheet.getRange(2,1,rows.length-1,4).setWrap(true).setVerticalAlignment('top');
  sheet.autoResizeRows(1,rows.length);
  console.log('항목 설명 '+(rows.length-1)+'개 작성 완료');
}

function saveDraftAnswers_(sheet,rowNumber,payload){
  const revision=payload.revision;
  if(!Number.isSafeInteger(revision)||revision<1)throw Error('잘못된 답변 저장 버전입니다.');
  if(sheet.getRange(rowNumber,3).getValue()==='completed'||revision<=(Number(sheet.getRange(rowNumber,24).getValue())||0))return;
  const a=payload.answers||{};
  const pick=(value,allowed)=>allowed.includes(value)?value:'';
  const ranked=(value,allowed)=>Array.isArray(value)?[...new Set(value.filter(x=>allowed.includes(x)))].slice(0,3):[];
  const text=(value,max)=>{const t=String(value||'').slice(0,max).trim();return /^[=+@-]/.test(t)?"'"+t:t;};
  const experience=pick(a.experience,['있다','없다']);
  const frequency=experience==='없다'?'0회':pick(a.frequency,['주 3회 이상 이용','주 1~2회 이용','월 1~2회 정도 이용','과거에 여러 차례 이용했지만, 지금은 이용하지 않음','지금까지 한두번만 이용해 봄']);
  const criteria=ranked(a.criteria,['현재 위치에서 자전거까지의 거리','배터리 잔량','정비 상태','예상 이용 요금','주행 성능 및 승차감','반납 가능 지역','기타']);
  const usage=ranked(a.usage,['출퇴근 또는 등하교할 때','대중교통 환승 및 연계 이동 시','가까운 목적지로 이동할 때','여가·산책·관광을 즐길 때','급하게 이동해야 할 때','기타']);
  const row=['in_progress','','',pick(a.gender,['남성','여성','응답하지 않음']),experience,frequency,criteria.join(' | '),criteria.includes('기타')?text(a.other,500):'',pick(a.ageGroup,['10대','20대','30대','40대','50대','60대 이상']),experience?(experience==='없다'?'expected':'experienced'):'',usage.join(' | '),usage.includes('기타')?text(a.usageOther,500):'',criteria[0]||'',criteria[1]||'',criteria[2]||'',usage[0]||'',usage[1]||'',usage[2]||'',text(a.postPositive,2000),text(a.postNegative,2000),new Date().toISOString(),revision,Number.isInteger(payload.step)&&payload.step>=1&&payload.step<=9?payload.step:''];
  sheet.getRange(rowNumber,3,1,row.length).setValues([row]);
}

// Editor-only verification. Removes only the temporary row created by this run.
function verifyDraftSaving(){
  const session=Utilities.getUuid(),ss=SpreadsheetApp.openById(SPREADSHEET_ID),sheet=ss.getSheetByName('UT_responses');
  const request=(action,answers,revision,step)=>{
    const result=doGet({parameter:{action,callback:'ut_verify',payload:JSON.stringify({session,answers,revision,step})}}).getContent();
    const parsed=JSON.parse(result.slice('ut_verify('.length,-2));if(!parsed.ok)throw Error(parsed.error);return parsed;
  };
  const find=()=>sheet.getDataRange().getValues().findIndex((r,i)=>i>0&&r[0]===session)+1;
  try{
    request('save',{ageGroup:'20대'},1,2);
    let row=sheet.getRange(find(),1,1,HEADERS.length).getValues()[0];
    if(row[2]!=='in_progress'||row[10]!=='20대'||row[23]!==1)throw Error('첫 답변 저장 불일치');
    request('save',{ageGroup:'30대',experience:'없다',postPositive:'없음'},3,8);
    request('save',{ageGroup:'10대'},2,1);
    row=sheet.getRange(find(),1,1,HEADERS.length).getValues()[0];
    if(row[10]!=='30대'||row[7]!=='0회'||row[20]!=='없음'||row[24]!==8)throw Error('중간 답변 또는 이전 버전 방지 불일치');
    console.log('PASS 실제 시트 중간 저장, 이용 경험 없음 0회, 사후 일부 답변, 이전 답변 덮어쓰기 방지 확인');
  }finally{const rowNumber=find();if(rowNumber>1)sheet.deleteRow(rowNumber);console.log('검증용 참가자 행 정리 완료');}
}
