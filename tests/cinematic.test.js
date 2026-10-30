import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cinematicPose} from '../src/cinematic.js';
const sites={shard:{position:[0,0,0],height:309},gherkin:{position:[500,0,0],height:180},eye:{position:[1000,0,0],height:135}};
test('cinematic remains finite with an early RAF timestamp and across every cut and loop',()=>{
  // RAF can carry the beginning-of-frame timestamp from before module startup ended.
  for(const time of [-.016,0,7.999,8,16,24,32,40,47.999,48,96]) {
    const pose=cinematicPose(time,sites);
    assert.ok(pose.segment>=0&&pose.segment<6);
    for(const vector of [pose.position,pose.camera,pose.target])assert.ok(vector.toArray().every(Number.isFinite));
    assert.ok(Number.isFinite(pose.yaw)&&Number.isFinite(pose.bank));
  }
});
