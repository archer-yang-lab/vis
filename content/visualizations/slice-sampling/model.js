export const defaults=Object.freeze({target:'mixture',mean:0,variance:0.6,separation:2.5,weight:0.35,multiplier:1,initial:-2.5,seed:42,burn:0});
export const LIMIT=30000;
export function randomGenerator(seed){let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t^=t+Math.imul(t^(t>>>7),61|t);return (((t^(t>>>14))>>>0)+0.5)/4294967296;};}
export function bisect(fn,a,b){
  let fa=fn(a),fb=fn(b);if(fa===0)return a;if(fb===0)return b;
  if((fa>0)===(fb>0))throw new Error('Root must be bracketed.');
  for(let i=0;i<70;i++){const m=(a+b)/2;if(m===a||m===b)return m;const fm=fn(m);if(fm===0)return m;if((fm>0)===(fa>0)){a=m;fa=fm;}else{b=m;fb=fm;}}
  return (a+b)/2;
}
export class Target {
  constructor(config){
    this.c={...config};const c=this.c;
    if(c.target==='normal'){this.stationary=[c.mean];return;}
    // For equal-variance Gaussian components, every stationary point lies
    // between their means. The log-odds equation has at most three roots;
    // its derivative changes sign only at ±sqrt(m² − variance).
    const m=c.separation;
    const g=x=>Math.log(x+m)-Math.log(m-x)-Math.log((1-c.weight)/c.weight)-2*m*x/c.variance;
    const cuts=[-m,...(m*m>c.variance?[-Math.sqrt(m*m-c.variance),Math.sqrt(m*m-c.variance)]:[]),m];
    const roots=[];
    for(let i=1;i<cuts.length;i++){
      const a=cuts[i-1],b=cuts[i],ga=g(a),gb=g(b);
      if(ga===0)roots.push(a);
      if((ga>0)!==(gb>0))roots.push(bisect(g,a,b));
      if(gb===0)roots.push(b);
    }
    this.stationary=[...new Set(roots)].sort((a,b)=>a-b);
  }
  logBase(x){
    const c=this.c;if(c.target==='normal')return -((x-c.mean)**2)/(2*c.variance);
    const a=Math.log(c.weight)-(x+c.separation)**2/(2*c.variance),b=Math.log1p(-c.weight)-(x-c.separation)**2/(2*c.variance),m=Math.max(a,b);
    return m+Math.log(Math.exp(a-m)+Math.exp(b-m));
  }
  logF(x){return Math.log(this.c.multiplier)+this.logBase(x);}
  f(x){return Math.exp(this.logF(x));}
  density(x){return Math.exp(this.logBase(x))/Math.sqrt(2*Math.PI*this.c.variance);}
  get peak(){return Math.max(...this.stationary.map(x=>this.f(x)));}
  get mean(){return this.c.target==='normal'?this.c.mean:this.c.separation*(1-2*this.c.weight);}
  range(){const c=this.c,s=5*Math.sqrt(c.variance);return c.target==='normal'?[c.mean-s,c.mean+s]:[-c.separation-s,c.separation+s];}
  slice(logHeight){
    const c=this.c,level=logHeight-Math.log(c.multiplier);
    if(c.target==='normal'){if(level>0)return [];const r=Math.sqrt(-2*c.variance*level);return [[c.mean-r,c.mean+r]];}
    // This tail bound contains the whole slice, independently of the plot range.
    const bound=c.separation+Math.sqrt(2*c.variance*Math.max(0,-level))+1;
    const cuts=[-bound,...this.stationary,bound],intervals=[],f=x=>this.logBase(x)-level;
    for(let i=1;i<cuts.length;i++){
      let a=cuts[i-1],b=cuts[i];const fa=f(a),fb=f(b);
      if(fa<0&&fb<0)continue;
      if(fa<0)a=bisect(f,a,b);else if(fb<0)b=bisect(f,a,b);
      if(b-a<=1e-13)continue;
      const previous=intervals.at(-1);
      if(previous&&Math.abs(previous[1]-a)<1e-12)previous[1]=b;else intervals.push([a,b]);
    }
    return intervals;
  }
}
export function sampleSlice(intervals,u){
  const total=intervals.reduce((s,[a,b])=>s+b-a,0);
  if(!(total>0)||!(u>=0&&u<1))throw new Error('A positive-length slice and a uniform draw in [0,1) are required.');
  let distance=u*total;
  for(let i=0;i<intervals.length;i++){const[a,b]=intervals[i];if(distance<b-a||i===intervals.length-1)return {x:Math.min(b,a+distance),index:i};distance-=b-a;}
}
export class SliceChain {
  constructor(config){this.config={...config};this.target=new Target(config);this.random=randomGenerator(config.seed);this.values=[config.initial];this.pairs=[];this.pending=null;this.last=null;}
  get current(){return this.values.at(-1);}
  get iteration(){return this.values.length-1;}
  drawHeight(){
    if(this.iteration>=LIMIT||this.pending)return this.pending;
    const from=this.current,fraction=this.random(),logHeight=this.target.logF(from)+Math.log(fraction),intervals=this.target.slice(logHeight);
    if(!intervals.length)throw new Error('The slice could not be resolved numerically.');
    this.pending={from,fraction,logHeight,height:Math.exp(logHeight),ceiling:this.target.f(from),intervals};return this.pending;
  }
  samplePosition(){
    if(!this.pending)return null;
    const horizontalFraction=this.random(),selected=sampleSlice(this.pending.intervals,horizontalFraction);
    this.last={...this.pending,next:selected.x,index:selected.index,horizontalFraction};this.values.push(selected.x);this.pairs.push([selected.x,this.pending.height]);this.pending=null;return this.last;
  }
  advance(){return this.pending?this.samplePosition():this.drawHeight();}
  run(count){for(let i=0;i<count&&this.iteration<LIMIT;i++){this.drawHeight();this.samplePosition();}return this.last;}
  retained(){return this.values.slice(this.config.burn+1);}
}
