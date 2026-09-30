import * as THREE from 'three';
import {eaveGeometry} from './landmark-detail';
type Material=(c:number,e?:Partial<THREE.MeshStandardMaterialParameters>)=>THREE.MeshStandardMaterial;
// Bespoke architecture at miniature scale; glass grids follow the building surface.
export function buildCraftedLandmark(id:string,parent:THREE.Group,material:Material){
  if(!['beijing','shenzhen','xiamen','suzhou','nanjing','changsha'].includes(id))return false;
  const stone=material(0xe9dfc8),red=material(0xaa342e),gold=material(0xd9b76b,{metalness:.35,roughness:.45}),roof=material(0x2b638a,{side:THREE.DoubleSide,roughness:.52}),glass=material(0x598999,{metalness:.32,roughness:.25}),frame=material(0xb7cbd0,{metalness:.35}),dark=material(0x163c50);
  const glow=material(0xe9d9a9,{emissive:0xf1bb74,emissiveIntensity:.08});glow.userData.nightLight=true;
  const mesh=(g:THREE.BufferGeometry,m:THREE.Material,x=0,y=0,z=0)=>{const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;parent.add(o);return o;};
  const box=(w:number,h:number,d:number,m:THREE.Material,x:number,y:number,z:number)=>mesh(new THREE.BoxGeometry(w,h,d),m,x,y,z);
  const cyl=(rt:number,rb:number,h:number,m:THREE.Material,x:number,y:number,z:number,n=48)=>mesh(new THREE.CylinderGeometry(rt,rb,h,n),m,x,y,z);
  const rod=(a:THREE.Vector3,b:THREE.Vector3,r:number,m:THREE.Material)=>{const d=b.clone().sub(a),o=mesh(new THREE.CylinderGeometry(r,r,d.length(),6),m);o.position.copy(a.clone().add(b).multiplyScalar(.5));o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());};
  if(id==='beijing'){
    const x=-.2,z=-.3;
    for(let i=0;i<3;i++)cyl(1.16-i*.14,1.19-i*.14,.12,stone,x,.61+i*.12,z,64);
    cyl(.72,.77,.9,red,x,1.38,z);cyl(.42,.52,.72,red,x,2.11,z);
    for(let i=0;i<16;i++){const a=i*Math.PI/8,c=Math.cos(a),s=Math.sin(a);cyl(.035,.035,.76,red,x+c*.78,1.37,z+s*.78,10);box(.065,.44,.035,dark,x+c*.734,1.36,z+s*.734).rotation.y=-a+Math.PI/2;}
    for(const [width,y] of [[2.18,1.77],[1.66,2.27],[1.16,2.75]]){
      mesh(eaveGeometry(width,true),roof,x,y,z);
      const radius=width*.53;
      mesh(new THREE.TorusGeometry(radius,.025,6,80),gold,x,y+.08,z).rotation.x=Math.PI/2;
      for(let k=0;k<64;k++){const a=k*Math.PI/32;const points=[.18,.38,.65,.84,1].map((t,j)=>new THREE.Vector3(x+Math.cos(a)*radius*t,y+[.31,.24,.13,.06,.075][j],z+Math.sin(a)*radius*t));mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),12,.009,3,false),roof);}
      for(let k=0;k<16;k++){const a=k*Math.PI/8;box(.08,.065,.065,gold,x+Math.cos(a)*radius*.74,y-.05,z+Math.sin(a)*radius*.74).rotation.y=-a;}
    }
    cyl(.05,.09,.21,gold,x,3.16,z);mesh(new THREE.SphereGeometry(.067,12,8),gold,x,3.29,z);
    for(let i=0;i<7;i++)box(.47,.035,.095,stone,x,.575+i*.035,1.09-i*.08);
    return true;
  }
  function tower(x:number,z:number,w:number,h:number,taper:number,facets=8){
    cyl(w*taper,w,h,glass,x,.54+h/2,z,facets).rotation.y=Math.PI/facets;
    for(let floor=0;floor<Math.floor(h/.12);floor++){
      const y=.64+floor*.12,t=(y-.54)/h,r=w*(1-(1-taper)*t),apothem=r*Math.cos(Math.PI/facets);
      for(let side=0;side<facets;side++){
        const a=(side+1)*Math.PI*2/facets,normal=new THREE.Vector3(Math.cos(a),0,Math.sin(a)),tangent=new THREE.Vector3(-Math.sin(a),0,Math.cos(a));
        const band=box(r*Math.sin(Math.PI/facets)*2,.012,.012,frame,x+normal.x*(apothem+.009),y,z+normal.z*(apothem+.009));band.rotation.y=Math.PI/2-a;
        for(let col=0;col<4;col++){const pos=normal.clone().multiplyScalar(apothem+.012).add(tangent.clone().multiplyScalar((col-1.5)*r*Math.sin(Math.PI/facets)*.45));const panel=box(r*Math.sin(Math.PI/facets)*.38,.077,.012,(floor+col+side)%11===0?glow:glass,x+pos.x,y+.049,z+pos.z);panel.rotation.y=Math.PI/2-a;}
      }
    }
    for(let k=0;k<facets;k++){const a=(k+.5)*Math.PI*2/facets;rod(new THREE.Vector3(x+Math.cos(a)*w,.54,z+Math.sin(a)*w),new THREE.Vector3(x+Math.cos(a)*w*taper,.54+h,z+Math.sin(a)*w*taper),.013,frame);}
  }
  if(id==='shenzhen'){
    tower(-.25,-.3,.68,3.35,.35);cyl(0,.245,.67,frame,-.25,4.225,-.3,8);cyl(.014,.014,.2,frame,-.25,4.65,-.3,8);box(1.6,.15,1.4,stone,-.25,.62,-.3);
  }else if(id==='nanjing'){
    tower(-.45,-.3,.66,2.95,.68,4);tower(.08,-.3,.26,.63,.65,4);box(.42,.61,.43,glass,.08,3.78,-.3);box(.18,.43,.24,frame,.08,4.15,-.3);cyl(.013,.024,.6,frame,.08,4.52,-.3,8);
  }else if(id==='changsha'){
    tower(-.8,-.2,.54,3.65,.78,4);tower(.47,-.5,.49,2.9,.78,4);box(1.92,.35,1.45,stone,-.2,.73,-.35);
  }else if(id==='xiamen'){
    for(const x of [-.9,.45]){
      const shape=new THREE.Shape();shape.moveTo(-.5,0);shape.lineTo(.5,0);shape.quadraticCurveTo(.43,2.55,-.32,3.3);shape.closePath();mesh(new THREE.ExtrudeGeometry(shape,{depth:.55,bevelEnabled:true,bevelSize:.014,bevelThickness:.014,bevelSegments:2,curveSegments:32}),glass,x,.55,-.5);
      for(let row=0;row<26;row++){const t=row/26,y=.62+t*3.12,right=.5-.75*t*t,left=-.5+.18*t;const width=right-left;for(const z of [-.515,.065]){box(width,.014,.018,frame,x+(left+right)/2,y,z);for(let col=0;col<7;col++){const xx=x+left+(col+.5)*width/7;box(width/9,.066,.012,(row+col)%13===0?glow:dark,xx,y+.049,z);box(.01,.11,.012,frame,x+left+col*width/7,y+.055,z);}}}
      const edge=new THREE.CatmullRomCurve3(Array.from({length:25},(_,i)=>{const t=i/24;return new THREE.Vector3(x+.5-.82*t*t,.55+t*3.3,.074);}));mesh(new THREE.TubeGeometry(edge,48,.015,6,false),frame);
    }
    box(2.5,.1,1.2,stone,-.22,.59,-.3);
  }else if(id==='suzhou'){
    for(const x of [-.96,.5]){box(.61,2.63,.9,glass,x,1.855,-.3);for(let row=0;row<24;row++)for(const z of [-.758,.158]){box(.615,.012,.01,frame,x,.65+row*.106,z);for(let col=0;col<5;col++)box(.009,.095,.012,frame,x-.26+col*.13,.695+row*.106,z);}}
    const arch=mesh(new THREE.TorusGeometry(.73,.3,16,64,Math.PI),glass,-.23,3.08,-.3);arch.scale.z=1.5;
    for(let i=0;i<38;i++){const a=i/37*Math.PI;rod(new THREE.Vector3(-.23+Math.cos(a)*.455,3.08+Math.sin(a)*.455,.16),new THREE.Vector3(-.23+Math.cos(a)*1.027,3.08+Math.sin(a)*1.027,.16),.009,frame);}
    box(2.22,.14,1.28,stone,-.23,.61,-.3);
  }
  return true;
}
