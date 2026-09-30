import * as THREE from 'three';
import type { AppState, Kind } from './types';
import { windVector } from './wind.mjs';
import presets from '../shared/weather-presets.json';
import {refineLandmark} from './landmark-detail';
import {buildCraftedLandmark} from './crafted-models';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import skins from '../shared/skins.json';
import { buildLandmark } from './landmark-models';
import type { Effects } from './types';

const palette = { grass: 0x8da979, stone: 0xc5bca6, earth: 0xbbb099, wood: 0xa06943, roof: 0xbc7255, cream: 0xf1e7ce, leaf: 0x527d5c, water: 0x88b9c0 };
export class WeatherScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 100);
  private world = new THREE.Group();
  private modelGroup = new THREE.Group();
  private clouds = new THREE.Group();
  private cloudTravel = 0;
  private sun: THREE.Mesh;
  private hemi = new THREE.HemisphereLight(0xf1f7ff, 0x667954, 2.5);
  private light = new THREE.DirectionalLight(0xfff1d6, 3.6);
  private particles: THREE.Points;
  private snowMap: THREE.CanvasTexture;
  private dustMap: THREE.CanvasTexture;
  private rain: THREE.InstancedMesh;
  private mist = new THREE.Group();
  private sunRays = new THREE.Group();
  private effects:Effects=presets.unknown;
  private hail:THREE.InstancedMesh;
  private hailState=Array.from({length:64},()=>({x:Math.random()*4-2,y:Math.random()*4+.6,z:Math.random()*4-2,v:0,bounced:false}));
  private matrix=new THREE.Object3D();
  private ripples=new THREE.Group();
  private lightning:THREE.Mesh;
  private snowCap:THREE.Mesh;
  private quality='';
  private qualityFactor=1;
  private windRig=new THREE.Group();
  private windSock=new THREE.Group();
  private windDisplay=0;
  private snowPositions = new Float32Array(180 * 3);
  private rainPositions = new Float32Array(400 * 6);
  private kind: Kind = 'unknown';
  private model = '';
  private detail='classic';
  private night = false;
  private wind = 1;
  private windAngle = 0;
  private paused = false;
  private reduced = false;
  private systemReduced = matchMedia('(prefers-reduced-motion: reduce)');
  private fps = 30;
  private time = 0;
  private last = 0;
  private raf = 0;
  private alive = true;
  private hidden = false;
  private resizeObserver: ResizeObserver;
  private modelMaterials: THREE.Material[] = [];
  private skin='garden';
  private targetRotation = -0.12;
  private errorBox: HTMLParagraphElement;
  private interactive: boolean;
  private visibilityHandler = () => { this.hidden = document.hidden; this.invalidate(); };

  constructor(private host: HTMLElement, private mode: string) {
    this.interactive = mode === 'settings';
    this.errorBox = document.createElement('p'); this.errorBox.className = 'scene-error'; this.errorBox.hidden = true;
    this.errorBox.textContent = '3D 显示暂不可用，天气文字仍可使用。请重新打开窗口。';
    host.append(this.errorBox);
    this.renderer = new THREE.WebGLRenderer({ alpha: mode !== 'wallpaper', antialias: true, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.1;
    this.renderer.domElement.setAttribute('aria-label', '随天气变化的三维微缩景观');
    this.renderer.domElement.setAttribute('role', 'img');
    host.prepend(this.renderer.domElement);
    this.camera.position.set(8, 6, 10); this.camera.lookAt(0, 1.4, 0);
    this.scene.add(this.world, this.clouds, this.hemi, this.light);
    this.world.add(this.modelGroup);
    this.light.position.set(-3, 9, 5); this.light.castShadow = true;
    this.light.shadow.mapSize.set(1024, 1024);
    Object.assign(this.light.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, far: 35 });
    this.light.shadow.normalBias = 0.04;
    this.sun = new THREE.Mesh(new THREE.SphereGeometry(0.37, 24, 16), new THREE.MeshBasicMaterial({ color: 0xf0c86d }));
    this.sun.position.set(-2.1, 4.2, -1.3); this.world.add(this.sun);
    for(let i=0;i<10;i++){
      const ray=new THREE.Mesh(new THREE.CapsuleGeometry(.018,.16,2,5),new THREE.MeshBasicMaterial({color:0xe9b74b}));
      const angle=i/10*Math.PI*2;ray.position.set(Math.sin(angle)*.61,Math.cos(angle)*.61,0);ray.rotation.z=-angle;this.sunRays.add(ray);
    }
    this.sunRays.position.copy(this.sun.position);this.world.add(this.sunRays);
    for (let i = 0; i < 5; i++) {
      const cloud = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({ color: 0xf4f7f4, roughness: 1, transparent: true, opacity: 0.93, depthWrite: false, flatShading: false });
      [[-0.5,0,0,0.38],[-0.15,0.13,0,0.48],[0.32,0.05,0,0.38],[0.02,-0.1,0.1,0.4]].forEach(([x,y,z,r]) => {
        const puff = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), mat); puff.position.set(x,y,z); puff.scale.y = 0.73; cloud.add(puff);
      });
      cloud.scale.setScalar(.72 + (i % 3) * .1);
      this.clouds.add(cloud);
    }
    const snowGeometry = new THREE.BufferGeometry();
    for (let i = 0; i < this.snowPositions.length; i += 3) { this.snowPositions[i] = Math.random()*5-2.5; this.snowPositions[i+1] = Math.random()*5; this.snowPositions[i+2] = Math.random()*5-2.5; }
    snowGeometry.setAttribute('position', new THREE.BufferAttribute(this.snowPositions, 3));
    const snowCanvas = document.createElement('canvas'); snowCanvas.width = snowCanvas.height = 32;
    const ctx = snowCanvas.getContext('2d')!;ctx.lineCap='round';
    for(const [color,width] of [['#638ca9',5.5],['#ffffff',2.8]] as const){ctx.strokeStyle=color;ctx.lineWidth=width;
      for(let i=0;i<6;i++){ctx.save();ctx.translate(16,16);ctx.rotate(i*Math.PI/3);ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,-12);ctx.moveTo(-4,-6);ctx.lineTo(0,-9);ctx.lineTo(4,-6);ctx.stroke();ctx.restore();}}
    this.snowMap=new THREE.CanvasTexture(snowCanvas);
    const dustCanvas=document.createElement('canvas');dustCanvas.width=dustCanvas.height=32;
    const dustCtx=dustCanvas.getContext('2d')!;dustCtx.fillStyle='#fff';dustCtx.beginPath();dustCtx.arc(16,16,10,0,Math.PI*2);dustCtx.fill();this.dustMap=new THREE.CanvasTexture(dustCanvas);
    this.particles = new THREE.Points(snowGeometry, new THREE.PointsMaterial({ color: 0xeaf8ff, size: 7, sizeAttenuation:false, map: this.snowMap, transparent: true, depthWrite: false, opacity: 1 }));
    for (let i=0;i<this.rainPositions.length;i+=6) { const x=Math.random()*5-2.5, y=Math.random()*5, z=Math.random()*5-2.5; this.rainPositions.set([x,y,z,x-0.03,y+0.22,z],i); }
    this.rain = new THREE.InstancedMesh(new THREE.CylinderGeometry(.012,.021,1,5),new THREE.MeshBasicMaterial({color:0x72b9db,transparent:true,opacity:.92}),400);
    this.rain.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.rain.frustumCulled=false;
    this.world.add(this.particles,this.rain);
    this.hail=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.105,0),new THREE.MeshStandardMaterial({color:0xe0f2ff,emissive:0x35536a,emissiveIntensity:.24,roughness:.24,metalness:.12}),64);this.hail.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.hail.frustumCulled=false;this.world.add(this.hail);
    for(let i=0;i<16;i++){const ripple=new THREE.Mesh(new THREE.RingGeometry(.08,.11,16),new THREE.MeshBasicMaterial({color:0xb7dce2,transparent:true,opacity:.4,depthWrite:false,side:THREE.DoubleSide}));ripple.rotation.x=-Math.PI/2;ripple.position.set(Math.random()*3.8-1.9,.59,Math.random()*3.8-1.9);this.ripples.add(ripple);}this.world.add(this.ripples);
    const bolt=new THREE.Shape();bolt.moveTo(-.05,.72);bolt.lineTo(.2,.72);bolt.lineTo(.02,.16);bolt.lineTo(.23,.2);bolt.lineTo(-.23,-.65);bolt.lineTo(-.05,-.03);bolt.lineTo(-.26,-.08);bolt.closePath();
    this.lightning=new THREE.Mesh(new THREE.ShapeGeometry(bolt),new THREE.MeshBasicMaterial({color:0xffe395,transparent:true,opacity:.55,side:THREE.DoubleSide}));
    this.lightning.position.set(-2.1,3.25,.65);this.lightning.quaternion.copy(this.camera.quaternion);this.scene.add(this.lightning);
    const mistCanvas=document.createElement('canvas');mistCanvas.width=128;mistCanvas.height=64;
    const mistCtx=mistCanvas.getContext('2d')!,gradient=mistCtx.createRadialGradient(64,32,0,64,32,62);
    gradient.addColorStop(0,'rgba(255,255,255,.7)');gradient.addColorStop(.45,'rgba(255,255,255,.3)');gradient.addColorStop(1,'rgba(255,255,255,0)');mistCtx.fillStyle=gradient;mistCtx.fillRect(0,0,128,64);
    const mistMap=new THREE.CanvasTexture(mistCanvas);
    for(let i=0;i<5;i++){const layer=new THREE.Sprite(new THREE.SpriteMaterial({map:mistMap,color:0xcbdde0,transparent:true,depthWrite:false,opacity:0}));layer.scale.set(3.6,.65,1);this.mist.add(layer);}this.world.add(this.mist);
    this.snowCap=new THREE.Mesh(new THREE.BoxGeometry(4.25,.025,4.25),new THREE.MeshStandardMaterial({color:0xe8eff0,transparent:true,opacity:.6,roughness:1}));this.snowCap.position.y=.555;this.world.add(this.snowCap);
    const pole=new THREE.Mesh(new THREE.CylinderGeometry(.025,.04,1.05,8),new THREE.MeshStandardMaterial({color:0x778b80}));pole.position.set(-1.7,1.08,-.3);this.windRig.add(pole);
    this.windSock.position.set(-1.7,1.6,-.3);this.windRig.add(this.windSock);
    for(let i=0;i<5;i++){const band=new THREE.Mesh(new THREE.CylinderGeometry(.105-i*.013,.118-i*.013,.15,10,1,true),new THREE.MeshStandardMaterial({color:i%2?0xf5f0df:0xcd7d52,side:THREE.DoubleSide}));band.rotation.z=-Math.PI/2;band.position.x=i*.14;this.windSock.add(band);}
    this.world.add(this.windRig);
    this.buildModel('default');
    this.resizeObserver = new ResizeObserver(() => this.resize()); this.resizeObserver.observe(host);
    document.addEventListener('visibilitychange',this.visibilityHandler);
    this.renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();this.errorBox.hidden=false;cancelAnimationFrame(this.raf);this.raf=0;});
    this.renderer.domElement.addEventListener('webglcontextrestored',()=>{this.errorBox.hidden=true;this.invalidate();});
    if(this.interactive) {
      let startX=0, dragging=false, original=0;
      this.renderer.domElement.addEventListener('pointerdown',e=>{ dragging=true;startX=e.clientX;original=this.targetRotation;this.renderer.domElement.setPointerCapture(e.pointerId); });
      this.renderer.domElement.addEventListener('pointermove',e=>{if(dragging){this.targetRotation=original+(e.clientX-startX)*0.008;this.invalidate();}});
      this.renderer.domElement.addEventListener('pointerup',()=>{dragging=false;});
      this.renderer.domElement.addEventListener('pointercancel',()=>{dragging=false;});
    }
    this.resize();
  }
  private material(color: number, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) {
    const mat=new THREE.MeshStandardMaterial({color,roughness:0.82,...extra}); this.modelMaterials.push(mat); return mat;
  }
  private mesh(geometry: THREE.BufferGeometry, mat: THREE.Material, x=0,y=0,z=0, parent:THREE.Object3D=this.modelGroup) {
    const mesh=new THREE.Mesh(geometry,mat);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
  }
  private box(w:number,h:number,d:number,mat:THREE.Material,x:number,y:number,z:number,parent?:THREE.Object3D) {return this.mesh(new THREE.BoxGeometry(w,h,d),mat,x,y,z,parent);}
  private tree(x:number,z:number,s=1) {
    this.mesh(new THREE.CylinderGeometry(0.065*s,0.085*s,0.55*s,6),this.material(palette.wood),x,0.45+0.275*s,z);
    const leaf=this.material(palette.leaf,{flatShading:true});
    const crown=this.mesh(new THREE.IcosahedronGeometry(0.47*s,1),leaf,x,0.5+0.84*s,z);crown.scale.set(.85,1.2,.9);crown.userData.treeCrown=true;
    this.mesh(new THREE.IcosahedronGeometry(0.32*s,1),leaf,x+0.2*s,0.5+0.67*s,z+0.1*s);
  }
  private island() {
    const shape=new THREE.Shape(); const s=2.35,r=0.7;
    shape.moveTo(-s+r,-s);shape.lineTo(s-r,-s);shape.quadraticCurveTo(s,-s,s,-s+r);shape.lineTo(s,s-r);shape.quadraticCurveTo(s,s,s-r,s);shape.lineTo(-s+r,s);shape.quadraticCurveTo(-s,s,-s,s-r);shape.lineTo(-s,-s+r);shape.quadraticCurveTo(-s,-s,-s+r,-s);
    const geo=new THREE.ExtrudeGeometry(shape,{depth:0.4,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:0.1,bevelThickness:0.12,curveSegments:14});geo.rotateX(-Math.PI/2);
    this.mesh(geo,this.material(palette.stone),0,0.0,0);
    const topGeo=new THREE.ShapeGeometry(shape,16);topGeo.rotateX(-Math.PI/2);
    this.mesh(topGeo,this.material(palette.grass),0,0.53,0);
    // A narrow blue channel runs along the miniature park, with a short bridge.
    this.box(0.58,0.025,4.05,this.material(palette.water,{metalness:0.12,roughness:0.24}),1.43,0.545,0);
    const pathMat=this.material(0xd9ccb0);
    this.box(0.47,0.04,2.1,pathMat,-0.18,0.56,1.04);
    this.box(2.65,0.04,0.44,pathMat,0.05,0.565,1.75);
    const wood=this.material(0xc09269);
    for(let i=0;i<7;i++)this.box(0.12,0.055,0.7,wood,1.05+i*0.14,0.62,1.0);
    for(const z of [0.68,1.32]) {this.box(1,0.045,0.04,wood,1.46,0.87,z);for(const x of [1.02,1.9])this.box(0.04,0.3,0.04,wood,x,0.72,z);}
    this.tree(-1.72,0.95,0.85);this.tree(-1.75,-1.2,1);this.tree(1.98,-1.35,0.6);this.tree(0.68,-1.85,0.7);
    // Park bench, stepping stones and low shrubs remain readable at widget scale.
    for(let i=0;i<3;i++)this.box(0.66,0.045,0.06,wood,-1.4,0.83,1.6+i*0.08);
    for(const x of [-1.64,-1.17])this.box(0.055,0.25,0.25,this.material(0x53665c),x,0.67,1.7);
    this.box(0.7,0.2,0.05,wood,-1.4,1.0,1.8);
    for(let i=0;i<5;i++)this.mesh(new THREE.DodecahedronGeometry(0.11,0),this.material(0xdbd6c4),0.52+i*0.15,0.58,-1.0+i*0.19).scale.y=0.45;
  }
  private cottage() {
    const house=new THREE.Group(); house.position.set(-0.32,0.54,-0.38);this.modelGroup.add(house);
    const wall=this.material(palette.cream),trim=this.material(0xe7d9bb),roof=this.material(palette.roof);
    this.box(1.55,1.18,1.32,wall,0,0.6,0,house);
    const roofShape=new THREE.Shape();roofShape.moveTo(-0.94,0);roofShape.lineTo(0,0.69);roofShape.lineTo(0.94,0);roofShape.closePath();
    const roofGeo=new THREE.ExtrudeGeometry(roofShape,{depth:1.6,bevelEnabled:false});
    this.mesh(roofGeo,roof,0,1.18,-0.8,house);
    this.box(0.25,0.64,0.26,this.material(0xa1836b),0.49,1.65,-0.28,house);
    this.box(0.31,0.08,0.31,trim,0.49,1.99,-0.28,house);
    this.box(0.36,0.75,0.065,this.material(0x567568),0.18,0.38,0.69,house);
    this.mesh(new THREE.SphereGeometry(0.024,8,8),this.material(0xdaba6b),0.29,0.37,0.735,house);
    const glass=this.material(0xb8d6d1,{emissive:0xeeb86c,emissiveIntensity:0.05});glass.userData.nightLight=true;
    for(const x of [-0.49,0.54]){this.box(0.3,0.39,0.07,trim,x,0.84,0.69,house);this.box(0.24,0.32,0.08,glass,x,0.84,0.72,house);this.box(0.025,0.33,0.025,trim,x,0.84,0.77,house);}
    this.box(0.07,0.4,0.4,trim,0.79,0.79,0.1,house);this.box(0.075,0.32,0.31,glass,0.81,0.79,0.1,house);
    this.box(0.65,0.1,0.35,this.material(0xcec5af),0.2,0.05,0.82,house);
    // Repeated raised strips articulate the terracotta roof without textures.
    for(let i=0;i<9;i++) {
      for(const sign of [-1,1]) {const beam=this.box(1.18,0.025,0.027,this.material(0xa45f48),sign*0.46,1.54,-0.72+i*0.18,house);beam.rotation.z=-sign*0.635;}
    }
    const planters=this.material(0xc59a77);this.box(0.43,0.18,0.22,planters,-0.48,0.13,0.81,house);
    for(let i=0;i<4;i++)this.mesh(new THREE.IcosahedronGeometry(0.085,0),this.material([0xe4b678,0xd99a82][i%2]),-0.62+i*0.095,0.26,0.81,house);
  }
  private shanghai() {
    const metal=this.material(0xd8dfd8,{metalness:0.42,roughness:0.3});const rose=this.material(0xb87570,{metalness:0.25});
    const lights=this.material(0xa7c9c9,{emissive:0xe5b775,emissiveIntensity:0.1});lights.userData.nightLight=true;
    this.mesh(new THREE.CylinderGeometry(0.14,0.24,3.9,16),metal,-0.2,2.48,-0.25);
    for(const a of [0,Math.PI*2/3,Math.PI*4/3]) {
      const start=new THREE.Vector3(-0.2+Math.cos(a)*0.75,0.57,-0.25+Math.sin(a)*0.75),end=new THREE.Vector3(-0.2,1.45,-0.25);
      const line=end.clone().sub(start);const rod=this.mesh(new THREE.CylinderGeometry(0.08,0.12,line.length(),8),metal);rod.position.copy(start.add(end).multiplyScalar(0.5));rod.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),line.normalize());
    }
    for(const [y,r] of [[1.55,0.59],[3.2,0.4],[4.04,0.16]]){
      this.mesh(new THREE.SphereGeometry(r,24,16),rose,-0.2,y,-0.25);
      this.mesh(new THREE.CylinderGeometry(r*1.02,r*1.02,0.09,32),lights,-0.2,y,-0.25);
    }
    this.mesh(new THREE.CylinderGeometry(0.016,0.05,0.68,8),metal,-0.2,4.49,-0.25);
    const skyline=this.material(0xaab8b3,{metalness:0.16});
    for(const [x,z,h,w] of [[-1.28,-1.15,1.4,0.45],[0.61,-1.2,1.8,0.42],[0.16,-1.62,1.05,0.43]]) {
      this.box(w,h,w,skyline,x,0.53+h/2,z);
      for(let y=0.7;y<h+0.5;y+=0.2)this.box(w+0.01,0.035,w+0.01,lights,x,y,z);
    }
  }
  private guangzhou() {
    const steel=this.material(0xd9e3d9,{metalness:0.4,roughness:0.33});const glass=this.material(0x83a9aa,{metalness:0.3,transparent:true,opacity:0.75});
    const y0=0.55,h=3.72;
    this.mesh(new THREE.CylinderGeometry(0.16,0.18,h,16),glass,-0.2,y0+h/2,-0.2);
    for(let i=0;i<20;i++) {
      const points=[];
      for(let j=0;j<=26;j++) {const t=j/26,angle=i/20*Math.PI*2+t*1.8,r=0.22+0.46*Math.pow(Math.abs(t-0.53)*2,1.4);points.push(new THREE.Vector3(-0.2+Math.cos(angle)*r,y0+t*h,-0.2+Math.sin(angle)*r));}
      this.mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),28,0.024,5,false),steel);
    }
    for(let j=0;j<=12;j++) {const t=j/12,r=0.22+0.46*Math.pow(Math.abs(t-0.53)*2,1.4);const ring=this.mesh(new THREE.TorusGeometry(r,0.025,5,40),steel,-0.2,y0+t*h,-0.2);ring.rotation.x=Math.PI/2;}
    this.mesh(new THREE.CylinderGeometry(0.025,0.06,0.85,8),steel,-0.2,4.57,-0.2);
    const band=this.material(0x97c7b4,{emissive:0x8fd3ac,emissiveIntensity:0.1});band.userData.nightLight=true;
    this.mesh(new THREE.CylinderGeometry(0.42,0.4,0.16,32),band,-0.2,3.76,-0.2);
    this.box(0.72,0.5,0.64,this.material(0xd8dbce),-1.3,0.78,-0.6);
    this.box(0.48,0.8,0.48,this.material(0xb6c4b6),0.68,0.93,-1.0);
  }
  private buildModel(model:string,detail='classic') {
    this.modelGroup.traverse(obj=>{if(obj instanceof THREE.Mesh)obj.geometry.dispose();});
    this.modelMaterials.forEach(m=>m.dispose());this.modelMaterials=[];this.modelGroup.clear();
    this.island();
    const bespoke=detail==='crafted'&&buildCraftedLandmark(model,this.modelGroup,(c,e)=>this.material(c,e));
    if(!bespoke){if(model==='shanghai')this.shanghai();else if(model==='guangzhou')this.guangzhou();else if(!buildLandmark(model,this.modelGroup,(c,e)=>this.material(c,e)))this.cottage();}
    if(model!=='default')refineLandmark(model,this.modelGroup,(c,e)=>this.material(c,e),detail==='crafted');
    const skin=skins.find(s=>s.id===this.skin)||skins[0];
    this.modelMaterials.forEach(m=>{if(m instanceof THREE.MeshStandardMaterial){for(const key of ['grass','stone','leaf','water'] as const)if(m.color.getHex()===palette[key])m.color.setHex(skin[key]);}});
    // Batch static pieces by material; keep swaying tree crowns as separate objects.
    this.modelGroup.updateWorldMatrix(true,true);const inverse=this.modelGroup.matrixWorld.clone().invert(),batches=new Map<THREE.Material,{geometries:THREE.BufferGeometry[];meshes:THREE.Mesh[]}>();
    this.modelGroup.traverse(o=>{if(o instanceof THREE.Mesh&&!o.userData.treeCrown&&!Array.isArray(o.material)){const batch=batches.get(o.material)||{geometries:[],meshes:[]};const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();g.deleteAttribute('uv');g.applyMatrix4(inverse.clone().multiply(o.matrixWorld));batch.geometries.push(g);batch.meshes.push(o);batches.set(o.material,batch);}});
    for(const [m,b] of batches){const g=mergeGeometries(b.geometries,false);b.geometries.forEach(g=>g.dispose());if(g){b.meshes.forEach(o=>{o.removeFromParent();o.geometry.dispose();});const mesh=new THREE.Mesh(g,m);mesh.castShadow=mesh.receiveShadow=true;this.modelGroup.add(mesh);}}
    this.model=model;this.detail=detail;
  }
  update(state:AppState, demo?:Kind, demoNight=false, demoWind?:number) {
    const skin=state.activation?.active?state.deskTools?.skin||'garden':'garden';const skinChanged=skin!==this.skin;this.skin=skin;
    if(this.model!==state.model||this.detail!==(state.sceneDetail||'classic')||skinChanged)this.buildModel(state.model,state.sceneDetail||'classic');
    this.kind=demo || state.weather?.kind || 'unknown';this.night=demo ? demoNight : state.weather ? !state.weather.isDay : false;
    this.effects=demo?presets[demo]:(state.weather?.effects||presets[this.kind]||presets.unknown);
    const quality=state.settings.quality||'balanced';
    if(quality!==this.quality){this.quality=quality;this.qualityFactor=quality==='economy'?.45:quality==='high'?1:.7;this.renderer.setPixelRatio(Math.min(devicePixelRatio,quality==='economy'?1:quality==='high'?1.75:1.25));this.renderer.shadowMap.enabled=quality!=='economy';this.light.shadow.mapSize.set(quality==='high'?1024:512,quality==='high'?1024:512);this.light.shadow.map?.dispose();this.light.shadow.map=null;this.resize();}
    this.wind=demoWind??state.weather?.wind??0;this.windAngle=state.weather?.windDirection??0;
    this.windDisplay=Math.min(1,this.wind/12);
    this.windRig.visible=state.weather?.wind!==null&&state.weather!==null||demoWind!==undefined;
    this.paused=!!state.pauseReason;this.reduced=state.settings.reducedMotion||this.systemReduced.matches;this.fps=state.settings.fps;
    this.particles.visible=this.effects.snow>0||this.effects.dust>0;this.rain.visible=this.effects.rain>0;
    this.particles.geometry.setDrawRange(0,Math.round(180*Math.max(this.effects.snow,this.effects.dust)*this.qualityFactor));
    (this.particles.material as THREE.PointsMaterial).size=this.effects.dust?3:6+this.effects.snow*4;
    (this.particles.material as THREE.PointsMaterial).map=this.effects.dust?this.dustMap:this.snowMap;
    (this.particles.material as THREE.PointsMaterial).color.setHex(this.effects.dust?0xbfa17a:0xe4f1f4);
    this.rain.count=Math.round(400*this.effects.rain*this.qualityFactor);
    (this.rain.material as THREE.MeshBasicMaterial).color.setHex(this.effects.ice?0xbfeaff:this.night?0xa3dfff:0x64a9cf);
    this.mist.visible=this.effects.fog>=.3;
    this.hail.visible=this.effects.hail>0;this.hail.count=Math.round(64*this.effects.hail*this.qualityFactor);
    this.ripples.visible=this.effects.rain>0;this.snowCap.visible=this.effects.snow>0||this.effects.ice;
    (this.snowCap.material as THREE.MeshStandardMaterial).opacity=this.effects.ice?.48:this.effects.snow*.75;
    (this.snowCap.material as THREE.MeshStandardMaterial).color.setHex(this.effects.ice?0xaed9ed:0xe8eff0);
    this.sun.visible=['clear','cloudy'].includes(this.kind);
    this.sunRays.visible=this.sun.visible&&!this.night;
    (this.sun.material as THREE.MeshBasicMaterial).color.setHex(this.night?0xebe9d7:0xf0c86d);
    this.sun.scale.setScalar(this.night?0.8:1);
    this.clouds.children.forEach((c,i)=>{c.visible=this.kind==='clear'?i<1:this.kind==='cloudy'||this.kind==='unknown'?i<3:true;});
    this.scene.fog=this.effects.fog?new THREE.FogExp2(this.effects.dust?0xb5a080:this.night?0x8a9aa9:0xc6d4cc,this.effects.fog*.07):null;
    if(this.mode==='wallpaper')this.scene.background=new THREE.Color(this.night?0x263e50:0xc3d9da);
    this.modelMaterials.forEach(m=>{if(m instanceof THREE.MeshStandardMaterial){if(m.userData.nightLight)m.emissiveIntensity=this.night?1.4:0.08;if(m.color.getHex()===palette.grass)m.roughness=this.effects.rain?.28:.82;}});
    this.invalidate();
  }
  private resize() {
    const w=this.host.clientWidth,h=this.host.clientHeight;if(!w||!h)return;
    this.renderer.setSize(w,h);const aspect=w/h;
    const vertical=this.mode==='wallpaper'?5.1:4.05;
    this.camera.left=-vertical*aspect;this.camera.right=vertical*aspect;this.camera.top=vertical;this.camera.bottom=-vertical;this.camera.updateProjectionMatrix();this.invalidate();
  }
  private invalidate(){if(this.alive&&!this.raf)this.raf=requestAnimationFrame(t=>this.frame(t));}
  private frame(now:number) {
    this.raf=0;if(!this.alive)return;
    if(this.hidden)return;
    const elapsed=now-this.last;
    if(!this.paused&&!this.reduced&&elapsed<1000/this.fps){this.invalidate();return;}
    const dt=this.paused||this.reduced?0:Math.min(elapsed/1000,0.08);this.last=now;this.time+=dt;
    const windDirection=windVector(this.windAngle,1),heading=Math.atan2(-windDirection.z,windDirection.x);
    this.windSock.rotation.y=heading;
    this.windSock.children.forEach((band,i)=>{band.position.y=-i*.085*(1-this.windDisplay)+Math.sin(this.time*(2+this.windDisplay*5)-i*.7)*.045*this.windDisplay;band.rotation.y=Math.sin(this.time*3-i)*.1*this.windDisplay;});
    this.modelGroup.children.forEach(o=>{if(o.userData.treeCrown){o.rotation.z=Math.sin(this.time*(1+this.windDisplay*3)+o.position.x)*.16*this.windDisplay;o.rotation.x=Math.cos(this.time*1.5+o.position.z)*.09*this.windDisplay;}});
    this.world.rotation.y=THREE.MathUtils.lerp(this.world.rotation.y,this.targetRotation,this.reduced||this.paused?1:0.12);
    const dark=this.effects.rain>0||this.effects.thunder||this.kind==='overcast';
    const blend=this.paused||this.reduced?1:0.12;
    this.hemi.intensity=THREE.MathUtils.lerp(this.hemi.intensity,this.night?0.85:dark?1.8:2.5,blend);
    const phase=this.time%7;
    const stormPulse=this.effects.thunder&&!this.reduced&&!this.paused&&phase<1.3?Math.sin(phase/1.3*Math.PI)*.8:0;
    this.lightning.visible=this.effects.thunder;(this.lightning.material as THREE.MeshBasicMaterial).opacity=.78+stormPulse*.22;
    this.sunRays.quaternion.copy(this.camera.quaternion);this.sunRays.rotateZ(this.time*.045);
    this.mist.children.forEach((layer,i)=>{
      layer.position.set(Math.sin(this.time*.18+i*1.9)*1.35,.78+(i%3)*.31,(i%2?1.4:-1.4));
      (layer as THREE.Sprite).material.opacity=this.effects.fog*(this.effects.dust?.52:.66);(layer as THREE.Sprite).material.color.setHex(this.effects.dust?0xc7a378:0xcbdde0);
    });
    this.ripples.children.forEach((r,i)=>{const p=(this.time*1.1+i/16)%1;r.scale.setScalar(.5+p*3.4);(r as THREE.Mesh<THREE.RingGeometry,THREE.MeshBasicMaterial>).material.opacity=(1-p)*.75*this.effects.rain;});
    if(this.hail.visible){for(let i=0;i<this.hail.count;i++){const h=this.hailState[i];if(dt){h.v-=dt*8;h.y+=h.v*dt;h.x+=dt*.22;if(h.y<.64){if(!h.bounced){h.y=.64;h.v=2.3;h.bounced=true;}else{h.y=4.7;h.x=Math.random()*4-2;h.z=Math.random()*4-2;h.v=-1;h.bounced=false;}}}this.matrix.scale.setScalar(1);this.matrix.position.set(h.x,h.y,h.z);this.matrix.rotation.set(this.time+i,this.time*.7,0);this.matrix.updateMatrix();this.hail.setMatrixAt(i,this.matrix.matrix);}this.hail.instanceMatrix.needsUpdate=true;}
    this.light.intensity=THREE.MathUtils.lerp(this.light.intensity,(this.night?0.55:dark?1.1:3.6)+stormPulse,blend);
    this.light.color.lerp(new THREE.Color(this.night?0xb7c9ed:0xfff1d6),0.1);
    // A camera-relative sky corridor stays behind the island, including when
    // the user rotates a landmark. Normal depth testing keeps spires in front.
    const cameraLength=Math.hypot(this.camera.position.x,this.camera.position.z);
    const backX=-this.camera.position.x/cameraLength,backZ=-this.camera.position.z/cameraLength;
    const rightX=-backZ,rightZ=backX;
    const lateralWind=windDirection.x*rightX+windDirection.z*rightZ;
    this.cloudTravel+=dt*(.08+this.windDisplay*.32)*(lateralWind<0?-1:1);
    const cloudColor=new THREE.Color(this.night?0x677a93:this.effects.thunder?0x596b81:dark?0x7e919f:0xf4f7f4);
    this.clouds.children.forEach((c,i)=>{
      const lateral=THREE.MathUtils.euclideanModulo(this.cloudTravel*(.9+i*.04)+i*1.44+1.2,7.2)-3.6;
      const depth=3.8+(i%2)*.22;
      c.scale.setScalar((.72+(i%3)*.1)*(dark?1.16:1));
      c.position.set(backX*depth+rightX*lateral,3.25+(i%3)*.26+Math.sin(this.time*.4+i)*.09,backZ*depth+rightZ*lateral);
      const mat=(c.children[0] as THREE.Mesh<THREE.SphereGeometry,THREE.MeshStandardMaterial>).material;
      mat.color.lerp(cloudColor,blend);
      // Fade only at the corridor ends so wrapping is invisible.
      mat.opacity=.93*(1-THREE.MathUtils.smoothstep(Math.abs(lateral),2.7,3.6));
    });
    if(this.particles.visible&&dt) {
      const downwind=windVector(this.windAngle,Math.min(this.wind,12)*0.03);
      for(let i=0;i<this.snowPositions.length;i+=3){this.snowPositions[i]+=dt*(Math.sin(this.time+i)*.18+downwind.x+(this.effects.dust?1.3:0));this.snowPositions[i+1]-=dt*(this.effects.dust?.06:.4);this.snowPositions[i+2]+=dt*downwind.z;if(this.snowPositions[i+1]<.56||Math.abs(this.snowPositions[i])>2.7||Math.abs(this.snowPositions[i+2])>2.7){this.snowPositions[i]=Math.random()*4.5-2.25;this.snowPositions[i+1]=4.7;this.snowPositions[i+2]=Math.random()*4.5-2.25;}}
      this.particles.geometry.attributes.position.needsUpdate=true;
    }
    if(this.rain.visible) {
      const downwind=windVector(this.windAngle,Math.min(this.wind,15)*0.12);
      const speed=2.8+this.effects.rain*3.2,length=.22+this.effects.rain*.4;
      this.matrix.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(-downwind.x/speed,1,-downwind.z/speed).normalize());
      this.matrix.scale.set(1+this.effects.rain*.35,length,1+this.effects.rain*.35);
      for(let n=0;n<this.rain.count;n++){const i=n*6;this.rainPositions[i]+=dt*downwind.x;this.rainPositions[i+1]-=dt*speed;this.rainPositions[i+2]+=dt*downwind.z;if(this.rainPositions[i+1]<.55||Math.abs(this.rainPositions[i])>2.8||Math.abs(this.rainPositions[i+2])>2.8){this.rainPositions[i]=Math.random()*4.5-2.25;this.rainPositions[i+1]=4.6;this.rainPositions[i+2]=Math.random()*4.5-2.25;}this.matrix.position.set(this.rainPositions[i],this.rainPositions[i+1]+length*.5,this.rainPositions[i+2]);this.matrix.updateMatrix();this.rain.setMatrixAt(n,this.matrix.matrix);}
      this.rain.instanceMatrix.needsUpdate=true;
    }
    this.renderer.render(this.scene,this.camera);
    if(!this.paused&&!this.reduced)this.invalidate();
  }
  stats(){return {detail:this.detail,model:this.model,kind:this.kind,wind:this.wind,effects:this.effects,quality:this.quality,frames:this.renderer.info.render.frame,drawCalls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,geometries:this.renderer.info.memory.geometries,materials:this.modelMaterials.length,clouds:this.clouds.children.map(c=>({visible:c.visible,position:c.position.toArray()})),layers:{rain:this.rain.visible,snow:this.particles.visible,hail:this.hail.visible,lightning:this.lightning.visible,wind:false,windStrength:this.windDisplay},sockHeading:this.windSock.rotation.y};}
  dispose(){this.alive=false;cancelAnimationFrame(this.raf);this.resizeObserver.disconnect();document.removeEventListener('visibilitychange',this.visibilityHandler);this.scene.traverse(obj=>{if(obj instanceof THREE.Mesh||obj instanceof THREE.Points||obj instanceof THREE.LineSegments){obj.geometry.dispose();const mats=Array.isArray(obj.material)?obj.material:[obj.material];mats.forEach(mat=>{if('map'in mat)(mat.map as THREE.Texture|null)?.dispose();mat.dispose();});}});this.mist.children.forEach(layer=>{const mat=(layer as THREE.Sprite).material;mat.map?.dispose();mat.dispose();});this.snowMap.dispose();this.dustMap.dispose();this.renderer.dispose();this.host.replaceChildren();}
}

