import * as T from "three";
// Reused particles: no allocation or GPU resource leak between attempts.
export class Impact {
  constructor(scene) {
    this.group = new T.Group();
    scene.add(this.group);
    this.age = 99;
    this.origin = new T.Vector3();
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 128;
    const c = canvas.getContext("2d"),
      g = c.createRadialGradient(64, 64, 3, 64, 64, 62);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.3, "rgba(255,255,255,.85)");
    g.addColorStop(0.7, "rgba(255,255,255,.3)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, 128, 128);
    const texture = new T.CanvasTexture(canvas);
    this.particles = [];
    for (let i = 0; i < 90; i++) {
      const smoke = i >= 24;
      const material = new T.SpriteMaterial({
        map: texture,
        color: smoke ? 0x323337 : 0xff9e18,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: smoke ? T.NormalBlending : T.AdditiveBlending,
      });
      const sprite = new T.Sprite(material);
      this.group.add(sprite);
      this.particles.push({
        sprite,
        smoke,
        v: new T.Vector3(),
        seed: i * 2.39996,
      });
    }
    this.debris = [];
    const material = new T.MeshStandardMaterial({
      color: 0x303942,
      roughness: 0.7,
      metalness: 0.4,
    });
    for (let i = 0; i < 32; i++) {
      const mesh = new T.Mesh(
        new T.BoxGeometry(0.3 + (i % 3) * 0.3, 0.15, 1 + (i % 4)),
        material,
      );
      this.group.add(mesh);
      this.debris.push({ mesh, v: new T.Vector3(), spin: new T.Vector3() });
    }
    this.light = new T.PointLight(0xff9e35, 0, 170, 1.2);
    this.group.add(this.light);
    this.reset();
  }
  reset() {
    this.age = 99;
    this.group.visible = false;
  }
  trigger(p) {
    this.origin.copy(p);
    this.group.position.copy(p);
    this.group.visible = true;
    this.age = 0;
    for (const [i, q] of this.particles.entries()) {
      const a = q.seed;
      q.v.set(
        Math.sin(a) * (q.smoke ? 8 : 25),
        5 + Math.abs(Math.cos(a * 3)) * 18,
        Math.cos(a) * (q.smoke ? 8 : 25),
      );
      q.sprite.position.set(0, 0, 0);
      q.sprite.material.rotation = a;
      q.sprite.material.opacity = 1;
    }
    for (const [i, d] of this.debris.entries()) {
      d.mesh.position.set(0, 0, 0);
      d.v.set(Math.sin(i * 3) * 35, 10 + (i % 7) * 4, Math.cos(i * 3) * 35);
      d.spin.set((i % 3) + 1, (i % 4) + 1, (i % 5) + 1);
      d.mesh.visible = true;
    }
  }
  update(dt) {
    if (this.age >= 8) return;
    this.age += dt;
    const t = this.age;
    for (const [i, q] of this.particles.entries()) {
      const delay = q.smoke ? (i - 24) * 0.012 : 0,
        a = Math.max(0, t - delay);
      q.sprite.position
        .copy(q.v)
        .multiplyScalar(q.smoke ? a * 0.65 : Math.min(a, 0.65));
      q.sprite.position.y += q.smoke ? a * a * 1.8 : 0;
      const size = q.smoke ? 6 + a * 9 : 7 + a * 23;
      q.sprite.scale.setScalar(size);
      q.sprite.material.opacity = q.smoke
        ? Math.max(0, Math.min(0.45, a * 0.8) * (1 - a / 8))
        : Math.max(0, 1 - a / 1.1);
      q.sprite.material.color.setHex(
        q.smoke ? 0x36383a : a < 0.18 ? 0xffefb0 : 0xff6010,
      );
    }
    for (const d of this.debris) {
      d.v.y -= 9.8 * dt;
      d.mesh.position.addScaledVector(d.v, dt);
      d.mesh.rotation.x += d.spin.x * dt;
      d.mesh.rotation.y += d.spin.y * dt;
      if (d.mesh.position.y + this.origin.y < 1) d.v.set(0, 0, 0);
      d.mesh.visible = t < 6;
    }
    this.light.intensity = 2500 * Math.exp(-t * 5);
    if (t >= 8) this.group.visible = false;
  }
}
