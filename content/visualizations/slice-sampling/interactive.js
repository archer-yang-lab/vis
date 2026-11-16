import {defaults,LIMIT,SliceChain} from './model.js';
const $=id=>document.getElementById(id);
const fmt=(x,d=3)=>!Number.isFinite(x)?'—':x!==0&&Math.abs(x)<1e-4?x.toExponential(2):(Math.abs(x)<0.5*10**-d?0:x).toFixed(d).replace('-','−');
const fields=['mean','variance','separation','weight','multiplier','initial','seed','burn'];
let config={...defaults},chain=new SliceChain(config),timer=null;
function el(tag,attrs={},text){const node=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const[k,v]of Object.entries(attrs))node.setAttribute(k,v);if(text!==undefined)node.textContent=text;return node;}
function line(svg,x1,y1,x2,y2,color='var(--border)',width=1,dash){svg.append(el('line',{x1,y1,x2,y2,stroke:color,'stroke-width':width,...(dash?{'stroke-dasharray':dash}:{})}));}
function label(svg,x,y,text,anchor='middle'){svg.append(el('text',{x,y,'text-anchor':anchor},text));}
const tick=x=>Math.abs(x)<1e-6?'0':fmt(x,Math.abs(x)<.2?2:1).replace(/\.0$/,'');
function plot(id,xRange,yRange,yLabel,xLabel='x'){
  const svg=$(id),width=svg.clientWidth,height=svg.clientHeight,L=48,R=18,T=25,B=40;
  const x=v=>L+(v-xRange[0])/(xRange[1]-xRange[0])*(width-L-R),y=v=>height-B-(v-yRange[0])/(yRange[1]-yRange[0])*(height-T-B);
  svg.setAttribute('viewBox',`0 0 ${width} ${height}`);svg.replaceChildren();
  const clip=el('clipPath',{id:id+'-clip'});clip.append(el('rect',{x:L,y:T,width:width-L-R,height:height-T-B}));const defs=el('defs');defs.append(clip);svg.append(defs);
  for(let i=0;i<=3;i++){const v=yRange[0]+i*(yRange[1]-yRange[0])/3;line(svg,L,y(v),width-R,y(v));label(svg,L-7,y(v)+4,tick(v),'end');}
  const ticks=xLabel==='Iteration'?[...new Set([xRange[0],Math.round((xRange[0]+xRange[1])/2),xRange[1]])]:Array.from({length:5},(_,i)=>xRange[0]+i*(xRange[1]-xRange[0])/4);
  for(const v of ticks)label(svg,x(v),height-B+18,xLabel==='Iteration'?v:tick(v));
  label(svg,0,13,yLabel,'start');label(svg,width/2,height-3,xLabel);
  const data=el('g',{'clip-path':`url(#${id}-clip)`});svg.append(data);return {svg,data,width,height,x,y,xRange};
}
function points(range){const c=config,s=Math.sqrt(c.variance),centers=c.target==='normal'?[c.mean]:[-c.separation,c.separation];return [...Array.from({length:401},(_,i)=>range[0]+i*(range[1]-range[0])/400),...centers.flatMap(m=>Array.from({length:81},(_,i)=>m+(i-40)*s/10))].filter(x=>x>=range[0]&&x<=range[1]).sort((a,b)=>a-b);}
function curve(p,fn,color,fill=false){const xy=points(p.xRange).map(x=>[p.x(x),p.y(fn(x))]);const path=xy.map(([x,y],i)=>(i?'L':'M')+x.toFixed(2)+','+y.toFixed(2)).join('');if(fill)p.data.append(el('path',{d:path+`L${p.x(p.xRange[1])},${p.y(0)}L${p.x(p.xRange[0])},${p.y(0)}Z`,fill:'color-mix(in srgb,var(--blue) 8%,transparent)',stroke:'none'}));p.data.append(el('path',{d:path,fill:'none',stroke:color,'stroke-width':2}));}
function drawGeometry(){
  const displayed=chain.pending||chain.last,from=displayed?.from??chain.current,range=chain.target.range();
  range[0]=Math.min(range[0],from,...(displayed?.intervals.map(([a])=>a)||[]));range[1]=Math.max(range[1],from,...(displayed?.intervals.map(([,b])=>b)||[]));
  const padding=(range[1]-range[0])*.04;range[0]-=padding;range[1]+=padding;
  const p=plot('geometry',range,[0,chain.target.peak*1.2],'Height v; curve f(x)');curve(p,x=>chain.target.f(x),'var(--blue)',true);
  if($('show-points').checked)for(const[x,v]of chain.pairs.slice(Math.max(config.burn,chain.pairs.length-400)))p.data.append(el('circle',{cx:p.x(x),cy:p.y(v),r:2,fill:'var(--blue)',opacity:.3}));
  line(p.svg,p.x(from),p.y(0),p.x(from),p.y(chain.target.f(from)),'var(--orange)',3);
  p.svg.append(el('circle',{cx:p.x(from),cy:p.y(0),r:5,fill:'var(--blue)',stroke:'var(--canvas)','stroke-width':1.5}));
  if(displayed){
    const v=displayed.height;
    line(p.svg,p.x(range[0]),p.y(v),p.x(range[1]),p.y(v),'var(--orange)',1,'5 5');
    for(const[a,b]of displayed.intervals){line(p.svg,p.x(a),p.y(v),p.x(b),p.y(v),'var(--green)',5);for(const x of [a,b])p.svg.append(el('circle',{cx:p.x(x),cy:p.y(v),r:3,fill:'var(--green)'}));}
    p.svg.append(el('circle',{cx:p.x(from),cy:p.y(v),r:5,fill:'var(--orange)',stroke:'var(--canvas)','stroke-width':1.5}));
    if(!chain.pending){const x=p.x(displayed.next),y=p.y(v);line(p.svg,x,y,x,p.y(0),'var(--purple)',1.5,'3 3');p.svg.append(el('path',{d:`M${x},${y-6}l6,6 -6,6 -6,-6Z`,fill:'var(--purple)',stroke:'var(--canvas)','stroke-width':1.5}));p.svg.append(el('circle',{cx:x,cy:p.y(0),r:4,fill:'var(--purple)'}));}
  }
  $('geometry-note').textContent=displayed?`x = ${fmt(from)}; height v = ${fmt(displayed.height)}.${chain.pending?' Horizontal draw is next.':` New x = ${fmt(displayed.next)}.`}`:`Start at x₀ = ${fmt(from)}. The vertical orange segment contains all possible heights.`;
}
function renderConditionals(){
  const s=chain.pending||chain.last,from=s?.from??chain.current;
  $('from').textContent=fmt(from);$('ceiling').textContent=fmt(chain.target.f(from));$('height').textContent=s?fmt(s.height):'—';
  $('vertical-step').classList.toggle('active',!chain.last||!!chain.pending);$('horizontal-step').classList.toggle('active',!!s);
  const tbody=$('intervals');tbody.replaceChildren();
  if(s){
    const total=s.intervals.reduce((sum,[a,b])=>sum+b-a,0);
    s.intervals.forEach(([a,b],i)=>{const tr=document.createElement('tr');if(!chain.pending&&i===s.index)tr.className='selected';for(const text of [`[${fmt(a,2)}, ${fmt(b,2)}]`,fmt(b-a,2),fmt(100*(b-a)/total,1)+'%']){const td=document.createElement('td');td.textContent=text;tr.append(td);}tbody.append(tr);});
    $('length-note').textContent=`Total length: ${fmt(total)}. Probability = interval length / total length.`;
  }else{const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=3;td.textContent='Draw a height to find the slice.';tr.append(td);tbody.append(tr);$('length-note').textContent='';}
  $('new-state').textContent=s&&!chain.pending?`New position: ${fmt(s.next)}`:'New position: —';
  $('advance').textContent=chain.pending?'2. Sample position':'1. Draw height';
}
function drawSamples(){
  const values=chain.retained(),range=chain.target.range(),bins=36,width=(range[1]-range[0])/bins,counts=Array(bins).fill(0);let outside=0;
  for(const x of values){const i=Math.floor((x-range[0])/width);if(i>=0&&i<bins)counts[i]++;else outside++;}
  const density=counts.map(n=>values.length?n/(values.length*width):0),peak=chain.target.peak/(config.multiplier*Math.sqrt(2*Math.PI*config.variance));
  const p=plot('histogram',range,[0,Math.max(peak,...density)*1.15],'Density');
  density.forEach((v,i)=>p.data.append(el('rect',{x:p.x(range[0]+i*width),y:p.y(v),width:Math.max(0,p.x(range[0]+width)-p.x(range[0])-1),height:p.y(0)-p.y(v),fill:'color-mix(in srgb,var(--blue) 22%,var(--canvas))',stroke:'var(--blue)','stroke-width':.6})));curve(p,x=>chain.target.density(x),'var(--blue)');
  $('histogram-note').textContent=values.length?`${values.length.toLocaleString()} retained positions; ${outside} outside the displayed range. Bin heights use the full retained count.`:chain.iteration<config.burn?`Warm-up: ${config.burn-chain.iteration} more iterations before retaining positions.`:'Complete both steps to add a sample.';
  const start=Math.max(0,chain.values.length-300),recent=chain.values.slice(start),lo=Math.min(...recent),hi=Math.max(...recent),pad=Math.max(.5,(hi-lo)*.12);
  const t=plot('trace',[start,Math.max(start+1,chain.iteration)],[lo-pad,hi+pad],'State x','Iteration');
  if(config.burn>start){const end=Math.min(config.burn,chain.iteration);t.data.append(el('rect',{x:t.x(start),y:t.y(hi+pad),width:t.x(end)-t.x(start),height:t.y(lo-pad)-t.y(hi+pad),fill:'color-mix(in srgb,var(--muted) 12%,transparent)'}));}
  t.data.append(el('path',{d:recent.map((x,i)=>(i?'L':'M')+t.x(start+i).toFixed(2)+','+t.y(x).toFixed(2)).join(''),fill:'none',stroke:'var(--blue)','stroke-width':1.6}));t.data.append(el('circle',{cx:t.x(chain.iteration),cy:t.y(chain.current),r:3,fill:'var(--blue)'}));
  $('trace-note').textContent=`Iterations ${start}–${chain.iteration}.${config.burn?' Shaded iterations are discarded as warm-up.':''}`;
  $('completed').textContent=chain.iteration.toLocaleString();$('retained').textContent=values.length.toLocaleString();$('sample-mean').textContent=values.length?fmt(values.reduce((s,x)=>s+x,0)/values.length):'—';$('target-mean').textContent=fmt(chain.target.mean);
}
function formulas(){
  $('target-formula').textContent=config.target==='normal'?`p = N(${fmt(config.mean,1)}, ${fmt(config.variance,2)}); f(x) = c exp(−(x − μ)² / (2τ²)).`:`p = ${fmt(config.weight,2)} N(−${fmt(config.separation,1)}, ${fmt(config.variance,2)}) + ${fmt(1-config.weight,2)} N(${fmt(config.separation,1)}, ${fmt(config.variance,2)}). The second parameters are variances.`;
}
function pause(){if(timer!==null)clearInterval(timer);timer=null;$('run').textContent='Run';$('run').setAttribute('aria-pressed','false');}
function render(){formulas();renderConditionals();drawGeometry();drawSamples();$('iteration').textContent=`Iteration ${chain.iteration.toLocaleString()}`;for(const id of ['advance','run','batch'])$(id).disabled=chain.iteration>=LIMIT;if(chain.iteration>=LIMIT){pause();$('status').textContent='Reached 30,000 iterations. Reset the chain to start again.';}}
function configure(){
  pause();try{const next={...config,target:$('target').value};for(const key of fields){const node=$(key),value=node.valueAsNumber;if(!Number.isFinite(value)||value<Number(node.min)||value>Number(node.max)||(key==='seed'||key==='burn')&&!Number.isInteger(value))throw new Error(`Enter ${node.closest('label').childNodes[0].textContent.trim()} between ${node.min} and ${node.max}${key==='seed'||key==='burn'?' as a whole number':''}.`);next[key]=value;}config=next;chain=new SliceChain(config);$('status').textContent='New chain. Draw a height, then sample the horizontal position.';render();}catch(error){$('status').textContent=error.message;for(const id of ['advance','run','batch'])$(id).disabled=true;}
}
function visibility(){const normal=$('target').value==='normal';$('mean-field').hidden=!normal;for(const id of ['separation-field','weight-field'])$(id).hidden=normal;}
$('settings').addEventListener('submit',event=>event.preventDefault());
$('settings').addEventListener('input',event=>{if(event.target.type==='number')configure();});
$('settings').addEventListener('change',event=>{if(event.target.id==='target')$('initial').value=event.target.value==='normal'?$('mean').value:-Number($('separation').value);visibility();configure();});
$('show-points').addEventListener('change',drawGeometry);
$('advance').addEventListener('click',()=>{pause();chain.advance();$('status').textContent=chain.pending?'Height drawn. The green intervals form the full slice.':'Position sampled. One iteration is complete.';render();});
$('batch').addEventListener('click',()=>{pause();chain.run(1000);$('status').textContent='Added up to 1,000 complete iterations. The display shows the last pair of draws.';render();});
$('reset').addEventListener('click',configure);
$('run').addEventListener('click',()=>{if(timer!==null){pause();$('status').textContent='Paused. Continue with the next conditional draw.';}else{$('run').textContent='Pause';$('run').setAttribute('aria-pressed','true');$('status').textContent='Alternating height and position draws. Pause to inspect a slice.';timer=setInterval(()=>{chain.advance();render();},700);}});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&timer!==null){pause();$('status').textContent='Paused while the page was hidden.';}});window.addEventListener('pagehide',pause);
new ResizeObserver(()=>{drawGeometry();drawSamples();}).observe($('slice-demo'));
visibility();render();
