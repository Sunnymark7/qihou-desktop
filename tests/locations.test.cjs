const test=require('node:test');
const assert=require('node:assert/strict');
const {localSearch,catalog}=require('../electron/locations.cjs');
const {landmarkFor,sanitizeSettings}=require('../electron/weather.cjs');
const landmarks=require('../shared/landmarks.json');
test('offline catalog covers every supported city, aliases and pinyin without duplicates',()=>{
  assert.equal(catalog.length,54);assert.equal(new Set(catalog.map(c=>c.name)).size,54);
  for(const city of catalog){assert.equal(localSearch(city.name+'市')[0].name,city.name);assert.equal(localSearch(city.en)[0].name,city.name);}
  assert.equal(localSearch('乌鲁木齐')[0].timezone,'Asia/Shanghai');assert.equal(localSearch('Har')[0].name,'哈尔滨');assert.deepEqual(localSearch(''),[]);
});
test('all landmarks match their city centers and unrelated cities retain the cottage',()=>{
  for(const landmark of landmarks){assert.equal(landmarkFor({...landmark,name:landmark.city}),landmark.id);assert.equal(localSearch(landmark.name)[0].name,landmark.city);}
  assert.equal(landmarkFor(localSearch('佛山')[0]),null);assert.equal(landmarkFor(localSearch('无锡')[0]),null);
  assert.equal(landmarkFor({latitude:NaN,longitude:0}),null);assert.equal(landmarkFor({latitude:0,longitude:0}),null);
});
test('guide completion is a typed persistent setting',()=>{assert.deepEqual(sanitizeSettings({onboardingComplete:true}),{onboardingComplete:true});assert.deepEqual(sanitizeSettings({onboardingComplete:'yes'}),{});});
