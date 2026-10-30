import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialFlight,stepFlight} from '../src/flight.js';
import {REGION,regionClearance,GATE,atGate,onAirportPavement} from '../src/flight-region.js';
import {mergeStaticMeshes} from '../src/batching.js';
import * as T from 'three';
test('landing continues into low-speed nosewheel taxi and can brake at a stand',()=>{
 const s={...initialFlight(),ground:true,speed:0,throttle:.6,pitch:0,bank:0,y:4.5,z:-500};
 for(let i=0;i<600;i++)stepFlight(s,{ArrowRight:true},1/60);
 assert.ok(s.speed>8&&s.speed<14);assert.ok(s.heading>90);assert.equal(s.done,false);assert.equal(s.bank,0);
 for(let i=0;i<120;i++)stepFlight(s,{' ':true},1/60);
 assert.equal(s.speed,0);assert.equal(s.done,false);
});
test('gate requires a stopped aircraft aligned toward the terminal',()=>{
 assert.equal(atGate(GATE,0,Math.PI/2),true);
 assert.equal(atGate(GATE,4,Math.PI/2),false);
 assert.equal(atGate(GATE,0,0),false);
 assert.equal(atGate({...GATE,x:GATE.x+30},0,Math.PI/2),false);
 for(const p of [{x:0,z:-600},{x:-32,z:-600},{x:-63,z:-900},{x:-108,z:-1350},GATE])assert.ok(onAirportPavement(p));
 assert.equal(onAirportPavement({x:60,z:-800}),false);
});
test('region includes London landmarks and warns before finite scenery ends',()=>{
 for(const p of [{x:0,z:-1000},{x:-565,z:-10553},{x:-810,z:-12831}])assert.ok(regionClearance(p)>0);
 assert.ok(regionClearance({x:REGION.maxX+1,z:0})<0);
 assert.equal(regionClearance({x:0,z:REGION.minZ+500}),500);
});
test('landmark batching preserves metric facade attributes',()=>{
 const g=new T.BoxGeometry(10,20,10),m=new T.MeshStandardMaterial();m.userData.pbrFacade=true;
 const data=[];for(let i=0;i<g.attributes.position.count;i++)data.push(41,1.6,3.8,20);
 g.setAttribute('building',new T.Float32BufferAttribute(data,4));
 const batch=mergeStaticMeshes([new T.Mesh(g,m)]).children[0];
 assert.equal(batch.geometry.attributes.building.count,batch.geometry.attributes.position.count);
 assert.ok(batch.geometry.attributes.building.getY(0)>0);
});
