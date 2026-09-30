import * as THREE from 'three';
type Material=(color:number,extra?:Partial<THREE.MeshStandardMaterialParameters>)=>THREE.MeshStandardMaterial;

// Shared curved-eave construction, rather than treating every Chinese roof as a cone.
export function eaveGeometry(width:number,round=false){
  const rings=[[.05,.34],[.26,.28],[.52,.18],[.77,.08],[1,.03],[1.06,.09]],count=round?64:40;
  const vertices:number[]=[],indices:number[]=[];
  rings.forEach(([r,h])=>{for(let i=0;i<=count;i++){
    const a=i/count*Math.PI*2,c=Math.cos(a),s=Math.sin(a),square=round?1:1/Math.max(Math.abs(c),Math.abs(s));
    vertices.push(c*r*width*.55*square,h+(round?0:Math.abs(Math.sin(a*2))*.07*r**3),s*r*width*.55*square);
  }});
  for(let j=0;j<rings.length-1;j++)for(let i=0;i<count;i++){const k=j*(count+1)+i;indices.push(k,k+count+1,k+1,k+1,k+count+1,k+count+2);}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setIndex(indices);geo.computeVertexNormals();return geo;
}

export function refineLandmark(id:string,parent:THREE.Group,material:Material,crafted:boolean){
  const bronze=material(0xb89759,{metalness:.55,roughness:.4}),stone=material(0xe4dcca),steel=material(0xbdcdd0,{metalness:.6,roughness:.35}),red=material(0xb23f34),dark=material(0x263c45),blue=material(0x7baab5,{metalness:.4,roughness:.3});
  const light=material(0xf3d698,{emissive:0xe8ae56,emissiveIntensity:.05});light.userData.nightLight=true;
  const mesh=(g:THREE.BufferGeometry,m:THREE.Material,x:number,y:number,z:number)=>{const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;parent.add(o);return o;};
  const box=(w:number,h:number,d:number,m:THREE.Material,x:number,y:number,z:number)=>mesh(new THREE.BoxGeometry(w,h,d),m,x,y,z);
  const ring=(r:number,t:number,m:THREE.Material,x:number,y:number,z:number)=>{const o=mesh(new THREE.TorusGeometry(r,t,6,48),m,x,y,z);o.rotation.x=Math.PI/2;return o;};
  const rod=(a:THREE.Vector3,b:THREE.Vector3,r:number,m:THREE.Material)=>{const v=b.clone().sub(a),o=mesh(new THREE.CylinderGeometry(r,r,v.length(),6),m,0,0,0);o.position.copy(a.clone().add(b).multiplyScalar(.5));o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());};
  const fence=(radius:number,y:number,centerX=-.2,centerZ=-.3)=>{ring(radius,.017,stone,centerX,y+.16,centerZ);for(let i=0;i<24;i++){const a=i*Math.PI/12;box(.035,.17,.035,stone,centerX+Math.cos(a)*radius,y+.08,centerZ+Math.sin(a)*radius);}};
  // Basic architectural identifiers ship in every edition.
  if(id==='beijing'){
    for(let i=0;i<3;i++)fence(1.09-i*.16,.64+i*.13);
    for(let i=0;i<12;i++){const a=i*Math.PI/6;box(.055,.34,.055,red,-.2+Math.cos(a)*.68,1.12,-.3+Math.sin(a)*.68);}
    box(.54,.08,.9,stone,-.2,.59,.95);
  }else if(id==='xian'){
    // Arched entry, seven distinct brick-storey ledges and a courtyard.
    const arch=mesh(new THREE.TorusGeometry(.14,.035,5,20,Math.PI),dark,-.2,.79,.493);arch.scale.y=1.4;
    box(.23,.22,.03,dark,-.2,.64,.492);box(1.9,.07,1.9,stone,-.2,.57,-.3);
    for(let i=0;i<7;i++)for(const side of [-1,1])box(.05,.28,.05,bronze,-.2+side*(.74-i*.07),.77+i*.45,.47-i*.07);
  }else if(id==='wuhan'){
    for(let i=0;i<5;i++){const y=1.04+i*.48;for(const x of [-1,-.25,.5])box(.045,.26,.045,red,x,y,.22);box(1.8-i*.17,.045,.05,bronze,-.25,y+.09,.36);}
    box(.68,.1,.5,stone,-.25,.58,.83);
  }else if(id==='hangzhou'){
    for(let level=0;level<5;level++){const y=.99+level*.54,r=.68-level*.065;fence(r+.09,y-.12,-.25,-.25);ring(r+.12,.027,bronze,-.25,y+.23,-.25);}
  }else if(id==='chengdu'){
    // Three bridge spans and piers distinguish the bridge from a generic temple.
    for(const x of [-1.05,-.25,.55]){const a=mesh(new THREE.TorusGeometry(.35,.075,6,24,Math.PI),stone,x,.63,.25);a.scale.y=.75;}
    for(const x of [-1.4,-.65,.15,.9])box(.12,.37,1.28,stone,x,.73,-.3);
    for(const z of [-.88,.28]){box(2.6,.035,.045,bronze,-.25,1.21,z);for(let i=0;i<15;i++)box(.025,.14,.025,bronze,-1.49+i*.177,1.15,z);}
  }else if(id==='chongqing'){
    // Layered cliff terraces, rather than a single generic pagoda block.
    const cliff=material(0x86847a);for(let i=0;i<3;i++)box(.4,1.15-i*.19,.78,cliff,1.05-i*.1,1.06-i*.08,-.65-i*.15);
    for(let i=0;i<10;i++)box(.24,.07,.26,stone,1.05,.6+i*.12,.62-i*.075);
  }else if(id==='tianjin'){
    box(3.35,.07,.86,steel,-.25,.67,.1);for(const z of [-.32,.52])box(3.35,.12,.025,red,-.25,.72,z);
    mesh(new THREE.CylinderGeometry(.10,.14,.17,16),red,-.25,2.25,-.22).rotation.x=Math.PI/2;
  }else if(id==='suzhou'){
    // Broad mirrored gateway and curved inner shoulders.
    box(2.12,.14,1.13,stone,-.23,.62,-.3);
    for(const x of [-.96,.5]){box(.09,2.55,.9,steel,x+(x<0?-.3:.3),1.91,-.3);box(.065,2.55,.87,steel,x+(x<0?.27:-.27),1.91,-.3);}
  }else if(id==='zhengzhou'){
    for(let i=0;i<4;i++){const a=i*Math.PI/2;rod(new THREE.Vector3(-.22+Math.cos(a)*.73,.6,-.3+Math.sin(a)*.73),new THREE.Vector3(-.22+Math.cos(a+.8)*.2,3.12,-.3+Math.sin(a+.8)*.2),.055,red);}
    ring(.48,.07,steel,-.22,3.12,-.3);ring(.4,.04,bronze,-.22,3.45,-.3);
  }else if(id==='shenzhen'){
    // Faceted taper and pale articulated crown.
    for(let i=0;i<8;i++){const a=i*Math.PI/4;rod(new THREE.Vector3(-.25+Math.cos(a)*.7,.6,-.3+Math.sin(a)*.7),new THREE.Vector3(-.25+Math.cos(a)*.21,3.95,-.3+Math.sin(a)*.21),.02,steel);}
    box(1.5,.12,1.35,stone,-.25,.61,-.3);
  }else if(id==='nanjing'){
    box(.4,1.65,.75,blue,-.91,1.46,-.3);box(.17,.8,.38,steel,.17,3.71,-.3);
    for(let y=.8;y<3.4;y+=.26)box(.05,.025,.52,steel,-.12,y,-.3);
  }else if(id==='changsha'){
    box(1.85,.38,1.42,stone,-.22,.76,-.35);
    for(const [x,z,h,w] of [[-.8,-.2,3.65,.53],[.47,-.5,2.9,.49]]){box(w*.92,.07,w*.92,steel,x,h+.56,z);for(const dx of [-1,1])box(.035,h,.035,steel,x+dx*w*.58,.54+h/2,z+w*.58);}
  }else if(id==='xiamen'){
    for(const x of [-.9,.45]){rod(new THREE.Vector3(x-.48,.58,-.19),new THREE.Vector3(x-.29,3.82,-.19),.027,steel);rod(new THREE.Vector3(x+.45,.58,-.19),new THREE.Vector3(x-.29,3.82,-.19),.027,steel);}
    box(2.5,.10,1.2,stone,-.22,.59,-.3);
  }else if(id==='shanghai'){
    for(const [y,r] of [[1.55,.6],[3.2,.41]])for(const off of [-.12,.12])ring(Math.sqrt(r*r-off*off),.018,steel,-.2,y+off,-.25);
    box(1.8,.09,1.35,stone,-.2,.58,-.25);
  }else if(id==='guangzhou'){
    ring(.67,.04,bronze,-.2,.59,-.2);ring(.5,.035,light,-.2,4.15,-.2);
    box(.4,.09,.65,stone,-.2,.6,.95);
  }else if(id==='qingdao'){
    ring(.84,.035,steel,-.22,.72,-.3);box(1.8,.06,1.5,stone,-.22,.57,-.3);
  }
  if(!crafted)return;
  // City-specific small scenery and architectural finishes form the premium layer.
  const accents:Record<string,number>={beijing:0x587e9a,qingdao:0xb94336,guangzhou:0x8b62af,shanghai:0xb66b68,xiamen:0x608eaa,chongqing:0xb88546};
  const accent=material(accents[id]||0x658d78,{roughness:.5});
  for(let i=0;i<5;i++){const x=-1.35+i*.57;box(.12,.025,.4,stone,x,.578,1.01);mesh(new THREE.CylinderGeometry(.013,.022,.25,8),steel,x,.67,1.32);mesh(new THREE.SphereGeometry(.055,8,6),light,x,.815,1.32);}
  if(['beijing','wuhan','hangzhou','chengdu','xian','chongqing'].includes(id)){
    const z=id==='beijing'?.35:id==='chengdu'?.29:.42;
    for(let i=0;i<8;i++){const x=-1.13+i*.25;box(.015,.13,.015,bronze,x,1.31,z);box(.09,.11,.04,light,x,1.17,z);}
    if(id==='xian')for(let row=0;row<8;row++)for(let i=0;i<6;i++)box(.16,.008,.008,bronze,-.69+i*.2+(row%2)*.08,.64+row*.105,.492);
  }else if(id==='tianjin'){
    const r=1.4;for(let i=0;i<16;i++){const a=i*Math.PI/8;box(.11,.10,.025,light,-.25+Math.cos(a)*r,2.25+Math.sin(a)*r,-.115);}
  }else if(id==='guangzhou'){
    for(let i=0;i<8;i++){const a=i*Math.PI/4;mesh(new THREE.SphereGeometry(.045,8,6),light,-.2+Math.cos(a)*.38,4.18,-.2+Math.sin(a)*.38);}
  }else if(id==='shanghai'){
    for(let i=0;i<14;i++){const a=i*Math.PI/7;mesh(new THREE.SphereGeometry(.022,6,4),light,-.2+Math.cos(a)*.54,1.55,-.25+Math.sin(a)*.54);}
  }else if(id==='qingdao'){
    // A small waterfront promenade and sail echo the coastal setting.
    box(.72,.025,.48,blue,1.05,.575,.4);
    rod(new THREE.Vector3(1.05,.59,.42),new THREE.Vector3(1.05,1.2,.42),.014,steel);
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([1.03,.67,.42,1.03,1.15,.42,.73,.69,.42],3));g.computeVertexNormals();mesh(g,material(0xf0e7d4,{side:THREE.DoubleSide}),0,0,0);
  }
  // Fine architectural detailing, grouped by building rather than repeated props.
  if(['wuhan','chengdu','chongqing'].includes(id)){
    const levels=id==='wuhan'?5:id==='chengdu'?1:4;
    for(let level=0;level<levels;level++){
      const y=id==='wuhan'?1.13+level*.48:id==='chengdu'?1.51:1.06+level*.48;
      const width=id==='wuhan'?2.1*(1-level*.12):id==='chengdu'?2.9:2.65-level*.2;
      for(let i=0;i<28;i++){const x=-.25-width*.5+i*width/27;
        box(.017,.075,.26,bronze,x,y,.31);box(.022,.03,.42,red,x,y-.10,.32);
        if(i%3===0){box(.06,.075,.035,bronze,x,y-.13,.44);box(.095,.023,.1,bronze,x,y-.16,.42);}
      }
      for(const side of [-1,1]){box(.045,.12,1.08,red,-.25+side*width*.43,y-.18,-.25);}
    }
  }
  if(id==='xian'){
    for(let floor=0;floor<7;floor++){
      const w=1.55-floor*.14,y=.54+floor*.45;
      for(const side of [-1,1])for(let row=0;row<4;row++){
        box(w,.006,.007,bronze,-.2,y+.07+row*.086,-.3+side*(w*.5+.004));
        for(let col=0;col<7;col++)box(.005,.077,.008,bronze,-.2-w*.46+(col+(row%2)*.5)*w/7,y+.1+row*.086,-.3+side*(w*.5+.005));
      }
      for(const side of [-1,1]){box(.012,.24,.15,dark,-.2+side*(w*.5+.005),y+.22,-.3);const a=mesh(new THREE.TorusGeometry(.08,.015,5,16,Math.PI),bronze,-.2,y+.285,-.3+w*.5+.019);a.scale.y=1.35;}
    }
  }
  if(id==='hangzhou'){
    for(let level=0;level<5;level++){const r=.66-level*.065,y=.99+level*.54;
      for(let side=0;side<8;side++){const a=side*Math.PI/4;const panel=box(.22,.2,.02,dark,-.25+Math.cos(a)*(r+.01),y,-.25+Math.sin(a)*(r+.01));panel.rotation.y=Math.PI/2-a;
        for(let j=-1;j<=1;j++){const tangent=j*.065;const bar=box(.012,.21,.023,bronze,-.25+Math.cos(a)*(r+.025)-Math.sin(a)*tangent,y,-.25+Math.sin(a)*(r+.025)+Math.cos(a)*tangent);bar.rotation.y=Math.PI/2-a;}
      }
    }
  }
  if(id==='tianjin'){
    const outer=mesh(new THREE.TorusGeometry(1.34,.017,6,96),steel,-.25,2.25,-.12);outer.rotation.z=.02;
    for(let i=0;i<16;i++){const a=i*Math.PI/8,x=-.25+Math.cos(a)*1.4,y=2.25+Math.sin(a)*1.4;
      box(.22,.028,.23,steel,x,y+.13,-.25);box(.21,.028,.23,steel,x,y-.13,-.25);box(.014,.2,.015,steel,x-.09,y,-.13);box(.014,.2,.015,steel,x+.09,y,-.13);
      rod(new THREE.Vector3(-.25,2.25,-.12),new THREE.Vector3(-.25+Math.cos(a+.09)*1.34,2.25+Math.sin(a+.09)*1.34,-.12),.006,steel);
    }
    for(let i=0;i<25;i++){box(.05,.13,.024,steel,-1.88+i*.135,.77,.54);box(.028,.1,.15,stone,-1.88+i*.135,.59,-.02);}
  }
  if(id==='shanghai'){
    for(const [cy,r] of [[1.55,.595],[3.2,.405]]){
      for(let lat=-2;lat<=2;lat++)ring(Math.sqrt(r*r-(lat*r/3)**2),.006,steel,-.2,cy+lat*r/3,-.25);
      for(let meridian=0;meridian<12;meridian++){const points=Array.from({length:17},(_,j)=>{const a=j/16*Math.PI,b=meridian*Math.PI/6;return new THREE.Vector3(-.2+Math.sin(a)*Math.cos(b)*r,cy+Math.cos(a)*r,-.25+Math.sin(a)*Math.sin(b)*r);});mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),24,.005,3,false),steel,0,0,0);}
    }
    for(let i=0;i<5;i++)ring(.13-i*.015,.01,bronze,-.2,4.15+i*.12,-.25);
  }
  if(id==='guangzhou'){
    for(let j=0;j<24;j++){const t=j/24,r=.22+.46*Math.pow(Math.abs(t-.53)*2,1.4);ring(r,.008,steel,-.2,.55+t*3.72,-.2);}
    for(let i=0;i<12;i++){const pts=Array.from({length:28},(_,j)=>{const t=j/27,a=i*Math.PI/6-t*1.7,r=.22+.46*Math.pow(Math.abs(t-.53)*2,1.4);return new THREE.Vector3(-.2+Math.cos(a)*r,.55+t*3.72,-.2+Math.sin(a)*r);});mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),36,.009,4,false),bronze,0,0,0);}
    for(const y of [3.87,4.05,4.19])ring(.43,.024,light,-.2,y,-.2);
  }
  if(id==='zhengzhou'){
    for(const y of [3.08,3.24,3.45])ring(.43,.018,steel,-.22,y,-.3);
    for(let i=0;i<24;i++){const a=i*Math.PI/12;box(.015,.24,.015,bronze,-.22+Math.cos(a)*.42,3.29,-.3+Math.sin(a)*.42);}
    for(let i=0;i<4;i++){const points=Array.from({length:21},(_,j)=>{const t=j/20,a=i*Math.PI/2+t*.8,r=.73-t*.53;return new THREE.Vector3(-.22+Math.cos(a)*r,.6+t*2.52,-.3+Math.sin(a)*r);});mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),36,.023,6,false),steel,0,0,0);}
  }
  if(id==='qingdao'){
    const layers=[[.66,1.3],[.85,1.54],[1.08,1.81],[1.39,2.12],[1.30,2.4],[1.1,2.66],[.84,2.91],[.55,3.16]];
    const edge=material(0xe74835,{metalness:.25,roughness:.38});
    layers.forEach(([radius,y],i)=>{const level=i+2,start=level*.57+.45;const pts=Array.from({length:65},(_,j)=>{const t=j/64,a=start+Math.PI*1.84*t;return new THREE.Vector3(-.22+Math.cos(a)*(radius-.006),y+t*.115+.075,-.3+Math.sin(a)*(radius-.006));});mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),72,.009,4,false),edge,0,0,0);});
    for(let i=0;i<12;i++){const a=i*Math.PI/6;box(.07,.007,.024,steel,-.22+Math.cos(a)*.75,.724,-.3+Math.sin(a)*.75).rotation.y=-a;}
  }
  // A recognisable city-colour inlay replaces a generic repeated secondary block.
  for(let i=0;i<4;i++)box(.21,.016,.16,accent,-1.47+i*.25,.581,.63);
}
