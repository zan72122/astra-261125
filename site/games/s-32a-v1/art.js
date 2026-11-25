'use strict';
const T=THREE, TAU=Math.PI*2, V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)), mix=(a,b,t)=>a+(b-a)*t;
const smooth=t=>(t=clamp(t))*t*(3-2*t);
let seed=74389;
function rand(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}
const range=(a,b)=>mix(a,b,rand());
function group(parent){let g=new T.Group();if(parent)parent.add(g);return g}
function material(color,roughness=.77,extra={}){return new T.MeshStandardMaterial({color,roughness,...extra})}
function mesh(parent,geometry,mat,x=0,y=0,z=0){let m=new T.Mesh(geometry,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m}
const globe=new T.SphereGeometry(1,32,24), cube=new T.BoxGeometry(1,1,1);
function oval(parent,mat,x,y,z,rx,ry,rz){let m=mesh(parent,globe,mat,x,y,z);m.scale.set(rx,ry,rz);return m}
function box(parent,mat,x,y,z,w,h,d){let m=mesh(parent,cube,mat,x,y,z);m.scale.set(w,h,d);return m}
function bevelBox(parent,mat,x,y,z,w,h,d,r=.03){
 let s=new T.Shape(),a=w/2-r,b=h/2-r;s.moveTo(-a,-b);s.lineTo(a,-b);s.lineTo(a,b);s.lineTo(-a,b);s.closePath();
 let geo=new T.ExtrudeGeometry(s,{depth:Math.max(.001,d-2*r),bevelEnabled:true,bevelThickness:r,bevelSize:r,bevelSegments:3});geo.translate(0,0,-(d-2*r)/2);planarUV(geo);return mesh(parent,geo,mat,x,y,z)}
function planarUV(g){let p=g.attributes.position,n=g.attributes.normal,uv=[];for(let i=0;i<p.count;i++){let x=p.getX(i),y=p.getY(i),z=p.getZ(i);if(Math.abs(n.getY(i))>.66)uv.push(x*.42,z*.42);else if(Math.abs(n.getX(i))>.66)uv.push(z*.42,y*.42);else uv.push(x*.42,y*.42)}g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));return g}
function cyl(parent,mat,x,y,z,rt,rb,h,n=64){return mesh(parent,new T.CylinderGeometry(rt,rb,h,n),mat,x,y,z)}
function rod(parent,mat,a,b,r1,r2=r1){let d=b.clone().sub(a),m=cyl(parent,mat,0,0,0,r2,r1,d.length(),12);m.position.copy(a).lerp(b,.5);m.quaternion.setFromUnitVectors(V(0,1,0),d.normalize());return m}
function turn(parent,mat,profile,x=0,y=0,z=0,n=96){return mesh(parent,new T.LatheGeometry(profile.map(v=>new T.Vector2(...v)),n),mat,x,y,z)}
function ring(parent,mat,x,y,z,rad,tube){let m=mesh(parent,new T.TorusGeometry(rad,tube,8,96),mat,x,y,z);m.rotation.x=Math.PI/2;return m}
function pathTube(parent,mat,points,r){return mesh(parent,new T.TubeGeometry(new T.CatmullRomCurve3(points),Math.max(12,points.length*4),r,6,false),mat)}
function texture(c){let tex=new T.CanvasTexture(c);tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=4;return tex}
function woodTexture(seedShift){
 const c=document.createElement('canvas');c.width=768;c.height=384;let ctx=c.getContext('2d'),im=ctx.createImageData(c.width,c.height);
 let phase=seedShift*2.31;
 for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){let u=x/c.width*TAU,v=y/c.height*TAU;
 let k=Math.exp(-((Math.cos(u+phase)-.47)**2*14+(Math.cos(v)-.2)**2*24));
 let f=v*15+.9*Math.sin(u+phase)+.24*Math.sin(3*u+2*v)+k*3.1;
 let grain=.5+.5*Math.sin(f),fine=Math.sin(f*3.0+.8*Math.sin(u*2)),a=224-14*Math.pow(grain,7)-5*fine+6*Math.cos(v*3+.4*Math.sin(u))+range(-5,5);
 let i=(y*c.width+x)*4;im.data[i]=a+9;im.data[i+1]=a+2;im.data[i+2]=a-9;im.data[i+3]=255}
 ctx.putImageData(im,0,0);for(let i=0;i<2800;i++){let x=rand()*c.width,y=rand()*c.height;ctx.strokeStyle=rand()>.4?'rgba(78,44,19,.12)':'rgba(255,246,221,.50)';ctx.lineWidth=range(.3,1);ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(x+8,y-.5,x+range(3,48),y+range(-.8,.8));ctx.stroke()}return texture(c)}
const grainTex=woodTexture(1),otherTex=woodTexture(4);
function wood(color,alt=false){let tex=alt?otherTex:grainTex;return material(color,.62,{map:tex,bumpMap:tex,bumpScale:.024})}
const M={honey:wood(0xd1a56d),light:wood(0xeac791),cut:wood(0xc1915e,true),walnut:wood(0x835434,true),dark:wood(0x513928),maple:wood(0xe4b47c,true),brass:material(0xb58b51,.35,{metalness:.57}),iron:material(0x534b3c,.55,{metalness:.43}),cream:material(0xf0dca9),bedding:wood(0xc9ad86)};
function flatBoard(parent,mat,shape,depth,bevel,x,y,z){
 let g=new T.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelThickness:bevel,bevelSize:bevel,bevelSegments:3,curveSegments:40});g.rotateX(-Math.PI/2);planarUV(g);return mesh(parent,g,mat,x,y,z)}
function circularBoard(parent,mat,r,holes,thick,b,y){
 let s=new T.Shape();s.absarc(0,0,r,0,TAU,false);for(const h of holes){let p=new T.Path();p.absarc(h.x,-h.z,h.r,0,TAU,true);s.holes.push(p)}return flatBoard(parent,mat,s,thick,b,0,y,0)}
function instance(parent,geo,mat,items){let m=new T.InstancedMesh(geo,mat,items.length),obj=new T.Object3D();items.forEach((it,i)=>{obj.position.copy(it.p);obj.scale.copy(it.s||V(1,1,1));obj.rotation.set(...(it.r||[0,0,0]));obj.updateMatrix();m.setMatrixAt(i,obj.matrix);if(it.c)m.setColorAt(i,new T.Color(it.c))});m.castShadow=m.receiveShadow=true;parent.add(m);return m}
function kernelGeometry(oat){
 let pos=[],col=[],idx=[],seg=18,rings=18;for(let j=0;j<=rings;j++){let f=j/rings,bulge=Math.pow(Math.max(.00003,Math.sin(f*Math.PI)),oat?.82:.65)*(1.07-.19*f);
 for(let i=0;i<=seg;i++){let a=i/seg*TAU,groove=Math.exp(-Math.pow((a-Math.PI)/.17,2)),v=.90+.065*Math.cos(a*6+f)+.05*Math.sin(f*8)-.22*groove;
 pos.push(Math.sin(a)*bulge*(oat?.045:.065),Math.cos(a)*bulge*(oat?.041:.056)*(1-.24*groove),(f-.5)*(oat?.31:.235));
 let c=new T.Color(oat?0xe4c280:0xd9a35d).multiplyScalar(v);col.push(c.r,c.g,c.b);if(j<rings&&i<seg){let k=j*(seg+1)+i;idx.push(k,k+seg+1,k+1,k+1,k+seg+1,k+seg+2)}}}
 let g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('color',new T.Float32BufferAttribute(col,3));g.setIndex(idx);g.computeVertexNormals();return g}
const kernels=[kernelGeometry(false),kernelGeometry(true)],husk=material(0xffffff,.8,{vertexColors:true,side:T.DoubleSide});
function kernel(parent,type){return mesh(parent,kernels[type],husk)}
