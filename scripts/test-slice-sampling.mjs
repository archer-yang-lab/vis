import test from 'node:test';
import assert from 'node:assert/strict';
import {defaults,Target,SliceChain,sampleSlice,randomGenerator} from '../content/visualizations/slice-sampling/model.js';
const close=(a,b,t=1e-9)=>assert.ok(Math.abs(a-b)<=t,`${a} differs from ${b} by more than ${t}`);
const contains=(intervals,x,t=1e-10)=>intervals.some(([a,b])=>x>=a-t&&x<=b+t);
test('Gaussian slices have their analytic endpoints',()=>{
  const target=new Target({...defaults,target:'normal',mean:1,variance:4,multiplier:3});
  const interval=target.slice(Math.log(3)-2);assert.equal(interval.length,1);close(interval[0][0],-3);close(interval[0][1],5);
  close(target.density(1),1/Math.sqrt(8*Math.PI));
});
test('uniform selection uses interval lengths, not equal interval weights',()=>{
  const intervals=[[-3,-2],[1,4]],rng=randomGenerator(42),samples=Array.from({length:60000},()=>sampleSlice(intervals,rng()));
  const left=samples.filter(s=>s.index===0),right=samples.filter(s=>s.index===1);
  close(left.length/samples.length,.25,.008);close(left.reduce((a,b)=>a+b.x,0)/left.length,-2.5,.02);close(right.reduce((a,b)=>a+b.x,0)/right.length,2.5,.02);
  for(const s of samples)assert.ok(contains(intervals,s.x));
});
test('mixture slices contain all and only points above the height',()=>{
  for(const separation of [.5,1,2.5,5])for(const variance of [.2,.6,1,4])for(const weight of [.05,.35,.5,.95]){
    const target=new Target({...defaults,separation,variance,weight});
    const levels=[.000001,.1,.6,.99999999].map(f=>Math.log(target.peak)+Math.log(f));
    for(const point of target.stationary)for(const offset of [-1e-7,1e-7])if(target.logF(point)+offset<Math.log(target.peak))levels.push(target.logF(point)+offset);
    for(const level of levels){
      const intervals=target.slice(level);assert.ok(intervals.length>0&&intervals.length<=2);
      for(const[a,b]of intervals){assert.ok(b>a);close(target.logF(a),level,2e-8);close(target.logF(b),level,2e-8);assert.ok(target.logF((a+b)/2)>=level-1e-10);}
      const lo=intervals[0][0]-.1,hi=intervals.at(-1)[1]+.1;
      for(let i=0;i<=500;i++){const x=lo+(hi-lo)*i/500,difference=target.logF(x)-level;if(Math.abs(difference)>1e-8)assert.equal(contains(intervals,x,0),difference>0);}
    }
  }
});
test('two phases produce valid joint draws and count only completed iterations',()=>{
  const chain=new SliceChain({...defaults,burn:10});
  const slice=chain.drawHeight();assert.equal(chain.iteration,0);assert.equal(chain.retained().length,0);assert.equal(slice.intervals.length,2);assert.ok(slice.height>0&&slice.height<slice.ceiling);assert.ok(contains(slice.intervals,chain.current));
  chain.samplePosition();assert.equal(chain.iteration,1);assert.equal(chain.pending,null);assert.ok(chain.target.logF(chain.current)>=slice.logHeight-1e-10);
  chain.drawHeight();chain.run(500);assert.equal(chain.iteration,501);assert.equal(chain.retained().length,491);assert.equal(chain.pairs.length,501);
  for(const[x,v]of chain.pairs)assert.ok(v>0&&v<=chain.target.f(x)*(1+1e-10));
});
test('rescaling the unnormalized density preserves the x chain',()=>{
  const a=new SliceChain(defaults),b=new SliceChain({...defaults,multiplier:4});a.run(500);b.run(500);
  a.values.forEach((x,i)=>close(x,b.values[i],1e-9));a.pairs.forEach(([,v],i)=>close(4*v,b.pairs[i][1],1e-9));
});
test('sample moments approach the normalized target for single and multiple modes',()=>{
  const settings=[{...defaults,target:'normal',mean:1.2,variance:1.4,initial:0},{...defaults},{...defaults,separation:5,variance:.2,weight:.05,initial:-5}];
  for(const c of settings){
    const chain=new SliceChain({...c,burn:1000});chain.run(30000);const values=chain.retained();
    const expectedVariance=c.variance+(c.target==='mixture'?4*c.separation**2*c.weight*(1-c.weight):0);
    // Batch means account for dependence, particularly when a mode has only
    // 5% of the mass. A fixed IID tolerance understates simulation error.
    for(const [fn,expected]of [[x=>x,chain.target.mean],[x=>(x-chain.target.mean)**2,expectedVariance]]){
      const size=500,batches=Array.from({length:Math.floor(values.length/size)},(_,i)=>values.slice(i*size,(i+1)*size).reduce((s,x)=>s+fn(x),0)/size);
      const mean=batches.reduce((a,b)=>a+b,0)/batches.length,se=Math.sqrt(batches.reduce((s,x)=>s+(x-mean)**2,0)/(batches.length-1)/batches.length);
      close(mean,expected,Math.max(.025,5*se));
    }
  }
});
