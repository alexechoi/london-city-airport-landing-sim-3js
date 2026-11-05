import { chromium } from 'playwright';
import { cinematicPose } from '../src/cinematic.js';
import { mkdir, copyFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

// A short review film isolates the two districts changed in this revision.
// Keep the full tour alongside it; this does not overwrite public/flythrough.mp4.
const fps=24, shotDuration=5, starts=[8.5,24.5], frames=fps*shotDuration*starts.length;
const directory='work/district-frames';
await rm(directory,{recursive:true,force:true});
await mkdir(directory,{recursive:true});
const browser=await chromium.launch({
  executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',
  args:['--no-sandbox','--use-gl=angle','--use-angle='+(process.env.CAPTURE_ANGLE||'gl-egl'),'--ignore-gpu-blocklist','--enable-unsafe-swiftshader'],
});
const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
page.setDefaultTimeout(240000);
try {
  await page.goto((process.env.SITE_URL||'http://localhost:4173')+'/?demo&capture');
  await page.waitForFunction(()=>{if(window.__ready){sim.freeze();return true;}return false;});
  await page.waitForFunction(()=>document.getElementById('loading').hidden);
  await page.evaluate(()=>document.fonts.ready);
  const sites=await page.evaluate(()=>sim.landmarks);
  const positions=Array.from({length:frames},(_,i)=>cinematicPose(starts[Math.floor(i/(fps*shotDuration))]+(i%(fps*shotDuration))/fps,sites).position.toArray());
  const intersects=await page.evaluate(points=>points.filter(([x,y,z])=>sim.buildings.some(b=>y<b.h+3&&x>b.minX-14&&x<b.maxX+14&&z>b.minZ-14&&z<b.maxZ+14)).length,positions);
  if(intersects)throw new Error(`Tour intersects scenery in ${intersects} samples`);
  console.log(`Cleared ${positions.length} banked-flight positions against current scenery`);
  await page.evaluate(()=>{sim.renderAt(34);document.getElementById('caption').hidden=true;});
  await page.screenshot({path:'public/screenshots/o2.png'});
  await page.evaluate(()=>{const [x,y,z]=sim.landmark.position;sim.inspect([x-290,y+50,z-240],[x,150,z]);});
  await page.screenshot({path:'public/screenshots/one-canada-square.png'});
  for(const [name,dx,dz] of [['ne',160,160],['se',-160,160],['north',210,0]]) {
    await page.evaluate(({dx,dz})=>{const [x,y,z]=sim.landmarks.gherkin.position;sim.inspect([x+dx,155,z+dz],[x,90,z]);},{dx,dz});
    await page.screenshot({path:`work/screenshots/gherkin-${name}.jpg`,type:'jpeg',quality:95});
  }
  await copyFile('work/screenshots/gherkin-se.jpg','public/screenshots/gherkin.jpg');
  await page.evaluate(()=>{sim.start('demo');sim.renderAt(10);});
  await page.screenshot({path:'public/screenshots/city.jpg',type:'jpeg',quality:95});
  await page.evaluate(()=>{sim.renderAt(26);});
  await page.screenshot({path:'public/screenshots/skyline.jpg',type:'jpeg',quality:95});
  for(let i=0;i<frames;i++) {
    const time=starts[Math.floor(i/(fps*shotDuration))]+(i%(fps*shotDuration))/fps;
    await page.evaluate(t=>sim.renderAt(t),time);
    await page.screenshot({path:`${directory}/${String(i).padStart(5,'0')}.jpg`,type:'jpeg',quality:94});
    if(errors.length)throw new Error(errors.join('\n'));
    if(i%24===0)console.log(`Captured ${i}/${frames}`,new Date().toISOString());
  }
} finally {
  await browser.close();
}
const encoded=spawnSync('ffmpeg',[
  '-y','-framerate',String(fps),'-i',`${directory}/%05d.jpg`,
  '-c:v','libx264','-crf','18','-preset','medium','-pix_fmt','yuv420p',
  '-movflags','+faststart','work/district-flythrough.mp4',
],{stdio:'inherit'});
if(encoded.status!==0)throw new Error('Video encode failed');
const checked=spawnSync('ffmpeg',['-v','error','-i','work/district-flythrough.mp4','-f','null','-'],{stdio:'inherit'});
if(checked.status!==0)throw new Error('Video decode validation failed');
await copyFile('work/district-flythrough.mp4','public/district-flythrough.mp4');
console.log('PASS: 10-second, 720p, 24fps district flythrough; no browser or decode errors.');
