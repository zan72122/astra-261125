'use strict';
const T=THREE, canvas=document.querySelector('#pond');
const renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=T.PCFShadowMap;
renderer.toneMapping=T.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.04;
const scene=new T.Scene(), camera=new T.PerspectiveCamera(39,1,.035,120);
const v=(x,y,z)=>new T.Vector3(x,y,z), col=c=>new T.Color(c);
const clamp=T.MathUtils.clamp, mix=T.MathUtils.lerp, tau=Math.PI*2;
const ease=(a,b,x)=>{let t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)};
let seed=(Math.random()*4294967296)>>>0;
function ran(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}
const range=(a,b)=>mix(a,b,ran());
function std(c,r=.72,opts={}){return new T.MeshStandardMaterial({color:c,roughness:r,...opts})}
function mesh(g,m,parent=scene){let o=new T.Mesh(g,m);parent.add(o);return o}
function group(parent=scene){const o=new T.Group();parent.add(o);return o}
const ballGeo=new T.SphereGeometry(1,32,24);
function ell(parent,m,x,y,z,a,b,c){const o=mesh(ballGeo,m,parent);o.position.set(x,y,z);o.scale.set(a,b,c);return o}
function geo(pos,idx,colors,uv){let g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setIndex(idx);if(colors)g.setAttribute('color',new T.Float32BufferAttribute(colors,3));if(uv)g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.computeVertexNormals();return g}
function tube(parent,pts,r,material,segments=16){return mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts),segments,r,6,false),material,parent)}
const shaderNoise=`
float hsh(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float pondNoise(vec2 p){vec2 i=floor(p),u=fract(p);u=u*u*(3.-2.*u);return mix(mix(hsh(i),hsh(i+vec2(1,0)),u.x),mix(hsh(i+vec2(0,1)),hsh(i+vec2(1)),u.x),u.y);}
`;
function grainMaterial(c,kind){
 let m=std(c,kind==='stone'?.87:.66);
 m.onBeforeCompile=s=>{
 s.vertexShader='varying vec3 surfP;\n'+s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nsurfP=position;');
 s.fragmentShader='varying vec3 surfP;\n'+shaderNoise+s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
 vec2 p=surfP.xz+surfP.y*vec2(.43,.86);
 float n=pondNoise(p*7.)*.55+pondNoise(p*27.)*.3+pondNoise(p*140.)*.15;
 ${kind==='stone'?`float seam=smoothstep(.89,.99,sin(surfP.y*78.+n*8.+p.x*3.));
 diffuseColor.rgb*=.75+.34*n+.15*pondNoise(p*400.)-.06*seam;
 diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.4,.39,.24),.18*smoothstep(.5,.72,n));`:`float grain=sin((surfP.x+.009*sin(surfP.z*9.)+.013*sin(surfP.z*3.+surfP.x*25.))*380.);
 diffuseColor.rgb*=.78+.24*n+.12*grain+.035*sin(surfP.x*870.+n*2.);`}
 `);
 };
 m.customProgramCacheKey=()=>kind;return m;
}
scene.fog=new T.FogExp2(0xf5cd9e,.029);
const hemi=new T.HemisphereLight(0xffebd0,0xa6ccda,1.85);scene.add(hemi);
const sun=new T.DirectionalLight(0xffdbab,2.35);sun.position.set(-5,7,-3);sun.castShadow=true;
sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-8,right:8,top:8,bottom:-8,near:.1,far:28});sun.shadow.camera.updateProjectionMatrix();sun.shadow.normalBias=.013;sun.shadow.bias=-.00025;scene.add(sun);
const fill=new T.DirectionalLight(0xc6e6ff,.65);fill.position.set(3,4,5);scene.add(fill);
const skyMat=new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:{},vertexShader:'varying vec3 w;void main(){w=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`
varying vec3 w;${shaderNoise}
void main(){vec3 d=normalize(w);float h=d.y; vec3 s=mix(vec3(1.24,.77,.46),vec3(.28,.61,.72),smoothstep(-.035,.48,h));
float distSun=distance(d,normalize(vec3(-.142,.132,-1.)));s+=vec3(.95,.53,.22)*exp(-distSun*4.8)+vec3(2.9,2.45,1.44)*(1.-smoothstep(.030,.037,distSun));
float cloud=pondNoise(d.xz*4.+vec2(d.y*13.,0.))*.55+pondNoise(vec2(d.x*7.,d.y*65.))*.45;
s=mix(s,vec3(1.21,.94,.75),smoothstep(.43,.69,cloud)*.42*smoothstep(.025,.16,h));gl_FragColor=vec4(s,1.);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`});
mesh(new T.SphereGeometry(90,44,25),skyMat).renderOrder=-10;
// Distant ridgelines and low, irregular silhouettes along the other shore.
function ridge(z,base,amp,c,phase){
 let p=[],idx=[],colors=[];for(let i=0;i<=150;i++){let x=-68+i*136/150, y=base+amp*(.52*Math.sin(x*.23+phase)+.27*Math.sin(x*.48+phase)+.17*Math.sin(x*.98)+.08*Math.sin(x*2.3));
 for(let j=0;j<3;j++){p.push(x,j===0?-2:j===1?y-.22:y,z+.18*j);let k=col(c).multiplyScalar(1+j*.065);colors.push(k.r,k.g,k.b)}
 if(i)for(let j=0;j<2;j++){let a=(i-1)*3+j;idx.push(a,a+3,a+1,a+1,a+3,a+4)}}
 mesh(geo(p,idx,colors),new T.MeshBasicMaterial({vertexColors:true,side:T.DoubleSide}));}
ridge(-35,3.55,1.25,0xab9d90,3);ridge(-25,2.1,.76,0x9d9e88,.5);ridge(-17,1.16,.55,0x818e79,2);
const sunlightClock={value:0};
function caustics(material){
 const compile=material.onBeforeCompile.bind(material),key=material.customProgramCacheKey();
 material.onBeforeCompile=s=>{
 compile(s);s.uniforms.sunlightClock=sunlightClock;
 s.vertexShader='varying vec3 bedPoint;\n'+s.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
 vec4 bedLocal=vec4(transformed,1.);
 #ifdef USE_INSTANCING
 bedLocal=instanceMatrix*bedLocal;
 #endif
 bedPoint=(modelMatrix*bedLocal).xyz;`);
 s.fragmentShader='uniform float sunlightClock;varying vec3 bedPoint;\n'+s.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
 vec2 ca=bedPoint.xz*8.;float ct=sunlightClock*.19;
 ca+=vec2(sin(ca.y*.58+ct),cos(ca.x*.61-ct))*.72;
 float caustic=abs(sin(ca.x*.83+ct)+.68*sin(ca.y*.95-ct)+.36*cos(ca.x+ca.y));
 float beam=(1.-smoothstep(.025,.20,caustic))*(.55+.45*sin(ca.x*.51-ct));
 diffuseColor.rgb*=vec3(.78,.93,.90)+beam*vec3(.33,.30,.16);`);
 };material.customProgramCacheKey=()=>key+'-submerged';return material
}
const bedMat=caustics(grainMaterial(0xad9f73,'stone'));
const bed=mesh(new T.PlaneGeometry(43,39,85,78),bedMat);bed.rotation.x=-Math.PI/2;
function floorY(x,z){return -.53-.18*Math.cos(x*.65+z*.68)+.12*Math.sin(z*1.15)+.21*ease(.5,2.6,z)}
let bp=bed.geometry.attributes.position;for(let i=0;i<bp.count;i++)bp.setZ(i,floorY(bp.getX(i),-bp.getY(i)));bed.geometry.computeVertexNormals();bed.receiveShadow=true;
// Shared irregular shoreline stones, with naturally worn edges.
const rockColors=[0x968b77,0xa49a82,0x827f71,0xb4a68c,0x9e9784,0x989887];
const rockMats=rockColors.map(c=>grainMaterial(c,'stone'));
function stoneShape(phase,groove=false){
 let p=[],idx=[],N=54;
 let rings=groove?[[.001,-.74],[.76,-.8],[.98,-.34],[1,.26],[.94,.65],[.78,.83],[.64,.83],[.54,.54],[.40,.43],[.19,.44],[.001,.45]]:[[.001,-.87],[.68,-.84],[.93,-.55],[1,-.03],[.94,.51],[.73,.81],[.38,.93],[.001,.95]];
 for(let j=0;j<rings.length;j++){let [k,y]=rings[j];for(let i=0;i<N;i++){let a=tau*i/N,r=1+.065*Math.sin(3*a+phase)+.036*Math.sin(5*a-phase)+.022*Math.cos(7*a+.4);
 let x=Math.cos(a)*k*r,z=Math.sin(a)*k*r;p.push(x,y+.08*k*Math.sin(2*a+phase)+.038*k*Math.sin(a*6),z);
 if(j){let m=(j-1)*N+i,n=(j-1)*N+(i+1)%N;idx.push(m,m+N,n,n,m+N,n+N)}}}return geo(p,idx)}
const rockGeos=Array.from({length:7},(_,i)=>stoneShape(i*.87));
const props=group(), bedProps=group(), rocks=[];
function rock(x,y,z,a,b,c,angle=0,hollow=false){let o=mesh(hollow?stoneShape(2,true):rockGeos[Math.floor(ran()*7)],rockMats[Math.floor(ran()*6)],props);o.position.set(x,y,z);o.scale.set(a,b,c);o.rotation.y=angle;o.castShadow=true;o.receiveShadow=true;rocks.push(o);return o}
function frontZ(x){return 2.58+1.12*Math.exp(-((x-.45)**2)/1.55)+.25*Math.sin(x*1.5)-.09*x}
const mainStone=rock(-.82,.025,1.84,.86,.245,.46,-.10,true);
const farStone=rock(2.65,.04,-4.93,.87,.24,.46,.34,true);
for(let i=0;i<21;i++){let x=-8+i*.78;rock(x,-.12,frontZ(x)+range(.12,.45),range(.54,.86),range(.21,.42),range(.46,.72),range(-.6,.6))}
for(let i=0;i<36;i++){let a=tau*i/36;if(Math.sin(a)>.53&&Math.abs(Math.cos(a)*6.9)<4.8)continue;rock(6.9*Math.cos(a),-.07,-2.9+4.8*Math.sin(a),range(.52,.94),range(.21,.46),range(.5,.87),a)}
const island={x:1.86,z:-2.30,a:1.14,b:.62};
rock(island.x,-.13,island.z,1.22,.36,.72,.05);
for(let i=0;i<9;i++){let a=range(0,tau);rock(island.x+1.02*Math.cos(a),-.07,island.z+.52*Math.sin(a),range(.13,.35),range(.09,.22),range(.12,.33))}
for(let i=0;i<6;i++)rock(2.9+i*.4,-.12,-5.09+Math.sin(i)*.21,.55,.26,.48,i);
for(let i=0;i<15;i++)rock(-6.5+i*.9,-.02,-7.5+.4*Math.sin(i),.8,.4,.62,i);
// A continuous sand-and-turf bank slopes underwater between the larger stones.
function bankEdge(x,z){
 let outer=(Math.hypot(x/6.79,(z+2.72)/6.46)-1)*5.3;
 let front=z-frontZ(x),back=-7.77-z;
 let point=-1.8+1.2*Math.exp(-((z-1.98)**2)/.37)-x;
 let farPoint=(x-2.52)*.56-(z+5.32);
 return Math.max(outer,front,back,Math.min(point,(z-1.84)*1.2),Math.min(farPoint,(x-2.48)*1.5))}
const groundMat=grainMaterial(0xffffff,'stone');groundMat.vertexColors=true;
let groundP=[],groundI=[],groundC=[];const groundN=133,groundM=103;
for(let j=0;j<=groundM;j++)for(let i=0;i<=groundN;i++){
 let x=-11+22*i/groundN,z=-11+17*j/groundM,d=bankEdge(x,z);
 let h=-.92+1.12*ease(-.39,.27,d)+.18*ease(.2,1.2,d);
 let fleck=.5+.22*Math.sin(x*4.7+Math.cos(z*5))+.14*Math.cos(z*7.3+x);
 h+=.058*fleck+.13*Math.sin(x*.8+z*.6)*ease(.45,1.8,d);
 groundP.push(x,h,z);let c=col(0xb9ab8a).lerp(col(0x8c9470),ease(.22,.76,d+fleck*.21)).multiplyScalar(.85+fleck*.28);
 groundC.push(c.r,c.g,c.b);if(i&&j){let n=j*(groundN+1)+i;groundI.push(n-groundN-2,n-1,n,n-groundN-2,n,n-groundN-1)}}
const banks=mesh(geo(groundP,groundI,groundC),groundMat);banks.receiveShadow=true;
rock(-1.65,-.06,1.95,.62,.25,.40,-.2);rock(-1.31,.0,2.28,.48,.23,.32,.4);rock(-.78,-.04,2.39,.49,.17,.36,.12);
rock(3.19,-.12,-.15,.74,.27,.44,0);rock(3.68,-.12,.31,.61,.31,.54,.21);
const pebbleGeo=new T.IcosahedronGeometry(1,1), pebbles=new T.InstancedMesh(pebbleGeo,caustics(std(0xffffff,.92)),730);
bedProps.add(pebbles);let dummy=new T.Object3D();
for(let i=0;i<pebbles.count;i++){let x=range(-7.1,7.1),z=range(-7.8,3.5),a=range(.028,.115);dummy.position.set(x,floorY(x,z)+.006,z);dummy.scale.set(a,range(.018,.055),a*range(.58,1.4));dummy.rotation.set(range(-.1,.1),range(0,tau),0);dummy.updateMatrix();pebbles.setMatrixAt(i,dummy.matrix);pebbles.setColorAt(i,col([0x817c63,0xb3ac87,0xaba28b,0x9a957a][i%4]))}
// Thin ridged leaves and seed heads share buffers across the entire reed bed.
let blades=[],bladeIdx=[],bladeCols=[],stalks=[],stalkIdx=[],stalkCols=[];
function grassBlade(x,y,z,h,w,angle,lean,tint){
 let base=blades.length/3,dx=Math.cos(angle),dz=Math.sin(angle),sx=-dz,sz=dx;let cc=col(tint);
 for(let j=0;j<=6;j++){let t=j/6, bend=lean*t*t+.018*Math.sin(t*3),width=w*Math.pow(1-t,.72)*(.57+.43*Math.sin(Math.PI*t));
 for(let k=-1;k<=1;k++){blades.push(x+dx*bend+sx*k*width,y+h*t-.14*Math.abs(lean)*t*t+(k===0?.003:0),z+dz*bend+sz*k*width);
 let shade=(.64+.40*t)*(k===0?1.18:k===1?.92:1.03);bladeCols.push(cc.r*shade,cc.g*shade,cc.b*shade)}
 if(j)for(let k=0;k<2;k++){let a=base+(j-1)*3+k;bladeIdx.push(a,a+1,a+3,a+1,a+4,a+3)}}
}
function stalk(x,y,z,h,lean,angle,r,head=false){let base=stalks.length/3, N=6,cc=col(head?0x785234:0x9f9b57);
 let rings=head?[[0,.18],[.06,.83],[.22,1],[.81,.97],[.95,.71],[1,.18]]:[[0,1],[.5,.87],[1,.54]];
 for(let j=0;j<rings.length;j++){let [t,s]=rings[j];for(let i=0;i<N;i++){let a=tau*i/N;stalks.push(x+lean*t*Math.cos(angle)+r*s*Math.cos(a),y+h*t,z+lean*t*Math.sin(angle)+r*s*Math.sin(a));let sh=.8+.25*t+.055*Math.cos(a);stalkCols.push(cc.r*sh,cc.g*sh,cc.b*sh);
 if(j){let m=base+(j-1)*N+i,n=base+(j-1)*N+(i+1)%N;stalkIdx.push(m,m+N,n,n,m+N,n+N)}}}}
const grasses=[0x858a48,0xb7aa5c,0x8d985b,0x677f4e,0xc0ac64,0x98a358,0xd7bc7b];
function clump(x,z,size,y=0,cats=0){
 for(let j=0;j<14;j++){let a=range(0,tau),d=range(0,.12)*size;grassBlade(x+d*Math.cos(a),y,z+d*Math.sin(a),range(.27,.86)*size,range(.011,.026)*size,a,range(.065,.36)*size,grasses[Math.floor(ran()*7)])}
 for(let i=0;i<cats;i++){let a=range(0,tau),h=range(.82,1.16)*size,l=range(.04,.12)*size,xx=x+range(-.09,.09),zz=z+range(-.09,.09);
 stalk(xx,y,zz,h,l,a,.008*size);stalk(xx+l*Math.cos(a),y+h,zz+l*Math.sin(a),.15*size,.013*size,a,.024*size,true);stalk(xx+(l+.013*size)*Math.cos(a),y+h+.15*size,zz+(l+.013*size)*Math.sin(a),.06*size,.005,a,.0035*size)}
}
for(let i=0;i<65;i++){let a=range(0,tau),r=Math.sqrt(ran());clump(island.x+Math.cos(a)*r*1.08,island.z+Math.sin(a)*r*.5,range(.62,1.13),.06,i%5===0?1:0)}
for(let i=0;i<110;i++){let a=range(0,tau);if(Math.sin(a)>.53&&Math.abs(Math.cos(a)*6.86)<4.65)continue;clump(6.86*Math.cos(a),-2.92+4.84*Math.sin(a),range(.8,1.65),.10,i%7===0?1:0)}
for(let i=0;i<55;i++){let x=range(-8,8);clump(x,-7.63+range(-.22,.2),range(.7,1.38),.1,i%8===0?1:0)}
for(let i=0;i<27;i++){let x=ran()<.6?range(-4.5,-1.88):range(2.1,5.2);clump(x,frontZ(x)+range(.19,.48),range(.52,1.10),.12,i%9===0?1:0)}
// A few shoreline flowers grow among the small, sun-warmed grasses.
clump(-1.18,2.46,.67,.14,1);clump(-1.43,2.24,.72,.14,1);
clump(1.51,3.22,.65,.12,1);
for(let i=0;i<16;i++){let x=range(2.92,4.24);clump(x,range(-5.61,-5.06),range(.45,.86),.13,i%6===0?1:0)}
let petals=[],centers=[];for(let i=0;i<35;i++){let x=i<26?range(-1.78,-1.07):range(2.9,3.72),z=i<26?range(2.17,2.51):range(-5.2,-4.91),h=range(.20,.50);
 stalk(x,.075,z,h,.018,0,.0036);centers.push([x+.018,.075+h,z]);for(let j=0;j<6;j++){let a=j*tau/6;petals.push([x+.018+.022*Math.cos(a),.078+h,z+.022*Math.sin(a),a])}}
function flowerInstances(list,material,center){let o=new T.InstancedMesh(new T.SphereGeometry(1,10,6),material,list.length);scene.add(o);list.forEach(([x,y,z,a],i)=>{dummy.position.set(x,y,z);dummy.rotation.set(.08,-(a||0),.18);dummy.scale.set(center?.012:.024,center?.008:.006,center?.012:.012);dummy.updateMatrix();o.setMatrixAt(i,dummy.matrix)})}
flowerInstances(petals,std(0xffe9c1),false);flowerInstances(centers,std(0xdba640),true);
const reedMat=std(0xffffff,.9,{vertexColors:true,side:T.DoubleSide});
const reeds=mesh(geo(blades,bladeIdx,bladeCols),reedMat);reeds.castShadow=true;reeds.receiveShadow=true;
mesh(geo(stalks,stalkIdx,stalkCols),reedMat).castShadow=true;
// Branching trees carry many separate leaves, including the hanging willow sprays.
let woodPos=[],woodIdx=[],woodColor=[],leafPos=[],leafIdx=[],leafColor=[];
function twig(a,b,r0,r1,c){
 const dir=b.clone().sub(a).normalize(), u=v(0,0,1).cross(dir).normalize(),w=dir.clone().cross(u),base=woodPos.length/3,cc=col(c);
 for(let j=0;j<2;j++)for(let k=0;k<6;k++){let p=(j?b:a).clone(),r=j?r1:r0,ang=k*tau/6;p.addScaledVector(u,Math.cos(ang)*r).addScaledVector(w,Math.sin(ang)*r);woodPos.push(p.x,p.y,p.z);woodColor.push(cc.r,cc.g,cc.b);
 if(j){let m=base+k,n=base+(k+1)%6;woodIdx.push(m,n,m+6,n,n+6,m+6)}}}
function treeLeaf(x,y,z,len,width,angle,dy,c){
 let base=leafPos.length/3,dx=Math.cos(angle),dz=Math.sin(angle),cc=col(c),shade=range(.83,1.12);
 leafPos.push(x,y,z,x+dx*len*.43-dz*width,y+dy*.4,z+dz*len*.43+dx*width,x+dx*len,y+dy,z+dz*len,x+dx*len*.43+dz*width,y+dy*.44,z+dz*len*.43-dx*width,x+dx*len*.48,y+dy*.47+.014,z+dz*len*.48);
 leafIdx.push(base,base+1,base+4,base+1,base+2,base+4,base+2,base+3,base+4,base+3,base,base+4);
 for(let i=0;i<5;i++){let s=shade*(i===4?1.14:i===0?.79:1);leafColor.push(cc.r*s,cc.g*s,cc.b*s)}}
function willow(x,z,h,span,front=false){
 let root=v(x,-.04,z),fork=v(x+.13,h*.55,z);twig(root,fork,.14*h/3,.076,0x6d6751);
 const pal=front?[0x626f3c,0x7d8c4d,0xa6aa64,0x929d50]:[0x74845a,0x93a163,0xa8b475,0x758d66];
 for(let i=0;i<13;i++){let a=range(0,tau),r=range(.28,1)*span;let tip=v(x+r*Math.cos(a),h*range(.79,1.14),z+r*Math.sin(a)),bend=fork.clone().lerp(tip,.55);bend.y+=.18;
 twig(fork,bend,.059,.032,0x726b4e);twig(bend,tip,.035,.011,0x82724f);
 for(let j=0;j<9;j++){let end=tip.clone().add(v(range(-.4,.4),range(-.07,.21),range(-.36,.36))),length=range(.36,1.3)*h*.47;
 let mid=end.clone().add(v(.12,-length*.42,.04)),lo=end.clone().add(v(.05,-length,-.055));
 twig(end,mid,.008,.0055,0x9d965e);twig(mid,lo,.005,.001,0x9d965e);
 for(let k=0;k<15;k++){let t=k/15,p=end.clone().lerp(lo,t);p.x+=.09*Math.sin(t*Math.PI);let l=range(.09,.22)*(front?1:1.45);
 treeLeaf(p.x,p.y,p.z,l,range(.019,.043),a+k*2.54,-l*range(.55,1.3),pal[(k+j)%4])}}}}
willow(-4.1,-5.48,3.46,1.65);willow(5.75,-5.76,3.75,1.81);
willow(-4.35,1.13,3.68,2.5,true);
for(let j=0;j<11;j++){let x=-15+j*3.25+range(-.8,.8),z=range(-15.5,-11.2),h=range(1.5,3.1);willow(x,z,h,range(.85,1.52))}
mesh(geo(woodPos,woodIdx,woodColor),reedMat);
const foliage=mesh(geo(leafPos,leafIdx,leafColor),reedMat);foliage.castShadow=true;
const reflectTarget=new T.WebGLRenderTarget(640,400,{minFilter:T.LinearFilter,magFilter:T.LinearFilter,depthBuffer:true});
const reflectionCamera=new T.PerspectiveCamera(), mirrorMatrix=new T.Matrix4();
const ringUniform=Array.from({length:24},()=>new T.Vector4(0,0,-100,0));
let ringCursor=0,simTime=0;
function ripple(x,z,amplitude=.5){ringUniform[ringCursor].set(x,z,simTime,amplitude);ringCursor=(ringCursor+1)%ringUniform.length}
const waterU={uTime:{value:0},mirrorMap:{value:reflectTarget.texture},mMirror:{value:mirrorMatrix},rings:{value:ringUniform},bird:{value:new T.Vector2()},tool:{value:new T.Vector2()},sunDir:{value:v(-.16,.17,-1).normalize()}};
const waterMat=new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:waterU,
 vertexShader:`uniform mat4 mMirror;varying vec3 wp;varying vec4 refl;void main(){wp=(modelMatrix*vec4(position,1.)).xyz;refl=mMirror*vec4(wp,1.);gl_Position=projectionMatrix*viewMatrix*vec4(wp,1.);}`,
 fragmentShader:`varying vec3 wp;varying vec4 refl;uniform float uTime;uniform sampler2D mirrorMap;uniform vec4 rings[24];uniform vec2 bird,tool;uniform vec3 sunDir;
 ${shaderNoise}
 void main(){vec2 p=wp.xz;float t=uTime;
 float n=pondNoise(p*.87+vec2(t*.06,0.));float broad=sin(p.y*5.7+p.x*1.15+t*.91+2.6*n);
 vec2 slope=vec2(.014*sin(p.x*5.1+p.y*3.9+t*.6)+.008*sin(17.*p.x+3.*p.y+t*.83),.025*broad+.013*sin(p.y*16.+1.7*p.x-t*1.12+4.*n)+.006*sin(35.*p.y+t*.9));
 float crest=0.;for(int i=0;i<24;i++){float age=t-rings[i].z;if(age>=0.&&age<4.2){vec2 d=p-rings[i].xy;float dist=length(d),u=dist-age*.91;
 float env=exp(-abs(u)*15.-age*1.15)*rings[i].w;
 slope+=d/max(.06,dist)*cos(u*56.)*env*.17;crest+=env*max(0.,cos(u*62.))*.15;}}
 vec3 normal=normalize(vec3(-slope.x,1.,-slope.y)),view=normalize(cameraPosition-wp);float f=pow(1.-max(dot(normal,view),0.),2.);
 vec2 uv=refl.xy/refl.w*.5+.5;uv+=vec2(slope.x*.15,slope.y*.24)*(1.+.25*n);
 vec3 reflection=texture2D(mirrorMap,clamp(uv,.001,.999)).rgb;
 float shallow=smoothstep(.3,2.7,p.y)+.26*pondNoise(p*.58);
 vec3 teal=mix(vec3(.055,.245,.225),vec3(.19,.37,.28),clamp(shallow,0.,1.));
 float shadow=exp(-dot((p-bird)*vec2(1.18,2.4),(p-bird)*vec2(1.18,2.4))*2.);
 teal*=1.-shadow*.38;
 float glint=pow(max(0.,dot(reflect(-sunDir,normal),view)),160.);
 vec3 color=mix(teal,reflection,clamp(.31+.52*f+.08*shadow,.0,.88))+vec3(1.1,.64,.25)*glint*.64;
 color+=vec3(.54,.79,.69)*crest;
 float alpha=clamp(.82-.24*shallow+.13*f,.51,.97);
 gl_FragColor=vec4(color,alpha);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`});
const water=mesh(new T.PlaneGeometry(40,36),waterMat);water.rotation.x=-Math.PI/2;water.renderOrder=3;
const clipPlane=new T.Plane(v(0,1,0),.018);
function renderReflection(look){
 reflectionCamera.copy(camera);reflectionCamera.position.y=-camera.position.y;
 reflectionCamera.up.set(0,-1,0);reflectionCamera.lookAt(look.x,-look.y,look.z);reflectionCamera.updateMatrixWorld();
 mirrorMatrix.multiplyMatrices(reflectionCamera.projectionMatrix,reflectionCamera.matrixWorldInverse);
 water.visible=false;bed.visible=false;bedProps.visible=false;renderer.clippingPlanes=[clipPlane];
 renderer.shadowMap.autoUpdate=false;renderer.setRenderTarget(reflectTarget);renderer.render(scene,reflectionCamera);
 renderer.setRenderTarget(null);renderer.clippingPlanes=[];renderer.shadowMap.autoUpdate=true;
 water.visible=true;bed.visible=true;bedProps.visible=true;
}
