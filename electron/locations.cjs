const cities = require('../shared/cities.json');
const landmarks = require('../shared/landmarks.json');
const {validateLocation} = require('./weather.cjs');
const normalize = text => String(text || '').trim().toLowerCase().replace(/[\s’']/g, '').replace(/市$/, '');
// City centers are approximate choices, not street addresses. No network is used here.
const catalog = [...landmarks.map(l => ({name:l.city,en:l.en,admin:'内置城市中心',latitude:l.latitude,longitude:l.longitude})), ...cities]
  .filter((city,index,all) => all.findIndex(c => c.name === city.name) === index);
function localSearch(query) {
  const key = normalize(query);
  if (key.length < 2) return [];
  const exact = catalog.filter(c => [c.name,c.en].some(s => normalize(s) === key));
  const matches = exact.length ? exact : catalog.filter(c => [c.name,c.en].some(s => normalize(s).startsWith(key)));
  const building = landmarks.find(l => l.name === query.trim());
  if (!matches.length && building) matches.push(catalog.find(c => c.name === building.city));
  return matches.slice(0,12).map(c => validateLocation({...c,country:'中国',timezone:'Asia/Shanghai',admin:c.admin+' · 约略城市中心'}));
}
module.exports = {localSearch,catalog};
