import {defaults,LIMIT,Chain,targetLog,targetRange,proposalLog} from './model.js';
const $=id=>document.getElementById(id);
const format=(x,d=3)=>Number.isFinite(x)?(Math.abs(x)<0.5*10**-d?0:x).toFixed(d).replace('-','−'):'—';
const fields={mean:'mean',targetVariance:'target-variance',separation:'separation',componentVariance:'component-variance',weight:'weight',shape:'shape',scale:'scale',variance:'variance',proposalMean:'proposal-mean',initial:'initial',burn:'burn',seed:'seed'};
let config={...defaults},chain=new Chain(config),timer=null;
function element(tag,attrs={},text){const el=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const[k,v]of Object.entries(attrs))el.setAttribute(k,v);if(text!==undefined)el.textContent=text;return el;}
function line(svg,x1,y1,x2,y2,color='var(--border)',dash){svg.append(element('line',{x1,y1,x2,y2,stroke:color,'stroke-width':1,...(dash?{'stroke-dasharray':dash}:{})}));}
function label(svg,x,y,text,anchor='middle'){svg.append(element('text',{x,y,'text-anchor':anchor},text));}
const tick=v=>Math.abs(v)<0.00001?'0':Math.abs(v)>=100?format(v,0):format(v,1).replace(/\.0$/,'');
function plot(id,range,ymax,ylab='Density',xlab='x') {
  const svg=$(id),width=svg.clientWidth,height=svg.clientHeight,left=48,right=14,top=24,bottom=40;
  svg.setAttribute('viewBox',`0 0 ${width} ${height}`);svg.replaceChildren();
  const x=v=>left+(v-range[0])/(range[1]-range[0])*(width-left-right), y=v=>height-bottom-v/ymax*(height-top-bottom);
  const clip=element('clipPath',{id:id+'-clip'});clip.append(element('rect',{x:left,y:top,width:width-left-right,height:height-top-bottom}));
  const defs=element('defs');defs.append(clip);svg.append(defs);
  for(let i=0;i<=3;i++){const value=ymax*i/3;line(svg,left,y(value),width-right,y(value));label(svg,left-7,y(value)+4,tick(value),'end');}
  for(let i=0;i<=4;i++){const value=range[0]+(range[1]-range[0])*i/4;label(svg,x(value),height-bottom+18,xlab==='Iteration'?String(Math.round(value)):tick(value));}
  label(svg,0,13,ylab,'start');label(svg,width/2,height-3,xlab);
  const data=element('g',{'clip-path':`url(#${id}-clip)`});svg.append(data);return {svg,data,width,height,x,y,range,top,bottom};
}
function curve(p,fn,color,dash,knots=[]) {
  const points=[...Array.from({length:401},(_,i)=>p.range[0]+(p.range[1]-p.range[0])*i/400),...knots.filter(x=>x>=p.range[0]&&x<=p.range[1])].sort((a,b)=>a-b);
  let path='';points.forEach((t,i)=>{const v=fn(t);path+=(i?'L':'M')+p.x(t).toFixed(2)+','+p.y(v).toFixed(2);});
  p.data.append(element('path',{d:path,fill:'none',stroke:color,'stroke-width':2,...(dash?{'stroke-dasharray':dash}:{})}));
}
function maximum(fn,range){let m=0;for(let i=0;i<=400;i++)m=Math.max(m,fn(range[0]+i*(range[1]-range[0])/400));return Math.max(m,0.001);}
function drawDensity() {
  const x=chain.last?.x??chain.current,y=chain.last?.y;
  const center=config.proposal==='independent'?config.proposalMean:x,sd=Math.sqrt(config.variance),base=targetRange(config);
  const range=[Math.min(base[0],center-3.5*sd,x,y??x),Math.max(base[1],center+3.5*sd,x,y??x)];
  const pad=(range[1]-range[0])*.03;range[0]-=pad;range[1]+=pad;
  const target=z=>Math.exp(targetLog(z,config)),proposal=z=>Math.exp(proposalLog(z,x,config));
  const targetCenters=config.target==='normal'?[config.mean]:config.target==='mixture'?[-config.separation,config.separation]:[Math.max(1e-9,(config.shape-1)*config.scale)];
  const targetSD=config.target==='normal'?Math.sqrt(config.targetVariance):config.target==='mixture'?Math.sqrt(config.componentVariance):Math.sqrt(config.shape)*config.scale;
  const knots=(center,spread)=>Array.from({length:81},(_,i)=>center+(i-40)*spread/10);
  const p=plot('density',range,1.15*Math.max(maximum(target,range),...targetCenters.map(target),proposal(center)));
  curve(p,target,'var(--blue)',undefined,targetCenters.flatMap(c=>knots(c,targetSD)));
  if(config.proposal==='uniform'){
    const a=x-Math.sqrt(3*config.variance),b=x+Math.sqrt(3*config.variance),h=1/(b-a);
    p.data.append(element('path',{d:`M${p.x(a)},${p.y(0)}V${p.y(h)}H${p.x(b)}V${p.y(0)}`,fill:'none',stroke:'var(--orange)','stroke-width':2,'stroke-dasharray':'6 4'}));
  }else curve(p,proposal,'var(--orange)','6 4',knots(center,sd));
  for(const [value,color,diamond]of [[x,'var(--blue)',false],...(y===undefined?[]:[[y,'var(--orange)',true]])]){
    const px=p.x(value),py=p.y(target(value));line(p.svg,px,p.y(0),px,py,color,'3 3');
    p.svg.append(diamond?element('path',{d:`M${px},${py-6}l6,6 -6,6 -6,-6Z`,fill:'var(--canvas)',stroke:color,'stroke-width':2}):element('circle',{cx:px,cy:py,r:5,fill:color,stroke:'var(--canvas)','stroke-width':1.5}));
  }
  $('density-note').textContent=chain.last?`Before decision: x = ${format(x)}; proposed y = ${format(y)}. Next state: ${format(chain.current)}.`:`Starting state x₀ = ${format(x)}. Both curves use the same density scale.`;
}
function ratio(logValue){if(logValue===-Infinity)return '0';if(Math.abs(logValue)>13)return `exp(${format(logValue,1)})`;const v=Math.exp(logValue);return v<.001||v>1000?v.toExponential(2):format(v);}
function drawDecision(){
  const last=chain.last,svg=$('acceptance-meter'),width=svg.clientWidth,px=v=>14+v*(width-28);
  svg.setAttribute('viewBox',`0 0 ${width} 66`);svg.replaceChildren();
  $('target-ratio').textContent=last?ratio(last.logTargetRatio):'—';$('proposal-ratio').textContent=last?ratio(last.logProposalRatio):'—';
  $('alpha').textContent=last?format(last.alpha,4):'—';$('uniform-draw').textContent=last?format(last.u,4):'—';
  svg.append(element('rect',{x:14,y:24,width:width-28,height:12,rx:3,fill:'var(--border)'}));
  label(svg,14,13,'Accept region: u < α','start');label(svg,px(0),59,'0');label(svg,px(1),59,'1');
  if(last){svg.append(element('rect',{x:14,y:24,width:(width-28)*last.alpha,height:12,rx:3,fill:'var(--blue)'}));const x=px(last.u);svg.append(element('path',{d:`M${x},20l6,10 -6,10 -6,-10Z`,fill:'var(--orange)',stroke:'var(--canvas)','stroke-width':1.5}));}
  $('decision-result').className='decision-result'+(last?(last.accepted?' accepted':' rejected'):'');
  $('decision-result').textContent=last?`${last.accepted?'Accepted':'Rejected'} · x${chain.iteration} = ${format(last.next)}`:'No proposal yet';
  $('decision-detail').textContent=last?(last.accepted?'u < α: move to y. The orange diamond marks u.':last.logTargetRatio===-Infinity?'The proposal lies outside the target support, so α = 0. Record x again.':'u ≥ α: stay at x and record it again. The orange diamond marks u.'):'Draw u uniformly from (0, 1). Accept if u < α; otherwise stay at x.';
}
function drawSamples(){
  const kept=chain.retained(),range=targetRange(config),bins=36,binWidth=(range[1]-range[0])/bins,counts=Array(bins).fill(0);let outside=0;
  for(const v of kept){const i=Math.floor((v-range[0])/binWidth);if(i>=0&&i<bins)counts[i]++;else outside++;}
  const density=counts.map(n=>kept.length?n/(kept.length*binWidth):0),target=x=>Math.exp(targetLog(x,config));
  const p=plot('histogram',range,1.15*Math.max(...density,maximum(target,range)));
  density.forEach((v,i)=>p.data.append(element('rect',{x:p.x(range[0]+i*binWidth),y:p.y(v),width:Math.max(0,p.x(range[0]+binWidth)-p.x(range[0])-1),height:p.y(0)-p.y(v),fill:'color-mix(in srgb, var(--blue) 22%, var(--canvas))',stroke:'var(--blue)','stroke-width':.6})));
  curve(p,target,'var(--blue)');
  $('histogram-note').textContent=kept.length?`${kept.length.toLocaleString()} states after discarding ${config.burn} iterations. ${outside} outside the displayed range; bins use the full retained count.`:config.burn>chain.iteration?`Warm-up: ${config.burn-chain.iteration} more iterations before retaining states.`:'Take steps to build the histogram. Repeated states count.';
  const start=Math.max(0,chain.values.length-300),values=chain.values.slice(start),min=Math.min(...values),max=Math.max(...values),padding=Math.max((max-min)*.12,.5);
  const trace=$('trace'),w=trace.clientWidth,h=trace.clientHeight,L=48,R=14,T=24,B=40,x=i=>L+(i-start)/Math.max(1,chain.iteration-start)*(w-L-R),y=v=>h-B-(v-(min-padding))/(max-min+2*padding)*(h-T-B);
  trace.setAttribute('viewBox',`0 0 ${w} ${h}`);trace.replaceChildren();
  for(let i=0;i<=3;i++){const v=min-padding+i*(max-min+2*padding)/3;line(trace,L,y(v),w-R,y(v));label(trace,L-7,y(v)+4,tick(v),'end');}
  for(const i of [...new Set([start,Math.round((start+chain.iteration)/2),Math.max(chain.iteration,start+1)])])label(trace,x(i),h-B+18,String(i));
  label(trace,0,13,'State x','start');label(trace,w/2,h-3,'Iteration');
  if(config.burn>=start){const end=Math.min(config.burn,chain.iteration);trace.append(element('rect',{x:L,y:T,width:Math.max(0,x(end)-L),height:h-T-B,fill:'color-mix(in srgb,var(--muted) 12%,transparent)'}));}
  trace.append(element('path',{d:values.map((v,i)=>(i?'L':'M')+x(start+i).toFixed(2)+','+y(v).toFixed(2)).join(''),fill:'none',stroke:'var(--blue)','stroke-width':1.6}));
  trace.append(element('circle',{cx:x(chain.iteration),cy:y(chain.current),r:3,fill:'var(--blue)'}));
  $('trace-note').textContent=`Iterations ${start}–${chain.iteration}. ${config.burn?'Shaded iterations are discarded as warm-up.':'No warm-up discarded.'}`;
  $('retained').textContent=kept.length.toLocaleString();$('sample-mean').textContent=kept.length?format(kept.reduce((a,b)=>a+b,0)/kept.length):'—';
  const mean=config.target==='normal'?config.mean:config.target==='gamma'?config.shape*config.scale:config.separation*(1-2*config.weight);
  $('target-mean').textContent=format(mean);$('acceptance-rate').textContent=chain.iteration?`${chain.accepted.toLocaleString()} / ${chain.iteration.toLocaleString()} (${format(100*chain.accepted/chain.iteration,1)}%)`:'—';
}
function formulas(){
  $('target-formula').textContent=config.target==='normal'?`π = N(${format(config.mean,1)}, ${format(config.targetVariance,2)}). The second parameter is variance.`:config.target==='gamma'?`π = Gamma(shape ${format(config.shape,1)}, scale ${format(config.scale,1)}), supported on x > 0.`:`π = ${format(config.weight,2)} N(−${format(config.separation,1)}, ${format(config.componentVariance,2)}) + ${format(1-config.weight,2)} N(${format(config.separation,1)}, ${format(config.componentVariance,2)}). Second parameters are variances.`;
  const sd=Math.sqrt(config.variance);
  $('proposal-formula').textContent=config.proposal==='uniform'?`y | x ∼ Uniform(x − h, x + h), h = √(3v) = ${format(Math.sqrt(3*config.variance))}. Variance = v.`:config.proposal==='independent'?`y ∼ N(m₀, v), m₀ = ${format(config.proposalMean,1)}. Standard deviation √v = ${format(sd)}.`:`y | x ∼ N(x, v). Standard deviation √v = ${format(sd)}.`;
  $('proposal-note').textContent=config.proposal==='independent'?'The proposal ignores x. Its reverse/forward density ratio generally differs from 1.':'This random-walk proposal is symmetric: q(x | y) = q(y | x), so the Hastings correction is 1.';
}
function render(){$('variance-slider').setAttribute('aria-valuetext',`Variance ${config.variance}`);formulas();drawDensity();drawDecision();drawSamples();$('iteration').textContent=`Iteration ${chain.iteration.toLocaleString()}`;for(const id of ['step','run','batch'])$(id).disabled=chain.iteration>=LIMIT;if(chain.iteration>=LIMIT){pause();$('status').textContent='Reached 50,000 iterations. Reset the chain to start another run.';}}
function pause(){if(timer!==null)clearInterval(timer);timer=null;$('run').textContent='Run';$('run').setAttribute('aria-pressed','false');}
function readConfig(){
  const next={...config,target:$('target').value,proposal:$('proposal').value};
  for(const [key,id]of Object.entries(fields)){const el=$(id),value=el.valueAsNumber;if(!Number.isFinite(value)||value<Number(el.min)||value>Number(el.max)||(key==='burn'||key==='seed')&&!Number.isInteger(value))throw new Error(`Enter ${key==='burn'?'a whole number of warm-up iterations':key==='seed'?'a whole-number seed':el.closest('label')?.childNodes[0]?.textContent?.trim()||'a value'} between ${el.min} and ${el.max}.`);next[key]=value;}
  return next;
}
function configure(){
  pause();try{const next=readConfig(),fresh=new Chain(next);config=next;chain=fresh;$('variance-slider').value=Math.log10(config.variance);$('status').textContent='New chain. Changing any setting resets all samples; Reset chain repeats the same random sequence.';render();}
  catch(error){$('status').textContent=error.message;for(const id of ['step','run','batch'])$(id).disabled=true;}
}
function visibleFields(){for(const name of ['normal','mixture','gamma'])$(name+'-fields').hidden=$('target').value!==name;$('proposal-mean-field').hidden=$('proposal').value!=='independent';}
$('settings').addEventListener('submit',e=>e.preventDefault());
$('settings').addEventListener('input',e=>{if(e.target.type==='number')configure();});
$('settings').addEventListener('change',e=>{if(e.target.id==='target')$('initial').value=e.target.value==='gamma'?Number($('shape').value)*Number($('scale').value):0;visibleFields();configure();});
$('variance-slider').addEventListener('input',e=>{$('variance').value=Math.min(36,10**Number(e.target.value)).toFixed(2);configure();});
for(const id of ['step','batch'])$(id).addEventListener('click',()=>{pause();chain.run(id==='step'?1:1000);$('status').textContent=id==='step'?'One proposal evaluated. The plots and calculation show this decision.':'Added 1,000 steps (up to the 50,000-step limit). The calculation shows the last decision.';render();});
$('run').addEventListener('click',()=>{if(timer!==null){pause();$('status').textContent='Paused. Resume, take one step, or change the settings.';}else{$('run').textContent='Pause';$('run').setAttribute('aria-pressed','true');$('status').textContent='Running about five steps per second. Pause to inspect a decision.';timer=setInterval(()=>{chain.step();render();},200);}});
$('reset').addEventListener('click',configure);
document.addEventListener('visibilitychange',()=>{if(document.hidden&&timer!==null){pause();$('status').textContent='Paused while the page was hidden.';}});
window.addEventListener('pagehide',pause);
new ResizeObserver(()=>{drawDensity();drawDecision();drawSamples();}).observe($('mh-demo'));
visibleFields();render();
