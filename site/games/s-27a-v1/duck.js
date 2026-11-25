'use strict';
// A section gives the longitudinal position, vertical centre, height and half-width.
function loft(sections,n=58,sides=50){
 const curve=new T.CatmullRomCurve3(sections.map(s=>v(s[0],s[1],s[2])),false,'centripetal');
 const widths=new T.CatmullRomCurve3(sections.map(s=>v(s[0],s[3],0)),false,'centripetal');
 let p=[],uv=[],idx=[];
 for(let j=0;j<=n;j++){let t=j/n,q=curve.getPoint(t),w=Math.max(.001,widths.getPoint(t).y);
 for(let i=0;i<=sides;i++){let a=i/sides*tau;
 p.push(q.x,q.y+Math.max(.001,q.z)*Math.sin(a),w*Math.cos(a));uv.push(t,i/sides);
 if(j&&i){let b=j*(sides+1)+i;idx.push(b-sides-2,b-1,b,b-sides-2,b,b-sides-1)}}}
 let g=geo(p,idx,null,uv);return g;
}
function plumage(c){
 let m=std(c,.84);m.onBeforeCompile=s=>{
 s.vertexShader='varying vec3 fp;\n'+s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nfp=position;');
 s.fragmentShader='varying vec3 fp;\n'+shaderNoise+s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
 vec2 p=vec2(fp.x+fp.y*.23,fp.y+fp.z*.67);float fl=pondNoise(p*vec2(73.,179.));float fil=pondNoise(p*vec2(22.,240.)+vec2(0.,sin(p.x*32.)*1.2));
 diffuseColor.rgb*=.935+.055*fil+.043*fl;
 `)};m.customProgramCacheKey=()=>'fine-down';return m;
}
const down=plumage(0xfff5e3),cream=plumage(0xf9f0e1),sideDown=plumage(0xece6da);
const duck=group(), duckBody=group(duck);duck.position.set(-.49,0,-.14);
function duckPart(g,m,parent){let o=mesh(g,m,parent);o.castShadow=true;o.receiveShadow=true;return o}
const torso=duckPart(loft([[-1.04,.37,.004,.004],[-.91,.30,.10,.141],[-.72,.24,.206,.288],[-.49,.20,.31,.395],[-.18,.19,.367,.449],[.14,.195,.385,.445],[.4,.24,.37,.37],[.57,.31,.288,.278],[.65,.34,.16,.16],[.69,.34,.005,.005]]),down,duckBody);
const neck=ell(duckBody,down,.365,.45,0,.301,.33,.295);neck.castShadow=true;
const headPivot=group(duckBody);headPivot.position.set(.36,.45,0);
const head=group(headPivot);head.position.set(.065,.265,0);
duckPart(loft([[-.343,.012,.004,.004],[-.304,.016,.174,.179],[-.21,.018,.275,.273],[-.055,.025,.337,.326],[.108,.017,.318,.303],[.232,-.014,.25,.238],[.31,-.047,.147,.163],[.332,-.052,.014,.017]],52,48),down,head);
const billTop=std(0xe6a350,.42),billBase=std(0xe8a45b,.45),gape=std(0x995d39,.58),billLower=std(0xd39453,.43),nail=std(0xe3b579,.4);
const bill=group(head);bill.position.set(.235,-.082,0);
const lowerJaw=group(bill);
duckPart(loft([[-.045,-.016,.006,.035],[.01,-.023,.046,.135],[.104,-.033,.041,.128],[.201,-.047,.031,.136],[.284,-.044,.019,.094],[.318,-.034,.003,.006]],28,30),billLower,lowerJaw);
duckPart(loft([[-.036,.003,.004,.01],[.015,-.002,.036,.142],[.116,-.012,.025,.139],[.226,-.024,.019,.143],[.291,-.023,.011,.09],[.327,-.022,.002,.004]],28,30),gape,bill);
duckPart(loft([[-.057,.014,.011,.038],[.002,.027,.069,.151],[.068,.026,.068,.143],[.145,.006,.046,.141],[.235,-.004,.035,.147],[.294,-.008,.024,.095],[.328,-.013,.004,.008]],34,36),billTop,bill);
ell(bill,nail,.293,.006,0,.038,.017,.051);
const eyeBlack=std(0x1b1814,.12,{metalness:.10}),iris=std(0x514533,.30),eyeSkin=std(0xc7ad8d,.68),nostril=std(0x6f5133,.70),spark=new T.MeshBasicMaterial({color:0xffffed});
let eyes=[], wings=[],feet=[];
for(let side of [-1,1]){
 let eye=group(head);eye.position.set(.117,.076,side*.277);eye.rotation.y=.36*side;eye.rotation.x=-.14*side;eyes.push(eye);
 ell(eye,eyeSkin,0,0,0,.062,.06,.024);
 ell(eye,iris,.001,.001,.013*side,.054,.055,.022);
 ell(eye,eyeBlack,.004,.003,.021*side,.046,.047,.022);
 ell(eye,spark,.016,.020,.039*side,.010,.010,.0038);
 ell(eye,new T.MeshBasicMaterial({color:0xaccbca}),-.014,-.013,.040*side,.005,.004,.002);
 let pore=ell(bill,nostril,.085,.073,.074*side,.028,.0055,.012);pore.rotation.x=side*-.48;pore.rotation.z=-.16;
}
const featherColors=[0xf8f0e2,0xf3eadc,0xfdf3e4,0xf7f0e5,0xf0e7da].map(plumage);
// Domed, tapering vanes lie tangent to the curve of each folded wing.
function feather(parent,start,end,width,rise,side,mat){
 let p=[],idx=[],colors=[];for(let j=0;j<=18;j++){let t=j/18,env=Math.pow(Math.max(.001,Math.sin(Math.PI*t)),.72)*(.77+.23*t);
 for(let k=0;k<=8;k++){let u=k/4-1,arch=1-u*u,xx=mix(start.x,end.x,t),yy=mix(start.y,end.y,t)+Math.sin(t*Math.PI)*.026+width*env*u;
 let zz=mix(start.z,end.z,t)+side*(rise*env*arch-.008*u*u+.013*Math.sin(Math.PI*t));
 p.push(xx,yy,zz);let sh=.956+.044*arch+.008*Math.sin((t*18+Math.abs(u)*.7)*Math.PI);colors.push(sh,sh,sh);
 if(j&&k){let b=j*9+k;if(side>0)idx.push(b-10,b,b-1,b-10,b-9,b);else idx.push(b-10,b-1,b,b-10,b,b-9)}}}
 let m=mat.clone();m.vertexColors=true;m.side=T.DoubleSide;return duckPart(geo(p,idx,colors),m,parent);
}
for(let s of [-1,1]){
 let wing=group(duckBody);wings.push(wing);
 // The mantle rises from the flank and thins into the flight feathers at the tail.
 const cover=duckPart(loft([[-.91,.306,.002,.001],[-.76,.31,.089,.071],[-.53,.308,.151,.102],[-.23,.309,.202,.127],[.04,.303,.197,.113],[.22,.326,.129,.07],[.276,.333,.004,.002]],47,36),sideDown,wing);
 cover.position.set(-.003,.009,s*.254);cover.rotation.y=.099*s;
 for(let j=0;j<7;j++){let y=.19+j*.036,xx=-.78-.02*j;
 feather(wing,v(xx,y+.035,s*(.241-.012*j)),v(-.12+j*.025,y+.042,s*(.435-.005*j)),.027+.006*(j/6),.018,s,featherColors[j%5])}
 for(let j=0;j<8;j++){let t=j/7;let x=-.61+t*.67;
 let surf=.277+.134*Math.sin(.2+t*2.35);
 feather(wing,v(x-.15,.30+.075*t,s*(surf-.033)),v(x+.13,.414+.049*Math.sin(t*2.7),s*(surf-.023)),.042,.032,s,featherColors[(j+2)%5])}
 // A small curled layer on the upper wing catches the warm rim light.
 feather(wing,v(-.71,.41,s*.183),v(.17,.433,s*.294),.056,.047,s,cream);
}
const legMat=std(0xdd8436,.57),webMat=std(0xe39a45,.50),toeMat=std(0xc87c39,.54);
for(let s of [-1,1]){
 let leg=group(duckBody);leg.position.set(-.11,-.034,s*.189);feet.push(leg);
 tube(leg,[v(0,0,0),v(-.036,-.10,0),v(-.014,-.215,s*.03)],.025,legMat);
 const ankle=v(-.014,-.215,s*.03);
 let outline=[v(.17,-.236,-.087),v(.12,-.238,-.036),v(.209,-.24,.007),v(.13,-.236,.049),v(.169,-.235,.11)];
 let pp=[ankle.x,ankle.y,ankle.z],ids=[];
 outline.forEach((q,i)=>{q.z+=s*.03;pp.push(q.x,q.y,q.z);if(i)ids.push(0,i,i+1)});
 let mm=webMat.clone();mm.side=T.DoubleSide;duckPart(geo(pp,ids),mm,leg);
 for(let k of [0,2,4])tube(leg,[ankle,ankle.clone().lerp(outline[k],.54).add(v(0,.004,0)),outline[k]],.009,toeMat,8);
}
duck.rotation.y=-.42;
