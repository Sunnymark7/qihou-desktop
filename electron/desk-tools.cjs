const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const skins=require('../shared/skins.json');
function validDate(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const d=new Date(value+'T00:00:00Z');return Number.isFinite(+d)&&d.toISOString().slice(0,10)===value&&value>='2000-01-01'&&value<='2200-12-31';}
function daysUntil(date,now=new Date()){if(!validDate(date))throw Error('日期无效');const today=Date.UTC(now.getFullYear(),now.getMonth(),now.getDate());return Math.round((Date.parse(date+'T00:00:00Z')-today)/86400000);}
function createDeskTools(file){
  let data={notes:[],countdowns:[],skin:'garden',visible:false,position:null};
  try{const saved=JSON.parse(fs.readFileSync(file,'utf8'));if(Array.isArray(saved.notes))data.notes=saved.notes.filter(n=>typeof n.id==='string'&&typeof n.text==='string').slice(0,8).map(n=>({...n,title:String(n.title||'便签').slice(0,40),text:n.text.slice(0,4000)}));if(Array.isArray(saved.countdowns))data.countdowns=saved.countdowns.filter(c=>typeof c.id==='string'&&validDate(c.date)).slice(0,8).map(c=>({...c,title:String(c.title||'重要的日子').slice(0,40)}));if(skins.some(s=>s.id===saved.skin))data.skin=saved.skin;data.visible=!!saved.visible;if(Number.isFinite(saved.position?.x)&&Number.isFinite(saved.position?.y))data.position=saved.position;}catch{}
  function save(){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file+'.tmp',JSON.stringify(data));fs.renameSync(file+'.tmp',file);}
  function command(c){
    if(!c||typeof c!=='object')throw Error('工具操作无效');
    if(c.action==='visibility')data.visible=!!c.visible;
    else if(c.action==='position'){if(!Number.isFinite(c.x)||!Number.isFinite(c.y))throw Error('坐标无效');data.position={x:c.x,y:c.y};}
    else if(c.action==='skin'){if(!skins.some(s=>s.id===c.skin))throw Error('皮肤不存在');data.skin=c.skin;}
    else if(['note','countdown'].includes(c.action)){
      const items=c.action==='note'?data.notes:data.countdowns,title=String(c.title||'').trim();
      if(!title||title.length>40)throw Error('标题需要 1–40 个字');
      const item={id:c.id||crypto.randomUUID(),title,pinned:c.pinned!==false,updatedAt:Date.now()};
      if(c.action==='note'){if(typeof c.text!=='string'||c.text.length>4000)throw Error('便签最多 4000 字');item.text=c.text;item.color=['cream','rose','blue'].includes(c.color)?c.color:'cream';}
      else{if(!validDate(c.date))throw Error('请选择有效日期');item.date=c.date;}
      const i=items.findIndex(p=>p.id===c.id);if(c.id&&i<0)throw Error('条目不存在');if(i>=0)items[i]=item;else{if(items.length>=8)throw Error('最多保存 8 个条目');items.push(item);}
    }else if(c.action==='remove'){const key=c.type==='note'?'notes':c.type==='countdown'?'countdowns':null;if(!key)throw Error('类型无效');data[key]=data[key].filter(p=>p.id!==c.id);}
    else throw Error('工具操作无效');save();return state();
  }
  function state(){return structuredClone(data);}
  return {state,command,backup:()=>JSON.stringify({product:'qihou-desk-tools',version:1,...data},null,2)};
}
module.exports={createDeskTools,validDate,daysUntil};
