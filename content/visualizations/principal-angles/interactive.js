import { principalModel, column, transpose, dot, scale, add } from './geometry.js';

const root = document.getElementById('principal-demo');
const get = id => root.querySelector('#' + id);
const state = { phi: 40, alpha: 0, beta: 0, pair: 1 };
const colors = { blue: 'var(--blue)', orange: 'var(--orange)', projection: 'var(--projection)', muted: 'var(--muted)', border: 'var(--border)' };
const format = value => (Math.abs(value) < .0005 ? 0 : value).toFixed(3).replace('-', '−');
const sub = i => i === 0 ? '₁' : '₂';
function element(tag, attributes = {}, text) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  if (text !== undefined) node.textContent = text;
  return node;
}
function scene(svg, description) {
  const width = svg.parentElement.clientWidth;
  const height = Math.max(270, Math.min(385, width * .82));
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.replaceChildren(element('title', {}, description));
  const occupied = [];
  const line = (a, b, color, thickness = 1, dashed = false) => {
    const path = element('path', {d: `M${a.join(',')}L${b.join(',')}`, fill: 'none', stroke: color, 'stroke-width': thickness, 'stroke-linecap': 'round'});
    if (dashed) path.setAttribute('stroke-dasharray', '5 5');
    svg.append(path);
  };
  const arrow = (a, b, color, thickness = 3, dashed = false) => {
    line(a, b, color, thickness, dashed);
    const dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy);
    if (length < 8) return;
    const ux = dx / length, uy = dy / length, size = thickness > 2 ? 8 : 6;
    svg.append(element('path', { d: `M${b[0]-size*ux+size*.45*uy},${b[1]-size*uy-size*.45*ux}L${b.join(',')}L${b[0]-size*ux-size*.45*uy},${b[1]-size*uy+size*.45*ux}`, fill: 'none', stroke: color, 'stroke-width': thickness, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
  };
  const label = (point, text, options = {}) => {
    const label = element('text', {}, text); svg.append(label);
    const candidates = options.offsets || [[10, -9], [10, 20], [-10, -9], [-10, 22], [0, -25], [0, 33]];
    let chosen;
    for (const [dx, dy] of candidates) {
      label.setAttribute('text-anchor', dx < 0 ? 'end' : dx === 0 ? 'middle' : 'start');
      label.setAttribute('x', point[0] + dx); label.setAttribute('y', point[1] + dy);
      let box = label.getBBox();
      const xShift = Math.max(8 - box.x, 0) - Math.max(box.x + box.width - width + 8, 0);
      const yShift = Math.max(18 - box.y, 0) - Math.max(box.y + box.height - height + 8, 0);
      label.setAttribute('x', point[0] + dx + xShift); label.setAttribute('y', point[1] + dy + yShift);
      box = label.getBBox();
      chosen = {x: box.x - 4, y: box.y - 4, width: box.width + 8, height: box.height + 8};
      if (!occupied.some(old => chosen.x < old.x + old.width && chosen.x + chosen.width > old.x && chosen.y < old.y + old.height && chosen.y + chosen.height > old.y)) break;
    }
    occupied.push(chosen);
    return label;
  };
  return { svg, width, height, line, arrow, label };
}
function drawPlanes(model) {
  const i = state.pair, u = column(model.U, i), uh = column(model.Uhat, i), projected = column(model.projection, i);
  const view = scene(get('planes'), `Two planes with principal angles 0 and ${state.phi} degrees. Pair ${i + 1} is highlighted. Its projection has length ${format(model.cosines[i])}.`);
  const {svg, width, height, line, arrow, label} = view;
  const right = [.819152, -.573576, 0], up = [.242404, .346189, .906308];
  const size = Math.min((width - 72) / 3.3, (height - 60) / 2.6);
  const project = vector => [width * .50 + size * dot(vector, right), height * .52 - size * dot(vector, up)];
  const origin = project([0, 0, 0]);
  const e1 = [1, 0, 0], e2 = [0, 1, 0], e3 = [0, 0, 1], h = column(model.H, 1);
  for (const [second, color] of [[e2, colors.blue], [h, colors.orange]]) {
    const corners = [[-1.25,-1.05],[1.25,-1.05],[1.25,1.05],[-1.25,1.05]].map(([a,b]) => project(add(scale(e1,a),scale(second,b))));
    svg.append(element('polygon', {points: corners.map(p=>p.join(',')).join(' '), fill:color, 'fill-opacity':'.09', stroke:color, 'stroke-opacity':'.35', 'stroke-width':'1'}));
    for (const k of [-.5, .5]) {
      line(project(add(scale(e1,-1.25),scale(second,k))),project(add(scale(e1,1.25),scale(second,k))),colors.border);
      line(project(add(scale(e1,k),scale(second,-1.05))),project(add(scale(e1,k),scale(second,1.05))),colors.border);
    }
  }
  line(project(scale(e1,-1.32)),project(scale(e1,1.4)),colors.muted,1.5);
  for (const [axis, name] of [[e1,'e₁'],[e2,'e₂'],[e3,'e₃']]) {
    arrow(origin,project(scale(axis,1.42)),colors.muted,1);
    label(project(scale(axis,1.42)),name);
  }
  for (const [basis, rotation, color, hat] of [[model.V,state.alpha,colors.blue,false],[model.Vhat,state.beta,colors.orange,true]]) {
    if (Math.abs(rotation) < .01) continue;
    for (let j=0; j<2; j++) {
      const end = project(column(basis,j)); arrow(origin,end,color,1,true);
      label(end,(hat?'v̂':'v')+sub(j));
    }
  }
  const bothSame = i === 0 || state.phi === 0;
  if (bothSame) {
    arrow(origin, project(u), colors.orange, 6);
    arrow(origin, project(u), colors.blue, 2.5);
    label(project(u), `u${sub(i)} = û${sub(i)}`);
  } else {
    arrow(origin,project(u),colors.blue,3);
    arrow(origin,project(uh),colors.orange,3);
    label(project(u),'u'+sub(i)); label(project(uh),'û'+sub(i));
    line(project(uh),project(projected),colors.muted,1,true);
  }
  line(origin,project(projected),colors.projection,3,true);
  const end = project(projected);
  svg.append(element('rect',{x:end[0]-3,y:end[1]-3,width:6,height:6,fill:colors.projection}));
  if (!bothSame) label(end,model.cosines[i]===0?'Pû₂ = 0':'Pû'+sub(i),{offsets:[[10,24],[-10,24],[0,38],[10,-12]]});
}
function drawCrossSection(model) {
  const i = state.pair, cosine = model.cosines[i], theta = model.angles[i], sine = Math.sin(theta*Math.PI/180);
  const view = scene(get('cross-section'), `Pair ${i+1}: angle ${theta} degrees; unit orange vector projects to ${format(cosine)} times the blue unit vector.`);
  const {svg,width,height,line,arrow,label} = view;
  const unit = Math.min(width-95,height-75)/1.28, ox = 44, oy = height-40;
  const point = (x,y) => [ox+x*unit,oy-y*unit], origin = point(0,0);
  arrow(point(-.09,0),point(1.2,0),colors.muted,1);
  arrow(point(0,-.05),point(0,1.19),colors.muted,1);
  label(point(1.2,0),i===0?'e₁':'e₂',{offsets:[[-6,25]]});
  label(point(0,1.19),'e₃',{offsets:[[-13,-5]]});
  const arc = Array.from({length:46},(_,j)=>point(Math.cos(j*Math.PI/90),Math.sin(j*Math.PI/90)));
  svg.append(element('path',{d:arc.map((p,j)=>(j?'L':'M')+p.join(',')).join(''),fill:'none',stroke:colors.border,'stroke-width':1}));
  const u = point(1,0), uh = point(cosine,sine), projected=point(cosine,0);
  arrow(origin,u,colors.blue,3);
  if (theta===0) {
    arrow(origin,uh,colors.orange,6); arrow(origin,u,colors.blue,2.5);
    label(u,`u${sub(i)} = û${sub(i)}`,{offsets:[[-4,-18]]});
  } else {
    arrow(origin,uh,colors.orange,3);
    label(u,'u'+sub(i),{offsets:[[0,-15],[-6,24]]});
    label(uh,'û'+sub(i));
    line(uh,projected,colors.muted,1.2,true);
    if (cosine>.08 && sine>.08) {
      const side = Math.min(12,unit*cosine*.25,unit*sine*.25);
      svg.append(element('path',{d:`M${projected[0]-side},${projected[1]}v-${side}h${side}v${side}`,fill:'none',stroke:colors.muted,'stroke-width':1}));
    }
    const angleArc = Array.from({length:33},(_,j)=>point(.3*Math.cos(j/32*theta*Math.PI/180),.3*Math.sin(j/32*theta*Math.PI/180)));
    svg.append(element('path',{d:angleArc.map((p,j)=>(j?'L':'M')+p.join(',')).join(''),fill:'none',stroke:colors.muted,'stroke-width':1.5}));
  }
  line(origin,projected,colors.projection,4,true);
  svg.append(element('rect',{x:projected[0]-3,y:projected[1]-3,width:6,height:6,fill:colors.projection}));
  label(projected,cosine===0?'Pû₂ = 0':'Pû'+sub(i),{offsets:[[0,25],[-10,25],[10,25]]});
  label(point(.45*Math.cos(theta*Math.PI/360),.45*Math.sin(theta*Math.PI/360)),`θ${sub(i)} = ${theta}°`,{offsets:[[4,-12],[0,-24],[10,18]]});
  label(origin,'0',{offsets:[[-14,20]]});
}
function matrix(id, name, value) {
  get(id).replaceChildren(...value.flat().map(number => {
    const span = document.createElement('span'); span.textContent = format(number); return span;
  }));
  get(id).setAttribute('aria-label', `${name}: first row ${value[0].map(format).join(', ')}; second row ${value[1].map(format).join(', ')}`);
}
function combination(name, coefficients, base) {
  return `${name} = ${format(coefficients[0])} ${base}₁ ${coefficients[1]<-.0005?'−':'+'} ${format(Math.abs(coefficients[1]))} ${base}₂`;
}
function render() {
  const model = principalModel(state.phi,state.alpha,state.beta), i = state.pair;
  get('phi-value').value = state.phi+'°'; get('alpha-value').value = state.alpha+'°'; get('beta-value').value = state.beta+'°';
  get('pair-number').textContent = i+1;
  get('theta-two').value = state.phi+'°';
  get('plane-note').textContent = state.phi===0 ? 'The planes coincide; e₁ is one shared direction.' : 'The planes meet along e₁.';
  get('section-title').textContent = `Pair ${i+1} · cross-section`;
  get('section-note').textContent = i===0 ? 'Both vectors lie on e₁; their angle is zero.' : 'The e₂–e₃ plane shows the actual angle.';
  get('projection-identity').textContent = `Pû${sub(i)} = ${format(model.cosines[i])} u${sub(i)}`;
  get('projection-length').textContent = `Projection length = ${format(model.cosines[i])}`;
  get('pair-note').textContent = i===0 ? 'The first pair follows the shared line: u₁ = û₁ = e₁, so its angle is zero.' : 'The second pair is perpendicular to e₁ within each plane. Its angle is φ.';
  get('u-combination').value = combination('u'+sub(i),column(model.R,i),'v');
  get('uhat-combination').value = combination('û'+sub(i),column(model.L,i),'v̂');
  matrix('matrix-m','M',model.M); matrix('matrix-l','L',model.L); matrix('matrix-s','Sigma',model.Sigma); matrix('matrix-rt','R transpose',transpose(model.R));
  get('basis-note').textContent = state.alpha===0 && state.beta===0 ? 'At α = β = 0°, the input columns already form principal-vector pairs.' : 'Changing either basis changes the coordinates and SVD factors, but leaves the planes, principal angles, and displayed principal vectors unchanged.';
  get('edge-note').textContent = state.phi===0 ? 'At φ = 0°, the planes coincide and both angles are zero. The principal vectors are not unique; this display keeps e₁ and e₂ as one valid choice.' : state.phi===90 ? 'At φ = 90°, the second projection is zero. The planes still share e₁, so their first principal angle remains zero.' : 'Principal vectors are unit vectors. Their projections can be shorter.';
  drawPlanes(model); drawCrossSection(model);
}
for (const [id,key] of [['plane-angle','phi'],['basis-alpha','alpha'],['basis-beta','beta']]) {
  get(id).addEventListener('input',event=>{state[key]=Number(event.target.value);render();});
  get(id).addEventListener('change',()=>{get('announcement').textContent=`Principal angles: 0 and ${state.phi} degrees. Projection length for pair ${state.pair+1}: ${format(principalModel(state.phi).cosines[state.pair])}.`;});
}
root.querySelectorAll('input[name="pair"]').forEach(input=>input.addEventListener('change',event=>{state.pair=Number(event.target.value);render();get('announcement').textContent=get('pair-note').textContent;}));
new ResizeObserver(render).observe(root.querySelector('.diagrams'));
render();
