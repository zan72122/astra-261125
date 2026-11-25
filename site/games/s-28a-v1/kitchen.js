'use strict';
const kitchen=group(), lowerFloor=-.76, lowerOffset=.92;
const grout=mat(0xc6c2af), stone=procedural(0xece6d6,'stone');
const tileMats=[0xece9dd,0xe8e6dc,0xf1ece0,0xece8db,0xeae8df,0xf1ede3].map(c=>procedural(c,'stone'));
box(kitchen,0,-.31,-.84,8.62,.56,6.44,oakX,.07);
box(kitchen,0,-.092,-.84,8.55,.14,6.38,grout,.025);
const tileGeo=rounded(1.052,.083,1.047,.021);
for(let x=0;x<8;x++)for(let z=0;z<6;z++){
 const tile=mesh(kitchen,tileGeo,tileMats[Math.floor(rand()*tileMats.length)],(x-3.5)*1.065,-.042,(z-2.5)*1.06-.84);
 tile.rotation.y=(rand()-.5)*.002;
}
box(kitchen,0,-.057,2.377,8.65,.145,.115,oakX,.028);
for(const x of [-4.3,4.3])box(kitchen,x,-.065,-.83,.105,.16,6.49,oak,.025);
box(kitchen,0,-.34,2.398,8.58,.045,.052,walnut,.014);
for(let i=0;i<9;i++){
 const plank=box(kitchen,(i-4)*1.06,lowerFloor-.11,5.62,1.052,.22,6.75,i%3===0?honey:oak,.023);plank.rotation.y=(rand()-.5)*.001;
}
box(kitchen,0,lowerFloor+.025,8.94,9.56,.12,.11,oakX);
const lip=mat(0xab7950);
for(const x of [-4.72,4.72])box(kitchen,x,lowerFloor+.037,5.68,.072,.13,6.62,lip);
box(kitchen,0,-1.64,0,45,1.5,42,procedural(0xc9b296,'wood','x'));
const back=group(kitchen);
box(back,0,3,-4.14,19,7.5,.22,mat(0xe6e0cd));
for(let i=-6;i<=7;i++)for(let j=0;j<4;j++){
 box(back,i*1.13+(j%2)*.565,.25+j*.58,-3.995,1.118,.566,.06,tileMats[(i+j+9)%6],.022);
}
const sill=procedural(0xd6be97,'wood','x'), trim=mat(0xece8d9);
box(back,-1.98,1.27,-3.72,5.48,.17,.59,sill,.035);
const glass=mat(0xe0e8cf,.28,{emissive:0xbac7a5,emissiveIntensity:.53});
box(back,-2.0,3.26,-3.92,5.28,3.85,.10,glass);
for(const x of [-4.64,-2.88,-1.11,.64])box(back,x,3.26,-3.78,.102,3.99,.19,trim,.015);
for(const y of [1.37,3.45,5.20])box(back,-2,y,-3.78,5.4,.10,.18,trim,.02);
box(back,5.7,1.8,-3.88,3.8,4,.27,green);
for(let j=0;j<2;j++){
 box(back,4.5+j*1.65,2.0,-3.69,1.58,3.65,.19,green,.045);
 box(back,4.5+j*1.65,2.0,-3.565,1.31,3.34,.055,mat(0x93a497),.036);
 ball(back,4.95+j*.68,1.38,-3.47,.058,.058,.055,brass);
}
function makeCloth(){
 const cloth=group(kitchen);cloth.position.set(2.99,.022,1.46);cloth.rotation.y=-.23;
 const map=texture(256,256,(c,w,h)=>{
  c.fillStyle='#e4e3cf';c.fillRect(0,0,w,h);
  for(let i=0;i<256;i+=32){c.fillStyle='rgba(62,102,104,.43)';c.fillRect(i,0,13,h);c.fillRect(0,i,w,13)}
  for(let i=0;i<256;i+=2){c.fillStyle=i%4?'rgba(255,255,245,.14)':'rgba(53,60,55,.09)';c.fillRect(i,0,1,h);c.fillRect(0,i,w,1)}
 });map.wrapS=map.wrapT=T.RepeatWrapping;map.repeat.set(1.55,2.1);
 const fabric=mat(0xffffff,.97,{map,side:T.DoubleSide});
 function height(x,z,k){return .026*Math.sin(x*14+z*1.7)+.012*Math.sin(x*29-z*2)+.018*Math.cos(z*9)+k*.041}
 for(let k=0;k<3;k++){
 const g=new T.PlaneGeometry(1.35-k*.017,2.25-k*.037,36,52);g.rotateX(-Math.PI/2);
 const p=g.attributes.position;
 for(let i=0;i<p.count;i++){let x=p.getX(i),z=p.getZ(i),y=height(x,z,k);const edge=.77+.17*x;
 if(z>edge){y-=(z-edge)*1.19;z=edge+.10*Math.sin(clamp((z-edge)*5)*1.57)}
 p.setXYZ(i,x+k*.025,y,z+k*.018)}
 p.needsUpdate=true;g.computeVertexNormals();mesh(cloth,g,fabric,0,.048,0)
 }
}
makeCloth();
const terracotta=mat(0xb57651,.88), soil=mat(0x524535);
const plant=group(kitchen);plant.position.set(-3.14,0,-2.50);
lathe(plant,0,0,0,[[.01,.035],[.42,.035],[.46,.06],[.47,.105],[.44,.14],[.37,.14],[.01,.14]],terracotta);
lathe(plant,0,.08,0,[[.25,.02],[.32,.02],[.35,.07],[.44,.63],[.47,.655],[.47,.727],[.43,.75],[.398,.70],[.39,.63],[.0,.63]],terracotta);
lathe(plant,0,.74,0,[[0,0],[.398,0],[.38,.012],[0,.012]],soil);
contact(kitchen,-3.14,.008,-2.5,1.3,1.2);
const stemMat=mat(0x738052),leaves=[0x778b55,0x698150,0x8b9b67,0x9baa72,0x566f47].map(c=>mat(c,.73,{side:T.DoubleSide}));
function leaf(parent,start,end,width,material){
 let v=end.clone().sub(start),side=V(v.z,0,-v.x).normalize().multiplyScalar(width),pos=[],idx=[];
 for(let i=0;i<=8;i++){let t=i/8,c=start.clone().lerp(end,t);c.y+=Math.sin(t*Math.PI)*width*.4;let w=Math.pow(Math.sin(t*Math.PI),.87);
 for(let j=-1;j<=1;j++){let p=c.clone().addScaledVector(side,j*w);p.y+=j===0?w*width*.2:0;pos.push(...p.toArray())}
 if(i<8){let n=i*3;idx.push(n,n+3,n+1,n+1,n+3,n+4,n+1,n+4,n+2,n+2,n+4,n+5)}}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();mesh(parent,g,material);
}
for(let i=0;i<13;i++){
 let a=i*2.399,rad=.25+rand()*.36,h=1.38+rand()*.69;
 let root=V(Math.cos(a)*.13,.74,Math.sin(a)*.13),end=V(Math.cos(a)*rad,h,Math.sin(a)*rad);
 tube(plant,[root,root.clone().lerp(end,.55).add(V(0,.085,0)),end],.013,stemMat,10,5);
 for(let j=0;j<5;j++){let t=.27+j*.15,p=root.clone().lerp(end,t);p.y+=.055*Math.sin(Math.PI*t);
 for(let s of [-1,1]){let turn=a+s*(.85+rand()*.4);leaf(plant,p,p.clone().add(V(Math.cos(turn)*(.22+.10*t),.035+rand()*.13,Math.sin(turn)*.28)),.066+rand()*.032,leaves[(i+j)%5])}}
}
const board=group(kitchen);board.position.set(2.32,0,-3.48);board.rotation.set(-.13,-.13,-.09);
const bShape=new T.Shape();bShape.moveTo(-.62,.04);bShape.quadraticCurveTo(-.76,.04,-.76,.22);bShape.lineTo(-.76,1.61);
bShape.quadraticCurveTo(-.76,1.83,-.39,1.85);bShape.quadraticCurveTo(-.13,1.87,-.14,2.13);bShape.quadraticCurveTo(-.17,2.46,.04,2.46);bShape.quadraticCurveTo(.22,2.46,.19,2.16);bShape.quadraticCurveTo(.16,1.9,.41,1.88);bShape.quadraticCurveTo(.72,1.86,.72,1.68);bShape.lineTo(.72,.2);bShape.quadraticCurveTo(.72,.04,.55,.04);bShape.closePath();
const hole=new T.Path();hole.absellipse(.032,2.284,.066,.080,0,Math.PI*2,true);bShape.holes.push(hole);
mesh(board,new T.ExtrudeGeometry(bShape,{depth:.09,bevelEnabled:true,bevelThickness:.045,bevelSize:.045,bevelSegments:4,curveSegments:24}),procedural(0xb9814f,'wood','y'));
function crock(x,z,size){
 const g=group(kitchen);g.position.set(x,.007,z);g.scale.setScalar(size);
 lathe(g,0,0,0,[[.25,0],[.35,.018],[.39,.07],[.46,.4],[.45,.82],[.407,.95],[.415,1.0],[.422,1.035],[.415,1.063],[.373,1.06],[.365,1.027],[.38,.97],[.39,.68],[.01,.67]],ivory);
 for(const y of [.12,.16,.90,.925])lathe(g,0,0,0,[[y<.2?.401:.43,y],[y<.2?.404:.427,y+.012]],blue);
 return g
}
const jar=crock(3.48,-2.45,.87);
for(let i=0;i<3;i++){const spoon=group(jar);spoon.position.set((i-1)*.17,.84,-.01+i*.06);spoon.rotation.z=(i-1)*.21-.06;
 box(spoon,0,.45,0,.077,.96,.053,oak,.025);ball(spoon,0,1.0,0,.14,.244,.062,honey)}
// A real window lattice above the camera casts the long morning shadows.
const windowShade=mat(0xf5ebd6);windowShade.colorWrite=false;windowShade.depthWrite=false;
const lattice=group(kitchen);lattice.position.set(-3.3,5.0,-2.48);lattice.rotation.y=-.2;
for(const x of [-3.6,-1.65,1.85,3.62])box(lattice,x,0,0,.085,.07,5.9,windowShade,0);
box(lattice,0,0,-1.12,7.4,.06,.074,windowShade,0);
bakeStatic(kitchen);
function platePainting(){
 return texture(1024,1024,(c,w,h)=>{
 c.fillStyle='#eef0e7';c.fillRect(0,0,w,h);
 for(let i=0;i<12500;i++){c.fillStyle=i%4?'rgba(131,156,149,.066)':'rgba(92,119,126,.13)';c.fillRect(rand()*w,rand()*h,rand()*2.1+.3,rand()*1.2+.5)}
 c.translate(512,512);
 function ring(r,width,col){c.beginPath();c.arc(0,0,r,0,Math.PI*2);c.lineWidth=width;c.strokeStyle=col;c.stroke()}
 ring(470,4.7,'#547e91');ring(459,2,'#7e9a9d');ring(399,1.8,'#7796a1');
 function almond(x,y,angle,length,width){
 c.save();c.translate(x,y);c.rotate(angle);c.fillStyle=rand()>.4?'#568095':'#7396a0';
 c.beginPath();c.moveTo(0,0);c.quadraticCurveTo(length*.5,-width,length,0);c.quadraticCurveTo(length*.45,width*.75,0,0);c.fill();c.restore()
 }
 for(let k=0;k<12;k++){
 c.save();c.rotate(k*Math.PI/6+.11);
 c.strokeStyle='#779198';c.lineWidth=2.5;c.beginPath();c.moveTo(-63,422);c.quadraticCurveTo(-10,446,60,424);c.stroke();
 for(let j=0;j<7;j++){let x=-48+j*14,y=433-Math.pow(x/51,2)*8;almond(x,y,-.76,18,4.9);if(j%2===0)almond(x+4,y,.48,17,4)}
 c.fillStyle='#5b8191';c.beginPath();c.arc(66,423,3.2,0,7);c.fill();
 c.restore()
 }
 })
}
const paintedGlaze=mat(0xffffff,.22,{map:platePainting(),envMapIntensity:.47});
function makeDish(x,y,z,a,b){
 const stand=group(kitchen);stand.position.set(x,y,z);
 lathe(stand,0,.012,0,[[0,0],[a*.64,0],[a*.68,.023],[a*.67,.07],[a*.65,.084],[0,.084]],oakX);
 const g=group(stand);g.position.y=.071;
 const pos=[],uv=[],idx=[],n=120;
 const profile=[[.01,.018],[.47,.018],[.55,.029],[.69,.066],[.84,.108],[.974,.181],[1,.21],[1.004,.232],[.988,.247],[.968,.246],[.925,.218],[.84,.158],[.67,.094],[.48,.067],[.2,.055],[0,.055]];
 profile.forEach(([r,h],j)=>{for(let i=0;i<=n;i++){
 const an=i/n*Math.PI*2,cs=Math.cos(an),sn=Math.sin(an),lobe=Math.pow(Math.max(0,Math.cos(an+1.08)),10);
 const organic=1+.015*Math.sin(3*an+.7)+.009*Math.cos(5*an);
 const d=r*organic*(1-.072*lobe*(j>9?1:.43)),px=cs*d,pz=sn*d;
 pos.push(px*a,h+.012*r*r*Math.cos(an*3)+.041*lobe*r*r,pz*b);
 uv.push(.5+cs*r*.471,.5+sn*r*.471);
 if(j<profile.length-1&&i<n){let k=j*(n+1)+i;idx.push(k,k+1,k+n+1,k+1,k+n+2,k+n+1)}
 }});
 const geom=new T.BufferGeometry();geom.setAttribute('position',new T.Float32BufferAttribute(pos,3));geom.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geom.setIndex(idx);geom.computeVertexNormals();
 // The surface is wound from the foot, around the lip, and back to the hollow.
 geom.index.array.reverse();geom.computeVertexNormals();
 const body=mesh(g,geom,paintedGlaze);
 const tab=ball(g,a*.92,.166,b*.43,.215*a,.071,.158*b,ivory);tab.rotation.y=-.42;
 const fleck=ball(g,a*1.01,.222,b*.45,.050,.007,.022,blue);fleck.rotation.y=.35;
 contact(stand,0,.006,0,a*2.15,b*2.12,.58);
 return {stand,g,body,tab,a,b,x,y,z,angle:0}
}
const dishes=[makeDish(.80,0,.01,1.19,.83),makeDish(-1.02,lowerFloor,3.60+lowerOffset,.72,.56),makeDish(1.31,lowerFloor,3.55+lowerOffset,.87,.59)];
const support=group(kitchen),supply=group(kitchen);
const upperPivot=V(-1.05,.455,.75),bottomPivot=V(0,lowerFloor+.47,6.23+lowerOffset);
const upperYaw=-.935,railLength=1.51;
const woodDark=procedural(0xb07842,'wood'),woodEdge=procedural(0xd69c5c,'wood');
function pocket(z){return -.074*Math.exp(-Math.pow((z-.14)/.30,2))}
function trackHeight(z){return .091+.012*z+pocket(z)}
function makeChannel(parent,length,width,deep,curve=null){
 let verts=[],idx=[],uv=[];const rings=68,half=width/2;
 const section=[[-.85,-.13],[-.99,-.093],[-1,-.018],[-.99,deep-.044],[-.96,deep-.008],[-.92,deep+.009],[-.86,deep+.012],[-.81,deep-.002],[-.76,deep-.045],[-.68,deep*.48],[-.52,.114],[-.33,.091],[-.12,.081],[.12,.081],[.33,.091],[.52,.114],[.68,deep*.48],[.76,deep-.045],[.81,deep-.002],[.86,deep+.012],[.92,deep+.009],[.96,deep-.008],[.99,deep-.044],[1,-.018],[.99,-.093],[.85,-.13],[-.85,-.13]];
 const n=section.length;
 for(let i=0;i<=rings;i++){
 const t=i/rings,z=(t-.5)*length,at=curve?curve.getPoint(t):V(0,0,z),dir=curve?curve.getTangent(t):V(0,0,1),right=V(dir.z,0,-dir.x).normalize();
 for(let j=0;j<n;j++){
 const [u,h]=section[j],w=half*(1-.045*Math.cos(t*Math.PI*2)),p=at.clone().addScaledVector(right,u*w);
 p.y+=h+(curve?0:.012*z+pocket(z)*(1-Math.pow(Math.abs(u),2))*(h>=.08?1:0));
 verts.push(...p.toArray());uv.push(t,j/(n-1));
 if(i<rings&&j<n-1){let k=i*n+j;idx.push(k,k+n,k+1,k+1,k+n,k+n+1)}
 }}
 const cap=T.ShapeUtils.triangulateShape(section.slice(0,-1).map(([x,y])=>new T.Vector2(x*half,y)),[]);
 for(const end of [0,rings]){const k=end*n;for(const [a,b,c] of cap){if(end)idx.push(k+a,k+b,k+c);else idx.push(k+a,k+c,k+b)}}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(verts,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();
 const wood=curve?woodEdge:oak;wood.side=T.DoubleSide;return mesh(parent,g,wood)
}
const swivel=group(kitchen),lever=group(swivel);
function makeStand(point,yaw){
 const s=group(support);s.position.copy(point);s.rotation.y=yaw;
 box(s,0,-.365,0,1.14,.17,.62,oakX,.063);
 for(const sign of [-1,1]){box(s,sign*.440,-.191,0,.16,.39,.42,honey,.067);ball(s,sign*.49,-.047,0,.075,.104,.104,walnut)}
 box(s,0,-.068,0,1.10,.15,.18,walnut,.072);
 box(s,0,-.357,1.20,.71,.17,.32,woodDark,.061);
 box(s,0,-.247,1.20,.59,.065,.22,mat(0xab9677),.025);
}
makeStand(upperPivot,upperYaw);makeStand(bottomPivot,0);
makeChannel(lever,railLength*2,.69,.265);
const grip=ball(lever,0,.125,1.456,.344,.139,.224,honey);
for(const s of [-1,1]){
 const pin=lathe(lever,s*.394,-.022,0,[[0,-.081],[.062,-.081],[.079,-.054],[.079,.053],[.066,.070],[0,.070]],brass,32);pin.rotation.z=Math.PI*.5;
}
swivel.position.copy(upperPivot);swivel.rotation.y=upperYaw;
function bowl(){
 lathe(supply,0,.007,0,[[.01,0],[.28,0],[.32,.019],[.45,.10],[.55,.222],[.578,.312],[.577,.346],[.564,.368],[.542,.372],[.518,.351],[.498,.289],[.426,.196],[.314,.137],[.19,.116],[0,.111]],oakX);
 contact(supply,0,.006,0,1.24,1.11,.64)
}
bowl();supply.position.set(-2.56,0,.16);
const lowerSupply=supply.clone(true);kitchen.add(lowerSupply);lowerSupply.position.set(-1.13,lowerFloor,6.38+lowerOffset);
const bowls=[supply,lowerSupply];
const branches=[
 new T.CatmullRomCurve3([V(-.23,lowerFloor+.43,4.77),V(-.33,lowerFloor+.37,4.49),V(-.65,lowerFloor+.32,4.25),V(-.94,lowerFloor+.26,3.91)]),
 new T.CatmullRomCurve3([V(.23,lowerFloor+.43,4.77),V(.65,lowerFloor+.41,4.66),V(1.59,lowerFloor+.36,4.64),V(1.94,lowerFloor+.31,4.36),V(1.78,lowerFloor+.27,4.07),V(1.40,lowerFloor+.25,3.90)])
];
for(const c of branches){for(const p of c.points)p.z+=lowerOffset;makeChannel(kitchen,1,.42,.17,c)}
const guide=group(kitchen);
function transferPoint(t){let p=upperPivot.clone().lerp(bottomPivot,t);p.y=upperPivot.y+lowerFloor*smooth((t-.24)/.43);return p}
for(const sign of [-1,1]){
 const points=[];for(let i=0;i<=20;i++){let t=i/20,p=transferPoint(t);p.y-=.235;p.x+=sign*.435*Math.cos(upperYaw*(1-smooth(t)));p.z-=sign*.435*Math.sin(upperYaw*(1-smooth(t)));points.push(p)}
 tube(guide,points,.063,woodDark,60,8);
 for(const t of [.0,.24,.45,.68,1]){let p=transferPoint(t);box(guide,p.x+sign*.435*Math.cos(upperYaw*(1-smooth(t))),p.y-.19,p.z-sign*.435*Math.sin(upperYaw*(1-smooth(t))),.19,.12,.28,oakX,.04)}
}
guide.visible=false;
