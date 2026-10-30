// Keep the playable region inside the shipped London map. Fog masks its edge.
export const REGION = { minX: -5700, maxX: 6200, minZ: -13650, maxZ: 5700 };
export function regionClearance(p) {
  return Math.min(p.x - REGION.minX, REGION.maxX - p.x, p.z - REGION.minZ, REGION.maxZ - p.z);
}
export const GATE = { x: -171, z: -1424, heading: Math.PI / 2, number: 4 };
export function atGate(p, speed, heading) {
  const headingError = Math.atan2(Math.sin(heading-GATE.heading), Math.cos(heading-GATE.heading));
  return Math.hypot(p.x-GATE.x,p.z-GATE.z)<9 && speed<0.7 && Math.abs(headingError)<0.3;
}
export function onAirportPavement(p) {
  if (p.z < -1770 || p.z > 20) return false;
  return (Math.abs(p.x)<18 && p.z>=-1515) ||
    (p.x>-79 && p.x<-47 && p.z>=-1515) ||
    (p.x>-216 && p.x<-41 && p.z<-1020) ||
    (p.x>-198 && p.x<-136 && p.z<-615) ||
    [-150,-600,-1250].some(z=>p.x>-65&&p.x<0&&Math.abs(p.z-z)<17);
}
