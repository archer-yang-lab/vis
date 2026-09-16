import { example, candidate, initialState, chooseBest, continueToSecond, radians } from './model.js';

const root = document.getElementById('successive-demo');
const get = id => root.querySelector('#'+id);
const number = value => (Math.abs(value)<.0005 ? 0 : value).toFixed(3).replace('-', '−');
let state = initialState();
function node(tag, attributes={}, text) {
  const item = document.createElementNS('http://www.w3.org/2000/svg',tag);
  for (const [key,value] of Object.entries(attributes)) item.setAttribute(key,value);
  if (text !== undefined) item.textContent=text;
  return item;
}
function arrow(svg, origin, end, color, width=3, dashed=false) {
  const attributes={d:`M${origin.join(',')}L${end.join(',')}`,fill:'none',stroke:color,'stroke-width':width,'stroke-linecap':'round'};
  if(dashed) attributes['stroke-dasharray']='5 5';
  svg.append(node('path',attributes));
  const dx=end[0]-origin[0],dy=end[1]-origin[1],length=Math.hypot(dx,dy),x=dx/length,y=dy/length;
  svg.append(node('path',{d:`M${end[0]-8*x+4*y},${end[1]-8*y-4*x}L${end.join(',')}L${end[0]-8*x-4*y},${end[1]-8*y+4*x}`,fill:'none',stroke:color,'stroke-width':width,'stroke-linecap':'round','stroke-linejoin':'round'}));
}
function drawCircle(which, degrees) {
  const svg=get(which+'-circle'), width=svg.parentElement.clientWidth;
  const height=Math.max(250,Math.min(365,width*.84));
  const cx=width/2, cy=height/2, radius=Math.min(width/2-48,height/2-40);
  const color=which==='blue'?'var(--blue)':'var(--orange)', base=which==='blue'?'e':'b', name=which==='blue'?'a':'â';
  const restricted=state.stage===2, point=(x,y)=>[cx+radius*x,cy-radius*y];
  svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
  svg.replaceChildren(node('title',{},`${name} is a unit vector in its own subspace. ${restricted?'Only the two directions perpendicular to the first chosen vector remain feasible.':'Every direction on the unit circle is feasible.'}`));
  for (const [a,b] of [[[cx-radius-15,cy],[cx+radius+18,cy]],[[cx,cy+radius+15],[cx,cy-radius-18]]]) svg.append(node('path',{d:`M${a.join(',')}L${b.join(',')}`,stroke:'var(--border)','stroke-width':1}));
  svg.append(node('circle',{cx,cy,r:radius,fill:'none',stroke:restricted?'var(--border)':color,'stroke-width':restricted?1:2,'stroke-dasharray':restricted?'3 5':'none'}));
  svg.append(node('text',{x:cx+radius+23,y:cy+4},base+'₁'),node('text',{x:cx,y:cy-radius-25,'text-anchor':'middle'},base+'₂'));
  if (restricted) {
    arrow(svg,[cx,cy],point(1,0),'var(--muted)',1.5,true);
    svg.append(node('text',{x:cx+radius*.55,y:cy+22,'text-anchor':'middle'},name+'₁'));
    for(const sign of [-1,1]) svg.append(node('circle',{cx,cy:cy-sign*radius,r:5,fill:color}));
    const sign=degrees>0?1:-1;
    svg.append(node('path',{d:`M${cx+12},${cy}v${-sign*12}h-12`,fill:'none',stroke:'var(--muted)','stroke-width':1.2}));
  }
  const x=Math.cos(radians(degrees)),y=Math.sin(radians(degrees)),end=point(x,y);
  arrow(svg,[cx,cy],end,color);
  // Label the candidate inside the circle; axis labels stay outside it.
  const label=point(x*.70,y*.70);
  svg.append(node('text',{x:label[0]+(Math.abs(x)<.2?13:0),y:label[1]+(Math.abs(x)<.2?3:-13),'text-anchor':Math.abs(x)<.2?'start':'middle'},state.chosen?name+(state.stage===1?'₁':'₂'):name));
  svg.append(node('circle',{cx,cy,r:2.5,fill:'var(--text)'}));
}
function drawMeter(score, maximum) {
  const svg=get('score-meter'), width=svg.parentElement.clientWidth, x=value=>22+(value+1)/2*(width-44);
  svg.setAttribute('viewBox',`0 0 ${width} 52`);
  svg.replaceChildren(node('title',{},`Current inner product ${number(score)}. Maximum at this step ${number(maximum)}.`));
  svg.append(node('path',{d:`M${x(-1)},18H${x(1)}`,stroke:'var(--border)','stroke-width':5,'stroke-linecap':'round'}));
  svg.append(node('path',{d:`M${x(0)},18H${x(score)}`,stroke:'var(--blue)','stroke-width':5,'stroke-linecap':'round'}));
  for (const value of [-1,0,1]) svg.append(node('text',{x:x(value),y:45,'text-anchor':'middle'},String(value).replace('-','−')));
  svg.append(node('circle',{cx:x(score),cy:18,r:5,fill:'var(--blue)'}));
}
function coordinate(name, coefficients, base) {
  return `${name} = ${number(coefficients[0])}${base}₁ ${coefficients[1]<-.0005?'−':'+'} ${number(Math.abs(coefficients[1]))}${base}₂`;
}
function render() {
  const model=example(state.shared), current=candidate(model,state.alpha,state.beta), second=state.stage===2;
  get('basis-one').textContent=state.shared?'b₁ = e₁':'b₁ = cos(20°)e₁ + sin(20°)e₃';
  get('alpha').value=state.alpha;get('beta').value=state.beta;
  get('alpha-value').value=state.alpha+'°';get('beta-value').value=state.beta+'°';
  get('alpha').disabled=state.chosen;get('beta').disabled=state.chosen;
  for (const which of ['blue','orange']) {
    get(which+'-free').hidden=second; get(which+'-restricted').hidden=!second;
    get(which+'-set').textContent=second?'Allowed unit vectors: only the two endpoints':'Allowed unit vectors: the full circle';
    get('reverse-'+which).disabled=state.chosen;
  }
  for (const [id,active] of [['step-one',!second],['step-two',second]]) {
    if(active)get(id).setAttribute('aria-current','step');else get(id).removeAttribute('aria-current');
  }
  get('blue-coordinates').textContent=coordinate('a',current.x,'e');get('orange-coordinates').textContent=coordinate('â',current.y,'b');
  get('blue-constraint').value=number(current.blueConstraint);get('orange-constraint').value=number(current.orangeConstraint);
  get('score').value=number(current.score);
  if(!second&&!state.chosen) {
    get('stage-title').textContent='Pair 1: try any unit directions';
    get('stage-description').textContent='Choose a unit vector a in 𝒰 and a unit vector â in 𝒰̂. Try directions below, then find the pair that maximizes their inner product aᵀâ.';
    get('selection-note').textContent='There are no previous vectors, so every point on each circle is allowed.';
    get('advance').textContent='Find best pair 1';
  } else if(!second) {
    get('stage-title').textContent='Pair 1 chosen: the most closely aligned directions';
    get('stage-description').textContent=`We choose a₁ = e₁ and â₁ = b₁. Their inner product is σ₁ = ${number(model.cosines[0])}, giving θ₁ = ${model.angles[0]}°.`;
    get('selection-note').textContent=state.shared?'Here b₁ = e₁, so a₁ = â₁: the first pair is a shared direction.':'Fix this pair. The next pair must be perpendicular to it within each subspace.';
    get('advance').textContent='Keep pair 1 and continue';
  } else if(!state.chosen) {
    get('stage-title').textContent='Pair 2: restrict each subspace separately';
    get('stage-description').textContent='Require a ⟂ a₁ in 𝒰 and â ⟂ â₁ in 𝒰̂. Only a = ±e₂ and â = ±b₂ remain. Reverse either vector to compare the feasible choices.';
    get('selection-note').textContent=current.score<0?'This pair is feasible, but its inner product is negative. Reverse one vector to make the inner product positive.':'These signs give the largest feasible inner product for the second pair.';
    get('advance').textContent='Find best pair 2';
  } else {
    get('stage-title').textContent='Both principal pairs chosen';
    get('stage-description').textContent='The second pair is a₂ = e₂ and â₂ = b₂. Each is perpendicular to the first vector in its own subspace.';
    get('selection-note').textContent='The additional constraints lower the maximum alignment, so the second principal angle is larger in this example.';
    get('advance').textContent='Both pairs chosen';
  }
  get('advance').disabled=second&&state.chosen;
  for(let i=0;i<2;i++) {
    const row=get(i===0?'result-one':'result-two'); const result=state.results[i];
    const cells=row.querySelectorAll('td');
    cells[0].textContent=result?`e${i===0?'₁':'₂'}, b${i===0?'₁':'₂'}`:'Not chosen';
    cells[1].textContent=result?number(result.sigma):'—';cells[2].textContent=result?result.theta+'°':'—';
  }
  get('ordering').textContent=state.results.length===2?`1 ≥ ${number(model.cosines[0])} ≥ ${number(model.cosines[1])} ≥ 0, and 0° ≤ ${model.angles[0]}° ≤ ${model.angles[1]}° ≤ 90°.`:second?'The feasible set for pair 2 is contained in the original feasible set.':state.chosen?'Next, add one orthogonality constraint in each subspace.':'The first pair has no orthogonality constraints.';
  drawCircle('blue',state.alpha);drawCircle('orange',state.beta);drawMeter(current.score,model.cosines[state.stage-1]);
}
for(const key of ['alpha','beta']) get(key).addEventListener('input',event=>{state[key]=Number(event.target.value);render();});
get('advance').addEventListener('click',()=>{state=state.stage===1&&state.chosen?continueToSecond(state):chooseBest(state);render();get('announcement').textContent=get('stage-description').textContent;});
get('reset').addEventListener('click',()=>{state=initialState(state.shared);render();get('announcement').textContent='Start again with no previously chosen pairs.';});
get('example').addEventListener('change',event=>{state=initialState(event.target.value==='shared');render();get('announcement').textContent='Example changed. Choose the first pair.';});
for(const [id,key] of [['reverse-blue','alpha'],['reverse-orange','beta']]) get(id).addEventListener('click',()=>{state[key]=-state[key];render();get('announcement').textContent=`Current inner product ${get('score').value}. Both orthogonality constraints remain satisfied.`;});
new ResizeObserver(render).observe(root.querySelector('.circles'));
render();
