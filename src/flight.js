export function initialFlight() {
  return {
    x: 0,
    y: 290,
    z: 3000,
    speed: 126,
    pitch: -5.5,
    bank: 0,
    heading: 0,
    throttle: 0.48,
    vs: -6.2,
    ground: false,
    done: false,
  };
}
export function landingVerdict(s) {
  const on = s.z < 0 && s.z > -1508 && Math.abs(s.x) < 15;
  const safe =
    on && s.speed < 150 && Math.abs(s.vs) < 4 && Math.abs(s.bank) < 10;
  return {
    safe,
    score: safe
      ? Math.max(
          0,
          Math.round(
            100 -
              Math.abs(s.x) * 2 -
              Math.abs(s.vs) * 7 -
              Math.max(0, -s.z - 350) * 0.025,
          ),
        )
      : 0,
    reason: !on
      ? "You missed the runway. Line up with the centreline."
      : Math.abs(s.vs) >= 4
        ? "Hard landing. Raise the nose gently before touchdown."
        : s.speed >= 150
          ? "Too fast. Aim for 125 knots on final."
          : "Keep your wings level for touchdown.",
  };
}
export function stepFlight(s, k, dt) {
  if (s.done) return;
  s.throttle = Math.max(
    0,
    Math.min(1, s.throttle + ((k.w ? 1 : 0) - (k.s ? 1 : 0)) * dt * 0.24),
  );
  s.bank += ((k.ArrowLeft ? 1 : 0) - (k.ArrowRight ? 1 : 0)) * dt * 22;
  s.bank *= Math.exp(-dt * 0.65);
  s.bank = Math.max(-35, Math.min(35, s.bank));
  s.pitch += ((k.ArrowDown ? 1 : 0) - (k.ArrowUp ? 1 : 0)) * dt * 4;
  s.pitch = Math.max(-18, Math.min(12, s.pitch));
  if (s.ground) {
    s.speed = Math.max(0, s.speed - dt * (k[" "] ? 14 : 2.8));
    s.z -= s.speed * 0.5144 * dt;
    if (s.z < -1508) s.done = true;
    return;
  }
  s.speed += (92 + s.throttle * 70 - s.speed) * dt * 0.15;
  s.heading -= s.bank * dt * 0.026;
  const a = (s.heading * Math.PI) / 180;
  s.x += Math.sin(a) * s.speed * 0.5144 * dt;
  s.z -= Math.cos(a) * s.speed * 0.5144 * dt;
  s.vs = s.speed * 0.5144 * Math.sin((s.pitch * Math.PI) / 180);
  if (s.speed < 100) s.vs -= (100 - s.speed) * 0.35;
  s.y += s.vs * dt;
}
