'use strict';
function coatTexture(cols,rows,seed,face=false){
 const rnd=random(seed);return texture(768,768,(c,w,h)=>{
 c.fillStyle=face?'#d8af74':'#ebd59d';c.fillRect(0,0,w,h);
 const centers=[];for(let j=-2;j<rows+2;j++){const row=[];for(let i=0;i<cols;i++)row.push([i+.5+(rnd()-.5)*.78,j+.5+(rnd()-.5)*.76,rnd()]);centers.push(row)}
 const cells=[];centers.forEach(row=>{for(let wrap=-1;wrap<=1;wrap++)row.forEach(([x,y,v])=>cells.push([x+wrap*cols,y,v]))});
 for(const [x,y,t] of cells){
 if(x< -1||x>cols+1||y< -1||y>rows+1)continue;
 let poly=[[-2,-2],[2,-2],[2,2],[-2,2]];
 for(const [xx,yy] of cells){const dx=xx-x,dy=yy-y,l=dx*dx+dy*dy;if(l===0||l>12)continue;
 const next=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],av=a[0]*dx+a[1]*dy-l/2,bv=b[0]*dx+b[1]*dy-l/2;if(av<=0)next.push(a);if((av>0)!==(bv>0)){const k=av/(av-bv);next.push([mix(a[0],b[0],k),mix(a[1],b[1],k)])}}poly=next}
 if(poly.length<3)continue;
 const shrink=face?.79:.91;const pts=poly.map(([a,b])=>[(x+a*shrink)*w/cols,(y+b*shrink)*h/rows]);
 const gradient=c.createLinearGradient(x*w/cols,(y-.5)*h/rows,x*w/cols,(y+.5)*h/rows);
 const r=141+t*33,g=75+t*24,b=34+t*15;gradient.addColorStop(0,'rgb('+[r+9,g+9,b+6].join(',')+')');gradient.addColorStop(1,'rgb('+[r-8,g-6,b-3].join(',')+')');
 c.fillStyle=gradient;c.beginPath();
 for(let i=0;i<pts.length;i++){const a=pts[(i+pts.length-1)%pts.length],b=pts[i],d=pts[(i+1)%pts.length];const x1=mix(b[0],a[0],.105),y1=mix(b[1],a[1],.105);if(i)c.lineTo(x1,y1);else c.moveTo(x1,y1);c.quadraticCurveTo(...b,mix(b[0],d[0],.105),mix(b[1],d[1],.105))}c.closePath();c.fill()
 }
 if(face){const grad=c.createLinearGradient(0,0,0,h);grad.addColorStop(0,'#ad8665');grad.addColorStop(.21,'#bd946b');grad.addColorStop(.5,'rgba(202,163,109,.98)');grad.addColorStop(.72,'rgba(212,176,120,.69)');grad.addColorStop(1,'rgba(221,186,132,.12)');c.fillStyle=grad;c.fillRect(0,0,w,h)}
 const pixels=c.getImageData(0,0,w,h);for(let i=0;i<pixels.data.length;i+=4){const n=(rnd()-.5)*14;for(let j=0;j<3;j++)pixels.data[i+j]+=n}c.putImageData(pixels,0,0);
 for(let i=0;i<28000;i++){const x=rnd()*w,y=rnd()*h;c.strokeStyle=rnd()<.5?'rgba(255,236,185,.15)':'rgba(75,41,27,.14)';c.lineWidth=.55;c.beginPath();c.moveTo(x,y);c.lineTo(x+1.4,y+3+rnd()*3);c.stroke()}
 },true)
}
const neckMap=coatTexture(9,10,183),bodyMap=coatTexture(14,9,880),headMap=coatTexture(14,7,501,true);
const hide=m=>mat(0xfff8e9,{map:m,bumpMap:m,bumpScale:.0038,roughness:.96});
const neckHide=hide(neckMap),bodyHide=hide(bodyMap),headHide=hide(headMap);
const fawn=mat(0xc49a69),sand=mat(0xd5b784),darkFur=mat(0x61432e),maneMat=mat(0x885a37),browMat=mat(0xb68d5f);
const lipMat=mat(0xa88869),lipDark=mat(0x523c32),lashMat=mat(0x372c23);
const giraffe=group(),body=group(giraffe),head=group(giraffe);
const homeHead=V(.78,2.94,-1.53),bodyOrigin=V(1.52,.99,-3.88);
body.position.copy(bodyOrigin);body.rotation.y=-.31;
loft(body,[[0,-.17,-1.48,.01,.06],[0,-.13,-1.32,.42,.49],[0,-.06,-.86,.60,.76],[0,.05,-.06,.67,.84],[0,.15,.55,.54,.78],[0,.26,.92,.42,.60],[0,.31,1.03,.08,.15]],bodyHide,48,40);
const legs=[];
for(const s of [-1,1])for(const z of [-.94,.60]){
 const x=s*.35;legs.push(loft(body,[[x,-.08,z,.22,.27],[x,-.59,z+.02,.159,.17],[x,-1.09,z-.09,.104,.116],[x,-1.27,z-.04,.113,.12],[x,-1.7,z+.028,.074,.079]],bodyHide,24,20))}
let walking=0;
const neckStations=()=>[[1.31,1.35,-3.42,.49,.61],[1.20,1.68,-3.12,.44,.51],[1.07,2.15,-2.71,.348,.41],[.93,2.56,-2.23,.277,.32],[.81,2.93,-1.79,.242,.28],[.78,3.00,-1.59,.247,.25]];
const neck=loft(giraffe,neckStations(),neckHide,40,36);
const mane=loft(giraffe,neckStations(),maneMat,14,27);
head.position.copy(homeHead);head.rotation.order='YXZ';head.rotation.y=-.70;
loft(head,[[0,.085,-.385,.07,.105],[0,.075,-.31,.275,.32],[0,.06,-.154,.352,.361],[0,.028,.015,.365,.327],[0,-.026,.186,.303,.277],[0,-.098,.353,.238,.201],[0,-.154,.537,.214,.157],[0,-.173,.677,.244,.139],[0,-.193,.746,.232,.112],[0,-.203,.789,.13,.068],[0,-.204,.8,.02,.012]],headHide,52,44);
const jaw=group(head);jaw.position.set(0,-.125,.07);
loft(jaw,[[0,-.022,-.24,.109,.114],[0,-.044,-.108,.299,.199],[0,-.083,.036,.294,.178],[0,-.109,.221,.228,.126],[0,-.147,.41,.188,.082],[0,-.149,.568,.222,.071],[0,-.148,.66,.197,.058],[0,-.156,.69,.056,.016]],lipMat,40,28);
const muzzleFur=mat(0x8c7460),whiskerMat=mat(0xe1c49b);
for(const s of [-1,1]){
 const nost=group(head);nost.position.set(s*.194,-.145,.677);nost.rotation.set(-.17,s*.93,s*.24);
 const rim=oval(nost,V(),V(.080,.041,.018),lipMat);rim.rotation.z=s*.29;
 const slit=oval(nost,V(0,.006,.015),V(.065,.023,.007),lipDark);slit.rotation.z=s*.29;
 twig(head,[V(s*.183,-.245,.77),V(s*.227,-.251,.713),V(s*.22,-.25,.632),V(s*.205,-.226,.53)], [.002,.007,.006,.001],lipDark,8,12);
 for(let i=0;i<26;i++){const z=.49+rand()*.236,y=-.196-rand()*.044,x=s*(.201+.021*Math.sin((z-.49)*6));oval(head,V(x,y,z),V(.0035,.003,.004),muzzleFur)}
}
const hairs=group(jaw);for(const s of [-1,1])for(let i=0;i<20;i++){
 const z=.24+rand()*.40,x=s*(.184+rand()*.026),y=-.177-rand()*.034;
 rod(hairs,V(x,y,z),V(x+s*(.015+rand()*.026),y-.012-rand()*.018,z+.012),.0014,.00015,whiskerMat,4)}
const ears=[],eyes=[],lids=[];
const irisMat=mat(0x503725,{roughness:.24}),eyeMat=mat(0x241e19,{roughness:.19}),pupilMat=mat(0x100f0e,{roughness:.11}),glintMat=new T.MeshBasicMaterial({color:0xfff8dd});
for(const s of [-1,1]){
 const ear=group(head);ear.position.set(s*.231,.184,-.202);ears.push(ear);
 const earGeo=new T.BufferGeometry(),pos=[],col=[],idx=[];const N=22,M=20;
 for(let j=0;j<=N;j++){const t=j/N,w=.155*Math.pow(Math.max(.0001,Math.sin(PI*t)),.75);
 for(let i=0;i<=M;i++){const v=i/M*2-1;const pt=V(s*(.017+.51*t),.144*t+w*v,.05*Math.sin(PI*t)-.18*t+.09*v*v*Math.sin(PI*t));
 pos.push(pt.x,pt.y,pt.z);const c=new T.Color(0xb38b6b).lerp(new T.Color(0xf0d8a8),smooth(.48,1,Math.abs(v))+.04*Math.sin(t*30)*Math.cos(v*9));col.push(c.r,c.g,c.b);
 const k=j*(M+1)+i;if(j<N&&i<M)idx.push(k,k+1,k+M+1,k+1,k+M+2,k+M+1)}}
 earGeo.setAttribute('position',new T.Float32BufferAttribute(pos,3));earGeo.setAttribute('color',new T.Float32BufferAttribute(col,3));earGeo.setIndex(idx);earGeo.computeVertexNormals();mesh(ear,earGeo,mat(0xffffff,{vertexColors:true,side:T.DoubleSide}));
 for(const side of [-1,1]){const ps=[],rs=[];for(let q=0;q<=7;q++){const t=q/7;ps.push(V(s*(.017+.51*t),.144*t+side*.155*Math.pow(Math.sin(PI*t),.75),.14*Math.sin(PI*t)-.18*t));rs.push(.005+.013*Math.sin(PI*t))}twig(ear,ps,rs,sand)}
 const horn=loft(head,[[s*.16,.299,-.162,.096,.099],[s*.179,.403,-.197,.081,.084],[s*.19,.52,-.222,.055,.059],[s*.20,.60,-.229,.068,.069],[s*.20,.637,-.23,.056,.055]],fawn,26,24);
 oval(head,V(s*.20,.64,-.229),V(.076,.062,.073),darkFur);
 for(let i=0;i<17;i++){const a=rand()*TAU,r=.062*Math.sqrt(rand());rod(head,V(s*.2+Math.cos(a)*r,.664,-.229+Math.sin(a)*r),V(s*.2+Math.cos(a)*r*1.1,.681+rand()*.021,-.237+Math.sin(a)*r),.005,.001,darkFur,5)}
 const eyeSocket=group(head);eyeSocket.position.set(s*.309,.126,.058);eyeSocket.rotation.y=s*1.03;eyeSocket.rotation.z=s*.095;
 oval(eyeSocket,V(0,.028,-.009),V(.165,.126,.074),browMat);
 oval(eyeSocket,V(0,0,.042),V(.129,.090,.056),darkFur);
 const eye=group(eyeSocket);eyes.push(eye);
 oval(eye,V(0,.006,.068),V(.111,.068,.052),eyeMat);
 oval(eye,V(s*.006,.008,.112),V(.058,.053,.013),irisMat);
 oval(eye,V(s*.008,.009,.122),V(.035,.045,.008),pupilMat);
 oval(eye,V(-.022,.033,.131),V(.012,.010,.003),glintMat);oval(eye,V(.015,.018,.134),V(.004,.004,.002),glintMat);
 const lid=group(eyeSocket);lids.push(lid);
 const upper=[],lower=[];for(let i=0;i<=8;i++){const t=i/8,x=(t-.5)*.241;upper.push(V(x,.012+.070*Math.sin(PI*t),.075+.026*Math.sin(PI*t)));lower.push(V(x,-.007-.052*Math.sin(PI*t),.067+.025*Math.sin(PI*t)))}
 twig(lid,upper,upper.map((_,i)=>.01+.01*Math.sin(i/8*PI)),darkFur);
 twig(eyeSocket,lower,lower.map(()=>.009),browMat);
 for(let j=0;j<17;j++){const t=(j+.5)/17,x=(t-.5)*.228,y=.014+.071*Math.sin(PI*t),z=.079+.025*Math.sin(PI*t),l=.031+.036*Math.sin(PI*t)+rand()*.015;
 twig(lid,[V(x,y,z),V(x+x*.10,y+.019,z+l*.52),V(x+x*.22-s*.009,y+.026+rand()*.014,z+l)], [.0031,.0023,.0003],lashMat,5,5)}
}
const tongueMap=texture(64,256,(c,w,h)=>{const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,'#564352');g.addColorStop(.60,'#72576a');g.addColorStop(1,'#b48182');c.fillStyle=g;c.fillRect(0,0,w,h);for(let i=0;i<1900;i++){c.fillStyle=rand()<.5?'rgba(248,210,188,.12)':'rgba(57,42,50,.17)';c.fillRect(rand()*w,rand()*h,1,1.1)}});
const tongueMaterial=mat(0xeee7dc,{map:tongueMap,bumpMap:tongueMap,bumpScale:.0008,roughness:.40});
const tongue=loft(giraffe,[[0,0,0,.01,.01],[0,.01,.1,.04,.02]],tongueMaterial,18,30);
tongue.visible=false;
const mouthLocal=V(0,-.259,.755);
const animal={gaze:0,ear:0,yaw:-.70,chew:0,blink:0,neckClock:0,recent:0};
function moveAnimal(dt,time,aim,attention,contact,upper,memory,leverage){
 const idle=V(homeHead.x+.028*Math.sin(time*.36),homeHead.y+.019*Math.sin(time*1.56),homeHead.z);
 idle.x+=memory*.19-.28*clamp((1-camera.aspect)/.55);idle.y+=upper*.19;
 const target=aim||V(ports[0],1.34,.1),rel=target.x-idle.x;
 const desiredYaw=clamp(rel*.47,-.88,.88);
 animal.gaze=damp(animal.gaze,desiredYaw,6.8,dt);animal.ear=damp(animal.ear,animal.gaze,3.9,dt);
 const wanted=mix(-.43+memory*.23,desiredYaw,attention);
 animal.yaw=damp(animal.yaw,wanted,2.8,dt);head.rotation.y=animal.yaw;
 head.rotation.x=damp(head.rotation.x,.055+attention*.095+contact*.09-upper*.29,3.5,dt);
 head.rotation.z=damp(head.rotation.z,.017*Math.sin(time*.49)+animal.ear*.066,2.6,dt);
 head.updateMatrixWorld(true);
 const mouthOffset=mouthLocal.clone().applyQuaternion(head.quaternion);
 const contactPos=target.clone().sub(mouthOffset);contactPos.z-=.31-.13*leverage;contactPos.y+=.045+.075*(1-leverage);
 idle.x+=attention*.11*rel;idle.y-=attention*.25;idle.z+=attention*.40;
 const dest=idle.lerp(contactPos,contact);
 head.position.lerp(dest,1-Math.exp(-dt*(contact>.85?5.6:2.5)));
 const chew=animal.chew>0?Math.sin(time*7.7):0;
 jaw.rotation.x=damp(jaw.rotation.x,(tongue.visible?.071:.008)+Math.max(0,chew)*.075,10,dt);jaw.position.x=chew*.025;hairs.rotation.z=chew*.041;
 animal.chew=Math.max(0,animal.chew-dt);
 const blink=Math.pow(Math.max(0,Math.cos(time*1.06+2.2)),114);
 eyes.forEach((e,i)=>{e.position.x=animal.gaze*.014;e.scale.y=1-blink*.91;lids[i].position.y=-.046*blink;ears[i].rotation.y=(i?1:-1)*(.08*Math.sin(time*.58+i)+animal.ear*.33);ears[i].rotation.z=Math.sin(time*.92+i)*.034});
 body.scale.set(1+.011*Math.sin(time*1.5),1+.006*Math.sin(time*1.5),1);
 walking=damp(walking,bstate.opened?1:0,.83,dt);
 body.position.z=bodyOrigin.z+.205*walking;
 legs.forEach((leg,i)=>{const t=smooth(i*.105,.64+i*.105,walking);leg.position.y=Math.sin(t*PI)*.078;leg.position.z=.187*t-.177*walking});
 
 animal.neckClock-=dt;if(animal.neckClock<=0){animal.neckClock=.041;
 const end=V(0,.10,-.235).applyQuaternion(head.quaternion).add(head.position);
 const s=neckStations();s.forEach((row,i)=>{const t=i/(s.length-1),k=t*t*(2-t);row[0]+=(end.x-.78)*k+.026*Math.sin(time*.49)*(1-k);row[1]+=(end.y-3)*k;row[2]+=(end.z+1.59)*k+walking*.205*(1-k)});
 neck.reshape(s);const hairs=s.map((a,i)=>[a[0],a[1]+a[4]*.40,a[2]-a[4]*.84,.036+(1-i/5)*.035,.076]);mane.reshape(hairs)}
 head.updateWorldMatrix(true,true);
}
function lips(){return head.localToWorld(mouthLocal.clone())}

joinFixedParts(head);joinFixedParts(hairs);for(const lid of lids)joinFixedParts(lid);
