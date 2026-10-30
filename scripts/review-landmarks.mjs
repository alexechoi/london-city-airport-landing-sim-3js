import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle='+(process.env.CAPTURE_ANGLE||'gl-egl'),'--ignore-gpu-blocklist','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
page.setDefaultTimeout(180000);
await mkdir('public/screenshots',{recursive:true});
await mkdir('work/screenshots',{recursive:true});
await page.goto((process.env.SITE_URL||'http://localhost:4173')+'/?demo&capture');
await page.waitForFunction(()=>{if(window.__ready){sim.freeze();return true;}return false;});
await page.waitForFunction(()=>document.getElementById('loading').hidden);
for(const [name,time] of [['shard',2],['city',10],['eye',18],['skyline',26],['o2',34],['approach',45],['touchdown',47.333]]){
  await page.evaluate(t=>sim.renderAt(t),time);
  await page.screenshot({path:`public/screenshots/${name}.jpg`,type:'jpeg',quality:95});
  console.log('Reviewed',name);
}
for(const [site,name,offset] of [['dockside','newham-dockside',[-100,60,-160]],['crystal','city-hall',[95,60,-105]]]){
  await page.evaluate(({site,offset})=>{document.getElementById('caption').hidden=true;const [x,y,z]=sim.landmarks[site].position;sim.inspect([x+offset[0],offset[1],z+offset[2]],[x,9,z]);},{site,offset});
  await page.screenshot({path:`public/screenshots/${name}.png`});
  console.log('Reviewed',name);
}
await page.evaluate(()=>sim.inspect([-160,65,-1830],[-60,1,-1150]));
await page.screenshot({path:'public/screenshots/airfield.png'});
await page.setViewportSize({width:390,height:844});
await page.waitForFunction(()=>innerWidth===390&&document.getElementById('world').width===Math.floor(390*Math.min(devicePixelRatio,1.7)));
await page.evaluate(()=>{sim.start('fly');sim.advance(0);});
await page.screenshot({path:'work/screenshots/latest-mobile.png'});
await browser.close();
if(errors.length)throw new Error(errors.join('\n'));
console.log('PASS: landmark, airfield and mobile render review; no browser errors.');
