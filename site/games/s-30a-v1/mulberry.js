'use strict';
function leafTexture(under){
 return texture(256,448,(c,w,h)=>{
 const rnd=random(under?871:692),grad=c.createLinearGradient(0,0,w,h);
 grad.addColorStop(0,under?'#acc571':'#426e37');grad.addColorStop(.48,under?'#92b55b':'#527d39');grad.addColorStop(.51,under?'#acc86c':'#67913e');grad.addColorStop(1,under?'#84a95a':'#365f33');c.fillStyle=grad;c.fillRect(0,0,w,h);
 const img=c.getImageData(0,0,w,h);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=4*(y*w+x),n=(rnd()-.5)*14+2.6*Math.sin(x*.08+Math.sin(y*.08))+2*Math.cos(y*.11-x*.04);img.data[i]+=n;img.data[i+1]+=n;img.data[i+2]+=n*.77}c.putImageData(img,0,0);
 const cx=w*.5;
 for(const side of [-1,1]){
 for(let j=0;j<9;j++){const t=j*.105+.03,by=h*(1-t),delta=(j===0?.31:.16)*(1-.52*t)*h,ex=cx+side*w*.53;
 c.beginPath();c.moveTo(cx,by);c.bezierCurveTo(cx+side*w*.085,by-delta*.10,cx+side*w*.36,by-delta*.98,ex,by-delta);
 c.strokeStyle=under?'rgba(208,222,151,.88)':'rgba(180,202,116,.65)';c.lineWidth=under?2.3:1.65;c.stroke();
 for(let k=1;k<7;k++){const u=k/7,x=cx+side*u*w*.51,y=by-delta*(3*u*u-2*u*u*u);
 c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x+side*w*.025,y-h*.032,x+side*w*.095,y-h*.063);c.strokeStyle=under?'rgba(206,222,146,.5)':'rgba(170,191,115,.36)';c.lineWidth=.95;c.stroke();
 c.beginPath();c.moveTo(x,y-2);c.lineTo(x+side*17,y+10);c.strokeStyle='rgba(162,187,111,.28)';c.stroke()}
 }}
 c.beginPath();c.moveTo(cx-2.8,h);c.quadraticCurveTo(cx-1,h*.4,cx,0);c.quadraticCurveTo(cx+1,h*.25,cx+3,h);c.closePath();c.fillStyle=under?'#d5d99b':'#b4be72';c.fill()
 })
}
const topMap=leafTexture(false),backMap=leafTexture(true);
const topLeaf=mat(0xedf3d3,{map:topMap,bumpMap:topMap,bumpScale:.0022,vertexColors:true,roughness:.47}),
 backLeaf=mat(0xfff5d8,{map:backMap,bumpMap:backMap,bumpScale:.0035,side:T.BackSide,vertexColors:true,roughness:.69});
const barkTex=texture(256,512,(c,w,h)=>{
 const rnd=random(410);c.fillStyle='#897b69';c.fillRect(0,0,w,h);
 for(let i=0;i<12000;i++){const x=rnd()*w,y=rnd()*h;c.strokeStyle=rnd()<.5?'rgba(232,218,190,.19)':'rgba(53,48,39,.19)';c.lineWidth=rnd()*1.7+.4;c.beginPath();c.moveTo(x,y);c.lineTo(x+rnd()*5,y+1+rnd()*10);c.stroke()}
 for(let i=0;i<1050;i++){const x=rnd()*w,y=rnd()*h,l=2+rnd()*20;c.fillStyle='rgba(61,51,43,.58)';c.fillRect(x,y,l,.7+rnd());c.fillStyle='rgba(213,198,167,.62)';c.fillRect(x+1,y+1.4,l*.85,.9)}
},true);
const bark=mat(0xf3dab6,{map:barkTex,bumpMap:barkTex,bumpScale:.011}),petiole=mat(0x96a45c),stubMat=mat(0xc0ad79);
const crossMap=texture(128,128,(c,w,h)=>{c.fillStyle='#d5af7e';c.fillRect(0,0,w,h);for(let i=1;i<17;i++){c.strokeStyle=i%2?'#c29767':'#ddbb8d';c.lineWidth=i%2?1.5:2;c.beginPath();c.ellipse(61,67,i*5,i*4.65,.28,0,TAU);c.stroke()}});
const cutMat=mat(0xffe3b0,{map:crossMap,roughness:.94});
function leafForm(t,v,leaf,withFrame=true){
 const tooth=1-.046*((Math.round(t*38)%2)===0?1:0);
 const width=leaf.width*.5*Math.pow(Math.max(.00002,Math.sin(t*PI)),.76)*(1.30-.56*t)*tooth;
 const crease=leaf.fold,foldAt=.61+leaf.variation*.035,h=Math.max(0,t-foldAt);
 const curl=crease*3.42+leaf.pressure*1.2;
 const len=leaf.length;
 let x=width*v*(1-.21*leaf.pressure)+.02*Math.sin(t*PI)*leaf.variation;
 let z=len*(Math.min(t,foldAt)+Math.cos(curl)*h);
 let y=len*(.095*Math.sin(PI*t)-.093*t*t+Math.sin(curl)*h);
 z-=len*.109*Math.pow(Math.abs(v),1.4)*Math.exp(-Math.pow((t-.14)/.16,2));
 y+=width*(v*v*(.14+.76*leaf.pressure)-Math.abs(v)*.13)+.009*Math.sin(7*t+leaf.variation)*v;
 y+=.003*Math.sin(t*53-Math.abs(v)*6)*Math.sin(t*PI)*Math.abs(v);
 const a=leaf.pressure*.25*t;x+=a*.05;
 return V(x,y,z).addScaledVector(leaf.bendDir,withFrame?leaf.bend*t*t*.31:0)
}
function buildLeaf(p,l){
 const g=new T.BufferGeometry(),rows=38,cols=10,vtx=new Float32Array((rows+1)*(cols+1)*3),uv=[],idx=[];
 for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){uv.push(i/cols,j/rows);const k=j*(cols+1)+i;if(i<cols&&j<rows)idx.push(k,k+cols+1,k+1,k+1,k+cols+1,k+cols+2)}
 const color=new Float32Array(vtx.length);
 g.setAttribute('color',new T.BufferAttribute(color,3));g.setAttribute('position',new T.BufferAttribute(vtx,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);
 l.blade=group(p);mesh(l.blade,g,topLeaf);mesh(l.blade,g,backLeaf);
 l.shape=()=>{for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
  const k=3*(j*(cols+1)+i),t=j/rows;
  leafForm(t,i/cols*2-1,l).toArray(vtx,k);
  const shadow=1-.36*l.fold*Math.exp(-Math.pow((t-.61-l.variation*.035)/.026,2));color[k]=color[k+1]=color[k+2]=shadow
 }g.attributes.color.needsUpdate=true;g.attributes.position.needsUpdate=true;g.computeVertexNormals();g.computeBoundingSphere()};
 l.shape()
}
const recordKey='mulberry.noon.deck.3';
function restored(){
 try{const r=JSON.parse(localStorage.getItem(recordKey)||'null');return r&&r.version===3&&Number.isFinite(r.seed)?r:null}catch{return null}
}
const remembered=restored();
const bstate={seed:remembered?.seed??Math.floor(Math.random()*1e7),port:0,slide:0,roll:0,height:0,yaw:0,park:0,opened:false,lastPort:0,lastFork:0,loyalty:0,history:[],...remembered};
const branch=group(),leaves=[];let limbs=[],handle,cut,knots=[];
let rollNow=bstate.roll,spread=bstate.opened?1:0,load=0,flex=0,flexVel=0,flutter=0,rootX=Number.isFinite(bstate.restX)?bstate.restX:ports[bstate.port]+.49;
let shownHeight=bstate.height,parkNow=bstate.park,restPitch=0;
let bank=0,bankTarget=0,gatePressure=0;
const layouts=[
 [.28,0,-1,.41,.30],[.50,0,1,.46,.34],[.74,0,-1,.43,.34],[.92,0,1,.43,.32],
 [1.14,-1,-1,.38,.295],[1.31,-1,1,.37,.29],[1.52,-1,-1,.40,.32],[1.72,-1,1,.37,.29],[1.90,-1,-1,.34,.27],
 [1.19,1,1,.39,.29],[1.45,1,-1,.30,.225],[1.62,1,1,.41,.32],[1.81,1,-1,.32,.255]
];
function stemPos(u,side){
 const t=u/1.92,f=Math.max(0,(u-1.02)/.90),mass=side?leaves.filter(l=>!l.eaten&&l.fork===side).length/5:.75;
 return V(.038*Math.sin(u*3.8)+side*.245*Math.pow(f,1.12)+.039*flex*t*t,
 .018+.151*t+.043*Math.sin(PI*t)+.055*f-side*.022*f-.062*mass*f*f+.18*flex*t*t,
 -u*.85-.098*mass*f*f-.10*flex*t*t+.025*Math.sin(u*2.6))
}
function stemRadius(u,s){return s?mix(.025,.006,clamp((u-1.02)/.92)):mix(.056,.027,u/1.02)}
function limbStations(a,b,s){const pts=[];for(let i=0;i<8;i++){const u=mix(a,b,i/7),pt=stemPos(u,s),r=stemRadius(u,s);pts.push([pt.x,pt.y,pt.z,r,r*.96])}return pts}
function releaseTreeResources(){const geos=new Set();branch.traverse(o=>{if(o.geometry&&o.geometry!==sphereGeo)geos.add(o.geometry)});geos.forEach(g=>g.dispose());branch.clear()}
function growBranch(saved){
 releaseTreeResources();leaves.length=0;limbs=[];knots=[];
 const rnd=random(bstate.seed);
 for(let i=0;i<layouts.length;i++){
 const [u,fork,side,length,width]=layouts[i],variation=rnd()*2-1;
 const l={id:i,u:u+variation*.035,fork,side,length:length*(.94+rnd()*.12),width:width*(.93+rnd()*.14),variation,bend:0,bendSpeed:0,bendDir:V(0,0,1),
  tipYaw:(side>0?1:-1)*(.79+rnd()*.57),baseTilt:(rnd()-.5)*.82+(i===4||i===7||i===11?2.28:0),eaten:!!saved?.[i]?.eaten,
  folded:saved?.[i]?.folded??(i===10?.44:0),fold:0,pressure:0,shake:0};
 l.fold=l.folded;leaves.push(l);
 l.node=group(branch);l.joint=group(l.node);
 l.stalk=rod(l.joint,V(),V(0,.025,.073),.009,.0058,petiole,11);
 l.short=rod(l.joint,V(),V(0,.014,.037),.009,.0046,stubMat,11);
 buildLeaf(l.joint,l);l.blade.position.set(0,.025,.073);l.short.visible=l.eaten;l.stalk.visible=l.blade.visible=!l.eaten;
 }
 for(const [a,b,s] of [[0,1.05,0],[1.02,1.96,-1],[1.02,1.87,1]])limbs.push({a,b,s,mesh:loft(branch,limbStations(a,b,s),bark,22,22)});
 cut=mesh(branch,new T.CircleGeometry(.054,40),cutMat);cut.position.set(0,.018,.0018);
 for(let i=0;i<10;i++){const u=.08+i*.094,p=stemPos(u,0),r=stemRadius(u,0);const knot=oval(branch,V(p.x+r*.80,p.y+r*.31,p.z),V(.011,.012,.024),bark);knot.rotation.x=.38;knots.push(knot)}
 handle=group(branch);handle.position.copy(stemPos(.13,0));
}
growBranch(remembered?.leaves);
function saveBranch(){
 const data={...bstate,version:3,restX:rootX,leaves:leaves.map(l=>({eaten:l.eaten,folded:l.folded}))};
 try{localStorage.setItem(recordKey,JSON.stringify(data))}catch{}
}
function branchRoot(depth=bstate.slide){
 const low=V(rootX+.052*Math.sin(rollNow)+gatePressure*.025-.24*depth,shelfY+.059,1.99-depth);
 const climb=rampLow.clone().lerp(rampHigh,shownHeight);climb.y+=.131;climb.z+=.32;
 if(bstate.height>0||bstate.onRamp){if(shownHeight<.998)return climb;
 const angle=.04+bstate.yaw*.73,lever=1.116-depth*.69;
 return V(highX+Math.sin(angle)*lever+parkNow*.51,highY+.155,-.324+Math.cos(angle)*lever+parkNow*.09)}
 return low
}
let lastFlex=999,lastLimbTime=0;
function animateBranch(dt,time,active,chosen,pressure){
 shownHeight=damp(shownHeight,bstate.height,15,dt);parkNow=damp(parkNow,bstate.park,7,dt);
 spread=damp(spread,bstate.opened?1:0,5.2,dt);rollNow=damp(rollNow,bstate.roll,9,dt);
 const alive=leaves.filter(l=>!l.eaten);const moment=alive.reduce((n,l)=>n+l.side*(l.width+.1)*l.u,0);
 bankTarget=clamp(-moment*.065*Math.cos(rollNow),-.27,.27);bank=damp(bank,active?0:bankTarget,2.6,dt);
 let supportPitch=0;
 if(!active&&bstate.height<.01&&bstate.slide>.18){
  const distance=1.99-bstate.slide,u=clamp(distance/.83,0,1.94),pt=stemPos(u,u>1.02?-1:0);
  const axisY=shelfY+.059+pt.x*Math.sin(rollNow+bank)+pt.y*Math.cos(rollNow+bank);
  supportPitch=clamp((gateY+.02+stemRadius(u,u>1.02?-1:0)-axisY)/distance,-.19,.14)
 }
 restPitch=damp(restPitch,supportPitch,5,dt);
 const force=chosen?pressure*(.12+.85*Math.pow(chosen.u/1.93,2)):0;
 const spring=58/(.76+alive.length*.022);flexVel+=(spring*(force-flex)-flexVel*4.15)*dt;flex+=flexVel*dt;flutter=damp(flutter,0,3.5,dt);
 branch.position.copy(branchRoot());branch.rotation.order='YXZ';
 branch.rotation.y=mix(.249+gatePressure*.039,.04+bstate.yaw*.73,shownHeight)-parkNow*.29;
 branch.rotation.x=mix(.009,.133+.14*Math.abs(Math.sin(rollNow)),shownHeight)+.058*Math.sin(PI*shownHeight)+restPitch;
 branch.rotation.z=rollNow+bank+.06*Math.sin(spread*PI);
 if(time-lastLimbTime>.033&&(Math.abs(flex-lastFlex)>.001||load!==alive.length)){for(const k of limbs)k.mesh.reshape(limbStations(k.a,k.b,k.s));lastFlex=flex;lastLimbTime=time;load=alive.length}
 for(const l of leaves){
 const sway=Math.sin(time*2.45+l.u*3)*(.011+.052*flutter)+Math.sin(time*20+l.id)*l.shake;
 l.shake=damp(l.shake,0,3.2,dt);l.node.position.copy(stemPos(l.u,l.fork));
 // Opening the cluster changes the light gaps between the actual blades.
 const yaw=l.tipYaw*mix(.39,1,spread)+(l.fork||0)*.18;const tilt=l.baseTilt*mix(.64,1,spread);
 l.joint.rotation.order='YXZ';l.joint.rotation.y=PI-yaw;l.joint.rotation.x=-.23-.12*l.variation+sway;
 l.joint.rotation.z=tilt+.13*Math.sin(l.u*5)*spread;
 const squeeze=l===carriedLeaf?.96:l===chosen?pressure:0;
 l.stalk.scale.y=1+squeeze*.43;l.stalk.scale.x=l.stalk.scale.z=1-squeeze*.21;
 l.stalk.position.set(0,.0125*(1+squeeze*.43),.0365*(1+squeeze*.43));
 l.blade.position.set(0,.025*(1+squeeze*.43),.073*(1+squeeze*.43));const newP=damp(l.pressure,squeeze,8,dt),newF=damp(l.fold,Math.max(l.folded,squeeze*.81),8,dt);
 if(Math.abs(newP-l.pressure)+Math.abs(newF-l.fold)>.0007){l.pressure=newP;l.fold=newF;l.shape()}
 l.blade.visible=!l.eaten&&l!==carriedLeaf;l.stalk.visible=!l.eaten;l.short.visible=l.eaten;
 }
 branch.updateWorldMatrix(true,true);
 // Blades meeting the shelf flex upwards about their own petioles.
 for(const l of alive){
 const base=l.joint.getWorldPosition(V()),tip=bladePoint(l,.98);
 let contact=false;
 if(shownHeight<.01&&Math.abs(base.z)<l.length+.20){
  for(const [t,v] of [[.98,0],[.54,-1],[.54,1]]){
   const p=l.blade.localToWorld(leafForm(t,v,l,false)),dz=p.z-base.z;
   const k=Math.abs(dz)<.0001?0:clamp((.015-base.z)/dz);
   const at=base.clone().lerp(p,k);
   if(at.z<-.106||at.z>.066)continue;
   const x=Math.abs(at.x-ports[bstate.port]),y=Math.abs(at.y-(gateY+.274));
   const rounded=Math.hypot(Math.max(0,x-.398),Math.max(0,y-.156));
   if(rounded>.095){contact=true;break}
  }
 }
 const previous=l.bend;l.bendSpeed+=((Number(contact)-l.bend)*92-l.bendSpeed*9.4)*dt;l.bend=clamp(l.bend+l.bendSpeed*dt,-.13,1);
 if(Math.abs(previous-l.bend)>.0004||contact){l.bendDir.copy(V(0,.18,1)).applyQuaternion(l.blade.getWorldQuaternion(new T.Quaternion()).invert());l.shape()}
 const upper=shownHeight>.997&&tip.z>-.70&&Math.abs(tip.x-highX)<.48;
 // Petioles that still span the lower lip remain supported on the animal side.
 const spansLip=shownHeight<.01&&tip.z>-.59&&base.z>-.37;
 if(!upper&&(!spansLip||bstate.height>.01))continue;
 const floor=upper?highY+.101:(tip.z<.055?gateY+.015:shelfY+.011),p1=bladePoint(l,.58,-.93),p2=bladePoint(l,.58,.93),low=Math.min(p1.y,p2.y,tip.y);
 if(low>=floor)continue;
 const axis=tip.clone().sub(base).normalize(),raised=axis.clone();raised.y+=(floor-low)/(l.length*.68);raised.normalize();
 const pivot=l.node.getWorldQuaternion(new T.Quaternion()),inv=pivot.clone().invert();
 const q=new T.Quaternion().setFromUnitVectors(axis,raised);l.joint.quaternion.premultiply(inv.multiply(q).multiply(pivot));l.joint.updateWorldMatrix(true,true)
 }
}
function bladePoint(l,t=.56,v=0){return l.blade.localToWorld(leafForm(t,v,l))}
