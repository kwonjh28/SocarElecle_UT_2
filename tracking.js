/* Timers and pending event batches are isolated by mission attempt. */
window.createMissionTracker = function(state,persist,api,onComplete){
  state.missions=state.missions|| (state.mission?[state.mission]:[]);
  if(state.mission){const index=state.missions.findIndex(m=>m.attemptId===state.mission.attemptId);if(index>=0)state.missions[index]=state.mission;else state.missions.push(state.mission);}
  state.missionNumber=state.missionNumber||state.mission?.missionNumber||1;
  state.missions.forEach(m=>{m.missionNumber=m.missionNumber||1;});
  let clock=null,inFlight=false,readyAttempt=null;
  const reasons=new Set(),lastSent=new Map(),now=()=>performance.now();
  function checkpoint(){
    if(clock!==null&&state.mission)state.mission.activeMs+=now()-clock;
    clock=state.mission?.status==='running'&&state.step===7&&!reasons.size?now():null;
  }
  function seconds(){checkpoint();return +(state.mission.activeMs/1000).toFixed(3);}
  function record(type,details={}){
    const m=state.mission;if(!m)return;
    m.events.push({id:crypto.randomUUID(),seq:m.events.length+1,type,at:new Date().toISOString(),seconds:seconds(),details});persist();
  }
  function describe(m){
    if(m===state.mission)checkpoint();
    return {attemptId:m.attemptId,missionNumber:m.missionNumber||1,taskMode:m.missionNumber===2?'filter_prompted':'unprompted',startedAt:m.startedAt,endedAt:m.endedAt||'',status:m.status,activeSeconds:+(m.activeMs/1000).toFixed(3),totalSeconds:+(((m.endedAt?Date.parse(m.endedAt):Date.now())-Date.parse(m.startedAt))/1000).toFixed(3),firstFilterSeconds:m.firstFilterSeconds,firstRecentFilterSeconds:m.firstRecentFilterSeconds,filterDiscovery:m.firstFilterSeconds===null?(m.status==='running'?'미확인':'발견하지 못함'):'발견',revision:m.events.length};
  }
  function summary(){return state.mission?describe(state.mission):null;}
  function summaries(){return state.missions.map(describe);}
  async function flush(){
    if(inFlight||!window.UT_CONFIG.endpoint||!state.participantId)return;
    checkpoint();persist();
    const m=state.missions.find(item=>(item.acked||0)<item.events.length)||state.missions.find(item=>JSON.stringify(describe(item))!==lastSent.get(item.attemptId));
    if(!m)return;
    const data=describe(m),batch=m.events.slice(m.acked||0,(m.acked||0)+4),signature=JSON.stringify(data);
    inFlight=true;
    try{await api('track',{mission:data,events:batch});m.acked=(m.acked||0)+batch.length;lastSent.set(m.attemptId,signature);persist();}
    catch{/* Retry from the same attempt without moving its acknowledgement. */}
    finally{inFlight=false;if(state.missions.some(item=>(item.acked||0)<item.events.length))setTimeout(flush,400);}
  }
  function ready(){
    if(state.step!==7)return;
    if(state.mission&&state.mission.status!=='running'){onComplete();return;}
    if(!state.mission){
      state.mission={attemptId:crypto.randomUUID(),missionNumber:state.missionNumber,startedAt:new Date().toISOString(),activeMs:0,status:'running',firstFilterSeconds:null,firstRecentFilterSeconds:null,events:[],acked:0};
      state.missions.push(state.mission);
    }
    if(readyAttempt===state.mission.attemptId)return;
    readyAttempt=state.mission.attemptId;clock=null;reasons.clear();if(document.hidden)reasons.add('hidden');
    checkpoint();record('prototype_ready',{screen:'map',missionNumber:state.missionNumber});flush();
  }
  function visibility(){
    if(state.mission?.status!=='running'||state.step!==7){flush();return;}
    checkpoint();if(document.hidden)reasons.add('hidden');else reasons.delete('hidden');
    checkpoint();record(document.hidden?'tab_hidden':'tab_visible');flush();
  }
  function receive(event){
    const frame=document.querySelector('.test iframe');
    if(event.origin!==location.origin||!frame||event.source!==frame.contentWindow||event.data?.source!=='elecle-prototype')return;
    const {type,details={}}=event.data;
    if(type==='ready'){ready();return;}
    if(state.mission?.status!=='running'||state.step!==7)return;
    if(type==='mission_open'){checkpoint();reasons.add('mission');checkpoint();record(type);}
    else if(type==='mission_close'){record(type);reasons.delete('mission');checkpoint();}
    else if(type==='filter_toggle'){
      const time=seconds();
      if(details.enabled&&state.mission.firstFilterSeconds===null)state.mission.firstFilterSeconds=time;
      if(details.filter==='recent'&&details.enabled&&state.mission.firstRecentFilterSeconds===null)state.mission.firstRecentFilterSeconds=time;
      record(type,details);
    }else if(['bike_select','locate','inactive_click','unlock_attempt'].includes(type)){
      if(type==='unlock_attempt'){
        const filterUsed=state.mission.firstFilterSeconds!==null;
        const success=details.success===true&&(state.missionNumber!==2||filterUsed);
        record(type,{...details,bikeCorrect:details.success===true,filterUsed,success});
        checkpoint();state.mission.status=success?'success':'failure';state.mission.endedAt=new Date().toISOString();clock=null;
        record(success?'mission_success':'mission_failure',{bikeId:details.bikeId,filterUsed});persist();flush();onComplete();
      }else record(type,details);
    }
  }
  window.addEventListener('message',receive);
  document.addEventListener('visibilitychange',visibility);
  window.addEventListener('pagehide',()=>{if(state.mission?.status==='running'){checkpoint();reasons.add('leaving');checkpoint();record('page_exit');persist();}flush();});
  window.addEventListener('pageshow',()=>{reasons.delete('leaving');checkpoint();});
  window.addEventListener('online',flush);
  setInterval(()=>{if(state.mission?.status==='running'&&state.step===7){checkpoint();persist();}flush();},5000);
  return {ready,summary,summaries,flush};
};
