'use strict';
function bell(x,w){return Math.exp(-x*x/(w*w))}
function coatMap(part){
 const W=768,H=448;
 return texture(W,H,(c,w,h)=>{
 const im=c.createImageData(w,h),data=im.data;let offset=0;
 for(let j=0;j<h;j++){
 const th=(j+.5)*Math.PI/h,y=Math.cos(th),r=Math.sin(th);
 for(let i=0;i<w;i++){
 const a=(i+.5)/w*Math.PI*2,x=-Math.cos(a)*r,z=Math.sin(a)*r;
 const mott=.032*Math.sin(x*24+Math.sin(y*21)+z*15)+.015*Math.sin(y*58+z*35);
 let stripe=0,cream=0,white=0;
 if(part==='head'){
 const front=smooth((z+.09)/.59),ax=Math.abs(x),b=ax+mott*.27;
 const brow=b-.105-.31*(y-.18)-.048*Math.sin(y*6.3);
 const brow2=b-.40-.22*(y-.2)-.032*Math.sin(y*8);
 const mmark=b-.135+.46*(y-.22);
 stripe=(bell(brow,.055)+.83*bell(brow2,.062)+.65*bell(mmark,.046)*bell(y-.29,.17))*smooth((y-.02)/.25)*front;
 stripe+=front*smooth((ax-.42)/.24)*(bell(y-.085+.18*Math.sin(3.7*(ax-.4))-.17*(ax-.6),.050)+.93*bell(y+.145+.23*Math.cos((ax-.36)*4.9),.046));
 stripe+=smooth((.25-z)/.55)*Math.pow(.5+.5*Math.cos(a*15+Math.sin(y*4)*1.7),5)*.92;
 cream=.62*front*bell(y-.036,.16)*bell(ax-.43,.32)+.41*front*bell(ax,.18)*bell(y+.11,.32);
 white=front*smooth((-.34-y+mott)/.35)*.76;
 }else if(part==='body'||part==='leg'){
 stripe=Math.pow(.5+.5*Math.cos((part==='body'?z*18+y*2.6:y*17+z*1.5)+Math.sin((part==='body'?y:x)*5.1)*1.35+1.2*x+.4*Math.sin(a*6)),4.4)*(.6+.27*smooth((y+.5)/.9));
 cream=.30*Math.max(0,z);white=part==='leg'?smooth((-.36-y+.06*Math.sin(a*2))/.16):smooth((z-.61+.12*y+mott)/.29)*.96;
 }else {cream=.6;white=.99}
 let shade=clamp(stripe+Math.max(0,mott)*.8),pale=clamp(cream),wh=clamp(white);
 const wave=2.9*Math.sin(12*x+z*6)*Math.cos(y*13)+2.3*Math.sin(z*31-1.1*y)+8*(rand()-.5);
 const base=[201,139,76],dark=[122,77,45],light=[238,205,153],milk=[240,233,213];
 for(let k=0;k<3;k++)data[offset++]=mix(mix(mix(base[k],dark[k],shade),light[k],pale),milk[k],wh)+wave;
 data[offset++]=255;
 }}
 c.putImageData(im,0,0);
 for(let i=0;i<54000;i++){
 let u=rand(),v=rand(),phi=u*Math.PI*2;
 const x=-Math.cos(phi),k=part==='head'?Math.sin((u-.25)*Math.PI*2)*Math.cos((v-.49)*3):Math.sin(phi+.7);
 let dx=(2.1+rand()*3.0)*k,dy=(part==='head'?((v-.49)*6.2+1.5*Math.abs(x)):3.7)+rand()*1.6;
 c.strokeStyle=rand()<.52?'rgba(255,240,202,.24)':'rgba(89,61,45,.15)';c.lineWidth=.45+rand()*.55;
 c.beginPath();c.moveTo(u*w,v*h);c.quadraticCurveTo(u*w+dx*.39,v*h+dy*.5,u*w+dx,v*h+dy);c.stroke()
 }
 })
}
const fur={};
for(let part of ['head','body','leg','white']){
 const map=coatMap(part);fur[part]=new T.MeshPhysicalMaterial({map,roughness:.94,envMapIntensity:.23,bumpMap:map,bumpScale:.008,sheen:.34,sheenRoughness:.90,sheenColor:0xf0e0ca});
}
const cat=group(kitchen),torso=group(cat),headNeck=group(cat),head=group(headNeck);
cat.position.set(1.05,0,-1.57);cat.rotation.y=-.32;
function furry(parent,x,y,z,rx,ry,rz,type='body',count=7000,style=''){
 const g=group(parent);g.position.set(x,y,z);
 const geo=sphere.clone(),pos=geo.attributes.position;
 function surface(px,py,pz){
  let shape=1,yy=py,zz=pz;
  if(style==='face'){shape=1+.07*bell(py+.19,.24)-.14*smooth((-py-.44)/.5);zz+=.055*bell(px,.38)*bell(py+.1,.5)*Math.max(0,pz)}
  if(style==='paw'){const split=(bell(px-.35,.062)+bell(px+.35,.062))*smooth((pz-.15)/.65);yy-=.057*split;zz-=.059*split;yy=Math.max(-.88,yy)}
  if(style==='haunch')shape=1-.14*py;
  return V(px*rx*shape,yy*ry,zz*rz)
 }
 for(let i=0;i<pos.count;i++){let p=surface(pos.getX(i),pos.getY(i),pos.getZ(i));pos.setXYZ(i,p.x,p.y,p.z)}
 geo.computeVertexNormals();mesh(g,geo,fur[type]);
 const p=[],uv=[],norm=[],rr=Math.PI*(3-Math.sqrt(5));
 for(let i=0;i<count;i++){
  const y1=1-2*(i+.5)/count,rad=Math.sqrt(1-y1*y1),a=i*rr+rand()*.016,xx=Math.cos(a)*rad,zz=Math.sin(a)*rad;
  const n=V(xx/rx,y1/ry,zz/rz).normalize(),root=surface(xx,y1,zz),u=((Math.atan2(zz,-xx)/(2*Math.PI))%1+1)%1,v=1-Math.acos(y1)/Math.PI;
  let flow=type==='head'?V(xx*.95,-.63+.7*y1,-.26):V(xx*.32,-.76,-.49);
  flow.addScaledVector(n,-flow.dot(n)).normalize();
  let len=(.014+rand()*.017)*(type==='head'&&Math.abs(xx)>.67?1.32:1),width=.0027+rand()*.0028;
  const side=V().crossVectors(n,flow).multiplyScalar(width),tip=root.clone().addScaledVector(n,len*.45).addScaledVector(flow,len);
  for(const pt of [root.clone().add(side),root.clone().sub(side),tip]){p.push(...pt.toArray());norm.push(n.x,n.y,n.z);uv.push(u,v)}
 }
 const hair=new T.BufferGeometry();hair.setAttribute('position',new T.Float32BufferAttribute(p,3));hair.setAttribute('normal',new T.Float32BufferAttribute(norm,3));hair.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
 const fibers=mesh(g,hair,fur[type]);fibers.castShadow=false;
 return g
}
const body=furry(torso,.15,.85,-.24,.60,.89,.76,'body',14000,'haunch');body.rotation.x=-.23;body.rotation.z=-.12;
const rump=furry(torso,.39,.48,-.47,.49,.49,.62,'body',7000,'haunch');
const rearPaw=furry(cat,.54,.145,-.055,.252,.15,.39,'leg',2500,'paw');
const chest=furry(torso,-.015,.86,.22,.44,.72,.46,'body',8500);chest.rotation.x=-.13;
const forelegs=[],paws=[];
for(let side of [-1,1]){
 const g=group(cat);g.position.set(side*.278,.0,.44+(side===1?-.04:.04));forelegs.push(g);
 const leg=furry(g,0,.49,0,.167,.45,.176,'leg',4000);leg.rotation.x=-.105;
 const paw=furry(g,0,.14,.135,.194,.147,.253,'white',4000,'paw');paws.push(paw)
}
headNeck.position.set(-.022,1.59,.36);head.rotation.x=-.13;
furry(head,0,0,0,.686,.614,.555,'head',26000,'face');
const chin=furry(head,0,-.323,.349,.232,.131,.20,'white',1600);
const pads=[];
for(let s of [-1,1])pads.push(furry(head,.136*s,-.207,.454,.204,.143,.156,'white',2500));
function earShape(s){
 const ear=group(head);ear.position.set(s*.405,.349,-.037);ear.rotation.z=-s*.12;
 const ps=[],cs=[],ix=[],layers=18,n=48;
 const tip=V(s*.135,.533,-.022),left=V(-.277,-.068,.016),right=V(.277,-.068,.016);
 // Rounded triangular pinna. The raised cream rim curls in front of the pink hollow.
 const corners=[left,right,tip],contour=[];
 for(let j=0;j<3;j++){let a=corners[j],b=corners[(j+1)%3],d=corners[(j+2)%3];
 for(let k=0;k<16;k++){
 let t=k/16,pt;
 if(t<.16){let q=t/.16,pre=a.clone().lerp(d,.065),post=a.clone().lerp(b,.065);pt=pre.multiplyScalar((1-q)**2).addScaledVector(a,2*q*(1-q)).addScaledVector(post,q*q)}
 else pt=a.clone().lerp(b,mix(.065,.935,(t-.16)/.84));
 contour.push(pt)
 }}
 const center=V(s*.025,.142,.09),col=new T.Color();
 for(let j=0;j<=layers;j++){let r=j/layers;
 for(let k=0;k<=n;k++){let o=contour[k%n],pt=center.clone().lerp(o,r);
 pt.z+=.098*Math.exp(-Math.pow((r-.78)/.14,2))-.092*r*r-.045*(1-r);
 ps.push(...pt.toArray());
 const darken=smooth((pt.y-.32)/.18)*.22;
 const cc=new T.Color(0xd79a8b).lerp(new T.Color(0xeec0a8),smooth(r/.72)).lerp(new T.Color(0xf1d4ac),smooth((r-.58)/.21)).lerp(new T.Color(0xc9874a),smooth((r-.82)/.14));col.copy(cc).multiplyScalar(1-darken);cs.push(col.r,col.g,col.b);
 if(j<layers&&k<n){let a=j*(n+1)+k;ix.push(a,a+n+1,a+1,a+1,a+n+1,a+n+2)}
 }}
 let back=ps.length/3;ps.push(center.x,center.y,-.151);col.setHex(0xbd8149);cs.push(col.r,col.g,col.b);
 for(let k=0;k<n;k++)ix.push(back,layers*(n+1)+k+1,layers*(n+1)+k);
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(ps,3));geo.setAttribute('color',new T.Float32BufferAttribute(cs,3));geo.setIndex(ix);geo.computeVertexNormals();mesh(ear,geo,mat(0xffffff,.94,{vertexColors:true,side:T.DoubleSide}));
 const tuft=[],tcol=new T.Color(0xf2dfbc);
 for(let i=0;i<350;i++){const o=contour[Math.floor(rand()*n)],r=.69+rand()*.28,p=center.clone().lerp(o,r);p.z+=.098*bell(r-.78,.14)-.092*r*r;
 let l=.018+rand()*.072;tuft.push(p.x-.002,p.y,p.z,p.x+.002,p.y,p.z,p.x-s*.31*l,p.y+l,p.z+.018)}
 const hg=new T.BufferGeometry();hg.setAttribute('position',new T.Float32BufferAttribute(tuft,3));hg.computeVertexNormals();const hair=mesh(ear,hg,mat(tcol,.95,{side:T.DoubleSide}));hair.castShadow=false;
 return ear
}
const ears=[earShape(-1),earShape(1)];
const irisMap=texture(256,256,(c,w,h)=>{
 const im=c.createImageData(w,h),d=im.data;
 for(let j=0;j<h;j++)for(let i=0;i<w;i++){
 const x=(i-128)/104,y=(j-128)/132,r=Math.hypot(x,y),a=Math.atan2(y,x);
 const line=Math.sin(a*79+2*Math.sin(a*19)+r*10)*.5+.5,edge=smooth((r-.71)/.31),pupil=1-smooth((Math.hypot(x/.365,y/.922)-.96)/.09);
 const base=[164+24*line,155+22*line,89+18*line],dark=[46,59,47],idx=(j*w+i)*4;
 for(let k=0;k<3;k++)d[idx+k]=mix(mix(base[k]+12*y,dark[k],edge),[23,25,23][k],pupil)+rand()*2;d[idx+3]=255
 }c.putImageData(im,0,0);
});
const eyelid=mat(0x554538,.78),catchlight=new T.MeshBasicMaterial({color:0xfff9e9}),eyes=[];
function eye(s){
 const eye=group(head);eye.position.set(s*.282,.081,.491);eye.rotation.y=s*.365;eye.rotation.x=-.085;eye.rotation.z=s*.092;
 const opening=group(eye),ps=[],uv=[],ix=[],n=56,layers=14;
 const material=mat(0xffffff,.28,{map:irisMap.clone(),envMapIntensity:.28});material.map.needsUpdate=true;
 const rim=[];
 for(let j=0;j<=layers;j++){let r=j/layers;
 for(let i=0;i<=n;i++){
 const a=i/n*Math.PI*2,cs=Math.cos(a),sn=Math.sin(a),x=r*cs*.185,y=r*sn*(sn>0?.144:.131)*(.89+.11*Math.abs(sn)),z=.076*(1-r*r)-.009*r;
 ps.push(x,y,z);uv.push(.5+x/.37,.5+y/.285);
 if(j===layers)rim.push(V(x,y,z-.001));
 if(j<layers&&i<n){let k=j*(n+1)+i;ix.push(k,k+n+1,k+1,k+1,k+n+1,k+n+2)}
 }}
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(ps,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(ix);geo.computeVertexNormals();
 mesh(opening,geo,material);tube(opening,rim,.012,eyelid,60,7);tube(opening,rim.slice(0,29),.016,eyelid,35,7);
 ball(opening,-.045,.051,.067,.026,.019,.005,catchlight).rotation.z=.24;
 ball(opening,-.016,.066,.062,.009,.009,.004,catchlight);
 eyes.push({opening,material});return eye
}
eye(-1);eye(1);
const noseMat=mat(0xc78678,.34),nostril=mat(0x86574d,.78);
const noseForm=new T.Shape();noseForm.moveTo(-.104,.018);noseForm.bezierCurveTo(-.113,.056,-.062,.061,0,.049);noseForm.bezierCurveTo(.064,.061,.111,.055,.103,.021);noseForm.bezierCurveTo(.088,-.007,.029,-.040,.012,-.048);noseForm.quadraticCurveTo(0,-.060,-.019,-.043);noseForm.quadraticCurveTo(-.080,-.001,-.104,.018);
const nose=mesh(head,new T.ExtrudeGeometry(noseForm,{depth:.032,bevelEnabled:true,bevelThickness:.018,bevelSize:.012,bevelSegments:4,curveSegments:20}),noseMat,0,-.139,.584);
for(const s of [-1,1]){let m=ball(head,s*.073,-.122,.627,.017,.009,.006,nostril);m.rotation.z=-s*.35}
const lipMat=mat(0x947b68,.84);
tube(head,[[0,-.182,.598],[0,-.214,.58],[.003,-.252,.557]],.0063,lipMat,10,5);
const tongue=ball(head,.026,-.277,.576,.062,.073,.029,mat(0xcf9286,.43));tongue.visible=false;
const whiskers=group(head),whiskMat=mat(0xf5efdf,.53,{transparent:true,opacity:.87});
for(let s of [-1,1]){
 for(let j=0;j<12;j++){const x=s*(.123+(j%4)*.039),y=-.181-Math.floor(j/4)*.031,z=.455+.154*Math.sqrt(Math.max(0,1-((x-s*.136)/.204)**2-((y+.207)/.143)**2));ball(head,x,y,z,.008,.006,.004,mat(0xb4a086,.95))}
 for(let j=0;j<11;j++){
 const y=-.16-.09*rand(),x=.18+rand()*.072,z=.57-.024*rand(),l=.46+.21*rand(),lift=(j-5)*.029;
 const points=[V(s*x,y,z),V(s*(x+l*.3),y+.034+lift*.33,z+.035),V(s*(x+l*.7),y+.044+lift*.76,z+.047),V(s*(x+l),y+lift-.024,z+.003)];
 tube(whiskers,points,.0036*(1-rand()*.3),whiskMat,16,4).castShadow=false
 }
 for(let j=0;j<3;j++)tube(head,[[s*(.28+j*.04),.226,.44],[s*(.34+j*.05),.335,.446],[s*(.41+j*.065),.398+j*.017,.412]],.0028,whiskMat,12,4).castShadow=false
}
const tail=group(cat);
function makeTail(){
 const path=new T.CatmullRomCurve3([V(.39,.43,-.8),V(.83,.30,-.75),V(1.05,.175,-.46),V(1.08,.137,-.06),V(.94,.133,.27),V(.70,.153,.40)]);
 const seg=64,n=24,frames=path.computeFrenetFrames(seg,false),p=[],colors=[],ix=[];
 for(let i=0;i<=seg;i++){let t=i/seg,at=path.getPointAt(t),r=(.144+.035*Math.sin(t*Math.PI))*(t<.87?1:Math.sqrt(Math.max(.0004,1-((t-.87)/.13)**2)));
 for(let j=0;j<=n;j++){let a=j/n*Math.PI*2;const pt=at.clone().addScaledVector(frames.normals[i],r*Math.cos(a)).addScaledVector(frames.binormals[i],r*Math.sin(a));p.push(...pt.toArray());
 let band=Math.pow(.5+.5*Math.cos(t*41+.44*Math.sin(a)),2.9);
 let color=new T.Color(0xcd9259).lerp(new T.Color(0x815b41),.83*band+.14*t);colors.push(color.r,color.g,color.b);
 if(i<seg&&j<n){let k=i*(n+1)+j;ix.push(k,k+1,k+n+1,k+1,k+n+2,k+n+1)}
 }}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setIndex(ix);g.computeVertexNormals();mesh(tail,g,mat(0xffffff,.93,{vertexColors:true,side:T.DoubleSide}))
}
makeTail();
contact(cat,.14,.006,-.12,1.97,2.20,.78);
for(let s of [-1,1])contact(cat,s*.278,.009,.58,.55,.75,.85);
