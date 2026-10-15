import test from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../src/store.js';
import { presets } from '../src/engine.js';
import { createServer } from '../src/server.js';
test('API: concurrencia, autorización, snapshot, reconexión y errores',async t=>{
 const admin='http-test-administrator-key-123456789',store=new Store(null,admin),c=store.createCourt(admin,{name:'Pista'}),m=store.createMatch(admin,{courtId:c.id,names:['A','B'],format:presets()[0].format});store.startMatch(admin,m.id);const screen=store.createScreen(admin,{name:'TV',matchId:m.id});
 const server=createServer(store);await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
 const base=`http://127.0.0.1:${server.address().port}`,path=`/api/v1/screens/${screen.id}`;
 const post=(key,body,token=admin)=>fetch(base+path+'/commands',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json','Idempotency-Key':key},body:JSON.stringify(body)});
 const responses=await Promise.all([post('simultaneous1',{type:'point',side:0,expectedVersion:1}),post('simultaneous2',{type:'point',side:1,expectedVersion:1})]);assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);
 const snapshot=await fetch(base+path+'/snapshot',{headers:{Authorization:`Bearer ${screen.displayToken}`}}).then(r=>r.json());assert.equal(snapshot.match.version,2);
 const events=await fetch(base+path+'/events?after_sequence=0',{headers:{Authorization:`Bearer ${screen.displayToken}`}}).then(r=>r.json());assert.equal(events.lastSequence,snapshot.lastSequence);assert.ok(events.events.some(e=>e.type==='sports.point_awarded'));
 assert.equal((await fetch(base+'/api/v1/admin')).status,401);assert.equal((await post('read-only-key',{type:'point',side:0,expectedVersion:2},screen.displayToken)).status,403);
 const invalid=await fetch(base+'/api/v1/courts',{method:'POST',headers:{'Content-Type':'application/json'},body:'{'});assert.equal(invalid.status,400);
 const cross=await fetch(base+'/api/v1/courts',{method:'POST',headers:{Origin:'http://evil.test','Content-Type':'application/json'},body:'{}'});assert.equal(cross.status,403);
 assert.equal((await fetch(base+'/')).status,200);assert.equal((await fetch(base+'/api/v1/health')).status,200);
});
