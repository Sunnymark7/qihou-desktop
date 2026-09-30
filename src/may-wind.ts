import * as THREE from 'three';

// Observed silhouette: broad painted steel bands, offset open ends, widest above
// the midpoint, compact foot and a stepped vertical finial. See docs/may-wind.md.
// This is a geometric interpretation of the sculpture, not survey/CAD data.
export function mayWind(group:THREE.Group, material:(color:number,extra?:Partial<THREE.MeshStandardMaterialParameters>)=>THREE.MeshStandardMaterial){
  const lacquer=material(0xd82b29,{metalness:.22,roughness:.36});
  const base=material(0x646c65,{roughness:.93});
  const place=(geometry:THREE.BufferGeometry,mat:THREE.Material,y:number)=>{const mesh=new THREE.Mesh(geometry,mat);mesh.position.set(-.22,y,-.3);mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);return mesh;};
  place(new THREE.CylinderGeometry(.76,.81,.17,48),base,.63);
  place(new THREE.CylinderGeometry(.38,.42,.38,40),lacquer,.86);
  place(new THREE.CylinderGeometry(.18,.31,2.38,32),lacquer,2.02);
  const layers=[
    [.43,.87],[.5,1.08],[.66,1.30],[.85,1.54],[1.08,1.81],
    [1.39,2.12],[1.30,2.40],[1.10,2.66],[.84,2.91],[.55,3.16],[.29,3.37],
  ];
  layers.forEach(([radius,y],level)=>{
    const thickness=level>8?.105:.15,depth=Math.min(.32,radius*.53);
    const start=level*.57+.45,sweep=Math.PI*(level<2?1.97:1.84),steps=96;
    const vertices:number[]=[],indices:number[]=[];
    const point=(step:number,corner:number)=>{
      const t=step/steps,angle=start+sweep*t;
      const r=radius-(corner===1||corner===2?depth:0);
      // Each ribbon rises towards its cut end; neighboring ends are staggered.
      return [Math.cos(angle)*r,y+t*.115+(corner>=2?-thickness/2:thickness/2),Math.sin(angle)*r];
    };
    // Separate vertex strips preserve the four hard edges of the steel section.
    for(let side=0;side<4;side++){
      const offset=vertices.length/3;
      for(let i=0;i<=steps;i++)vertices.push(...point(i,side),...point(i,(side+1)%4));
      for(let i=0;i<steps;i++){const a=offset+i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}
    }
    for(const end of [0,steps]){const offset=vertices.length/3;for(let c=0;c<4;c++)vertices.push(...point(end,c));if(end===0)indices.push(offset,offset+2,offset+1,offset,offset+3,offset+2);else indices.push(offset,offset+1,offset+2,offset,offset+2,offset+3);}
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();
    place(geometry,lacquer,0);
  });
  const finial=new THREE.Group();finial.position.set(-.22,3.43,-.3);group.add(finial);
  for(const [x,z,w,h] of [[-.09,0,.14,.28],[.03,-.04,.13,.48],[.09,.08,.11,.18]]){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,.14),lacquer);mesh.position.set(x,h/2,z);mesh.castShadow=true;finial.add(mesh);}
}
