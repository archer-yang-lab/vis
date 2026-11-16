import test from 'node:test';
import assert from 'node:assert/strict';
import {defaults,Chain,acceptance,targetLog,proposalLog,createRandom,propose,LIMIT} from '../content/visualizations/metropolis-hastings/model.js';
const close=(a,b,tolerance=1e-10)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} differs from ${b} by more than ${tolerance}`);
const moments=values=>{const mean=values.reduce((a,b)=>a+b,0)/values.length;return [mean,values.reduce((s,v)=>s+(v-mean)**2,0)/values.length];};
test('random-walk proposal variance is v, not its square',()=>{
  for(const proposal of ['gaussian','uniform']){
    const c={...defaults,proposal,variance:4},rng=createRandom(123);
    const [mean,variance]=moments(Array.from({length:100000},()=>propose(2,c,rng)));
    close(mean,2,.025);close(variance,4,.06);
  }
});
test('acceptance includes the Hastings correction and satisfies detailed balance',()=>{
  for(const target of ['normal','mixture','gamma'])for(const proposal of ['gaussian','uniform','independent']){
    const c={...defaults,target,proposal,variance:3,proposalMean:-1};
    for(const [x,y]of [[.2,1.4],[2.7,.8],[1.1,2.1]]){
      const forward=targetLog(x,c)+proposalLog(y,x,c)+acceptance(x,y,c).logAlpha;
      const reverse=targetLog(y,c)+proposalLog(x,y,c)+acceptance(y,x,c).logAlpha;
      close(forward,reverse);
    }
  }
  const c={...defaults,target:'normal',proposal:'independent',mean:2,targetVariance:4,proposalMean:2,variance:4};
  for(const [x,y]of [[0,2],[2,8],[-10,6]])close(acceptance(x,y,c).alpha,1);
});
test('Gamma density and proposals outside its support',()=>{
  const c={...defaults,target:'gamma',shape:3,scale:2,initial:3};
  close(Math.exp(targetLog(2,c)),Math.exp(-1)/4);
  assert.equal(targetLog(-1,c),-Infinity);assert.equal(acceptance(3,-1,c).alpha,0);
  assert.throws(()=>new Chain({...c,initial:0}),/positive target density/);
});
test('rejections are repeated states; warm-up and seed are respected',()=>{
  const c={...defaults,target:'normal',variance:36,burn:10};
  const a=new Chain(c),b=new Chain(c);a.run(300);b.run(300);
  assert.deepEqual(a.values,b.values);assert.equal(a.retained().length,290);assert.deepEqual(a.retained(),a.values.slice(11));
  const repeats=a.values.slice(1).filter((x,i)=>x===a.values[i]).length;
  assert.equal(repeats,300-a.accepted);assert.ok(repeats>0);
});
test('all nine target/proposal combinations reproduce target moments',()=>{
  const targets={normal:{mean:1,targetVariance:1,expected:[1,1],initial:0},mixture:{separation:2,componentVariance:.8,weight:.3,expected:[.8,4.16],initial:0},gamma:{shape:3,scale:1,expected:[3,3],initial:3}};
  for(const [target,parameters]of Object.entries(targets))for(const proposal of ['gaussian','uniform','independent']){
    const c={...defaults,...parameters,target,proposal,variance:9,proposalMean:parameters.expected[0],seed:2026,burn:5000};
    const chain=new Chain(c);chain.run(45000);const [mean,variance]=moments(chain.retained());
    close(mean,parameters.expected[0],.1);close(variance,parameters.expected[1],.25);
    assert.ok(chain.values.every(Number.isFinite));
  }
});
test('the iteration limit preserves a complete chain',()=>{
  const chain=new Chain(defaults);chain.run(LIMIT+5);assert.equal(chain.iteration,LIMIT);assert.equal(chain.step(),null);assert.equal(chain.retained().length,LIMIT);
});
