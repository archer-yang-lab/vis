export const defaults = Object.freeze({target:'mixture', mean:0, targetVariance:1, separation:2.5, componentVariance:0.6, weight:0.5, shape:3, scale:1, proposal:'gaussian', variance:1, proposalMean:0, initial:0, seed:42, burn:0});
export const LIMIT = 50000;
const LOG2PI = Math.log(2*Math.PI);
export const normalLog = (x, mean, variance) => -0.5*(LOG2PI+Math.log(variance)+(x-mean)**2/variance);
export function logGamma(z) {
  const p=[676.5203681218851,-1259.1392167224028,771.3234287776531,-176.6150291621406,12.507343278686905,-0.13857109526572012,9.984369578019572e-6,1.5056327351493116e-7];
  z-=1; let x=0.99999999999980993;
  for(let i=0;i<p.length;i++) x+=p[i]/(z+i+1);
  const t=z+7.5;
  return 0.5*LOG2PI+(z+0.5)*Math.log(t)-t+Math.log(x);
}
export function targetLog(x,c) {
  if(c.target==='normal') return normalLog(x,c.mean,c.targetVariance);
  if(c.target==='gamma') return x>0 ? (c.shape-1)*Math.log(x)-x/c.scale-logGamma(c.shape)-c.shape*Math.log(c.scale) : -Infinity;
  const a=Math.log(c.weight)+normalLog(x,-c.separation,c.componentVariance);
  const b=Math.log1p(-c.weight)+normalLog(x,c.separation,c.componentVariance);
  const m=Math.max(a,b);
  return m+Math.log(Math.exp(a-m)+Math.exp(b-m));
}
export function targetRange(c) {
  if(c.target==='normal') {const s=Math.sqrt(c.targetVariance);return [c.mean-5*s,c.mean+5*s];}
  if(c.target==='gamma') return [-0.5*c.scale,(c.shape+6*Math.sqrt(c.shape))*c.scale];
  const s=Math.sqrt(c.componentVariance); return [-c.separation-5*s,c.separation+5*s];
}
export function proposalLog(to,from,c) {
  if(c.proposal==='uniform') return Math.abs(to-from)<=Math.sqrt(3*c.variance)+1e-12 ? -Math.log(2*Math.sqrt(3*c.variance)) : -Infinity;
  return normalLog(to,c.proposal==='independent'?c.proposalMean:from,c.variance);
}
export function seededRandom(seed) {
  let a=seed>>>0;
  return () => {a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t^=t+Math.imul(t^(t>>>7),61|t);return ((t^(t>>>14))>>>0)+0.5;};
}
export function createRandom(seed) {const next=seededRandom(seed);return ()=>next()/4294967296;}
export function propose(x,c,random) {
  if(c.proposal==='uniform') return x+(2*random()-1)*Math.sqrt(3*c.variance);
  const z=Math.sqrt(-2*Math.log(random()))*Math.cos(2*Math.PI*random());
  return (c.proposal==='independent'?c.proposalMean:x)+Math.sqrt(c.variance)*z;
}
export function acceptance(x,y,c) {
  const logTargetRatio=targetLog(y,c)-targetLog(x,c);
  const logProposalRatio=c.proposal==='independent'?proposalLog(x,y,c)-proposalLog(y,x,c):0;
  const logAlpha=Math.min(0,logTargetRatio+logProposalRatio);
  return {logTargetRatio,logProposalRatio,logAlpha,alpha:Math.exp(logAlpha)};
}
export class Chain {
  constructor(config) {
    this.config={...config};
    if(!Number.isFinite(targetLog(config.initial,config))) throw new Error('Choose a starting point with positive target density. For the Gamma target, use x₀ > 0.');
    this.random=createRandom(config.seed);this.values=[config.initial];this.accepted=0;this.last=null;
  }
  get iteration(){return this.values.length-1;}
  get current(){return this.values.at(-1);}
  step() {
    if(this.iteration>=LIMIT) return null;
    const x=this.current, y=propose(x,this.config,this.random), u=this.random();
    const calculation=acceptance(x,y,this.config), accepted=Math.log(u)<calculation.logAlpha;
    const next=accepted?y:x;
    this.values.push(next);if(accepted)this.accepted++;
    this.last={x,y,u,next,accepted,...calculation};return this.last;
  }
  run(count){for(let i=0;i<count&&this.iteration<LIMIT;i++)this.step();return this.last;}
  retained(){return this.values.slice(this.config.burn+1);}
}
