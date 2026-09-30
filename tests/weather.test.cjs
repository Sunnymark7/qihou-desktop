const test = require('node:test');
const assert = require('node:assert/strict');
const { condition, validateLocation, landmarkFor, normalizeWeather, sanitizeSettings, clampBounds, selectedModel, weatherUrl } = require('../electron/weather.cjs');
test('unknown weather never becomes sunshine; all WMO groups normalize', () => {
  assert.equal(condition(999).kind, 'unknown');
  assert.equal(condition(null).kind, 'unknown');
  for (const [code, expected] of [[0,'clear'],[3,'overcast'],[48,'fog'],[57,'freezing-rain'],[67,'freezing-rain'],[77,'snow'],[86,'heavy-snow'],[99,'hail']]) assert.equal(condition(code).kind, expected);
});
test('coordinates accept zero and reject impossible/nonfinite values', () => {
  assert.equal(validateLocation({ latitude: 0, longitude: 0 }).id, '0.00000,0.00000');
  for (const location of [{ latitude: 91, longitude: 10 },{ latitude: 1, longitude: 181 },{ latitude: '', longitude: 1 },{ latitude: NaN, longitude: 1 }]) assert.throws(() => validateLocation(location));
});
test('landmarks follow geographic location and explicit default overrides auto', () => {
  const shanghai = validateLocation({ latitude:31.23, longitude:121.47 });
  assert.equal(landmarkFor(shanghai), 'shanghai');
  assert.equal(landmarkFor({latitude:23.13,longitude:113.26}), 'guangzhou');
  assert.equal(landmarkFor({latitude:51.5,longitude:-0.12}), null);
  assert.equal(selectedModel({location:shanghai,model:'default'}), 'default');
  assert.equal(selectedModel({location:{latitude:0,longitude:0},model:'landmark'}),'default');
});
test('weather timestamps are Unix UTC, not the host time zone; missing readings stay null', () => {
  const location = validateLocation({latitude:31,longitude:121});
  const result = normalizeWeather({ timezone:'Asia/Shanghai', current:{time:1726034400,temperature_2m:0,weather_code:71,is_day:0}, hourly:{time:[1726030800,1726034400],temperature_2m:[1,0]},daily:{sunrise:[1726000000]} },location,42);
  assert.equal(result.dataTime,1726034400000); assert.equal(result.fetchedAt,42); assert.equal(result.isDay,false);
  assert.equal(result.feelsLike,null); assert.equal(result.low,null); assert.equal(result.hours.length,1); assert.equal(result.hours[0].temperature,0);
  assert.equal(result.timezone,'Asia/Shanghai'); assert.equal(result.locationId,location.id);
  assert.throws(() => normalizeWeather({current:{time:1,temperature_2m:null}},location));
});
test('IPC setting patches cannot change location or native mode', () => {
  assert.deepEqual(sanitizeSettings({ location:{latitude:1}, mode:'wallpaper', fps:1000, size:9999, paused:true, alwaysOnTop:'yes' }),{paused:true,size:540});
});
test('disconnected monitor coordinates are recovered; negative monitor coordinates remain valid', () => {
  const displays = [{x:0,y:0,width:1920,height:1040},{x:-1280,y:0,width:1280,height:1024}];
  assert.equal(clampBounds({x:-1000,y:10,width:360,height:390},displays).x,-1000);
  const b = clampBounds({x:4000,y:3000,width:360,height:390},displays);
  assert.equal(b.x,1560); assert.equal(b.y,650);
});
test('API requests declare units and unix time explicitly', () => {
  const u = new URL(weatherUrl({latitude:0,longitude:0}));
  assert.equal(u.searchParams.get('timeformat'),'unixtime'); assert.equal(u.searchParams.get('wind_speed_unit'),'ms');
});
test('meteorological from-direction becomes cardinal downwind movement', async () => {
  const {windVector}=await import('../src/wind.mjs');
  for(const [angle,x,z] of [[0,0,-1],[90,-1,0],[180,0,1],[270,1,0]]) {
    const vector=windVector(angle);assert.ok(Math.abs(vector.x-x)<1e-10);assert.ok(Math.abs(vector.z-z)<1e-10);
  }
});
