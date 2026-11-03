const SPREADSHEET_ID = '1qbqs7qk_Y_sr6Qq8bAV2eh6YbM2PexjENcTQ5SlU_VU';
const HEADERS = ['session_key','participant_id','status','submitted_at','age','gender','experience','frequency','criteria','other','age_group','usage_question_type','usage_situations','usage_other'];
function doGet(e) {
  const callback = e.parameter.callback || '';
  if (!/^ut_[a-zA-Z0-9_]+$/.test(callback)) return ContentService.createTextOutput('Invalid callback');
  let result;
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const payload = JSON.parse(e.parameter.payload || '{}');
    if (!/^[a-f0-9-]{36}$/.test(payload.session || '')) throw Error('잘못된 세션입니다.');
    if (!['register','submit'].includes(e.parameter.action)) throw Error('지원하지 않는 요청입니다.');
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
    if(e.parameter.action==='submit'){
      const a=payload.answers||{};
      const allowed=['현재 위치에서 자전거까지의 거리','배터리 잔량','자전거의 이용 가능 상태','자전거의 외관 및 관리 상태','기타'];
      if(!['10대','20대','30대','40대','50대','60대 이상'].includes(a.ageGroup))throw Error('연령대를 확인해 주세요.');
      if(!['남성','여성','응답하지 않음'].includes(a.gender)||!['있다','없다'].includes(a.experience))throw Error('필수 답변을 확인해 주세요.');
      const frequency=a.experience==='없다'?'0회':a.frequency;
      if(!['0회','1~2회','3~5회','6~11회','12회 이상'].includes(frequency))throw Error('이용 횟수를 확인해 주세요.');
      if(!Array.isArray(a.criteria)||!a.criteria.length||a.criteria.length>3||a.criteria.some(x=>!allowed.includes(x)))throw Error('고려 조건을 선택해 주세요.');
      const other=a.criteria.includes('기타')?String(a.other||'').trim():'';
      if(a.criteria.includes('기타')&&(!other||other.length>500))throw Error('기타 내용을 확인해 주세요.');
      const usageAllowed=['출퇴근 또는 등하교할 때','대중교통 환승 및 연계 이동 시','가까운 목적지로 이동할 때','여가·산책·관광을 즐길 때','급하게 이동해야 할 때','기타'];
      if(!Array.isArray(a.usage)||!a.usage.length||a.usage.length>3||new Set(a.usage).size!==a.usage.length||a.usage.some(x=>!usageAllowed.includes(x)))throw Error('이용 상황은 1~3개 선택해 주세요.');
      const usageOther=a.usage.includes('기타')?String(a.usageOther||'').trim():'';
      if(a.usage.includes('기타')&&(!usageOther||usageOther.length>500))throw Error('기타 이용 상황을 확인해 주세요.');
      const safeUsageOther=/^[=+@-]/.test(usageOther)?"'"+usageOther:usageOther;
      const safeOther=/^[=+@-]/.test(other)?"'"+other:other;
      sheet.getRange(rowNumber,3,1,12).setValues([['completed',new Date().toISOString(),'',a.gender,a.experience,frequency,[...new Set(a.criteria)].join(' | '),safeOther,a.ageGroup,a.experience==='없다'?'expected':'experienced',a.usage.join(' | '),safeUsageOther]]);
    }
    result={ok:true,participantId:id};
  }catch(err){result={ok:false,error:String(err.message||err)}}finally{if(lock.hasLock())lock.releaseLock()}
  return ContentService.createTextOutput(callback+'('+JSON.stringify(result).replace(/</g,'\\u003c')+');').setMimeType(ContentService.MimeType.JAVASCRIPT);
}
