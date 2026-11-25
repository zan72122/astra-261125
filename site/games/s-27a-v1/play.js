'use strict';
const paddle=group(),paddlePivot=group(paddle);
function paddleSection(rows,material){
 let p=[],idx=[],uv=[],N=32;
 for(let j=0;j<rows.length;j++){let [z,w,h,y]=rows[j];for(let i=0;i<=N;i++){let a=i/N*tau;p.push(w*Math.cos(a),y+h*Math.sin(a),z);uv.push(i/N,j/(rows.length-1));
 if(i&&j){let b=j*(N+1)+i;idx.push(b-N-2,b-N-1,b,b-N-2,b,b-1)}}}
 const o=mesh(geo(p,idx,null,uv),material,paddlePivot);o.castShadow=true;o.receiveShadow=true;return o;
}
let wetWood=grainMaterial(0x9b6337,'wood'),dryWood=grainMaterial(0xddad70,'wood'),rimWood=grainMaterial(0xbe844c,'wood');
const blade=paddleSection([[-.49,.001,.002,0],[-.48,.078,.012,0],[-.45,.148,.020,.001],[-.4,.17,.026,.002],[-.28,.178,.027,.003],[-.15,.166,.026,.006],[-.06,.142,.027,.011],[.016,.095,.029,.018],[.06,.066,.03,.023]],wetWood);
paddleSection([[.059,.066,.030,.023],[.082,.055,.032,.024],[.12,.05,.034,.027],[.165,.047,.037,.028]],rimWood);
paddleSection([[.164,.047,.037,.028],[.23,.044,.039,.031],[.40,.045,.041,.037],[.58,.053,.045,.043],[.694,.062,.049,.050],[.758,.060,.047,.053],[.792,.042,.036,.056],[.805,.001,.002,.055]],dryWood);
paddle.position.set(.46,.028,1.22);paddle.rotation.y=.83;
const paddleHome=paddle.position.clone(),paddleGoal=paddle.position.clone();
const paddleTip=()=>paddle.localToWorld(v(0,.011,-.32));
const foodMat=std(0xc88b4c,.87),grainGeo=new T.DodecahedronGeometry(1,1);
let foodPos=grainGeo.attributes.position;
for(let i=0;i<foodPos.count;i++){let x=foodPos.getX(i),y=foodPos.getY(i),z=foodPos.getZ(i);let k=.99+.06*Math.sin(x*12+z*8)*Math.cos(y*11);foodPos.setXYZ(i,x*k,y*k,z*k)}
grainGeo.computeVertexNormals();
foodMat.onBeforeCompile=s=>{s.vertexShader='varying vec3 grainP;\n'+s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ngrainP=position;');s.fragmentShader='varying vec3 grainP;\n'+shaderNoise+s.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb*=.77+.26*pondNoise(grainP.xy*11.)+.15*pondNoise(grainP.yz*27.);')};
const trays=[],foods=[],leaves=[];
function tray(stone,far){
 const pile=group(stone),grains=[];
 for(let i=0;i<73;i++){
 let a=i*2.399963,d=Math.sqrt((i+.7)/73)*.53,x=Math.cos(a)*d,z=Math.sin(a)*d;
 const y=.50+(.53-d)*.61+range(0,.12),local=v(x,y,z);
 grains.push({local,used:false,ready:0,ang:range(0,tau),size:range(.031,.041),tone:col([0xb8793f,0xc49253,0xc6985e,0xb48b55,0xdab17a][i%5])})}
 let batch=new T.InstancedMesh(grainGeo,foodMat,grains.length);batch.castShadow=true;batch.receiveShadow=true;pile.add(batch);
 const o={stone,grains,batch,far};trays.push(o);refreshTray(o);
}
function refreshTray(tr){tr.grains.forEach((g,i)=>{dummy.position.copy(g.local);dummy.rotation.set(.15,g.ang,.4);let s=g.used?0:g.size;
 dummy.scale.set(s*1.14/tr.stone.scale.x,s*.86/tr.stone.scale.y,s/tr.stone.scale.z);dummy.updateMatrix();tr.batch.setMatrixAt(i,dummy.matrix);tr.batch.setColorAt(i,g.tone)});
 tr.batch.instanceMatrix.needsUpdate=true;tr.batch.instanceColor.needsUpdate=true;tr.batch.computeBoundingSphere()}
tray(mainStone,false);tray(farStone,true);
const foodMeshes=group(),dampFood=foodMat.clone(),soakedFood=foodMat.clone();
dampFood.color.setHex(0xb17a43);soakedFood.color.setHex(0xa87842);
dampFood.roughness=.63;soakedFood.roughness=.54;
function addFood(x,z,drop=null,scatter=0){
 const o=mesh(grainGeo,foodMat,foodMeshes),sz=range(.031,.044);
 o.scale.set(sz*1.18,sz*.91,sz);o.rotation.set(range(0,1),range(0,6),range(0,2));o.castShadow=true;
 const f={o,x,z,vx:scatter*range(-1,1),vz:scatter*range(-1,1),wet:0,flowX:0,flowZ:0,bob:range(0,6),drop,spent:false,corner:false,armed:false};
 o.position.set(x,.022,z);if(drop)o.position.copy(drop.start);foods.push(f);return f
}
addFood(.10,.72);addFood(.30,.64);addFood(.47,.83);addFood(-.11,.82);
const leafGroup=group(),padPalette=[0x81924c,0x899b5d,0x78975d,0x93a45a,0x9fa85c],leafVein=std(0xaaaa68,.80);
const dewMat=std(0xcde1d6,.12,{metalness:.31,transparent:true,opacity:.88});
const leafShapes=[];
function leafGeom(pad){
 let p=[],idx=[],colors=[];const N=pad?40:26,R=5;
 for(let j=0;j<=R;j++){let r=j/R;for(let i=0;i<=N;i++){
 let a=pad?mix(.12,tau-.15,i/N):tau*i/N, edge=1+.035*Math.sin(5*a)+.025*Math.cos(9*a);
 let x=r*Math.cos(a)*edge,z=r*Math.sin(a)*edge*(pad?.83:.39)*(pad?1:.77+.25*Math.sin(a)**2);
 let y=.012*Math.sin(Math.PI*r)+.036*r*r*(.5+.5*Math.sin(3*a))+(pad?0:.075*(1-Math.abs(Math.sin(a)))*r);
 p.push(x,y,z);let shade=.72+.24*r+.06*Math.cos(a)+.025*Math.sin(11*a);colors.push(shade,shade,shade);
 if(j&&i){let b=j*(N+1)+i;idx.push(b-N-2,b-N-1,b,b-N-2,b,b-1)}}}
 return geo(p,idx,colors)}
leafShapes.push(leafGeom(true),leafGeom(false));
const padMaterials=padPalette.map(c=>std(c,.55,{vertexColors:true,side:T.DoubleSide})),longLeafMaterial=std(0xba9c51,.62,{vertexColors:true,side:T.DoubleSide});
function addLeaf(x,z,r,pad,dew=false){
 let root=group(leafGroup);root.position.set(x,.018,z);root.rotation.y=range(0,tau);
 let blade=mesh(leafShapes[pad?0:1],pad?padMaterials[Math.floor(ran()*5)]:longLeafMaterial,root);blade.scale.setScalar(r);
 if(pad){
  // Veins fan out from the cleft; fine ridges on the surface follow the lobes.
  for(let j=1;j<=7;j++){let a=tau*j/8;
  tube(root,[v(.07*r,.007,0),v(Math.cos(a)*r*.43,.007,Math.sin(a)*r*.34),v(Math.cos(a)*r*.89,.006,Math.sin(a)*r*.72)],.0017,leafVein,5)}
 }else tube(root,[v(-r*.83,.006,0),v(0,.007,0),v(r*.9,.008,0)],.0017,leafVein,5);
 let bead=null;if(dew){bead=ell(root,dewMat,-r*.32,.026,r*.25,.020,.016,.020);bead.renderOrder=5}
 leaves.push({o:root,x,z,r,bead,vx:0,vz:0,bob:range(0,6),tilt:0,roll:0,side:1});
}
[[-1.45,.49,.235],[-1.20,.81,.161],[-1.68,1.04,.195],[.98,.02,.187],[1.36,.15,.232],[1.54,-.14,.118],[.81,-1.01,.13],[-1.67,-.95,.2],[-2.17,-.9,.15],[2.12,-4.21,.25],[1.81,-4.11,.18],[2.38,-4.09,.153]].forEach(([x,z,r],i)=>addLeaf(x+range(-.065,.065),z+range(-.06,.06),r,true,i===9||ran()<.44));
addLeaf(.48,.34,.12,false);
for(let i=0;i<23;i++){let x=range(-3.9,4.5),z=range(-6.4,-1.9);if(Math.hypot(x-island.x,z-island.z)>1.12)addLeaf(x,z,range(.085,.19),ran()<.49,ran()<.33)}
const flows=[],drops=[],dropPool=[];
function splash(x,z,amount=6,power=1,fromY=.015){
 for(let i=0;i<amount;i++){
 let o=dropPool.pop();if(!o){o=mesh(ballGeo,dewMat);o.renderOrder=5}o.visible=true;
 let a=range(0,tau),r=range(.07,.38)*power,sz=range(.007,.018)*power;
 o.position.set(x,fromY,z);o.scale.set(sz,sz*1.32,sz);
 drops.push({o,vx:r*Math.cos(a),vz:r*Math.sin(a),vy:range(.40,1.16)*power,sz})}}
let audio=null,audioMaster,waterNoise,bankEcho=[];let lastSound=-10;
function wakeSound(){
 try{if(!audio){audio=new (window.AudioContext||window.webkitAudioContext)();audioMaster=audio.createGain();audioMaster.gain.value=.20;audioMaster.connect(audio.destination);
 waterNoise=audio.createBuffer(1,audio.sampleRate*.6,audio.sampleRate);let d=waterNoise.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1}
 if(audio.state==='suspended')audio.resume().catch(()=>{})}catch{}}
function plip(freq,volume=.17,dur=.12,delay=0){
 if(!audio||audio.state==='closed')return;let now=audio.currentTime+delay,o=audio.createOscillator(),g=audio.createGain();o.type='sine';o.frequency.setValueAtTime(freq*.82,now);o.frequency.exponentialRampToValueAtTime(freq*1.48,now+dur*.30);o.frequency.exponentialRampToValueAtTime(freq*.69,now+dur);
 g.gain.setValueAtTime(.0001,now);g.gain.exponentialRampToValueAtTime(volume,now+.007);g.gain.exponentialRampToValueAtTime(.0001,now+dur);o.connect(g).connect(audioMaster);o.start(now);o.stop(now+dur+.01)}
function hush(freq,volume=.09,dur=.18){
 if(!audio||audio.state==='closed')return;let now=audio.currentTime,src=audio.createBufferSource(),filter=audio.createBiquadFilter(),g=audio.createGain();src.buffer=waterNoise;filter.type='bandpass';filter.frequency.value=freq;filter.Q.value=.74;g.gain.setValueAtTime(.0001,now);g.gain.exponentialRampToValueAtTime(volume,now+.026);g.gain.exponentialRampToValueAtTime(.0001,now+dur);src.connect(filter).connect(g).connect(audioMaster);src.start(now);src.stop(now+dur)}
function pushFlow(x,z,dx,dz,strength,radius,life=.85,kind='blade'){flows.push({x,z,dx,dz,strength,radius,life,age:0,kind});if(flows.length>95)flows.shift()}
let lastTouch=0,started=false,startTime=0,lastFeed=-8,lastStroke=-8,pressed=0,pressTime=-8,strokes=0,servings=0,consumed=0;
let cameraLift=0,liftTarget=0,channelSeen=false,firstCorner=null,homeReturn=false,restedAt=-1000,restTime=-1000,highSince=0,visitedCove=false,revisitAt=-1000,shoreServingBase=0;
let duckYaw=.42,swimSpeed=0,kickPhase=.7,lastKick=0,focus=null,peck=null,peckClock=0,cooldown=0,attentionUntil=0;
let memory=[],familiar=null,lastBank=null,waitingAt=null,lookAtBankUntil=0,noticedAt=-1,alertPoint=null,sleepPose=0,lastActivity=0,nextPreen=10,nextBlink=3.4;
const beakPoint=v(0,0,0),duckVel=v(0,0,0);
function hear(x,z,fromTray=false){
 alertPoint={x,z};attentionUntil=simTime+(fromTray?1.45:1.95);lastActivity=simTime;
 if(fromTray){let place=memory.find(m=>m.n>=2&&Math.hypot(x-m.x,z-m.z)<1.3);if(place){familiar=place;lookAtBankUntil=simTime+1.05}}
}
function recordPlace(x,z){let m=memory.find(m=>Math.hypot(m.x-x,m.z-z)<.85);
 if(m){m.x=mix(m.x,x,.27);m.z=mix(m.z,z,.27);m.n++}else{m={x,z,n:1};memory.push(m)}lastBank=m;waitingAt=m}
function channel(x,z){ // A calm entrance and a moving ribbon around the east side of the island.
 let t=clamp((-z-.12)/3.65,0,1),cx=1.42+1.73*Math.sin(t*Math.PI*.88);
 const entry=ease(.18,-.47,z)*ease(-4.58,-3.96,z);
 let amount=Math.exp(-Math.pow((x-cx)/.44,2))*entry;
 let dx=1.73*Math.PI*.88*Math.cos(t*Math.PI*.88)/3.65;
 return {x:amount*dx*.39,z:-amount*.39,power:amount}
}
function stopAtBanks(p,r=.035){
 let front=frontZ(p.x)-.20-r;
 if(p.z>front){p.z=front;p.vz=-Math.abs(p.vz||0)*.15}
 p.x=clamp(p.x,-5.25,5.45);p.z=Math.max(-6.64,p.z);
 let dx=(p.x-island.x)/(island.a+r),dz=(p.z-island.z)/(island.b+r),d=Math.hypot(dx,dz);
 if(d<1){if(d<.001){dx=1;d=1}p.x=island.x+dx/d*(island.a+r);p.z=island.z+dz/d*(island.b+r);p.vx=(p.vx||0)*.5;p.vz=(p.vz||0)*.5}
 for(let tr of trays){let o=tr.stone,xx=p.x-o.position.x,zz=p.z-o.position.z,an=o.rotation.y;
 let lx=xx*Math.cos(an)-zz*Math.sin(an),lz=xx*Math.sin(an)+zz*Math.cos(an),a=o.scale.x*.91+r,b=o.scale.z*.93+r,q=Math.hypot(lx/a,lz/b);
 if(q<1&&q>.001){lx/=q;lz/=q;p.x=o.position.x+lx*Math.cos(an)+lz*Math.sin(an);p.z=o.position.z-lx*Math.sin(an)+lz*Math.cos(an);p.vx=(p.vx||0)*.4;p.vz=(p.vz||0)*.4}}
}
function moveFloater(p,dt,isFood){
 let cur=channel(p.x,p.z),dx=cur.x,dz=cur.z;
 for(let f of flows){let propagation=f.kind==='return'?f.age*.58:0;let rx=p.x-f.x-f.dx*propagation,rz=p.z-f.z-f.dz*propagation,d2=(rx*rx+rz*rz)/(f.radius*f.radius);if(d2>6)continue;
 let strength=f.strength*Math.exp(-d2*1.8-f.age*2.8/f.life);
 dx+=f.dx*strength;dz+=f.dz*strength;
 if(f.kind==='blade'){dx-=rx*strength*.52;dz-=rz*strength*.52}}
 if(isFood){p.flowX=dx;p.flowZ=dz}
 let damp=1-Math.exp(-dt*(isFood?3.9:2.45));
 p.vx=mix(p.vx,dx,damp);p.vz=mix(p.vz,dz,damp);
 p.x+=(p.vx+.003*Math.sin(simTime*.69+p.bob))*dt;p.z+=(p.vz+.002*Math.sin(simTime*.54+p.bob))*dt;
 stopAtBanks(p,isFood?.032:p.r*.69);
 let wave=0;for(let r of ringUniform){let age=simTime-r.z;if(age<0||age>4.2)continue;let d=Math.hypot(p.x-r.x,p.z-r.y),u=d-age*.91;
 wave+=Math.cos(u*43)*Math.exp(-Math.abs(u)*12-age*.98)*r.w*.052}
 p.o.position.set(p.x,(isFood?.021:.016)+.005*Math.sin(simTime*1.72+p.bob)+wave,p.z);
 if(!isFood){p.tilt*=Math.exp(-dt*2.2);p.o.rotation.z=.026*Math.sin(simTime+p.bob)+wave*1.55+p.tilt*p.side;p.o.rotation.x=.021*Math.sin(simTime*1.3+p.bob)+p.vz*.06;p.o.rotation.y+=dt*(p.vx*.11+p.vz*.07);
 if(p.roll&&p.bead){p.roll+=dt*.94;p.bead.position.x=mix(-p.r*.32,p.r*.88,Math.min(p.roll,1))*p.side;p.bead.position.y=.024-.025*p.roll;
 if(p.roll>=1){p.bead.visible=false;p.bead=null;p.roll=0;ripple(p.x,p.z,.12)}}}
 else {p.o.rotation.z+=dt*(p.vx+.07*Math.sin(p.bob+simTime));if(cur.power>.23)p.armed=true;
 if(p.armed&&!p.corner&&p.z<-1.82){p.corner=true;if(!channelSeen){channelSeen=true;firstCorner=p;liftTarget=1;highSince=simTime;visitedCove=false}}}
}
const middleStone=rock(2.59,.035,-.08,.85,.225,.38,1.03,true);
tray(middleStone,false);
function angleGap(a,b){return Math.atan2(Math.sin(a-b),Math.cos(a-b))}
function safeHeading(tx,tz){
 const dx=tx-duck.position.x,dz=tz-duck.position.z,ra=island.a+.46,rb=island.b+.39;
 // Take the nearer rim when a straight swimming route would intersect the reed roots.
 const px=(duck.position.x-island.x)/ra,pz=(duck.position.z-island.z)/rb,sx=dx/ra,sz=dz/rb;
 let s=clamp(-(px*sx+pz*sz)/(sx*sx+sz*sz||1),0,1),d=Math.hypot(px+s*sx,pz+s*sz);
 if(d<1.05&&Math.hypot(dx,dz)>.48){
 let a=Math.atan2(pz,px),b=Math.atan2((tz-island.z)/rb,(tx-island.x)/ra),turn=angleGap(b,a);
 const rim=a+Math.sign(turn||1)*.53;
 return {x:island.x+Math.cos(rim)*(ra+.14),z:island.z+Math.sin(rim)*(rb+.14),detour:true}}
 return {x:tx,z:tz,detour:false}
}
let drip=null,dripAge=0,bowLast=-2,shakeAt=-10,preenAt=-10;
function waterAtFeet(s,force){
 let point=duck.localToWorld(v(-.22,-.1,s*.26));ripple(point.x,point.z,.19+force*.19);
 let dx=-Math.cos(duckYaw),dz=-Math.sin(duckYaw);
 pushFlow(point.x,point.z,dx,dz,.26+force*.32,.44,1.15,'foot');
 // The same returning pulse reaches both leaves and food on its way from the stone.
 if(point.z>.35&&ran()<.23){let bankZ=frontZ(point.x)-.28;
 bankEcho.push({at:simTime+(bankZ-point.z)*1.04,x:point.x,z:bankZ,dx:-dx*.25,dz:-1,water:true})}
}
function chooseFood(){
 let best=null,score=Infinity;
 for(let f of foods){if(f.drop||f.spent)continue;
 let dist=Math.hypot(f.x-duck.position.x,f.z-duck.position.z);
 let s=dist-(Math.hypot(f.vx,f.vz)>.032?.48:0)-(f.wet<7?.33:0);
 if(f===firstCorner&&cameraLift<.85)s-=3;
 if(s<score){score=s;best=f}}
 return best;
}
function launchPeck(f){peck=f;peckClock=0;focus=f;swimSpeed*=.5}
function feedFromBeak(f){
 f.spent=true;f.o.visible=false;consumed++;lastFeed=lastActivity=simTime;recordPlace(f.x,f.z);
 ripple(f.x,f.z,.28);plip(720,.075,.083);hush(1120,.025,.12);
 for(let l of leaves){if(Math.hypot(f.x-l.x,f.z-l.z)<l.r+.045){l.side=Math.sign(f.x-l.x)||1;l.tilt=.21*l.side;l.side=1;
 if(l.bead&&!l.roll){l.roll=.001;l.side=Math.sign(f.x-l.x)||1}break}}
}
function startDrip(){
 if(!drip){drip=ell(scene,dewMat,0,0,0,.015,.022,.015);drip.renderOrder=5}drip.visible=true;dripAge=.001
}
function animateDuck(dt){
 
 let elapsed=started?simTime-startTime:0;
 if(started&&elapsed>300&&simTime-restedAt>290&&simTime-lastTouch>4&&!peck){restedAt=simTime;restTime=simTime;shakeAt=simTime;homeReturn=cameraLift>.55;if(lastBank)familiar=lastBank}
 if(strokes||servings){
 if(!focus||focus.spent||focus.drop||simTime-noticedAt>1.15){
 if(!peck){let candidate=chooseFood();if(candidate!==focus){focus=candidate;noticedAt=simTime}else noticedAt=simTime}}
 }
 let goal=null,feeding=false;
 if(familiar&&simTime<lookAtBankUntil)goal=familiar;
 else if(focus&&!focus.spent&&simTime-restTime>2.1){goal=focus;feeding=true}
 else if(homeReturn)goal={x:-.41,z:.18};
 else if(!focus&&waitingAt&&simTime-lastFeed>3.3)goal=waitingAt;
 let turn=0,seekSpeed=0,dist=0;
 if(peck)goal=null;
 if(goal){
 let dx=goal.x-duck.position.x,dz=goal.z-duck.position.z;dist=Math.hypot(dx,dz);
 let waypoint=safeHeading(goal.x,goal.z);let desired=Math.atan2(waypoint.z-duck.position.z,waypoint.x-duck.position.x),gap=angleGap(desired,duckYaw);
 turn=clamp(gap,-dt*1.58,dt*1.58);duckYaw+=turn;
 let reach=homeReturn&&!feeding?.16:feeding?.865:.83;
 if(waypoint.detour)seekSpeed=.40;
 else if(dist>reach+.015)seekSpeed=clamp((dist-reach)*1.55,.025,.61)*Math.max(.09,Math.cos(gap));
 else if(feeding&&dist<reach-.032)seekSpeed=Math.max(-.31,(dist-reach)*1.8)*Math.max(.18,Math.cos(gap));
 if(feeding&&!waypoint.detour&&Math.abs(dist-reach)<.073&&Math.abs(gap)<.15&&simTime>cooldown&&!goal.drop){launchPeck(goal)}
 if(homeReturn&&Math.hypot(duck.position.x+.41,duck.position.z-.18)<.34){
 liftTarget=0;homeReturn=false;firstCorner=null;channelSeen=false;visitedCove=false;revisitAt=simTime;shoreServingBase=servings;
 waitingAt=memory.filter(m=>m.z>-.32).sort((a,b)=>b.n-a.n)[0]||{x:.34,z:.57}}
 }else if(!peck&&simTime<attentionUntil&&alertPoint){
 let a=Math.atan2(alertPoint.z-duck.position.z,alertPoint.x-duck.position.x);turn=clamp(angleGap(a,duckYaw),-dt*.43,dt*.43);duckYaw+=turn}
 swimSpeed=mix(swimSpeed,seekSpeed,1-Math.exp(-dt*(peck?6:2.7)));
 let speed=Math.abs(swimSpeed);kickPhase+=dt*(speed>.05?4.6+speed*3.7:1.3);
 let pulse=.87+.25*Math.sin(kickPhase*2);duckVel.set(Math.cos(duckYaw)*swimSpeed*pulse,0,Math.sin(duckYaw)*swimSpeed*pulse);
 let pos={x:duck.position.x+duckVel.x*dt,z:duck.position.z+duckVel.z*dt};stopAtBanks(pos,.275);duck.position.set(pos.x,0,pos.z);
 if(cameraLift>.85&&duck.position.z<-3.05)visitedCove=true;
 if(visitedCove&&simTime-highSince>12&&duck.position.z>-.84&&(homeReturn||focus&&focus.z>-.10)){
 liftTarget=0;visitedCove=false;channelSeen=false;firstCorner=null;revisitAt=simTime;shoreServingBase=servings}
 duck.rotation.y=-duckYaw;duckBody.position.y=.005+.010*Math.sin(simTime*1.78)+Math.sin(kickPhase*2)*speed*.012;
 duckBody.rotation.x=.017*Math.sin(kickPhase)+clamp(turn/dt,-1,1)*.027;duckBody.rotation.z=.012*Math.sin(simTime*1.29);
 for(let i=0;i<2;i++){
 let phase=kickPhase+i*Math.PI,effort=(.24+speed*.89)*(1+(i===0?1:-1)*clamp(turn/dt,-1,1)*.41);
 feet[i].rotation.z=Math.sin(phase)*effort;feet[i].rotation.x=(i===0?-1:1)*(.10+Math.max(0,-Math.cos(phase))*.36+Math.abs(turn/dt)*.15)}
 if(Math.floor(kickPhase/Math.PI)>lastKick){lastKick=Math.floor(kickPhase/Math.PI);waterAtFeet(lastKick%2?1:-1,speed)}
 if(feeding&&focus&&speed>.13&&dist<1.36&&dist>.88&&simTime-bowLast>2.1){
 let b=duck.localToWorld(v(.63,0,0)),s=Math.sin(focus.bob)>0?1:-1;
 pushFlow(b.x,b.z,Math.cos(duckYaw)-s*Math.sin(duckYaw)*1.3,Math.sin(duckYaw)+s*Math.cos(duckYaw)*1.3,.28,.44,.55,'bow');ripple(b.x,b.z,.24);bowLast=simTime}
 if(simTime>nextPreen&&!focus&&!peck&&simTime-lastActivity>5){preenAt=simTime;nextPreen=simTime+range(13,20);hush(2300,.053,.37)}
 let pr=simTime-preenAt,preen=pr<2.85&&(simTime-lastTouch>2||Math.abs(lastTouch-preenAt)<.35)?Math.pow(Math.sin(Math.PI*pr/2.85),1.5):0;
 let shake=simTime-shakeAt,envelope=shake>=0&&shake<1.4?Math.sin(shake*Math.PI/1.4):0;
 duckBody.rotation.x+=Math.sin(shake*36)*envelope*.092;duckBody.position.y+=envelope*.044;duckBody.rotation.z+=envelope*.085;
 for(let i=0;i<2;i++)wings[i].rotation.x=(i?1:-1)*(preen*.074+envelope*.11*Math.sin(shake*37-i*.36));
 if(envelope>.70&&Math.floor(shake*9)!==Math.floor((shake-dt)*9))splash(duck.position.x,duck.position.z,1,.78,.36);
 let dip=0,stretch=0;
 if(peck){
 peckClock+=dt;let t=peckClock;
 dip=ease(0,.39,t)*(1-ease(.55,.96,t));stretch=.045*Math.sin(Math.PI*Math.min(t,1));
 lowerJaw.rotation.z=-.19*ease(.12,.33,t)*(1-ease(.38,.5,t));
 if(t>.60&&t-dt<=.60&&peck.spent)startDrip();
 if(t>1.12){peck=null;cooldown=simTime+.24;focus=null}
 }else{lowerJaw.rotation.z=0;
 if(alertPoint&&simTime<attentionUntil){let n=1-ease(attentionUntil-.55,attentionUntil,simTime);dip=.24*n;stretch=.052*n}}
 headPivot.rotation.z=-.99*dip-.48*preen+.018*Math.sin(kickPhase)*Math.min(1,speed*3);
 headPivot.rotation.y=preen*1.91+.038*Math.sin(simTime*.88)*(peck?0:1);
 headPivot.position.set(.36+stretch,.45-.014*dip+.011*Math.sin(simTime*1.75),0);
 head.rotation.x=.031*Math.sin(simTime*.76)+preen*.17;
 bill.localToWorld(beakPoint.set(.299,-.016,0));
 if(peck&&!peck.spent&&peckClock>.29&&peckClock<.55){
 // The neck can reach sideways a little, but picking up a grain requires actual contact.
 let local=duckBody.worldToLocal(v(peck.x,.035,peck.z)),tip=duckBody.worldToLocal(beakPoint.clone());
 headPivot.position.x+=clamp(local.x-tip.x,-.10,.10)*dip;headPivot.position.z+=clamp(local.z-tip.z,-.11,.11)*dip;
 bill.localToWorld(beakPoint.set(.299,-.016,0));
 if(Math.hypot(peck.x-beakPoint.x,peck.z-beakPoint.z)<.067&&Math.abs(beakPoint.y-peck.o.position.y)<.085)feedFromBeak(peck);
 }
 if(drip&&drip.visible){dripAge+=dt;drip.position.copy(beakPoint);drip.position.y-=.024+dripAge*.026;drip.scale.set(.016,.014+dripAge*.046,.016);if(dripAge>.36){let o=drip;drip=null;drops.push({o,vx:0,vz:0,vy:-.07,sz:.016})}}
 if(simTime>nextBlink+.19)nextBlink=simTime+range(3.4,6.8);
 const blink=1-.95*Math.max(0,Math.sin(Math.PI*clamp((simTime-nextBlink)/.19,0,1)));eyes.forEach(e=>e.scale.y=blink);
 waterU.bird.value.set(duck.position.x,duck.position.z);
}
const guide=group(),skin=std(0xf4d2af,.70,{transparent:true,opacity:0,depthWrite:false}),nailMat=std(0xffe8d6,.43,{transparent:true,opacity:0,depthWrite:false});
guide.visible=false;
function digit(points,radii){let curve=new T.CatmullRomCurve3(points),frames=curve.computeFrenetFrames(16,false),p=[],idx=[];
 for(let j=0;j<=16;j++){let t=j/16,q=curve.getPointAt(t),k=t*(radii.length-1),i=Math.floor(k),r=mix(radii[i],radii[Math.min(i+1,radii.length-1)],k-i);
 for(let n=0;n<=12;n++){let a=tau*n/12,b=q.clone().addScaledVector(frames.normals[j],Math.cos(a)*r).addScaledVector(frames.binormals[j],Math.sin(a)*r);p.push(b.x,b.y,b.z);
 if(n&&j){let e=j*13+n;idx.push(e-14,e-13,e,e-14,e,e-1)}}}mesh(geo(p,idx),skin,guide)}
ell(guide,skin,.14,.30,.12,.13,.095,.14).rotation.z=-.4;
digit([v(.115,.31,.042),v(.059,.25,.008),v(.011,.145,-.012),v(0,.077,0),v(0,.058,.004)],[.047,.043,.036,.029,.004]);
ell(guide,nailMat,-.021,.098,-.006,.009,.030,.019).rotation.z=-.2;
for(let i=0;i<3;i++){let z=.11+i*.059;
 digit([v(.098+i*.016,.29,z),v(.057+i*.015,.23,z+.015),v(.068+i*.018,.173+i*.014,z+.009),v(.101+i*.014,.174+i*.012,z-.004)],[.044-i*.004,.039-i*.003,.032-i*.002,.009])}
digit([v(.205,.30,.068),v(.243,.249,.029),v(.218,.202,-.016),v(.18,.191,-.019)],[.05,.047,.040,.012]);
guide.traverse(o=>{if(o.isMesh)o.renderOrder=8});
const ray=new T.Raycaster(),screenP=new T.Vector2(),levelPlane=new T.Plane(v(0,1,0),-.035),cameraLook=v(0,.26,-.45);
let active=null,panX=0,panZ=0,lookProgress=0,guideTray=null,lastGuide=-1;
let W=1,H=1,aspect=1,portrait=0;
function resize(){
 W=canvas.clientWidth||innerWidth;H=canvas.clientHeight||innerHeight;aspect=W/H;portrait=1-ease(.55,1.18,aspect);
 renderer.setSize(W,H,false);camera.aspect=aspect;camera.updateProjectionMatrix();
 let scale=Math.min(.73,820/Math.max(W,H))*Math.min(1.35,renderer.getPixelRatio());reflectTarget.setSize(Math.max(96,Math.round(W*scale)),Math.max(128,Math.round(H*scale)));
}
function cameraStep(dt){
 let timePlaying=started?simTime-Math.max(startTime,revisitAt):0;
 let explore=started?Math.max(ease(38,114,timePlaying),ease(1,4,servings-shoreServingBase)*.89):0;
 let targetX=explore*mix(1.01,.96,portrait),targetZ=-explore*.28;
 if(active&&active.type==='paddle'){targetX=clamp(paddleGoal.x*.52,-.74,1.82);targetZ=clamp((paddleGoal.z-1.24)*.36,-1.4,.2)}
 else if(focus&&channel(focus.x,focus.z).power>.1){targetX=Math.max(targetX,focus.x*.48);targetZ=Math.min(targetZ,focus.z*.32)}
 panX=mix(panX,targetX,1-Math.exp(-dt*.66));panZ=mix(panZ,targetZ,1-Math.exp(-dt*.66));
 cameraLift+=clamp(liftTarget-cameraLift,-dt*.19,dt*.19);let l=ease(0,1,cameraLift);
 let cx=mix(-.05+panX,1.06,l),cz=mix(-.51+panZ,-1.40,l);
 if(l>0&&firstCorner){cx+=Math.sin(l*Math.PI)*.18*(firstCorner.x-1);cz+=Math.sin(l*Math.PI)*.1*(firstCorner.z+1)}
 let fov=mix(mix(36.7,46.4,portrait),mix(41,52,portrait),l);
 camera.fov=fov;camera.updateProjectionMatrix();
 cameraLook.set(cx,mix(.416,-.01,l),cz);
 let distanceScale=aspect<.46?.46/aspect:1;
 let dist=mix(mix(5.35,7.52,portrait)+explore*mix(.66,3.18,portrait),mix(6.2,6.85,portrait),l)*distanceScale;
 camera.position.set(cx+Math.sin(Math.PI*l)*1.18+l*.47,mix(mix(1.42,1.99,portrait)+explore*mix(.21,.56,portrait),mix(7.15,8.83,portrait),l),cz+dist);
 camera.lookAt(cameraLook);camera.updateMatrixWorld();
}
function setRay(x,y){let rect=canvas.getBoundingClientRect();screenP.set((x-rect.left)/rect.width*2-1,-(y-rect.top)/rect.height*2+1);ray.setFromCamera(screenP,camera)}
function waterPoint(x,y){setRay(x,y);let p=ray.ray.intersectPlane(levelPlane,v(0,0,0));return p&&ray.ray.origin.distanceTo(p)<26?p:null}
function screenDist(x,y,world){let p=world.clone().project(camera);return Math.hypot((p.x*.5+.5)*W-x,(-p.y*.5+.5)*H-y)}
function pick(x,y){
 setRay(x,y);let ph=ray.intersectObject(paddle,true),sample=paddleTip(),handle=paddle.localToWorld(v(0,.04,.48));
 if(ph.length||Math.min(screenDist(x,y,sample),screenDist(x,y,handle),screenDist(x,y,paddle.position))<Math.max(15,Math.min(W,H)*.036))return {type:'paddle'};
 for(let tr of trays){if(tr.far&&cameraLift<.36)continue;if(!tr.grains.some(g=>!g.used))continue;
 let grainPlane=new T.Plane(v(0,1,0),-(tr.stone.position.y+.76*tr.stone.scale.y));
 let hit=ray.ray.intersectPlane(grainPlane,v(0,0,0));if(hit){let local=tr.stone.worldToLocal(hit);
 if(local.x*local.x+local.z*local.z<.94)return {type:'tray',tr,loc:local}}
 if(screenDist(x,y,tr.stone.localToWorld(v(0,.57,0)))<23)return {type:'tray',tr,loc:v(.44,.68,0)}}
 if(ray.intersectObject(torso,false).length||ray.intersectObject(head,true).length)return {type:'duck'};return null
}
function downPaddle(){
 let tip=paddleTip();pressTime=simTime;pressed=1;hear(tip.x,tip.z);ripple(tip.x,tip.z,1.05);splash(tip.x,tip.z,9,1.02);
 plip(330,.34,.23);hush(1020,.16,.17);bankEcho.push({at:simTime+.49,x:tip.x-.27,z:Math.min(frontZ(tip.x)-.30,tip.z+.66),water:false})
}
function grabFeed(a){
 const tr=a.tr,loc=a.loc,d=Math.hypot(loc.x,loc.z),num=d<.30?4:1;
 const sorted=tr.grains.filter(g=>!g.used).sort((g,h)=>g.local.distanceToSquared(loc)-h.local.distanceToSquared(loc));
 a.grabbed=[];a.center=v(0,0,0);a.local=loc.clone();
 for(let j=0;j<Math.min(num,sorted.length);j++){let g=sorted[j];g.used=true;g.ready=simTime+range(142,210);
 let start=tr.stone.localToWorld(g.local.clone()),q=addFood(start.x,start.z,{held:true,start:start.clone(),at:0,phase:j*.04});q.drop.base=start.clone();a.grabbed.push(q);a.center.add(start)}
 if(a.grabbed.length)a.center.multiplyScalar(1/a.grabbed.length);refreshTray(tr);hush(1890,.046,.10);
}
function releaseFeed(a){
 if(!a.grabbed.length)return;
 let shore=a.tr.stone,forward=a.tr===trays[0]?v(.42,0,-.91):a.tr.far?v(-.25,0,.97):v(-.97,0,-.19);
 let edge=shore.position.clone().addScaledVector(forward,.52);edge.y=shore.position.y+shore.scale.y*.81;
 let dest=edge.clone().addScaledVector(forward,.32);dest.y=.023;
 if(a.dist>.055&&a.last){dest.copy(a.last);let delta=dest.clone().sub(a.center);delta.y=0;if(delta.length()>1.95)dest.copy(a.center).add(delta.setLength(1.95));
 let rel=shore.worldToLocal(dest.clone());if(rel.x*rel.x+rel.z*rel.z<1.08)dest.copy(edge).addScaledVector(forward,.32)}
 let shoreTest={x:dest.x,z:dest.z};stopAtBanks(shoreTest,.05);
 dest.set(shoreTest.x,.022,shoreTest.z);
 a.grabbed.forEach((f,i)=>{let multi=a.grabbed.length>1,angle=i*2.399+f.bob;
 let end=dest.clone().add(v(multi?Math.cos(angle)*(.065+i*.049):0,0,multi?Math.sin(angle)*(.08+i*.052):0));
 let check={x:end.x,z:end.z};stopAtBanks(check,.04);end.x=check.x;end.z=check.z;
 let handMoved=a.dist>.14,lip=handMoved?f.o.position.clone():edge.clone();let drop={held:false,start:f.o.position.clone(),lip,end,t:-i*.055,travel:handMoved?.09:.29};
 if(handMoved)lip.y=Math.max(.13,lip.y);f.drop=drop;f.x=end.x;f.z=end.z;
 f.vx=multi?Math.cos(angle)*.24:forward.x*.12;f.vz=multi?Math.sin(angle)*.24:forward.z*.12;
 });servings++;hear(dest.x,dest.z,true);if(homeReturn){homeReturn=false}
}
function boundPaddle(x,z){
 let q={x:clamp(x,-3.65,4.75),z:clamp(z,liftTarget||cameraLift>.25?-5.9:-1.48,2.19)};
 stopAtBanks(q,.11);
 // Follow the shallow shelf around the island into the second cove.
 if(q.z<-1.53&&q.z>-3.2&&q.x<island.x+island.a*.93){if(paddle.position.z<-3.15)q.z=-3.2;else if(paddle.position.z>-1.58)q.z=-1.53;else q.x=island.x+island.a*.93}
 return q
}
canvas.addEventListener('pointerdown',e=>{
 if(active||e.button>0)return;wakeSound();let a=pick(e.clientX,e.clientY);if(!a)return;
 e.preventDefault();canvas.setPointerCapture(e.pointerId);
 a.id=e.pointerId;a.x=e.clientX;a.y=e.clientY;a.startPoint=waterPoint(a.x,a.y);a.last=a.startPoint?.clone();a.dist=0;a.mark=false;a.origin=paddle.position.clone();active=a;lastTouch=lastActivity=simTime;
 if(!started){started=true;startTime=simTime}
 if(a.type==='paddle')downPaddle();else if(a.type==='tray')grabFeed(a);else {preenAt=simTime;nextPreen=simTime+16;ripple(duck.position.x,duck.position.z,.56);hush(1820,.09,.29);duckBody.rotation.x=.07}
});
canvas.addEventListener('pointermove',e=>{
 if(!active){if(e.pointerType==='mouse')canvas.style.cursor=pick(e.clientX,e.clientY)?'grab':'default';return}
 let a=active;if(a.id!==e.pointerId)return;let p=waterPoint(e.clientX,e.clientY);if(!p||!a.startPoint)return;
 lastTouch=simTime;a.dist=Math.max(a.dist,Math.min(5,p.distanceTo(a.startPoint)));let delta=p.clone().sub(a.startPoint);
 if(a.type==='paddle'){
 let q=boundPaddle(a.origin.x+delta.x,a.origin.z+delta.z);paddleGoal.set(q.x,.028,q.z);
 if(a.dist>.046&&!a.mark){strokes++;a.mark=true}if(a.mark)lastStroke=simTime;
 }else if(a.type==='tray'){delta.clampLength(0,1.95);for(let f of a.grabbed){f.drop.start.copy(f.drop.base).add(delta);f.drop.start.y=f.drop.base.y+.042*ease(0,.16,a.dist)}}
 a.last=p;canvas.style.cursor='grabbing'
});
function finishPointer(e){
 if(!active||active.id!==e.pointerId)return;let a=active;active=null;lastTouch=simTime;
 if(a.type==='paddle'){pressed=0;paddleHome.copy(paddleGoal);paddleGoal.z+=.042;paddleGoal.x-=.023;ripple(paddleTip().x,paddleTip().z,.39)}
 if(a.type==='tray')releaseFeed(a);
 if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);canvas.style.cursor='grab'
}
canvas.addEventListener('pointerup',finishPointer);canvas.addEventListener('pointercancel',finishPointer);canvas.addEventListener('lostpointercapture',e=>{if(active)finishPointer(e)});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
function tutorial(){
 let idle=simTime-lastTouch,cycle=Math.max(0,idle-4)%7.4;
 let show=!active&&idle>=4&&cycle<2.54;
 let tr=null;
 if(started&&(strokes>0||servings>0)&&((foods.filter(f=>!f.spent&&!f.drop).length<2)||(servings===0&&consumed>0))){
 let mid=middleStone.position.clone().project(camera);
 tr=cameraLift>.64?trays[1]:(servings>=2||simTime-startTime>90)&&Math.abs(mid.x)<.94?trays[2]:trays[0];if(tr.grains.every(g=>g.used))tr=null
 }
 let g=tr?.grains.find((g,i)=>!g.used&&i>=37)||tr?.grains.find(g=>!g.used);
 if(guideTray&&guideTray!==tr)refreshTray(guideTray);guideTray=tr;
 if(tr&&g){
 let bounce=.019*(.5+.5*Math.sin(simTime*3.4));
 const ix=tr.grains.indexOf(g);tr.batch.getMatrixAt(ix,dummy.matrix);dummy.matrix.decompose(dummy.position,dummy.quaternion,dummy.scale);dummy.position.y=g.local.y+bounce/tr.stone.scale.y;dummy.updateMatrix();tr.batch.setMatrixAt(ix,dummy.matrix);tr.batch.instanceMatrix.needsUpdate=true;
 }
 const strength=!tr&&!active?.023+.026*(1+Math.sin(simTime*2.6)):0;
 wetWood.emissive.setRGB(strength,strength*.61,strength*.23);dryWood.emissive.copy(wetWood.emissive);
 guide.visible=show;if(!show)return;
 let a=ease(0,.38,cycle)*(1-ease(1.98,2.54,cycle)),press=ease(.17,.75,cycle)*(1-ease(1.6,2.2,cycle)),slide=ease(.84,1.85,cycle);
 let begin=tr?tr.stone.localToWorld(g.local.clone()):paddleTip();guide.position.copy(begin);
 guide.position.y+=.28-.27*press;guide.position.x+=.04;guide.rotation.y=-.17;
 if(tr){guide.position.x+=slide*(tr.far?-.12:.18);guide.position.z+=slide*(tr.far?.38:-.48)}
 else if(started){guide.position.x+=slide*.32;guide.position.z-=slide*.41}
 skin.opacity=a*.32;nailMat.opacity=a*.27;
 if(!tr&&cycle>.80&&cycle<1.06&&simTime-lastGuide>4){ripple(begin.x,begin.z,.32);lastGuide=simTime}
}
// Each side of the wake keeps the heading at the time that part of the water was parted.
const wakePoints=[],wakeCount=39,wakeVertices=new Float32Array(wakeCount*4*3),wakeAlpha=new Float32Array(wakeCount*4);
const wakeGeometry=new T.BufferGeometry(),wakeIndices=[];
for(let i=1;i<wakeCount;i++)for(let side=0;side<2;side++){
 let n=(i-1)*4+side*2;wakeIndices.push(n,n+4,n+1,n+1,n+4,n+5)}
wakeGeometry.setAttribute('position',new T.BufferAttribute(wakeVertices,3).setUsage(T.DynamicDrawUsage));
wakeGeometry.setAttribute('opacity',new T.BufferAttribute(wakeAlpha,1).setUsage(T.DynamicDrawUsage));wakeGeometry.setIndex(wakeIndices);
const wakeSurface=mesh(wakeGeometry,new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,
 vertexShader:'attribute float opacity;varying float shine;void main(){shine=opacity;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
 fragmentShader:`varying float shine;void main(){gl_FragColor=vec4(.73,.85,.71,shine);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`}));
wakeSurface.frustumCulled=false;wakeSurface.renderOrder=4;let wakeStamp=-5;
function updateWake(){
 if(simTime-wakeStamp>.135){
 let speed=Math.abs(swimSpeed);
 wakePoints.unshift({x:duck.position.x,z:duck.position.z,a:duckYaw,born:simTime,energy:clamp(speed*2.6,0,1)});
 if(wakePoints.length>wakeCount)wakePoints.pop();wakeStamp=simTime
 }
 for(let i=0;i<wakePoints.length;i++){
 let w=wakePoints[i],age=simTime-w.born,s=Math.sin(w.a),c=Math.cos(w.a);
 for(let j=0;j<4;j++){let sign=j<2?-1:1,edge=j%2,ix=i*4+j;
 let width=.29+age*.111+.041*Math.sin(Math.min(age*2.6,Math.PI))+.011*Math.sin(w.born*5.4+sign+simTime*.5);
 let across=sign*(width+edge*(.012+age*.002));
 wakeVertices[ix*3]=w.x+c*(.38-age*.047)-s*across;wakeVertices[ix*3+1]=.010;
 wakeVertices[ix*3+2]=w.z+s*(.38-age*.047)+c*across;
 wakeAlpha[ix]=w.energy*(.31-.15*edge)*ease(0,.29,age)*(1-ease(.4,4.6,age))*(.68+.32*Math.sin(age*5.3+sign));
 }}
 wakeGeometry.attributes.position.needsUpdate=true;wakeGeometry.attributes.opacity.needsUpdate=true;
 wakeGeometry.setDrawRange(0,Math.max(0,wakePoints.length-1)*12)
}
let bladePrev=paddleTip(),lastWake=-1,lastReplenish=0;
function updatePaddle(dt){
 const dragging=active?.type==='paddle',since=simTime-pressTime;
 let press=since>=0&&since<1?Math.sin(Math.min(Math.PI,since*12))*Math.exp(-since*4.3):0;
 paddle.position.lerp(paddleGoal,1-Math.exp(-dt*(dragging?16:2.35)));
 paddle.position.y=.033+.007*Math.sin(simTime*1.8)+(!started?.009*(.5+.5*Math.sin(simTime*2.6)):0)-press*.043;
 paddlePivot.rotation.x=-.04+.015*Math.sin(simTime*1.18)-press*.21;
 paddlePivot.rotation.z=.015*Math.sin(simTime*1.4)+press*.084;
 let tip=paddleTip(),dx=tip.x-bladePrev.x,dz=tip.z-bladePrev.z,dist=Math.hypot(dx,dz),speed=Math.min(3,dist/Math.max(.001,dt));
 if(dragging&&active.mark&&speed>.035){
 if(simTime-lastWake>.068){
 let ux=dx/(dist||1),uz=dz/(dist||1);
 pushFlow(tip.x+ux*.09,tip.z+uz*.09,ux,uz,Math.min(2.3,.28+speed*.72),.67,.79);
 ripple(tip.x,tip.z,clamp(speed*.33,.12,.71));lastWake=simTime;
 if(speed>.85)splash(tip.x,tip.z,2,.50);
 if(simTime-lastSound>.32){let across=Math.abs(ux*Math.cos(paddle.rotation.y)-uz*Math.sin(paddle.rotation.y));let weight=Math.min(1,across*.65+speed*.24);
 plip(mix(720,200,weight),.12+weight*.13,.11+weight*.13);hush(mix(2300,670,weight),.07+weight*.11,.20);lastSound=simTime}
 }}
 bladePrev.copy(tip);waterU.tool.value.set(tip.x,tip.z);
}
function updateObjects(dt){
 for(let i=flows.length-1;i>=0;i--){flows[i].age+=dt;if(flows[i].age>flows[i].life)flows.splice(i,1)}
 for(let i=bankEcho.length-1;i>=0;i--){let e=bankEcho[i];if(simTime<e.at)continue;
 ripple(e.x,e.z,e.water?.28:.35);if(e.water)pushFlow(e.x,e.z,e.dx,e.dz,.68,.74,1.8,'return');
 else{plip(206,.13,.18);hush(620,.065,.19)}bankEcho.splice(i,1)}
 for(let i=foods.length-1;i>=0;i--){let f=foods[i];if(f.spent){if(peck!==f){foodMeshes.remove(f.o);foods.splice(i,1)}continue}
 if(f.drop){let d=f.drop;if(d.held){f.o.position.copy(d.start);f.o.position.y+=.018;continue}
 d.t+=dt;let slide=clamp(d.t/d.travel,0,1);
 if(slide<1){f.o.position.lerpVectors(d.start,d.lip,ease(0,1,slide));f.o.rotation.z+=dt*3.8}
 else{let t=clamp((d.t-d.travel)/.29,0,1);f.o.position.lerpVectors(d.lip,d.end,t);f.o.position.y+=Math.sin(t*Math.PI)*.050;f.o.rotation.x+=dt*3;
 if(t>=1){f.x=d.end.x;f.z=d.end.z;f.drop=null;f.wet=0;ripple(f.x,f.z,.46);splash(f.x,f.z,3,.47);plip(range(635,940),.073,.095)}}}
 else{f.wet+=dt;f.o.material=f.wet>12?soakedFood:f.wet>.8?dampFood:foodMat;moveFloater(f,dt,true);f.o.position.y-=.042*Math.exp(-f.wet*7)*Math.sin(f.wet*18)}
 }
 leaves.forEach(l=>moveFloater(l,dt,false));
 for(let i=drops.length-1;i>=0;i--){let q=drops[i];q.vy-=dt*3.25;q.o.position.x+=q.vx*dt;q.o.position.z+=q.vz*dt;q.o.position.y+=q.vy*dt;
 if(q.o.position.y<.009){if(q.sz>.012)ripple(q.o.position.x,q.o.position.z,.15);q.o.visible=false;dropPool.push(q.o);drops.splice(i,1)}}
 if(simTime-lastReplenish>3.5){lastReplenish=simTime;
 for(let tr of trays){let g=tr.grains.find(g=>g.used&&simTime>g.ready);if(g){g.used=false;refreshTray(tr)}}}
}
resize();cameraStep(0);window.addEventListener('resize',resize);
let lastFrame=null,frame=0,lastReflection=-1;
function animate(ms){
 requestAnimationFrame(animate);
 if(document.hidden){lastFrame=null;return}const dt=lastFrame===null?0:clamp((ms-lastFrame)*.001,0,.05);lastFrame=ms;simTime+=dt;
 updatePaddle(dt);updateObjects(dt);animateDuck(Math.max(dt,.00001));updateWake();tutorial();cameraStep(dt);
 sunlightClock.value=simTime;waterU.uTime.value=simTime;
 if(frame===0||simTime-lastReflection>.064||cameraLift>0&&cameraLift<1){renderReflection(cameraLook);lastReflection=simTime}
 renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=frame%4===0;renderer.render(scene,camera);frame++;
}
document.addEventListener('visibilitychange',()=>{lastFrame=null;if(document.hidden&&audio?.state==='running')audio.suspend().catch(()=>{});else if(!document.hidden&&started&&audio?.state==='suspended')audio.resume().catch(()=>{})});
requestAnimationFrame(animate);
