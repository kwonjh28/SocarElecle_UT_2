/* No participant-facing clock. Same-origin prototype events only. */
window.createMissionTracker = function(state, persist, api, onComplete) {
  let clock = null, reasons = new Set(), inFlight = false, lastSent = '', stopped = false;
  const now = () => performance.now();
  function checkpoint() {
    if (clock !== null && state.mission) state.mission.activeMs += now() - clock;
    clock = state.mission && state.mission.status === 'running' && !reasons.size ? now() : null;
  }
  function seconds() { checkpoint(); return +(state.mission.activeMs / 1000).toFixed(3); }
  function record(type, details = {}) {
    const m = state.mission;
    if (!m) return;
    const elapsed = seconds();
    m.events.push({id: crypto.randomUUID(), seq:m.events.length + 1, type, at:new Date().toISOString(), seconds:elapsed, details});
    persist();
  }
  function summary() {
    const m=state.mission;
    if(!m) return null;
    return {attemptId:m.attemptId,startedAt:m.startedAt,endedAt:m.endedAt || '',status:m.status,activeSeconds:seconds(),totalSeconds:+(((m.endedAt?Date.parse(m.endedAt):Date.now())-Date.parse(m.startedAt))/1000).toFixed(3),firstFilterSeconds:m.firstFilterSeconds,firstRecentFilterSeconds:m.firstRecentFilterSeconds,filterDiscovery:m.firstFilterSeconds===null?(m.status!=='running'?'발견하지 못함':'미확인'):'발견',revision:m.events.length};
  }
  async function flush() {
    if(inFlight || !state.mission || !window.UT_CONFIG.endpoint || !state.participantId || stopped) return;
    checkpoint(); persist();
    const m=state.mission, batch=m.events.slice(m.acked,m.acked+4), data=summary();
    const signature=JSON.stringify(data);
    if(!batch.length && signature===lastSent)return;
    inFlight=true;
    try {await api('track',{mission:data,events:batch});m.acked+=batch.length;lastSent=signature;persist();}
    catch { /* Keep the unacknowledged events for retry. */ }
    finally {inFlight=false;if(m.acked<m.events.length&&!stopped)setTimeout(flush,400);}
  }
  function ready() {
    if(state.step!==7)return;
    if(state.mission && state.mission.status!=='running'){onComplete();return;}
    if(!state.mission)state.mission={attemptId:crypto.randomUUID(),startedAt:new Date().toISOString(),activeMs:0,status:'running',firstFilterSeconds:null,firstRecentFilterSeconds:null,events:[],acked:0};
    if(document.hidden)reasons.add('hidden');
    if(clock!==null)return;
    checkpoint();record('prototype_ready',{screen:'map'});flush();
  }
  function visibility() {
    if(!state.mission || state.mission.status!=='running' || state.step!==7)return;
    checkpoint();
    if(document.hidden)reasons.add('hidden');else reasons.delete('hidden');
    checkpoint();record(document.hidden?'tab_hidden':'tab_visible');flush();
  }
  function receive(event) {
    const frame=document.querySelector('.test iframe');
    if(event.origin!==location.origin || !frame || event.source!==frame.contentWindow || event.data?.source!=='elecle-prototype')return;
    const {type,details={}}=event.data;
    if(type==='ready'){ready();return;}
    if(!state.mission || state.mission.status!=='running' || state.step!==7)return;
    if(type==='mission_open') {checkpoint();reasons.add('mission');checkpoint();record(type);}
    else if(type==='mission_close') {record(type);reasons.delete('mission');checkpoint();}
    else if(type==='filter_toggle') {
      const time=seconds();
      if(details.enabled && state.mission.firstFilterSeconds===null)state.mission.firstFilterSeconds=time;
      if(details.filter==='recent' && details.enabled && state.mission.firstRecentFilterSeconds===null)state.mission.firstRecentFilterSeconds=time;
      record(type,details);
    } else if(['bike_select','locate','inactive_click','unlock_attempt'].includes(type)) {
      record(type,details);
      if(type==='unlock_attempt') {
        checkpoint();state.mission.status=details.success===true?'success':'failure';state.mission.endedAt=new Date().toISOString();clock=null;
        record(details.success===true?'mission_success':'mission_failure',{bikeId:details.bikeId});persist();flush();onComplete();
      }
    }
    // No map drag/pointermove events are collected.
  }
  window.addEventListener('message',receive);
  document.addEventListener('visibilitychange',visibility);
  window.addEventListener('pagehide',()=>{if(state.mission && state.mission.status==='running'){checkpoint();clock=null;record('page_exit');persist();flush();}});
  setInterval(()=>{if(state.mission && state.mission.status==='running' && state.step===7){checkpoint();persist();flush();}},5000);
  return {ready,summary,flush};
};
