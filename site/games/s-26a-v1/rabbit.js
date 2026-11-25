'use strict';
const Bunny=(()=>{
  const {T,V,C,pi,tau,range,clamp,mix,smooth,Batch,mesh,group,oval,surface,path}=G;
  const root=group(),torso=group(root),body=group(torso),head=group(torso),ears=[],feet=[],haunches=[],pads=[],whiskers=[];
  const shadow=G.contact(root,.22,.03,1.23,.64,.28);
  function coatTexture(){
    let c=document.createElement('canvas');c.width=1024;c.height=512;
    let ctx=c.getContext('2d');ctx.fillStyle='#dddad0';ctx.fillRect(0,0,c.width,c.height);
    let rng=G.seeded(912),shades=['#5e5649','#857d6f','#aba59a','#eae8dc','#fdf7df','#8e887a'];
    for(let k=0;k<61000;k++){
      let x=rng()*1024,y=rng()*512,l=4+rng()*17,dy=Math.sin(y*2*pi/512+Math.sin(x/150))*.22*l+(rng()-.5)*3;
      ctx.strokeStyle=shades[Math.floor(rng()*shades.length)];ctx.globalAlpha=.12+rng()*.28;ctx.lineWidth=.45+rng()*1.9;
      ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(x+l*.54,y+dy*.27+.6,x+l,y+dy);ctx.stroke();
    }
    let tex=new T.CanvasTexture(c);tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=4;return tex;
  }
  const furMap=coatTexture(),furMat=surface(0xffffff,{vertexColors:true,map:furMap,bumpMap:furMap,bumpScale:.0105});
  const backColor=C(0x80543a),topColor=C(0x936647),flank=C(0xaf8059),cream=C(0xddbb89);
  function shade(t,a,kind){
    let y=Math.sin(a),col=backColor.clone().lerp(topColor,.35+.26*Math.cos(t*6.1)).lerp(flank,.43*(1-y)/2);
    col.lerp(cream,smooth(.12,.98,-y)*.75);
    if(kind==='head'){
      let pale=Math.exp(-((t-.31)**2)/.060-((y+.18)**2)/.16)*.57;
      col.lerp(C(0xd0a278),pale);
      let stripe=Math.exp(-((y-(-.34+.45*(t-.42)))**2)/.0049-((t-.52)**2)/.035);
      if(Math.cos(a)>.15)col.lerp(C(0xf0cfa2),stripe*.94);
      if(t<.24)col.lerp(C(0xcda482),.3);
    }
    if(kind==='tail')col.lerp(C(0xf2ddba),.73+.20*y);
    if(kind==='foot')col.lerp(C(0xd9b183),.32+.25*(1-t));
    return col;
  }
  // Cross sections are sculpted separately for the rising rump, chest, cheek and bridge of the nose.
  function coat(parent,rings,kind,hairs,coatLength=.033){
    function point(t,a){
      let u=clamp(t)* (rings.length-1),i=Math.min(Math.floor(u),rings.length-2),v=u-i;
      let p=rings[i],q=rings[i+1],p0=rings[Math.max(0,i-1)],q1=rings[Math.min(rings.length-1,i+2)];
      let values=p.map((n,j)=>j===0?mix(n,q[j],v):.5*((2*n)+(-p0[j]+q[j])*v+(2*p0[j]-5*n+4*q[j]-q1[j])*v*v+(-p0[j]+3*n-3*q[j]+q1[j])*v*v*v));
      return V(values[0],values[1]+Math.max(.0005,values[2])*Math.sin(a),Math.max(.0005,values[3])*Math.cos(a));
    }
    const b=new Batch(),uv=[],n=kind==='foot'||kind==='tail'?28:64,m=kind==='foot'||kind==='tail'?28:60;
    for(let i=0;i<=n;i++)for(let j=0;j<=m;j++){
      let t=i/n,a=tau*j/m,p=point(t,a),c=shade(t,a,kind);
      // Broken agouti warmth follows the coat rather than screen-space noise.
      let fleck=1+.043*Math.sin(p.x*21+Math.sin(a*9)*2)+.021*Math.cos(a*31-t*36);
      b.v(p,c.multiplyScalar(fleck));uv.push(t*1.35,j/m*1.8);
      if(i&&j){let k=i*(m+1)+j;b.tri(k-m-2,k-1,k);b.tri(k-m-2,k,k-m-1)}
    }
    let geo=b.geometry();geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));mesh(geo,furMat,parent);
    let straw=new Batch();
    for(let i=0;i<hairs;i++){
      let t=range(.028,.981),a=range(0,tau),p=point(t,a),along=point(t+.002,a).sub(p).normalize(),lat=point(t,a+.004).sub(p).normalize(),n=V().crossVectors(along,lat).normalize();
      let dir=along.clone().addScaledVector(lat,-.33*Math.cos(a)+.17*Math.sin(t*9+a)+range(-.29,.29)).normalize();
      let w=range(.0008,.0027),l=coatLength*range(.56,1.65),color=shade(t,a,kind).multiplyScalar(range(.68,1.18));
      if(i%8===0)color.lerp(C(0xe2c69c),range(.2,.51));
      let root=p.clone().addScaledVector(n,.001),side=V().crossVectors(n,dir).normalize().multiplyScalar(w);
      let k=straw.v(root.clone().sub(side),color);straw.v(root.clone().add(side),color);straw.v(root.addScaledVector(n,l*.26).addScaledVector(dir,l),color.clone().multiplyScalar(1.14));straw.tri(k,k+1,k+2);
    }
    straw.build(parent,G.vertexMat,false);
  }
  coat(body,[[-.70,.55,.01,.02],[-.65,.58,.28,.28],[-.51,.65,.48,.40],[-.32,.68,.56,.46],[-.04,.70,.59,.50],[.27,.74,.66,.57],[.56,.76,.70,.61],[.80,.73,.67,.59],[.99,.69,.56,.51],[1.15,.65,.36,.34],[1.22,.66,.013,.018]],'body',23000,.042);
  for(let side of [-1,1]){
    let hip=group(body);hip.position.set(.51,.006,.36*side);hip.rotation.z=-.105;
    coat(hip,[[-.43,.37,.016,.015],[-.37,.399,.17,.10],[-.20,.474,.31,.194],[.026,.525,.392,.258],[.218,.545,.40,.249],[.376,.542,.315,.176],[.466,.53,.195,.105],[.50,.51,.016,.01]],'body',3300,.033);
  }
  head.position.set(-.43,1.03,.015);
  coat(head,[[-.93,-.125,.028,.049],[-.86,-.115,.12,.154],[-.73,-.046,.219,.246],[-.58,.015,.298,.302],[-.42,.057,.365,.347],[-.23,.078,.403,.358],[-.042,.085,.375,.309],[.106,.082,.26,.239],[.187,.06,.125,.13],[.206,.06,.012,.014]],'head',14700,.032);
  const footRings=[[-.33,.105,.015,.025],[-.28,.111,.082,.122],[-.13,.129,.108,.149],[.055,.138,.112,.137],[.18,.146,.09,.10],[.23,.15,.012,.019]];
  const seam=surface(0x927051);
  for(let sign of [-1,1]){
    let f=group(root);f.position.set(-.39,0,sign*.27+.012);f.rotation.y=sign*.065;feet.push(f);
    coat(f,footRings,'foot',850,.019);
    for(let n of [-1,1]){
      let b=new Batch();b.tube(path([V(-.312,.144,n*.040),V(-.270,.178,n*.047),V(-.202,.202,n*.048)],7),t=>.0038*Math.sin(pi*t)+.0008,0xa17f5b,4);b.build(f);
    }
    let h=group(root);h.position.set(.62,-.018,sign*.305);haunches.push(h);
    let rumpFoot=group(h);rumpFoot.position.x=-.005;rumpFoot.scale.set(1.28,1.1,1.28);coat(rumpFoot,footRings,'foot',820,.023);
  }
  let tail=group(torso);tail.position.set(1.13,.50,-.02);tail.rotation.z=.34;
  coat(tail,[[-.12,0,.02,.03],[-.04,.014,.175,.168],[.10,.044,.207,.174],[.236,.080,.142,.126],[.31,.10,.015,.01]],'tail',2900,.050);
  // A thin folded ear has a furred rim and a shallow concave inner surface.
  const shell=surface(0xffffff,{vertexColors:true,side:T.DoubleSide,map:furMap,bumpMap:furMap,bumpScale:.005});
  for(let s of [-1,1]){
    let e=group(head);e.position.set(-.19+(s<0?.093:0),.373,s*.16);ears.push(e);
    const b=new Batch(),uv=[],fluff=new Batch(),ns=42,nt=50,L=s<0?1.12:1.19;
    function earPoint(t,a){
      let w=(.076*(1-t)+.145*Math.sin(pi*(t**.93))**.66)*Math.max(.002,(1-t)**.28);
      let u=Math.sin(a),front=Math.cos(a),depth=.049*(Math.sin(t*pi)**.5+.25)*(1-t*.58);
      let x=u*w+.127*t*t+.014*Math.sin(t*pi),z=depth*front;
      z-=front>0?.051*(1-u*u)*Math.sin(pi*t)**.7:0;return V(x,L*t,z+.057*t*t);
    }
    for(let i=0;i<=nt;i++)for(let j=0;j<=ns;j++){
      let t=i/nt,a=tau*j/ns,p=earPoint(t,a),front=Math.cos(a),u=Math.abs(Math.sin(a)),c=C(0xad815b);
      c.lerp(C(0xd4af84),smooth(.68,1,u)*.84);
      let inside=smooth(.14,.33,front)*(1-smooth(.68,.95,u))*smooth(.045,.19,t)*(1-smooth(.85,.98,t));
      let pink=C(0xb78070).lerp(C(0xd9a292),.48+.27*Math.sin(t*5.5+Math.sin(a)*2));c.lerp(pink,inside);
      if(s>0)c.lerp(C(0x594433),smooth(.85,.993,t)*.86);
      b.v(p,c);uv.push(t,j/ns);if(i&&j){let k=i*(ns+1)+j;b.tri(k-ns-2,k,k-1);b.tri(k-ns-2,k-ns-1,k)}
    }
    let geo=b.geometry();geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));mesh(geo,shell,e);
    for(let i=0;i<1850;i++){let t=range(.01,.994),a=range(0,tau);if(Math.cos(a)>.48&&Math.abs(Math.sin(a))<.75)continue;
      let p=earPoint(t,a),dir=V(.010*Math.sin(a),range(.017,.032),.005*Math.cos(a)),c=C(t>.88&&s>0?0x8a6b4d:0xcca47a).multiplyScalar(range(.74,1.11)),k=fluff.v(p.clone().add(V(-.0018,0,0)),c);fluff.v(p.clone().add(V(.0018,0,0)),c);fluff.v(p.add(dir),c);fluff.tri(k,k+1,k+2)}
    fluff.build(e,G.vertexMat,false);
    e.rotation.order='YXZ';e.rotation.y=s>0?-.44:-1.17;
  }
  const eyeDark=surface(0x281e17,{roughness:.18}),iris=surface(0x51351e,{roughness:.25}),pupil=surface(0x110f0d,{roughness:.12}),glint=new T.MeshBasicMaterial({color:0xfff8e4});
  for(let s of [-1,1]){
    let eye=group(head);eye.position.set(-.492,.167,.305*s);eye.rotation.y=s*(-.32);eye.rotation.x=-s*.28;
    oval(eye,surface(0xa18465),0,0,0,.132,.109,.048);
    oval(eye,eyeDark,-.003,.003,s*.012,.115,.102,.058);
    oval(eye,iris,-.006,-.002,s*.040,.101,.087,.034);
    oval(eye,pupil,-.013,.005,s*.052,.081,.076,.028);
    oval(eye,glint,-.040,.041,s*.077,.018,.014,.005);
    oval(eye,glint,.036,-.008,s*.076,.006,.005,.003);
    let lid=new Batch(),line=[];
    for(let i=0;i<=20;i++){let a=pi*i/20;line.push(V(-.004+.117*Math.cos(a),.009+.091*Math.sin(a),s*(.022+.012*Math.sin(a))))}lid.tube(line,t=>.005+.007*Math.sin(pi*t),0x71513d,6);lid.build(eye);
  }
  const muzzle=surface(0xc9a480,{map:furMap,bumpMap:furMap,bumpScale:.006}),chin=surface(0xdfc49e,{map:furMap});
  const jaw=oval(head,chin,-.783,-.229,.012,.123,.072,.127);
  for(let s of [-1,1]){
    let pad=oval(head,muzzle,-.805,-.156,s*.088,.145,.113,.120);pad.rotation.z=.1;pads.push(pad);
    for(let i=0;i<9;i++){let x=range(-.90,-.77),y=range(-.19,-.115),z=.088+.12*Math.sqrt(Math.max(.14,1-((x+.805)/.145)**2-((y+.156)/.113)**2));
      oval(head,surface(0x92745b),x,y,s*z,.0066,.0057,.003)}
  }
  const nose=group(head);nose.position.set(-.911,-.105,0);
  let ns=new Batch(),nc=C(0xb98d7c);const rows=[[-.040,.014],[-.022,.047],[.007,.083],[.034,.078],[.047,.040]];
  for(let i=0;i<rows.length;i++)for(let j=0;j<=16;j++){
    let a=tau*j/16;ns.v(V(-.016-.027*Math.cos(a),rows[i][0],rows[i][1]*Math.sin(a)),nc.clone().multiplyScalar(.89+.15*i/4));if(i&&j){let k=i*17+j;ns.tri(k-18,k,k-1);ns.tri(k-18,k-17,k)}
  }ns.build(nose);
  let nostrils=new Batch();for(let s of [-1,1])nostrils.tube(path([V(-.035,.017,s*.049),V(-.039,.009,s*.037),V(-.041,.003,s*.023)],6),.0044,0x6b4e40,5);nostrils.build(nose);
  for(let s of [-1,1]){
    let g=group(head);g.position.set(-.821,-.157,s*.170);whiskers.push(g);
    let fans=Array.from({length:4},()=>new Batch());for(let i=0;i<19;i++){
      let l=range(.18,.425),dx=range(-.28,.16),dy=mix(-.125,.094,i/18)+range(-.012,.012),a=V(range(-.048,.047),range(-.035,.036),0),tip=a.clone().add(V(dx,dy,s*l));
      fans[Math.min(3,Math.floor(i/5))].tube(path([a,a.clone().lerp(tip,.39).add(V(-.021,.019,0)),tip],8),t=>.0037*(1-.90*t),i%4===0?0x9b8871:0xe8d6b9,4)}
    g.userData.fans=fans.map(b=>b.build(g,G.vertexMat,false));
  }
  const crumb=group(head),bit=new Batch();bit.leaf(V(-.57,-.085,.30),V(-.475,-.047,.329),.014,0xb2a269,.012);bit.build(crumb);crumb.visible=false;
  const paw=feet[1],mouthLocal=V(-.876,-.238,.09);
  const state={angle:.35,lower:0,look:0,ear:0,chew:0,alert:0,brush:0,rest:0,groom:0,step:0,nose:0};
  function update(t){
    let s=state,breath=Math.sin(t*2.28),dip=s.lower;
    root.rotation.y=s.angle;body.scale.set(1+.004*breath,1+.013*breath,1+.009*breath);torso.position.y=-s.rest*.101+.013*Math.abs(Math.sin(s.step*pi));
    torso.rotation.x=.021*Math.sin(tau*s.rest);torso.rotation.z=.028*s.rest;
    head.position.set(-.43-.045*dip-.026*s.alert,1.03-.205*dip+.009*breath+s.nose*.015,.016);
    head.rotation.order='YXZ';head.rotation.y=s.look;head.rotation.z=-.045+.775*dip+.016*breath+s.nose*.039+s.chew*.018;head.rotation.x=s.brush*.055;
    ears.forEach((ear,i)=>{
      let sign=i?1:-1,slow=Math.sin(t*.68+sign);
      ear.rotation.z=(i?-.29:-.52)-.12*dip+(i?.26:-.055)*s.alert+(i?.09:-.07)*s.rest+.025*slow;
      ear.rotation.x=(i?.18:-.19)+sign*s.ear*.16+.018*Math.sin(t*.84+sign);
      ear.rotation.y=(i?-.44:-1.17)+s.ear*(i?.35:.54)+s.look*.33;
    });
    nose.scale.set(1+.045*s.nose,1-.085*s.nose,1+.085*s.nose);nose.position.y=-.105+s.nose*.008;
    jaw.position.y=-.233-s.chew*.021;jaw.position.x=-.784+s.chew*.010;
    pads.forEach((p,i)=>{p.position.y=-.156+.006*s.chew;p.scale.y=.113+.006*s.chew});
    whiskers.forEach((w,i)=>{w.rotation.x=(i?1:-1)*s.chew*.037;w.rotation.y=.021*Math.sin(t*4.1)+s.nose*.022;
      w.userData.fans.forEach((fan,j)=>{let delay=j*.059,elapsed=-Math.log(Math.max(.00001,s.brush))/6-delay;fan.rotation.x=i&&elapsed>0?.23*Math.sin(Math.min(pi,elapsed*11))*Math.exp(-elapsed*3):0})});
    feet[0].position.x=-.38-.086*Math.sin(s.step*pi)-.045*smooth(0,.6,s.rest);
    paw.position.set(-.42-.07*Math.sin(s.step*pi+.25)-s.groom*.24-.043*smooth(.4,1,s.rest),.006+s.groom*.61+.026*Math.max(0,Math.sin(s.step*pi)),.293+s.groom*.04);
    paw.rotation.z=-s.groom*1.08;haunches[0].position.y=-.018-.019*s.rest;haunches[1].position.y=-.018-.022*s.rest;
    tail.rotation.z=.34+.019*breath-.10*s.rest;
  }
  function mouth(){return head.localToWorld(mouthLocal.clone())}
  return {root,state,update,mouth,crumb,head,shadow};
})();
