'use strict';
const canvas=document.getElementById('habitat');
const renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.85));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.03;
const camera=new T.PerspectiveCamera(34,1,.04,65),ray=new T.Raycaster(),pointer=new T.Vector2();
const world=(object,x=0,y=0,z=0)=>object.localToWorld(V(x,y,z));
const local=(object,v)=>object.worldToLocal(v.clone());
const angleDiff=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
const grains=[],pouches=[[],[]],seen=[0,0],pickCount=[0,0],dropCount=[0,0],pile=[];
const clockState={now:0,lastInput:0,started:false,firstAt:0,lastPick:0,lastSide:-1,lastSound:-10,heard:null,unlocked:false,visits:0};
const action={name:'idle',time:0,focus:null,side:0,route:[],onArrive:'',inside:false,exitSide:0,unpacking:null};
const plate={angle:0,auto:null,first:true,firstLatch:true,lastMove:-10,direction:1};
const shutter={fraction:0,auto:null,view:0},outlet={amount:.08},spoon={rest:V(),flight:null},home=V();
const view={eye:V(),at:V(),innerEye:V(),innerAt:V(),fov:34,innerFov:36,atNow:V(),portrait:false};
let gesture=null,lastStamp=0,sound=null;
const atom=(a,b,t)=>a.clone().lerp(b,smooth(t));
const floorMat=material(0x718276,.84);box(room,floorMat,0,-.71,1,34,.36,26);
chute.position.set(-1.29,.765,.71);chuteWood.scale.z=1.14;
function setOutlet(f){outlet.amount=clamp(f);chute.rotation.y=mix(-3.00,-4.32,outlet.amount)}
setOutlet(.08);
function layout(initial=false){
 let w=window.innerWidth,h=window.innerHeight,asp=w/h;renderer.setSize(w,h,false);camera.aspect=asp;
 let tall=asp<.86;view.portrait=tall;const oldHome=home.clone();
 if(tall){
 wheelStand.position.set(-1.12,0,1.49);wheelStand.scale.setScalar(.82);
 house.position.set(.46,0,-2.58);house.rotation.y=.22;house.scale.set(.92,1.00,.92);
 tray.position.set(.21,.012,2.94);tray.scale.set(.85,1,.92);tray.rotation.y=-.12;
 spoon.rest.set(-.30,.018,4.02);scoop.rotation.y=.12;frontRail.position.z=4.89;
 home.set(.88,0,.46);hamster.scale.setScalar(1.21);
 view.at.set(0,1.00,.12);view.eye.set(.08,7.15,10.08);
 let dist=view.eye.distanceTo(view.at);view.fov=2*Math.atan(5.40/(2*asp*dist))*180/Math.PI;
 view.innerAt.set(.40,1.05,-1.72);view.innerEye.set(1.02,2.55,5.38);
 view.innerFov=2*Math.atan(4.57/(2*asp*view.innerEye.distanceTo(view.innerAt)))*180/Math.PI;
 }else{
 wheelStand.position.set(-2.03,0,-.04);wheelStand.scale.setScalar(1);
 house.position.set(1.89,0,-2.45);house.rotation.y=.27;house.scale.set(1,1.08,1);
 tray.position.set(-.03,.012,1.91);tray.scale.set(1,1,1);tray.rotation.y=-.085;
 spoon.rest.set(-2.14,.019,2.46);scoop.rotation.y=-.23;frontRail.position.z=3.80;
 home.set(1.06,0,.64);hamster.scale.setScalar(1.21);
 view.at.set(-.04,1.12,-.18);view.eye.set(.22,5.30,10.60);
 let dist=view.eye.distanceTo(view.at);view.fov=2*Math.atan(Math.max(5.84,8.65/asp)/(2*dist))*180/Math.PI;
 view.innerAt.set(1.32,1.13,-1.72);view.innerEye.set(.70,2.14,4.93);view.innerFov=2*Math.atan(Math.max(3.30,5.99/asp)/(2*view.innerEye.distanceTo(view.innerAt)))*180/Math.PI;
 }
 floor.position.z=(frontRail.position.z-4.75)/2;floor.scale.z=frontRail.position.z+4.75;
 if(!spoon.flight&&gesture?.kind!=='scoop')scoop.position.copy(spoon.rest);
 if(initial||(!action.inside&&action.name==='idle')){hamster.position.copy(home);hamster.rotation.y=-.40}
 else if(!action.inside)hamster.position.add(home.clone().sub(oldHome));
 if(action.inside&&initial===false&&action.name!=='travel')hamster.position.copy(world(house,.35,.278,-.16));
 scene.updateMatrixWorld(true);fitRunways();cameraPose();camera.updateProjectionMatrix()}
function cameraPose(){let f=smooth(shutter.view);camera.position.copy(view.eye).lerp(view.innerEye,f);view.atNow.copy(view.at).lerp(view.innerAt,f);camera.lookAt(view.atNow);camera.fov=mix(view.fov,view.innerFov,f);camera.updateProjectionMatrix();camera.updateMatrixWorld()}
function beginAudio(){
 try{if(!sound){let C=window.AudioContext||window.webkitAudioContext;if(C)sound=new C()}if(sound?.state==='suspended')sound.resume().catch(()=>{})}catch(e){}}
function knock(tone='grain',power=1,pan=0){
 if(!sound||sound.state!=='running')return;let t=sound.currentTime,soft=tone==='soft',wooden=tone==='wood',freq=soft?290:wooden?245:650;
 let g=sound.createGain(),out=g;if(sound.createStereoPanner){let p=sound.createStereoPanner();p.pan.value=clamp(pan,-.85,.85);g.connect(p);out=p}out.connect(sound.destination);let dur=soft?.063:wooden?.105:.125;
 g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime((soft?.023:wooden?.041:.068)*power+.0001,t+.003);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
 for(let i=0;i<2;i++){let o=sound.createOscillator();o.type=i?'triangle':'sine';o.frequency.setValueAtTime(freq*(i?2.54:1)*range(.94,1.08),t);o.frequency.exponentialRampToValueAtTime(freq*(i?1.61:.68),t+dur);o.connect(g);o.start(t);o.stop(t+dur+.008)}setTimeout(()=>{g.disconnect();if(out!==g)out.disconnect()},250)}
function addToWell(index,type,existing=null){
 let h=holes[index],j=h.grains.length,m=existing||kernel(wheelHot,type),phi=j*2.399+index*.67,r=j===0?.025:Math.min(.221,.102+.019*j);
 if(existing)wheelHot.add(m);let upright=j===0||j%4===2;
 m.position.set(h.x+Math.sin(phi)*r,1.362+.034*(j%3)-.042*(j===1),h.z+Math.cos(phi)*r);
 m.rotation.set(upright?range(.64,1.07):range(-.19,.25),phi+.62,range(-.37,.37));
 let vertices=m.geometry.attributes.position,axis=V(0,1,0).applyQuaternion(m.quaternion.clone().invert()),minY=1;
 for(let k=0;k<vertices.count;k++)minY=Math.min(minY,vertices.getX(k)*axis.x+vertices.getY(k)*axis.y+vertices.getZ(k)*axis.z);
 m.position.y=1.301-minY+.009*(j%2);
 let g={m,type,basePitch:m.rotation.x,state:'well',hole:index,upright,threshold:upright?.48:.185+(j%3)*.042,side:0,age:0,region:'yard'};
 grains.push(g);h.grains.push(g);return g}
for(let i=0;i<WELL_COUNT;i++)for(let j=0;j<5+(i%3);j++)addToWell(i,(i+j%2)%3===1?1:0);
function release(h,side){
 let g=h.grains.shift();if(!g)return;
 h.series=(h.series||0)+1;h.lastAt=clockState.now;scene.updateMatrixWorld(true);let from=world(g.m);stage.attach(g.m);
 g.side=side;g.age=0;g.state='fall';g.region=shutter.view>.5?'nest':'yard';g.from=from;g.turn=g.m.rotation.clone();
 let e=g.region==='nest'?innerExit:exits[side];g.hatch=world(wheelStand,e.x,.93,e.z);
 let x=side?range(.47,.92):range(-1.05,-.54),z=range(-.15,.21);
 g.rest=V(x,.096,z);g.roll=V((side?1:-1)*(g.type?.34:.18),0,range(.055,.155));
 if(g.region==='yard'){
 for(let b of grains){if(b!==g&&b.state==='ground'&&b.region==='yard'&&b.rest.distanceTo(g.rest)<.21){g.rest.x+=range(-.17,.17);g.rest.z+=.09}}
 }else g.inlet=world(chute,0,.12,-.03);
 dropCount[side]++;h.dwell=0;
}
// The loose axle moves a short wooden slide against the unused outlet.
// The second kernel needs time to settle into the same opening.
function discharge(old,dt,forceFirst=false){
 if(!clockState.started)return;
 if(forceFirst&&plate.first){
   holes[0].port=0;holes[0].inWindow=true;
   release(holes[0],0);plate.first=false;return;
 }
 if(plate.first||plate.firstLatch)return;
 const port=shutter.view>.5?2:plate.direction>0?0:1;
 const angle=port===2?nestAngle:exitAngles[port];
 const travel=Math.abs(angleDiff(plate.angle,old));
 let candidate=null;
 for(const h of holes){
   const g=h.grains[0];
   if(!g||g.state!=='well')continue;
   const before=angleDiff(h.angle+old,angle),after=angleDiff(h.angle+plate.angle,angle);
   const crossed=before*after<=0&&Math.abs(before-after)<Math.PI;
   const gap=crossed?0:Math.min(Math.abs(before),Math.abs(after));
   if(h.port!==port||(!h.inWindow&&Math.abs(before)>.54)){
     h.series=0;h.dwell=0;
   }
   h.port=port;h.inWindow=Math.abs(after)<.54;
   if(gap>.54){h.series=0;h.dwell=0;continue}
   const supported=gap>g.threshold;
   h.dwell=supported?0:h.dwell+dt;
   const lean=supported?0:.27*smooth(h.dwell/.8);
   g.m.rotation.x=mix(g.m.rotation.x,g.basePitch+lean,Math.min(1,dt*7));
   const first=!h.series&&(travel>.011||h.dwell>=.28);
   const following=h.series===1&&h.dwell>=(g.upright?1.05:1.48);
   if(!supported&&(first||following)&&(!candidate||candidate.gap>gap))candidate={h,gap};
 }
 if(candidate)release(candidate.h,port===2?0:port);
}
function rotateWheel(delta,dt){
 let old=plate.angle;plate.angle+=delta;wheel.rotation.y=plate.angle;if(Math.abs(delta)>.0001){plate.lastMove=clockState.now;plate.direction=Math.sign(delta)}discharge(old,dt)}
function idleTap(side){
 let dir=side===0?1:-1,best=Infinity;
 for(const h of holes){if(!h.grains.length)continue;let delta=angleDiff((shutter.view>.5?nestAngle:exitAngles[side])-(h.angle+plate.angle),0)*dir;if(delta<.06)delta+=TAU;best=Math.min(best,delta)}
 plate.auto={from:plate.angle,to:plate.angle+(Number.isFinite(best)?best:.19)*dir,duration:.59,elapsed:0}}
function soundHeard(g){
 clockState.lastSound=clockState.now;clockState.heard=g;knock(g.region==='nest'&&g.rest.x>-.45?'soft':'grain',g.type?.72:1,g.side?.55:-.55)}
function setGround(g,parent,p){
 parent.attach(g.m);g.m.position.copy(p);g.m.scale.setScalar(1);g.state='ground';g.rest=p.clone();g.age=0;g.m.visible=true}
function updateGrains(dt){
 for(const g of grains){if(!['fall','chute','drop','roll','refill'].includes(g.state))continue;g.age+=dt;
 if(g.state==='refill'){let f=clamp(g.age/.42),end=wheelHot.localToWorld(g.landLocal.clone());g.m.position.copy(g.from).lerp(end,f);g.m.position.y=mix(g.from.y,end.y,f*f);if(f===1){wheelHot.attach(g.m);g.m.position.copy(g.landLocal);g.state='well'}continue}
 if(g.state==='fall'){
 let f=clamp(g.age/(g.region==='nest'?1.26:.86));
 if(f<.36)g.m.position.copy(g.from).lerp(g.hatch,(f/.36)**1.55);
 else {let u=(f-.36)/.64,path=g.region==='nest'?runways[2]:runways[g.side],end=g.region==='nest'?world(chute,0,.125,0):world(tray,g.rest.x-g.roll.x,g.rest.y+.046,g.rest.z-g.roll.z);
 if(u<.78){g.m.position.copy(path.getPointAt(u/.78));g.m.position.y+=.037}
 else{let v=(u-.78)/.22,lip=path.getPointAt(1);g.m.position.copy(lip).lerp(end,v);g.m.position.y=mix(lip.y,end.y,v*v)}}
 g.m.rotation.x=g.turn.x+f*1.9;
 if(f===1){g.age=0;if(g.region==='nest')g.state='chute';else{g.state='roll';g.rollFrom=local(tray,g.m.position);tray.attach(g.m);soundHeard(g)}}}
 else if(g.state==='chute'){
 let f=clamp(g.age/.91);g.m.position.copy(world(chuteWood,0,.074,.04+1.10*f*f));g.m.rotation.y=chute.rotation.y+house.rotation.y;
 if(f===1){g.from=g.m.position.clone();let end=local(house,world(chuteWood,0,.045,1.36));g.rest=V(end.x+range(-.08,.08),end.x<-.49?.39:.326,end.z+range(-.045,.065));g.state='drop';g.age=0}}
 else if(g.state==='drop'){
 let f=clamp(g.age/.43),end=world(house,g.rest.x,g.rest.y,g.rest.z);g.m.position.copy(g.from).lerp(end,f);g.m.position.y=mix(g.from.y,end.y,f*f);g.m.rotation.x+=dt*4.3;
 if(f===1){g.side=g.rest.x<-.43?0:1;setGround(g,house,g.rest);g.m.rotation.set(.04,range(-1.2,1.2),.07);soundHeard(g)}}
 else {let f=clamp(g.age/(g.type?.81:.53)),p=1-(1-f)**2;
 g.m.position.copy(g.rollFrom).lerp(g.rest,p);g.m.position.y+=Math.abs(Math.sin(f*Math.PI*2))*(1-f)*.04;g.m.rotation.x=mix(g.turn.x+1.9,.06,p);g.m.rotation.z=(1-p)*.52;g.m.rotation.y+=dt*(1-f)*(g.type?3:1.3);
 if(f===1)setGround(g,tray,g.rest)}
 }}
const pose={walk:0,low:0,nod:0,look:0,tilt:0,chew:0,reach:0,bend:0,listen:0,paws:[V(),V()],fill:seen};
function state(name){action.name=name;action.time=0}
function loaded(){return pouches[0].length+pouches[1].length}
function turnAnimal(yaw,dt,speed=3.6){hamster.rotation.y+=angleDiff(yaw,hamster.rotation.y)*Math.min(1,dt*speed)}
function walk(point,dt,speed=.85){
 let dx=point.x-hamster.position.x,dz=point.z-hamster.position.z,dist=Math.hypot(dx,dz);
 turnAnimal(Math.atan2(dx,dz),dt,5.2);let step=speed*dt;if(dist<step+.012){hamster.position.copy(point);return true}
 hamster.position.x+=dx/dist*step;hamster.position.z+=dz/dist*step;hamster.position.y=mix(hamster.position.y,point.y,Math.min(1,dt*5));
 pose.walk=1;pose.low=.84;pose.tilt=Math.sin(clockState.now*8)*(.026+.006*loaded());return false}
function travel(points,onArrive){action.route=points;action.onArrive=onArrive;state('travel')}
function nestSite(){let last=clockState.lastSide===1?1:0;return world(house,last?.21:.04,.277,-.76)}
function goIn(){
 let route=[world(house,-2.37,.009,.14),world(house,-1.92,.19,.02),world(house,-1.23,.275,.035),nestSite()];
 travel(route,'arrived');action.exitSide=clockState.lastSide;
}
function goOut(){travel([world(house,-1.11,.274,.04),world(house,-1.93,.16,.02),world(house,-2.36,.009,.16),home.clone()],'outside')}
function candidate(){
 let region=action.inside?'nest':'yard',best=null,dist=Infinity;
 for(let g of grains){if(g.state!=='ground'||g.region!==region)continue;let d=world(g.m).distanceToSquared(hamster.position);if(d<dist){dist=d;best=g}}return best}
function pickupPoint(g){
 let p=world(g.m);if(action.inside){let base=local(house,p);base.z-=.49;base.x=clamp(base.x,-1.15,1.17);base.y=.274;return world(house,base.x,base.y,base.z)}
 let away=g.side?-.17:.34,stand=V(p.x+away,.012,p.z-.62*hamster.scale.x),q=local(tray,stand);
 let r=Math.hypot(q.x/1.77,q.z/.81);if(r<1.01)stand.y=.08+.24*smooth((r-.78)/.19);return stand}
function remember(g){pickCount[g.side]++;clockState.lastSide=g.side;clockState.lastPick=clockState.now}
function favorite(){if(clockState.lastSide<0)return -1;let a=pickCount[0]*.9+dropCount[0]*.20+(clockState.lastSide===0?.7:0),b=pickCount[1]*.9+dropCount[1]*.20+(clockState.lastSide===1?.7:0);return b>a?1:0}
function arrangePile(g,side){
 let s=side?1:-1,anchor=V((action.exitSide===1?1.17:.94)+s*.20,.309,-.41+(side?.06:-.035)),best=null,score=Infinity;
 for(let k=0;k<18;k++){let ang=rand()*TAU,r=range(.035,.12+Math.min(.43,pile.length*.021)),x=clamp(anchor.x+Math.sin(ang)*r,-.12,1.47),z=clamp(anchor.z+Math.cos(ang)*r,-.94,.21),y=.307;
 for(let other of pile){let q=other.m.position,d=Math.hypot(q.x-x,(q.z-z)*.72);if(d<.124)y=Math.max(y,q.y+.064*(1-d/.24))}
 let cost=y+r*.39+rand()*.025;if(cost<score){score=cost;best=V(x,y,z)}}return best}
function startUnpack(){
 let side=pouches[0].length?0:1,g=pouches[side][0];if(!g){state('groom');return}
 action.unpackedSide=side;action.unpacking=g;action.settle=arrangePile(g,side);
 action.impact=action.settle.clone();action.impact.y+=.019;
 let neighbor=null,distance=.25;
 for(const seed of pile){let q=seed.m.position,d=Math.hypot(q.x-action.settle.x,q.z-action.settle.z);
 if(d<distance){neighbor=q;distance=d}}
 if(neighbor){action.impact.x=mix(neighbor.x,action.settle.x,.18);action.impact.z=mix(neighbor.z,action.settle.z,.18);action.impact.y=Math.max(action.settle.y+.028,neighbor.y+.082)}
 action.fromPaw=null;state('unpack')}
function basePose(t){
 Object.assign(pose,{walk:0,low:action.inside?.74:0,nod:0,look:Math.sin(t*.67)*.075,tilt:0,chew:0,reach:0,bend:0,listen:Math.exp(-Math.max(0,t-clockState.lastSound)*2.1)});
 for(let i=0;i<2;i++){pose.paws[i].set((i?1:-1)*.234,.82+Math.sin(t*2.1+i)*.013,.509);seen[i]=mix(seen[i],pouches[i].length,.06)}
 if(pose.listen>.12&&clockState.heard){let p=world(clockState.heard.m),yaw=Math.atan2(p.x-hamster.position.x,p.z-hamster.position.z);
 pose.look+=clamp(angleDiff(yaw,hamster.rotation.y),-.65,.65)*pose.listen*smooth((t-clockState.lastSound-.11)/.25)}}
function updateAnimal(dt){
 let t=clockState.now;action.time+=dt;let a=action.time; basePose(t);
 if(action.name==='idle'||action.name==='sniff'){
 let g=candidate(),f=favorite(),age=t-clockState.firstAt;
 if(!action.inside&&loaded()&&((age>112&&t-clockState.lastPick>14)||(age>85&&loaded()>=5)||age>160)){goIn()}
 else if(!action.inside&&shutter.fraction>.80&&clockState.unlocked){goIn()}
 else if(action.inside&&loaded()&&(!g&&t-clockState.lastPick>3.7||loaded()>=3)){travel([nestSite()],'arrived')}
 else if(g&&a>.55){action.focus=g;state('approach')}
 else if(action.inside&&shutter.fraction<.18&&a>3.0){goOut()}
 else if(action.name==='idle'&&!action.inside&&f>=0&&t-plate.lastMove<.45&&a>.6){action.sniffSide=f;state('sniff')}
 else if(action.name==='sniff'){let p=world(tray,action.sniffSide?.77:-.78,0,-.37);p.z-=.76;p.y=.01;
 if(a<3&&p.distanceTo(hamster.position)>.14)walk(p,dt,.46);else{pose.low=.78;pose.nod=.18+Math.sin(t*6)*.065;pose.bend=.65;turnAnimal(.14*(action.sniffSide?1:-1),dt);if(a>5)state('idle')}}
 else if(action.inside)turnAnimal(house.rotation.y-.18,dt,.9);
 else{turnAnimal(-.40,dt,.7);pose.nod=Math.sin(t*1.74)*.024}
 }else if(action.name==='approach'){
 let g=action.focus;if(!g||g.state!=='ground'){state('idle')}else{let p=pickupPoint(g);if(walk(p,dt,action.inside?.56:.75)){state('take');action.grabFrom=world(g.m);let s=g.side;if(pouches[s].length>=5&&pouches[1-s].length<pouches[s].length)s=1-s;action.side=s}}
 }else if(action.name==='take'){
 let g=action.focus,side=action.side,s=side?1:-1;let timeScale=action.inside?.87:1,u=a/timeScale,raise=smooth((u-2.7)/2.0),mouth=smooth((u-4.72)/1.38),swallow=smooth((u-6.15)/1.12);
 pose.low=mix(.94,action.inside?.71:0,raise);pose.reach=1-raise;pose.nod=(1-raise)*.27+mouth*.035;pose.look=s*.16*smooth((u-5.9)/1.15);pose.tilt=-s*.059*mouth;pose.chew=smooth((u-4.8)/.8)*(1-swallow*.66);
 turnAnimal(Math.atan2(action.grabFrom.x-hamster.position.x,action.grabFrom.z-hamster.position.z)+s*.09,dt,3.3);animal.updateWorldMatrix(true,false);
 let seedLocal=local(animal,action.grabFrom);
 for(let i=0;i<2;i++){let k=i?1:-1,reach=smooth((u-(i===side?.12:.77))/.97);
 let grasp=seedLocal.clone().add(V(k*.082,-.015,-.125));pose.paws[i].lerp(grasp,reach);
 let raised=local(animal,world(face,k*.104,.99,.625));pose.paws[i].lerp(raised,raise);pose.paws[i].lerp(local(animal,world(face,k*.107,1.40,.707)),mouth);pose.paws[i].y+=pose.chew*Math.sin(t*17)*.012}
 if(u>=2.53&&g.state==='ground'){stage.attach(g.m);g.state='held'}
 if(swallow>0)seen[side]=pouches[side].length+swallow;
 if(u>7.7){g.m.visible=false;g.m.scale.setScalar(1);g.state='pouch';pouches[side].push(g);if(loaded()===1)clockState.firstAt=t;remember(g);state('look')}
 }else if(action.name==='look'){
 let s=action.side?1:-1;pose.look=s*.39*Math.sin(Math.PI*clamp(a/3.5));pose.chew=.44*(1-clamp(a/2));pose.tilt=s*.04;if(a>3.5)state('idle')
 }else if(action.name==='travel'){
 let dest=action.route[0];if(walk(dest,dt,loaded()>=4?.66:.87)){action.route.shift();if(!action.route.length){
 if(action.onArrive==='outside'){action.inside=false;state('idle')}else{action.inside=true;if(loaded()){clockState.visits++;startUnpack()}else state('idle')}}}
 }else if(action.name==='unpack'){
 let g=action.unpacking,s=action.unpackedSide?1:-1,i=action.unpackedSide;
 turnAnimal(house.rotation.y-.16,dt,2.7);pose.low=.74;pose.nod=.055;pose.tilt=-s*.09;
 let push=smooth(a/.63),out=smooth((a-.64)/.76);pose.paws[i].lerp(local(animal,world(face,s*(.59-.34*out),1.26+.065*push,.18+.41*out)),push);pose.paws[1-i].lerp(local(animal,world(face,-s*.10,1.07,.64)),push);pose.chew=out;
 seen[i]=pouches[i].length-out;
 if(a>.83){
   g.m.visible=true;g.m.scale.setScalar(.25+.75*smooth((a-.83)/.34));
   if(g.m.parent!==house)house.attach(g.m);
   let mouth=local(house,world(nose,0,-.07,.017));
   let palm=local(house,world(forepaws[1-i],0,.018,.143));
   if(a<1.20)g.m.position.copy(mouth).lerp(palm,smooth((a-.83)/.37));
   else if(a<1.84){
     if(!action.fromPaw)action.fromPaw=palm;
     let f=clamp((a-1.20)/.64);
     g.m.position.copy(action.fromPaw).lerp(action.impact,f);
     g.m.position.y=mix(action.fromPaw.y,action.impact.y,f*f);
     g.m.rotation.x=f*1.2;
   }else{
     let f=clamp((a-1.84)/.47),ease=1-(1-f)**2;
     g.m.position.copy(action.impact).lerp(action.settle,ease);
     g.m.rotation.set(mix(1.2,.08,ease),s*(.49+.33*ease),Math.sin(f*Math.PI)*.14);
   }
 }
 if(a>=2.32){pouches[i].shift();g.state='pile';g.m.position.copy(action.settle);g.m.scale.setScalar(1);pile.push(g);clockState.unlocked=true;action.unpacking=null;if(loaded())startUnpack();else state('groom')}
 }else if(action.name==='groom'){
 pose.low=.71;pose.nod=.055;let f=smooth(a/.75)*(1-smooth((a-3.9)/1.0));for(let i=0;i<2;i++){let q=(Math.sin(t*6+i*.5)+1)/2;pose.paws[i].lerp(local(animal,world(face,(i?1:-1)*(.12+.23*q),1.34+.30*q,.65-.28*q)),f)}pose.look=Math.sin(t*2)*.09;if(a>5.3)state('idle')
 }
 poseAnimal(t,pose);
 if(action.name==='take'&&action.focus.state==='held'){
 let g=action.focus,u=action.time/(action.inside?.87:1),f=smooth((u-2.53)/.48),mouth=smooth((u-4.72)/1.38);
 let hands=world(forepaws[0],0,0,.127).lerp(world(forepaws[1],0,0,.127),.5);
 g.m.position.copy(action.grabFrom).lerp(hands,f).lerp(world(nose,0,-.079,.009),mouth);
 g.m.rotation.set(mix(.05,.97,mouth),mix(g.turn.y,hamster.rotation.y+1.22,smooth((u-3.3)/1.25)),.18*mouth);
 let shrink=1-smooth((u-5.6)/.83);g.m.scale.set(.9+.1*shrink,.8+.2*shrink,Math.max(.015,shrink));g.m.visible=shrink>.015}
}
const hand=group(stage),fingerMat=material(0xf8dfc2,.65,{transparent:true,opacity:0,depthWrite:false}),nailMat=material(0xffeddd,.42,{transparent:true,opacity:0,depthWrite:false});
const fingertip=group(hand);fingertip.rotation.z=-.40;fingertip.rotation.x=.43;
fingerMat.vertexColors=true;
const demoFinger=turn(fingertip,fingerMat,[[.009,0],[.057,.015],[.086,.048],[.105,.098],[.111,.15],[.106,.23],[.109,.29],[.115,.34],[.108,.42],[.110,.49],[.107,.59],[.09,.64]],0,0,0,36);
const fingerVertices=demoFinger.geometry.attributes.position,fingerColors=[];
for(let i=0;i<fingerVertices.count;i++){
 let y=fingerVertices.getY(i);
 fingerVertices.setZ(i,fingerVertices.getZ(i)-y*y*.24);
 fingerColors.push(1,1,1,1-smooth((y-.42)/.22));
}
demoFinger.geometry.setAttribute('color',new T.Float32BufferAttribute(fingerColors,4));demoFinger.geometry.computeVertexNormals();
oval(fingertip,nailMat,0,.106,.103,.068,.084,.019);
hand.traverse(o=>{o.castShadow=false;o.receiveShadow=false});hand.visible=false;
const hintParts={wheel:thumb,door:doorKnob.children[1],chute:chuteKnob,scoop:scoopBowl};
for(let k in hintParts){let m=hintParts[k];m.material=m.material.clone();m.material.emissive.setHex(0xc68c48);m.material.emissiveIntensity=0}
let adjustedOutlet=false;
function currentHint(){
 if(gesture||spoon.flight||shutter.auto||plate.auto)return '';
 if(['approach','take','look','travel','unpack','groom'].includes(action.name))return '';
 if(grains.some(g=>['fall','roll','drop','chute'].includes(g.state)))return '';
 if(clockState.unlocked&&shutter.fraction<1&&clockState.visits===1&&!shutter.everOpened)return 'door';
 if(shutter.view>.9&&!adjustedOutlet)return 'chute';
 if(holes.every(h=>h.grains.length<=1))return shutter.view>.65?'door':'scoop';
 return 'wheel'}
function hints(t){
 let name=currentHint();for(let k in hintParts)hintParts[k].material.emissiveIntensity=k===name?.065+.075*(.5+.5*Math.sin(t*2.3)):0;
 let idle=t-clockState.lastInput,phase=(idle-4)%7.7,show=name&&idle>4&&phase>=0&&phase<2.6;
 hand.visible=!!show;if(!show)return;
 let f=smooth((phase-.50)/1.52),opacity=.34*smooth(phase/.39)*(1-smooth((phase-2.04)/.55));
 let target;if(name==='wheel'){let angle=shutter.view>.65?1.31+.28*f:plate.angle-.27+.39*f;target=world(wheelStand,1.53*Math.sin(angle),1.48,1.53*Math.cos(angle))}
 else if(name==='door')target=world(doorKnob,-1.16+f*.85,1.26,.29);
 else if(name==='scoop')target=world(scoop,-.86+.67*f,.22+.36*f,.01);
 else target=world(chute,.24*f,.28,.05);
 hand.position.copy(target);hand.position.y+=.042+.16*(1-smooth(phase/.48));hand.scale.setScalar(view.portrait?.86:1);fingerMat.opacity=opacity;nailMat.opacity=opacity*.70}
function setDoor(f){
 shutter.fraction=clamp(f);door.position.x=shutter.fraction*3.22;
 if(shutter.fraction>.993){shutter.everOpened=true;if(!action.inside&&action.name==='idle')goIn()}
}
function screenPos(p){let u=p.clone().project(camera);return new T.Vector2((u.x+1)*canvas.clientWidth*.5,(1-u.y)*canvas.clientHeight*.5)}
function rayAt(e){let rect=canvas.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,1-(e.clientY-rect.top)/rect.height*2);ray.setFromCamera(pointer,camera)}
function onPlane(y){let p=V();return ray.ray.intersectPlane(new T.Plane(V(0,1,0),-y),p)?p:null}
function wheelAngle(){let p=onPlane(world(wheelStand,0,1.45,0).y);if(!p)return 0;p=local(wheelStand,p);return Math.atan2(p.x,p.z)}
const solidShell=[body,...hindpaws.flatMap(p=>p.children)];
house.traverse(o=>{
 if(!o.isMesh||o===glass)return;
 for(let ancestor=o;ancestor;ancestor=ancestor.parent)if(ancestor===door||ancestor===chute)return;
 solidShell.push(o);
});
function pickTool(e){
 rayAt(e);let options=[[wheelHot,'wheel'],[scoop,'scoop']];
 if(clockState.unlocked)options.push([door,'door']);
 if(shutter.fraction>.5)options.push([chute,'chute']);
 let nearest=null;for(let [obj,kind] of options){let hit=ray.intersectObject(obj,true).find(h=>h.object.visible);if(hit&&(!nearest||hit.distance<nearest.distance))nearest={kind,distance:hit.distance,point:hit.point}}
 if(nearest){
 let limit=ray.far;ray.far=nearest.distance-.055;
 let obscured=ray.intersectObjects(solidShell,false).length>0;ray.far=limit;
 if(obscured)return null;
 }
 return nearest}
function grainPour(index){
 let h=holes[index],space=8-h.grains.length,count=Math.min(space,scoopSeeds.children.length);if(count<=0)return;
 for(let j=0;j<count;j++){
 let m=scoopSeeds.children[scoopSeeds.children.length-1],from=world(m);let g=addToWell(index,m.geometry===kernels[1]?1:0,m);
 g.landLocal=m.position.clone();g.from=from;g.state='refill';g.age=-j*.046;stage.attach(m);m.position.copy(from)}
 knock('soft',.7);if(plate.firstLatch&&!plate.first)plate.firstLatch=false
}
function startSpoon(index,fromDrag=false){
 if(spoon.flight)return;let h=holes[index],target=world(wheelHot,h.x,1.87,h.z);
 let f={age:0,index,start:scoop.position.clone(),target,fromDrag,poured:false,restRotation:view.portrait?.12:-.23};spoon.flight=f}
function updateSpoon(dt){
 let f=spoon.flight;if(!f)return;f.age+=dt;let t=f.age,reach=f.fromDrag?.23:.78;
 if(t<reach){let u=t/reach;scoop.position.copy(atom(f.start,f.target,u));scoop.position.y+=Math.sin(Math.PI*u)*(f.fromDrag?.10:.35)}
 else if(t<reach+.70){scoop.position.copy(f.target);scoop.rotation.z=-.85*Math.sin(Math.PI*clamp((t-reach)/.7));if(!f.poured&&t>reach+.28){grainPour(f.index);f.poured=true}}
 else{let u=clamp((t-reach-.70)/.71);scoop.rotation.z=0;scoop.position.copy(atom(f.target,spoon.rest,u));scoop.position.y+=Math.sin(Math.PI*u)*.22;
 if(u===1){spoon.flight=null;fillSpoon()}}}
function nearestHole(p){let best=0,d=Infinity;holes.forEach((h,i)=>{let a=world(wheelHot,h.x,1.56,h.z),v=(p.x-a.x)**2+(p.z-a.z)**2;if(v<d){d=v;best=i}});return {index:best,d:Math.sqrt(d)}}
canvas.addEventListener('pointerdown',e=>{
 if(gesture||e.button>0)return;beginAudio();let hit=pickTool(e);if(!hit)return;e.preventDefault();canvas.setPointerCapture(e.pointerId);
 let t=clockState.now;clockState.lastInput=t;hand.visible=false;let g=gesture={kind:hit.kind,id:e.pointerId,x:e.clientX,y:e.clientY,moved:false,when:t,value:0,lastAngle:0};
 if(g.kind==='wheel'){
 clockState.started=true;plate.auto=null;g.lastAngle=wheelAngle();g.side=local(wheelStand,hit.point).x<0?0:1;
 if(plate.first){g.intro=true;plate.auto={from:plate.angle,to:plate.angle+.208,duration:.32,elapsed:0,intro:true};knock('wood',.56)}
 else{plate.firstLatch=false;plate.lastMove=t}}
 else if(g.kind==='door'){
 shutter.auto=null;g.value=shutter.fraction;let p=screenPos(world(house,0,1.17,hd+.30)),q=screenPos(world(house,3.22,1.17,hd+.30));g.span=Math.max(canvas.clientWidth*.31,p.distanceTo(q));knock('wood',.25)}
 else if(g.kind==='chute'){g.value=outlet.amount;adjustedOutlet=true;knock('wood',.25)}
 else if(g.kind==='scoop'&&!spoon.flight){scoop.position.y+=.10;knock('soft',.4)}
});
canvas.addEventListener('pointermove',e=>{
 if(!gesture||gesture.id!==e.pointerId){if(e.pointerType==='mouse')canvas.style.cursor=pickTool(e)?'grab':'default';return}
 e.preventDefault();let g=gesture,dx=e.clientX-g.x,dy=e.clientY-g.y;clockState.lastInput=clockState.now;rayAt(e);canvas.style.cursor='grabbing';
 if(Math.hypot(dx,dy)>4)g.moved=true;if(!g.moved)return;
 if(g.kind==='wheel'){if(plate.first){discharge(plate.angle,.016,true)}plate.firstLatch=false;plate.auto=null;let a=wheelAngle();rotateWheel(clamp(angleDiff(a,g.lastAngle),-.85,.85),.016);g.lastAngle=a}
 else if(g.kind==='door')setDoor(g.value+dx/g.span);
 else if(g.kind==='chute')setOutlet(g.value+dx/(canvas.clientWidth*.27)-dy/(canvas.clientHeight*1.3));
 else if(g.kind==='scoop'&&!spoon.flight){let p=onPlane(world(wheelStand,0,1.95,0).y);if(p){scoop.position.copy(p);let h=nearestHole(p);scoop.rotation.z=-.51*clamp(1-h.d/.63);if(h.d<.32&&holes[h.index].grains.length<8)startSpoon(h.index,true)}}
});
function finishPointer(e,cancel=false){
 if(!gesture||gesture.id!==e.pointerId)return;let g=gesture;gesture=null;clockState.lastInput=clockState.now;
 if(!cancel&&!g.moved){
 if(g.kind==='wheel'&&!g.intro)idleTap(g.side);
 else if(g.kind==='door')shutter.auto={from:shutter.fraction,to:shutter.fraction>.55?0:1,age:0};
 else if(g.kind==='chute')setOutlet(outlet.amount>.5?.025:.98);
 else if(g.kind==='scoop'&&!spoon.flight){let index=holes.reduce((a,h,i)=>h.grains.length<holes[a].grains.length?i:a,0);startSpoon(index)}}
 if(g.kind==='scoop'&&!spoon.flight){scoop.position.copy(spoon.rest);scoop.rotation.z=0}
 canvas.style.cursor=e.pointerType==='mouse'?'grab':'default';if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId)}
canvas.addEventListener('pointerup',e=>finishPointer(e));canvas.addEventListener('pointercancel',e=>finishPointer(e,true));canvas.addEventListener('lostpointercapture',e=>finishPointer(e,true));
canvas.addEventListener('contextmenu',e=>e.preventDefault());
function tick(dt){
 clockState.now+=dt;
 if(plate.auto){let a=plate.auto;a.elapsed+=dt;let f=clamp(a.elapsed/a.duration),target=mix(a.from,a.to,smooth(f));rotateWheel(target-plate.angle,dt);
 if(a.intro&&f>.36&&plate.first)discharge(plate.angle,dt,true);if(f===1)plate.auto=null}
 else discharge(plate.angle,dt);
 if(shutter.auto){shutter.auto.age+=dt;let f=clamp(shutter.auto.age/.92);setDoor(mix(shutter.auto.from,shutter.auto.to,smooth(f)));if(f===1)shutter.auto=null}
 let want=shutter.fraction>.992?1:shutter.fraction<.94?0:shutter.view;
 shutter.view+=clamp(want-shutter.view,-dt*.68,dt*.57);cameraPose();
 let activePort=shutter.view>.5?2:plate.direction>0?0:1;
 for(let i=0;i<gates.length;i++){let e=gatePorts[i];gates[i].position.x=mix(gates[i].position.x,e.x+(i===activePort?.70:0),Math.min(1,dt*22))}
 updateGrains(dt);updateSpoon(dt);updateAnimal(dt);hints(clockState.now);
}
function frame(stamp){let dt=lastStamp?Math.min(.055,(stamp-lastStamp)/1000):.016;lastStamp=stamp;tick(dt);renderer.render(scene,camera);requestAnimationFrame(frame)}
layout(true);basePose(0);poseAnimal(0,pose);window.addEventListener('resize',()=>layout(false));document.addEventListener('visibilitychange',()=>{lastStamp=0});requestAnimationFrame(frame);
