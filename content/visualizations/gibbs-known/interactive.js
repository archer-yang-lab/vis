import {knownDefaults,KNOWN_LIMIT,KnownChain,responsibility,normalPDF,mixturePDF,mixtureRange} from '../../assets/gibbs-model.js';
import {$,fmt,colors,plot,curve,path,line,svgEl,gridMaximum,histogram,drawBars,number} from '../../assets/gibbs-ui.js';
let config={...knownDefaults},chain=new KnownChain(config),timer=null;let valid=true;
const keys=Object.keys(knownDefaults);
function draw(){
  const t=chain.theta,s=chain.pending||chain.last,from=s?.from??chain.current,range=mixtureRange(t);range[0]=Math.min(range[0],from-1,chain.current-1);range[1]=Math.max(range[1],from+1,chain.current+1);
  const density=x=>mixturePDF(x,t),conditional=x=>s?normalPDF(x,t.means[s.z],t.variances[s.z]):0;
  const p=plot('density',range,[0,1.15*Math.max(gridMaximum(density,range,t.means),gridMaximum(conditional,range,t.means))],'Density');curve(p,density,'var(--text)',2.3,undefined,t.means);
  if(s)curve(p,conditional,colors[s.z],2,'6 4',t.means);
  line(p.svg,p.x(from),p.y(0),p.x(from),p.y(density(from)),'var(--muted)',1.5,'3 3');p.svg.append(svgEl('circle',{cx:p.x(from),cy:p.y(density(from)),r:4,fill:'var(--muted)'}));
  if(chain.last&&!chain.pending){const x=p.x(s.x),y=p.y(density(s.x));p.svg.append(svgEl('path',{d:`M${x},${y-6}l6,6 -6,6 -6,-6Z`,fill:'var(--purple)',stroke:'var(--canvas)','stroke-width':1.3}));}
  $('conditional-legend').style.color=s?colors[s.z]:'var(--muted)';
  $('density-note').textContent=s?`Condition on x = ${fmt(from)}. Selected component: ${s.z+1}.${chain.pending?' Draw x next.':` New x = ${fmt(s.x)}.`}`:`Start at x₀ = ${fmt(from)}. The mixture density remains fixed.`;
  const r=s?.r??responsibility(from,t);$('r1').textContent=fmt(100*r,1)+'%';$('r2').textContent=fmt(100*(1-r),1)+'%';$('r1-bar').style.width=100*r+'%';$('r2-bar').style.width=100*(1-r)+'%';$('conditioning-x').textContent=`Conditioning value: x = ${fmt(from)}`;
  $('selected-label').textContent=s?`Sampled z = ${s.z+1} (uniform draw ${fmt(s.u)})`:'Label not drawn';$('selected-normal').textContent=s?`Selected conditional: N(${fmt(t.means[s.z])}, ${fmt(t.variances[s.z])})`:'First choose the label.';$('new-x').textContent=chain.last&&!chain.pending?`New x: ${fmt(s.x)}`:'New x: —';
  $('label-step').classList.toggle('active',!s||!!chain.pending);$('position-step').classList.toggle('active',!!s);
  const kept=chain.retained(),h=histogram(kept,mixtureRange(t)),hp=plot('histogram',h.range,[0,1.15*Math.max(...h.density,gridMaximum(density,h.range,t.means))],'Density');drawBars(hp,h);curve(hp,density,'var(--text)',2,undefined,t.means);
  $('histogram-note').textContent=kept.length?`${kept.length.toLocaleString()} retained states; ${h.outside} outside this fixed range. Bins use the full retained count.`:chain.iteration<config.burn?`Warm-up: ${config.burn-chain.iteration} more iterations before retaining samples.`:'Complete both conditional draws to add a sample.';
  const start=Math.max(0,chain.values.length-300),recent=chain.values.slice(start),lo=Math.min(...recent),hi=Math.max(...recent),pad=Math.max(.5,(hi-lo)*.12),tr=plot('trace',[start,Math.max(start+1,chain.iteration)],[lo-pad,hi+pad],'State x','Iteration');
  path(tr,recent.map((x,i)=>[start+i,x]),'var(--muted)',1.2);recent.forEach((x,i)=>tr.data.append(svgEl('circle',{cx:tr.x(start+i),cy:tr.y(x),r:2.2,fill:colors[chain.labels[start+i]]||'var(--muted)'})));
  $('trace-note').textContent=`Iterations ${start}–${chain.iteration}. Long runs in one color indicate slow component switching.`;
  $('retained').textContent=kept.length.toLocaleString();$('sample-mean').textContent=kept.length?fmt(kept.reduce((a,b)=>a+b,0)/kept.length):'—';$('target-mean').textContent=fmt(t.weight*t.means[0]+(1-t.weight)*t.means[1]);$('component-share').textContent=kept.length?fmt(100*chain.labels.slice(config.burn+1).filter(z=>z===0).length/kept.length,1)+'%':'—';
  $('iteration').textContent=`Iteration ${chain.iteration.toLocaleString()}`;$('advance').textContent=chain.pending?'2. Sample observation x':'1. Sample label z';for(const id of ['advance','run','batch'])$(id).disabled=!valid||chain.iteration>=KNOWN_LIMIT;
  if(chain.iteration>=KNOWN_LIMIT){pause();$('status').textContent='Reached 20,000 iterations. Reset the chain to begin again.';}
}
function pause(){if(timer!==null)clearInterval(timer);timer=null;$('run').textContent='Run';$('run').setAttribute('aria-pressed','false');}
function configure(){pause();try{const next={};for(const key of keys)next[key]=number(key,key==='seed'||key==='burn');valid=true;config=next;chain=new KnownChain(config);$('status').textContent='New chain. The parameters remain fixed for all its draws.';draw();}catch(e){valid=false;$('status').textContent=e.message;for(const id of ['advance','run','batch'])$(id).disabled=true;}}
$('settings').addEventListener('submit',e=>e.preventDefault());$('settings').addEventListener('input',e=>{if(e.target.type==='number'){$('preset').value='custom';configure();}});
$('preset').addEventListener('change',e=>{const m={moderate:2,overlap:.8,separated:4}[e.target.value];if(m!==undefined){$('mu1').value=-m;$('mu2').value=m;$('initial').value=-m;$('v1').value=1;$('v2').value=1;$('weight').value=.45;configure();}});
$('advance').addEventListener('click',()=>{pause();chain.advance();$('status').textContent=chain.pending?'Label sampled. Next, draw x from the selected Gaussian.':'Observation sampled. One Gibbs iteration is complete.';draw();});
$('batch').addEventListener('click',()=>{pause();chain.run(1000);$('status').textContent='Added up to 1,000 complete iterations. The panel shows the last update.';draw();});$('reset').addEventListener('click',configure);
$('run').addEventListener('click',()=>{if(timer!==null){pause();$('status').textContent='Paused.';}else{$('run').textContent='Pause';$('run').setAttribute('aria-pressed','true');$('status').textContent='Alternating label and observation draws.';timer=setInterval(()=>{chain.advance();draw();},650);}});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&timer!==null){pause();$('status').textContent='Paused while the page was hidden.';}});window.addEventListener('pagehide',pause);new ResizeObserver(draw).observe($('known-demo'));draw();
