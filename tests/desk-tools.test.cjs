const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createDeskTools,daysUntil,validDate}=require('../electron/desk-tools.cjs');
test('countdown uses calendar days across leap days and rejects invalid dates',()=>{
  assert.equal(daysUntil('2028-03-01',new Date(2028,1,28,23,59)),2);assert.equal(daysUntil('2028-02-28',new Date(2028,1,29,1)), -1);
  assert.equal(validDate('2027-02-29'),false);assert.equal(validDate('2028-02-29'),true);assert.equal(validDate('2026-13-01'),false);
});
test('desk notes, dates, skins and position persist; limits and invalid edits preserve data',()=>{
  const file=path.resolve('.test-data',`desk-unit-${process.pid}.json`);
  try{
    const tools=createDeskTools(file);tools.command({action:'note',title:'今天',text:'<script>not executable</script>\n记得散步',pinned:true,color:'rose'});
    const note=tools.state().notes[0];tools.command({action:'note',id:note.id,title:'明天',text:'更新后的内容',pinned:false,color:'blue'});
    tools.command({action:'countdown',title:'旅行',date:'2028-02-29',pinned:true});tools.command({action:'skin',skin:'coast'});tools.command({action:'position',x:-100,y:250});tools.command({action:'visibility',visible:true});
    assert.deepEqual(createDeskTools(file).state(),tools.state());assert.equal(JSON.parse(tools.backup()).notes[0].text,'更新后的内容');
    assert.throws(()=>tools.command({action:'countdown',title:'错误日期',date:'2027-02-29'}));assert.throws(()=>tools.command({action:'skin',skin:'https://evil'}));assert.throws(()=>tools.command({action:'note',id:'missing',title:'x',text:'x'}));
    for(let i=0;i<7;i++)tools.command({action:'note',title:'Note '+i,text:'Content'});assert.throws(()=>tools.command({action:'note',title:'Ninth',text:'Too many'}));
    const copy=tools.state();copy.notes=[];assert.equal(tools.state().notes.length,8);tools.command({action:'remove',type:'note',id:note.id});assert.equal(tools.state().notes.length,7);
  }finally{if(fs.existsSync(file))fs.unlinkSync(file);if(fs.existsSync(file+'.tmp'))fs.unlinkSync(file+'.tmp');}
});
