import * as T from "three";
// Tangent-aligned flight through real world-space arcs: yaw and bank agree with
// the turn direction. The orbit camera keeps the aircraft and landmark in frame.
export const TOUR_TITLES = ["Banking past the Shard.","Turning over the City.","Above the London Eye.","Across Canary Wharf.","Around the Greenwich Peninsula.","Back to London City."];
export function cinematicPose(time,sites,approach="09") {
  time=Math.max(0,Number.isFinite(time)?time:0);
  const segment=Math.floor(time/8)%6,u=(time%8)/8;
  const shots=[
    {site:"shard",radius:330,alt:205,a:-2.6,turn:.95,bank:-39},
    {site:"gherkin",radius:470,alt:245,a:.1,turn:-.85,bank:35},
    {site:"eye",radius:300,alt:135,a:.2,turn:.8,bank:-34},
    {position:[-290,0,-5920],height:235,radius:340,alt:205,a:-2.5,turn:1,bank:-40},
    {position:[-428,0,-4337],height:100,radius:380,alt:150,a:2.4,turn:-.85,bank:35},
  ];
  if(segment<5) {
    const s=shots[segment],centre=new T.Vector3(...(s.position||sites[s.site].position)),height=s.height||sites[s.site].height;
    const a=s.a+u*s.turn,sign=Math.sign(s.turn),r=s.radius;
    const position=centre.clone().add(new T.Vector3(Math.cos(a)*r,s.alt+Math.sin(u*Math.PI)*10,Math.sin(a)*r));
    const forward=new T.Vector3(-Math.sin(a)*sign,0,Math.cos(a)*sign);
    const ca=a-sign*.14,camera=centre.clone().add(new T.Vector3(Math.cos(ca)*(r+230),s.alt+28,Math.sin(ca)*(r+230)));
    const bank=s.bank*(.25+.75*Math.sin(u*Math.PI));
    return {segment,position,yaw:Math.atan2(-forward.x,-forward.z),pitch:.025,bank:bank*Math.PI/180,camera,target:centre.clone().add(new T.Vector3(0,height*.66,0))};
  }
  const position=new T.Vector3(0,4.5+55*Math.pow(Math.max(0,1-u/.72),1.2),-2050+u*850);
  const camera=position.clone().add(new T.Vector3(-33,13,-66)),target=position.clone().add(new T.Vector3(0,0,45));
  if(approach==="27")for(const p of [position,camera,target]){p.x=-p.x;p.z=-1508-p.z;}
  return {segment,position,yaw:approach==="09"?Math.PI:0,pitch:u>.6?.03:-.025,bank:0,camera,target};
}
