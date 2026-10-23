import assert from 'node:assert/strict';
import {identityKeys,canPropose,exportFullSnapshot,validateFullSnapshot} from './factLedger.js';
const src=[{index:1074,key:'source-hash-1074'}];
const first={id:'p1',scope:'gm:knowledge',factType:'npc_suspicion',sources:src,quote:'Леоне нахмурился, услышав это.',title:'Леоне думает, что Ена лжёт',detail:'Изложение',status:'pending'};
for(const status of ['pending','approved','rejected','split']) {
 assert.equal(canPropose({...first,id:'p-new',title:'Новое название',detail:'Новое описание'},[{...first,status}]),false,`${status} must block`);
}
assert.equal(canPropose({...first,id:'p-new'},[{...first,status:'deleted'}]),true,'deletion unlocks');
assert.equal(canPropose({...first,scope:'gm:inventory'},[first]),true,'different factual category');
assert.equal(canPropose({...first,quote:'Леоне почесал затылок.'},[first]),true,'different evidence');
assert.deepEqual(identityKeys(first),identityKeys({...first,title:'Совершенно другое название'}));
assert.equal(canPropose({...first,quote:'Леоне нахмурился'},[first]),false,'nested exact quote anchors must deduplicate');
const data={archive:{films:[],music:[],books:[],anomalies:[]},beta:{records:[],proposals:[first,{...first,id:'p2',status:'approved'},{...first,id:'p3',status:'rejected'},{...first,id:'p4',status:'deleted'}],history:[],syncCursor:50},notes:'foo'};
const snapshot=exportFullSnapshot(data,['a','b']);
assert.deepEqual(validateFullSnapshot(JSON.parse(JSON.stringify(snapshot))).data,data);
assert.deepEqual(snapshot.statusCounts,{pending:1,approved:1,rejected:1,deleted:1,split:0});
assert.throws(()=>validateFullSnapshot({...snapshot,data:{...data,beta:{...data.beta,proposals:[first,first]}}}),/id/);
const edit=structuredClone(snapshot);edit.data.beta.proposals[0].status='rejected';edit.data.beta.proposals[0].detail='Отредактировано в GPT';
assert.equal(validateFullSnapshot(edit).data.beta.proposals[0].detail,'Отредактировано в GPT');
console.log('Fact ledger: 12 checks passed');
