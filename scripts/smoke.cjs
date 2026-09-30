const { spawn } = require('node:child_process');
const path = require('node:path');
const packaged = process.argv.includes('--packaged');
const executable = packaged ? path.join(__dirname,'..',require('../package.json').build.directories.output,'win-unpacked/Qihou.exe') : require('electron');
const env={...process.env,QIHOU_SMOKE:'1',QIHOU_TEST_DIR:path.join(__dirname,'..')};
env.QIHOU_TEST_SIGNING_KEY=path.join(process.env.LOCALAPPDATA||'', 'Qihou-Publisher', 'license-private.pem');
delete env.ELECTRON_RUN_AS_NODE;
const child=spawn(executable,packaged?[]:[path.join(__dirname,'..')],{env,stdio:'inherit',windowsHide:true});
child.on('exit',code=>process.exit(code??1));
