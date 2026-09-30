const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const config=require('../package.json');
const executable=path.resolve(__dirname,'..',config.build.directories.output,'win-unpacked','Qihou.exe');
// Windows holds a write lock on a running executable. Check before the builder
// clears its output directory, so an in-use installation is never partly removed.
if(process.platform==='win32'&&fs.existsSync(executable)){
  try{const handle=fs.openSync(executable,'r+');fs.closeSync(handle);}
  catch{console.error('目标目录的栖候正在运行或不可写。请从托盘退出该实例，或更换 build.directories.output 后再打包。');process.exit(1);}
}
const result=spawnSync(process.execPath,[require.resolve('electron-builder/cli.js'),'--win',...process.argv.slice(2),'--publish','never'],{stdio:'inherit',windowsHide:true});
process.exit(result.status??1);
