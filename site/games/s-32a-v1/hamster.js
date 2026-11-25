'use strict';
const hamster=group(stage),animal=group(hamster),rig=group(animal);
const pelvis=new T.Bone(),neck=new T.Bone();rig.add(pelvis);pelvis.add(neck);neck.position.set(0,1.17,.035);
const skeleton=new T.Skeleton([pelvis,neck]);rig.updateMatrixWorld(true);skeleton.calculateInverses();
const profile=[
 [0,.012,.02,-.08],[.055,.34,.38,-.09],[.17,.53,.51,-.11],[.40,.68,.62,-.13],
 [.67,.73,.69,-.14],[.91,.727,.70,-.121],[1.13,.691,.648,-.066],
 [1.29,.66,.58,.022],[1.44,.65,.526,.108],[1.57,.609,.515,.15],
 [1.72,.576,.495,.12],[1.87,.528,.437,.075],[2.00,.414,.33,.015],
 [2.085,.254,.215,-.013],[2.12,.007,.009,-.015]
];
function section(y){
 let i=0;while(i<profile.length-2&&y>profile[i+1][0])i++;let a=profile[i],b=profile[i+1],c=profile[Math.max(0,i-1)],d=profile[Math.min(profile.length-1,i+2)],t=clamp((y-a[0])/(b[0]-a[0])),out=[];
 for(let k=1;k<4;k++){let h=b[0]-a[0],ma=(b[k]-c[k])/(b[0]-c[0])*h,mb=(d[k]-a[k])/(d[0]-a[0])*h;out.push((2*t**3-3*t*t+1)*a[k]+(t**3-2*t*t+t)*ma+(-2*t**3+3*t*t)*b[k]+(t**3-t*t)*mb)}return out}
function furPoint(a,y){
 let [rx,rz,cz]=section(y),sa=Math.sin(a),ca=Math.cos(a),front=Math.max(0,ca);
 let snout=.226*Math.exp(-1*((y-1.565)/.183)**2)*front**10;
 let jowl=.075*Math.exp(-1*((y-1.423)/.178)**2)*Math.exp(-1*((Math.abs(sa)-.39)/.24)**2)*front;
 return V(rx*sa,y,cz+rz*ca+snout+jowl)}
function furNormal(a,y){return furPoint(a,Math.min(2.12,y+.002)).sub(furPoint(a,Math.max(0,y-.002))).cross(furPoint(a+.003,y).sub(furPoint(a-.003,y))).normalize().negate()}
const coatPalette={gold:new T.Color(0xc58e50),warm:new T.Color(0xd6a260),white:new T.Color(0xf1e5cf),chin:new T.Color(0xf7e9cf),shadow:new T.Color(0x816447),muzzle:new T.Color(0xe6cca7)};
function coatColor(a,y){
 let p=furPoint(a,y),ca=Math.cos(a),sa=Math.abs(Math.sin(a)),wav=.023*Math.sin(y*13+sa*6)+.014*Math.sin(y*31-sa*9);
 let cream=smooth((ca-(.26+.30*y+wav))/.23)*smooth((1.52-y)/.17);
 let side=smooth((ca+.03)/.26)*smooth((.8-ca)/.28)*Math.exp(-1*((y-(1.14+.24*ca))/.16)**4);
 let cheek=Math.exp(-1*((y-1.425)/.122)**2)*smooth((ca-.13)/.65);
 let muzzle=smooth((p.z-.58)/.225)*Math.exp(-1*((y-1.51)/.21)**2);
 let c=coatPalette.gold.clone().lerp(coatPalette.warm,.32+.14*Math.sin(a*3+y*3));
 let patch=Math.exp(-1*((y-1.58)/.183)**2)*Math.exp(-1*((ca-.11)/.24)**2);
 c.lerp(coatPalette.shadow,patch*.72);c.lerp(coatPalette.white,Math.max(cream,side*.92,cheek*.72));c.lerp(coatPalette.chin,muzzle*.96);return c}
function cheekDelta(a,y,side){
 let s=Math.sin(a)*side;if(s<0)return V();let g=Math.exp(-1*((y-1.34)/.238)**2)*s**1.7*(.75+.25*Math.cos(a));return V(side*.237*g,-.039*g,.043*g)}
function skinnedSurface(data,indices,mat){
 let g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(data.p,3));g.setAttribute('normal',new T.Float32BufferAttribute(data.n,3));g.setAttribute('color',new T.Float32BufferAttribute(data.c,3));
 g.setAttribute('skinIndex',new T.Uint16BufferAttribute(data.b,4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(data.w,4));g.morphTargetsRelative=true;g.morphAttributes.position=data.m.map(arr=>new T.Float32BufferAttribute(arr,3));if(indices)g.setIndex(indices);
 let m=new T.SkinnedMesh(g,mat);rig.add(m);m.bind(skeleton,new T.Matrix4());m.castShadow=m.receiveShadow=true;m.frustumCulled=false;return m}
function buffers(){return {p:[],n:[],c:[],b:[],w:[],m:[[],[],[]]}}
function addFurVertex(data,p,n,c,w,dl,dr){
 data.p.push(p.x,p.y,p.z);data.n.push(n.x,n.y,n.z);data.c.push(c.r,c.g,c.b);data.b.push(0,1,0,0);data.w.push(1-w,w,0,0);data.m[0].push(dl.x,dl.y,dl.z);data.m[1].push(dr.x,dr.y,dr.z);
 let muzzle=Math.exp(-1*((p.y-1.47)/.11)**2)*smooth((p.z-.51)/.23);
 data.m[2].push(p.x*.19*muzzle,-.022*muzzle,.035*muzzle)}
const skin=buffers(),skinIdx=[];
for(let j=0;j<=66;j++){let y=2.12*j/66;for(let i=0;i<=112;i++){let a=i/112*TAU,p=furPoint(a,y);addFurVertex(skin,p,furNormal(a,y),coatColor(a,y),smooth((y-1.00)/.49),cheekDelta(a,y,-1),cheekDelta(a,y,1));if(i<112&&j<66){let k=j*113+i;skinIdx.push(k,k+1,k+113,k+1,k+114,k+113)}}}
const body=skinnedSurface(skin,skinIdx,material(0xffffff,.94,{vertexColors:true}));
const fluff=buffers();
for(let i=0;i<26000;i++){
 let a=rand()*TAU,y=range(.025,2.116),p=furPoint(a,y),n=furNormal(a,y),w=smooth((y-1)/.49);
 let radial=V(Math.sin(a),0,Math.cos(a)),side=V(Math.cos(a),0,-Math.sin(a));let sweep=(y>1.62?.35:.23)*Math.sin(a);
 let flow=V(0,-1,0).addScaledVector(side,sweep+range(-.18,.18));if(y>1.65)flow.addScaledVector(radial,1.15*smooth((y-1.65)/.44));if(y>1.39&&y<1.75&&Math.cos(a)>.64)flow.addScaledVector(side,Math.sin(a)*1.35);
 flow.addScaledVector(n,-flow.dot(n)).normalize();let cross=flow.clone().cross(n).normalize(),width=range(.0022,.0053),len=range(.028,.069)*(y>1.38?.75:1.10);
 let root=p.clone().addScaledVector(n,.0017),c=coatColor(a,y).multiplyScalar(range(.74,1.13)),end=c.clone().multiplyScalar(range(1.04,1.38)),dl=cheekDelta(a,y,-1),dr=cheekDelta(a,y,1);
 addFurVertex(fluff,root.clone().addScaledVector(cross,-width),n,c,w,dl,dr);
 addFurVertex(fluff,root.clone().addScaledVector(cross,width),n,c,w,dl,dr);
 addFurVertex(fluff,root.addScaledVector(flow,len).addScaledVector(n,range(.008,.021)),n,end,w,dl,dr)}
const hairs=skinnedSurface(fluff,null,material(0xffffff,1,{vertexColors:true,side:T.DoubleSide}));hairs.castShadow=false;
const face=group(neck);face.position.set(0,-1.17,-.035);
const furRim=material(0xaa804f,.91),eyeRim=material(0x563d2a,.71),eyeMat=new T.MeshPhysicalMaterial({color:0x150f0d,roughness:.16,clearcoat:1,clearcoatRoughness:.11});
const pink=material(0xc68e7d,.85),pawMat=material(0xe4c3a5,.88),toeMat=material(0xe9cdb6,.83),clawMat=material(0xecdbba,.61);
const irisGlint=new T.MeshBasicMaterial({color:0xfff3dc}),eyes=[],ears=[],forepaws=[],hindpaws=[],whiskers=[];
for(let side of [-1,1]){
 let pos=furPoint(side*.794,1.754),n=furNormal(side*.794,1.754);let socket=group(face);socket.position.copy(pos).addScaledVector(n,.007);socket.quaternion.setFromUnitVectors(V(0,0,1),n);
 oval(socket,furRim,0,.002,-.01,.133,.136,.068);let eyelid=group(socket);eyes.push(eyelid);
 oval(eyelid,eyeRim,0,0,.019,.115,.12,.064);oval(eyelid,eyeMat,0,.003,.044,.104,.111,.068);
 oval(eyelid,irisGlint,-.028,.048,.10,.022,.026,.011);oval(eyelid,irisGlint,.035,.012,.106,.008,.008,.005);
 let ear=group(face);ear.position.set(side*.39,1.972,-.085);ear.rotation.set(-.11,side*.36,-side*.29);ears.push(ear);
 let pts=[],colors=[],ids=[],rings=12,slices=48;for(let j=0;j<=rings;j++){let f=j/rings;for(let k=0;k<=slices;k++){let a=k/slices*TAU,u=Math.cos(a),v=Math.sin(a),lip=Math.exp(-1*((f-.88)/.14)**2);
 pts.push(f*u*.173*(1+.1*v),.09+v*f*.205,.003+.06*lip-.042*(1-f*f)+.024*v*f);
 let ec=new T.Color(0xb48978).lerp(new T.Color(0xe3b9a0),f*.78).lerp(new T.Color(0xc6a17d),lip*.75);colors.push(ec.r,ec.g,ec.b);if(j<rings&&k<slices){let q=j*(slices+1)+k;ids.push(q,q+slices+1,q+1,q+1,q+slices+1,q+slices+2)}}}
 let geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pts,3));geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.setIndex(ids);geo.computeVertexNormals();mesh(ear,geo,material(0xffffff,.86,{vertexColors:true,side:T.DoubleSide}));
 oval(ear,furRim,0,.078,-.087,.171,.198,.032);
 let foot=group(animal);foot.position.set(side*.39,.105,.23);foot.rotation.y=side*.19;hindpaws.push(foot);
 oval(foot,pawMat,0,0,.065,.153,.099,.26);for(let d=0;d<4;d++){let dx=(d-1.5)*.057;oval(foot,toeMat,dx,-.025,.235-Math.abs(dx)*.4,.035,.046,.107)}
 let paw=group(animal);forepaws.push(paw);let arm=oval(paw,material(0xe5d6bc),0,.013,-.058,.122,.129,.20);arm.rotation.x=.25;
 oval(paw,pawMat,0,-.008,.086,.098,.078,.131);
 for(let d=0;d<4;d++){let dx=(d-1.5)*.043,tip=.184-Math.abs(dx)*.61;oval(paw,toeMat,dx,-.018,tip,.030,.035,.079);oval(paw,clawMat,dx,-.021,tip+.059,.014,.017,.029)}
}
const forelegs=[-1,1].map(()=>oval(animal,material(0xe3cfaf,.92),0,0,0,.115,.17,.12));
const nose=group(face);nose.position.set(0,1.573,.894);
let noseGeo=new T.SphereGeometry(1,36,22),np=noseGeo.attributes.position;for(let i=0;i<np.count;i++){let y=np.getY(i);np.setX(i,np.getX(i)*(.86+.30*y))}noseGeo.computeVertexNormals();
let nm=mesh(nose,noseGeo,material(0xc58e80,.6));nm.scale.set(.108,.062,.048);
for(let s of [-1,1])oval(nose,material(0x8c6257),s*.051,.005,.037,.019,.011,.008);
const lip=material(0xa58573,.94);pathTube(face,lip,[V(0,1.53,.849),V(0,1.514,.842),V(0,1.492,.82)],.005);
const whiskMat=material(0xded2b9,.73,{transparent:true,opacity:.76});
for(let side of [-1,1]){
 let whiskGroup=group(face);whiskGroup.position.set(side*.19,1.483,.712);whiskers.push(whiskGroup);
 for(let j=0;j<9;j++){let x=side*(.028*(j%3)),y=Math.floor(j/3)*.033,z=.025*(j%3);let dot=oval(whiskGroup,material(0xb79a78),x,y,z,.011,.009,.009);
 let end=V(side*range(.46,.72),range(-.095,.17),range(.11,.32)),start=V(x,y,z);
 let curve=new T.QuadraticBezierCurve3(start,V(end.x*.44,end.y+.076,end.z+.023),end),g=new T.TubeGeometry(curve,12,.0051,4,false);
 let p=g.attributes.position;for(let k=0;k<p.count;k++){let t=Math.floor(k/5)/12,ct=curve.getPointAt(clamp(t)),v=V().fromBufferAttribute(p,k).sub(ct).multiplyScalar(1-.87*t).add(ct);p.setXYZ(k,v.x,v.y,v.z)}let w=mesh(whiskGroup,g,whiskMat);w.castShadow=false}
}
const animalShade=contact(stage,0,0,.90,.73,.29,.018);
function poseAnimal(t,pose){
 const breath=Math.sin(t*3.9)*.009,step=Math.sin(t*10)*pose.walk;
 animal.scale.set(1+breath*.28,1+breath+.014*Math.abs(step)-pose.low*.176,1-breath*.14);
 pelvis.position.y=-.125*pose.low;pelvis.rotation.x=pose.low*.76;neck.rotation.set(pose.nod+Math.sin(t*4.6)*.011,pose.look,Math.sin(t*.99)*.021+pose.tilt);
 let chewing=pose.chew*(.5+.5*Math.sin(t*18));body.morphTargetInfluences[2]=hairs.morphTargetInfluences[2]=chewing;nose.scale.set(1+chewing*.09,1-chewing*.12,1);nose.position.y=1.573+chewing*.016+Math.sin(t*9)*.003;
 let blink=(t+1.2)%6.7;eyes.forEach(e=>e.scale.y=blink<.19?.15+.85*Math.abs(blink/.095-1):1);
 ears.forEach((e,i)=>{let s=i?1:-1;e.rotation.z=-s*(.29+.037*Math.sin(t*2.4+i)+pose.listen*.20);e.rotation.x=-.11+.04*Math.sin(t*1.6+i*2)-pose.listen*.18});
 for(let i=0;i<2;i++){let side=i?1:-1;let p=forepaws[i],q=pose.paws[i];p.position.copy(q);if(pose.walk)p.position.set(side*.34,.081+.11*Math.max(0,step*side),.94+side*step*.18);p.position.y+=breath*.5+step*side*.04;p.rotation.set(-.44+pose.reach*.72,-side*(.46+pose.chew*.36),-side*.10);hindpaws[i].position.z=.23+side*step*.089;whiskers[i].rotation.y=side*(.026*Math.sin(t*8)+pose.bend*.23);
 let f=clamp(pose.fill[i]/5,0,1.42);body.morphTargetInfluences[i]=f;hairs.morphTargetInfluences[i]=f}
 hamster.updateMatrixWorld(true);
 for(let i=0;i<2;i++){let side=i?1:-1,shoulder=animal.worldToLocal(pelvis.localToWorld(V(side*.46,.85,.35))),wrist=forepaws[i].position.clone();
 let limb=forelegs[i],line=wrist.clone().sub(shoulder);limb.position.copy(shoulder).lerp(wrist,.51);limb.scale.set(.12,line.length()*.57,.127);limb.quaternion.setFromUnitVectors(V(0,1,0),line.normalize())}
 for(let i=0;i<2;i++){hindpaws[i].getWorldPosition(pawImprints[i]);forepaws[i].getWorldPosition(pawImprints[i+2])}
 animalShade.position.set(hamster.position.x,hamster.position.y+.012,hamster.position.z);animalShade.scale.setScalar(hamster.scale.x)}
