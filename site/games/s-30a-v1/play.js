'use strict';
let carriedLeaf=null,parcel=null,parcelStart=null,swallowTime=0,parcelTongue=null;
const mouthPlane=new T.Plane();
renderer.localClippingEnabled=true;
let swallowRotation=new T.Quaternion();
let targetLeaf=null,phase='free',wrap=0,tension=0,pullTime=0,deepest=0,armed=true,armDepth=bstate.slide;
let pointer=null,time=0,restTime=5,lastTouch=0,attention=0,reach=0,drawTongue=0,shallowSlip=0;
let highTrack=0,camLevel=bstate.height,camTrack=0,camReady=false,lastAim=V(ports[bstate.lastPort],1.38,-.4),lastSave=0;
if(bstate.memoryPoint)lastAim.fromArray(bstate.memoryPoint);
let lastTonguePoints=[];
let audio=null,master=null,breeze=null;
function soundOn(){
 if(!audio){const A=window.AudioContext||window.webkitAudioContext;if(!A)return;
 audio=new A();master=audio.createGain();master.gain.value=.40;master.connect(audio.destination);
 const noise=audio.createBuffer(1,audio.sampleRate*2,audio.sampleRate),samples=noise.getChannelData(0);let last=0;for(let i=0;i<samples.length;i++){last=last*.92+(Math.random()*2-1)*.08;samples[i]=last}
 breeze=audio.createBufferSource();breeze.buffer=noise;breeze.loop=true;
 const filter=audio.createBiquadFilter();filter.type='lowpass';filter.frequency.value=840;const volume=audio.createGain();volume.gain.value=.053;breeze.connect(filter).connect(volume).connect(master);breeze.start()
 }
 if(audio.state==='suspended')audio.resume().catch(()=>{})
}
function rustle(strength=.18,length=.17,pitch=2200){
 if(!audio)return;const now=audio.currentTime,src=audio.createBufferSource(),g=audio.createGain(),f=audio.createBiquadFilter();
 src.buffer=breeze.buffer;f.type='bandpass';f.frequency.setValueAtTime(pitch,now);f.frequency.exponentialRampToValueAtTime(pitch*.47,now+length);f.Q.value=.62;
 g.gain.setValueAtTime(.001,now);g.gain.exponentialRampToValueAtTime(strength,now+.01);g.gain.exponentialRampToValueAtTime(.001,now+length);
 src.connect(f).connect(g).connect(master);src.start(now,Math.random());src.stop(now+length+.01);src.onended=()=>{src.disconnect();g.disconnect();f.disconnect()}
}
function knock(pitch=380,gain=.045){
 if(!audio)return;const o=audio.createOscillator(),g=audio.createGain(),t=audio.currentTime;o.type='sine';o.frequency.setValueAtTime(pitch,t);o.frequency.exponentialRampToValueAtTime(pitch*.37,t+.075);
 g.gain.setValueAtTime(gain,t);g.gain.exponentialRampToValueAtTime(.0001,t+.11);o.connect(g).connect(master);o.start();o.stop(t+.12);o.onended=()=>{o.disconnect();g.disconnect()}
}
function cameraPose(dt){
 const a=canvas.clientWidth/Math.max(1,canvas.clientHeight),portrait=clamp((1.03-a)/.59),hi=bstate.height;
 camLevel=damp(camLevel,shownHeight,4.6,dt);
 const follow=(rootX-ports[0]-.49)*mix(.12,.81,portrait);
 camTrack=camReady?damp(camTrack,follow,4,dt):follow;
 const lo=V(.085+camTrack,2.28+portrait*.09,4.41+portrait*.29);
 const look=V(.005+camTrack,1.66,-.46);
 const offset=hi>.96?(branchRoot().x-highX)*(.13+.57*portrait):0;
 highTrack=damp(highTrack,offset,5,dt);
 lo.lerp(V(1.04+portrait*.20+highTrack,1.77,3.52+portrait*.30),camLevel);
 look.lerp(V(1.57+highTrack,2.51,-1.42),camLevel);
 camera.fov=mix(42,51.5,portrait)+camLevel*1.5;camera.aspect=a;camera.position.copy(lo);camera.lookAt(look);camera.updateProjectionMatrix();camera.updateMatrixWorld();camReady=true
}
function resize(){renderer.setSize(innerWidth,innerHeight,false);cameraPose(1)}
window.addEventListener('resize',resize);resize();
function screenPoint(p){const v=p.clone().project(camera);return {x:(v.x*.5+.5)*canvas.clientWidth,y:(.5-v.y*.5)*canvas.clientHeight}}
function handlePoint(){return branch.localToWorld(V(.001,.024,-.123))}
function handleHit(x,y){
 const a=screenPoint(branch.localToWorld(V(0,.022,.01))),b=screenPoint(branch.localToWorld(V(0,.03,-.41)));
 const dx=b.x-a.x,dy=b.y-a.y,t=clamp(((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy||1));
 return Math.hypot(x-a.x-dx*t,y-a.y-dy*t)<Math.max(31,canvas.clientHeight*.041)
}
function edgeSide(l){
 if(l===targetLeaf&&l.contactSide)return l.contactSide;
 const a=bladePoint(l,.59,-.91),b=bladePoint(l,.59,.91),m=lips();
 return a.distanceToSquared(m)+.54*a.y<b.distanceToSquared(m)+.54*b.y?-1:1
}
function edgePoint(l){return bladePoint(l,.59,.91*edgeSide(l))}
function reachDepth(l,p){
 if(bstate.height>.97)return -p.z+.92-l.u*.80;
 return -p.z+.17*(1-smooth(.25,.87,l.u))
}
function clearWindow(p){
 const center=ports[bstate.port];
 if(p.z>.045)return Math.abs(p.x-center)<.58;
 const along=(.045-p.z)/(camera.position.z-p.z),sight=p.clone().lerp(camera.position,along);
 const x=Math.abs(sight.x-center),y=Math.abs(sight.y-(gateY+.274));
 return p.y>1.005&&Math.abs(p.x-center)<.565&&(sight.y>1.818||
  Math.hypot(Math.max(0,x-.398),Math.max(0,y-.156))<.091)
}
function throughFrame(){
 if(bstate.height>.01)return false;
 if(branch.localToWorld(stemPos(1.96,-1)).z<.093)return true;
 return leaves.some(l=>!l.eaten&&[bladePoint(l,.96),bladePoint(l,.55,1),bladePoint(l,.55,-1)].some(p=>p.z<.085))
}
function pickLeaf(){
 let best=null,score=Infinity;
 const high=bstate.height>.97,wing=bstate.yaw>.065?1:bstate.yaw<-.065?-1:(bstate.lastFork||-1);
 for(const l of leaves){
 if(l.eaten)continue;
 if(!high&&l.fork===1&&l.u>1.4)continue;
 if(high&&leaves.some(k=>!k.eaten&&k.fork===wing)&&l.fork!==wing)continue;
 if(high&&!l.fork&&leaves.some(k=>!k.eaten&&k.fork!==0))continue;
 const p=edgePoint(l),channel=ports[bstate.port],depth=reachDepth(l,p);
 const clear=high||clearWindow(p);
 const v=Math.abs(depth-.48)+(clear?0:1.5)+(high?Math.abs(p.x-highX)*.12:Math.abs(p.x-channel)*.20)+(l.fork===wing&&high?-.16:0)
 +(high&&l.id===10&&!leaves[11].eaten?.48:0);
 const preference=l.id===bstate.focus&&Math.abs(depth-.48)<.5?.17:0;
 if(v-preference<score){best=l;score=v-preference}
 }
 return best
}
function startRecoil(){flexVel-=1.09*(.45+flex);flutter=.86}
function unhook(folded=false){
 if(targetLeaf){targetLeaf.contactSide=0;if(folded){targetLeaf.folded=Math.max(targetLeaf.folded,.72);rustle(.23);saveBranch()}targetLeaf.shake=.10}
 targetLeaf=null;phase='free';wrap=0;tension=0;pullTime=0;armed=false;armDepth=bstate.slide;shallowSlip=.35;flutter=.48
}
function pluck(l){
 parcel=l.blade.clone(true);scene.add(parcel);l.blade.matrixWorld.decompose(parcel.position,parcel.quaternion,parcel.scale);
 const torn=rod(parcel,V(0,-.014,-.045),V(0,0,0),.0058,.005,petiole,9);
 torn.name='petiole';parcelStart=parcel.position.clone();swallowRotation.copy(parcel.quaternion);
 parcel.traverse(o=>{if(o.isMesh){o.material=o.material.clone();o.material.clippingPlanes=[mouthPlane];o.material.clipShadows=true}});parcelTongue=edgePoint(l);swallowTime=0;carriedLeaf=l;l.eaten=true;l.blade.visible=l.stalk.visible=false;l.short.visible=true;
 const same=bstate.lastPort===bstate.port;bstate.loyalty=same?clamp(bstate.loyalty+.19,0,1):.11;
 bstate.memoryPoint=parcelTongue.toArray();bstate.lastPort=bstate.port;bstate.lastFork=l.fork||Math.sign(l.side);bstate.history.push({leaf:l.id,port:bstate.port,tip:bstate.lastFork,high:bstate.height>.97});
 phase='swallow';targetLeaf=null;tension=0;wrap=0;pullTime=0;armed=false;armDepth=bstate.slide;
 knock(740,.076);rustle(.90,.085,4450);startRecoil();saveBranch()
}
function offer(dt){
 const high=bstate.height>.97,station=bstate.height<.005&&!bstate.onRamp||high;
 let leaf=targetLeaf||pickLeaf();
 if(!leaf||!station||bstate.park>.5){
  const resting=bstate.memoryPoint&&station&&Math.abs(bstate.memoryPoint[1]-(1.4+shownHeight*1.2))<.89;
  return {leaf:null,aim:resting?V(...bstate.memoryPoint):lastAim,look:resting?.85:(bstate.opened?.37:0),close:resting?.72:0}
 }
 const edge=edgePoint(leaf),depth=reachDepth(leaf,edge);
 const clear=high||clearWindow(edge);
 const canTouch=depth>.245&&clear,canWrap=depth>.475&&clear;
 const look=bstate.opened?.24+.76*smooth(-.84,.10,depth):.02;
 const close=bstate.opened?smooth(-.16,.35,depth)*(clear?1:.58):0;
 if(!armed)armDepth=Math.min(armDepth,bstate.slide);
 if(!armed&&pointer&&bstate.slide>armDepth+.047&&shallowSlip<=0)armed=true;
 if(pointer&&armed&&phase==='free'&&canTouch&&lips().distanceTo(edge)<.69&&bstate.opened){bstate.focus=leaf.id;leaf.contactSide=edgeSide(leaf);phase='brush';targetLeaf=leaf;deepest=bstate.slide;wrap=0;rustle(.12,.16,1700)}
 if(targetLeaf){
 deepest=Math.max(deepest,bstate.slide);const withdrawal=deepest-bstate.slide;
 if(phase==='brush'){
 if(withdrawal>.039||!canTouch)unhook();
 else if(canWrap&&pointer&&drawTongue>.83&&lips().distanceTo(edge)<.48){phase='wrap';wrap=.025}
 }else if(phase==='wrap'){
 if(withdrawal>.052||!canTouch)unhook(wrap>.1);
 else{wrap=clamp(wrap+dt*.86);if(wrap>=1){phase='held';deepest=bstate.slide}}
 }else if(phase==='held'){
 tension=damp(tension,clamp(withdrawal/.14),8.5,dt);if(tension>.39&&pointer){pullTime+=dt*(.6+.55*tension);if(pullTime>.56)pluck(leaf)}else pullTime=Math.max(0,pullTime-dt*1.9)
 }}
 if(bstate.memoryPoint&&phase==='free'&&(!armed||!canTouch)&&!bstate.park){
 const mem=V(...bstate.memoryPoint),show=smooth(-.04,.29,depth)*(armed?1:.14);
 if(Math.abs(mem.y-edge.y)<.82)return {leaf,aim:mem.lerp(edge,show),look:mix(.87,look,show),close:mix(.77,close,show)}
 }
 return {leaf,aim:edge,look,close}
}
function tonguePath(l,amount){
 const start=lips(),edge=edgePoint(l),side=edgeSide(l);
 const normal=V(0,1,0).applyQuaternion(l.blade.getWorldQuaternion(new T.Quaternion()));
 if(normal.y<-.10)normal.negate();
 const end=edge.clone().addScaledVector(normal,-.012);
 const base=start.clone().lerp(end,.39);base.y-=.035;
 const approach=start.clone().lerp(end,.78).addScaledVector(normal,-.032);const pts=[start,base,approach,end];
 if(amount>.004){
 const seq=[];for(let i=1;i<=8;i++){const t=i/8*amount;const v=side*(.91+.13*Math.sin(PI*smooth(0,.21,t))-1.93*smooth(.17,.79,t)+.65*smooth(.83,1,t));
 const p=bladePoint(l,.59+t*.115,v);
 p.addScaledVector(normal,mix(-.013,.024,smooth(0,.18,t))-.048*smooth(.81,.97,t));seq.push(p)}
 pts.push(...seq)
 }
 return pts
}
function drawSoftTongue(points,extend){
 if(points.length<2||extend<.012){tongue.visible=false;return}
 const curve=new T.CatmullRomCurve3(points,false,'centripetal');
 const arr=[];for(let i=0;i<=12;i++){const t=i/12,p=curve.getPoint(clamp(t*extend));
 const width=(.056-.022*t)*(.66+.34*Math.sin(t*PI))*(1-smooth(.89,1,t)*.94);
 arr.push([p.x,p.y,p.z,width,.010+.013*(1-t)-.008*smooth(.86,1,t)])}
 tongue.reshape(arr);tongue.visible=true
}
function eating(dt){
 if(!parcel)return;
 swallowTime+=dt;const k=clamp(swallowTime/1.08),s=smooth(0,1,k);
 const mouth=lips(),into=V(0,.005,-.135).applyQuaternion(head.quaternion);const dest=mouth.clone().add(into);
 parcel.position.copy(parcelStart).lerp(dest,s);parcel.position.y+=Math.sin(k*PI)*.037;
 const outward=V(0,0,1).applyQuaternion(head.quaternion),inward=outward.clone().negate();
 const bladeAxis=V(0,0,1).applyQuaternion(swallowRotation);
 const tucked=new T.Quaternion().setFromUnitVectors(bladeAxis,inward).multiply(swallowRotation);
 parcel.quaternion.copy(swallowRotation).slerp(tucked,smooth(.08,.86,k));
 parcel.scale.set(1-.58*s,1-.28*s,1-.18*s);
 mouthPlane.setFromNormalAndCoplanarPoint(outward,mouth.clone().addScaledVector(inward,.027+.48*(1-s)));
 const tip=parcelTongue.clone().lerp(mouth,s);const mid=mouth.clone().lerp(tip,.56);mid.y-=.027*(1-s);
 drawSoftTongue([mouth,mid,tip],Math.max(.001,1-smooth(.74,1,k)));
 if(k>=1){parcel.traverse(o=>{if(o.isMesh)o.material.dispose()});parcel.getObjectByName('petiole')?.geometry.dispose();scene.remove(parcel);parcel=null;carriedLeaf=null;phase='free';tongue.visible=false;animal.chew=2.8;armed=false;armDepth=bstate.slide;shallowSlip=.12;lastTonguePoints=[];drawTongue=0}
}
function newSprig(){
 bstate.seed=Math.floor(Math.random()*1e8);bstate.focus=null;bstate.memoryPoint=[ports[bstate.lastPort],1.41,-.38];bstate.history=[];bstate.opened=false;bstate.height=0;bstate.park=0;bstate.slide=0;bstate.onRamp=false;bstate.port=bstate.lastPort;bstate.roll=0;bstate.yaw=0;spread=0;
 rootX=ports[bstate.port]+.49;shownHeight=camLevel=parkNow=rollNow=flex=flexVel=bank=0;bstate.braced=false;growBranch();lastFlex=999;armed=true;saveBranch()
}
function press(e){
 if(pointer||!handleHit(e.clientX,e.clientY))return;
 e.preventDefault();soundOn();lastTouch=time;restTime=0;
 if(leaves.every(l=>l.eaten)&&phase!=='swallow'){newSprig();animateBranch(0,time,true,null,0)}
 if(!bstate.opened){bstate.opened=true;bstate.roll+=.45;flutter=1.6;knock(475,.092);rustle(.7,.48);saveBranch()}
 pointer={id:e.pointerId,x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,lastSound:time,restPull:0,dx:0,dy:0,startedOnRamp:bstate.onRamp};
 if(bstate.park){bstate.park=0;armed=false;armDepth=bstate.slide}
 try{canvas.setPointerCapture(e.pointerId)}catch{}
}
function steer(dx,dy){
 const old=bstate.slide,h=canvas.clientHeight,unit=2*Math.tan(camera.fov*PI/360)*camera.position.distanceTo(handlePoint())/h;
 if(bstate.onRamp&&bstate.height<1){
 const speed=(-dy+dx*.31)*unit*.92;bstate.height=clamp(bstate.height+speed);
 if(bstate.height>=1){bstate.onRamp=false;bstate.slide=0;bstate.yaw=0;knock(290);armed=true}
 if(bstate.height<=.003&&dx<-.6&&Math.abs(dx)>Math.abs(dy)){bstate.height=0;bstate.onRamp=false;rootX=1.34}
 flutter=clamp(Math.abs(speed)*6+.20);return
 }
 if(bstate.height>.97){
 if(Math.abs(dx)>Math.abs(dy)*.82){const before=bstate.yaw;bstate.yaw=clamp(bstate.yaw+dx*unit*2.15,-1,1);
 if(targetLeaf&&wrap<.64&&Math.sign(before)!==Math.sign(bstate.yaw))unhook(wrap>.15);flutter=.34}
 bstate.slide=clamp(bstate.slide-dy*unit*1.75,0,.97);
 if(bstate.slide<.02&&dy>0)pointer.restPull+=dy;else if(dy<0)pointer.restPull=0;
 if(pointer.restPull>h*.026&&bstate.park<1){bstate.park=clamp((pointer.restPull-h*.026)/(h*.08));if(targetLeaf)unhook();if(bstate.park===1){knock(250);animal.chew=Math.max(animal.chew,4.4);saveBranch()}}
 if(bstate.park&&dy<0)bstate.park=0;
 }else{
 const horizontal=Math.abs(dx)>Math.abs(dy)*1.13;
 if(horizontal){
 const blocked=throughFrame();
 if(blocked||bstate.slide>.09){
 bstate.roll+=dx*unit*3.2;gatePressure=clamp(gatePressure+dx*unit*4,-1,1);flutter=.24
 }else{
 rootX=clamp(rootX+dx*unit*1.27,-.29,1.51);bstate.roll+=dx*unit*.96;
 if(rootX>1.365&&dx>0){bstate.onRamp=true;bstate.height=.004;bstate.slide=0;rustle(.29,.27,1040)}
 if(rootX>.51)bstate.port=1;else if(rootX<.47)bstate.port=0;
 }
 }
 if(!horizontal||Math.abs(dy)>.5*Math.abs(dx)){
 const portHandle=ports[bstate.port]+.49;
 if(Math.abs(rootX-portHandle)>.27&&dy<0){
  bstate.slide=Math.min(.24,bstate.slide-dy*unit*1.7);bstate.braced=bstate.slide>=.23;
  gatePressure=clamp((rootX-portHandle)*2,-1,1);bstate.roll+=dx*unit*.7
 }
 else{
 if(dy>0)bstate.braced=false;
 const a=screenPoint(branchRoot(bstate.slide)),b=screenPoint(branchRoot(bstate.slide+.06));
 const gain=clamp(.06/Math.max(.1,Math.abs(b.y-a.y)),2.5/h,8.3/h);
 bstate.slide=clamp(bstate.slide-dy*gain,-.11,1.84);
 if(bstate.slide>.045)rootX=mix(rootX,portHandle,clamp(Math.abs(dy)*.055));
 }
 }}
 if(Math.abs(bstate.slide-old)>.002)flutter=.26;
}
function move(e){
 if(!pointer||e.pointerId!==pointer.id)return;e.preventDefault();
 const dx=e.clientX-pointer.x,dy=e.clientY-pointer.y;pointer.x=e.clientX;pointer.y=e.clientY;pointer.dx+=dx;pointer.dy+=dy;lastTouch=time;
 steer(dx,dy);if(time-pointer.lastSound>.24&&Math.hypot(dx,dy)>.7){rustle(.12,.17,Math.abs(dx)>Math.abs(dy)?1250:1980);pointer.lastSound=time}
 if(time-lastSave>.38){saveBranch();lastSave=time}
}
function lift(e){
 if(!pointer||e.pointerId!==pointer.id)return;lastTouch=time;
 if(targetLeaf){const slipping=phase==='held'||wrap>.4;if(slipping){bstate.slide=clamp(bstate.slide+.073,0,bstate.height>.97?.97:1.84);knock(257,.026)}unhook(false)}
 if(bstate.onRamp&&bstate.height<1){bstate.height=Math.floor((bstate.height+.001)*5)/5;knock(270,.047)}
 pointer=null;restTime=0;gatePressure=0;saveBranch()
}
canvas.addEventListener('pointerdown',press);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',lift);canvas.addEventListener('pointercancel',lift);canvas.addEventListener('lostpointercapture',lift);
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('pointermove',e=>{if(e.pointerType==='mouse')canvas.style.cursor=pointer?'grabbing':handleHit(e.clientX,e.clientY)?'grab':'default'});
window.addEventListener('pagehide',saveBranch);document.addEventListener('visibilitychange',()=>{if(document.hidden){if(pointer)lift({pointerId:pointer.id});saveBranch();if(audio)audio.suspend().catch(()=>{})}});
// A single translucent fingertip models the gesture at the cut end.
const demo=group(),demoMat=mat(0xf5d8b4,{transparent:true,opacity:0,depthWrite:false,roughness:.71}),nailMat=mat(0xffe5ca,{transparent:true,opacity:0,depthWrite:false});
loft(demo,[[.14,.23,.074,.002,.004],[.116,.201,.065,.045,.038],[.078,.149,.039,.048,.041],[.051,.096,.022,.042,.039],[.014,.05,.009,.038,.035],[0,.018,0,.029,.025],[-.002,.011,-.003,.005,.005]],demoMat,24,20);
const nail=oval(demo,V(.018,.056,.030),V(.025,.034,.008),nailMat);nail.rotation.z=-.47;demo.traverse(o=>{o.castShadow=false;o.receiveShadow=false;o.renderOrder=3});
function guide(){
 const idle=time-lastTouch,visible=!pointer&&idle>4&&phase==='free',cycle=(Math.max(0,idle-4)%5.2),a=visible?smooth(0,.52,cycle)*(1-smooth(2.45,3.14,cycle)):.0;
 demo.visible=a>.002;demoMat.opacity=a*.38;nailMat.opacity=a*.33;
 cutMat.emissive.setHex(0xffc876);cutMat.emissiveIntensity=pointer?0:(.08+.13*(1+Math.sin(time*2.45))*.5)*(1-a);
 if(!demo.visible)return;demo.position.copy(handlePoint());const k=smooth(.68,2.19,cycle);
 demo.position.y+=.027+.071*(1-smooth(.08,.62,cycle));
 if(bstate.opened){if(bstate.onRamp){demo.position.addScaledVector(V(.14,.34,-.35),k)}
 else if(bstate.height>.97){demo.position.x+=k*.25;demo.position.z-=k*.13}
 else if(bstate.history.length>=2&&bstate.slide<.04){demo.position.x+=k*.36}
 else{demo.position.z+=(bstate.slide>.87?.32:-.34)*k;demo.position.y+=k*.022}}
}
let lastTime=0;
function animate(now){
 requestAnimationFrame(animate);const dt=lastTime?Math.min(.045,(now-lastTime)/1000):.016;lastTime=now;time+=dt;
 if(!pointer){restTime+=dt;if(bstate.height===0&&!bstate.onRamp){const wanted=ports[bstate.port]+.49;if(!bstate.braced&&Math.abs(rootX-wanted)<.26)rootX=damp(rootX,wanted,4.2,dt)}}
 cameraPose(dt);shallowSlip=Math.max(0,shallowSlip-dt);
 animateBranch(dt,time,!!pointer,targetLeaf,phase==='held'?.46+.54*tension:wrap*.47);
 const eatingNow=phase==='swallow';
 const result=eatingNow?{aim:lastAim,look:1,close:.99,leaf:null}:offer(dt);
 if(result.aim&&phase!=='swallow')lastAim.copy(result.aim);
 attention=damp(attention,result.look,3.2,dt);reach=damp(reach,result.close,2.45,dt);
 const memory=(bstate.lastPort?1:-1)*bstate.loyalty;
 moveAnimal(dt,time,lastAim,attention,reach,shownHeight,memory,(result.leaf?.u??1.2)/1.96);
 if(phase==='swallow')eating(dt);
 else{
 drawTongue=damp(drawTongue,targetLeaf?1:0,targetLeaf?5.1:13,dt);
 if(targetLeaf)lastTonguePoints=tonguePath(targetLeaf,wrap);
 if(lastTonguePoints.length&&drawTongue>.015){lastTonguePoints[0]=lips();drawSoftTongue(lastTonguePoints,drawTongue)}else tongue.visible=false
 }
 guide();renderer.render(scene,camera)
}
if(leaves.every(l=>l.eaten))newSprig();
requestAnimationFrame(animate);
