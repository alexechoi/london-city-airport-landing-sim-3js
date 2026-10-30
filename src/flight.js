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
  if (s.ground) {
    // Ailerons become nosewheel steering. Idle thrust coasts; W/S command taxi thrust.
    s.bank = s.pitch = s.vs = 0;
    const target = s.throttle * 22;
    if (k[" "]) s.speed = Math.max(0, s.speed - dt * 14);
    else s.speed = Math.max(0, s.speed + Math.max(-2.8, Math.min(2, (target - s.speed)*.7))*dt);
    s.heading += ((k.ArrowRight ? 1 : 0) - (k.ArrowLeft ? 1 : 0)) * dt * 24 * Math.min(1,s.speed/8) * Math.min(1,22/Math.max(1,s.speed));
    const a = s.heading * Math.PI / 180;
    s.x += Math.sin(a) * s.speed * .5144 * dt;
    s.z -= Math.cos(a) * s.speed * .5144 * dt;
    return;
  }
  const rollInput = (k.ArrowLeft ? 1 : 0) - (k.ArrowRight ? 1 : 0);
  if (rollInput) s.bank += rollInput * dt * 60;
  else s.bank *= Math.exp(-dt * 0.55);
  s.bank = Math.max(-75, Math.min(75, s.bank));
  s.pitch += ((k.ArrowDown ? 1 : 0) - (k.ArrowUp ? 1 : 0)) * dt * 4;
  s.pitch = Math.max(-18, Math.min(12, s.pitch));
  s.speed += (92 + s.throttle * 70 - s.speed) * dt * 0.15;
  // Coordinated turn rate: tighter turns at larger bank and lower airspeed.
  const airspeed = Math.max(70, s.speed) * 0.5144;
  s.heading -=
    (((9.81 * Math.tan((s.bank * Math.PI) / 180)) / airspeed) * dt * 180) /
    Math.PI;
  const a = (s.heading * Math.PI) / 180;
  s.x += Math.sin(a) * s.speed * 0.5144 * dt;
  s.z -= Math.cos(a) * s.speed * 0.5144 * dt;
  s.vs = s.speed * 0.5144 * Math.sin((s.pitch * Math.PI) / 180);
  if (s.speed < 100) s.vs -= (100 - s.speed) * 0.35;
  s.y += s.vs * dt;
}

export function customFlightState(config, runway = "09") {
  return {
    ...initialFlight(),
    x: runway === "09" ? -config.x : config.x,
    z: runway === "09" ? -1508 - config.z : config.z,
    y: config.altitudeFt * 0.3048,
    heading:
      ((config.bearing - (runway === "09" ? 92.8 : 272.8) + 540) % 360) - 180,
    pitch: 0,
    bank: 0,
    vs: 0,
    speed: 140,
    throttle: (140 - 92) / 70,
  };
}
