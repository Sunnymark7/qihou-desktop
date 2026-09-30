import * as THREE from 'three';
import {eaveGeometry} from './landmark-detail';
import { mayWind } from './may-wind';

// Stylized silhouettes, built from geometry; no downloaded models or texture payloads.
export function buildLandmark(id:string, parent:THREE.Group, material:(color:number,extra?:Partial<THREE.MeshStandardMaterialParameters>)=>THREE.MeshStandardMaterial) {
  const stone=material(0xe4d7b9), red=material(0xa7503e), roof=material(0x48696c,{side:THREE.DoubleSide}), gold=material(0xc9a15c), glass=material(0x90b8bc,{metalness:0.3,roughness:0.3});
  const glow=material(0xc4d7ce,{emissive:0xffbd65,emissiveIntensity:0.08});glow.userData.nightLight=true;
  const mesh=(geo:THREE.BufferGeometry,mat:THREE.Material,x=0,y=0,z=0)=>{const o=new THREE.Mesh(geo,mat);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;};
  const box=(w:number,h:number,d:number,m:THREE.Material,x:number,y:number,z=0)=>mesh(new THREE.BoxGeometry(w,h,d),m,x,y,z);
  const cylinder=(top:number,bottom:number,h:number,m:THREE.Material,x:number,y:number,z=0,n=16)=>mesh(new THREE.CylinderGeometry(top,bottom,h,n),m,x,y,z);
  const rod=(a:THREE.Vector3,b:THREE.Vector3,r:number,m:THREE.Material)=>{const v=b.clone().sub(a),o=cylinder(r,r,v.length(),m,0,0);o.position.copy(a.clone().add(b).multiplyScalar(.5));o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());return o;};
  const pavilion=(x:number,y:number,z:number,w:number,levels:number,round=false)=>{
    for(let i=0;i<levels;i++){
      const width=w*(1-i*.12),yy=y+i*.48;
      if(round)cylinder(width*.37,width*.39,.34,red,x,yy+.17,z);else box(width*.72,.34,width*.65,red,x,yy+.17,z);
      for(const dx of [-.25,0,.25])box(.055,.23,.04,gold,x+dx*width,yy+.2,z+width*.34);
      mesh(eaveGeometry(width,round),roof,x,yy+.33,z);
      if(i===levels-1)cylinder(.025,.035,.16,gold,x,yy+.75,z);
    }
  };
  const skyscraper=(x:number,z:number,w:number,h:number,taper=.6)=>{
    const geo=new THREE.CylinderGeometry(w*taper,w,h,4);geo.rotateY(Math.PI/4);mesh(geo,glass,x,.54+h/2,z);
    for(let y=.8;y<h+.4;y+=.22)box(w*1.25,.025,w*1.25,glow,x,y,z);
    cylinder(.01,.025,.32,stone,x,.54+h+.16,z);
  };
  switch(id){
    case 'beijing':
      for(let i=0;i<3;i++)cylinder(1.05-i*.16,1.08-i*.16,.13,stone,-.2,.61+i*.13,-.3,32);
      pavilion(-.2,.93,-.3,1.85,3,true);break;
    case 'wuhan':
      box(2.05,.25,1.5,stone,-.25,.67,-.35);pavilion(-.25,.8,-.35,2.1,5);break;
    case 'hangzhou':
      cylinder(.9,.95,.3,stone,-.25,.68,-.25,8);
      for(let i=0;i<5;i++){const r=.66-i*.065,y=.99+i*.54;cylinder(r,r,.37,stone,-.25,y,-.25,8);cylinder(r*.55,r+.16,.18,roof,-.25,y+.27,-.25,8);for(let j=0;j<8;j++){const a=j*Math.PI/4;box(.09,.22,.06,red,-.25+Math.cos(a)*r,y,-.25+Math.sin(a)*r);}}
      cylinder(.01,.08,.46,gold,-.25,3.62,-.25);break;
    case 'xian':
      for(let i=0;i<7;i++){const w=1.55-i*.14,y=.54+i*.45;box(w,.44,w,stone,-.2,y+.22,-.3);box(w+.12,.07,w+.12,gold,-.2,y+.45,-.3);box(.18,.23,.025,roof,-.2,y+.17,-.3+w/2+.015);}
      cylinder(0,.13,.3,gold,-.2,3.83,-.3,4);break;
    case 'chengdu':
      box(2.7,.2,1.2,stone,-.25,1.08,-.3);for(const x of [-1.25,.7])box(.28,.55,1.08,stone,x,.8,-.3);
      for(const x of [-1.1,-.25,.6])pavilion(x,1.18,-.3,1.05,1);
      box(2.7,.035,1.45,glass,-.25,.57,-.3);break;
    case 'chongqing':
      for(let i=0;i<4;i++){const y=.62+i*.48;box(2.5-i*.2,.42,1.25,red,-.3,y+.2,-.35-i*.12);for(let x=-1.35;x<.85;x+=.3){box(.11,.24,.035,glow,x,y+.22,.3-i*.12);}box(2.65-i*.2,.07,1.5,roof,-.3,y+.45,-.35-i*.12);}
      pavilion(-.7,2.5,-.75,1.3,1);pavilion(.45,2.5,-.75,.95,1);break;
    case 'tianjin': {
      const center=new THREE.Vector3(-.25,2.25,-.25),r=1.4;
      mesh(new THREE.TorusGeometry(r,.045,6,56),stone,center.x,center.y,center.z);
      for(let i=0;i<16;i++){const a=i*Math.PI/8,p=new THREE.Vector3(center.x+Math.cos(a)*r,center.y+Math.sin(a)*r,center.z);rod(center,p,.015,stone);box(.19,.25,.2,glass,p.x,p.y,p.z);}
      for(const x of [-1.25,.75])rod(new THREE.Vector3(x,.58,.15),center,.085,red);
      box(2.9,.13,.7,stone,-.25,.62,.1);break;}
    case 'qingdao':mayWind(parent,material);break;
    case 'suzhou':
      for(const x of [-.96,.5])box(.6,2.65,.85,glass,x,1.88,-.3);
      const arch=mesh(new THREE.TorusGeometry(.73,.29,6,28,Math.PI),glass,-.23,3.13,-.3);arch.scale.z=1.5;
      for(let y=.8;y<3.2;y+=.24)for(const x of [-.96,.5])box(.62,.025,.87,glow,x,y,-.3);break;
    case 'zhengzhou':
      for(const x of [-.7,.25])rod(new THREE.Vector3(x,.55,-.3),new THREE.Vector3(-.22,3.15,-.3),.1,stone);
      cylinder(.4,.6,.3,gold,-.22,3.12,-.3);cylinder(.45,.35,.22,glass,-.22,3.38,-.3);cylinder(.015,.06,1,stone,-.22,3.96,-.3);break;
    case 'shenzhen':skyscraper(-.25,-.3,.67,3.4,.34);cylinder(0,.31,.65,stone,-.25,4.26,-.3,4);break;
    case 'nanjing':skyscraper(-.45,-.3,.65,3.1,.65);box(.45,.75,.4,glass,.07,3.6,-.3);cylinder(.01,.025,.65,stone,-.05,4.27,-.3);break;
    case 'changsha':skyscraper(-.8,-.2,.53,3.65,.8);skyscraper(.47,-.5,.49,2.9,.8);break;
    case 'xiamen':
      for(const x of [-.9,.45]){const shape=new THREE.Shape();shape.moveTo(-.5,0);shape.lineTo(.5,0);shape.quadraticCurveTo(.45,2.45,-.32,3.3);shape.lineTo(-.5,0);const geo=new THREE.ExtrudeGeometry(shape,{depth:.55,bevelEnabled:false});mesh(geo,glass,x,.55,-.5);for(let y=.8;y<2.6;y+=.22)box(.65,.025,.58,glow,x,y,-.22);}
      break;
    default:return false;
  }
  return true;
}
