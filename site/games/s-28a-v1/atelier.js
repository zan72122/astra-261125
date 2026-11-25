'use strict';
const T=THREE, V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const mix=(a,b,t)=>a+(b-a)*t, smooth=t=>clamp(t)*clamp(t)*(3-2*clamp(t));
let seed=281915;
function rand(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}
const canvas=document.querySelector('canvas');
const renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=T.PCFSoftShadowMap;
renderer.outputColorSpace=T.SRGBColorSpace;
renderer.toneMapping=T.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.10;
const scene=new T.Scene(), camera=new T.PerspectiveCamera(36,1,.08,75);
scene.background=new T.Color(0xf0e8d3);
scene.fog=new T.FogExp2(0xf0e5cf,.033);
function group(parent=scene){const g=new T.Group();parent.add(g);return g}
function mat(color,roughness=.65,extra={}){return new T.MeshStandardMaterial({color,roughness,...extra})}
function mesh(parent,geo,material,x=0,y=0,z=0){
 const m=new T.Mesh(geo,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m
}
const sphere=new T.SphereGeometry(1,40,32);
function ball(parent,x,y,z,a,b,c,material){
 const m=mesh(parent,sphere,material,x,y,z);m.scale.set(a,b,c);return m
}
function rounded(w,h,d,r){
 r=Math.min(r,w*.49,h*.49,d*.49);
 const geo=new T.BoxGeometry(w,h,d,8,8,8),p=geo.attributes.position,n=geo.attributes.normal;
 const ends=[w/2,h/2,d/2];
 for(let i=0;i<p.count;i++){
  const raw=[p.getX(i),p.getY(i),p.getZ(i)],q=[],delta=[];
  raw.forEach((v,j)=>{const k=v/ends[j],base=ends[j]-r;q[j]=Math.abs(k)<.01?0:Math.sign(k)*base;delta[j]=Math.sign(k)*r*Math.max(0,(Math.abs(k)-.25)/.75)});
  const len=Math.hypot(...delta)||1;
  p.setXYZ(i,...q.map((v,j)=>v+r*delta[j]/len));n.setXYZ(i,...delta.map(v=>v/len));
 }return geo
}
function box(parent,x,y,z,w,h,d,material,r=.035){
 return mesh(parent,r?rounded(w,h,d,r):new T.BoxGeometry(w,h,d),material,x,y,z)
}
function tube(parent,points,r,material,segments=28,sides=8){
 const path=new T.CatmullRomCurve3(points.map(p=>Array.isArray(p)?V(...p):p));
 return mesh(parent,new T.TubeGeometry(path,segments,r,sides,false),material)
}
function lathe(parent,x,y,z,profile,material,count=72){
 return mesh(parent,new T.LatheGeometry(profile.map(p=>new T.Vector2(...p)),count),material,x,y,z)
}
function procedural(color,kind,axis='z'){
 const m=mat(color,kind==='wood'?.52:.71);
 m.onBeforeCompile=s=>{
  s.vertexShader='varying vec3 vCraft;\n'+s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvCraft=position;');
  s.fragmentShader=`varying vec3 vCraft;
  float hash21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float n2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash21(i),hash21(i+vec2(1,0)),f.x),mix(hash21(i+vec2(0,1)),hash21(i+1.),f.x),f.y);}
  `+s.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n'+(kind==='wood'?`
   vec3 wp=vCraft.${axis==='z'?'xyz':axis==='x'?'zyx':'xzy'};
   float flow=wp.x+wp.y*.55+.031*sin(wp.z*2.6+2.*wp.x)+.032*n2(wp.xz*2.);
   float rings=.5+.5*sin(flow*84.+4.*n2(vec2(flow*10.,wp.z*.64)));
   float fibers=n2(vec2(flow*265.,wp.z*5.));
   float streak=n2(vec2(flow*36.,wp.z*1.2));
   diffuseColor.rgb*=.82+.19*streak+.18*fibers+.08*rings-.12*pow(rings,7.);
  `:`vec2 q=vCraft.xz+vCraft.y*vec2(.6,.81);
   diffuseColor.rgb*=.945+.052*n2(q*4.)+.035*n2(q*112.);
  `));
 };m.customProgramCacheKey=()=>kind+axis;return m
}
const oak=procedural(0xc78c51,'wood'),oakX=procedural(0xc78c51,'wood','x'),walnut=procedural(0x9a633e,'wood','x'),honey=procedural(0xdfa766,'wood'),brass=mat(0xc39b53,.36,{metalness:.64});
const ivory=mat(0xf1efe4,.27),blue=mat(0x47798e,.3),green=mat(0x82958a,.66);
function texture(w,h,paint){const c=document.createElement('canvas');c.width=w;c.height=h;paint(c.getContext('2d'),w,h);const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());return tex}
const softShadow=texture(128,128,(c,w,h)=>{let g=c.createRadialGradient(64,64,1,64,64,64);g.addColorStop(0,'rgba(42,25,16,.66)');g.addColorStop(.43,'rgba(48,32,20,.36)');g.addColorStop(1,'rgba(58,38,24,0)');c.fillStyle=g;c.fillRect(0,0,w,h)});
function contact(parent,x,y,z,w,d,opacity=.6){
 const m=mesh(parent,new T.PlaneGeometry(w,d),new T.MeshBasicMaterial({map:softShadow,transparent:true,opacity,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1}),x,y,z);
 m.rotation.x=-Math.PI/2;m.castShadow=m.receiveShadow=false;return m
}
const ambient=new T.HemisphereLight(0xfff6e6,0xc5baab,1.73);scene.add(ambient);
const sun=new T.DirectionalLight(0xffedcd,3.1);
sun.position.set(-4.6,8.7,-2.8);sun.target.position.set(0,0,1.1);scene.add(sun,sun.target);
sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
Object.assign(sun.shadow.camera,{left:-6.7,right:6.7,top:7.3,bottom:-7.3,near:.2,far:24});
sun.shadow.normalBias=.013;sun.shadow.bias=-.00022;sun.shadow.radius=3;
const fill=new T.DirectionalLight(0xdcefff,.72);fill.position.set(2,4,5);scene.add(fill);
const env=texture(512,256,(c,w,h)=>{
 c.fillStyle='#7c786c';c.fillRect(0,0,w,h);c.fillStyle='#e2d9c5';c.fillRect(0,0,w,110);
 c.fillStyle='#fffae9';for(let i=0;i<4;i++)for(let j=0;j<2;j++)c.fillRect(65+i*15,69+j*21,13,19);
 c.fillStyle='#c1b4a2';c.fillRect(348,74,66,48);c.fillStyle='#645947';c.fillRect(0,160,512,96)
});env.mapping=T.EquirectangularReflectionMapping;scene.environment=env;
// Batch the stationary joinery and foliage so the moving fur and grains have the GPU budget.
function bakeStatic(root){
 root.updateWorldMatrix(true,true);
 const local=root.matrixWorld.clone().invert(),batches=new Map();
 root.traverse(o=>{
 if(!o.isMesh||Array.isArray(o.material)||o.material.transparent)return;
 let batch=batches.get(o.material);if(!batch){batch=[];batches.set(o.material,batch)}batch.push(o)
 });
 for(const [material,objects] of batches){
 if(objects.length<3)continue;
 const pos=[],norm=[],uv=[],indices=[];let offset=0;
 for(const o of objects){
 const matrix=new T.Matrix4().multiplyMatrices(local,o.matrixWorld),rotation=new T.Matrix3().getNormalMatrix(matrix);
 const geom=o.geometry,p=geom.attributes.position,n=geom.attributes.normal,st=geom.attributes.uv,v=V();
 for(let i=0;i<p.count;i++){
 v.fromBufferAttribute(p,i).applyMatrix4(matrix);pos.push(v.x,v.y,v.z);
 v.fromBufferAttribute(n,i).applyNormalMatrix(rotation);norm.push(v.x,v.y,v.z);uv.push(st?st.getX(i):0,st?st.getY(i):0)
 }
 if(geom.index){for(let i of geom.index.array)indices.push(i+offset)}else{for(let i=0;i<p.count;i++)indices.push(i+offset)}
 offset+=p.count;o.removeFromParent()
 }
 const g=new T.BufferGeometry();g.setIndex(indices);g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('normal',new T.Float32BufferAttribute(norm,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
 const out=mesh(root,g,material);out.castShadow=objects[0].castShadow;out.receiveShadow=objects[0].receiveShadow
 }
}
