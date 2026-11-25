'use strict';
const Hay=(()=>{
  const {T,V,C,pi,tau,clamp,range,mix,smooth,group,mesh,Batch,path}=G;
  const tray=group(),stock=group(tray),basket=new Batch();
  const rx=1.04,rz=.595,basketTint=[0xa88756,0xb59b6c,0xb99461,0xc0a575,0x9c8057,0xc8ac7b],hayColors=[0xaca45c,0xb6af6d,0xb4ad70,0x98995a,0xc4b880,0xa3a267,0xc8bb83,0xaaa365];
  const choose=G.choose;
  function bowl(t,a){let rr=.65+.35*t;return V(Math.cos(a)*rx*rr,.041+.254*t**1.48,Math.sin(a)*rz*rr)}
  // Withes alternate in front of and behind the upright ribs.
  for(let k=0;k<10;k++){
    let points=[];for(let j=0;j<=204;j++){let a=tau*j/204,p=bowl(k/10,a),disp=.011*Math.cos(34*a+k*pi);p.x+=disp*Math.cos(a);p.z+=disp*Math.sin(a);points.push(p)}
    basket.tube(points,.0165,choose(basketTint),6,.09);
  }
  for(let j=0;j<68;j++){
    let a=tau*j/68,pts=[];for(let k=0;k<=15;k++){let t=k/15,p=bowl(t,a),d=.011*Math.cos(10*pi*t+j*pi);p.x+=d*Math.cos(a);p.z+=d*Math.sin(a);pts.push(p)}
    basket.tube(pts,.016,choose(basketTint),6,.10);
  }
  for(let k=0;k<3;k++){
    let pts=[];for(let j=0;j<=248;j++){let a=tau*j/248,p=bowl(1,a),tw=a*31+tau*k/3;p.y+=.019*Math.sin(tw);p.x+=Math.cos(a)*.024*Math.cos(tw);p.z+=Math.sin(a)*.024*Math.cos(tw);pts.push(p)}
    basket.tube(pts,.023,choose([0xb79a68,0xc7ab78,0xb19567]),6,.1);
  }
  for(let i=-25;i<=25;i++){
    let t=i/26,y=.054,xx=t*rx*.66,zz=Math.sqrt(1-t*t)*rz*.67;
    basket.tube([V(xx,y,-zz),V(xx,y+.003,0),V(xx,y,zz)],.014,choose(basketTint),5);
  }
  basket.build(tray);G.contact(tray,.03,.035,1.05,.60,.24);
  let coil=Math.random()>.5?1:-1;
  const bundles=[],wear=Array(7).fill(0),spots=[],highlightColor=0xd7c787;
  function spike(b,origin,dir,length,width,color,detailed=true){
    let axis=dir.clone().normalize(),n=V().crossVectors(axis,Math.abs(axis.y)<.92?V(0,1,0):V(1,0,0)).normalize(),v=V().crossVectors(n,axis).normalize();
    let pts=Array.from({length:11},(_,i)=>origin.clone().addScaledVector(axis,length*i/10));
    b.tube(pts,t=>width*(.17+.83*Math.sin(Math.PI*t)**.36),color,8,.12);
    let count=detailed?82:37;
    for(let k=0;k<count;k++){let t=(k+.5)/count,a=k*2.39996,rad=width*(.15+.8*Math.sin(pi*t)**.34);
      let radial=n.clone().multiplyScalar(Math.cos(a)).addScaledVector(v,Math.sin(a)),side=V().crossVectors(radial,axis).normalize();
      let p=origin.clone().addScaledVector(axis,length*t).addScaledVector(radial,rad*.83),c=C(color).multiplyScalar(range(.87,1.30)),w=width*.29,l=length*range(.027,.065);
      let idx=b.v(p.clone().addScaledVector(side,-w),c);b.v(p.clone().addScaledVector(side,w),c);b.v(p.clone().addScaledVector(radial,width*.27).addScaledVector(axis,l),c.clone().multiplyScalar(1.09));b.tri(idx,idx+1,idx+2);
      if(k%3===0){let q=p.clone().addScaledVector(axis,l*.39);let idx=b.v(q.clone().addScaledVector(side,-.0014),c);b.v(q.clone().addScaledVector(side,.0014),c);b.v(q.addScaledVector(radial,.009).addScaledVector(axis,l*1.52),c);b.tri(idx,idx+1,idx+2)}
    }
  }
  function strawBlade(b,p,dir,len,w,col,curve){
    let perp=V(-dir.z,0,dir.x),c=C(col),prev;
    for(let j=0;j<=10;j++){
      let t=j/10,s=Math.sin(pi*t),width=w*(.23+.77*Math.sin(pi*clamp(.04+t*.91))**.65)*(1-.98*t**5);
      let q=p.clone().addScaledVector(dir,len*t).addScaledVector(perp,curve*s);q.y+=s*(len*.13);
      let edge=perp.clone().multiplyScalar(width),lift=.48*Math.sin(t*4.3+len)*width;
      let k=b.v(q.clone().sub(edge).add(V(0,-lift,0)),c);b.v(q.clone().add(V(0,width*.26,0)),c.clone().multiplyScalar(1.12));b.v(q.clone().add(edge).add(V(0,lift,0)),c.clone().multiplyScalar(.94));
      if(j){b.tri(prev,k,prev+1);b.tri(prev+1,k,k+1);b.tri(prev+1,k+1,prev+2);b.tri(prev+2,k+1,k+2)}prev=k;
    }
  }
  for(let k=0;k<7;k++){
    let b=new Batch(),cx=mix(-.57,.57,k/6),cz=.09*Math.sin(k*.82),section=group(stock);section.position.set(cx,0,cz);spots.push(V(cx,.32,cz));
    for(let i=0;i<41;i++){
      let a=range(-.76,.76)+(i%2?pi:0),dir=V(Math.cos(a),range(-.19,.14),Math.sin(a)),vx=range(-.19,.19),vz=range(-.27,.27),h=.20+.14*(1-Math.abs(k-3)/4)+range(0,.12)-Math.abs(vz)*.19;
      let len=range(.35,.86)*(1-.23*Math.abs(k-3)/3),p=V(vx,h,vz),col=choose(hayColors);
      if(i%4){strawBlade(b,p,dir,len,range(.011,.030),col,range(-.12,.12)*coil)}
      else{
        let dest=p.clone().addScaledVector(dir,len),pts=path([p,p.clone().lerp(dest,.52).add(V(.01,range(.026,.108),.048*coil)),dest],9);
        b.tube(pts,.0058,col,5);if(i%8===0)spike(b,dest,dest.clone().sub(pts.at(-2)),range(.11,.24),range(.016,.027),choose([0xb3a980,0xbdb183,0xa6a278]),false);
      }
    }b.build(section);bundles.push(section);
  }
  const curled=group(stock),under=new Batch();
  for(let i=0;i<10;i++){
    let points=[],direction=coil*(i%3?1:-1),phase=i*.64;
    for(let k=0;k<=40;k++){
      let f=k/40,a=phase+direction*f*(3.6+i*.16);
      points.push(V((.69+.011*i)*Math.cos(a),.205+.026*Math.cos(2*a)+.066*f,.34*Math.sin(a)-.065));
    }
    under.tube(points,.0069,choose(hayColors),6);
    spike(under,points.at(-1),points.at(-1).clone().sub(points.at(-2)),.19,.022,0xb6ae7c,false);
  }
  under.build(curled);
  const featured=group(stock);let fb=new Batch();
  const heroEnd=V(1.12+Math.random()*.14,.355,.25),heroStart=V(-.52,.35,-.17);
  let heroPath=path([heroStart,V(.08,.54,.007),V(.76,.46,.13),heroEnd],32);
  fb.tube(heroPath,t=>.010-.004*t,highlightColor,7);
  spike(fb,heroEnd,heroEnd.clone().sub(heroPath.at(-2)),.235,.033,0xc5b783);
  const hero=fb.build(featured,G.surface(0xffffff,{vertexColors:true,side:T.DoubleSide,emissive:0xf2d890,emissiveIntensity:0}));
  let featuredTimer=0,pressed=-1,compression=0,reveal=0,outerTaken=false,outerReturn=1;
  function liftOuter(stem,pinch){
    if(outerTaken)return false;
    const curve=new T.CatmullRomCurve3(heroPath.map(p=>featured.localToWorld(p.clone()))),extent=curve.getLength();
    let extra=Math.max(0,stem.length-extent),distance=Infinity;
    for(let i=0;i<=stem.n;i++){
      let u=(i*stem.unit+extent-stem.length)/extent;
      let p=curve.getPointAt(clamp(u));
      if(u<0){
        let q=-u*extent,a=-q*2.8*coil;p.x-=Math.sin(q*2.8)/2.8;p.z+=(1-Math.cos(a))*.31*coil;p.y-=.09*Math.sin(pi*q/(extra||1));
      }
      stem.nodes[i].copy(p);let d=p.distanceToSquared(pinch);if(d<distance){distance=d;stem.heldIndex=i}
    }
    outerTaken=true;outerReturn=0;featured.visible=false;return true;
  }
  function placeTray(portrait){
    tray.position.set(mix(-1.58,-.77,portrait),.008,mix(.96,1.48,portrait));tray.rotation.y=mix(-.16,-.33,portrait);
    tray.scale.setScalar(mix(1,.86,portrait));
  }
  function trayLocal(w){return tray.worldToLocal(w.clone())}
  function hit(p){
    const q=trayLocal(p);return (q.x/1.22)**2+(q.z/.72)**2<1.04||(q.x>.58&&q.x<1.48&&Math.abs(q.z-.25)<.24)
  }
  function pick(q,age){
    let k=clamp(Math.round((q.x+.63)/1.26*6),0,6),edge=Math.sqrt((q.x/.99)**2+(q.z/.52)**2),hero=q.x>.72&&q.z>-.09;
    let count=edge>.77||hero?1:edge>.48?2:3;
    let long=hero||age>68&&(k%2===0||wear[k]>.25)||wear[k]>.58;
    return {k,count,hero,long,edge};
  }
  function press(k){pressed=k;compression=.19}
  function release(k,count){pressed=-1;wear[k]=Math.min(.86,wear[k]+.062*count);featuredTimer=2.1}
  function trayUpdate(dt,t,hint,age=0){
    reveal=mix(reveal,smooth(52,154,age),1-Math.exp(-dt*.7));curled.position.y=.076*reveal;curled.position.z=.08*reveal;
    compression=mix(compression,pressed<0?0:1,1-Math.exp(-dt*(pressed<0?6:22)));
    bundles.forEach((g,k)=>{let f=pressed<0?0:Math.exp(-((pressed-k)**2)*.63)*compression;
      let target=1-.45*wear[k]-.33*f-.14*reveal;g.scale.y=mix(g.scale.y,target,1-Math.exp(-dt*23));
      g.position.z=spots[k].z+.075*wear[k];g.rotation.z=-.048*f;wear[k]=Math.max(0,wear[k]-dt*.00037);
    });
    featuredTimer=Math.max(0,featuredTimer-dt);
    if(outerTaken&&hint&&pressed<0&&featuredTimer<=0){outerTaken=false;featured.visible=true}
    if(!outerTaken)outerReturn=Math.min(1,outerReturn+dt*.59);
    featured.position.x=-.17*(1-outerReturn);
    featured.position.y=-.18*(1-smooth(0,1,outerReturn))-.085*compression-.075*wear[6]+(hint?.016*Math.max(0,Math.sin(t*2.16))**4:0);
    featured.scale.x=mix(featured.scale.x,featuredTimer>0?.81:1,1-Math.exp(-dt*4));
    hero.material.emissiveIntensity=hint?.042+.063*Math.max(0,Math.sin(t*2.16))**4:0;
  }
  function cue(){return featured.localToWorld(heroEnd.clone().add(V(.08,0,.005)))}
  const heads=[];
  for(let k=0;k<4;k++){let b=new Batch();spike(b,V(),V(0,1,0),.195+.018*k,.023+.0025*k,[0xb0a372,0xb9ab78,0xc5b989,0xab9e6b][k]);heads.push(b.geometry())}
  const unitUp=V(0,1,0),stems=[];
  // Nodes keep their own floor contacts and the original segment lengths as the first segment is eaten.
  class Stem{
    constructor(length,kind){
      this.kind=kind;this.length=length;this.n=Math.max(15,Math.ceil(length/.084));this.unit=length/this.n;this.eaten=0;this.first=0;
      this.nodes=Array.from({length:this.n+1},()=>V());this.contacts=new Float32Array(this.n+1);this.settled=0;this.life=0;this.state='held';this.bend=range(-.28,.28);
      this.col=choose(hayColors);this.width=kind==='leaf'?range(.017,.029):range(.0057,.0091);
      this.verts=kind==='leaf'?4:6;let n=this.n+1,poly=new T.BufferGeometry(),idx=[];
      this.buf=new Float32Array(n*this.verts*3);this.color=new Float32Array(n*this.verts*3);
      for(let i=0;i<n;i++)for(let j=0;j<this.verts;j++){let k=i*this.verts+j;let c=C(this.col).multiplyScalar(1+.12*Math.sin(j*2+.4));c.toArray(this.color,k*3);
        if(i<this.n){let l=i*this.verts+(j+1)%this.verts;idx.push(k,l,k+this.verts,l,l+this.verts,k+this.verts)}}
      poly.setIndex(idx);poly.setAttribute('position',new T.BufferAttribute(this.buf,3).setUsage(T.DynamicDrawUsage));poly.setAttribute('color',new T.BufferAttribute(this.color,3));
      this.mesh=mesh(poly,G.vertexMat);this.mesh.frustumCulled=false;
      this.head=kind==='seed'?mesh(heads[Math.floor(range(0,4))],G.vertexMat):null;
      this.restTilt=range(-.65,.65);this.entangled=null;this.topple=0;this.rollDirection=null;this.tipShadow=0;stems.push(this);
    }
    lay(start,dir,curve=0){
      let perp=V(-dir.z,0,dir.x),last=start.clone();
      for(let i=0;i<=this.n;i++){
        let f=i/this.n,a=this.bend*1.6*(f-.4)+curve*f,d=dir.clone().multiplyScalar(Math.cos(a)).addScaledVector(perp,Math.sin(a));
        if(i)last.addScaledVector(d.normalize(),this.unit);
        this.nodes[i].copy(last);this.nodes[i].y=this.floor(this.nodes[i],i);
      }
    }
    floor(p,i){
      const h=G.clothY(p.x,p.z),f=i/this.n;
      let height=(this.kind==='leaf'?.012:.016)+(this.head?smooth(.86,1,f)*.016:0);
      if(this.length>1.45&&G.folds.length){
        for(let fold of G.folds){
          let side=Math.abs(p.x-fold.x)/fold.wx,depth=(p.z-fold.z)/fold.wz;
          if(side<1.25&&depth>.4&&depth<2.25)height+=fold.h*.49*Math.sin(pi*(depth-.4)/1.85)*(1-side/1.25);
        }
      }
      return h+height;
    }
    supported(i){
      let p=this.nodes[i],ground=this.floor(p,i);
      if(this.kind==='leaf'||this.length<1.55)return ground;
      let span=Math.ceil(.38/this.unit),left=Math.max(this.first,i-span),right=Math.min(this.n,i+span);
      if(left===i||right===i)return ground;
      let a=this.nodes[left],b=this.nodes[right],h1=this.floor(a,left),h2=this.floor(b,right);
      if(Math.min(h1,h2)>ground+.015)return Math.max(ground,mix(h1,h2,(i-left)/(right-left))-.013);
      return ground;
    }
    move(index,where,dt){
      let d=where.clone().sub(this.nodes[index]),a=1-Math.exp(-dt*30);
      for(let i=0;i<=this.n;i++){let f=Math.abs(i-index)/this.n,gain=a*(.35+.65*Math.exp(-f*3.2));this.nodes[i].addScaledVector(d,gain);
        let q=this.nodes[i];q.y=Math.max(q.y,this.floor(q,i))}
      this.solve(index);
    }
    solve(anchor){
      for(let step of [-1,1]){
        for(let i=anchor+step;i>=this.first&&i<=this.n;i+=step){
          let p=this.nodes[i],prev=this.nodes[i-step],d=p.clone().sub(prev),l=d.length();
          let len=Math.min(i,i-step)===this.first?this.unit-(this.eaten-this.first*this.unit):this.unit;
          if(l<.00001)continue;
          len=Math.max(.00001,len);p.copy(prev).addScaledVector(d,len/l);
          let floor=this.floor(p,i);
          if(p.y<floor){
            let dy=clamp(floor-prev.y,-len,len),horizontal=Math.hypot(d.x,d.z)||1;
            let reach=Math.sqrt(Math.max(0,len*len-dy*dy))/horizontal;
            p.set(prev.x+d.x*reach,prev.y+dy,prev.z+d.z*reach);
          }
        }
      }
    }
    reverse(){
      this.nodes.reverse();if(this.head){this.seedAtRoot=!this.seedAtRoot}
    }
    aroundWillow(){
      for(let foot of [G.archLeft,G.archRight]){
        let contact=this.nodes.findIndex(p=>Math.hypot(p.x-foot,p.z-G.archZ)<.28);
        if(contact<0)continue;
        for(let i=contact;i<=this.n;i++){
          let p=this.nodes[i],dx=p.x-foot,dz=p.z-G.archZ,dist=Math.hypot(dx,dz);
          if(dist>.34)break;
          let a=Math.atan2(dz,dx),r=Math.max(.134,dist);
          p.x=foot+Math.cos(a)*r;p.z=G.archZ+Math.sin(a)*r;p.y=this.floor(p,i)+.035*(1-smooth(.12,.34,dist));
        }
      }
    }
    grab(mouth){
      this.state='eating';this.nodes[0].copy(mouth);this.solve(0);
    }
    crest(dt,mouth){
      if(!this.head||this.seedAtRoot||this.topple<=0)return;
      let tip=this.nodes[this.n],f=clamp(this.topple/.65);
      this.rollDirection=mouth.clone().sub(tip);this.rollDirection.y=0;this.rollDirection.normalize();
      let impulse=Math.sin(pi*f),count=Math.min(this.n-this.first,4);
      for(let j=0;j<count;j++){
        let p=this.nodes[this.n-j],weight=1-j/count;
        p.y+=dt*.51*impulse*weight;p.addScaledVector(this.rollDirection,dt*.23*impulse*weight);
      }
      this.topple=Math.max(0,this.topple-dt);this.tipShadow=impulse;
    }
    bite(amount,mouth,dt,pulse,contact){
      this.eaten=Math.min(this.length,this.eaten+amount);this.first=Math.min(this.n-1,Math.floor(this.eaten/this.unit));
      this.nodes[this.first].copy(mouth);
      for(let i=this.first+1;i<=this.n;i++){
        let p=this.nodes[i],f=(i-this.first)/(this.n-this.first),base=this.supported(i),remaining=this.length-this.eaten;
        let lift=(.023+.057*f*f)*pulse*f;
        if(this.head&&contact)lift+=.16*pulse*f**3;
        if(remaining<.32)base=mix(base,mouth.y+.035,1-smooth(.045,.32,remaining));
        p.y=mix(p.y,base+lift,1-Math.exp(-dt*18));this.contacts[i]=p.y-base;
        // A culm touching a willow foot is constrained to its outside surface.
        for(let x of [G.archLeft,G.archRight]){let dx=p.x-x,dz=p.z-G.archZ,dist=Math.hypot(dx,dz);if(dist<.125&&dist>.0001){p.x=x+dx/dist*.125;p.z=G.archZ+dz/dist*.125}}
      }
      this.crest(dt,mouth);this.solve(this.first);
      return this.eaten>=this.length-.006;
    }
    loose(dt){
      this.settled+=dt;for(let i=0;i<=this.n;i++){
        let p=this.nodes[i],floor=this.supported(i);if(this.length<1.2&&G.folds.length&&this.settled<2.6){
          let slope=(G.clothY(p.x,p.z+.009)-G.clothY(p.x,p.z-.009))/.018;
          p.z-=clamp(slope,-1,1)*dt*.065;
        }
        p.y=mix(p.y,floor,1-Math.exp(-dt*11));this.contacts[i]=p.y-floor;
      }
    }
    draw(){
      const n=this.n,sides=this.verts,nodes=this.nodes;
      for(let i=0;i<=n;i++){
        let at=Math.max(i,this.first),p=nodes[at],d=nodes[Math.min(n,at+1)].clone().sub(nodes[Math.max(this.first,at-1)]).normalize();
        let side=V(-d.z,0,d.x);if(side.lengthSq()<.00001)side.set(1,0,0);side.normalize();let up=V().crossVectors(side,d).normalize();
        let f=i/n,w=this.width*(this.kind==='leaf'?(.39+.61*Math.sin(pi*f)**.65)*(1-.97*f**5):1-.32*f);
        for(let j=0;j<sides;j++){let ang=tau*j/sides+(this.kind==='leaf'?this.restTilt:0),radY=this.kind==='leaf'?w*.20:w;
          let k=(i*sides+j)*3;this.buf[k]=p.x+side.x*Math.cos(ang)*w+up.x*Math.sin(ang)*radY;
          this.buf[k+1]=p.y+side.y*Math.cos(ang)*w+up.y*Math.sin(ang)*radY;this.buf[k+2]=p.z+side.z*Math.cos(ang)*w+up.z*Math.sin(ang)*radY;}
      }
      let geo=this.mesh.geometry;geo.attributes.position.needsUpdate=true;geo.computeVertexNormals();geo.setDrawRange(this.first*sides*6,(n-this.first)*sides*6);
      if(this.head){
        let k=this.seedAtRoot?this.first:n,p=nodes[k],d=p.clone().sub(nodes[this.seedAtRoot?k+1:n-1]).normalize();this.head.position.copy(p);
        if(this.rollDirection&&this.tipShadow>.001&&this.topple>0)d.lerp(this.rollDirection.clone().add(V(0,.39,0)).normalize(),this.tipShadow*.86).normalize();
        this.head.quaternion.setFromUnitVectors(unitUp,d);
        this.head.visible=!this.seedAtRoot||this.eaten<.14;let scale=this.seedAtRoot?clamp(1-this.eaten/.15):Math.min(1,(this.length-this.eaten)/.19);this.head.scale.setScalar(scale);
      }
    }
    remove(){this.mesh.removeFromParent();this.mesh.geometry.dispose();if(this.head)this.head.removeFromParent();stems.splice(stems.indexOf(this),1)}
  }
  return {tray,stock,stems,Stem,hit,pick,liftOuter,press,release,placeTray,trayLocal,trayUpdate,cue,heroEnd,wear,rx,rz};
})();
