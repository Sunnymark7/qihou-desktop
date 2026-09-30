import * as THREE from 'three';
import {eaveGeometry} from './landmark-detail';
type Material = (color:number,extra?:Partial<THREE.MeshStandardMaterialParameters>)=>THREE.MeshStandardMaterial;

// Distinct structural silhouettes with shared primitives. Static parts are batched by WeatherScene.
export function buildRegionalLandmark(id:string,parent:THREE.Group,material:Material){
  if(!['harbin','nanchang','guiyang','lhasa'].includes(id))return false;
  const stone=material(0xe8dfcc),brick=material(0x9d4935),roof=material(0x365e58,{side:THREE.DoubleSide});
  const gold=material(0xc7a259,{metalness:.45,roughness:.45}),dark=material(0x26353e);
  const window=material(0xe5c896,{emissive:0xfac879,emissiveIntensity:.04});window.userData.nightLight=true;
  const mesh=(g:THREE.BufferGeometry,m:THREE.Material,x:number,y:number,z:number)=>{const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;parent.add(o);return o;};
  const box=(w:number,h:number,d:number,m:THREE.Material,x:number,y:number,z:number)=>mesh(new THREE.BoxGeometry(w,h,d),m,x,y,z);
  const cylinder=(r:number,h:number,m:THREE.Material,x:number,y:number,z:number)=>mesh(new THREE.CylinderGeometry(r,r,h,32),m,x,y,z);
  const arch=(x:number,y:number,z:number,r:number)=>{mesh(new THREE.TorusGeometry(r,.045,6,24,Math.PI),stone,x,y,z);box(r*1.6,r*1.25,.035,dark,x,y-r*.6,z-.01);};
  const hall=(x:number,z:number,width:number,levels:number,start=.65)=>{
    for(let i=0;i<levels;i++){
      const w=width*(1-i*.13),y=start+i*.57;box(w*.72,.42,w*.6,brick,x,y+.21,z);
      mesh(eaveGeometry(w),roof,x,y+.4,z);
      for(let j=0;j<5;j++){const xx=x-w*.3+j*w*.15;box(.035,.31,.04,gold,xx,y+.23,z+w*.31);box(.055,.2,.016,window,xx+.06,y+.24,z+w*.305);}
    }
    cylinder(.045,.25,gold,x,start+levels*.57+.12,z);
  };
  if(id==='harbin'){
    box(2.2,.15,1.75,stone,-.2,.62,-.3);
    box(1.1,1.35,1.4,brick,-.2,1.37,-.3);box(1.85,.95,.72,brick,-.2,1.17,-.3);
    cylinder(.46,.44,brick,-.2,2.17,-.3);
    const profile=[new THREE.Vector2(.03,0),new THREE.Vector2(.3,.07),new THREE.Vector2(.53,.31),new THREE.Vector2(.49,.52),new THREE.Vector2(.32,.76),new THREE.Vector2(.13,.98),new THREE.Vector2(.015,1.15)];
    mesh(new THREE.LatheGeometry(profile,48),roof,-.2,2.35,-.3);
    cylinder(.014,.28,gold,-.2,3.6,-.3);box(.19,.018,.018,gold,-.2,3.62,-.3);
    for(const x of [-1,.6]){box(.43,1.15,.5,brick,x,1.3,-.18);mesh(new THREE.ConeGeometry(.36,.65,8),roof,x,2.2,-.18);cylinder(.025,.17,gold,x,2.56,-.18);}
    for(const x of [-.52,-.2,.12]){arch(x,1.77,.415,.105);box(.13,.23,.023,window,x,1.66,.433);}
    arch(-.2,1.11,.425,.21);box(.3,.35,.026,dark,-.2,.85,.425);
    for(let y=.8;y<2;y+=.15)box(1.12,.013,.025,stone,-.2,y,.415);
    for(let i=0;i<16;i++){const a=i*Math.PI/8;cylinder(.018,.36,gold,-.2+Math.cos(a)*.465,2.17,-.3+Math.sin(a)*.465);}
  }else if(id==='nanchang'){
    box(2.85,.25,1.7,stone,-.2,.68,-.3);hall(-.2,-.3,1.95,4,.82);
    for(const x of [-1.35,.95]){hall(x,-.25,.78,2,.82);box(.68,.17,.55,stone,x,.74,-.25);}
    for(const x of [-.97,.57]){box(.72,.17,.48,brick,x,1.04,-.27);mesh(eaveGeometry(.78),roof,x,1.11,-.27);}
    for(let i=0;i<7;i++)box(.6,.035,.08,stone,-.2,.6+i*.035,.85-i*.09);
  }else if(id==='guiyang'){
    cylinder(.72,.23,stone,-.2,.7,-.3);hall(-.2,-.3,1.5,3,.83);
    box(3.05,.09,.5,stone,-.2,.69,.65);
    for(const x of [-1.25,-.55,.15,.85]){const o=mesh(new THREE.TorusGeometry(.3,.068,6,24,Math.PI),stone,x,.52,.91);o.scale.y=.65;}
    for(const z of [.39,.91]){box(3.05,.03,.03,stone,-.2,.93,z);for(let i=0;i<19;i++)box(.025,.18,.025,stone,-1.68+i*.165,.84,z);}
  }else{
    const rock=material(0x9c998d),white=material(0xf0e5d1);
    for(let i=0;i<4;i++)box(3.05-i*.33,.24,1.75-i*.15,rock,-.2,.66+i*.2,-.3);
    for(const [x,w,h] of [[-1.25,.7,1.02],[-.7,.6,1.38],[.55,.72,1.3],[1.08,.55,.83]]){
      box(w,h,.83,white,x,1.14+h/2,-.3);box(w+.025,.09,.88,dark,x,1.14+h,-.3);
      for(let y=1.32;y<1.1+h;y+=.25)for(let j=0;j<3;j++){const xx=x-w*.32+j*w*.32;box(.08,.14,.02,dark,xx,y,.126);box(.08,.035,.026,stone,xx,y+.09,.14);}
    }
    box(1.06,1.66,1.04,brick,-.17,2.0,-.46);box(1.1,.12,1.08,dark,-.17,2.85,-.46);
    for(const x of [-.55,-.18,.19]){box(.25,.15,.33,gold,x,3.0,-.43);mesh(eaveGeometry(.39),gold,x,3.05,-.43);cylinder(.018,.12,gold,x,3.48,-.43);}
    for(let y=1.43;y<2.8;y+=.27)for(let i=0;i<5;i++)box(.072,.13,.027,window,-.57+i*.2,y,.07);
    for(let i=0;i<13;i++)box(.25,.025,.1,white,1.35-i*.065,.61+i*.047,.65-i*.015);
  }
  return true;
}
