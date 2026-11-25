'use strict';
const scene=new T.Scene(),stage=group(scene),room=group(scene);
scene.background=new T.Color(0x9a9e8b);scene.fog=new T.FogExp2(0xb1a990,.031);
const sun=new T.DirectionalLight(0xffdfad,3.25);sun.position.set(-5.8,8.4,3.5);sun.target.position.set(0,.4,0);scene.add(sun,sun.target);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-7,right:7,top:7,bottom:-7,near:.1,far:24});sun.shadow.normalBias=.018;sun.shadow.bias=-.0004;sun.shadow.radius=3;
scene.add(new T.HemisphereLight(0xffedcf,0xb8a38b,1.48));
const rimLight=new T.DirectionalLight(0xffc37a,2.15);rimLight.position.set(1,4,-4);scene.add(rimLight);
const cool=new T.DirectionalLight(0xd6e8ee,.55);cool.position.set(5,4,4);scene.add(cool);
function contact(parent,x,z,rx,rz,alpha=.26,y=.012){
 const c=document.createElement('canvas');c.width=c.height=64;let a=c.getContext('2d'),gr=a.createRadialGradient(32,32,1,32,32,32);gr.addColorStop(0,'rgba(54,34,17,1)');gr.addColorStop(.55,'rgba(54,34,17,.60)');gr.addColorStop(1,'rgba(54,34,17,0)');a.fillStyle=gr;a.fillRect(0,0,64,64);
 let m=mesh(parent,new T.PlaneGeometry(rx*2,rz*2),new T.MeshBasicMaterial({map:texture(c),transparent:true,opacity:alpha,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1}),x,y,z);m.rotation.x=-Math.PI/2;m.castShadow=m.receiveShadow=false;return m}
const wallWood=wood(0x8c9b87),wallTrim=wood(0x738776),windowTrim=wood(0xcba979);
for(let i=-12;i<=12;i++)bevelBox(room,wallWood,i*.82,3.6,-5.72,.818,8,.13,.014);
bevelBox(room,wallTrim,0,.43,-5.54,20,.83,.22,.035);
bevelBox(room,windowTrim,0,.94,-5.44,20,.14,.25);
const win=group(room);win.position.set(-2.95,3.85,-5.38);
let skyCanvas=document.createElement('canvas');skyCanvas.width=4;skyCanvas.height=256;let skyCtx=skyCanvas.getContext('2d'),sky=skyCtx.createLinearGradient(0,0,0,256);sky.addColorStop(0,'#a7b7b6');sky.addColorStop(.5,'#edc395');sky.addColorStop(1,'#f6dc9e');skyCtx.fillStyle=sky;skyCtx.fillRect(0,0,4,256);
const pane=new T.MeshBasicMaterial({map:texture(skyCanvas)});box(win,pane,0,0,0,4.75,3.03,.08);
const foliage=material(0x899485,.96);
let leaves=[];for(let j=0;j<5;j++){let x=range(-2.5,1.3),y=range(-1.6,-1.1),tilt=range(-.5,1);let pts=[V(x,y,.075),V(x+tilt*.6,y+.5,.075),V(x+tilt,y+1,.09)];pathTube(win,foliage,pts,.012);for(let k=0;k<7;k++){let f=k/8;leaves.push({p:V(x+tilt*f+(k%2?.069:-.069),y+f,.09),s:V(.057,.153,.019),r:[0,0,k%2?-.7:.7]})}}
instance(win,globe,foliage,leaves);
for(let x of [-2.4,0,2.4])bevelBox(win,windowTrim,x,0,.15,x===0?.10:.18,3.18,.16);
for(let y of [-1.52,.07,1.52])bevelBox(win,windowTrim,0,y,.16,4.94,y===.07?.09:.18,.17);
bevelBox(win,M.maple,0,-1.67,.24,5.13,.16,.55,.035);
const lamp=group(room);lamp.position.set(3.55,4.09,-5.2);
let lampBase=cyl(lamp,M.brass,0,.4,0,.23,.24,.09);lampBase.rotation.x=Math.PI/2;
pathTube(lamp,M.brass,[V(0,.41,0),V(0,.58,.32),V(0,.43,.62),V(0,.20,.64)],.037);
let lampShade=turn(lamp,wood(0x637565),[[.49,0],[.5,.05],[.36,.12],[.19,.28],[.1,.3]],0,-.08,.64);
oval(lamp,material(0xffdeb0,.4,{emissive:0xf2bc78,emissiveIntensity:.42}),0,-.082,.64,.46,.045,.46);
const floor=box(stage,M.bedding,0,-.16,0,24,.31,22);floor.material=M.bedding.clone();floor.material.map=grainTex.clone();floor.material.map.repeat.set(5,6);
const backRail=wood(0xbf9864);bevelBox(stage,backRail,0,.15,-4.65,15,.55,.20,.05);
bevelBox(stage,M.light,0,.45,-4.65,15,.084,.29);
const frontRail=group(stage);
bevelBox(frontRail,M.cut,0,-.16,0,19,.7,.35,.055);
bevelBox(frontRail,M.light,0,.211,0,19,.095,.41,.036);
for(let k of [-1,1]){bevelBox(stage,M.honey,k*6.65,.1,0,.23,.55,9.4);bevelBox(stage,M.light,k*6.65,.4,0,.29,.08,9.5)}
function shavingGeometry(){
 let p=[],idx=[],uv=[];for(let j=0;j<=6;j++){let t=j/6,h=.018+.047*Math.sin(t*3.8)+t*t*.07;
 for(let side of [-1,1]){p.push((t-.5)*.35,h+side*.019*Math.cos(t*2),side*.047*(.6+.4*Math.sin(t*Math.PI))+.04*t*t);uv.push(t,(side+1)*.5)}if(j<6){let i=j*2;idx.push(i,i+1,i+2,i+1,i+3,i+2)}}
 let g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g}
const shaving=shavingGeometry(),chipMat=material(0xffffff,.93,{side:T.DoubleSide,map:otherTex});
const chipColors=[0xe4c79a,0xd6b887,0xc6a275,0xe5ccaa,0xeed8b1,0xcaae85];
function chips(parent,spots){let arr=[];for(const sp of spots){for(let i=0;i<sp[4];i++){let theta=rand()*TAU,rad=Math.sqrt(rand()),x=sp[0]+Math.cos(theta)*rad*sp[2],z=sp[1]+Math.sin(theta)*rad*sp[3],s=range(.45,1.28);arr.push({p:V(x,(sp[5]||0)+range(.001,.046)*(1-rad),z),s:V(s*range(.7,1.4),s,s*range(.7,1.3)),r:[range(-.18,.18),rand()*TAU,range(-.15,.15)],c:chipColors[Math.floor(rand()*6)]})}}instance(parent,shaving,chipMat,arr)}
chips(stage,[[0,-3.5,7,1.15,650],[-4,.45,1.7,3.5,400],[4.2,.14,2.1,3.6,490],[.5,3.6,6,.95,360],[0,0,5.7,3.8,290]]);
const wheelStand=group(stage),wheel=group(wheelStand),wheelHot=group(wheel),holes=[],WELL_COUNT=5,orbit=1.015;
contact(wheelStand,0,0,1.8,1.55,.31);
turn(wheelStand,M.cut,[[.01,.035],[.94,.035],[1.03,.09],[1.01,.16],[.91,.22],[.86,.28],[.77,.31],[.72,.96],[.88,1.02]],0);
ring(wheelStand,M.walnut,0,.22,0,.90,.018);
const exitAngles=[-.55,.11],exits=exitAngles.map(a=>({x:Math.sin(a)*orbit,z:Math.cos(a)*orbit,r:.315}));
const nestAngle=2.31,innerExit={x:Math.sin(nestAngle)*orbit,z:Math.cos(nestAngle)*orbit,r:.30};
circularBoard(wheelStand,M.cut,1.449,[...exits,innerExit],.313,.018,.97);
const gatePorts=[...exits,innerExit],gates=gatePorts.map((e,i)=>cyl(wheelStand,M.cut,e.x+(i===0?.70:0),1.266,e.z,.327,.327,.047,40));
ring(wheelStand,M.walnut,0,1.08,0,1.503,.018);
for(let i=0;i<WELL_COUNT;i++){let a=-1.02+i*TAU/WELL_COUNT;holes.push({x:Math.sin(a)*orbit,z:Math.cos(a)*orbit,r:.355,angle:a,grains:[],dwell:0})}
const diskBody=circularBoard(wheelHot,M.honey,1.535,holes,.177,.048,1.333);
turn(wheelHot,M.honey,[[1.435,1.147],[1.51,1.147],[1.559,1.169],[1.574,1.222],[1.574,1.371],[1.556,1.419],[1.437,1.419],[1.435,1.147]]);
ring(wheelHot,M.cut,0,1.21,0,1.572,.024);
ring(wheelHot,M.light,0,1.53,0,1.54,.026);
ring(wheelHot,M.walnut,0,1.561,0,1.434,.009);
ring(wheelHot,M.light,0,1.562,0,1.404,.008);
for(const h of holes){ring(wheelHot,M.cut,h.x,1.534,h.z,.367,.022)}
// Turned hardwood hub and its two inset rings.
turn(wheelHot,M.walnut,[[.01,1.555],[.317,1.555],[.324,1.587],[.30,1.626],[.213,1.648],[.19,1.69],[.14,1.715],[.01,1.72]]);
ring(wheelHot,M.brass,0,1.637,0,.23,.014);oval(wheelHot,M.brass,0,1.718,0,.061,.018,.061);
let beads=[];for(let i=0;i<56;i++){let a=i/56*TAU;beads.push({p:V(Math.sin(a)*1.558,1.346,Math.cos(a)*1.558),s:V(.016,.071,.009),r:[0,a,-.16]})}
instance(wheelHot,globe,M.cut,beads);
const thumb=oval(wheelHot,M.cut,-.38,1.411,1.512,.205,.096,.047);thumb.rotation.y=-.24;
const tray=group(stage);
function basin(parent,rx,rz,h,mat,double=false){
 let pos=[],idx=[],uv=[],seg=96;
 const profile=[[0,.18],[.3,.19],[.6,.21],[.78,.26],[.86,.39],[.9,.64],[.94,.9],[.965,1],[.985,.98],[1,.86],[.999,.64],[.981,.36],[.94,.10],[.89,0],[0,0]];
 for(let j=0;j<profile.length;j++){let [r,v]=profile[j];for(let i=0;i<=seg;i++){let a=i/seg*TAU,x=r*Math.cos(a),z=r*Math.sin(a),y=h*v+(double&&j<7?.045*Math.exp(-x*x*16)*(1-r*r):0);pos.push(x*rx,y,z*rz*(double?1-.095*Math.exp(-x*x*20):1));uv.push(x*rx*.46,z*rz*.46);if(j<profile.length-1&&i<seg){let k=j*(seg+1)+i;idx.push(k,k+1,k+seg+1,k+1,k+seg+2,k+seg+1)}}}
 let g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return mesh(parent,g,mat)}
basin(tray,1.77,.81,.345,M.maple,true);contact(tray,0,.02,1.91,.9,.28);
const scoop=group(stage),scoopBowl=basin(scoop,.41,.31,.175,M.light);scoopBowl.rotation.y=-.14;
let spoonHandle=group(scoop);spoonHandle.rotation.y=-.30;
rod(spoonHandle,M.maple,V(-.32,.09,0),V(-1.19,.17,0),.080,.112);
oval(spoonHandle,M.maple,-1.20,.17,0,.12,.11,.115);
rod(spoonHandle,M.cut,V(-.49,.108,0),V(-.53,.112,0),.084,.085);
const scoopSeeds=group(scoop);
function fillSpoon(){while(scoopSeeds.children.length<12){let i=scoopSeeds.children.length,m=kernel(scoopSeeds,i%3===0?1:0),a=i*2.399,r=.235*Math.sqrt(i/12);m.position.set(Math.sin(a)*r,.109+.049*(1-r/.26),Math.cos(a)*r*.7);m.rotation.set(range(-.3,.3),rand()*TAU,range(-.2,.2))}}
fillSpoon();
const house=group(stage),inner=group(house);
contact(house,0,0,2.27,1.7,.26);
const hw=1.79,hd=1.23,wallH=2.22;
bevelBox(house,M.cut,0,.123,0,3.78,.226,2.69,.048);
bevelBox(inner,M.bedding,0,.235,0,3.56,.068,2.43,.02);
for(let j=0;j<5;j++)bevelBox(house,j%2?M.cut:M.honey,0,.30+j*.42,-hd,3.68,.425,.145,.015);
bevelBox(house,M.honey,hw,1.23,0,.16,2.04,2.5);
function gableWall(side,entry){
 let s=new T.Shape();s.moveTo(-hd,0);s.lineTo(hd,0);s.lineTo(hd,wallH);s.lineTo(0,2.997);s.lineTo(-hd,wallH);s.closePath();
 if(entry){let hole=new T.Path();hole.moveTo(-.63,.16);hole.lineTo(-.63,.85);hole.absarc(0,.85,.63,Math.PI,0,true);hole.lineTo(.63,.16);hole.closePath();s.holes.push(hole)}
 let geo=new T.ExtrudeGeometry(s,{depth:.12,bevelEnabled:true,bevelSize:.025,bevelThickness:.025,bevelSegments:3,curveSegments:28});geo.rotateY(Math.PI/2);planarUV(geo);mesh(house,geo,M.maple,side*hw,0,0)}
gableWall(-1,true);gableWall(1,false);
let archPts=[V(-hw-.065,.22,.69),V(-hw-.065,.78,.69)];for(let i=0;i<=20;i++){let a=i/20*Math.PI;archPts.push(V(-hw-.065,.84+.70*Math.sin(a),.70*Math.cos(a)))}archPts.push(V(-hw-.065,.22,-.7));pathTube(house,M.cut,archPts,.061);
const ramp=bevelBox(house,M.maple,-hw-.39,.12,.07,.89,.1,1.13);ramp.rotation.z=.18;
for(let i=0;i<4;i++){let m=bevelBox(house,M.cut,-2.53+i*.18,.105+i*.035,.07,.033,.019,1.04,.007);m.rotation.z=.18}
const roofMats=[wood(0xab7250),wood(0x986648,true),wood(0xb17d57),wood(0xa97653,true)];
for(let side of [-1,1]){
 let roof=group(house);roof.position.set(0,2.99,0);roof.rotation.x=side*.533;
 for(let j=0;j<13;j++){let slat=bevelBox(roof,roofMats[(j*3+(j%4===1?1:0))%4],(j-6)*.309,0,side*.808,.313,.108,1.69,.027);slat.translateY(Math.sin(j*6)*.005)}
 bevelBox(roof,M.walnut,0,-.072,side*1.61,4.12,.13,.13,.019)}
bevelBox(house,M.walnut,0,3.06,0,4.12,.17,.18,.055);
const door=group(house);door.position.z=hd+.091;
for(let i=0;i<9;i++)bevelBox(door,i%3===0?M.maple:M.honey,(i-4)*.372,1.186,0,.373,1.72,.139,.018);
for(let y of [.50,1.86]){bevelBox(door,M.cut,0,y,.088,3.41,.143,.085,.025);for(let x of [-1.53,1.53])oval(door,M.brass,x,y,.136,.032,.032,.016)}
const doorKnob=group(door);doorKnob.position.x=-.25;bevelBox(doorKnob,M.walnut,-1.16,1.17,.14,.16,.55,.12,.049);bevelBox(doorKnob,M.maple,-1.16,1.17,.245,.183,.53,.13,.057);
for(let y of [.253,2.141]){bevelBox(house,M.walnut,0,y,hd+.104,3.83,.158,.24,.025);bevelBox(house,M.cut,0,y+.047,hd+.182,3.87,.068,.12,.019)}
for(let x of [-1.785,1.785])bevelBox(house,M.cut,x,1.17,hd,.15,1.82,.15,.019);
let glass=mesh(house,new T.PlaneGeometry(3.40,1.77),new T.MeshPhysicalMaterial({color:0xf3ffef,transparent:true,opacity:.032,roughness:.15,depthWrite:false}),0,1.19,hd+.014);glass.castShadow=false;
chips(inner,[[.94,-.54,.75,.51,128,.267],[-.6,-.8,.9,.3,55,.269],[0,.62,1.63,.32,63,.27]]);
const resonator=bevelBox(inner,M.light,-1.46,.30,-.70,.87,.075,.62,.032);resonator.rotation.y=-.18;
const storeDish=group(inner);storeDish.position.set(.15,.263,.13);basin(storeDish,.58,.43,.087,M.bedding);
const chute=group(house);chute.position.set(-.67,1.145,-.69);
const chuteWood=group(chute);chuteWood.rotation.x=.33;
bevelBox(chuteWood,M.honey,0,0,.55,.34,.07,1.14,.028);
for(let x of [-.184,.184])bevelBox(chuteWood,M.cut,x,.085,.55,.068,.19,1.17,.018);
let spigot=cyl(chute,M.brass,0,-.012,0,.108,.11,.19);
const chuteKnob=turn(chute,M.maple,[[.005,.11],[.135,.11],[.17,.15],[.17,.225],[.12,.26],[.005,.27]]);
const insideLight=new T.PointLight(0xffdb9d,2.3,4,1.3);insideLight.position.set(-.18,1.97,.92);house.add(insideLight);
const runwayMeshes=group(stage),runways=[];
function carvedChannel(curve,width){
 const profile=[[-1,.08],[-.85,.085],[-.72,.024],[0,0],[.72,.024],[.85,.085],[1,.08],[.97,-.04],[.65,-.075],[-.72,-.075],[-.97,-.04],[-1,.08]];
 let pos=[],idx=[],uv=[],n=38;
 for(let i=0;i<=n;i++){let t=i/n,c=curve.getPointAt(t),d=curve.getTangentAt(t),side=V(d.z,0,-d.x).normalize();
 for(let j=0;j<profile.length;j++){let [s,h]=profile[j],p=c.clone().addScaledVector(side,s*width);pos.push(p.x,p.y+h,p.z);uv.push(t*1.6,j/11*.63);
 if(i<n&&j<profile.length-1){let k=i*profile.length+j;idx.push(k,k+profile.length,k+1,k+1,k+profile.length,k+profile.length+1)}}}
 let g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return mesh(runwayMeshes,g,M.cut)}
function fitRunways(){
 for(let m of [...runwayMeshes.children]){runwayMeshes.remove(m);m.geometry.dispose()}runways.length=0;
 for(let i=0;i<2;i++){let from=wheelStand.localToWorld(V(exits[i].x,.901,exits[i].z)),end=tray.localToWorld(V(i?.49:-.93,.342,-.407));
 let bend=from.clone().lerp(end,.46);bend.z+=i?.015:.145;bend.y-=.04;let c=new T.CatmullRomCurve3([from,bend,end]);runways.push(c);carvedChannel(c,.145*wheelStand.scale.x)}
 let from=wheelStand.localToWorld(V(innerExit.x,.932,innerExit.z)),wall=house.localToWorld(V(-1.85,.825,.72)),end=chute.localToWorld(V(0,.084,0));
 let between=from.clone().lerp(wall,.50);between.z-=.12;let c=new T.CatmullRomCurve3([from,between,wall,end]);runways.push(c);carvedChannel(c,.145);
}
// A small stoneware vase on the windowsill catches the last light.
const vase=group(win);vase.position.set(-.98,-1.578,.28);
const glaze=material(0x849589,.34),straw=material(0xb99860,.9),heads=[];
turn(vase,glaze,[[.01,0],[.153,.0],[.20,.045],[.224,.15],[.211,.27],[.124,.34],[.103,.414],[.114,.439],[.117,.458],[.079,.46],[.077,.409]],0,0,0,44);
for(let i=0;i<5;i++){
 let base=V(range(-.04,.04),.41,range(-.025,.025)),top=V((i-2)*.193+range(-.05,.05),range(1.02,1.44),range(-.11,.11)),d=top.clone().sub(base).normalize();
 rod(vase,straw,base,top,.011,.007);
 for(let j=0;j<7;j++){let side=j%2?1:-1,p=top.clone().addScaledVector(d,.029*j);p.x+=side*.028;heads.push({p,s:V(.032,.068,.028),r:[.16,0,-side*.47-d.x*.4]});
 if(j>2)rod(vase,straw,p.clone().add(V(0,.04,0)),p.clone().add(V(side*.05,.16,0)),.005,.001)}
}
instance(vase,globe,straw,heads);
const pawImprints=Array.from({length:4},()=>V(0,9,0));
chipMat.onBeforeCompile=shader=>{
 shader.uniforms.pawImprints={value:pawImprints};
 shader.vertexShader='uniform vec3 pawImprints[4];\n'+shader.vertexShader.replace('#include <project_vertex>',`
 #ifdef USE_INSTANCING
 vec3 beddingPosition=(modelMatrix*instanceMatrix*vec4(transformed,1.0)).xyz;
 float depression=0.0;
 for(int i=0;i<4;i++){
   vec3 contactDelta=beddingPosition-pawImprints[i];
   depression=max(depression,exp(-dot(contactDelta.xz,contactDelta.xz)*63.0-contactDelta.y*contactDelta.y*92.0));
 }
 transformed.y-=depression*.045;
 #endif
 #include <project_vertex>`);
};
