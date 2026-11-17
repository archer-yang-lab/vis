import test from 'node:test';
import assert from 'node:assert/strict';
import {Random,knownDefaults,fitDefaults,KnownChain,FitChain,normalPDF,mixturePDF,responsibility,meanConditional,varianceConditional,generateData,parseData,orderedTheta} from '../assets/gibbs-model.js';
const close=(a,b,t=1e-10)=>assert.ok(Math.abs(a-b)<=t,`${a} differs from ${b} by more than ${t}`);
const mean=a=>a.reduce((s,x)=>s+x,0)/a.length;

test('normal, Gamma, Beta and inverse-Gamma draws match their parameterizations',()=>{
  const random=new Random(135),n=80000;
  const check=(draw,m,v)=>{const values=Array.from({length:n},draw);close(mean(values),m,6*Math.sqrt(v/n));return values;};
  const normal=check(()=>random.normal(2,4),2,4);close(mean(normal.map(x=>(x-2)**2)),4,.08);
  for(const shape of [.4,1,3.5,50]){const values=check(()=>random.gamma(shape),shape,shape);assert.ok(values.every(x=>x>0));close(mean(values.map(x=>(x-shape)**2)),shape,Math.max(.04,.04*shape));}
  const beta=check(()=>random.beta(2,5),2/7,10/(49*8));assert.ok(beta.every(x=>x>0&&x<1));
  const ig=check(()=>random.inverseGamma(5,8),2,4/3);assert.ok(ig.every(x=>x>0));
});

test('label probabilities use both weighted densities and stay finite in distant tails',()=>{
  const t={means:[-2,1],variances:[.5,3],weight:.3},x=.7;
  close(responsibility(x,t),.3*normalPDF(x,-2,.5)/mixturePDF(x,t));
  const swapped={means:[1,-2],variances:[3,.5],weight:.7};close(responsibility(x,t)+responsibility(x,swapped),1);
  for(const x of [-1000,1000])assert.ok(Number.isFinite(responsibility(x,t)));
  close(responsibility(0,{means:[-1,1],variances:[1,1],weight:.5}),.5);
});

test('known-parameter sampler updates the label conditional on the current observation',()=>{
  const c={...knownDefaults,burn:3},chain=new KnownChain(c),original=structuredClone(chain.theta);
  chain.advance();assert.equal(chain.iteration,0);assert.equal(chain.pending.from,c.initial);close(chain.pending.r,responsibility(c.initial,original));assert.equal(chain.retained().length,0);
  const chosen=chain.pending.z;chain.advance();assert.equal(chain.iteration,1);assert.equal(chain.labels[1],chosen);assert.equal(chain.pending,null);
  chain.advance();chain.run(10);assert.equal(chain.iteration,11);assert.equal(chain.retained().length,8);assert.deepEqual(chain.theta,original);
  const repeat=new KnownChain(c);repeat.run(11);assert.deepEqual(chain.values,repeat.values);
});

test('known-parameter Gibbs samples approach the mixture moments and weights',()=>{
  const c={...knownDefaults,mu1:-.8,mu2:1,v1:1.3,v2:.7,weight:.4,burn:1000},chain=new KnownChain(c);chain.run(20000);
  const expectedMean=c.weight*c.mu1+(1-c.weight)*c.mu2,expectedVariance=c.weight*c.v1+(1-c.weight)*c.v2+c.weight*(1-c.weight)*(c.mu1-c.mu2)**2;
  const values=chain.retained();
  // Batch means accommodate dependence between consecutive Gibbs states.
  for(const [fn,expected] of [[x=>x,expectedMean],[x=>(x-expectedMean)**2,expectedVariance]]){
    const batches=Array.from({length:38},(_,i)=>mean(values.slice(500*i,500*(i+1)).map(fn))),m=mean(batches),se=Math.sqrt(batches.reduce((s,x)=>s+(x-m)**2,0)/(batches.length-1)/batches.length);
    close(m,expected,Math.max(.03,5*se));
  }
  close(mean(chain.labels.slice(c.burn+1).map(z=>z===0?1:0)),c.weight,.025);
});

test('independent Gaussian and inverse-Gamma priors give the stated full conditionals',()=>{
  const p={...fitDefaults,m0:2,V0:4,a0:3,b0:2};
  const m=meanConditional(3,9,2,p);close(m.variance,4/7);close(m.mean,20/7);
  assert.deepEqual(meanConditional(0,0,20,p),{mean:2,variance:4});
  // Residuals are centered at the current sampled mean (5), not the sample mean (2).
  assert.deepEqual(varianceConditional([1,3,9],[0,0,1],0,5,p),{shape:4,scale:12});
  assert.deepEqual(varianceConditional([1,3,9],[0,0,0],1,5,p),{shape:3,scale:2});
});

test('four blocks complete one sweep, with empty components sampled from their priors',()=>{
  const data=[-3,-2,-1,1,2,3],original=[...data],chain=new FitChain(data,{...fitDefaults,burn:1});
  chain.advance();assert.equal(chain.phase,1);assert.equal(chain.sweeps,0);assert.equal(chain.lastBlock.name,'labels');
  chain.labels=data.map(()=>0);chain.advance();assert.deepEqual(chain.lastBlock,{name:'weights',a:7,b:1});
  chain.advance();assert.deepEqual(chain.lastBlock.conditionals[1],{mean:fitDefaults.m0,variance:fitDefaults.V0});assert.equal(chain.sweeps,0);
  chain.advance();assert.deepEqual(chain.lastBlock.conditionals[1],{shape:fitDefaults.a0,scale:fitDefaults.b0});assert.equal(chain.sweeps,1);assert.equal(chain.phase,0);assert.equal(chain.draws.length,0);
  chain.advance();chain.run(4);assert.equal(chain.sweeps,5);assert.equal(chain.draws.length,4);assert.equal(chain.history.length,6);assert.deepEqual(data,original);assert.deepEqual(chain.data,original);
  for(const t of chain.history){assert.ok(t.variances.every(v=>Number.isFinite(v)&&v>0));assert.ok(t.weight>0&&t.weight<1);}
});

test('posterior predictive averages densities, and reporting preserves sampler labels',()=>{
  const chain=new FitChain(generateData('separated',120,23),fitDefaults);chain.run(800);
  assert.equal(chain.draws.length,700);
  const ordered=chain.draws.map(orderedTheta);close(mean(ordered.map(t=>t.leftMean)),-2.5,.5);close(mean(ordered.map(t=>t.rightMean)),2.5,.5);
  for(const i of [20,80,150])close(chain.predictive()[i],mean(chain.draws.map(t=>mixturePDF(chain.grid[i],t))),1e-12);
  const state={means:[3,-2],variances:[4,1],weight:.7},copy=structuredClone(state),swapped={means:[-2,3],variances:[1,4],weight:.3};
  const a=orderedTheta(state),b=orderedTheta(swapped);for(const k of Object.keys(a))close(a[k],b[k]);assert.deepEqual(state,copy);
});

test('pasted data validation rejects invalid values and preserves finite numeric data',()=>{
  assert.deepEqual(parseData('1, 2; 3\n4 5 6 7 8 -9 1e1'),[1,2,3,4,5,6,7,8,-9,10]);
  for(const s of ['', '1 2 3', '1 2 3 4 5 6 7 8 9 NaN','1 2 3 4 5 6 7 8 9 1001',Array(501).fill('1').join(' ')])assert.throws(()=>parseData(s));
});
