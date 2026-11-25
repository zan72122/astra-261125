'use strict';
const saveKey='korokoro-koneko.morning.3';
const state={travel:0,yaw:0,started:false,seconds:0,sent:0,loads:0,turns:0,rest:false,restRequest:false,preference:[0,0,0],arrivals:[0,0,0],lastNose:null,restAt:null,nextId:1};
let foods=[],clock=0,lastInput=0,drag=null,lift=0,desiredLift=0,pulse=0,press=0;
let seatGoal=null,guideShown=false,restSince=-10,lastWood=-10,lastCeramic=-10,saveClock=0,dirty=true;
let audioContext=null,master=null;
function listen(){
 try{
 if(!audioContext){audioContext=new (window.AudioContext||window.webkitAudioContext)();master=audioContext.createGain();master.gain.value=.26;master.connect(audioContext.destination)}
 if(audioContext.state==='suspended')audioContext.resume().catch(()=>{});
 }catch{}
}
function sound(kind,force=1,pitch=1){
 if(!audioContext||audioContext.state!=='running')return;
 const ctx=audioContext,t=ctx.currentTime,vol=clamp(force,.08,1.3);
 const modes=kind==='china'?[[1086,.31,.54],[1913,.173,.17],[3119,.075,.09],[684,.106,.12]]:
 kind==='wood'?[[242,.074,.35],[389,.045,.28],[534,.032,.095]]:
 kind==='creak'?[[191,.105,.095],[276,.15,.075],[409,.062,.052]]:
 kind==='bite'?[[859,.024,.13],[1413,.034,.11]]:[[449,.029,.09],[715,.034,.065]];
 for(const [freq,decay,level] of modes){
 const osc=ctx.createOscillator(),gain=ctx.createGain();osc.type=kind==='creak'?'triangle':'sine';
 osc.frequency.setValueAtTime(freq*pitch,t);osc.frequency.exponentialRampToValueAtTime(freq*pitch*(kind==='creak'?.76:.993),t+decay);
 gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(level*vol,t+.0025);gain.gain.exponentialRampToValueAtTime(.0001,t+decay*1.9);
 osc.connect(gain);gain.connect(master);osc.start(t);osc.stop(t+decay*2)
 }
 if(kind==='bite'||kind==='wood'||kind==='creak'){
 let dur=kind==='creak'?.118:.034,buffer=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*dur),ctx.sampleRate),d=buffer.getChannelData(0);
 for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.exp(-7*i/d.length);
 let src=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),g=ctx.createGain();src.buffer=buffer;filter.type='bandpass';filter.frequency.value=kind==='bite'?3000:803;g.gain.value=.36*vol;src.connect(filter);filter.connect(g);g.connect(master);src.start(t)
 }
}
const oatMap=texture(128,128,(c,w,h)=>{
 c.fillStyle='#d3ae82';c.fillRect(0,0,w,h);
 for(let i=0;i<8600;i++){let v=rand();c.fillStyle=v<.4?'rgba(99,65,45,.39)':v<.7?'rgba(252,223,164,.64)':'rgba(155,102,60,.39)';let x=rand()*w,y=rand()*h;c.fillRect(x,y,.4+rand()*1.9,.4+rand()*1.5)}
});
const morselMats=[0xc18b58,0xba8655,0xb58251,0xc38e5b].map(c=>mat(c,.96,{map:oatMap,bumpMap:oatMap,bumpScale:.006,envMapIntensity:.18})),fractureMat=mat(0xbd915e,.98);
const grainShape=[],crumbShape=[];
for(let k=0;k<6;k++){
 const g=new T.SphereGeometry(1,22,16),p=g.attributes.position;
 for(let i=0;i<p.count;i++){let x=p.getX(i),y=p.getY(i),z=p.getZ(i);
 const dent=.117*Math.exp(-((x-.33)**2+(y-.32)**2+(z-.86)**2)/.068);
 const r=1+.034*Math.sin(8*x+k)*Math.cos(6.1*y+z*4)+.021*Math.cos(12*z-3*y+k)-dent;
 p.setXYZ(i,x*r*(1+.022*k),y*r*.90,z*r)}
 g.computeVertexNormals();grainShape.push(g);
 const cg=new T.CylinderGeometry(.54+.06*k,.70,.59,3+k%3,1);cg.rotateZ(.10*k);cg.rotateY(k*.44);crumbShape.push(cg);
}
const hand=group(scene),skin=mat(0xffead1,.63,{transparent:true,opacity:0,depthWrite:false});
const finger=group(hand);finger.rotation.x=-.28;finger.rotation.z=.52;
lathe(finger,0,0,0,[[0,0],[.044,.012],[.078,.052],[.091,.107],[.090,.19],[.084,.26],[.096,.37],[.098,.425],[.086,.462],[.041,.477],[0,.48]],skin,32).castShadow=false;
const nail=ball(finger,0,.10,.076,.048,.066,.015,skin);nail.castShadow=false;
hand.visible=false;hand.renderOrder=10;
function addFood(initial={}){
 const id=initial.id||state.nextId++,variant=id%6,r=initial.crumb?.056:.101+(id%5)*.002;
 const obj=mesh(scene,(initial.crumb?crumbShape:grainShape)[variant],initial.crumb?[morselMats[id%4],fractureMat,fractureMat]:morselMats[id%4]);
 obj.scale.setScalar(r);
 const f=Object.assign({id,mode:'bowl',bowlLevel:0,x:0,y:0,z:0,s:0,u:0,vs:0,vu:0,vx:0,vy:0,vz:0,rx:id*.72,ry:id*1.28,rz:id*.31,route:0,t:0,nudged:false,crumb:false,settled:0,hitAt:-5,r,obj},initial);
 f.obj=obj;f.r=r;obj.userData.food=f;foods.push(f);return f
}
function fillBowl(level=state.travel>=.99?1:0){
 const existing=foods.filter(f=>f.mode==='bowl'&&f.bowlLevel===level);
 if(existing.length>=9)return;
 const slots=[[0,0,.18]];
 for(let k=0;k<7;k++)slots.push([.235*Math.cos(k*.897),.235*Math.sin(k*.897),.204]);
 for(let k=0;k<12;k++)slots.push([.422*Math.cos(k*.524+.23),.422*Math.sin(k*.524+.23),.277]);
 for(let k=0;k<5;k++)slots.push([.194*Math.cos(k*1.257+.22),.194*Math.sin(k*1.257+.22),.361]);
 for(const [x,z,y] of slots){if(!existing.some(f=>Math.hypot(f.u-x,f.s-z,f.y-y)<.16))addFood({mode:'bowl',bowlLevel:level,u:x,s:z,y})}
}
function foodPos(f){
 if(f.mode==='track')return lever.localToWorld(V(f.u,trackHeight(f.s)+f.r*.90+.055*(f.u/.32)**2,f.s));
 if(f.mode==='bowl')return bowls[f.bowlLevel].localToWorld(V(f.u,f.y,f.s));
 if(f.mode==='branch'){let p=branches[f.route-1].getPointAt(clamp(f.t));p.y+=.083+f.r;return p}
 return V(f.x,f.y,f.z)
}
function poseFood(f){f.obj.position.copy(foodPos(f));f.obj.rotation.set(f.rx,f.ry,f.rz)}
function setPos(f,p){f.x=p.x;f.y=p.y;f.z=p.z}
function preference(){
 if(state.travel<.98)return 0;
 const l=state.preference[1],r=state.preference[2];
 if(Math.abs(l-r)<.33*Math.max(.5,l,r))return -1;
 return l>r?1:2
}
let alert={at:-30,point:V(.4,.15,-.33),kind:'wait',route:0},sniff=null,eating=null,nosedUntil=0;
function cue(point,kind,route){alert={at:clock,point:point.clone(),kind,route};if(kind==='china')sniff=null}
function woodCue(){
 if(clock-lastWood<.28)return;lastWood=clock;sound('creak',.77,.97+.04*Math.random());
 if(clock-lastCeramic<1.6)return;
 const k=preference();let p;
 if(k<0)p=V(0,lowerFloor+.3,3.82+lowerOffset);
 else if(state.lastNose&&state.lastNose.route===k)p=V(state.lastNose.x,state.lastNose.y,state.lastNose.z);
 else p=k===0?lever.localToWorld(V(0,.12,-railLength)):branches[k-1].getPointAt(1);
 cue(p,'wood',k)
}
function wake(){
 if(state.rest){restSince=-10;state.rest=false;forelegs[0].position.y=.055}
 state.restRequest=false;dirty=true
}
function orientScene(){
 const t=state.travel,e=smooth(t),portrait=camera.aspect<.79;
 swivel.position.copy(transferPoint(t));swivel.rotation.y=mix(upperYaw,0,e)+state.yaw*.159*e;
 lever.rotation.x=(.036-lift+press)*(1-Math.sin(t*Math.PI));
 supply.position.set(portrait?-2.57:-2.58,0,portrait?.98:.10);
 guide.visible=guideShown||t>0;
 for(let i=0;i<3;i++)dishes[i].g.rotation.y=dishes[i].angle;
}
function setCamera(){
 const t=smooth(state.travel),a=camera.aspect;
 const portrait=1-smooth((a-.62)/.50);
 const az=mix(mix(-.055,-.79,portrait),mix(.34,-.22,portrait),t),el=mix(mix(.548,.69,portrait),mix(.18,.26,portrait),t);
 const target=V(mix(-.09,0,t),mix(mix(.87,.62,portrait),lowerFloor+.76,t),mix(-.07,4.72+lowerOffset,t));
 const dist=mix(7.75,7.70,t),h=Math.max(mix(4.51,4.17,t),mix(mix(6.32,3.89,portrait),mix(5.30,3.88,portrait),t)/a);
 camera.fov=2*Math.atan(h/(2*dist))*180/Math.PI;
 camera.position.copy(target).add(V(Math.sin(az)*Math.cos(el)*dist,Math.sin(el)*dist,Math.cos(az)*Math.cos(el)*dist));
 camera.lookAt(target);camera.updateProjectionMatrix();camera.updateMatrixWorld()
}
function resize(){camera.aspect=innerWidth/innerHeight;renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.75));renderer.setSize(innerWidth,innerHeight,false);orientScene();setCamera()}
function normalizedDish(d,x,z){
 let dx=x-d.x,dz=z-d.z,c=Math.cos(d.angle),s=Math.sin(d.angle);
 return [(c*dx-s*dz)/d.a,(s*dx+c*dz)/d.b]
}
function dishRadius(d,x,z){return Math.hypot(...normalizedDish(d,x,z))}
function surfaceY(d,x,z){let r=dishRadius(d,x,z);return d.y+.127+.157*Math.pow(Math.min(1,r),3.4)}
function dishBelow(x,z,y){
 for(let i=0;i<3;i++){let d=dishes[i];if(y>=d.y-.05&&dishRadius(d,x,z)<.995)return i}return -1
}
function floorY(x,z){return z>2.43?lowerFloor:0}
function landDish(f,i){
 const d=dishes[i];f.mode='dish';f.route=i;f.y=surfaceY(d,f.x,f.z)+f.r*.90;f.settled=0;
 const impact=Math.max(0,-f.vy);f.vx*=.80;f.vz*=.80;f.vy=0;
 if(f.crumb){sound('grain',.22,1.48);return}
 // A projecting lip returns a head-on grain. A glancing impact keeps its tangential speed.
 let [lx,lz]=normalizedDish(d,f.x,f.z),angle=Math.atan2(lz,lx),lipFacing=Math.cos(angle+1.08);
 const raised=smooth((lipFacing-.43)/.49);
 if(raised>0){
 const c=Math.cos(d.angle),s=Math.sin(d.angle),nx=-(c*lx/d.a+s*lz/d.b),nz=-(-s*lx/d.a+c*lz/d.b),length=Math.hypot(nx,nz)||1;
 const kick=impact*.70*raised;
 f.vx=f.vx*(1-.73*raised)+kick*nx/length;
 f.vz=f.vz*(1-.73*raised)+kick*nz/length;
 if(raised>.55){f.hop=.037*raised;f.hopTime=0}
 }
 let steering=Math.sin(d.angle+.78);f.vz-=.15*steering;f.vx+=.12*steering;
 sound('china',f.crumb?.22:.87,1+.08*i+(f.id%7)*.012);
 lastCeramic=clock;state.arrivals[i]++;state.preference=state.preference.map(v=>v*.82);state.preference[i]+=1;
 cue(V(f.x,f.y,f.z),'china',i);dirty=true;
}
function discharge(f){
 state.sent++;dirty=true;
 if(state.travel>.985){
  f.route=state.yaw>=0?1:2;f.mode='branch';f.t=0;f.speed=f.route===1?.97+.17*Math.abs(f.vs):.245+.027*Math.abs(f.vs);f.taps=0;sound('wood',.31,1.13);
 }else{
 const p=foodPos(f),sp=clamp(-f.vs,.65,3.05),q=swivel.rotation.y;setPos(f,p);f.mode='fall';f.vx=-Math.sin(q)*sp+f.vu*Math.cos(q);f.vz=-Math.cos(q)*sp-f.vu*Math.sin(q);f.vy=-.09-.25*lift;f.route=0;
 }f.nudged=false;f.settled=0
}
function trayMotion(f,dt){
 const s=f.s,deriv=.012+.148*(s-.14)/.09*Math.exp(-Math.pow((s-.14)/.30,2));
 const slope=Math.sin(lever.rotation.x)-deriv;
 if(Math.abs(slope)>.042||Math.abs(f.vs)>.025)f.vs+=slope*8.3*dt;else f.vs=0;
 f.vs*=Math.exp(-dt*(Math.abs(f.vs)<.18?3.6:.58));f.vu+=-f.u*9*dt;f.vu*=Math.exp(-3.0*dt);
 f.s+=f.vs*dt;f.u+=f.vu*dt;f.rx+=f.vs*dt/f.r;f.rz-=f.vu*dt/f.r;
 if(Math.abs(f.u)>.196){f.u=Math.sign(f.u)*.196;if(Math.abs(f.vu)>.08)sound('wood',.26,1.22);f.vu*=-.47}
 if(f.s>1.26){f.s=1.26;f.vs=-Math.abs(f.vs)*.22}
 if(f.s<-railLength-.008)discharge(f)
}
const contactLoads=new Map();
function bump(a,b,track){
 const ax=track?'u':'x',az=track?'s':'z',vx=track?'vu':'vx',vz=track?'vs':'vz';
 let dx=b[ax]-a[ax],dz=b[az]-a[az],dist=Math.hypot(dx,dz),threshold=(a.r+b.r)*.97;
 const pair=track?Math.min(a.id,b.id)+'/'+Math.max(a.id,b.id):null;
 if(dist>=threshold){if(track&&dist>threshold+.07)contactLoads.delete(pair);return}
 if(dist<.001){dx=.003;dz=.001;dist=Math.hypot(dx,dz)}
 const nx=dx/dist,nz=dz/dist,dep=(threshold-dist)*.51;
 a[ax]-=nx*dep;a[az]-=nz*dep;b[ax]+=nx*dep;b[az]+=nz*dep;
 let approach=(a[vx]-b[vx])*nx+(a[vz]-b[vz])*nz;
 if(approach>.012){
 const j=approach*.78;a[vx]-=j*nx;a[vz]-=j*nz;b[vx]+=j*nx;b[vz]+=j*nz;
 if(track&&lift>.18){
 const lead=a.s<b.s?a:b,behind=lead===a?b:a;
 let pressure=contactLoads.get(pair)||0;pressure+=approach;
 // Two touching grains carry a contact load up the shallow shoulder. On clearing
 // it, its sideways normal is no longer balanced by the bottom of the hollow.
 if(lead.s<-.035&&lead.s>-.45&&pressure>.11&&clock-Math.max(a.hitAt,b.hitAt)>.16){
 const side=Math.sign(lead.u-behind.u)||1;
 lead.vu+=side*(1.12+.32*Math.min(pressure,1));lead.vs*=.72;behind.vu-=side*.15;behind.vs-=.22;
 sound('wood',.56,.94);a.hitAt=b.hitAt=clock;pressure=0
 }
 contactLoads.set(pair,pressure)
 }
 if(approach>.1&&clock-Math.max(a.hitAt,b.hitAt)>.13){sound(track?'wood':'grain',Math.min(.8,approach+.13),.9+.02*(a.id%9));a.hitAt=b.hitAt=clock}
 }
}
function looseMotion(f,dt){
 const plate=f.mode==='dish',d=dishes[f.route];
 if(plate){
 const [x,z]=normalizedDish(d,f.x,f.z),rr=Math.hypot(x,z);
 if(rr>.63){
 let strength=(rr-.63)**2*14,c=Math.cos(d.angle),s=Math.sin(d.angle),ax=x/d.a,az=z/d.b;
 f.vx-=strength*(c*ax+s*az)*dt;f.vz-=strength*(-s*ax+c*az)*dt;
 }
 const lobe=Math.max(0,Math.cos(Math.atan2(z,x)+1.08))**8;
 const edge=.961-.074*lobe;
 if(rr>edge){
 const c=Math.cos(d.angle),s=Math.sin(d.angle),u=x/d.a,v=z/d.b;
 let nx=c*u+s*v,nz=-s*u+c*v,len=Math.hypot(nx,nz);nx/=len;nz/=len;
 const outward=nx*f.vx+nz*f.vz;
 if(outward>0){
 const bounce=.19+.55*lobe;f.vx-=(1+bounce)*outward*nx;f.vz-=(1+bounce)*outward*nz;
 if(lobe>.48&&outward>.22&&!f.crumb){f.hop=.073;f.hopTime=0;sound('china',.26,1.26)}
 }
 f.x=d.x+(f.x-d.x)*edge/rr;f.z=d.z+(f.z-d.z)*edge/rr;
 }
 }
 let speed=Math.hypot(f.vx,f.vz),friction=f.crumb?2.8:plate?.28:.60,ratio=speed?Math.max(0,1-friction*dt/speed)*Math.exp(-(plate?1.0:1.5)*dt):0;
 f.vx*=ratio;f.vz*=ratio;f.x+=f.vx*dt;f.z+=f.vz*dt;
 if(!plate){const low=f.route>0;let zmin=low?2.51:-3.75,zmax=low?8.79:2.26;if(f.z<zmin||f.z>zmax){f.z=clamp(f.z,zmin,zmax);f.vz*=-.24}
 if(Math.abs(f.x)>4.14){f.x=Math.sign(f.x)*4.14;f.vx*=-.26}}
 f.y=(plate?surfaceY(d,f.x,f.z):floorY(f.x,f.z))+(f.crumb?.019:f.r*.90);f.rx+=f.vz*dt/f.r;f.rz-=f.vx*dt/f.r;
 if(f.hop){f.hopTime+=dt;f.y+=f.hop*Math.sin(Math.PI*clamp(f.hopTime/.19));if(f.hopTime>=.19)f.hop=0}
 f.settled=speed<.09?f.settled+dt:0
}
function receiveDrop(f){
 const p=V(f.x,f.y,f.z);
 for(let i=0;i<bowls.length&&f.dropped;i++){const b=bowls[i].worldToLocal(p.clone());
 if(Math.hypot(b.x,b.z)<.50&&b.y>=.09&&b.y<.51){f.bowlLevel=i;
 f.mode='bowl';f.u=clamp(b.x,-.4,.4);f.s=clamp(b.z,-.4,.4);f.y=.20+.14*Math.hypot(b.x,b.z)/.50;f.dropped=false;sound('wood',.43,1.18);return}}
 const tr=lever.worldToLocal(p.clone()),h=trackHeight(tr.z)+f.r*.90;
 if(f.dropped&&Math.abs(tr.x)<.33&&tr.z>=-railLength&&tr.z<=1.48&&tr.y<=h+.046&&tr.y>h-.18){
 f.mode='track';f.s=clamp(tr.z,-1.48,1.25);f.u=clamp(tr.x,-.19,.19);f.vs=-.015;f.vu=0;f.dropped=false;state.loads++;sound('wood',.55,.91);return
 }
 const k=dishBelow(f.x,f.z,f.y);
 if(k>=0&&f.y<=surfaceY(dishes[k],f.x,f.z)+f.r*.90){landDish(f,k);f.dropped=false;return}
 let floor=floorY(f.x,f.z);if(f.y<=floor+f.r*.90){f.mode='floor';f.route=floor<0?1:0;f.y=floor+f.r*.9;f.vy=0;f.vx*=.59;f.vz*=.59;f.dropped=false;sound('wood',.32,.83);cue(V(f.x,f.y,f.z),'floor',f.route)}
}
function foodFrame(dt){
 const onTrack=[],loose=[];
 for(const f of foods){
 if(f.mode==='track'){
 if(state.started&&!(state.travel>0&&state.travel<1)&&drag?.type!=='carry')trayMotion(f,dt);
 else{f.vu*=Math.exp(-dt*4);f.u+=f.vu*dt;f.u=clamp(f.u,-.19,.19)}
 if(f.mode==='track')onTrack.push(f);
 }else if(f.mode==='branch'){
 const prev=f.t;f.t+=dt*f.speed;f.rx-=dt*f.speed*16;
 if(f.route===2&&([.36,.72].some(v=>prev<v&&f.t>=v)))sound('wood',.50,prev<.36?1.19:.94);
 if(f.t>=1){const end=branches[f.route-1].getPointAt(1),dir=branches[f.route-1].getTangentAt(1);f.mode='fall';setPos(f,end);f.y+=.082+f.r;f.vx=dir.x*.77;f.vz=dir.z*.77;f.vy=-.18}
 }else if(f.mode==='fall'){
 f.vy-=9.2*dt;f.x+=f.vx*dt;f.y+=f.vy*dt;f.z+=f.vz*dt;f.rx+=f.vz*dt/f.r;f.rz-=f.vx*dt/f.r;receiveDrop(f);
 }else if(f.mode==='dish'||f.mode==='floor'){looseMotion(f,dt);loose.push(f)}
 }
 for(let i=0;i<onTrack.length;i++)for(let j=i+1;j<onTrack.length;j++)bump(onTrack[i],onTrack[j],true);
 for(let i=0;i<loose.length;i++)for(let j=i+1;j<loose.length;j++){let a=loose[i],b=loose[j];if(a.mode===b.mode&&a.route===b.route)bump(a,b,false)}
}
function damp(a,b,k,dt){return mix(a,b,1-Math.exp(-k*dt))}
const homeCat=V(1.05,0,-1.57),lowCat=V(.04,lowerFloor,2.64+lowerOffset);
let blinkTime=3.4,blinkStart=-5,steps=0,earTime=0,chewTime=-10;
function finishBite(f,from){
 const mouth=foodPos(f),d=dishes[f.route],onPlate=dishRadius(d,from.x,from.z)<1;
 f.crumb=true;f.mode='fall';f.dropped=false;
 f.r=.054;f.obj.geometry=crumbShape[f.id%6];f.obj.material=[morselMats[f.id%4],fractureMat,fractureMat];f.obj.scale.setScalar(f.r);
 if(onPlate){
   const radius=dishRadius(d,mouth.x,mouth.z),scale=Math.min(1,.92/Math.max(.01,radius));
   f.x=d.x+(mouth.x-d.x)*scale;f.z=d.z+(mouth.z-d.z)*scale;
   f.y=Math.max(mouth.y,surfaceY(d,f.x,f.z)+.086);
 }
 f.vx=clamp((from.x-f.x)*1.5,-.27,.27);f.vz=clamp((from.z-f.z)*1.5,-.27,.27);
 f.vy=-.035;f.nudged=true;f.settled=0;f.rx=0;f.rz=0;
 chewTime=clock;sound('bite',.50,1.05);dirty=true
}
function inspectFood(f){
 const p=foodPos(f),close=foods.filter(b=>b!==f&&!b.crumb&&b.mode===f.mode&&b.route===f.route&&Math.hypot(b.x-f.x,b.z-f.z)<.50);
 state.lastNose={x:f.x,y:f.y,z:f.z,route:f.route};dirty=true;
 if(close.length&&close.some(b=>b.nudged||b.settled>.5)){
  f.mode='eating';eating={f,at:clock,from:p};for(const b of close){const dx=b.x-f.x,dz=b.z-f.z,l=Math.hypot(dx,dz)||1;b.vx+=.085*dx/l;b.vz+=.085*dz/l}
 }else{
 const dx=p.x-cat.position.x,dz=p.z-cat.position.z,l=Math.hypot(dx,dz)||1;
 f.vx=.282*dx/l;f.vz=.282*dz/l;f.nudged=true;f.settled=0;sound('grain',.33,1.1)
 }
 nosedUntil=clock+1.2;sniff=null
}
function catFrame(dt){
 const travel=state.travel,atLower=travel>.99,transit=travel>.0001&&!atLower;
 let age=clock-alert.at,rest=state.rest;
 if(clock>blinkTime){blinkStart=clock;blinkTime=clock+3.9+rand()*3.4}
 const blink=Math.pow(Math.max(0,1-Math.abs(clock-blinkStart-.095)/.095),.65);
 const preferred=preference(),base=homeCat.clone().lerp(lowCat,smooth(travel));
 if(atLower&&preferred>=1)base.x=damp(0,dishes[preferred].x,.9,1)*.8;
 const targetSpot=alert.point.clone();
 if(!sniff&&!eating&&!rest&&!transit&&clock>nosedUntil&&state.started&&age>.54){
 const pawsAt=cat.localToWorld(V(0,.14,.60));
 const candidates=foods.filter(f=>(f.mode==='dish'||f.mode==='floor')&&!f.crumb&&!f.nudged&&f.settled>.29&&((f.route>0)===atLower)&&Math.hypot(f.x-pawsAt.x,f.z-pawsAt.z)<(f.mode==='floor'?1.08:.89));
 candidates.sort((a,b)=>Math.hypot(a.x-targetSpot.x,a.z-targetSpot.z)-Math.hypot(b.x-targetSpot.x,b.z-targetSpot.z));
 if(candidates.length)sniff={f:candidates[0],at:clock}
 }
 if(sniff&&(rest||transit||!['floor','dish'].includes(sniff.f.mode)))sniff=null;
 let reach=0,look=V(.10,.37,-.16),goal=base.clone();
 if(rest&&state.restAt)goal.set(state.restAt.x,state.restAt.y,state.restAt.z);
 if(!rest&&!transit){
 if(age<4.2&&age>.25){look.copy(targetSpot);if(atLower&&age>.55&&preferred!==-1)goal.x=mix(base.x,targetSpot.x,.57)}
 if(sniff){const f=sniff.f;look.copy(foodPos(f));reach=smooth((clock-sniff.at)/.85);
 goal.x=look.x+(atLower?.10:.16);goal.z=look.z-1.04;
 }else if(eating){look.copy(eating.from);reach=1;goal.x=look.x+.13;goal.z=look.z-1.04}
 else if(state.lastNose&&age<3.1&&age>.6&&alert.kind==='wood'){
 reach=.46;goal.x=mix(base.x,targetSpot.x,.32);goal.z=mix(base.z,targetSpot.z-1.08,.45)
 }
 }
 if(!state.started)look.set(-.75,.65,1.47);
 // Each paw follows the current stride and the current tread, including a pause between the two.
 const before=cat.position.clone(),delta=goal.clone().sub(before);delta.y=0;
 const step=Math.min(delta.length(),dt*(transit||delta.length()>2.2?3.4:1.36));
 if(step>.0001)cat.position.addScaledVector(delta.normalize(),step);
 cat.position.y=damp(cat.position.y,lowerFloor*smooth((cat.position.z-1.89)/1.15),9,dt);
 steps+=step*8.2;const walking=clamp(step/dt);
 const restEase=rest?smooth((clock-restSince-.65)/.85):0;
 for(let i=0;i<2;i++){let phase=steps+Math.PI*i,s=i?1:-1;
 const move=walking*Math.max(0,Math.sin(phase));
 forelegs[i].position.x=damp(forelegs[i].position.x,s*(.278-.102*(rest?smooth((clock-restSince-.5-i*.28)/.62):0)),7,dt);
 forelegs[i].position.y=damp(forelegs[i].position.y,move*.104 + lowerFloor*smooth((cat.position.z+.57+s*.085-2.35)/.33)-cat.position.y,10,dt);
 forelegs[i].position.z=.44+(i?-.04:.04)-.11*restEase+.065*Math.sin(phase)*walking;
 }
 const neutralYaw=mix(-.32,0,smooth(travel));
 const yaw=rest?neutralYaw:clamp(Math.atan2(look.x-cat.position.x,Math.max(.35,look.z-cat.position.z)),-.80,.79);
 cat.rotation.y=damp(cat.rotation.y,state.started?neutralYaw*.51+yaw*.49:-.32,2.9,dt);
 torso.scale.y=damp(torso.scale.y,1-.31*reach-.072*restEase,4.1,dt);
 torso.position.z=.06*reach;torso.rotation.x=.026*Math.sin(clock*2.31)+reach*.15;
 body.scale.y=1+.013*Math.sin(clock*2.38);body.scale.x=1+.013*Math.sin(clock*2.38-.7);tail.rotation.z=.021*Math.sin(clock*1.13);
 cat.updateWorldMatrix(true,true);
 let localLook=cat.worldToLocal(look.clone());
 const wantedY=clamp(Math.atan2(localLook.x,Math.max(.4,localLook.z-.3)),-.64,.64);
 head.rotation.y=damp(head.rotation.y,rest?-.10:wantedY*(state.started?.86:.50),4.4,dt);
 head.rotation.x=damp(head.rotation.x,mix(rest?.04:state.started&&age<3?.13:-.13,.65,reach),4.4,dt);
 head.rotation.z=damp(head.rotation.z,.019*Math.sin(clock*.97)+(age<1.4?.041*Math.cos(age*2.1):0),4,dt);
 const neckGoal=V(-.022,1.59+.018*Math.sin(clock*2.38)-restEase*.14,.36);
 if(reach>0){const offset=V(0,-.139,.62).applyEuler(head.rotation);
 const low=localLook.clone().sub(offset);low.z-=.083;low.x=clamp(low.x,-.52,.52);low.z=clamp(low.z,.22,1.03);low.y=clamp(low.y,.48,1.14);
 neckGoal.lerp(low,reach)}
 headNeck.position.lerp(neckGoal,1-Math.exp(-5.6*dt));
 earTime+=dt;
 let earTarget=age<2.9?Math.sign(alert.point.x-cat.position.x):-.18;
 for(let i=0;i<2;i++){let s=i?1:-1;
 ears[i].rotation.y=damp(ears[i].rotation.y,(s===earTarget?.33:-.11)*earTarget*Math.exp(-.66*Math.max(0,age))+.060*Math.sin(earTime*.91+i*2),8,dt);
 ears[i].rotation.z=-s*.12 + (s===earTarget?.113*s*Math.exp(-Math.max(0,age)*3.5):0);
 eyes[i].opening.scale.y=1-.95*blink;
 const gaze=clock-alert.at>.13&&age<3.5?clamp((alert.point.x-cat.position.x)*.039,-.060,.060):-.016;
 eyes[i].material.map.offset.x=damp(eyes[i].material.map.offset.x,-gaze,7.4,dt)
 }
 if(sniff&&reach>.96){
 const f=sniff.f,tip=head.localToWorld(V(0,-.14,.62)),p=foodPos(f);
 if(tip.distanceTo(p)<f.r+.05)inspectFood(f)
 }
 if(eating){
 const t=clamp((clock-eating.at)/.36),f=eating.f,p=eating.from.clone().lerp(head.localToWorld(V(0,-.27,.539)),smooth(t));
 setPos(f,p);f.obj.scale.setScalar(f.r*(1-.67*t));if(t===1){finishBite(f,eating.from);eating=null}
 }
 const lick=rest&&clock-restSince>.25&&clock-restSince<.77;
 tongue.visible=lick;tongue.position.y=-.273+(lick?.142*Math.sin((clock-restSince-.25)*Math.PI/.52):0);
 tongue.rotation.z=lick?-.46:0;
 chin.position.y=-.323-(clock-chewTime<.68?.023*Math.sin((clock-chewTime)*19)**2:0);
 whiskers.scale.z=1-.082*reach;whiskers.rotation.x=.032*reach;
}
const ray=new T.Raycaster(),pointer=new T.Vector2();
function setRay(x,y){pointer.set(x/innerWidth*2-1,1-y/innerHeight*2);ray.setFromCamera(pointer,camera)}
function planeHit(y){const p=V();return ray.ray.intersectPlane(new T.Plane(V(0,1,0),-y),p)?p:null}
function projected(p){const q=p.clone().project(camera);return {x:(q.x+1)*.5*innerWidth,y:(1-q.y)*.5*innerHeight}}
function pick(x,y){
 setRay(x,y);const targets=[...foods.filter(f=>!['branch','fall','eating'].includes(f.mode)).map(f=>f.obj),lever,support,...bowls,...dishes.map(d=>d.g)];
 for(const hit of ray.intersectObjects(targets,true)){
 let obj=hit.object;if(obj.userData.food)return {type:'food',f:obj.userData.food};
 let root=obj;while(root&&root!==lever&&root!==support&&!bowls.includes(root)&&!dishes.some(d=>d.g===root))root=root.parent;
 if(root===lever||root===support){
 const p=lever.worldToLocal(hit.point.clone());
 if(root===lever&&p.z>.61)return {type:'lever'};
 if(Math.abs(p.z)<.49&&(guideShown||state.travel>0))return {type:'carry'};
 if(state.travel>.999&&root===lever)return {type:'lever'};
 return null
 }
 if(bowls.includes(root)){let available=foods.filter(f=>f.mode==='bowl'&&f.bowlLevel===bowls.indexOf(root));available.sort((a,b)=>b.y-a.y);if(available.length)return {type:'food',f:available[0]}}
 const i=dishes.findIndex(d=>d.g===root);if(i!==-1)return {type:'dish',i}
 }
 // A fingertip can overlap the curved edge while its centre is just beyond it.
 const handlePoint=projected(lever.localToWorld(V(0,.18,1.43)));
 if(Math.hypot(x-handlePoint.x,y-handlePoint.y)<Math.max(21,innerWidth*.016))return {type:'lever'};
 return null
}
function tapSend(first=false){
 const sorted=foods.filter(f=>f.mode==='track').sort((a,b)=>a.s-b.s);if(!sorted.length)return;
 const f=sorted[0];f.vs=-Math.max(first?1.23:1.35,1.44+.56*(f.s+.15));f.vu=(f.u*.55+(f.id%2?.026:-.026));pulse=first?.24:.29;press=first?.11:.072;sound('wood',.67,.88);dirty=true
}
function carryTo(t){
 const old=state.travel;state.travel=clamp(t);
 if(old!==state.travel){for(let f of foods)if(f.mode==='track')f.vu+=clamp((old-state.travel)*.76,-.08,.08);dirty=true}
 if(state.travel>=.999&&old<.999){state.travel=1;state.yaw=1;cue(branches[0].getPointAt(0),'wood',-1);sound('wood',.80,.80)}
}
function moveHeld(e,d){
 setRay(e.clientX,e.clientY);
 const surfaces=[lever,...dishes.map(v=>v.body),...bowls];
 const hit=ray.intersectObjects(surfaces,true)[0];
 let ground=planeHit(0);if(ground&&ground.z>2.44)ground=planeHit(lowerFloor);
 let at=hit&&(!ground||hit.distance<ray.ray.origin.distanceTo(ground)+.10)?hit.point.clone():ground;
 if(!at)return;
 at.x=clamp(at.x,-4.1,4.10);at.z=clamp(at.z,-3.62,8.6);at.y+=d.f.r+.226;
 setPos(d.f,at);d.f.rx+=.013;d.f.ry+=.025;poseFood(d.f)
}
function pointerDown(e){
 if(drag||e.button>0)return;listen();const hit=pick(e.clientX,e.clientY);if(!hit)return;
 if(!state.started&&hit.type!=='lever')return;
 const wasFirst=!state.started;state.started=true;wake();lastInput=clock;
 drag={...hit,id:e.pointerId,x:e.clientX,y:e.clientY,moved:false,start:clock,t:state.travel,yaw:state.yaw,first:wasFirst,angle:hit.type==='dish'?dishes[hit.i].angle:0,maxLift:0};
 canvas.setPointerCapture(e.pointerId);canvas.style.cursor='grabbing';seatGoal=null;
 if(drag.type==='lever'){woodCue();press=.083;if(wasFirst)tapSend(true);else desiredLift=.048}
 if(drag.type==='carry'){woodCue();press=-.055;guideShown=true}
 if(drag.type==='food'){
 let f=drag.f;drag.oldMode=f.mode;const p=foodPos(f);f.mode='held';p.y+=.22;setPos(f,p);f.vx=f.vy=f.vz=f.vs=f.vu=0;f.nudged=false;poseFood(f);
 if(sniff?.f===f)sniff=null
 }
 if(drag.type==='dish'){sound('grain',.23,.70);const d=dishes[drag.i],p=planeHit(d.y+.19);drag.polar=p?Math.atan2(p.z-d.z,p.x-d.x):0;drag.prevX=e.clientX}
}
function spinDish(i,angle){
 const d=dishes[i],delta=angle-d.angle;d.angle=angle;d.g.rotation.y=angle;
 for(const f of foods){if(f.mode!=='dish'||f.route!==i)continue;
 const turn=delta*(f.crumb?.19:.63),c=Math.cos(turn),s=Math.sin(turn),x=f.x-d.x,z=f.z-d.z;
 f.x=d.x+c*x+s*z;f.z=d.z-s*x+c*z;f.ry+=turn;f.vx+=clamp(delta*z*.075,-.06,.06);f.vz-=clamp(delta*x*.075,-.06,.06);f.y=surfaceY(d,f.x,f.z)+(f.crumb?.019:f.r*.90)}
 dirty=true
}
function pointerMove(e){
 if(!drag){if(e.pointerType==='mouse'){const h=pick(e.clientX,e.clientY);canvas.style.cursor=h&&(state.started||h.type==='lever')?'grab':'default'}return}
 if(e.pointerId!==drag.id)return;
 const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.hypot(dx,dy)>5)drag.moved=true;
 lastInput=clock;setRay(e.clientX,e.clientY);
 if(drag.type==='food'){moveHeld(e,drag);return}
 if(drag.type==='carry'){carryTo(drag.t+dy/(innerHeight*.43));return}
 if(drag.type==='dish'){
 const d=dishes[drag.i],p=planeHit(d.y+.19),theta=p?Math.atan2(p.z-d.z,p.x-d.x):drag.polar;
 let diff=drag.polar-theta;diff=Math.atan2(Math.sin(diff),Math.cos(diff));
 if(Math.abs(diff)<.65)spinDish(drag.i,d.angle+diff*.57+(e.clientX-drag.prevX)*.0065);
 drag.polar=theta;drag.prevX=e.clientX;return
 }
 if(drag.type==='lever'){
 if(guideShown&&state.travel<.999&&drag.maxLift>.14&&dy>innerHeight*.083){
 drag.type='carry';drag.t=state.travel;drag.y=e.clientY;desiredLift=0;woodCue();return
 }
 if(state.travel>.999&&Math.abs(dx)>8){state.yaw=clamp(drag.yaw-dx/Math.max(32,innerWidth*.12)*2,-1,1);dirty=true}
 desiredLift=clamp(-dy/Math.max(103,innerHeight*.285)*.62+.036,0,.62);
 drag.maxLift=Math.max(drag.maxLift,desiredLift);
 if(dy>innerHeight*.083)state.restRequest=true;
 }
}
function pointerUp(e,cancelled=false){
 if(!drag||e.pointerId!==drag.id)return;
 let d=drag;drag=null;lastInput=clock;dirty=true;canvas.style.cursor='default';
 if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);
 if(d.type==='lever'){
 if(!cancelled&&!d.first&&!d.moved&&clock-d.start<.62)tapSend();desiredLift=0;
 if(state.travel===1)state.yaw=state.yaw>=0?1:-1;
 if((d.moved&&e.clientY-d.y>28)||(state.travel===1&&state.sent>6&&!cancelled))state.restRequest=true
 }
 if(d.type==='carry'){seatGoal=clamp(Math.ceil((state.travel-.001)*4)/4);sound('wood',.47,.81)}
 if(d.type==='dish'&&d.moved)state.turns++;
 if(d.type==='food'){d.f.mode='fall';d.f.dropped=true;d.f.vy=-.02;d.f.settled=0;if(d.oldMode==='bowl')fillBowl(d.f.bowlLevel)}
}
canvas.addEventListener('pointerdown',pointerDown);
canvas.addEventListener('pointermove',pointerMove);
canvas.addEventListener('pointerup',e=>pointerUp(e));
canvas.addEventListener('pointercancel',e=>pointerUp(e,true));
canvas.addEventListener('lostpointercapture',e=>pointerUp(e,true));
canvas.addEventListener('contextmenu',e=>e.preventDefault());
let highlighted=null,original=null;
function hintFrame(){
 const idle=clock-lastInput,track=foods.filter(f=>f.mode==='track');let item=grip,action='press';
 let p=lever.localToWorld(V(0,.265,1.43)),end=p.clone().add(V(0,-.093,0));
 if(state.started&&!state.rest){
 if(guideShown&&state.travel<1){item=lever.children[2];p=lever.localToWorld(V(-.42,.08,.03));end=transferPoint(clamp(state.travel+.16));end.y+=.24;action='carry'}
 else if(!track.length||(state.sent>=2&&state.loads<2&&track.length<3)){
 let f=foods.filter(f=>f.mode==='bowl'&&f.bowlLevel===(state.travel>=.99?1:0)).sort((a,b)=>b.y-a.y)[0];if(f){item=f.obj;p=foodPos(f);p.y+=.11;end=lever.localToWorld(V(.03,.34,.21));action='load'}
 }else if(state.travel<.01&&state.turns===0&&(state.seconds>113||state.sent>=5)){
 const d=dishes[0];item=d.tab;p=d.tab.getWorldPosition(V());p.y+=.08;end=p.clone().add(V(-.55,.014,.29));action='turn'
 }else if(state.travel===1&&state.sent>14&&!state.rest){end=p.clone().add(V(0,-.12,.23))}
 else{end=p.clone().add(V(state.travel===1?.34:0,.44,0));action='lift'}
 }
 if(drag||idle<1.2){if(highlighted){highlighted.material.dispose();highlighted.material=original;highlighted=null}hand.visible=false;return}
 if(item!==highlighted){
 if(highlighted){highlighted.material.dispose();highlighted.material=original}
 highlighted=item;original=item.material;item.material=original.clone();item.material.onBeforeCompile=original.onBeforeCompile;item.material.customProgramCacheKey=original.customProgramCacheKey;
 }
 let glimmer=(.5+.5*Math.cos(clock*2.6))**2;highlighted.material.emissive.setHex(0xffc26e);highlighted.material.emissiveIntensity=.029+.13*glimmer;
 grip.scale.y=.139*(1+(!state.started?.045*glimmer:0));
 const period=(idle-4.05)%7.4;
 if(idle<4.05||period>2.54){hand.visible=false;return}
 let u=period/2.54,progress=smooth((u-.22)/.52);hand.visible=true;
 let shown=p.clone().lerp(end,progress);shown.y+=.03+.22*(1-smooth(u/.24))+.14*smooth((u-.78)/.22);
 if(action==='load'||action==='carry')shown.y+=.22*Math.sin(progress*Math.PI);
 hand.position.copy(shown);hand.rotation.y=Math.atan2(camera.position.x-shown.x,camera.position.z-shown.z);
 hand.scale.setScalar(camera.aspect<.8?1.16:1.05);
 skin.opacity=.32*smooth(u/.19)*(1-smooth((u-.78)/.22))
}
const foodFields=['id','bowlLevel','mode','x','y','z','s','u','vs','vu','vx','vy','vz','rx','ry','rz','route','t','nudged','crumb','settled','speed','dropped'];
function snapshot(){
 return {version:3,state:{...state},angles:dishes.map(d=>d.angle),cat:cat.position.toArray(),catYaw:cat.rotation.y,lift,
 foods:foods.map(f=>{
 const out={};for(let key of foodFields)if(f[key]!==undefined)out[key]=f[key];
 if(out.mode==='held'){out.mode='fall';out.dropped=true}if(out.mode==='eating'){out.mode='fall';out.crumb=true;out.nudged=true}
 return out
 })}
}
function save(){
 try{localStorage.setItem(saveKey,JSON.stringify(snapshot()));dirty=false}catch{}
}
function restore(){
 let saved;try{saved=JSON.parse(localStorage.getItem(saveKey))}catch{}
 if(saved?.version===3&&Array.isArray(saved.foods)&&saved.state&&saved.angles?.length===3){
 Object.assign(state,saved.state);state.travel=clamp(state.travel);guideShown=state.travel>0;if(state.travel%0.25>.001)seatGoal=Math.ceil(state.travel*4)/4;lift=clamp(saved.lift||0,0,.62);
 saved.angles.forEach((angle,i)=>dishes[i].angle=Number(angle)||0);for(const f of saved.foods)addFood(f);
 if(saved.cat?.length===3)cat.position.fromArray(saved.cat);cat.rotation.y=saved.catYaw||0;restSince=state.rest?-3:-10;
 if(state.lastNose)alert.point.set(state.lastNose.x,state.lastNose.y,state.lastNose.z);
 }else{
 addFood({mode:'track',s:-1.389,u:.026});addFood({mode:'track',s:-.650,u:-.032});addFood({mode:'track',s:.146,u:.042});
 }
 fillBowl(0);fillBowl(1)
}
function simulate(dt){
 clock+=dt;if(state.started&&!state.rest)state.seconds+=dt;
 if(state.seconds>178||(state.sent>=8&&state.loads>=2&&state.turns>0))guideShown=true;
 if(seatGoal!==null){if(Math.abs(seatGoal-state.travel)<.0015){carryTo(seatGoal);seatGoal=null}else carryTo(damp(state.travel,seatGoal,6.3,dt))}
 pulse=Math.max(0,pulse-dt);press*=Math.exp(-dt*10.9);lift=damp(lift,pulse>0?.149:desiredLift,9,dt);
 orientScene();swivel.updateMatrixWorld(true);supply.updateMatrixWorld(true);
 foodFrame(dt);catFrame(dt);
 if(state.restRequest&&!drag&&!eating&&!sniff&&clock-Math.max(lastInput,lastCeramic)>2.35&&!foods.some(f=>['fall','branch'].includes(f.mode)||f.mode==='track'&&Math.abs(f.vs)>.10||f.mode==='dish'&&Math.hypot(f.vx,f.vz)>.09)){
 state.restRequest=false;state.rest=true;restSince=clock;state.restAt={x:cat.position.x,y:cat.position.y,z:cat.position.z};dirty=true
 }
}
restore();resize();window.addEventListener('resize',resize);
orientScene();scene.updateMatrixWorld(true);for(let f of foods)poseFood(f);
let lastStamp=0;
function frame(stamp){
 requestAnimationFrame(frame);if(document.hidden){lastStamp=0;return}
 const dt=lastStamp?Math.min(.060,(stamp-lastStamp)*.001):1/60;lastStamp=stamp;
 const pieces=Math.max(1,Math.ceil(dt/.014));for(let i=0;i<pieces;i++)simulate(dt/pieces);
 setCamera();for(const f of foods)poseFood(f);hintFrame();renderer.render(scene,camera);
 if(clock-saveClock>2.6&&state.started){saveClock=clock;save()}
}
document.addEventListener('visibilitychange',()=>{if(document.hidden){if(state.started)save();lastStamp=0}});
window.addEventListener('pagehide',()=>{if(state.started)save()});
requestAnimationFrame(frame);
