"use strict";
const $ = (id) => document.getElementById(id);
const $$ = (sel) => [...document.querySelectorAll(sel)];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const uid = () => (window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`);
const MODULES = [
  ["Генератор",3,"⚡"], ["Вентиляция",3,"≋"], ["Освещение",3,"☼"],
  ["Медблок",3,"✚"], ["Пищеблок",3,"▧"], ["Водосборник",3,"◉"],
  ["Склад",4,"▣"], ["Верстак",3,"⚒"], ["Туалет",3,"◫"],
  ["Зона отдыха",3,"♧"], ["Безопасность",3,"▩"], ["Обогрев",3,"☷"],
  ["Разведцентр",3,"◎"], ["Библиотека",1,"▤"], ["Воздушный фильтр",1,"◈"],
  ["Самогонный аппарат",1,"⚗"], ["Биткоин-ферма",3,"◫"],
  ["Солнечная батарея",1,"☀"], ["Тир",1,"⊕"], ["Зал славы",3,"✧"],
  ["Тренажёрный зал",2,"▥"], ["Культистский круг",1,"◇"], ["Блок оружия",3,"⌘"]
];
const EMPTY = () => ({
  format:"tarkov-atlas-1", completed:[], pins:[], routes:{}, items:[], hideout:{},
  selectedMap:"Customs", filters:{quests:true,pins:true,routes:true,gps:true}
});
let state = EMPTY();
let maps=[], quests=[], meta={}, mapByKey={}, questById={};
let activePage="overview", questLimit=48, selectedQuest=null;
let mapTool="move", zoom=1, panX=0, panY=0;
let pendingPin=null, drag=null, currentGPS=null, toastTimer=null, saveTimer=null, bridgeReady=false;
let currentMap=null;

function toast(message,bad=false) {
  const el=$("toast"); el.textContent=message; el.classList.toggle("error",bad);
  el.classList.add("show"); clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>el.classList.remove("show"),3400);
}
function persist() {
  state.format="tarkov-atlas-1";
  localStorage.setItem("tarkov-atlas-state",JSON.stringify(state));
  clearTimeout(saveTimer);
  saveTimer=setTimeout(()=> {
    if(bridgeReady) window.pywebview.api.save_profile(state).catch(e=>console.warn("save_profile",e));
  },350);
  renderSummary();
}
function setPage(page) {
  if(!$( "page-"+page )) return;
  activePage=page;
  $$(".nav-btn").forEach(b=>b.classList.toggle("active", b.dataset.page===page));
  $$(".page").forEach(p=>p.classList.toggle("active",p.id==="page-"+page));
  const titles={overview:["ОБЗОР / КОМАНДНЫЙ ЦЕНТР","Планируй рейд. Контролируй прогресс."],
    maps:["КАРТЫ / ТАКТИЧЕСКАЯ СЕТЬ","Интерактивная карта локации"],
    quests:["ЗАДАНИЯ / ЖУРНАЛ","Задания и отслеживание прогресса"],
    items:["ИНВЕНТАРЬ / ЧЕК-ЛИСТ","Список необходимых предметов"],
    hideout:["УБЕЖИЩЕ / ПРОГРЕСС","Модули убежища"], settings:["СИСТЕМА / НАСТРОЙКИ","Параметры и резервная копия"]};
  [$("breadcrumb").textContent,$("pageTitle").textContent]=titles[page];
  if(page==="maps") { requestAnimationFrame(()=>{ fitMap(); drawOverlay(); renderMapSide();}); }
  if(page==="quests") renderQuests();
  if(page==="items") renderItems();
  if(page==="hideout") renderHideout();
  if(page==="settings") updateSettings();
}
function renderSummary() {
  $("statQuests").textContent=quests.length || "—";
  $("statDone").textContent=(state.completed||[]).length;
  $("statPins").textContent=(state.pins||[]).length;
  $("questNum").textContent=(state.completed||[]).length+"/"+(quests.length||"—");
  const date=meta.questSnapshotDate?new Date(meta.questSnapshotDate).toLocaleDateString("ru-RU"):"—";
  $("archiveDate").textContent="Архив от "+date;
  $("overviewSource").textContent=`Задания: архив от ${date}. Изменения после этой даты автоматически не учитываются.`;
  $("snapshotAbout").textContent=`Встроенный снимок от ${date}: ${quests.length} заданий. Русская локализация — из архива Tarkov MoA.`;
}
function quickMap(key) { state.selectedMap=key; persist(); chooseMap(key); setPage("maps"); }
function renderQuickMaps() {
  const keys=["Customs","Woods","Factory","StreetsOfTarkov","Reserve","Shoreline"];
  $("quickMaps").innerHTML=keys.map(k=>{
    const m=mapByKey[k];
    return `<button class="quick-map" data-map="${esc(k)}"><div><b>${esc(m.name)}</b><small>Офлайн-карта · задания</small></div><span class="map-symbol">⌖</span></button>`;
  }).join("");
  $$("#quickMaps [data-map]").forEach(b=>b.onclick=()=>quickMap(b.dataset.map));
}
function chooseMap(key) {
  currentMap=mapByKey[key]||maps[0];
  if(!currentMap)return;
  state.selectedMap=currentMap.key; persist();
  $("mapSelect").value=currentMap.key;
  $("mapCurrentName").textContent=currentMap.name;
  $("mapImage").src="./maps/"+currentMap.key+".svg";
  $("mapImage").onerror=()=>{$("mapLoaded").textContent="Не удалось открыть локальную карту";toast("Файл карты не найден в установщике",true)};
  $("mapImage").onload=()=>{$("mapLoaded").textContent=currentMap.name+" · файл локальный";fitMap();drawOverlay()};
  zoom=1;panX=0;panY=0;selectedQuest=null;
  if(activePage==="maps") {requestAnimationFrame(()=>{fitMap();drawOverlay();renderMapSide()});}
}
function fitMap() {
  if(!currentMap)return;
  const viewport=$("mapViewport"), scene=$("mapScene"), w=currentMap.width,h=currentMap.height;
  const vw=viewport.clientWidth, vh=viewport.clientHeight;
  if(vw<10||vh<10)return;
  const factor=Math.min((vw-26)/w,(vh-26)/h);
  scene.style.width=(w*factor)+"px";scene.style.height=(h*factor)+"px";
  $("mapOverlay").setAttribute("viewBox",`0 0 ${w} ${h}`);
  applyMapTransform();
}
function applyMapTransform() {
  $("mapScene").style.transform=`translate(-50%, -50%) translate(${panX}px, ${panY}px) scale(${zoom})`;
  $("zoomValue").textContent=Math.round(zoom*100)+"%";
}
function worldToUV(map, x, z) {
  const a=map.bounds[0],b=map.bounds[1];
  const theta=map.rotation*Math.PI/180;
  const c=Math.cos(theta),s=Math.sin(theta);
  const proj=(xx,zz)=>[xx*c-zz*s, xx*s+zz*c];
  const p=proj(x,z),p1=proj(a[0],a[1]),p2=proj(b[0],b[1]);
  const dx=p2[0]-p1[0],dy=p2[1]-p1[1];
  if(Math.abs(dx)<.0001||Math.abs(dy)<.0001)return null;
  const u=(p[0]-p1[0])/dx,v=(p[1]-p1[1])/dy;
  if(!Number.isFinite(u)||!Number.isFinite(v))return null;
  return {u,v};
}
function eventUV(evt) {
  const r=$("mapScene").getBoundingClientRect();
  if(!r.width||!r.height)return null;
  return {u:clamp((evt.clientX-r.left)/r.width,0,1),v:clamp((evt.clientY-r.top)/r.height,0,1)};
}
function svgCircle(x,y,r,color,inner="") {
  return `<g><circle cx="${x}" cy="${y}" r="${r*1.8}" fill="${color}" opacity=".20"/><circle cx="${x}" cy="${y}" r="${r}" fill="${color}" stroke="#0b171b" stroke-width="${Math.max(1,r*.3)}"/>${inner}</g>`;
}
function getMapQuests() {
  if(!currentMap)return[];
  const text=$("mapQuestSearch").value.trim().toLocaleLowerCase("ru");
  return quests.filter(q=>q.maps.includes(currentMap.key) && (!text||(`${q.name} ${q.trader}`.toLocaleLowerCase("ru").includes(text))));
}
function drawOverlay() {
  if(!currentMap)return;
  const w=currentMap.width,h=currentMap.height;
  const markerSize=Math.max(4,Math.min(w,h)*.008);
  const chunks=[];
  const mapQuests=getMapQuests();
  const idFilter=selectedQuest ? [selectedQuest]:mapQuests.map(q=>q.id);
  const showQuests=$("layerQuests").checked;
  if(showQuests){
    let count=0;
    for(const qid of idFilter){
      const q=questById[qid];if(!q)continue;
      for(const obj of q.objectives)for(const zone of obj.zones){
        if(zone.map!==currentMap.key)continue;
        const point=worldToUV(currentMap,zone.x,zone.z);
        if(!point||point.u<0||point.u>1||point.v<0||point.v>1)continue;
        const x=point.u*w,y=point.v*h;
        const color=state.completed.includes(qid)?"#88a95e":"#dfb578";
        chunks.push(`<g class="quest-point" data-quest="${esc(qid)}"><title>${esc(q.name+" — "+obj.name)}</title>`+
          svgCircle(x,y,markerSize,color,`<text x="${x+markerSize*1.5}" y="${y-markerSize*1.3}" font-size="${markerSize*1.85}" fill="#e8d6b8" paint-order="stroke" stroke="#0a1216" stroke-width="${markerSize*.6}">${selectedQuest===qid?esc(q.name).slice(0,30):"●"}</text>`)+`</g>`);
        if(++count>=450)break;
      }
      if(count>=450)break;
    }
  }
  if($("layerRoutes").checked){
    const pts=state.routes[currentMap.key]||[];
    if(pts.length){
      const routePoints=pts.map(p=>`${p.u*w},${p.v*h}`).join(" ");
      chunks.push(`<polyline points="${routePoints}" fill="none" stroke="#a3c46b" stroke-width="${markerSize*.58}" stroke-linejoin="round" stroke-linecap="round" stroke-dasharray="${markerSize*.75} ${markerSize*.45}" />`);
      pts.forEach((p,i)=>chunks.push(svgCircle(p.u*w,p.v*h,markerSize*.52,"#a3c46b",
        `<title>Точка маршрута ${i+1}</title>`)));
    }
  }
  if($("layerPins").checked){
    for(const pin of state.pins.filter(p=>p.map===currentMap.key)){
      chunks.push(`<g><title>${esc(pin.name+" "+(pin.note||""))}</title>`+
        svgCircle(pin.u*w,pin.v*h,markerSize*1.05,"#9bbd73",
          `<text x="${pin.u*w+markerSize*1.6}" y="${pin.v*h-markerSize*.8}" font-size="${markerSize*1.8}" fill="#e5f6cd" stroke="#112018" stroke-width="${markerSize*.7}" paint-order="stroke">${esc(pin.name).slice(0,26)}</text>`)+`</g>`);
    }
  }
  if($("layerGPS").checked && currentGPS){
    const point=worldToUV(currentMap,currentGPS.x,currentGPS.z);
    if(point&&point.u>=0&&point.u<=1&&point.v>=0&&point.v<=1){
      const x=point.u*w,y=point.v*h;
      chunks.push(`<g><circle cx="${x}" cy="${y}" r="${markerSize*3}" fill="#79c9dd" opacity=".2"/>`+
        `<circle cx="${x}" cy="${y}" r="${markerSize*1.3}" fill="#79c9dd" stroke="#f0ffff" stroke-width="${markerSize*.42}"/>`+
        `<text x="${x+markerSize*1.8}" y="${y-markerSize*1.4}" fill="#f5ffff" font-size="${markerSize*2.2}" stroke="#15212a" stroke-width="${markerSize*.8}" paint-order="stroke">Я · ${Math.round(currentGPS.y)} м</text></g>`);
    }
  }
  $("mapOverlay").innerHTML=chunks.join("");
  $("mapQuestCount").textContent=mapQuests.length;
  $("mapPinCount").textContent=state.pins.filter(p=>p.map===currentMap.key).length;
}
function renderMapSide(){
  if(!currentMap)return;
  const list=getMapQuests();
  $("mapQuestList").innerHTML=list.slice(0,100).map(q=>
    `<div class="map-quest ${state.completed.includes(q.id)?"done":""}" data-quest="${esc(q.id)}">`+
    `<span class="dot"></span><div><b>${esc(q.name)}</b><small>${esc(q.trader)} · ${q.objectives.length} цели</small></div>`+
    `<span>${selectedQuest===q.id?"◉":"↗"}</span></div>`
  ).join("")||'<div class="empty">Задания для этого фильтра не найдены.</div>';
  $$("#mapQuestList [data-quest]").forEach(el=>el.onclick=()=>{
    selectedQuest=selectedQuest===el.dataset.quest?null:el.dataset.quest;
    drawOverlay();renderMapSide();
  });
  const pins=state.pins.filter(p=>p.map===currentMap.key);
  $("mapPinsList").innerHTML=pins.map(p=>
    `<div class="map-pin"><div><b>${esc(p.name)}</b><small>${esc(p.note||"Личная метка")}</small></div><button data-remove-pin="${esc(p.id)}" title="Удалить метку">×</button></div>`
  ).join("")||'<div class="empty">Выбери «Метка» и нажми на место на карте.</div>';
  $$("#mapPinsList [data-remove-pin]").forEach(b=>b.onclick=()=>{
    if(!confirm("Удалить эту метку?"))return;
    state.pins=state.pins.filter(p=>p.id!==b.dataset.removePin);persist();drawOverlay();renderMapSide();
  });
  $("mapQuestCount").textContent=list.length;$("mapPinCount").textContent=pins.length;
}
function chooseTool(tool){
  mapTool=tool;
  $$("[data-tool]").forEach(b=>b.classList.toggle("selected",b.dataset.tool===tool));
  $("mapViewport").classList.toggle("tool-pin",tool==="pin");
  $("mapViewport").classList.toggle("tool-route",tool==="route");
  $("mapHint").textContent={
    move:"Колесо — масштаб · перетаскивание — перемещение",
    pin:"Щёлкни по карте, чтобы создать метку",
    route:"Щёлкай по карте, чтобы проложить маршрут"
  }[tool];
}
function mapClick(uv) {
  if(!uv)return;
  if(mapTool==="pin") {
    pendingPin={u:uv.u,v:uv.v,map:currentMap.key};
    $("pinName").value="";$("pinNote").value="";
    $("pinDialog").classList.remove("hidden");$("pinName").focus();
  } else if(mapTool==="route"){
    if(!state.routes[currentMap.key])state.routes[currentMap.key]=[];
    state.routes[currentMap.key].push({u:uv.u,v:uv.v});
    persist();drawOverlay();
  }
}
function setZoom(value){
  zoom=clamp(value,.65,6);
  applyMapTransform();
}
function initMapInteractions(){
  const vp=$("mapViewport");
  vp.addEventListener("wheel",e=>{e.preventDefault();setZoom(zoom*(e.deltaY<0?1.2:1/1.2));},{passive:false});
  vp.addEventListener("pointerdown",e=>{
    if(e.button!==0)return;
    drag={id:e.pointerId,startX:e.clientX,startY:e.clientY,px:panX,py:panY,moved:false};
    vp.setPointerCapture(e.pointerId);
  });
  vp.addEventListener("pointermove",e=>{
    const uv=eventUV(e);
    if(uv&&currentMap)$("coordsText").textContent=`МЕТКА НА ИЗОБРАЖЕНИИ: ${(uv.u*100).toFixed(1)}% / ${(uv.v*100).toFixed(1)}% · ${currentMap.name}`;
    if(!drag||drag.id!==e.pointerId)return;
    const dx=e.clientX-drag.startX,dy=e.clientY-drag.startY;
    if(Math.abs(dx)+Math.abs(dy)>5)drag.moved=true;
    if(mapTool==="move"&&drag.moved){panX=drag.px+dx;panY=drag.py+dy;applyMapTransform();}
  });
  vp.addEventListener("pointerup",e=>{
    if(!drag||drag.id!==e.pointerId)return;
    const moved=drag.moved;
    drag=null;
    if(!moved && mapTool!=="move") mapClick(eventUV(e));
  });
  vp.addEventListener("pointercancel",()=>drag=null);
  $$("[data-tool]").forEach(b=>b.onclick=()=>chooseTool(b.dataset.tool));
  $("zoomIn").onclick=()=>setZoom(zoom*1.25);
  $("zoomOut").onclick=()=>setZoom(zoom/1.25);
  $("resetZoom").onclick=()=>{zoom=1;panX=0;panY=0;applyMapTransform()};
  $("clearRoute").onclick=()=>{
    if(!state.routes[currentMap.key]?.length)return;
    if(!confirm("Очистить маршрут для этой локации?"))return;
    state.routes[currentMap.key]=[];persist();drawOverlay();toast("Маршрут очищен");
  };
  $("undoRoute").onclick=()=>{(state.routes[currentMap.key]||[]).pop();persist();drawOverlay()};
  $("pinCancel").onclick=()=>$("pinDialog").classList.add("hidden");
  $("pinSave").onclick=()=>{
    if(!pendingPin||!$("pinName").value.trim()){toast("Введи название метки",true);return;}
    state.pins.push({...pendingPin,id:uid(),name:$("pinName").value.trim(),note:$("pinNote").value.trim()});
    pendingPin=null;$("pinDialog").classList.add("hidden");persist();drawOverlay();renderMapSide();toast("Метка сохранена");
  };
  $("pinDialog").addEventListener("click",e=>{if(e.target.id==="pinDialog")$("pinDialog").classList.add("hidden")});
  $("mapSelect").onchange=e=>{chooseMap(e.target.value);renderMapSide()};
  $("mapQuestSearch").oninput=()=>{selectedQuest=null;renderMapSide();drawOverlay()};
  $$('input[id^="layer"]').forEach(input=>input.onchange=()=>{state.filters[input.id.replace("layer","").toLowerCase()]=input.checked;persist();drawOverlay()});
  new ResizeObserver(()=>{if(activePage==="maps")fitMap()}).observe(vp);
}
function getFilteredQuests(){
  const term=$("questSearch").value.trim().toLocaleLowerCase("ru");
  const trader=$("questTraderFilter").value,map=$("questMapFilter").value,mode=$("questStateFilter").value;
  return quests.filter(q=>{
    const done=state.completed.includes(q.id);
    if(trader&&q.trader!==trader)return false;
    if(map&&!q.maps.includes(map))return false;
    if(mode==="completed"&&!done || mode==="active"&&done || mode==="kappa"&&!q.kappa)return false;
    if(term&&!(`${q.name} ${q.trader} ${q.objectives.map(o=>o.name).join(" ")}`.toLocaleLowerCase("ru").includes(term)))return false;
    return true;
  });
}
function renderQuests(){
  const filtered=getFilteredQuests();
  $("questSummary").textContent=`${filtered.length} заданий · ${state.completed.length} выполнено`;
  $("questCards").innerHTML=filtered.slice(0,questLimit).map(q=>{
    const done=state.completed.includes(q.id);
    const locations=q.maps.map(m=>mapByKey[m]?.name).filter(Boolean).join(", ")||"Разные локации";
    return `<article class="quest-card ${done?"done":""}">
      <div class="q-heading"><span class="trader">${esc(q.trader)}</span>${q.kappa?'<span class="kappa">КАППА</span>':""}</div>
      <h3>${esc(q.name)}</h3>
      <div class="q-meta">${esc(locations)} · ${q.objectives.length} этапов<br>${esc(q.objectives[0]?.name||"")}</div>
      <div class="q-actions"><label class="q-check"><input type="checkbox" data-done="${esc(q.id)}" ${done?"checked":""}> ${done?"Выполнено":"Отметить готовым"}</label>
      <button class="secondary" data-go-quest="${esc(q.id)}" ${q.maps.length?"":"disabled"}>На карту ↗</button></div>
    </article>`;
  }).join("")||'<div class="empty">Ничего не найдено — попробуй другой фильтр.</div>';
  $("moreQuests").style.display=questLimit<filtered.length?"block":"none";
  $$("#questCards [data-done]").forEach(input=>input.onchange=e=>{
    const id=e.target.dataset.done;
    state.completed=e.target.checked?[...new Set([...state.completed,id])]:state.completed.filter(x=>x!==id);
    persist();renderQuests();
  });
  $$("#questCards [data-go-quest]").forEach(button=>button.onclick=()=>{
    const q=questById[button.dataset.goQuest], target=q.maps.find(m=>mapByKey[m]);
    if(!target){toast("У этого задания нет доступной офлайн-карты",true);return;}
    chooseMap(target);selectedQuest=q.id;setPage("maps");drawOverlay();renderMapSide();
  });
}
function renderItems(){
  $("itemSummary").textContent=`${state.items.length} записей`;
  $("itemList").innerHTML=state.items.map(p=>`
    <div class="item ${p.got>=p.need?"done":""}">
      <div><div class="item-name">${esc(p.name)}</div><small>${esc(p.category)} · ${p.got>=p.need?"Собрано":"Необходимо собрать"}</small></div>
      <div class="counter">
        <button data-item-dec="${esc(p.id)}" aria-label="Уменьшить число">−</button>
        <strong>${p.got} / ${p.need}</strong>
        <button data-item-inc="${esc(p.id)}" aria-label="Увеличить число">+</button>
        <button class="item-delete" data-item-delete="${esc(p.id)}" title="Удалить предмет">×</button>
      </div>
    </div>`).join("")||'<div class="empty">Пока пусто. Добавь предмет, который нужно найти во время рейда.</div>';
  for(const action of ["inc","dec","delete"]){
    $$(`[data-item-${action}]`).forEach(b=>b.onclick=()=>{
      const i=state.items.findIndex(p=>p.id===b.dataset["item"+action.charAt(0).toUpperCase()+action.slice(1)]);
      if(i<0)return;
      if(action==="inc")state.items[i].got=clamp(state.items[i].got+1,0,state.items[i].need);
      if(action==="dec")state.items[i].got=clamp(state.items[i].got-1,0,state.items[i].need);
      if(action==="delete")state.items.splice(i,1);
      persist();renderItems();
    });
  }
}
function renderHideout(){
  const total=MODULES.reduce((n,m)=>n+m[1],0),done=Object.values(state.hideout).reduce((n,x)=>n+x,0);
  $("hideoutSummary").textContent=`${done} / ${total} уровней`;
  $("hideoutGrid").innerHTML=MODULES.map(([name,levels,icon])=>{
    const value=state.hideout[name]||0;
    return `<div class="hideout-card"><header><div class="hideout-icon">${icon}</div><div><h3>${name}</h3><small>Уровень ${value} / ${levels}</small></div></header>
      <div class="level-dots">${Array.from({length:levels},(_,i)=>`<button class="level-dot ${i<value?"built":""}" data-station="${esc(name)}" data-level="${i+1}" title="Построен уровень ${i+1}">${i<value?"✓":i+1}</button>`).join("")}</div></div>`;
  }).join("");
  $$("#hideoutGrid [data-station]").forEach(b=>b.onclick=()=>{
    const level=+b.dataset.level;
    state.hideout[b.dataset.station]=state.hideout[b.dataset.station]===level?level-1:level;
    persist();renderHideout();
  });
}
function updateSettings(){
  if(!bridgeReady)return;
  window.pywebview.api.get_settings().then(s=>{$("shotFolder").textContent=s.screenshots_dir||"Не установлена"});
}
async function pollGPS(){
  if(!bridgeReady)return;
  try{
    const result=await window.pywebview.api.poll_screenshot();
    if(result.ok&&result.changed&&result.position){
      currentGPS=result.position;
      $("shotIndicator").textContent=`GPS: ${currentGPS.x.toFixed(0)}, ${currentGPS.z.toFixed(0)}`;
      $("gpsHealthIcon").classList.add("good");$("gpsHealthIcon").textContent="✓";
      $("gpsHealthText").textContent="Получен скриншот: "+currentGPS.file;
      $("shotStatus").textContent="Последняя позиция: X "+currentGPS.x+" / Z "+currentGPS.z+". Выбери текущую игровую карту вручную.";
      if(activePage==="maps")drawOverlay();
    } else if(!result.ok&&(!$("shotStatus").dataset.warned)){
      $("shotStatus").textContent=result.error||"GPS: скриншоты пока не обнаружены";
    }
  }catch(e){console.warn("Screenshot polling failed",e)}
}
async function exportProfile(){
  const saved=JSON.parse(JSON.stringify(state));
  if(bridgeReady){
    const result=await window.pywebview.api.export_profile(saved);
    if(result.ok){toast("Резервная копия экспортирована");return;}
    if(result.cancelled)return;
    toast(result.error||"Не удалось экспортировать",true);return;
  }
  const url=URL.createObjectURL(new Blob([JSON.stringify(saved,null,2)],{type:"application/json"}));
  const a=document.createElement("a");a.href=url;a.download="tarkov-atlas-progress.json";a.click();
  setTimeout(()=>URL.revokeObjectURL(url),3000);
}
async function importProfile(){
  if(!bridgeReady){toast("Импорт доступен в установленной Windows-программе",true);return;}
  const r=await window.pywebview.api.import_profile();
  if(r.ok){
    if(!confirm("Заменить текущий прогресс данными из файла?"))return;
    state=normalize(r.profile);persist();chooseMap(state.selectedMap);renderAll();toast("Профиль импортирован");
  }else if(!r.cancelled)toast(r.error||"Не удалось импортировать",true);
}
function normalize(p){
  const def=EMPTY();if(!p||p.format!=="tarkov-atlas-1")return def;
  return {
    ...def,...p,
    completed:Array.isArray(p.completed)?p.completed.filter(x=>typeof x==="string"):[],
    pins:Array.isArray(p.pins)?p.pins.filter(x=>typeof x?.map==="string"&&Number.isFinite(x?.u)&&Number.isFinite(x?.v)):[],
    routes:p.routes&&typeof p.routes==="object"?p.routes:{},
    items:Array.isArray(p.items)?p.items:[],
    hideout:p.hideout&&typeof p.hideout==="object"?p.hideout:{},
    filters:{...def.filters,...(p.filters||{})}
  };
}
function renderAll(){renderSummary();renderQuests();renderItems();renderHideout();drawOverlay();renderMapSide();}
function setupEvents(){
  $$(".nav-btn").forEach(b=>b.onclick=()=>setPage(b.dataset.page));
  $$("[data-go]").forEach(b=>b.onclick=()=>setPage(b.dataset.go));
  $("questSearch").oninput=()=>{questLimit=48;renderQuests()};
  for(const id of ["questTraderFilter","questMapFilter","questStateFilter"])$(id).onchange=()=>{questLimit=48;renderQuests()};
  $("moreQuests").onclick=()=>{questLimit+=48;renderQuests()};
  $("itemForm").onsubmit=e=>{
    e.preventDefault();
    const name=$("itemName").value.trim(),need=parseInt($("itemNeed").value,10);
    if(!name||!Number.isInteger(need)||need<1||need>999)return;
    state.items.push({id:uid(),name,need,got:0,category:$("itemCategory").value});
    $("itemName").value="";$("itemNeed").value="1";persist();renderItems();toast("Предмет добавлен");
  };
  $("exportQuick").onclick=exportProfile;$("exportProfile").onclick=exportProfile;
  $("importProfile").onclick=importProfile;
  $("chooseFolder").onclick=async()=>{
    if(!bridgeReady){toast("Выбор папки доступен в Windows-версии",true);return;}
    const r=await window.pywebview.api.choose_screenshots_dir();
    if(r.ok){$("shotFolder").textContent=r.screenshots_dir;toast("Папка сохранена");pollGPS();}
    else if(!r.cancelled)toast(r.error||"Не удалось выбрать папку",true);
  };
  document.addEventListener("keydown",e=>{if(e.key==="Escape")$("pinDialog").classList.add("hidden")});
  initMapInteractions();
}
async function init(){
  try{
    [maps,quests,meta]=await Promise.all([
      fetch("./data/maps.json").then(r=>{if(!r.ok)throw Error("maps.json");return r.json()}),
      fetch("./data/quests.json").then(r=>{if(!r.ok)throw Error("quests.json");return r.json()}),
      fetch("./data/meta.json").then(r=>r.json())
    ]);
    mapByKey=Object.fromEntries(maps.map(m=>[m.key,m]));questById=Object.fromEntries(quests.map(q=>[q.id,q]));
    try{state=normalize(JSON.parse(localStorage.getItem("tarkov-atlas-state")||"null"))}catch{state=EMPTY()}
    $("mapSelect").innerHTML=maps.map(m=>`<option value="${esc(m.key)}">${esc(m.name)}</option>`).join("");
    $("questMapFilter").innerHTML+=[...maps].sort((a,b)=>a.name.localeCompare(b.name,"ru"))
      .map(m=>`<option value="${esc(m.key)}">${esc(m.name)}</option>`).join("");
    [...new Set(quests.map(q=>q.trader))].sort((a,b)=>a.localeCompare(b,"ru")).forEach(t=>{
      const o=document.createElement("option");o.value=t;o.textContent=t;$("questTraderFilter").appendChild(o);
    });
    for(const key of Object.keys(state.filters||{})){
      const input=$("layer"+key[0].toUpperCase()+key.slice(1));if(input)input.checked=state.filters[key];
    }
    setupEvents();renderQuickMaps();chooseMap(state.selectedMap);renderAll();setPage("overview");
    document.addEventListener("pywebviewready",async()=>{
      bridgeReady=true;
      try{
        const remote=await window.pywebview.api.load_profile();
        if(remote.format==="tarkov-atlas-1"){
          state=normalize(remote);
          chooseMap(state.selectedMap);renderAll();
        }
        updateSettings();pollGPS();setInterval(pollGPS,1800);
      }catch(e){console.warn("Bridge initialization failed",e);toast("Не удалось загрузить сохранённый профиль",true);}
    });
    if(window.pywebview?.api){
      document.dispatchEvent(new Event("pywebviewready"));
    }
  }catch(e){
    console.error(e);$("page-overview").innerHTML=`<div class="panel"><h2>Ошибка загрузки данных</h2><p>В установщике отсутствуют файлы карт или квестов. Проверьте целостность установки.</p><code>${esc(e.message)}</code></div>`;
  }
}
init();
