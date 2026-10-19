const SVG_NS="http://www.w3.org/2000/svg";
const scenes={};
document.querySelectorAll("[data-scene]").forEach(scene=>scenes[scene.dataset.scene]=scene);

const keywords=[
  {text:"Bangalore",x:50,y:26},{text:"better job",x:25,y:39},
  {text:"career growth",x:72,y:43},{text:"leaving family",x:31,y:18},
  {text:"uncertainty",x:67,y:16}
];

const decisions={
  root:{label:"Move to Bangalore?",detail:"A stronger role offers growth and better pay, but relocation creates distance from family.",branches:[
    {id:"go",label:"Go",detail:"Accept the offer and begin building a life in Bangalore."},
    {id:"stay",label:"Stay",detail:"Keep your support system and search for growth closer to home."},
    {id:"negotiate",label:"Negotiate",detail:"Change the conditions before deciding: hybrid work, more time, or relocation support."}
  ]},
  go:{label:"Go",detail:"Accept the role and plan the transition to Bangalore.",branches:[
    {id:"alone",label:"Move alone",detail:"Relocate first, understand the city, and let family follow later."},
    {id:"hybrid",label:"Ask for hybrid",detail:"Split time between Bangalore and home to reduce disruption."},
    {id:"together",label:"Move together",detail:"Relocate as a family and rebuild routines together."}
  ]},
  stay:{label:"Stay",detail:"Remain close to family while protecting stability.",branches:[
    {id:"search",label:"Search again",detail:"Use this offer as a benchmark and pursue a stronger local role."},
    {id:"grow",label:"Grow here",detail:"Create a focused six-month plan in your current role."}
  ]},
  negotiate:{label:"Negotiate",detail:"Change the conditions before committing.",branches:[
    {id:"remote",label:"Remote",detail:"Ask whether the role can begin remotely."},
    {id:"delay",label:"Delay",detail:"Request more time to prepare and test the decision."},
    {id:"package",label:"Better package",detail:"Negotiate compensation that reflects relocation costs."},
    {id:"visit",label:"Trial visit",detail:"Spend a short period in Bangalore before committing."}
  ]}
};

const treeSvg=document.getElementById("treeSvg");
const graph=document.getElementById("treeGraph");
const hint=document.getElementById("treeHint");
const undo=document.getElementById("undoButton");
const logo=document.getElementById("logoStage");
let timers=[];
let history=[];
let activeDecision="root";
let level=0;
let cameraX=0;
let cameraY=240;
let cameraScale=1;
let cameraFrame=0;
let locked=false;

function later(fn,ms){const id=setTimeout(fn,ms);timers.push(id);return id}
function clearTimers(){timers.forEach(clearTimeout);timers=[];cancelAnimationFrame(cameraFrame)}
function show(name){const phone=document.querySelector(".phone");phone.scrollTop=0;Object.values(scenes).forEach(scene=>scene.classList.toggle("active",scene===scenes[name]));requestAnimationFrame(()=>phone.scrollTop=0)}
function setViewBox(x,y,scale=cameraScale){cameraX=x;cameraY=y;cameraScale=scale;treeSvg.setAttribute("viewBox",`${x} ${y} ${430*scale} ${840*scale}`)}
function animateCamera(toX,toY,toScale=1,duration=1800){const fromX=cameraX,fromY=cameraY,fromScale=cameraScale,started=performance.now();const ease=t=>1-Math.pow(1-t,4);cancelAnimationFrame(cameraFrame);function frame(now){const t=Math.min(1,(now-started)/duration),e=ease(t);setViewBox(fromX+(toX-fromX)*e,fromY+(toY-fromY)*e,fromScale+(toScale-fromScale)*e);if(t<1)cameraFrame=requestAnimationFrame(frame)}cameraFrame=requestAnimationFrame(frame)}
function scaleFor(decisionId){return(decisions[decisionId]?.branches.length||2)>=4?1.25:1}

function reset(){clearTimers();history=[];activeDecision="root";level=0;locked=false;graph.innerHTML="";treeSvg.classList.remove("ready");setViewBox(0,240,1);logo.className="logo-stage";document.querySelector(".passage-copy").classList.remove("fade");document.querySelectorAll(".keyword").forEach(el=>el.remove());hint.textContent="Hover to understand · touch to follow";hint.className="branch-caption";undo.classList.remove("visible");show("intro")}
function start(){clearTimers();show("listening");later(showMeanings,1900)}
function showMeanings(){show("meanings");const space=document.getElementById("meaningSpace");keywords.forEach((item,index)=>{const bubble=document.createElement("span");bubble.className="keyword";bubble.textContent=item.text;bubble.style.left=item.x+"%";bubble.style.top=item.y+"%";space.appendChild(bubble);later(()=>bubble.classList.add("rise"),160+index*430)});later(dissolveMeanings,4450)}
function dissolveMeanings(){document.querySelectorAll(".keyword").forEach((bubble,index)=>later(()=>bubble.classList.add("dissolve"),index*170));later(()=>{show("passage");later(()=>document.querySelector(".passage-copy").classList.add("fade"),2200);later(beginJourney,4450)},1500)}
function beginJourney(){show("journey");logo.className="logo-stage";later(()=>logo.classList.add("appear"),1900);later(()=>logo.classList.add("reduce"),3700);later(()=>logo.classList.add("seed"),3800);later(initTree,12000)}

function svg(tag,attrs={}){const el=document.createElementNS(SVG_NS,tag);Object.entries(attrs).forEach(([key,value])=>el.setAttribute(key,String(value)));return el}
function splitLabel(label){const words=label.split(" ");if(label.length<12||words.length===1)return[label];const cut=Math.ceil(words.length/2);return[words.slice(0,cut).join(" "),words.slice(cut).join(" ")]}
function addText(group,label,isCurrent=false){const text=svg("text",{class:"svg-label","text-anchor":"middle","dominant-baseline":"middle",y:splitLabel(label).length===1?"1":"-9"});splitLabel(label).forEach((line,index)=>{const tspan=svg("tspan",{x:"0",dy:index===0?"0":"20"});tspan.textContent=line;text.appendChild(tspan)});if(isCurrent)text.classList.add("current-label");group.appendChild(text)}
function createNode({id,label,detail,x,y,current=false,levelIndex=0}){const outer=svg("g",{class:`svg-node ${current?"current-node":"choice-node"}`,transform:`translate(${x} ${y})`,"data-node-id":id,"data-level":levelIndex,"data-x":x,"data-detail":detail||""});if(!current){outer.setAttribute("data-choice",id);outer.setAttribute("role","button");outer.setAttribute("tabindex","0");outer.setAttribute("aria-label",`${label}. ${detail}`)}const shell=svg("g",{class:"node-shell"});const halo=svg("circle",{class:"node-halo",r:current?"75":"66"});const circle=svg("circle",{class:"node-circle",r:current?"62":"55",filter:"url(#nodeShadow)"});shell.append(halo,circle);addText(shell,label,current);outer.appendChild(shell);graph.appendChild(outer);return outer}
function branchXs(count,parentX){const offsets=count===2?[-108,108]:count===3?[-150,0,150]:count===4?[-210,-70,70,210]:[0];return offsets.map(offset=>parentX+offset)}
function pathD(x1,y1,x2,y2){const control=y1-(y1-y2)*.5;return`M ${x1} ${y1-57} C ${x1} ${control}, ${x2} ${control}, ${x2} ${y2+52}`}
function addBranches(decisionId,levelIndex,parentX){const data=decisions[decisionId]||{label:decisionId,detail:"A new possibility.",branches:[{id:`explore-${levelIndex}`,label:"Explore",detail:"Ask the local AI for the next credible possibilities."},{id:`pause-${levelIndex}`,label:"Pause",detail:"Gather more information before continuing."}]};const parentY=660-levelIndex*430;const childY=parentY-430;const xs=branchXs(data.branches.length,parentX);const layer=svg("g",{class:"branch-level","data-branch-level":levelIndex});data.branches.forEach((branch,index)=>{const path=svg("path",{class:"branch-line",d:pathD(parentX,parentY,xs[index],childY)});path.style.setProperty("--delay",`${index*.12}s`);layer.appendChild(path)});graph.insertBefore(layer,graph.firstChild);data.branches.forEach((branch,index)=>{const node=createNode({...branch,x:xs[index],y:childY,levelIndex});node.style.setProperty("--delay",`${.55+index*.12}s`)});requestAnimationFrame(()=>layer.classList.add("draw"));return data}

function initTree(){graph.innerHTML="";const root=decisions.root;createNode({id:"root",label:root.label,detail:root.detail,x:215,y:660,current:true,levelIndex:0});treeSvg.classList.add("ready");logo.classList.add("hidden");addBranches("root",0,215);animateCamera(0,0,1,1900);later(()=>hint.classList.add("visible"),1400)}

function choose(node){if(locked)return;locked=true;const choice=node.dataset.choice;const chosenX=Number(node.dataset.x);const currentLevel=level;const parentDecision=activeDecision;const parent=graph.querySelector(`.current-node[data-level="${currentLevel}"]`);const parentX=Number(parent?.dataset.x||215);history.push({parentDecision,choice,level:currentLevel,parentX,chosenX});hint.classList.remove("visible");graph.querySelectorAll(`.choice-node[data-level="${currentLevel}"]`).forEach(sibling=>sibling.classList.toggle("rejected",sibling!==node));node.classList.add("chosen");parent?.classList.replace("current-node","past-node");graph.querySelector(`.branch-level[data-branch-level="${currentLevel}"]`)?.classList.add("past-branch");
  later(()=>{node.classList.remove("choice-node","chosen");node.classList.add("current-node");node.removeAttribute("data-choice");node.removeAttribute("role");node.removeAttribute("tabindex");node.dataset.level=String(currentLevel+1);node.querySelector(".node-circle")?.setAttribute("r","62");node.querySelector(".node-halo")?.setAttribute("r","75");activeDecision=choice;level++;const scale=scaleFor(choice),currentY=660-level*430;animateCamera(chosenX-215*scale,currentY-660*scale,scale,1900);later(()=>{addBranches(choice,level,chosenX);undo.classList.add("visible");hint.textContent="Hover to understand · touch to follow";hint.className="branch-caption visible";locked=false},1750)},850)}

function undoChoice(){if(locked||!history.length)return;locked=true;const state=history.pop();hint.classList.remove("visible");const currentLevel=level;graph.querySelector(`.branch-level[data-branch-level="${currentLevel}"]`)?.remove();graph.querySelectorAll(`.choice-node[data-level="${currentLevel}"]`).forEach(node=>node.remove());const selected=graph.querySelector(`.current-node[data-level="${currentLevel}"][data-node-id="${state.choice}"]`);if(selected){selected.classList.remove("current-node");selected.classList.add("choice-node");selected.dataset.level=String(state.level);selected.dataset.choice=state.choice;selected.setAttribute("role","button");selected.setAttribute("tabindex","0");selected.querySelector(".node-circle")?.setAttribute("r","55");selected.querySelector(".node-halo")?.setAttribute("r","66")}graph.querySelectorAll(`.choice-node[data-level="${state.level}"]`).forEach(node=>node.classList.remove("rejected","chosen"));graph.querySelector(`.branch-level[data-branch-level="${state.level}"]`)?.classList.remove("past-branch");const parent=graph.querySelector(`.past-node[data-level="${state.level}"]`);parent?.classList.replace("past-node","current-node");activeDecision=state.parentDecision;level=state.level;const scale=scaleFor(activeDecision),currentY=660-level*430;animateCamera(state.parentX-215*scale,currentY-660*scale,scale,1900);later(()=>{undo.classList.toggle("visible",history.length>0);hint.textContent="Hover to understand · touch to follow";hint.className="branch-caption visible";locked=false},1850)}

function showDetail(node){if(!node?.dataset.detail)return;hint.textContent=node.dataset.detail;hint.className="branch-caption detail visible"}
function clearDetail(){hint.textContent="Hover to understand · touch to follow";hint.className="branch-caption visible"}

document.getElementById("micButton").addEventListener("click",start);
document.getElementById("sendButton").addEventListener("click",start);
document.getElementById("decisionInput").addEventListener("keydown",event=>{if(event.key==="Enter")start()});
document.getElementById("resetButton").addEventListener("click",reset);
undo.addEventListener("click",undoChoice);
treeSvg.addEventListener("click",event=>{const node=event.target.closest?.(".choice-node[data-choice]");if(node)choose(node)});
treeSvg.addEventListener("keydown",event=>{const node=event.target.closest?.(".choice-node[data-choice]");if(node&&(event.key==="Enter"||event.key===" ")){event.preventDefault();choose(node)}});
treeSvg.addEventListener("pointerover",event=>showDetail(event.target.closest?.(".svg-node[data-detail]")));
treeSvg.addEventListener("pointerout",event=>{if(event.target.closest?.(".svg-node[data-detail]"))clearDetail()});
treeSvg.addEventListener("focusin",event=>showDetail(event.target.closest?.(".svg-node[data-detail]")));
treeSvg.addEventListener("focusout",clearDetail);
reset();
