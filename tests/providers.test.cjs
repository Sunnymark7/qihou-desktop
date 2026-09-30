const test=require('node:test');
const assert=require('node:assert/strict');
const {createWeatherService,normalizeMet,normalizeOwm,normalizeQw,metCondition,qwCondition,owmCondition,validateCredentials}=require('../electron/providers.cjs');
const {condition,landmarkFor,selectedModel,sanitizeSettings}=require('../electron/weather.cjs');
const landmarks=require('../shared/landmarks.json');
const now=Date.parse('2026-09-11T04:00:00Z');
const location={id:'demo',latitude:31.2304,longitude:121.4737,country:'中国',timezone:'Asia/Shanghai'};
const open=()=>({timezone:'Asia/Shanghai',current:{temperature_2m:23,time:now/1000,weather_code:95}});
const met=()=>({properties:{meta:{updated_at:new Date(now-3600000).toISOString()},timeseries:[0,1,2,3,4].map(i=>({time:new Date(now+i*3600000).toISOString(),data:{instant:{details:{air_temperature:20+i,wind_speed:5,wind_from_direction:90}},next_1_hours:{summary:{symbol_code:'heavysleetandthunder'},details:{precipitation_amount:2}}}}))}});
const response=(data,headers={})=>new Response(JSON.stringify(data),{status:200,headers});
test('all 16 city centers choose their own landmark and custom model leaves weather location independent',()=>{
  assert.equal(landmarks.length,16);for(const l of landmarks)assert.equal(landmarkFor(l),l.id);
  assert.equal(selectedModel({location,model:'landmark',landmarkId:'beijing'}),'beijing');
  assert.deepEqual(sanitizeSettings({landmarkId:'<script>',quality:'max',weatherSource:'https://evil'}),{});
});
test('hail, freezing rain, mixed and thunder snow retain separate phenomena',()=>{
  assert.equal(condition(99).kind,'hail');assert.equal(condition(67).kind,'freezing-rain');
  assert.equal(condition(95).effects.hail,0);assert.equal(condition(99).effects.thunder,true);
  assert.equal(metCondition('heavysnowandthunder_night').kind,'thunder-snow');
  const mixed=metCondition('sleetandthunder');assert.ok(mixed.effects.rain&&mixed.effects.snow&&mixed.effects.thunder);
  assert.equal(qwCondition(304).kind,'hail');assert.equal(owmCondition(511).kind,'freezing-rain');assert.equal(owmCondition(616).kind,'sleet');
});
test('MET uses valid forecast time, no invented feels-like, daily extrema, probabilities, or 6-hour rain rate',()=>{
  const data=met();const w=normalizeMet(data,location,now);assert.equal(w.dataTime,now);assert.equal(w.dataType,'forecast');assert.equal(w.feelsLike,null);assert.equal(w.high,null);assert.equal(w.hours[0].precipitation,null);assert.equal(w.precipitation,2);
  data.properties.timeseries[0].data.next_6_hours=data.properties.timeseries[0].data.next_1_hours;delete data.properties.timeseries[0].data.next_1_hours;
  assert.equal(normalizeMet(data,location,now).precipitation,null);
  assert.throws(()=>normalizeMet(data,location,now+20*3600000));
});
test('OpenWeather keeps Celsius and m/s; instantaneous min/max are not daily extrema',()=>{
  const w=normalizeOwm({dt:now/1000,main:{temp:0,temp_min:-2,temp_max:3,humidity:0},wind:{speed:4},timezone:28800,weather:[{id:611,icon:'13n'}]},location,now);
  assert.equal(w.temperature,0);assert.equal(w.humidity,0);assert.equal(w.wind,4);assert.equal(w.high,null);assert.equal(w.isDay,false);assert.equal(w.utcOffsetSeconds,28800);assert.equal(w.kind,'sleet');
});
test('QWeather current v1 preserves missing observation time and validates units',()=>{
  const data={temperature:{value:0,unit:'°C'},humidity:.5,wind:{speed:{value:3,unit:'m/s'}},condition:{code:'304'}};
  const w=normalizeQw(data,location,now);assert.equal(w.dataTime,null);assert.equal(w.fetchedAt,now);assert.equal(w.humidity,50);assert.equal(w.wind,3);assert.equal(w.kind,'hail');assert.equal(w.hours.length,0);
  assert.throws(()=>normalizeQw({...data,temperature:{value:273,unit:'K'}},location,now));
});
test('failed primary automatically switches independent provider; cooldown avoids repeat request',async()=>{
  let calls=[];const service=createWeatherService({now:()=>now,fetch:async url=>{calls.push(url);return url.includes('open-meteo')?new Response('',{status:503}):response(met());}});
  const w=await service.get(location);assert.equal(w.providerId,'metno');assert.equal(w.fallback,true);assert.ok(w.sourceNote.includes('503'));
  await service.get(location);assert.equal(calls.filter(u=>u.includes('open-meteo')).length,1);
});
test('429 honors Retry-After without retrying that provider early',async()=>{
  let time=now,calls=0;const service=createWeatherService({now:()=>time,fetch:async url=>{if(url.includes('open-meteo')){calls++;return new Response('',{status:429,headers:{'Retry-After':'3600'}});}return response(met());}});
  await service.get(location);time+=20*60000;await service.get(location);assert.equal(calls,1);assert.equal(service.statuses()[0].retryAt,now+3600000);
});
test('malformed successful HTTP response also fails over',async()=>{
  const service=createWeatherService({now:()=>now,fetch:async url=>response(url.includes('open-meteo')?{current:{temperature_2m:null}}:met())});
  assert.equal((await service.get(location)).providerId,'metno');
});
test('per-provider timeout switches source while caller cancellation stops the chain',async()=>{
  const fetch=async(url,{signal})=>url.includes('open-meteo')?new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')))):response(met());
  const service=createWeatherService({now:()=>now,timeoutMs:20,fetch});assert.equal((await service.get(location)).providerId,'metno');
  const controller=new AbortController();controller.abort();await assert.rejects(()=>service.get(location,'auto',controller.signal));
});
test('all source failures reject; no fake sunshine or successful weather is generated',async()=>{
  const service=createWeatherService({now:()=>now,fetch:async()=>new Response('',{status:503})});await assert.rejects(service.get(location),/可用天气源均未成功/);
});
test('MET respects Expires and conditional Last-Modified; explicit client identity and rounded coordinates',async()=>{
  let calls=0,time=now;const last=new Date(now-3600000).toUTCString();
  const service=createWeatherService({now:()=>time,fetch:async(url,options)=>{calls++;assert.match(options.headers['User-Agent'],/QihouWeather/);assert.match(url,/lat=31\.2304&lon=121\.4737/);if(calls===2){assert.equal(options.headers['If-Modified-Since'],last);return new Response(null,{status:304});}return response(met(),{'Expires':new Date(now+10*60000).toUTCString(),'Last-Modified':last});}});
  await service.get(location,'metno');await service.get(location,'metno');assert.equal(calls,1);time+=11*60000;await service.get(location,'metno');assert.equal(calls,2);
});
test('credentials cannot redirect to arbitrary hosts and error/status never expose key',async()=>{
  for(const host of ['https://foo.qweatherapi.com','evil.com','qweatherapi.com.evil.com','foo.qweatherapi.com/path'])assert.throws(()=>validateCredentials({qweatherHost:host}));
  assert.equal(validateCredentials({qweatherHost:'abc.xy.qweatherapi.com'}).qweatherHost,'abc.xy.qweatherapi.com');
  const key='testkey00000001';const service=createWeatherService({now:()=>now,getCredentials:()=>({openweather:key}),fetch:async url=>{throw Error(url);}});
  try{await service.get(location,'openweather');assert.fail();}catch(e){assert.ok(!e.message.includes(key));}
  assert.ok(!JSON.stringify(service.statuses()).includes(key));
});
test('unconfigured preferred source is skipped while default no-key sources work',async()=>{
  const service=createWeatherService({now:()=>now,fetch:async()=>response(open())});assert.equal((await service.get(location,'qweather')).providerId,'openmeteo');
});
