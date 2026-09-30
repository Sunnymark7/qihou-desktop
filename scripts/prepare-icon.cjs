// Packaging conversion only; ChatGPT artwork remains assets/icon-master.png.
// Run with Electron, not Node: electron scripts/prepare-icon.cjs
const {app,nativeImage}=require('electron');
const fs=require('node:fs');
const path=require('node:path');
app.whenReady().then(()=>{
  const original=nativeImage.createFromPath(path.join(__dirname,'../assets/icon-master.png'));
  if(original.isEmpty())throw Error('Icon artwork is missing');
  fs.writeFileSync(path.join(__dirname,'../assets/icon.png'),original.resize({width:256,height:256,quality:'best'}).toPNG());
  fs.writeFileSync(path.join(__dirname,'../assets/tray.png'),original.resize({width:32,height:32,quality:'best'}).toPNG());
  const sizes=[16,24,32,48,64,128,256];
  const frames=sizes.map(size=>original.resize({width:size,height:size,quality:'best'}).toPNG());
  const header=Buffer.alloc(6+sizes.length*16);header.writeUInt16LE(1,2);header.writeUInt16LE(sizes.length,4);
  let offset=header.length;
  sizes.forEach((size,i)=>{const p=6+i*16;header[p]=header[p+1]=size===256?0:size;header.writeUInt16LE(1,p+4);header.writeUInt16LE(32,p+6);header.writeUInt32LE(frames[i].length,p+8);header.writeUInt32LE(offset,p+12);offset+=frames[i].length;});
  fs.writeFileSync(path.join(__dirname,'../assets/icon.ico'),Buffer.concat([header,...frames]));
  console.log('Prepared Windows ICO sizes: '+sizes.join(', '));app.quit();
}).catch(error=>{console.error(error);app.exit(1);});
