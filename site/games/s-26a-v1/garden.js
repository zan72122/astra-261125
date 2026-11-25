'use strict';
const G = (() => {
  const T=THREE, V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z), C=c=>new T.Color(c);
  const pi=Math.PI, tau=pi*2, clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x)), mix=T.MathUtils.lerp;
  const smooth=(a,b,x)=>{let t=clamp((x-a)/(b-a)); return t*t*(3-2*t)};
  function seeded(seed){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}}
  const r=seeded(607124), range=(a,b)=>mix(a,b,r()), choose=a=>a[Math.floor(r()*a.length)];
  const scene=new T.Scene(), canvas=document.getElementById('garden');
  const renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance',alpha:false});
  renderer.shadowMap.enabled=true; renderer.shadowMap.type=T.PCFSoftShadowMap;
  renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.13;
  scene.background=C(0xbac9a6);scene.fog=new T.FogExp2(0xb8c49c,.063);
  const camera=new T.PerspectiveCamera(35,1,.07,65);
  const sun=new T.DirectionalLight(0xffe4ba,3.1);sun.position.set(-6.7,5.2,-2.7);sun.target.position.set(0,.4,-.2);scene.add(sun,sun.target);
  sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
  Object.assign(sun.shadow.camera,{left:-5.6,right:5.6,top:5.6,bottom:-5.6,near:.3,far:20});sun.shadow.normalBias=.009;sun.shadow.bias=-.00022;
  scene.add(new T.HemisphereLight(0xfff6dd,0x929c79,1.52));
  const fill=new T.DirectionalLight(0xffefdc,.65);fill.position.set(-2,2.4,4);scene.add(fill);
  const rim=new T.DirectionalLight(0xffe4a4,1.48);rim.position.set(1,4,-5);scene.add(rim);
  const surface=(color,extra={})=>new T.MeshStandardMaterial({color,roughness:.91,...extra});
  const vertexMat=surface(0xffffff,{vertexColors:true,side:T.DoubleSide});
  function mesh(geo,mat,parent=scene,cast=true,receive=true){let m=new T.Mesh(geo,mat);m.castShadow=cast;m.receiveShadow=receive;parent.add(m);return m}
  function group(parent=scene){let g=new T.Group();parent.add(g);return g}
  const sphere=new T.SphereGeometry(1,32,20);
  function oval(parent,mat,x,y,z,sx,sy,sz){let o=mesh(sphere,mat,parent);o.position.set(x,y,z);o.scale.set(sx,sy,sz);return o}
  // Collect small, solid plant and wicker parts in a shared draw call.
  class Batch{
    constructor(){this.p=[];this.c=[];this.i=[]}
    v(p,c){let k=this.p.length/3;this.p.push(p.x,p.y,p.z);this.c.push(c.r,c.g,c.b);return k}
    tri(a,b,c){this.i.push(a,b,c)}
    tube(points,width,color,sides=6,grain=0){
      if(points.length<2)return; let prev=null,base=this.p.length/3,h=C(color),prior;
      for(let j=0;j<points.length;j++){
        let t=j/(points.length-1),d=points[Math.min(j+1,points.length-1)].clone().sub(points[Math.max(0,j-1)]).normalize();
        let n=prior?prior.clone().addScaledVector(d,-prior.dot(d)).normalize():V().crossVectors(d,Math.abs(d.y)<.85?V(0,1,0):V(0,0,1)).normalize();
        let b=V().crossVectors(d,n).normalize();prior=n;
        let rad=typeof width==='function'?width(t):width;
        for(let k=0;k<sides;k++){let a=tau*k/sides,s=n.clone().multiplyScalar(Math.cos(a)).addScaledVector(b,Math.sin(a));
          this.v(points[j].clone().addScaledVector(s,rad),h.clone().multiplyScalar(1+grain*Math.sin(k*2.38+j*.11)))}
        if(prev!==null)for(let k=0;k<sides;k++){let l=(k+1)%sides,u=base+j*sides;this.tri(prev+k,prev+l,u+k);this.tri(prev+l,u+l,u+k)}
        prev=base+j*sides;
      }
    }
    leaf(a,b,w,col,bend=.04,roll=0){
      let d=b.clone().sub(a),n=V(d.z,0,-d.x);if(n.lengthSq()<.00001)n.set(1,0,0);n.normalize().applyAxisAngle(d.clone().normalize(),roll);
      let h=C(col),ids=[],steps=3;
      for(let j=0;j<=steps;j++){
        let t=j/steps,mid=a.clone().addScaledVector(d,t);mid.y+=Math.sin(t*pi)*bend;
        let wid=w*(Math.pow(Math.sin(t*pi),.79)*.98+.01),ridge=mid.clone();ridge.y+=wid*.24;
        ids.push([this.v(mid.clone().addScaledVector(n,-wid),h),this.v(ridge,h.clone().multiplyScalar(1.10)),this.v(mid.clone().addScaledVector(n,wid),h.clone().multiplyScalar(.88))]);
        if(j){let p=ids[j-1],q=ids[j];this.tri(p[0],q[0],p[1]);this.tri(p[1],q[0],q[1]);this.tri(p[1],q[1],p[2]);this.tri(p[2],q[1],q[2])}
      }
    }
    blade(a,b,w,color,curve=.014){
      let d=b.clone().sub(a),side=V(-d.z,0,d.x).normalize().multiplyScalar(w),mid=a.clone().lerp(b,.51);
      mid.y+=curve;
      let c=C(color),k=this.v(a.clone().sub(side),c.clone().multiplyScalar(.78));
      this.v(a.clone().add(side),c.clone().multiplyScalar(.92));
      this.v(mid.clone().sub(side.clone().multiplyScalar(.73)),c);
      this.v(mid.clone().add(side.clone().multiplyScalar(.73)),c.clone().multiplyScalar(1.09));
      this.v(b,c.clone().multiplyScalar(1.12));this.tri(k,k+2,k+1);this.tri(k+1,k+2,k+3);this.tri(k+2,k+4,k+3);
    }
    geometry(){let g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(this.p,3));g.setAttribute('color',new T.Float32BufferAttribute(this.c,3));g.setIndex(this.i);g.computeVertexNormals();return g}
    build(parent=scene,mat=vertexMat,cast=true,receive=true){return mesh(this.geometry(),mat,parent,cast,receive)}
  }
  function path(points,count=28){return new T.CatmullRomCurve3(points).getPoints(count)}
  const groundY=-.095;
  // A generated flax weave with strands that cross over and under one another.
  function linen(){
    let size=256,data=new Uint8Array(size*size*4),relief=new Uint8Array(size*size*4);
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      let u=x+.8*Math.sin(y*tau/64),v=y+.62*Math.sin(x*tau/128);
      let warp=Math.cos(u*tau/8),weft=Math.cos(v*tau/9.142857);
      let atop=(Math.floor(u/8)+Math.floor(v/9.142857))%2===0;
      let ridge=atop?warp*.57+weft*.22:weft*.56+warp*.22;
      let val=220+ridge*21+range(-10,10)+4*Math.sin(u*tau/32),k=4*(y*size+x);
      data[k]=val;data[k+1]=val*.963;data[k+2]=val*.859;data[k+3]=255;
      relief.fill(128+65*ridge,k,k+3);relief[k+3]=255;
    }
    function tex(bytes,srgb){let t=new T.DataTexture(bytes,size,size);t.wrapS=t.wrapT=T.RepeatWrapping;t.magFilter=T.LinearFilter;t.minFilter=T.LinearMipmapLinearFilter;t.generateMipmaps=true;t.anisotropy=4;if(srgb)t.colorSpace=T.SRGBColorSpace;t.needsUpdate=true;return t}
    return [tex(data,true),tex(relief,false)]
  }
  const [fabric,bump]=linen(),clothMat=surface(0xfff3db,{map:fabric,bumpMap:bump,bumpScale:.017,vertexColors:true,side:T.DoubleSide});
  const cushion={x:0,z:0,h:0},folds=[],hollowX=mix(-.7,.2,Math.random()),rugW=3.36,rugD=2.08;
  function rearZ(x){return -.96+.13*Math.sin(x*1.55)+x*.095}
  function clothY(x,z){
    let q=(z-rearZ(x))/.21;
    let y=.025+.018*Math.sin(x*2.8+z*1.6)+(.13+.125*Math.exp(-((x+.7)**2)/2.4))*Math.exp(-q*q)-.027*Math.exp(-((q-1.4)**2));
    for(let f of folds){let dx=(x-f.x)/f.wx,dz=(z-f.z)/f.wz;y+=f.h*(Math.exp(-dx*dx-dz*dz)-.32*Math.exp(-dx*dx-(dz-1.45)**2))}
    y-=.024*Math.exp(-((x-hollowX)**2)/.16-((z+.58)**2)/.06);
    if(cushion.h>.0003)y-=cushion.h*Math.exp(-((x-cushion.x)**2)/.30-((z-cushion.z)**2)/.20);
    return y;
  }
  function rugPoint(u,v){let x=u*rugW*(1-.088*Math.pow(Math.abs(v),8)),z=v*rugD*(1-.122*Math.pow(Math.abs(u),8));return V(x+.095*v+.034*Math.sin(2.6*v+u),clothY(x,z),z+.042*Math.sin(u*5+v))}
  const rug=new Batch(),uv=[],samples=[],nx=112,nz=86;
  for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){
    let u=i/nx*2-1,v=j/nz*2-1,p=rugPoint(u,v),dist=Math.min((1-Math.abs(u))*rugW,(1-Math.abs(v))*rugD);
    let co=C(0xfffbeb);
    if((dist>.083&&dist<.124)||(dist>.18&&dist<.205))co=C(0x9c8165);
    if(dist>.132&&dist<.167)co=C(0xc6ab87);
    rug.v(p,co);uv.push(p.x*1.8,p.z*1.8);samples.push([p.x,p.z]);
    if(i&&j){let k=j*(nx+1)+i; rug.tri(k,k-nx-2,k-1);rug.tri(k,k-nx-1,k-nx-2)}
  }
  const rugGeo=rug.geometry();rugGeo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
  const cloth=mesh(rugGeo,clothMat);cloth.geometry.computeVertexNormals();
  const movingEdges=[];
  function boundEdge(b){
    let o=b.build(),pos=o.geometry.attributes.position,dy=new Float32Array(pos.count);
    for(let i=0;i<pos.count;i++)dy[i]=pos.getY(i)-clothY(pos.getX(i),pos.getZ(i));
    movingEdges.push({geo:o.geometry,dy});
  }
  function updateCloth(){
    let pos=rugGeo.attributes.position;for(let k=0;k<samples.length;k++)pos.setY(k,clothY(...samples[k]));
    pos.needsUpdate=true;rugGeo.computeVertexNormals();
    for(let {geo,dy} of movingEdges){
      let p=geo.attributes.position;for(let i=0;i<p.count;i++)p.setY(i,clothY(p.getX(i),p.getZ(i))+dy[i]);
      p.needsUpdate=true;geo.computeVertexNormals();
    }
  }
  const hem=new Batch();
  for(let side of [-1,1])for(let j=0;j<251;j++){
    let t=j/250*2-1,a=rugPoint(t,side),len=range(.045,.17),b=a.clone().add(V(range(-.025,.025),-.025,len*side));
    hem.tube([a,a.clone().lerp(b,.54).add(V(.015,.008,0)),b],t=>.008*(1-t*.75),choose([0xd2bf96,0xe1d1ae,0xc1ae89]),4);
  }
  for(let side of [-1,1]){let pts=[];for(let j=0;j<=95;j++)pts.push(rugPoint(side,j/95*2-1));hem.tube(pts,.015,0xc8b48f,6)}
  const edge=[];
  for(let i=0;i<100;i++)edge.push(rugPoint(-1+i/50,-1));
  for(let i=0;i<66;i++)edge.push(rugPoint(1,-1+i/33));
  for(let i=0;i<100;i++)edge.push(rugPoint(1-i/50,1));
  for(let i=0;i<=66;i++)edge.push(rugPoint(-1,1-i/33));
  const edging=new Batch();
  for(let j=0;j<edge.length;j++){let p=edge[j];
    let k=edging.v(p,C(0xd6c6a7));edging.v(V(p.x,p.y-.033,p.z),C(0xd1c09c));edging.v(V(p.x*.999,groundY+.005,p.z*.999),C(0xb2a182));
    if(j){edging.tri(k-3,k,k-2);edging.tri(k-2,k,k+1);edging.tri(k-2,k+1,k-1);edging.tri(k-1,k+1,k+2)}
  }
  boundEdge(edging);hem.tube(edge,.014,0xd6c4a1,5);
  boundEdge(hem);
  // Soft light filtered by the high canopy also mottles the earth below the fence.
  const earth=new Batch();let ne=52;
  for(let j=0;j<=ne;j++)for(let i=0;i<=ne;i++){
    let x=(i/ne-.5)*30,z=(j/ne-.6)*25,patch=(Math.sin(x*1.9+Math.sin(z*1.8))+Math.cos(z*2.1-x*.55))*.22+.5;
    let col=C(0x68734a).lerp(C(0xb7ac70),clamp(patch+range(-.15,.15)));
    earth.v(V(x,groundY+.016*Math.sin(x*4+z*2),z),col);
    if(i&&j){let k=j*(ne+1)+i;earth.tri(k,k-ne-2,k-1);earth.tri(k,k-ne-1,k-ne-2)}
  }earth.build(scene,vertexMat,false);
  const grass=new Batch(),flowers=new Batch();
  const greens=[0x72884c,0x8a9c57,0x9ca568,0x647c45,0xa8ae6e,0xb9b477,0x88934f],petals=[0xfffae5,0xf8efd2,0xfff6d9];
  function daisy(x,z,h,size,yellow=false){
    let p=V(x,groundY,z),top=p.clone().add(V(range(-.08,.08),h,range(-.045,.045)));
    flowers.tube([p,p.clone().lerp(top,.5).add(V(.024,0,.01)),top],.007,0x78864a,5);
    let norm=V(range(-.5,.5),range(.55,1),range(.0,.75)).normalize(),u=V().crossVectors(norm,V(1,0,0)).normalize(),v=V().crossVectors(u,norm);
    let count=yellow?7:range(13,17)|0;
    for(let i=0;i<count;i++){let a=tau*(i+range(-.12,.12))/count,d=u.clone().multiplyScalar(Math.cos(a)).addScaledVector(v,Math.sin(a)),end=top.clone().addScaledVector(d,size*range(.87,1.08));end.y+=size*.08;
      flowers.leaf(top,end,size*(yellow?.28:.138),yellow?choose([0xe7bf37,0xf5ca45]):choose(petals),size*.20,.15)}
    flowers.tube([top,top.clone().addScaledVector(norm,size*.16)],t=>size*(.26-.04*t),yellow?0xd49b21:0xe0b03d,10);
  }
  for(let i=0;i<6500;i++){
    let x=range(-9.5,9.5),z=range(-8,5.8);
    if(Math.abs(x)<3.36&&Math.abs(z)<2.12)continue;
    let y=groundY+.006,h=range(.068,.30)*(z<-3?1.55:1),col=choose(greens);
    for(let b=0;b<4;b++){let base=V(x+range(-.058,.058),y,z+range(-.04,.04)),d=range(0,tau),l=h*range(.65,1.55);
      grass.blade(base,base.clone().add(V(Math.cos(d)*l*.62,l,Math.sin(d)*l*.6)),range(.009,.024),col,.025,range(-.9,.9))}
    if(i%27===0&&z<3.1)daisy(x,z,h+.12,range(.047,.089),i%3!==0);
  }
  // Little islands of daisies and clover frame the mat.
  for(let [x,z,n] of [[-2.78,1.71,12],[2.45,1.96,11],[-1.84,-2.17,16],[1.62,-2.26,14],[-3.36,-.35,14],[3.5,.9,15],[-2.03,2.22,7],[-1.39,2.39,9],[1.65,2.34,14]]){
    for(let i=0;i<n;i++){let xx=x+range(-.3,.3),zz=z+range(-.22,.22);if(Math.abs(xx)<3.22&&Math.abs(zz)<2)continue;daisy(xx,zz,range(.19,.44),range(.055,.096),i%5===0)}
  }
  grass.build(scene,vertexMat,false);flowers.build();
  const wood=new Batch();
  // Uneven hand-split paling fence, with weathered grain and softened shoulders.
  for(let i=-21;i<=21;i++){
    let x=i*.45+range(-.045,.045),z=-4.4+.20*Math.sin(x*.64),h=range(1.22,1.72),w=range(.15,.205),sl=range(-.08,.08),base=C(choose([0x988766,0x887a5c,0xa18b66,0xa69573,0x9a8f6d]));
    let pts=[[-w,0],[w,0],[w+sl,h-.21],[w*.48+sl,h-.045],[sl,h],[sl-w*.68,h-.066],[-w+sl,h-.22]];
    let pair=[];for(let dz of [-.068,.068])pair.push(pts.map(([xx,yy])=>wood.v(V(x+xx,yy+groundY,z+dz),base.clone().multiplyScalar(dz>0?1:.72))));
    for(let k=1;k<pts.length-1;k++)wood.tri(pair[1][0],pair[1][k],pair[1][k+1]);
    for(let k=0;k<pts.length;k++){let l=(k+1)%pts.length;wood.tri(pair[0][k],pair[1][k],pair[1][l]);wood.tri(pair[0][k],pair[1][l],pair[0][l])}
    for(let g=0;g<5;g++){let xx=range(-w*.8,w*.8),lo=range(0,.75),hi=range(.8,h-.17);wood.tube([V(x+xx,lo,z+.071),V(x+xx+.014,(lo+hi)/2,z+.072),V(x+xx+sl*.7,hi,z+.071)],range(.003,.008),base.clone().multiplyScalar(range(.72,.91)),3)}
  }
  for(let y of [.30,.98])wood.tube([V(-10,y,-4.21),V(0,y+.02,-4.22),V(10,y,-4.21)],.069,0x988462,7);
  wood.build();
  const arch=new Batch(),willow=new Batch(),archLeft=-2.32,archRight=2.13,archZ=-1.62;
  function archP(t,depth=0){let a=pi*t;return V(mix(archLeft,archRight,(1-Math.cos(a))/2)+.078*Math.sin(2*a),2.95*Math.sin(a)**.89-.065,archZ+depth+.12*Math.sin(a*1.7))}
  const willowColors=[0x798a49,0x8f9d5d,0xa6ad70,0x667e49,0x95a258,0xb2b679];
  function sprig(a,dir,size,num){
    let points=[];for(let i=0;i<=num;i++){let f=i/num;points.push(a.clone().addScaledVector(dir,f*size).add(V(.035*Math.sin(f*pi),-.32*size*f*f,.05*Math.sin(f*pi))))}
    willow.tube(points,t=>.014*(1-.86*t),0x85845c,5);
    for(let i=1;i<num;i++){let f=i/num,side=i%2?1:-1,base=points[i],l=size*range(.20,.43)*(1-f*.42);
      willow.leaf(base,base.clone().add(V(side*l*range(.5,1),-.68*l,range(-.65,.65)*l)),l*range(.095,.148),choose(willowColors),l*.14,range(-.95,1.1))}
  }
  for(let lane of [0,1]){
    let depth=-lane*.63;
    for(let n=0;n<8;n++){
      let pts=[];for(let j=0;j<=83;j++){let t=j/83,a=t*pi,twist=t*tau*(1.5+n*.13)+n*tau/8,rad=(.083+.027*Math.sin(t*pi*3+n))*(lane?.8:1),p=archP(t,depth);p.x+=Math.cos(a)*Math.cos(twist)*rad;p.y-=Math.sin(a)*Math.cos(twist)*rad;p.z+=Math.sin(twist)*rad;pts.push(p)}
      arch.tube(pts,t=>.019+.009*(1-t)+.007*(n%3),choose([0x867148,0x94815a,0x756542,0xa18a5b,0x725d3e]),7,.13);
    }
    for(let j=0;j<11;j++){let t=.045+j*.09,p=archP(t,depth),a=t*pi,normal=V(Math.cos(a),-Math.sin(a),0);
      for(let k=0;k<4;k++){let ring=[];for(let i=0;i<=12;i++){let q=tau*i/12;ring.push(p.clone().addScaledVector(normal,.110*Math.cos(q)).add(V(Math.sin(a)*k*.018,Math.cos(a)*k*.018,.110*Math.sin(q))))}arch.tube(ring,.009,0xb4a076,5)}
      if(!lane&&j%2===0){let q=archP(t,-.63);arch.tube(path([p,p.clone().lerp(q,.5).add(V(0,.047,0)),q],9),.022,0x93805b,6)}
    }
    for(let i=0;i<41;i++){let t=range(.035,.99),p=archP(t,depth),out=t<.5?-1:1;
      sprig(p,V(out*range(.18,.64),range(.1,.85),range(-.55,.55)).normalize(),range(.23,.74),9);}
  }
  arch.build();willow.build();
  // Nearby orchard branches cast real, broken shadows across the linen.
  const branches=new Batch(),leaves=new Batch();
  const canopyColors=[0x536e42,0x6e8650,0x839456,0x92a368,0xa2aa69,0x778d54];
  for(let tree=0;tree<20;tree++){
    let x=tree<14?range(-12,12):(tree%2?1:-1)*range(5.2,8),z=tree<14?range(-10,-5):range(-4,1),h=range(3.8,7.3),base=V(x,-.2,z);
    let crown=V(x+range(-.6,.6),h,z+range(-.7,.7));branches.tube(path([base,base.clone().lerp(crown,.46).add(V(.18,0,0)),crown],10),t=>.18*(1-.80*t),0x726f50,8,.13);
    for(let n=0;n<11;n++){let d=range(0,tau),hub=crown.clone().add(V(Math.cos(d)*range(.5,2.1),range(-1.2,.7),Math.sin(d)*range(.6,1.7)));
      branches.tube([base.clone().lerp(crown,range(.53,.81)),hub],t=>.075*(1-.91*t),0x807b58,6);
      for(let k=0;k<22;k++){let a=hub.clone().add(V(range(-.77,.77),range(-.32,.32),range(-.76,.76))),l=range(.22,.49);
        leaves.leaf(a,a.clone().add(V(range(-l,l),range(-.14,.38),range(-l,l))),l*.43,choose(canopyColors),.07,range(-1,1))}
    }
  }
  branches.build();leaves.build();
  // A few banks of low foliage leave gaps through which the fence remains visible.
  const hedge=new Batch();
  for(let i=0;i<1700;i++){
    let x=range(-10,10),z=range(-5.45,-3.37),h=(.51+.32*Math.sin(x*1.45+z*.7)+.13*Math.cos(x*3))*(z< -4?1.5:.81);
    let a=V(x,range(.04,Math.max(.1,h)),z),d=range(0,tau),l=range(.10,.29);
    hedge.leaf(a,a.clone().add(V(Math.cos(d)*l,range(.045,.20),Math.sin(d)*l)),l*.30,choose(canopyColors),.02,range(-1,1));
  }hedge.build();
  function contact(parent,x,z,sx,sz,alpha){
    const mat=new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{opacity:{value:alpha}},vertexShader:'varying vec2 v; void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform float opacity; varying vec2 v; void main(){float d=length((v-.5)*2.);gl_FragColor=vec4(.13,.092,.045,opacity*(1.-smoothstep(.08,1.,d)));\n#include <colorspace_fragment>\n}'});
    let o=mesh(new T.PlaneGeometry(2,2),mat,parent,false,false);o.rotation.x=-pi/2;o.position.set(x,.061,z);o.scale.set(sx,sz,1);o.renderOrder=1;return o;
  }
  return {cushion,T,V,C,pi,tau,r,range,choose,clamp,mix,smooth,seeded,scene,canvas,renderer,camera,mesh,group,oval,surface,Batch,path,vertexMat,clothY,updateCloth,folds,rearZ,rugW,rugD,archLeft,archRight,archZ,contact};
})();
