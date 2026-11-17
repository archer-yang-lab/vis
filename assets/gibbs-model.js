export const KNOWN_LIMIT=20000, FIT_LIMIT=3000;
export const knownDefaults=Object.freeze({mu1:-2,mu2:2,v1:1,v2:1,weight:.45,initial:-2,seed:42,burn:0});
export const fitDefaults=Object.freeze({alpha:1,m0:0,V0:25,a0:3,b0:2,seed:42,burn:100});
export class Random {
  constructor(seed){this.state=seed>>>0;}
  uniform(){let a=this.state=(this.state+0x6D2B79F5)|0,t=Math.imul(a^(a>>>15),1|a);t^=t+Math.imul(t^(t>>>7),61|t);return (((t^(t>>>14))>>>0)+.5)/4294967296;}
  normal(mean=0,variance=1){return mean+Math.sqrt(variance)*Math.sqrt(-2*Math.log(this.uniform()))*Math.cos(2*Math.PI*this.uniform());}
  gamma(shape){
    if(!(shape>0))throw new Error('Gamma shape must be positive.');
    if(shape<1)return this.gamma(shape+1)*this.uniform()**(1/shape);
    const d=shape-1/3,c=1/Math.sqrt(9*d);
    while(true){const x=this.normal(),base=1+c*x;if(base<=0)continue;const v=base**3,u=this.uniform();if(u<1-.0331*x**4||Math.log(u)<.5*x*x+d*(1-v+Math.log(v)))return d*v;}
  }
  beta(a,b){const x=this.gamma(a),y=this.gamma(b);return x/(x+y);}
  inverseGamma(a,b){return b/this.gamma(a);}
}
export const normalLog=(x,mean,variance)=>-.5*(Math.log(2*Math.PI*variance)+(x-mean)**2/variance);
export const normalPDF=(x,mean,variance)=>Math.exp(normalLog(x,mean,variance));
export const copyTheta=t=>({means:[...t.means],variances:[...t.variances],weight:t.weight});
export const thetaFromConfig=c=>({means:[c.mu1,c.mu2],variances:[c.v1,c.v2],weight:c.weight});
export function responsibility(x,t){const a=Math.log(t.weight)+normalLog(x,t.means[0],t.variances[0]),b=Math.log1p(-t.weight)+normalLog(x,t.means[1],t.variances[1]),m=Math.max(a,b),aa=Math.exp(a-m),bb=Math.exp(b-m);return aa/(aa+bb);}
export const mixturePDF=(x,t)=>t.weight*normalPDF(x,t.means[0],t.variances[0])+(1-t.weight)*normalPDF(x,t.means[1],t.variances[1]);
export function mixtureRange(t){return [Math.min(...t.means.map((m,k)=>m-4.5*Math.sqrt(t.variances[k]))),Math.max(...t.means.map((m,k)=>m+4.5*Math.sqrt(t.variances[k])))];}
export class KnownChain {
  constructor(c){this.config={...c};this.theta=thetaFromConfig(c);this.random=new Random(c.seed);this.values=[c.initial];this.labels=[null];this.pending=null;this.last=null;}
  get iteration(){return this.values.length-1;} get current(){return this.values.at(-1);}
  advance(){
    if(this.iteration>=KNOWN_LIMIT)return;
    if(!this.pending){const from=this.current,r=responsibility(from,this.theta),u=this.random.uniform();this.pending={from,r,u,z:u<r?0:1};}
    else{const z=this.pending.z,x=this.random.normal(this.theta.means[z],this.theta.variances[z]);this.last={...this.pending,x};this.values.push(x);this.labels.push(z);this.pending=null;}
  }
  run(n){for(let i=0;i<n&&this.iteration<KNOWN_LIMIT;i++){if(!this.pending)this.advance();this.advance();}}
  retained(){return this.values.slice(this.config.burn+1);}
}
export function sufficient(data,labels){const count=[0,0],sum=[0,0];data.forEach((x,i)=>{const k=labels[i];count[k]++;sum[k]+=x;});return {count,sum};}
export function meanConditional(n,sum,v,prior){const variance=1/(1/prior.V0+n/v);return {mean:variance*(prior.m0/prior.V0+sum/v),variance};}
export function varianceConditional(data,labels,k,mean,prior){let n=0,ss=0;data.forEach((x,i)=>{if(labels[i]===k){n++;ss+=(x-mean)**2;}});return {shape:prior.a0+n/2,scale:prior.b0+ss/2};}
export function orderedTheta(t){const k=t.means[0]<=t.means[1]?0:1;return {leftMean:t.means[k],rightMean:t.means[1-k],leftVariance:t.variances[k],rightVariance:t.variances[1-k],leftWeight:k===0?t.weight:1-t.weight};}
export function quantile(values,q){const a=[...values].sort((a,b)=>a-b),index=(a.length-1)*q,i=Math.floor(index);return a[i]+(a[Math.min(i+1,a.length-1)]-a[i])*(index-i);}
export function dataRange(data){const mean=data.reduce((a,b)=>a+b,0)/data.length,sd=Math.max(.5,Math.sqrt(data.reduce((s,x)=>s+(x-mean)**2,0)/data.length));return [Math.min(...data)-1.5*sd,Math.max(...data)+1.5*sd];}
export class FitChain {
  constructor(data,prior){
    if(data.length<2||!data.every(Number.isFinite))throw new Error('At least two finite observations are required.');
    this.data=[...data];this.prior={...prior};this.random=new Random(prior.seed);this.phase=0;this.sweeps=0;this.lastBlock=null;
    const mean=data.reduce((a,b)=>a+b,0)/data.length,variance=Math.max(.25,data.reduce((s,x)=>s+(x-mean)**2,0)/data.length/2);
    this.theta={means:[quantile(data,.25),quantile(data,.75)],variances:[variance,variance],weight:.5};
    this.labels=data.map(x=>Math.abs(x-this.theta.means[0])<=Math.abs(x-this.theta.means[1])?0:1);
    this.history=[copyTheta(this.theta)];this.draws=[];const range=dataRange(data);this.grid=Array.from({length:201},(_,i)=>range[0]+i*(range[1]-range[0])/200);this.predictiveSum=new Float64Array(this.grid.length);
  }
  advance(){
    if(this.sweeps>=FIT_LIMIT)return;
    const p=this.prior,t=this.theta;
    if(this.phase===0){this.labels=this.data.map(x=>this.random.uniform()<responsibility(x,t)?0:1);this.lastBlock={name:'labels',...sufficient(this.data,this.labels)};}
    if(this.phase===1){const {count}=sufficient(this.data,this.labels),a=p.alpha+count[0],b=p.alpha+count[1];t.weight=this.random.beta(a,b);this.lastBlock={name:'weights',a,b};}
    if(this.phase===2){const {count,sum}=sufficient(this.data,this.labels),conditionals=count.map((n,k)=>meanConditional(n,sum[k],t.variances[k],p));t.means=conditionals.map(c=>this.random.normal(c.mean,c.variance));this.lastBlock={name:'means',conditionals};}
    if(this.phase===3){const conditionals=[0,1].map(k=>varianceConditional(this.data,this.labels,k,t.means[k],p));t.variances=conditionals.map(c=>this.random.inverseGamma(c.shape,c.scale));this.lastBlock={name:'variances',conditionals};this.sweeps++;this.history.push(copyTheta(t));if(this.sweeps>p.burn){this.draws.push(copyTheta(t));this.grid.forEach((x,i)=>this.predictiveSum[i]+=mixturePDF(x,t));}}
    this.phase=(this.phase+1)%4;
  }
  run(n){for(let i=0;i<n&&this.sweeps<FIT_LIMIT;i++){const end=this.sweeps+1;while(this.sweeps<end)this.advance();}}
  predictive(){return Array.from(this.predictiveSum,s=>this.draws.length?s/this.draws.length:0);}
}
export const presets={separated:{means:[-2.5,2.5],variances:[.7,1],weight:.45},overlap:{means:[-1,1],variances:[1,1],weight:.5},unequal:{means:[-2,2],variances:[.3,2],weight:.3}};
export function generateData(preset,n,seed){const random=new Random(seed),t=presets[preset];return Array.from({length:n},()=>{const k=random.uniform()<t.weight?0:1;return random.normal(t.means[k],t.variances[k]);});}
export function parseData(text){const tokens=text.trim().split(/[\s,;]+/);if(tokens.length<10||tokens.length>500)throw new Error('Enter 10–500 numbers, separated by spaces, commas, or newlines.');const valid=/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;const data=tokens.map(t=>{if(!valid.test(t)||!Number.isFinite(Number(t))||Math.abs(Number(t))>1000)throw new Error('Every entry must be a finite number between −1,000 and 1,000.');return Number(t);});return data;}
