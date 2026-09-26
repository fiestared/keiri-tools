import {readJSON, writeJSON} from './retention.js';
export const PAYDAY_KEY = 'shiharai_conditions_v1';
const day = v => v === '末' || [5,10,15,20,25].includes(v);
export function validCondition(s) { return !!s && typeof s.label === 'string' && !!s.cond
  && day(s.cond.closing) && day(s.cond.payday) && [0,1,2,3].includes(s.cond.offsetMonths)
  && ['prev','next','none'].includes(s.cond.adjust); }
export function readConditions() {
  const r = readJSON(PAYDAY_KEY, []);
  return r.ok && Array.isArray(r.value) && r.value.every(validCondition)
    ? {ok:true, list:r.value} : {ok:false,list:[]};
}
export function writeConditions(list) { return list.every(validCondition) && writeJSON(PAYDAY_KEY,list); }
