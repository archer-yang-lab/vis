import {fitDefaults,FIT_LIMIT,FitChain,generateData,parseData,mixturePDF,responsibility,sufficient,orderedTheta,quantile,dataRange} from '../../assets/gibbs-model.js';
import {$,fmt,colors,plot,curve,path,svgEl,gridMaximum,histogram,drawBars,number,setRows} from '../../assets/gibbs-ui.js';

let data=generateData('separated',120,23),prior={...fitDefaults},chain=new FitChain(data,prior),timer=null;let valid=true;
let source='Generated: separated components, data seed 23.';
const actions=['1. Sample labels','2. Sample weights','3. Sample means','4. Sample variances'];
const average=a=>a.reduce((s,x)=>s+x,0)/a.length;

function draw(){
  const t=chain.theta,range=dataRange(data),h=histogram(data,range),predictive=chain.predictive();
  const p=plot('fit-density',range,[0,1.18*Math.max(...h.density,...predictive,gridMaximum(x=>mixturePDF(x,t),range,t.means))],'Density');
  drawBars(p,h);curve(p,x=>mixturePDF(x,t),'var(--purple)',2.3,undefined,t.means);
  if(chain.draws.length)path(p,chain.grid.map((x,i)=>[x,predictive[i]]),'var(--green)',2.3,'6 4');
  const inspected=Number($('observation').value)-1;
  data.forEach((x,i)=>p.data.append(svgEl('circle',{cx:p.x(x),cy:p.y(0)-4-(i%4)*3,r:i===inspected?4.5:2.2,fill:colors[chain.labels[i]],stroke:i===inspected?'var(--text)':'none','stroke-width':1.5,opacity:i===inspected?1:.6})));
  const r=responsibility(data[inspected],t);
  $('observation-index').textContent=inspected+1;
  $('observation-detail').textContent=`x${inspected+1} = ${fmt(data[inspected])}; current label = ${chain.labels[inspected]+1}. With the current parameters: P(z = 1 | x) = ${fmt(100*r,1)}%, P(z = 2 | x) = ${fmt(100*(1-r),1)}%.`;
  const {count}=sufficient(data,chain.labels);
  setRows('parameters',[0,1].map(k=>[k+1,count[k],fmt(k===0?t.weight:1-t.weight),fmt(t.means[k]),fmt(t.variances[k])]));
  showConditional();
  $('n').textContent=data.length;$('completed').textContent=chain.sweeps.toLocaleString();$('retained').textContent=chain.draws.length.toLocaleString();
  $('predictive-mean').textContent=chain.draws.length?fmt(average(chain.draws.map(d=>d.weight*d.means[0]+(1-d.weight)*d.means[1]))):'—';
  const start=Math.max(0,chain.history.length-300),recent=chain.history.slice(start).map(orderedTheta),xs=[start,Math.max(start+1,chain.sweeps)],ys=recent.flatMap(t=>[t.leftMean,t.rightMean]),lo=Math.min(...ys),hi=Math.max(...ys),pad=Math.max(.5,(hi-lo)*.15);
  const mp=plot('mean-trace',xs,[lo-pad,hi+pad],'Component mean','Sweep');
  for(const [k,key] of ['leftMean','rightMean'].entries()){path(mp,recent.map((t,i)=>[start+i,t[key]]),colors[k],1.5);if(recent.length===1)mp.data.append(svgEl('circle',{cx:mp.x(start),cy:mp.y(recent[0][key]),r:3,fill:colors[k]}));}
  const wp=plot('weight-trace',xs,[0,1],'Weight','Sweep');path(wp,recent.map((t,i)=>[start+i,t.leftWeight]),'var(--blue)',1.5);
  if(recent.length===1)wp.data.append(svgEl('circle',{cx:wp.x(start),cy:wp.y(recent[0].leftWeight),r:3,fill:'var(--blue)'}));
  $('trace-note').textContent=`Sweeps ${start}–${chain.sweeps}; sweep 0 is initialization. Summaries discard the first ${prior.burn} completed sweeps.`;
  const ordered=chain.draws.map(orderedTheta),parameters=[['Smaller mean μ₍₁₎','leftMean'],['Larger mean μ₍₂₎','rightMean'],['Variance of smaller-mean component','leftVariance'],['Variance of larger-mean component','rightVariance'],['Weight of smaller-mean component','leftWeight']];
  setRows('posterior-summary',parameters.map(([name,key])=>{const values=ordered.map(d=>d[key]);return [name,values.length?fmt(average(values)):'—',values.length?`${fmt(quantile(values,.05))} to ${fmt(quantile(values,.95))}`:'—'];}));
  $('sweeps').textContent=`Sweep ${chain.sweeps.toLocaleString()}`;$('advance').textContent=actions[chain.phase];
  for(let i=0;i<4;i++)$('step-'+i).classList.toggle('active',i===chain.phase);
  for(const id of ['advance','run','batch'])$(id).disabled=!valid||chain.sweeps>=FIT_LIMIT;
  if(chain.sweeps>=FIT_LIMIT){pause();$('status').textContent='Reached 3,000 sweeps. Reset the sampler to begin again.';}
}

function showConditional(){
  const b=chain.lastBlock;
  if(!b||b.name==='labels'){
    $('block-name').textContent=b?'Sampled labels z₁, …, zₙ':'Initial state — next: sample labels';
    $('block-formula').textContent='P(zᵢ = k | xᵢ, π, μ, v) ∝ πₖ N(xᵢ | μₖ, vₖ)';
    $('block-detail').textContent=b?`Draw each label independently given the parameters. Counts: n₁ = ${b.count[0]}, n₂ = ${b.count[1]}.`:'Starting means are data quartiles. Initial labels use the nearest starting mean; the first update replaces them with random conditional draws.';
  }else if(b.name==='weights'){
    $('block-name').textContent='Sampled mixture weights';$('block-formula').textContent='π₁ | z ∼ Beta(α + n₁, α + n₂), π₂ = 1 − π₁';
    $('block-detail').textContent=`Conditional parameters: Beta(${fmt(b.a,1)}, ${fmt(b.b,1)}). The new weight is a random draw, not the ratio of counts.`;
  }else if(b.name==='means'){
    $('block-name').textContent='Sampled component means';$('block-formula').textContent='μₖ | rest ∼ N(mₖ, Vₖ)';
    $('block-detail').textContent=b.conditionals.map((c,k)=>`Component ${k+1}: mₖ = ${fmt(c.mean)}, Vₖ = ${fmt(c.variance)}.`).join(' ');
  }else{
    $('block-name').textContent='Sampled component variances';$('block-formula').textContent='vₖ | rest ∼ IG(a₀ + nₖ/2, b₀ + ½ ∑ᵢ: zᵢ=k (xᵢ − μₖ)²)';
    $('block-detail').textContent=b.conditionals.map((c,k)=>`Component ${k+1}: shape = ${fmt(c.shape,1)}, scale = ${fmt(c.scale)}.`).join(' ');
  }
}
function pause(){if(timer!==null)clearInterval(timer);timer=null;$('run').textContent='Run';$('run').setAttribute('aria-pressed','false');}
function configure(){
  pause();try{const next={};for(const key of Object.keys(fitDefaults))next[key]=number(key,key==='seed'||key==='burn');valid=true;prior=next;chain=new FitChain(data,prior);$('observation').max=data.length;$('observation').value=Math.min(Number($('observation').value),data.length);$('data-description').textContent=`${data.length} fixed observations. ${source}`;$('status').textContent='Ready. Four conditional updates complete one sweep. Highlighted chip shows the next update.';draw();}
  catch(e){valid=false;$('status').textContent=e.message;for(const id of ['advance','run','batch'])$(id).disabled=true;}
}
function step(){chain.advance();$('status').textContent=chain.phase===0?`Sweep complete. ${chain.sweeps<=prior.burn?`Warm-up: ${prior.burn-chain.sweeps} more sweeps before retaining draws.`:'Added one draw to the posterior summaries.'}`:`${['Labels','Weights','Means'][chain.phase-1]} sampled. Next: ${['labels','weights','means','variances'][chain.phase]}.`;draw();}
$('data-settings').addEventListener('submit',e=>e.preventDefault());$('inference-settings').addEventListener('submit',e=>e.preventDefault());$('inference-settings').addEventListener('input',configure);
$('generate').addEventListener('click',()=>{pause();try{const n=number('size',true),seed=number('data-seed',true);data=generateData($('dataset').value,n,seed);source=`Generated: ${$('dataset').selectedOptions[0].textContent.toLowerCase()}, data seed ${seed}.`;$('data-error').textContent='';configure();}catch(e){$('data-error').textContent=e.message;$('status').textContent=e.message;}});
$('use-data').addEventListener('click',()=>{pause();try{const parsed=parseData($('custom-data').value);data=parsed;source='Using your pasted data.';$('data-error').textContent='';configure();}catch(e){$('data-error').textContent=e.message;$('status').textContent=e.message;}});
$('observation').addEventListener('input',draw);$('advance').addEventListener('click',()=>{pause();step();});$('batch').addEventListener('click',()=>{pause();chain.run(100);$('status').textContent='Added up to 100 complete sweeps. The panel shows the last variance update.';draw();});$('reset').addEventListener('click',configure);
$('run').addEventListener('click',()=>{if(timer!==null){pause();$('status').textContent='Paused.';}else{$('run').textContent='Pause';$('run').setAttribute('aria-pressed','true');timer=setInterval(step,600);}});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&timer!==null){pause();$('status').textContent='Paused while the page was hidden.';}});window.addEventListener('pagehide',pause);new ResizeObserver(draw).observe($('fit-demo'));configure();
