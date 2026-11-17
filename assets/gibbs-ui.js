export const $=id=>document.getElementById(id);
export const colors=['var(--blue)','var(--orange)'];
export const fmt=(x,d=3)=>!Number.isFinite(x)?'—':x!==0&&Math.abs(x)<1e-4?x.toExponential(2):(Math.abs(x)<.5*10**-d?0:x).toFixed(d).replace('-','−');
export function svgEl(tag,attrs={},text){const node=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const[k,v]of Object.entries(attrs))node.setAttribute(k,v);if(text!==undefined)node.textContent=text;return node;}
export function line(svg,x1,y1,x2,y2,color='var(--border)',width=1,dash){svg.append(svgEl('line',{x1,y1,x2,y2,stroke:color,'stroke-width':width,...(dash?{'stroke-dasharray':dash}:{})}));}
export function label(svg,x,y,text,anchor='middle'){svg.append(svgEl('text',{x,y,'text-anchor':anchor},text));}
const tick=x=>Math.abs(x)<1e-7?'0':fmt(x,Math.abs(x)<.2?2:1).replace(/\.0$/,'');
export function plot(id,xRange,yRange,yLabel,xLabel='x'){
  const svg=$(id),width=svg.clientWidth,height=svg.clientHeight,L=48,R=18,T=25,B=40;
  const x=v=>L+(v-xRange[0])/(xRange[1]-xRange[0])*(width-L-R),y=v=>height-B-(v-yRange[0])/(yRange[1]-yRange[0])*(height-T-B);
  svg.setAttribute('viewBox',`0 0 ${width} ${height}`);svg.replaceChildren();const clip=svgEl('clipPath',{id:id+'-clip'});clip.append(svgEl('rect',{x:L,y:T,width:width-L-R,height:height-T-B}));const defs=svgEl('defs');defs.append(clip);svg.append(defs);
  for(let i=0;i<=3;i++){const v=yRange[0]+i*(yRange[1]-yRange[0])/3;line(svg,L,y(v),width-R,y(v));label(svg,L-7,y(v)+4,tick(v),'end');}
  const integers=xLabel==='Iteration'||xLabel==='Sweep',ticks=integers?[...new Set([xRange[0],Math.round((xRange[0]+xRange[1])/2),xRange[1]])]:Array.from({length:5},(_,i)=>xRange[0]+i*(xRange[1]-xRange[0])/4);
  for(const v of ticks)label(svg,x(v),height-B+18,integers?v:tick(v));label(svg,0,13,yLabel,'start');label(svg,width/2,height-3,xLabel);
  const data=svgEl('g',{'clip-path':`url(#${id}-clip)`});svg.append(data);return {svg,data,x,y,xRange,width,height};
}
export function path(p,points,color,width=2,dash){p.data.append(svgEl('path',{d:points.map(([x,y],i)=>(i?'L':'M')+p.x(x).toFixed(2)+','+p.y(y).toFixed(2)).join(''),fill:'none',stroke:color,'stroke-width':width,...(dash?{'stroke-dasharray':dash}:{})}));}
export function curve(p,fn,color,width=2,dash,extra=[]){const xs=[...Array.from({length:301},(_,i)=>p.xRange[0]+i*(p.xRange[1]-p.xRange[0])/300),...extra].filter(x=>x>=p.xRange[0]&&x<=p.xRange[1]).sort((a,b)=>a-b);path(p,xs.map(x=>[x,fn(x)]),color,width,dash);}
export function gridMaximum(fn,range,extra=[]){return Math.max(.001,...Array.from({length:301},(_,i)=>fn(range[0]+i*(range[1]-range[0])/300)),...extra.map(fn));}
export function histogram(values,range,bins=32){const binWidth=(range[1]-range[0])/bins,counts=Array(bins).fill(0);let outside=0;for(const x of values){const i=Math.floor((x-range[0])/binWidth);if(i>=0&&i<bins)counts[i]++;else outside++;}return {range,binWidth,outside,density:counts.map(n=>values.length?n/(values.length*binWidth):0)};}
export function drawBars(p,h){h.density.forEach((v,i)=>p.data.append(svgEl('rect',{x:p.x(h.range[0]+i*h.binWidth),y:p.y(v),width:Math.max(0,p.x(h.range[0]+h.binWidth)-p.x(h.range[0])-1),height:p.y(0)-p.y(v),fill:'color-mix(in srgb,var(--muted) 16%,var(--canvas))',stroke:'var(--border)','stroke-width':.7})));}
export function number(id,integer=false){const node=$(id),value=node.valueAsNumber;if(!Number.isFinite(value)||value<Number(node.min)||value>Number(node.max)||integer&&!Number.isInteger(value))throw new Error(`Enter ${node.closest('label')?.childNodes[0]?.textContent?.trim()||id} between ${node.min} and ${node.max}${integer?' as a whole number':''}.`);return value;}
export function setRows(id,rows){const body=$(id);body.replaceChildren();for(const cells of rows){const tr=document.createElement('tr');for(const text of cells){const td=document.createElement('td');td.textContent=text;tr.append(td);}body.append(tr);}}
