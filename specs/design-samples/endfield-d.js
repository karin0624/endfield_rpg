'use strict';
const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const state={tab:'battle',light:'day',mode:'idle',command:'attack',target:'A',party:2,motion:true};
const params=new URLSearchParams(location.search);
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let angle=.10, frame=null,lastTime=0;
function fit(){const width=$('.viewport').clientWidth;const scale=Math.min(width/1308,1);$('.battle').style.transform=`scale(${scale})`;$('.scene-sizer').style.height=`${728*scale}px`;}
function announce(text){$('#live-status').textContent=text;}
function setTab(tab,focus=false){if(!['battle','theme'].includes(tab))return;state.tab=tab;$$('[data-tab]').forEach(b=>{const on=b.dataset.tab===tab;b.setAttribute('aria-selected',on);b.tabIndex=on?0:-1;if(on&&focus)b.focus();});$('#panel-battle').hidden=tab!=='battle';$('#panel-theme').hidden=tab!=='theme';if(tab==='battle')fit();renderTetras();}
function setLight(light){state.light=light;$('.battle').classList.toggle('dark',light==='dark');$('.battle').classList.toggle('gray',light==='gray');$$('[data-light]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.light===light));}
function setMode(mode){if(!['idle','skill','toast','guard'].includes(mode))return;state.mode=mode;$('#skill-panel').hidden=!['skill','guard'].includes(mode);$('#toast-panel').hidden=mode!=='toast';$$('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.mode===mode));if(mode==='skill'){$('#context-type').textContent='スキル';$('#skill-title').textContent='踏み込み斬り';$('#skill-desc').textContent='敵単体に斬撃を与える。対象を選んでください。';$('.context-target').hidden=false;setCommand('skill',false);announce('スキル：踏み込み斬り。敵単体に斬撃を与える。対象を選んでください。');}else if(mode==='guard'){$('#context-type').textContent='防御';$('#skill-title').textContent='防御';$('#skill-desc').textContent='防御コマンドの説明をここに表示します。';$('.context-target').hidden=true;announce('防御コマンドの説明');}else if(mode==='toast'){setCommand('attack',false);announce('味方01の通常攻撃！ 対象：スライム '+state.target);}syncTargetSelection();renderTetras();}
function setCommand(command,update=true){if(!['attack','skill','guard'].includes(command))return;state.command=command;$$('.command-list [data-command]').forEach(b=>{let on=b.dataset.command===command;b.classList.toggle('selected',on);b.setAttribute('aria-pressed',on);});if(update)setMode(command==='skill'?'skill':command==='guard'?'guard':'idle');syncTargetSelection();renderTetras();}
function syncTargetSelection(){const selecting=['attack','skill'].includes(state.command)&&state.mode!=='toast';$('.target-indicator').hidden=!selecting;$$('.enemy-hitbox').forEach(b=>b.disabled=!selecting);}
function setTarget(target){if(!['A','B'].includes(target))return;state.target=target;$$('[data-target]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.target===target));$('.target-indicator').classList.toggle('target-b',target==='B');$('.target-name').textContent='対象 '+target;$$('.target-copy').forEach(e=>e.textContent='スライム '+target);announce('スライム '+target+'を選択');}
function setParty(count){state.party=Number(count)===4?4:2;$('.party').classList.toggle('expanded',state.party===4);$$('[data-party]').forEach(b=>b.setAttribute('aria-pressed',Number(b.dataset.party)===state.party));}
function setMotion(value){state.motion=!!value&&!reduced.matches;$$('.motion-toggle').forEach(b=>{b.setAttribute('aria-pressed',state.motion);$('span',b).textContent=reduced.matches?'回転：OS設定で停止':`回転：${state.motion?'オン':'オフ'}`;$('use',b).setAttribute('href',state.motion?'#i-pause':'#i-play');});if(frame)cancelAnimationFrame(frame);frame=null;lastTime=0;if(state.motion){frame=requestAnimationFrame(tick);}else{angle=.10;renderTetras();}}
// A true tetrahedron, with three base vertices and one tip. Rotate about its
// longitudinal axis, then project to SVG. Sorting by depth gives opaque faces.
const baseVertices=[[0,-.59,1],[.8660254,-.59,-.5],[-.8660254,-.59,-.5],[0,1.13,0]];
const faces=[[0,1,2],[0,3,1],[1,3,2],[2,3,0]];
const faceColors=['var(--face-top)','var(--face-dark)','var(--face-mid)','var(--face-light)'];
function meshHTML(a){
 const c=Math.cos(a),s=Math.sin(a),tilt=-.18,ct=Math.cos(tilt),st=Math.sin(tilt);
 const verts=baseVertices.map(([x,y,z])=>{let xx=x*c+z*s,zz=-x*s+z*c;return [xx,y*ct-zz*st,y*st+zz*ct];});
 const projected=verts.map(([x,y,z])=>[32+x*22,29+y*24,z]);
 const coords=ix=>ix.map(i=>`${projected[i][0].toFixed(3)},${projected[i][1].toFixed(3)}`).join(' ');
 const ordered=faces.map((ids,idx)=>({ids,idx,z:ids.reduce((n,i)=>n+verts[i][2],0)/3})).sort((a,b)=>a.z-b.z);
 let out=ordered.map(f=>`<polygon points="${coords(f.ids)}" fill="var(--marker-body)" stroke="var(--marker-body)" stroke-width="7" stroke-linejoin="round"/>`).join('');
 out+=ordered.map(f=>{
  let points=f.ids.map(i=>projected[i]);
  let engraving='';
  if(f.idx!==0){
   const tip=projected[3],rim=f.ids.filter(i=>i!==3).map(i=>projected[i]);
   for(const t of [.35,.58]){
    const a=rim[0].map((v,i)=>v*(1-t)+tip[i]*t),b=rim[1].map((v,i)=>v*(1-t)+tip[i]*t);
    const mx=(a[0]+b[0])/2,my=(a[1]+b[1])/2;
    engraving+=`<path class="engraving" d="M${a[0]},${a[1]} Q${mx},${my+2.2} ${b[0]},${b[1]}" fill="none" stroke="var(--text-secondary)" stroke-width=".85" opacity=".40"/>`;
   }
  }
  return `<polygon points="${coords(f.ids)}" fill="${faceColors[f.idx]}" stroke="var(--marker-edge)" stroke-width="1.8" stroke-linejoin="round"/>${engraving}`;
 }).join('');return out;
}
function renderTetras(){const svg=meshHTML(angle);$$('.tetra-mesh').forEach(g=>{if(g.closest('[hidden]'))return;if(g.dataset.static==='true'){if(!g.childElementCount)g.innerHTML=meshHTML(.10);return;}g.innerHTML=svg;});}
function tick(t){if(!state.motion)return;if(lastTime)angle+=(Math.min(t-lastTime,64)/1000)*(Math.PI*2/6);lastTime=t;renderTetras();frame=requestAnimationFrame(tick);}
reduced.addEventListener('change',()=>setMotion(state.motion));
function luminance(h){const n=h.replace('#','');const c=[0,2,4].map(i=>parseInt(n.slice(i,i+2),16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2];}
function contrast(a,b){const [lo,hi]=[luminance(a),luminance(b)].sort((a,b)=>a-b);return (hi+.05)/(lo+.05);}
const pairs=[['主文字 / 基調面','#ECE9DF','#232825',4.5],['補助文字 / 選択面','#B8C1B9','#3C463E',4.5],['主文字 / 選択面','#ECE9DF','#3C463E',4.5],['主ボタン / 文字','#232825','#F0B84A',4.5],['HPバー / トラック','#91B9A8','#313B34',3],['選択罫 / 選択面','#B58A46','#3C463E',3],['マーカー稜線 / 暗い外縁','#F0B84A','#171D19',3]];
$$('[data-ratio]').forEach(e=>{const [fg,bg]=e.dataset.ratio.split(',');e.textContent=contrast(fg,bg).toFixed(2)+':1';});
$('#ratio-table').innerHTML=pairs.map(([name,fg,bg,threshold])=>`<tr><td>${name}</td><td>${fg} / ${bg}</td><td>${contrast(fg,bg).toFixed(2)}:1</td></tr>`).join('');
$$('[data-tab]').forEach(b=>b.addEventListener('click',()=>setTab(b.dataset.tab)));$('.tabs').addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();setTab(e.key==='Home'?'battle':e.key==='End'?'theme':state.tab==='battle'?'theme':'battle',true);}});
$$('[data-light]').forEach(b=>b.addEventListener('click',()=>setLight(b.dataset.light)));
$$('[data-mode]').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode)));
$$('[data-party]').forEach(b=>b.addEventListener('click',()=>setParty(b.dataset.party)));
$$('[data-command]').forEach(b=>b.addEventListener('click',()=>setCommand(b.dataset.command)));
$$('[data-target]').forEach(b=>b.addEventListener('click',()=>setTarget(b.dataset.target)));
$$('.close-context').forEach(b=>b.addEventListener('click',()=>{setMode('idle');$(`.command-list [data-command="${state.command}"]`).focus();}));
$('.command-list').addEventListener('keydown',e=>{if(!['ArrowUp','ArrowDown','Home','End'].includes(e.key))return;const available=$$('.command-list button:not(:disabled)');let ix=available.indexOf(document.activeElement);if(ix<0)return;e.preventDefault();ix=e.key==='Home'?0:e.key==='End'?available.length-1:(ix+(e.key==='ArrowDown'?1:-1)+available.length)%available.length;available[ix].focus();});
$$('.enemy-hitbox').forEach(b=>b.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();setTarget(state.target==='A'?'B':'A');$(`[data-target="${state.target}"]`).focus();}}));
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&state.mode!=='idle'){setMode('idle');$(`.command-list [data-command="${state.command}"]`).focus();}});
$$('.motion-toggle').forEach(b=>b.addEventListener('click',()=>setMotion(!state.motion)));$('#cta-demo').addEventListener('click',()=>{setTab('battle');setMode('idle');window.scrollTo({top:0,behavior:reduced.matches?'instant':'smooth'});});
$$('.size-24').forEach(e=>{e.style.width='24px';e.style.height='24px';});$$('.size-32').forEach(e=>{e.style.width='32px';e.style.height='32px';});$$('.size-48').forEach(e=>{e.style.width='48px';e.style.height='48px';});
new ResizeObserver(fit).observe($('.viewport'));
window.addEventListener('resize',fit);document.addEventListener('visibilitychange',()=>{if(document.hidden){if(frame)cancelAnimationFrame(frame);frame=null;lastTime=0;}else if(state.motion&&!frame)frame=requestAnimationFrame(tick);});
setTab(params.get('tab')==='theme'?'theme':'battle');setLight(['dark','gray'].includes(params.get('light'))?params.get('light'):'day');setMode(['skill','toast'].includes(params.get('mode'))?params.get('mode'):'idle');setParty(params.get('party')||2);setMotion(params.get('motion')!=='off');fit();
// Stable handles for screenshot and interaction checks. This is not a game API.
window.uiReview={state,setMode,setLight,setCommand,setTarget,setParty,setTab,setMotion,contrast,pairs,fit,renderTetras};
