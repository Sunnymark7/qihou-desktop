const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {airUrl,normalizeAir,appendSample,createEnvironment}=require('../electron/environment.cjs');
const now=Date.parse('2026-09-11T12:00:00Z');
const location={id:'shanghai',latitude:31.23,longitude:121.47};
const data=()=>({current:{time:now/1000,us_aqi:72,pm2_5:16.5,pm10:null},hourly:{time:[now/1000,now/1000+3600,now/1000+7200],us_aqi:[72,null,81],pm2_5:[16.5,17,18],pm10:[null,null,24]}});
const response=()=>new Response(JSON.stringify(data()));

test('air API declares UTC seconds, US AQI, pollutant fields; missing values remain gaps',()=>{
  const url=new URL(airUrl(location));assert.equal(url.hostname,'air-quality-api.open-meteo.com');assert.equal(url.searchParams.get('timeformat'),'unixtime');assert.equal(url.searchParams.get('hourly'),'us_aqi,pm2_5,pm10');
  const air=normalizeAir(data(),location,now);assert.equal(air.time,now);assert.equal(air.standard,'US AQI');assert.equal(air.pm10,null);assert.equal(air.hours[1].aqi,null);assert.equal(air.pm25,16.5);
});
test('air normalization rejects stale, malformed and all-missing current data',()=>{
  assert.throws(()=>normalizeAir(data(),location,now+7*3600000));assert.throws(()=>normalizeAir({},location,now));
  const missing=data();missing.current={time:now/1000,us_aqi:null,pm2_5:'0',pm10:-1};assert.throws(()=>normalizeAir(missing,location,now));
  const zero=data();zero.current.us_aqi=0;assert.equal(normalizeAir(zero,location,now).aqi,0);
});
test('records deduplicate source timestamps, preserve negative temperature, expire old and reject future samples',()=>{
  let samples=appendSample([],{time:now,temperature:-5},now);samples=appendSample(samples,{time:now,temperature:-4},now);assert.equal(samples.length,1);assert.equal(samples[0].temperature,-4);
  assert.equal(appendSample(samples,{time:now+3600000,temperature:9},now).length,1);
  assert.equal(appendSample(samples,{time:now-169*3600000,temperature:9},now).length,1);
});
test('air failures retain prior valid air and do not affect weather records; refresh is throttled',async()=>{
  let time=now,calls=0;const env=createEnvironment({now:()=>time,fetch:async()=>{if(++calls>1)throw Error('offline');return response();}});
  env.select(location);env.record({locationId:location.id,dataTime:now,temperature:22,humidity:null,wind:0,provider:'MET Norway'});
  await env.refresh(location);await env.refresh(location);assert.equal(calls,1);assert.equal(env.state().history.weather.length,1);
  time+=16*60000;await env.refresh(location);assert.equal(env.state().air.aqi,72);assert.match(env.state().error,/offline/);assert.equal(env.state().loading,false);env.dispose();
});
test('late result for a previous city never overwrites selected city or its history',async()=>{
  let finish;const env=createEnvironment({now:()=>now,fetch:()=>new Promise(resolve=>finish=resolve)});
  const pending=env.refresh(location);env.select({...location,id:'qingdao'});finish(response());await pending;
  assert.equal(env.state().air,null);assert.deepEqual(env.state().history,{weather:[],air:[]});env.dispose();
});
test('records and valid air survive restart but never leak into a different city',async()=>{
  const folder=path.resolve('.test-data');fs.mkdirSync(folder,{recursive:true});const file=path.join(folder,`environment-unit-${process.pid}.json`);
  try{
    const env=createEnvironment({fetch:async()=>response(),now:()=>now,file});env.select(location);env.record({locationId:location.id,dataTime:now,temperature:21,humidity:70,wind:2,provider:'Weather'});await env.refresh(location);env.dispose();
    const restarted=createEnvironment({fetch:async()=>response(),now:()=>now+1000,file});restarted.select(location);assert.equal(restarted.state().air.aqi,72);assert.equal(restarted.state().history.weather[0].temperature,21);
    restarted.select({...location,id:'different'});assert.equal(restarted.state().air,null);assert.equal(restarted.state().history.weather.length,0);
    restarted.select(location);assert.equal(restarted.state().history.weather[0].temperature,21);assert.equal(restarted.state().air.aqi,72);restarted.dispose();
  }finally{if(fs.existsSync(file))fs.unlinkSync(file);if(fs.existsSync(file+'.tmp'))fs.unlinkSync(file+'.tmp');for(const name of fs.readdirSync(folder).filter(n=>n.startsWith(path.basename(file)+'.')))fs.unlinkSync(path.join(folder,name));}
});
