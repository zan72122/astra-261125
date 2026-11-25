'use strict';
(()=>{
  const {T,V,C,pi,tau,clamp,mix,smooth,scene,renderer,canvas,camera}=G;
  const {stems,Stem}=Hay,R=Bunny,S=R.state;
  let time=0,age=0,round=0,started=false,portrait=0,low=0,lowGoal=0,visitedLow=false,firstFold=false;
  let idle=0,gesture=null,mode='idle',phase=0,meal=null,wait=.5,interest=0,earTurn=0,chews=0,chewTime=0,chewDuration=.58,chewAmount=.12,lastFraction=0;
  let firstPinch=true,previousTip=null,brushed=false,foldTouch=false,rested=false,crumbDrop=null,sideMemory=0,lastHollow=null,mealCount=0,walk=0,sniffTime=0;
  let desiredAngle=.38,desiredLower=0,sniff=0,taking=0,pulse=0,brush=0,settle=0;
  const ray=new T.Raycaster(),pointer=new T.Vector2(),plane=new T.Plane(V(0,1,0),0);
  const approach=(a,b,s,dt)=>mix(a,b,1-Math.exp(-s*dt));
  const turn=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
  const getRoot=()=>R.root.position;
  // Each sound is a short filtered noise gesture. Its source follows the straw or lips in world space.
  const audio=(()=>{
    let ctx,noise,master;
    function unlock(){
      try{
        if(!ctx){let A=window.AudioContext||window.webkitAudioContext;if(!A)return;ctx=new A();master=ctx.createGain();master.gain.value=.40;master.connect(ctx.destination);
          noise=ctx.createBuffer(1,ctx.sampleRate*.8,ctx.sampleRate);let d=noise.getChannelData(0),prev=0;
          for(let i=0;i<d.length;i++){let n=Math.random()*2-1;d[i]=n*.79+prev*.21;prev=n}}
        if(ctx.state==='suspended')ctx.resume().catch(()=>{});
      }catch(e){ctx=null}
    }
    function event(type,at,thickness=1,strength=1){
      if(!ctx)return;
      if(ctx.state!=='running'){
        if(ctx.state==='suspended'){let source=at.clone();ctx.resume().then(()=>{if(ctx.state==='running')event(type,source,thickness,strength)}).catch(()=>{})}
        return;
      }
      let t=ctx.currentTime,n=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),env=ctx.createGain();
      n.buffer=noise;const params={pull:[.24,3550,.15,.54],slide:[.115,3000,.067,.9],lip:[.075,920,.111,.64],tap:[.044,1760,.12,.9],cloth:[.21,770,.13,.55]}[type];
      const [duration,hz,volume,q]=params;filter.type='bandpass';filter.Q.value=q;
      let dist=at.distanceTo(camera.position),loud=clamp(5.6/(dist+.5),.48,1.4);
      filter.frequency.setValueAtTime(hz*(.94+Math.random()*.12)/Math.sqrt(thickness),t);filter.frequency.exponentialRampToValueAtTime(hz*.55/Math.sqrt(thickness),t+duration);
      let power=volume*strength*loud;env.gain.setValueAtTime(.0001,t);env.gain.exponentialRampToValueAtTime(Math.max(.0002,power),t+.009);env.gain.exponentialRampToValueAtTime(.0001,t+duration);
      n.connect(filter);filter.connect(env);let panner;if(ctx.createStereoPanner){panner=ctx.createStereoPanner();panner.pan.value=clamp(at.clone().project(camera).x,-1,1)*.75;env.connect(panner);panner.connect(master)}else env.connect(master);
      n.start(t,Math.random()*.35,duration);n.onended=()=>{n.disconnect();filter.disconnect();env.disconnect();if(panner)panner.disconnect()};
    }
    return {unlock,event};
  })();
  const wake=()=>{if(rested){round=age;rested=false;visitedLow=false;firstFold=false;mode='idle';wait=.52}interest=1.2;idle=0};
  function projectEvent(e,y=0){pointer.set(e.clientX/innerWidth*2-1,1-e.clientY/innerHeight*2);ray.setFromCamera(pointer,camera);plane.constant=-y;return ray.ray.intersectPlane(plane,V())}
  function surfacePoint(e){
    let p=projectEvent(e,.04);if(!p)return null;
    p=projectEvent(e,G.clothY(p.x,p.z));return p;
  }
  function isOnRug(p){return Math.abs(p.x)<G.rugW-.06&&Math.abs(p.z)<G.rugD-.04}
  function findStem(e){
    let found=null,best=innerWidth<600?23:19;
    for(let s of stems){
      for(let i=s.first;i<=s.n;i++){
        const p=s.nodes[i].clone().project(camera),dist=Math.hypot((p.x+1)*innerWidth/2-e.clientX,(1-p.y)*innerHeight/2-e.clientY);
        if(dist<best){best=dist;found={s,index:i}}
      }
    }return found;
  }
  const targetRoot=V(),heading=V(),guide=G.group(),ghostMat=new T.MeshPhysicalMaterial({color:0xffead2,transparent:true,opacity:0,roughness:.73,depthWrite:false});
  // Only the tapered fingertip is visible in the demonstration. The cut end fades into the light.
  const phantom=new G.Batch();let rings=[[0,.027],[.016,.062],[.060,.086],[.121,.091],[.205,.085],[.301,.082],[.393,.078],[.451,.064],[.487,.012]];
  for(let i=0;i<rings.length;i++)for(let j=0;j<=24;j++){
    let a=tau*j/24,[y,w]=rings[i];phantom.v(V(Math.cos(a)*w,y,Math.sin(a)*w*.88+.017*y),C(0xffead2));if(i&&j){let k=i*25+j;phantom.tri(k-26,k,k-1);phantom.tri(k-26,k-25,k)}
  }
  const ghost=G.mesh(phantom.geometry(),ghostMat,guide,false,false);
  ghostMat.side=T.DoubleSide;ghostMat.onBeforeCompile=sh=>{sh.vertexShader='varying float fingerHeight;\n'+sh.vertexShader;sh.vertexShader=sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nfingerHeight=position.y;');sh.fragmentShader='varying float fingerHeight;\n'+sh.fragmentShader;sh.fragmentShader=sh.fragmentShader.replace('#include <alphamap_fragment>','#include <alphamap_fragment>\ndiffuseColor.a*=1.-smoothstep(.16,.48,fingerHeight);')};
  guide.rotation.z=-.49;guide.rotation.x=.53;guide.visible=false;ghost.renderOrder=5;
  function newPiece(g,j,forceOne){
    let total=g.pick.count,length=(g.pick.long?G.range(2.13,2.83):G.range(.82,1.34))*(forceOne?1:1-j*.071);
    if(firstPinch&&(forceOne||total===1))length=1.10;
    let kind=total===1||forceOne?'seed':j===0&&g.pick.long?'seed':'leaf';
    const stem=new Stem(length,kind);stem.slot=j;stem.heldIndex=Math.round(stem.n*.48);
    let p=g.startWorld,dir=V(.96,0,.25+.09*j).normalize();stem.lay(p.clone().addScaledVector(dir,-stem.heldIndex*stem.unit),dir);
    for(let i=0;i<=stem.n;i++){let f=i/stem.n;stem.nodes[i].y=p.y+.051*Math.sin(f*pi)+j*.013}
    if(j===0&&(g.pick.hero||forceOne))stem.fromOuter=Hay.liftOuter(stem,g.startWorld);
    stem.draw();g.pieces.push(stem);return stem;
  }
  function select(e){
    if(gesture||e.button>0)return;audio.unlock();
    let p=surfacePoint(e),h=projectEvent(e,Hay.tray.position.y+.36*Hay.tray.scale.y);if(!p||!h)return;
    let struck=findStem(e),type=null,local=Hay.trayLocal(h);
    if(struck&&struck.s.state!=='eating'){type='grass'}
    else if(struck&&struck.s.state==='eating')return;
    else if(Hay.hit(h)){type='tray'}
    else if(isOnRug(p)&&(p.z>1.48||Math.abs(p.x)>2.75||Math.abs(p.z-G.rearZ(p.x))<.38||p.z< -1.62)){
      if(stems.some(s=>s.nodes.some(n=>Math.hypot(n.x-p.x,n.z-p.z)<.13)))return;
      type='cloth';
    }
    if(!type)return;
    e.preventDefault();canvas.setPointerCapture(e.pointerId);started=true;wake();
    let g={type,id:e.pointerId,start:V(e.clientX,e.clientY,0),last:V(e.clientX,e.clientY,0),startWorld:type==='tray'?h:p,point:p.clone(),pieces:[],moved:false,arc:0,soundAt:time,travel:0};
    gesture=g;
    if(type==='tray'){
      g.pick=Hay.pick(local,age-round);if(firstPinch)g.pick.long=false;Hay.press(g.pick.k);
      audio.event('pull',h,g.pick.count,.86);earTurn=sideMemory;
      if(mode==='idle'||mode==='pause')wait=Math.max(wait,.65);
    }else if(type==='grass'){
      let s=struck.s;if(s===meal){meal=null;mode='idle';wait=.65}
      s.placement=null;s.state='held';s.heldIndex=struck.index;s.entangled=null;g.pieces.push(s);g.point.copy(s.nodes[struck.index]);
      audio.event('slide',p);
    }else{
      let near=G.folds.find(f=>Math.hypot(f.x-p.x,f.z-p.z)<.53);
      if(!near&&G.folds.length>=7){near=G.folds.reduce((a,b)=>a.h<b.h?a:b)}
      if(!near){near={x:p.x,z:p.z,wx:.52,wz:.21,h:0,goal:0,pressed:false};G.folds.push(near)}
      g.fold=near;g.oldHeight=near.h;near.pressed=true;near.goal=Math.min(.39,near.h+.065);audio.event('cloth',p);
    }
  }
  function move(e){
    let g=gesture;if(!g||g.id!==e.pointerId)return;e.preventDefault();idle=0;
    let p=surfacePoint(e);if(!p)return;
    let screen=V(e.clientX,e.clientY,0),delta=screen.clone().sub(g.last);g.travel+=delta.length();
    if(screen.distanceTo(g.start)>5)g.moved=true;
    g.arc+=delta.x*(screen.y-g.start.y)/Math.max(1,innerWidth*innerHeight*.025);g.last.copy(screen);
    p.x=clamp(p.x,-3.06,3.02);p.z=clamp(p.z,-1.94,1.90);g.point.copy(p);
    if(g.type==='tray'&&g.moved&&!g.pieces.length){for(let j=0;j<g.pick.count;j++)newPiece(g,j,false)}
    if(g.type==='cloth'){
      let push=clamp(g.startWorld.z-p.z,-.30,.76),dist=p.distanceTo(g.startWorld);
      g.fold.z=clamp(g.startWorld.z-.42*push,-1.79,1.75);g.fold.x=mix(g.startWorld.x,p.x,.45);
      g.fold.goal=clamp(g.oldHeight+.06+dist*.33,.055,.42);g.fold.wx=.43+Math.min(.38,dist*.35);
    }
    if(g.moved&&time-g.soundAt>.19&&delta.length()>2){audio.event(g.type==='cloth'?'cloth':'slide',p,g.pick?.count||1,.43);g.soundAt=time}
  }
  function deposit(g){
    let tap=!g.moved||Hay.hit(g.point),origin=g.point.clone(),dir=V(),lowLayout=low>.55;
    let root=getRoot(),preferred=V(root.x-.89*Math.cos(S.angle),0,root.z+.90*Math.sin(S.angle)+.14);
    let forceShow=age-round>67&&!firstFold&&g.pieces[0].length>1.85;
    if(tap){origin.copy(preferred);origin.z+=.11;dir.set(.55,0,.84).normalize()}
    else{
      let drag=g.point.clone().sub(g.startWorld);drag.y=0;if(drag.lengthSq()<.001)drag.set(1,0,0);drag.normalize();
      dir.set(drag.x,0,drag.z).normalize();if(dir.dot(origin.clone().sub(root))<0)dir.multiplyScalar(-1);
      origin.addScaledVector(dir,-g.pieces[0].length*(g.pieces[0].fromOuter?g.pieces[0].heldIndex/g.pieces[0].n:.45));
    }
    let towardWillow=!tap&&g.point.z<-.87&&g.pieces[0].length>1.65;
    if(towardWillow){
      dir.copy(g.point).sub(preferred);dir.y=0;dir.normalize();origin.copy(g.point).addScaledVector(dir,-g.pieces[0].length);
    }
    if(forceShow||lowLayout&&g.pieces[0].length>1.6){
      origin.x=tap?preferred.x:clamp(g.point.x,-1.35,1.40);origin.z=lowLayout?clamp(.55+(g.point.z-.4)*.21,.26,.94):Math.min(.48,preferred.z);
      dir.set(clamp((g.point.x-g.startWorld.x)*.56,-.9,.9),0,-1).normalize();if(forceShow)firstFold=true;
    }
    for(let s of g.pieces){
      const here=s.nodes.map(n=>n.clone()),j=s.slot,fan=clamp(Math.abs(g.arc)+Math.abs(g.last.x-g.start.x)/innerWidth*1.6,0,1);
      let side=V(-dir.z,0,dir.x),start=origin.clone().addScaledVector(side,j*(.034+.068*fan)),v=dir.clone().applyAxisAngle(V(0,1,0),j*(.038+.46*fan)*(g.arc<0?-1:1));
      if(j)start.addScaledVector(v,-.032*j);
      // Keep the length, and turn the tip along an edge when a long piece reaches it.
      s.lay(start,v,g.pieces.length>1?.06*j:.04);
      for(let i=0;i<=s.n;i++){let p=s.nodes[i];if(p.x< -3.11||p.x>3.11){let extra=p.x-clamp(p.x,-3.11,3.11);p.x-=extra;p.z+=Math.abs(extra)*.84}
        if(p.z< -1.93){let rem=-1.93-p.z;p.z=-1.93;p.x+=rem*(p.x>.1?1:-1)}if(p.z>1.94){let rem=p.z-1.94;p.z=1.94;p.x+=rem*(v.x<0?-1:1)}p.y=s.floor(p,i)}
      s.aroundWillow();
      s.placement={from:here,to:s.nodes.map(n=>n.clone()),time:0};s.nodes.forEach((n,i)=>n.copy(here[i]));s.state='free';s.settled=0;s.draw();
    }
    // Interlocking is possible only for heads whose volumes actually overlap on release.
    for(let s of g.pieces)if(s.head){
      let tip=s.placement.to[s.n];for(let other of stems){if(other===s||!other.head||other.state!=='free')continue;
        let end=other.placement?other.placement.to[other.n]:other.nodes[other.n];
        if(end.distanceTo(tip)<.115&&Math.random()<.30){s.entangled=other;other.entangled=s;break}}
    }
    wait=Math.max(.38,wait);interest=.88;
  }
  function finish(e){
    let g=gesture;if(!g||e.pointerId!==g.id)return;
    if(g.type==='tray'){
      if(!g.pieces.length)newPiece(g,0,true);deposit(g);firstPinch=false;Hay.release(g.pick.k,g.pieces.length);
    }else if(g.type==='grass'){for(let s of g.pieces){s.state='free';s.settled=0}wait=.48}
    else{g.fold.pressed=false;g.fold.goal=Math.max(.032,g.fold.goal*.67);g.fold.rebound=.095;g.fold.reboundTime=0;audio.event('cloth',g.point,1,.47);nudgeCrumbs(g.fold)}
    gesture=null;idle=0;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);
  }
  canvas.addEventListener('pointerdown',select);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',finish);canvas.addEventListener('pointercancel',finish);canvas.addEventListener('lostpointercapture',finish);
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  const specks=[],relics=[];
  function makeCrumb(p,size=.055){
    const b=new G.Batch();b.leaf(V(-size*.48,0,0),V(size*.52,.004,size*.22),size*.145,G.choose([0xb3a06b,0x9b945d,0xbdb17d]),size*.10);
    const o=b.build(scene,G.vertexMat,false,true);o.position.copy(p);o.rotation.y=G.range(0,tau);specks.push(o);
    if(specks.length>45){let first=specks.shift();first.removeFromParent();first.geometry.dispose()}return o;
  }
  for(let k=0;k<13;k++){
    let a=G.range(0,tau),local=V(1.11*Math.cos(a),0,.67*Math.sin(a)),p=local.clone();
    relics.push({local,o:makeCrumb(p,G.range(.025,.081))});
  }
  function nudgeCrumbs(f){for(let o of specks){let dx=o.position.x-f.x,dz=o.position.z-f.z;if(Math.hypot(dx,dz)<.58){o.position.x+=.016*Math.sign(dx||1);o.position.z+=.034;o.rotation.y+=.21}}}
  function chooseMeal(){
    let nearest=Infinity,best=null,reverse=false,m=R.mouth();
    for(let s of stems){if(s.state!=='free'||s.placement)continue;
      for(let k of [0,s.n]){let p=s.nodes[k],score=Math.hypot(p.x-m.x,p.z-m.z)+(k===s.n&&s.head?.25:0);
        if(lastHollow)score-=.055*Math.exp(-p.distanceToSquared(lastHollow)*3);
        if(Math.sign(p.x-getRoot().x)===Math.sign(sideMemory))score-=.08*Math.abs(sideMemory);
        if(score<nearest){nearest=score;best=s;reverse=k!==0}}
    }
    if(!best)return;meal=best;if(reverse)meal.reverse();phase=0;sniffTime=0;mode='approach';brushed=false;foldTouch=false;previousTip=meal.nodes[meal.n].clone();
  }
  function mealAnimation(dt){
    let root=getRoot(),current=age-round;
    phase+=dt;wait=Math.max(0,wait-dt);interest=Math.max(0,interest-dt*.74);brush=approach(brush,0,6,dt);sniff=0;
    if(mode==='idle'||mode==='pause'){
      desiredLower=mode==='pause'?.18:firstPinch?.23-.12*interest:.05;
      if(mode==='pause'&&phase>2.2){mode='idle';phase=0}
      if(current>=328&&!rested&&!gesture){mode='sit';phase=0;rested=true;lowGoal=0}
      else if(wait<=0&&started&&!gesture&&(!rested)&&mode!=='sit')chooseMeal();
    }
    if(mode==='approach'&&meal){
      let p=meal.nodes[0],dx=p.x-root.x,dz=p.z-root.z;
      desiredAngle=Math.atan2(dz,-dx);S.angle+=turn(S.angle,desiredAngle)*(1-Math.exp(-dt*2.65));
      let sc=R.root.scale.x;heading.set(-Math.cos(S.angle),0,Math.sin(S.angle));
      targetRoot.copy(p).addScaledVector(heading,-.965*sc);targetRoot.x-=.105*Math.sin(S.angle)*sc;targetRoot.z-=.105*Math.cos(S.angle)*sc;
      targetRoot.x=clamp(targetRoot.x,-2.85,2.97);targetRoot.z=clamp(targetRoot.z,-2.22,1.78);
      let delta=targetRoot.clone().sub(root);delta.y=0;let dist=delta.length();
      if(dist>.006){let step=Math.min(dist,dt*(.56+Math.min(.70,dist*.87)));root.addScaledVector(delta,step/dist);walk+=step*4.9}
      desiredLower=.45+.55*(1-smooth(.18,1.25,dist));
      if(dist<.16||phase>4.3)sniffTime+=dt;
      sniff=sniffTime>0&&sniffTime<1.25?Math.sin(pi*clamp(sniffTime/.60,0,2))**2:Math.max(0,Math.sin(time*4.7))*.27;
      if(sniffTime>1.24){mode='bite';phase=0;chewTime=0;lastFraction=0;chewAmount=G.range(.117,.169);chewDuration=G.range(.48,.65);chews=0;
        meal.grab(R.mouth());let sign=Math.sign(p.x);sideMemory=clamp(.65*sideMemory+.43*sign,-1,1);
        for(let f of G.folds)if(Math.hypot(p.x-f.x,p.z-f.z)<.67&&meal.length<1.4)lastHollow=p.clone();
      }
    }else if(mode==='bite'&&meal){
      desiredLower=1;if(lastHollow&&meal.length<1.4&&meal.nodes[0].distanceTo(lastHollow)<.56)desiredLower=1.045;
      chewTime+=dt;let f=clamp(chewTime/chewDuration),fraction=smooth(.13,.61,f);taking=chewAmount*Math.max(0,fraction-lastFraction);lastFraction=fraction;
      pulse=Math.sin(pi*smooth(.26,.84,f))**1.3;S.chew=Math.sin(pi*smooth(.04,.79,f))**1.32;
      if(chewTime>=chewDuration){
        chewTime=0;lastFraction=0;chews++;chewDuration=G.range(.46,.67)+(chews%5===0?.17:0);chewAmount=G.range(.105,.154);
        audio.event('lip',R.mouth(),1,.81);
        if(meal.head&&pulse<.03&&chews%2===0)audio.event('tap',meal.nodes[meal.n],1,.34);
      }
    }else if(mode==='sit'){
      desiredLower=.13;settle=smooth(.12,2.5,phase);walk=approach(walk,Math.round(walk),2,dt);
      S.groom=phase>7&&phase<9.5?Math.sin(pi*smooth(7,9.5,phase))**1.3:0;
      if(phase>8.2&&R.crumb.visible){let p=R.head.localToWorld(V(-.53,-.06,.32));R.crumb.visible=false;crumbDrop={o:makeCrumb(p,.082),vy:0}}
      if(phase>3.6)lowGoal=0;
    }
    if(mode!=='bite')S.chew=approach(S.chew,0,12,dt);
    if(mode!=='sit'){settle=approach(settle,0,1.7,dt);S.groom=approach(S.groom,0,4,dt)}
    S.lower=approach(S.lower,desiredLower,mode==='approach'?3.8:2.1,dt);
    let pressure=settle*.039;
    if(Math.abs(pressure-G.cushion.h)>.0012){
      G.cushion.x=root.x+.35*Math.cos(S.angle);G.cushion.z=root.z-.35*Math.sin(S.angle);G.cushion.h=pressure;G.updateCloth();
    }
    let searching=mode==='idle'||mode==='pause';
    S.look=approach(S.look,searching?(interest?earTurn*.22:Math.sin(time*.89)*.090):0,2.9,dt);
    S.ear=approach(S.ear,interest?earTurn+.25:searching?.28*Math.sin(time*1.09)+.25*Math.sin(time*.46):.07*Math.sin(time*.86),2.8,dt);
    S.alert=approach(S.alert,interest>0?1:0,interest?13:2,dt);S.step=walk;S.rest=settle;S.brush=brush;
    S.nose=sniff+(mode==='bite'?.16*S.chew:.23*Math.max(0,Math.sin(time*6.21))**4);
    root.y=approach(root.y,G.clothY(root.x,root.z)+.017,5,dt);R.update(time);
  }
  function eat(dt){
    let m=R.mouth(),s=meal,tip=s.nodes[s.n],old=tip.clone();
    let crossed=previousTip&&(previousTip.z-G.rearZ(previousTip.x))*(tip.z-G.rearZ(tip.x))<0;
    let nearFold=tip.z<G.rearZ(tip.x)+.30||s.nodes.some(p=>Math.abs(p.z-G.rearZ(p.x))<.18);
    if(nearFold)foldTouch=true;
    if(!visitedLow&&age-round>57&&s.length>1.62&&foldTouch&&s.eaten>.18){
      lowGoal=1;visitedLow=true;
    }
    if(crossed&&s.head&&previousTip.z<G.rearZ(previousTip.x))s.topple=.65;
    if(!brushed&&s.head&&!s.seedAtRoot&&foldTouch){
      const cheek=R.head.localToWorld(V(-.70,-.125,.235)),along=V(0,.22*s.head.scale.y,0).applyQuaternion(s.head.quaternion);
      let f=clamp(cheek.clone().sub(tip).dot(along)/(along.lengthSq()||1));
      if(tip.clone().addScaledVector(along,f).distanceTo(cheek)<.171){brush=1;R.crumb.visible=true;brushed=true}
    }
    previousTip=tip.clone();
    let finished=s.bite(taking,m,dt,pulse,foldTouch&&Math.abs(tip.z-G.rearZ(tip.x))<.29);taking=0;
    const displacement=tip.clone().sub(old);
    for(let other of stems){
      if(other===s||other.state!=='free'||other.placement)continue;
      if(other===s.entangled){let end=other.nodes[other.n],d=end.distanceTo(tip);
        if(d<.26){end.y+=pulse*dt*.54;end.addScaledVector(displacement,.55)}else{s.entangled=null;other.entangled=null}
      }
      if(displacement.lengthSq()>.0000001&&s.eaten<.46){
        for(let j=0;j<=other.n;j+=2){
          let n=other.nodes[j],i=Math.min(s.n,Math.max(s.first,Math.round(j/other.n*s.n)));
          if(n.distanceToSquared(s.nodes[i])<.011){n.addScaledVector(displacement,.30);if(j+1<=other.n)other.nodes[j+1].addScaledVector(displacement,.30)}
        }
      }
    }
    s.draw();
    if(finished){
      let hollow=lastHollow||V(m.x,.03,m.z);
      if(s.head&&foldTouch){let p=hollow.clone().add(V(G.range(-.07,.07),0,G.range(-.08,.08)));p.y=G.clothY(p.x,p.z)+.012;makeCrumb(p,G.range(.044,.084))}
      if(s.entangled)s.entangled.entangled=null;s.remove();meal=null;mealCount++;mode='pause';phase=0;wait=G.range(1.7,3.4);S.chew=.35;
    }
  }
  function sim(dt){
    time+=dt;idle+=dt;if(started){age+=dt}
    let clothDirty=false;
    for(let f of G.folds){let delta=f.goal-f.h;if(Math.abs(delta)>.0004){f.h+=delta*(1-Math.exp(-dt*(f.pressed?12:6)));clothDirty=true}
      if(f.rebound){f.reboundTime+=dt;f.h+=f.rebound*Math.sin(f.reboundTime*26)*dt*2.5*Math.exp(-f.reboundTime*7);clothDirty=true;if(f.reboundTime>.65)f.rebound=0}}
    if(clothDirty)G.updateCloth();
    for(let o of specks){if(!crumbDrop||crumbDrop.o!==o)o.position.y=G.clothY(o.position.x,o.position.z)+.014}
    if(crumbDrop){let o=crumbDrop.o;crumbDrop.vy-=dt*2.4;o.position.y+=crumbDrop.vy*dt;o.position.x+=dt*.03;o.rotation.z+=dt*2.8;
      if(o.position.y<=G.clothY(o.position.x,o.position.z)+.014){o.rotation.z=0;crumbDrop=null}}
    for(let s of stems){
      s.life+=dt;
      if(s.state==='held'&&gesture?.moved){
        let at=gesture.point.clone(),j=s.slot||0;at.z+=j*.037;at.y=G.clothY(at.x,at.z)+.15;at.x+=j*.019;s.move(s.heldIndex,at,dt);s.draw();
      }else if(s.state==='free'){
        if(s.placement){let d=s.placement;d.time+=dt;let f=smooth(0,.36,d.time);
          for(let i=0;i<=s.n;i++){let n=s.nodes[i];n.lerpVectors(d.from[i],d.to[i],f);n.y+=Math.sin(pi*f)*.052}
          if(d.time>=.36)s.placement=null;s.draw();
        }else if(s.settled<3.1||clothDirty||mode==='bite'){s.loose(dt);s.draw()}
      }
    }
    mealAnimation(dt);if(mode==='bite'&&meal)eat(dt);
    let canHint=!gesture&&!meal&&(!stems.some(s=>s.state==='free')||rested)&&(mode!=='sit'||phase>13);
    Hay.trayUpdate(dt,time,canHint&&idle>1,age-round);
    let demo=canHint&&idle>=4,loop=(idle-4)%9;
    guide.visible=demo&&loop>=0&&loop<2.85;
    if(guide.visible){
      let f=smooth(.75,2.05,loop),base=Hay.cue();guide.position.copy(base);
      guide.position.x+=.40*f;guide.position.z+=.43*f;guide.position.y+=.23*(1-smooth(0,.67,loop))+.020*Math.sin(pi*f)-.19*f;
      ghostMat.opacity=.3*smooth(0,.43,loop)*(1-smooth(2.12,2.82,loop));
    }
  }
  // The same continuous camera move goes around the outer foot of the willow; there is no cut.
  let framingX=0,framingScale=1,focused=6;
  function cameraPose(dt,instant=false){
    low=instant?lowGoal:approach(low,lowGoal,lowGoal>.5?.245:.185,dt);
    let l=smooth(0,1,low),w=innerWidth,h=innerHeight,aspect=w/h;
    const root=getRoot(),follow=clamp((root.x-mix(.92,.45,portrait))*.25,-.44,.44);
    let goal=V(mix(-.04,-.08,portrait)+follow,mix(1.17,.99,portrait),mix(-.02,.10,portrait));
    goal.y=mix(goal.y,.70,l);goal.z-=.12*l;
    if(meal&&l>.03){let center=meal.nodes[meal.first].clone().lerp(meal.nodes[meal.n],.38);goal.x=mix(goal.x,clamp(center.x,-1,1),l*.28)}
    let eye=V(mix(-.79,-.66,portrait)-1.52*Math.sin(l*pi*.62),mix(3.16,4.16,portrait),mix(6.22,6.06,portrait));
    eye.y=mix(eye.y,mix(1.05,1.31,portrait),l);eye.z-=.64*l;eye.x+=follow*.6;
    let screenW=mix(5.85,3.54,portrait),screenH=Math.max(mix(4.23,3.71,l),screenW/aspect);
    // Frame both ends before the first sniff, then hold that framing through the meal.
    let observed=meal||stems.find(s=>s.state==='free'),extra=0,scale=1;
    if(observed){
      let points=observed.placement?.to||observed.nodes,indices=[observed.first,Math.floor((observed.first+observed.n)/2),observed.n];
      let side=V().crossVectors(goal.clone().sub(eye).normalize(),V(0,1,0)).normalize();
      let min=Infinity,max=-Infinity;
      for(let p of [...indices.map(i=>points[i]),R.mouth(),R.head.localToWorld(V(0,.9,0))]){
        let off=p.clone().sub(goal).dot(side);min=Math.min(min,off-.18);max=Math.max(max,off+.18);
      }
      let half=screenH*aspect*.39;
      if(max>half||min< -half){extra=clamp((min+max)*.5,-1.0,1.0);scale=Math.max(1,(max-extra)/half,(extra-min)/half)}
    }
    framingX=approach(framingX,extra,1.35,dt);framingScale=approach(framingScale,clamp(scale,1,1.48),1.4,dt);
    goal.x+=framingX;eye.x+=framingX;screenH*=framingScale;
    camera.aspect=aspect;camera.fov=2*Math.atan(screenH/(2*eye.distanceTo(goal)))*180/pi;
    if(instant){camera.position.copy(eye);camera.userData.goal=goal}
    else{camera.position.lerp(eye,1-Math.exp(-dt*4));camera.userData.goal.lerp(goal,1-Math.exp(-dt*3))}
    camera.lookAt(camera.userData.goal);camera.updateProjectionMatrix();camera.updateMatrixWorld();focused=camera.position.distanceTo(goal);
  }
  // Small depth-dependent lens blur preserves the mouth and the length of a placed stem in the same focal band.
  let target=null,post=null,postCam=null,lens=null;
  if(renderer.extensions.has('EXT_color_buffer_float')){
    target=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,depthBuffer:true,samples:2});target.depthTexture=new T.DepthTexture(1,1,T.UnsignedIntType);
    post=new T.Scene();postCam=new T.OrthographicCamera(-1,1,1,-1,0,1);
    lens=new T.ShaderMaterial({depthTest:false,depthWrite:false,uniforms:{picture:{value:target.texture},depthMap:{value:target.depthTexture},pixel:{value:new T.Vector2()},focus:{value:6},near:{value:camera.near},far:{value:camera.far}},
      vertexShader:'varying vec2 uv0;void main(){uv0=uv;gl_Position=vec4(position.xy,0.,1.);}',
      fragmentShader:`uniform sampler2D picture,depthMap;uniform vec2 pixel;uniform float focus,near,far;varying vec2 uv0;
      void main(){float z=texture2D(depthMap,uv0).r;
        float d=near*far/(far-z*(far-near));float radius=3.35*smoothstep(1.6,6.8,d-focus)+2.15*smoothstep(1.35,3.1,focus-d);
        vec3 c=texture2D(picture,uv0).rgb*2.;
        for(int i=0;i<12;i++){float f=float(i);float a=f*2.399963;vec2 o=vec2(cos(a),sin(a))*sqrt((f+.5)/12.)*pixel*radius;c+=texture2D(picture,uv0+o).rgb;}
        c/=14.;vec2 st=uv0*2.-1.;c*=1.-.078*pow(dot(st,st)*.5,1.45);
        gl_FragColor=vec4(c,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`});
    post.add(new T.Mesh(new T.PlaneGeometry(2,2),lens));
  }
  let lastPortrait=-1;
  function resize(){
    let w=innerWidth,h=innerHeight;portrait=1-smooth(.55,1.15,w/h);const ratio=Math.min(devicePixelRatio||1,1.65);
    renderer.setPixelRatio(ratio);renderer.setSize(w,h,false);
    if(target){target.setSize(Math.max(1,Math.round(w*ratio)),Math.max(1,Math.round(h*ratio)));lens.uniforms.pixel.value.set(1/w,1/h)}
    Hay.placeTray(portrait);
    if(lastPortrait<0||!started){R.root.position.set(mix(.92,.45,portrait),.05,mix(-.13,-.33,portrait));S.angle=mix(.39,.80,portrait)}
    R.root.scale.setScalar(mix(1.025,1.07,portrait));R.update(time);lastPortrait=portrait;
    for(let {o,local} of relics){o.position.copy(Hay.tray.localToWorld(local.clone()));o.position.y=G.clothY(o.position.x,o.position.z)+.014}
    cameraPose(0,true);
  }
  resize();window.addEventListener('resize',resize);
  let prior=0;
  document.addEventListener('visibilitychange',()=>{prior=0});
  function frame(ms){
    requestAnimationFrame(frame);if(document.hidden)return;
    let dt=prior?Math.min((ms-prior)/1000,.05):1/60;prior=ms;
    sim(dt);cameraPose(dt);
    if(target){renderer.setRenderTarget(target);renderer.render(scene,camera);renderer.setRenderTarget(null);lens.uniforms.focus.value=focused;renderer.render(post,postCam)}else renderer.render(scene,camera);
  }
  requestAnimationFrame(frame);
})();
