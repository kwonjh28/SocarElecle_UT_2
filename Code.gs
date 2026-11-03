const SPREADSHEET_ID = '1qbqs7qk_Y_sr6Qq8bAV2eh6YbM2PexjENcTQ5SlU_VU';
const HEADERS = ['session_key','participant_id','status','submitted_at','age','gender','experience','frequency','criteria','other','age_group','usage_question_type','usage_situations','usage_other','criteria_rank_1','criteria_rank_2','criteria_rank_3','usage_rank_1','usage_rank_2','usage_rank_3'];
function doGet(e) {
  const callback = e.parameter.callback || '';
  if (!/^ut_[a-zA-Z0-9_]+$/.test(callback)) return ContentService.createTextOutput('Invalid callback');
  let result;
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const payload = JSON.parse(e.parameter.payload || '{}');
    if (!/^[a-f0-9-]{36}$/.test(payload.session || '')) throw Error('잘못된 세션입니다.');
    if (!['register','submit','track'].includes(e.parameter.action)) throw Error('지원하지 않는 요청입니다.');
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
    if(e.parameter.action==='submit'){
      const a=payload.answers||{};
      const allowed=['현재 위치에서 자전거까지의 거리','배터리 잔량','정비 상태','예상 이용 요금','주행 성능 및 승차감','반납 가능 지역','기타','자전거의 이용 가능 상태','자전거의 외관 및 관리 상태'];
      if(!['10대','20대','30대','40대','50대','60대 이상'].includes(a.ageGroup))throw Error('연령대를 확인해 주세요.');
      if(!['남성','여성','응답하지 않음'].includes(a.gender)||!['있다','없다'].includes(a.experience))throw Error('필수 답변을 확인해 주세요.');
      const frequency=a.experience==='없다'?'0회':a.frequency;
      if(!['0회','주 3회 이상 이용','주 1~2회 이용','월 1~2회 정도 이용','과거에 여러 차례 이용했지만, 최근 1개월간 이용하지 않음','지금까지 한두번만 이용해 봄'].includes(frequency))throw Error('이용 횟수를 확인해 주세요.');
      if(!Array.isArray(a.criteria)||!a.criteria.length||a.criteria.length>3||new Set(a.criteria).size!==a.criteria.length||a.criteria.some(x=>!allowed.includes(x)))throw Error('고려 조건을 선택해 주세요.');
      const other=a.criteria.includes('기타')?String(a.other||'').trim():'';
      if(a.criteria.includes('기타')&&(!other||other.length>500))throw Error('기타 내용을 확인해 주세요.');
      const usageAllowed=['출퇴근 또는 등하교할 때','대중교통 환승 및 연계 이동 시','가까운 목적지로 이동할 때','여가·산책·관광을 즐길 때','급하게 이동해야 할 때','기타'];
      if(!Array.isArray(a.usage)||!a.usage.length||a.usage.length>3||new Set(a.usage).size!==a.usage.length||a.usage.some(x=>!usageAllowed.includes(x)))throw Error('이용 상황은 1~3개 선택해 주세요.');
      const usageOther=a.usage.includes('기타')?String(a.usageOther||'').trim():'';
      if(a.usage.includes('기타')&&(!usageOther||usageOther.length>500))throw Error('기타 이용 상황을 확인해 주세요.');
      const safeUsageOther=/^[=+@-]/.test(usageOther)?"'"+usageOther:usageOther;
      const safeOther=/^[=+@-]/.test(other)?"'"+other:other;
      sheet.getRange(rowNumber,3,1,18).setValues([['completed',new Date().toISOString(),'',a.gender,a.experience,frequency,[...new Set(a.criteria)].join(' | '),safeOther,a.ageGroup,a.experience==='없다'?'expected':'experienced',a.usage.join(' | '),safeUsageOther,a.criteria[0]||'',a.criteria[1]||'',a.criteria[2]||'',a.usage[0]||'',a.usage[1]||'',a.usage[2]||'']]);
    }
    result={ok:true,participantId:id};
  }catch(err){result={ok:false,error:String(err.message||err)}}finally{if(lock.hasLock())lock.releaseLock()}
  return ContentService.createTextOutput(callback+'('+JSON.stringify(result).replace(/</g,'\\u003c')+');').setMimeType(ContentService.MimeType.JAVASCRIPT);
}


function saveMission_(ss,session,participantId,m,events) {
  const uuid=/^[a-f0-9-]{36}$/;
  if(!uuid.test(m.attemptId||'')||!['running','success'].includes(m.status))throw Error('잘못된 미션 기록입니다.');
  const numeric=['activeSeconds','totalSeconds','revision'];
  if(numeric.some(key=>!Number.isFinite(m[key])||m[key]<0)||!Number.isInteger(m.revision))throw Error('잘못된 측정값입니다.');
  if(!Number.isFinite(Date.parse(m.startedAt))||(m.endedAt&&!Number.isFinite(Date.parse(m.endedAt))))throw Error('잘못된 미션 시각입니다.');
  const first=(value)=>value===null||value===undefined?'':Number.isFinite(value)&&value>=0?value:'';
  const eventTypes=['prototype_ready','mission_open','mission_close','filter_toggle','bike_select','locate','inactive_click','unlock_attempt','mission_success','tab_hidden','tab_visible','page_exit'];
  if(!Array.isArray(events)||events.length>4||events.some(event=>!uuid.test(event.id||'')||!eventTypes.includes(event.type)||!Number.isInteger(event.seq)||event.seq<1||!Number.isFinite(event.seconds)||event.seconds<0||!Number.isFinite(Date.parse(event.at))))throw Error('잘못된 행동 기록입니다.');
  let summary=ss.getSheetByName('UT_missions');
  const summaryHeaders=['session_key','participant_id','attempt_id','mission_status','started_at','ended_at','total_seconds','active_seconds','first_filter_seconds','first_recent_filter_seconds','filter_discovery','revision','last_saved_at'];
  if(!summary){summary=ss.insertSheet('UT_missions');summary.appendRow(summaryHeaders);summary.setFrozenRows(1);}
  const rows=summary.getDataRange().getValues();
  const index=rows.findIndex((row,i)=>i>0&&row[0]===session&&row[2]===m.attemptId);
  const discovery=m.firstRecentFilterSeconds===null||m.firstRecentFilterSeconds===undefined?(m.status==='success'?'발견하지 못함':'미확인'):'발견(힌트 여부 미기록)';
  const row=[session,participantId,m.attemptId,m.status,m.startedAt,m.endedAt||'',m.totalSeconds,m.activeSeconds,first(m.firstFilterSeconds),first(m.firstRecentFilterSeconds),discovery,m.revision,new Date().toISOString()];
  if(index<0)summary.appendRow(row);
  else if(m.revision>=Number(rows[index][11])&&!(rows[index][3]==='success'&&m.status!=='success'))summary.getRange(index+1,1,1,row.length).setValues([row]);
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
