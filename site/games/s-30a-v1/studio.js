'use strict';
const T=THREE, V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z), PI=Math.PI, TAU=PI*2;
const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n)), mix=(a,b,t)=>a+(b-a)*t;
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t)};
const damp=(a,b,k,dt)=>mix(a,b,1-Math.exp(-k*dt));
function random(seed){return ()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296}}
const rand=random(4217);
const canvas=document.getElementById('habitat'), scene=new T.Scene(), camera=new T.PerspectiveCamera(42,1,.045,130);
const renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.65));
renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.09;
scene.fog=new T.FogExp2(0xbacfd0,.022);
scene.add(new T.HemisphereLight(0xfff7e9,0xc9a078,1.65));
const sun=new T.DirectionalLight(0xfff0ce,2.55);
sun.position.set(-4.6,9.8,4.6);sun.target.position.set(0,1,-1.3);scene.add(sun,sun.target);
sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
Object.assign(sun.shadow.camera,{left:-4.5,right:4.5,top:4.6,bottom:-4.6,near:.1,far:24});
sun.shadow.camera.updateProjectionMatrix();
sun.shadow.bias=-.00022;sun.shadow.normalBias=.003;
const group=(parent=scene)=>{const g=new T.Group();parent.add(g);return g};
const mat=(color,props={})=>new T.MeshStandardMaterial({color,roughness:.79,...props});
function mesh(p,geo,m,shadow=true){const o=new T.Mesh(geo,m);p.add(o);o.castShadow=shadow;o.receiveShadow=true;return o}
const sphereGeo=new T.SphereGeometry(1,36,26);
function oval(p,pos,size,m){const o=mesh(p,sphereGeo,m);o.position.copy(pos);o.scale.copy(size);return o}
function rod(p,a,b,r1,r2,m,n=14){const d=b.clone().sub(a);const o=mesh(p,new T.CylinderGeometry(r2,r1,d.length(),n),m);o.position.copy(a).lerp(b,.5);o.quaternion.setFromUnitVectors(V(0,1,0),d.normalize());return o}
function texture(w,h,paint,repeat=false){
 const c=document.createElement('canvas');c.width=w;c.height=h;paint(c.getContext('2d'),w,h);
 const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
 if(repeat)t.wrapS=t.wrapT=T.RepeatWrapping;return t;
}
// A loft with elliptical cross-sections. Stations are [x,y,z,side radius,depth radius].
function loft(p,stations,m,sides=36,rings=32){
 const g=new T.BufferGeometry(), positions=new Float32Array((sides+1)*(rings+1)*3),uv=[],idx=[];
 for(let j=0;j<=rings;j++)for(let i=0;i<=sides;i++){
  uv.push(i/sides,j/rings);const a=j*(sides+1)+i;if(i<sides&&j<rings)idx.push(a,a+1,a+sides+1,a+1,a+sides+2,a+sides+1)
 }
 g.setAttribute('position',new T.BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);
 function update(s){
  const path=new T.CatmullRomCurve3(s.map(c=>V(...c.slice(0,3))),false,'catmullrom',.42);
  const radii=new T.CatmullRomCurve3(s.map((c,i)=>V(c[3],c[4],i)),false,'catmullrom',.4);
  for(let j=0;j<=rings;j++){const t=j/rings,c=path.getPoint(t),dir=path.getTangent(t),right=V(1,0,0).addScaledVector(dir,-dir.x).normalize(),front=V().crossVectors(right,dir).normalize(),r=radii.getPoint(t);
   for(let i=0;i<=sides;i++){const a=-TAU*i/sides,ac=Math.cos(a)*Math.max(.0001,r.x),bs=Math.sin(a)*Math.max(.0001,r.y),k=3*(j*(sides+1)+i);
    positions[k]=c.x+right.x*ac+front.x*bs;positions[k+1]=c.y+right.y*ac+front.y*bs;positions[k+2]=c.z+right.z*ac+front.z*bs}
  }
  g.attributes.position.needsUpdate=true;g.computeVertexNormals();
  const normals=g.attributes.normal;for(let j=0;j<=rings;j++){const k=j*(sides+1),n=V().fromBufferAttribute(normals,k).add(V().fromBufferAttribute(normals,k+sides)).normalize();normals.setXYZ(k,n.x,n.y,n.z);normals.setXYZ(k+sides,n.x,n.y,n.z)}
  g.computeBoundingSphere();
 }
 update(stations);const o=mesh(p,g,m);o.reshape=update;return o;
}
function twig(p,points,radii,m,n=10,r=16){return loft(p,points.map((pt,i)=>[pt.x,pt.y,pt.z,radii[i],radii[i]]),m,n,r)}
function grainTexture(){
 const rnd=random(919);return texture(1024,512,(c,w,h)=>{
 const img=c.createImageData(w,h);const knots=[[.21,.22],[.76,.78],[.89,.35]];
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const u=x/w,v=y/h;let f=v+.005*Math.sin(14*u+v*9)+.009*Math.sin(7*u+v*25);
 for(const [kx,ky] of knots){const a=(u-kx)*5,b=(v-ky)*10;f+=.05*b*Math.exp(-a*a-b*b)}
 const wave=Math.sin(f*268+1.4*Math.sin(f*73));const pore=Math.pow(.5+.5*Math.sin(f*825+Math.sin(u*22)),10);
 const n=8*wave+6*Math.sin(f*75)+4*Math.sin(f*1073)-13*pore+(rnd()-.5)*12,i=4*(y*w+x);
 img.data[i]=170+n;img.data[i+1]=111+n*.84;img.data[i+2]=65+n*.65;img.data[i+3]=255}
 c.putImageData(img,0,0);
 for(let i=0;i<3400;i++){const x=rnd()*w,y=rnd()*h;c.strokeStyle=rnd()<.5?'rgba(60,32,18,.16)':'rgba(252,209,145,.19)';c.lineWidth=rnd()*.9+.2;c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x+8,y+.5,x+2+rnd()*43,y+rnd()*1.3);c.stroke()}
 },true)
}
const woodMap=grainTexture(),wood=mat(0xffe7c8,{map:woodMap,bumpMap:woodMap,bumpScale:.009}),woodDark=mat(0xc19d7a,{map:woodMap,bumpMap:woodMap,bumpScale:.009}),woodHoney=mat(0xffedbd,{map:woodMap,bumpMap:woodMap,bumpScale:.007});
const iron=mat(0x4b4c45,{metalness:.7,roughness:.56}),bronze=mat(0x927956,{metalness:.52,roughness:.48});
function woodUV(g,axis='x'){
 const pos=g.attributes.position,norm=g.attributes.normal,uv=[];
 for(let i=0;i<pos.count;i++){const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);const a=Math.abs(norm.getX(i)),b=Math.abs(norm.getY(i)),c=Math.abs(norm.getZ(i));
 const u=axis==='x'?x:axis==='y'?y:z;
 const v=axis==='x'?(b>c?z:y):axis==='y'?(a>c?z:x):(a>b?y:x);
 uv.push(u*.56+.317,v*1.35+.145)}
 g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));return g
}
function plank(p,x,y,z,w,h,d,m=wood,axis='x',bevel=.017){
 const s=new T.Shape(),r=Math.min(bevel,h*.2,w*.15,d*.22),a=w/2-r,b=h/2-r;
 s.moveTo(-a,-b);s.lineTo(a,-b);s.lineTo(a,b);s.lineTo(-a,b);s.closePath();
 const geo=new T.ExtrudeGeometry(s,{depth:d-2*r,bevelEnabled:true,bevelThickness:r,bevelSize:r,bevelSegments:3,curveSegments:6});
 geo.translate(0,0,-d/2+r);const o=mesh(p,woodUV(geo,axis),m);o.position.set(x,y,z);return o
}
// Draw fixed assemblies as one surface per finish while preserving all their shading.
function joinFixedParts(parent){
 const sets=new Map();
 for(const o of [...parent.children]){
  if(!o.isMesh||o.isInstancedMesh||Array.isArray(o.material))continue;
  const key=o.material.uuid+o.castShadow+o.receiveShadow;if(!sets.has(key))sets.set(key,[]);sets.get(key).push(o)
 }
 for(const parts of sets.values()){
  if(parts.length<3)continue;const positions=[],normals=[],uv=[],indices=[];
  for(const o of parts){
   o.updateMatrix();const nm=new T.Matrix3().getNormalMatrix(o.matrix),data=o.geometry.attributes,base=positions.length/3;
   for(let i=0;i<data.position.count;i++){const p=V().fromBufferAttribute(data.position,i).applyMatrix4(o.matrix),n=V().fromBufferAttribute(data.normal,i).applyMatrix3(nm).normalize();
    positions.push(p.x,p.y,p.z);normals.push(n.x,n.y,n.z);uv.push(data.uv?.getX(i)||0,data.uv?.getY(i)||0)}
   const old=o.geometry.index;if(old){for(let j=0;j<old.count;j++)indices.push(base+old.getX(j))}else{for(let j=0;j<data.position.count;j++)indices.push(base+j)}
   parent.remove(o)
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('normal',new T.Float32BufferAttribute(normals,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);
  const o=mesh(parent,g,parts[0].material,parts[0].castShadow);o.receiveShadow=parts[0].receiveShadow
 }
}
