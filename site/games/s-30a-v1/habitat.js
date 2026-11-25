'use strict';
const ports=[-.63,.63], shelfY=1.02, gateY=1.075, highX=1.66, highY=2.23;
const sky=mesh(scene,new T.SphereGeometry(96,40,24),new T.ShaderMaterial({side:T.BackSide,depthWrite:false,
 vertexShader:'varying vec3 d; void main(){ d=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
 fragmentShader:`varying vec3 d;
 float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+1.),f.x),f.y);}
 void main(){vec3 v=normalize(d);float a=max(v.y,0.);vec3 c=mix(vec3(.64,.84,.90),vec3(.085,.45,.78),smoothstep(-.09,.46,v.y));vec2 p=v.xz/(a+.09)*1.65;float f=.54*n(p)+.27*n(p*2.1)+.13*n(p*4.3)+.06*n(p*9.);float cloud=smoothstep(.55,.73,f)*smoothstep(.01,.16,a)*.76;c=mix(c,vec3(.95,.96,.94),cloud);gl_FragColor=vec4(c,1.);
 #include <colorspace_fragment>
 }`}),false);
sky.receiveShadow=false;
const ground=mesh(scene,new T.PlaneGeometry(140,140),mat(0xc3ac78));ground.rotation.x=-PI/2;ground.position.y=-.72;
const yard=group();const earthMap=texture(256,256,(c,w,h)=>{c.fillStyle='#bca575';c.fillRect(0,0,w,h);for(let i=0;i<24000;i++){c.fillStyle=rand()<.5?'rgba(78,74,39,.12)':'rgba(252,231,180,.17)';c.fillRect(rand()*w,rand()*h,rand()*3+.7,1+rand()*2)}},true);
earthMap.repeat.set(42,42);ground.material.map=earthMap;ground.material.color.set(0xffefc9);
const treeBark=mat(0x70654b),leafColors=[0x577144,0x49693e,0x748e4b,0x829b54,0x587b43,0x476940];
const leafCloudGeo=new T.IcosahedronGeometry(1,1);
const leafyPositions=[],leafyColors=[],fineMatrices=[],fineColors=[];
function crown(x,y,z,w,h,d,tint){
 const dummy=new T.Object3D();const color=new T.Color();
 for(let i=0;i<26;i++){
  let a=rand()*TAU,b=Math.acos(2*rand()-1),r=Math.pow(rand(),.34);
  const dx=r*Math.sin(b)*Math.cos(a),dy=r*Math.cos(b),dz=r*Math.sin(b)*Math.sin(a);
  dummy.position.set(x+dx*w,y+dy*h,z+dz*d);dummy.scale.set((.23+rand()*.3)*w,(.18+rand()*.26)*h,(.21+rand()*.29)*d);
  dummy.rotation.set(rand(),rand()*TAU,rand());dummy.updateMatrix();leafyPositions.push(dummy.matrix.clone());
  color.setHex(leafColors[tint%leafColors.length]).multiplyScalar(.74+dy*.19+rand()*.23);leafyColors.push(color.clone());
  const center=dummy.position.clone(),scale=dummy.scale.clone();
  for(let j=0;j<7;j++){const aa=rand()*TAU,bb=rand()*PI;
   dummy.position.set(center.x+Math.cos(aa)*Math.sin(bb)*scale.x,center.y+Math.cos(bb)*scale.y,center.z+Math.sin(aa)*Math.sin(bb)*scale.z);
   const sz=.055+rand()*.095;dummy.scale.set(sz*2,sz*.46,sz);dummy.rotation.set(rand()*.8,rand()*TAU,rand()*.8);dummy.updateMatrix();fineMatrices.push(dummy.matrix.clone());fineColors.push(color.clone().multiplyScalar(1.05+rand()*.45))}
 }
}
function tree(x,z,height,width,tint){
 const base=-.72,mid=V(x+.12,base+height*.45,z);
 rod(yard,V(x,base,z),mid,height*.032,height*.023,treeBark);
 for(let j=0;j<5;j++){
 const a=j*2.4+rand()*.5,r=(j? .47+rand()*.25:.12)*width;
 const top=V(x+Math.cos(a)*r,base+height*(j?.76+rand()*.13:1),z+Math.sin(a)*r);
 rod(yard,mid,top,.08*height/4,.024,treeBark);crown(top.x,top.y,top.z,width*.59,height*(.14+rand()*.03),width*.5,tint+j%2)}
}
for(let i=0;i<15;i++){const x=-29+i*4.1;const opening=smooth(1.5,10,Math.abs(x-2));tree(x,-15-rand()*11,2.7+rand()*1.8+2.7*opening,2.3+rand()*2.5,i%5)}
tree(-5.7,-7.9,5.2,3.1,0);tree(5.3,-8.1,5.8,3.9,1);
function plantInstances(g,ms,cs){const o=new T.InstancedMesh(g,mat(0xffffff),ms.length);ms.forEach((m,i)=>{o.setMatrixAt(i,m);o.setColorAt(i,cs[i])});scene.add(o);o.receiveShadow=true}
plantInstances(leafCloudGeo,leafyPositions,leafyColors);plantInstances(new T.IcosahedronGeometry(1,0),fineMatrices,fineColors);
const distantWood=mat(0x938065);
for(let i=-6;i<=6;i++){rod(yard,V(i*2.0,-.72,-8),V(i*2.0,.38,-8),.074,.069,distantWood);if(i<6)for(const y of [-.26,.14])rod(yard,V(i*2,y,-8),V(i*2+2,y,-8),.048,.048,distantWood)}
// Hardwood planks, bedded on cross beams, with rounded through-openings.
const deck=group();for(let j=0;j<12;j++)plank(deck,0,-.08,j*.32-.65,10,.13,.312,j%3?wood:woodDark);
for(let j=0;j<8;j++)plank(deck,0,shelfY-.064,-.07+j*.302,7.8,.128,.299,j%3===1?woodHoney:wood);
plank(deck,0,shelfY+.008,2.14,7.8,.072,.105,woodDark);
for(const x of [-3.32,-1.43,1.42,3.35]){
 plank(deck,x,.78,-.016,.168,1.94,.202,woodDark,'y');
 plank(deck,x,1.769,-.016,.205,.066,.24,woodHoney);
}
for(const x of [-2.55,2.55]){plank(deck,x,1.61,-.055,2.5,.146,.125);plank(deck,x,1.19,-.055,2.5,.135,.13)}
function roundedPath(p,x,y,w,h,r,reverse=false){
 const pts=[[x+r,y],[x+w-r,y],[x+w,y,x+w,y+r],[x+w,y+h-r],[x+w,y+h,x+w-r,y+h],[x+r,y+h],[x,y+h,x,y+h-r],[x,y+r],[x,y,x+r,y]];
 p.moveTo(...pts[0]);for(let i=1;i<pts.length;i++){if(pts[i].length===2)p.lineTo(...pts[i]);else p.quadraticCurveTo(...pts[i])}p.closePath();return p
}
const frameShape=roundedPath(new T.Shape(),-1.43,.951,2.86,.81,.055);
for(const x of ports)frameShape.holes.push(roundedPath(new T.Path(),x-.516,gateY,1.032,.548,.118));
const frameGeo=new T.ExtrudeGeometry(frameShape,{depth:.105,bevelEnabled:true,bevelThickness:.025,bevelSize:.023,bevelSegments:4,curveSegments:14});
const frame=mesh(deck,woodUV(frameGeo),wood);frame.position.z=-.08;
plank(deck,0,1.777,-.028,2.96,.063,.195,woodHoney);
function bolt(x,y,z){
 const face=rod(deck,V(x,y,z),V(x,y,z+.008),.022,.022,iron,20);
 rod(deck,V(x,y,z+.008),V(x,y,z+.015),.013,.013,bronze,6)
}
for(const x of [-1.352,-.006,1.352])for(const y of [1.675,1.108])bolt(x,y,.05);
function beamBetween(p,a,b,width,thickness,m){
 const o=plank(p,0,0,0,width,thickness,a.distanceTo(b),m,'z');o.position.copy(a).lerp(b,.5);const forward=b.clone().sub(a).normalize(),side=V().crossVectors(V(0,1,0),forward).normalize(),up=V().crossVectors(forward,side);
 o.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(side,up,forward));return o
}
for(const x of ports){
 for(const side of [-1,1])beamBetween(deck,V(x+side*.094,shelfY+.016,.035),V(x+.49+side*.10,shelfY+.016,1.97),.067,.061,woodDark)
}
const rampLow=V(1.48,1.05,1.68),rampHigh=V(highX,highY,.47);
const ramp=beamBetween(deck,rampLow,rampHigh,.36,.12,woodHoney);
for(let s=0;s<=5;s++){const pt=rampLow.clone().lerp(rampHigh,s/5);const rail=plank(deck,pt.x,pt.y+.071,pt.z,.395,.056,.067,woodDark);rail.rotation.y=-.34}
plank(deck,highX,highY+.019,-.056,.93,.147,1.22,wood,'z');
for(const side of [-1,1])beamBetween(deck,V(highX+side*.187,highY+.11,-.64),V(highX+side*.435,highY+.11,.55),.061,.088,woodDark);
rod(deck,V(highX,highY+.08,-.324),V(highX,highY+.389,-.324),.083,.075,woodHoney,32);
oval(deck,V(highX,highY+.388,-.324),V(.075,.041,.075),woodHoney);
plank(deck,highX+.28,.87,-.37,.165,2.69,.185,woodDark,'y');
plank(deck,highX+.59,highY-.008,.23,.36,.13,1.12,woodHoney,'z');
plank(deck,highX+.77,highY+.062,.23,.065,.091,1.12,woodDark,'z');

joinFixedParts(deck);joinFixedParts(yard);
