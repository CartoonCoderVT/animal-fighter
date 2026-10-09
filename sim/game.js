import { createEngine, buildStatic, Bodies, Body, Composite, Constraint, Events, Query, CAT, MASK, ALL_ONEWAY } from './physics.js';
import { MAP, buildNav } from './map.js';
import { FIGHTERS } from './fighters.js';
import { EMPTY_INPUT } from '../engine/input.js';
import { rnd, dist } from '../engine/const.js';
import { stepActor, syncActor } from './actor.js';
import { damage, kill, stepBullets, tickStatuses } from './combat.js';
import { addProp, removeProp, tickProps, propCollision } from './props.js';
import { installHazards, tickHazards, hazardSnapshot } from './hazards.js';
import { stepRagdolls, settleLimits, knockdown, ragdollOf } from './ragdoll.js';
import { HALF_H, BODY_W } from '../render/rig.js';
import { MELEE, isMelee } from './weapons.js';

export { EMPTY_INPUT, FIGHTERS };

export class Game {
  constructor({ players = [], mode = 'solo', localId = 0, settings = {}, onEvent = () => {}, killsToWin = 5 } = {}) {
    this.mode = mode;
    this.localId = localId;
    this.settings = settings;
    this.onEvent = onEvent;
    this.killsToWin = killsToWin;
    this.engine = createEngine();
    const { statics, oneways } = buildStatic(this.engine.world);
    this.staticBodies = statics;
    this.onewayBodies = oneways;
    this.nav = buildNav();
    this.actors = []; this.props = []; this.bullets = []; this.limbs = []; this.ragdolls = []; this.pins = [];
    this.effects = []; this.fires = [];
    this.fxQueue = []; this.netEvents = []; this.eventId = 0;
    this.time = 0; this.seq = 0; this.nextId = 100;
    this.winner = null; this.winPending = null; this.paused = false;
    this.shake = 0; this.hitstop = 0; this.flash = 0; this.slowmo = 0; this.drama = 0; this.slowAcc = 0; this.timeScale = 1; this.scaleAcc = 0; this.grab = null;
    this.spawns = MAP.spawns;
    players.forEach((p, i) => this.addActor({ ...p, id: p.id ?? i, x: p.x ?? this.spawns[i % 4][0], y: p.y ?? this.spawns[i % 4][1] }));
    if (!players.length) this.addActor({ id: 0, type: 0, x: this.spawns[0][0], y: this.spawns[0][1], name: 'Você', bot: false });
    installHazards(this);
    for (const p of MAP.props) this.addProp({ ...p });
    Events.on(this.engine, 'collisionStart', e => { for (const pair of e.pairs) propCollision(this, pair.bodyA, pair.bodyB, pair); });
  }

  addActor({ id = this.nextId++, type = 0, x = 480, y = 200, name, bot = true, team = id }) {
    const f = FIGHTERS[type];
    const body = Bodies.rectangle(x, y, BODY_W, HALF_H * 2, {
      chamfer: { radius: 6 }, friction: 0, frictionStatic: 0, frictionAir: 0, restitution: 0, inertia: Infinity, density: 0.003,
      collisionFilter: { category: CAT.actor, mask: MASK.actor | ALL_ONEWAY }, label: 'actor'
    });
    const a = {
      id, type, x, y, name: name || f.name, bot, team, originalTeam: team, hp: f.hp, maxHp: f.hp, body, face: x > 480 ? -1 : 1,
      move: 0, ground: false, vx: 0, vy: 0, dead: false, kills: 0, deaths: 0, attack: 0, attackCd: 0, attackKind: null, attackSeq: 0,
      abilityCd: 0, buff: 0, hurt: 0, invincible: 1.5, iframes: 0, dodgeCd: 0, dodge: 0, dodgeKind: null, stun: 0, combo: 0, comboTimer: 0,
      wounds: {}, partDmg: {}, severed: [], broken: {}, stumps: [], embedded: [], bleed: 0, char: 0, freeze: 0, frozen: 0, shock: 0,
      weapon: null, ammo: 0, holding: null, lastInput: EMPTY_INPUT(), input: EMPTY_INPUT(), queued: {},
      respawn: 0, lastHit: null, lastHitTime: -9, jumpGrace: 0, jumpBuffer: 0, airJumps: 0, drop: {}, knocked: false, knock: 0, getup: 0,
      aim: 0, burning: 0, stats: { damage: 0, kills: 0, limbs: 0 }, powerSeq: 0, act: null, actT: 0, gliding: false,
      form: null, rage: 0, morphTo: null, frenzy: null, biteCd: 0, chargeCd: 0, carry: null,
      copy: null, belly: null, bellyT: 0, swallowedBy: null
    };
    body.plugin.actor = a;
    this.actors.push(a);
    Composite.add(this.engine.world, body);
    return a;
  }

  addProp(opts) { return addProp(this, opts); }
  removeProp(p) { removeProp(this, p); }

  inputFor(id, input) {
    const a = this.actor(id);
    if (!a) return;
    a.queued ??= {};
    for (const k of ['jump', 'power', 'grab', 'dodge', 'attack', 'drop', 'detonate', 'bats']) if (input[k] === true && a.input[k] !== true) a.queued[k] = true;
    a.input = { ...EMPTY_INPUT(), ...input };
  }
  actor(id) { return id === null || id === undefined ? undefined : this.actors.find(a => a.id === id); }
  // Someone inside the frog is out of the fight until they come out.
  enemies(a) { return this.actors.filter(b => !b.dead && b.id !== a.id && b.team !== a.team && b.swallowedBy == null); }
  closest(a, max = Infinity) { return this.enemies(a).sort((b, c) => dist(a, b) - dist(a, c)).find(b => dist(a, b) < max); }

  fx(type, data) {
    const e = { id: ++this.eventId, time: this.time, type: 'fx', fx: type, ...data };
    if (this.fxQueue.length > 600) this.fxQueue.splice(0, 200);
    this.fxQueue.push(e);
    this.netEvents.push(e);
  }
  text(x, y, text, color) { this.effects.push({ kind: 'text', x, y, text, color, life: 1 }); }
  sound(name, x = null) {
    this.onEvent({ type: 'sound', name, x });
    this.netEvents.push({ id: ++this.eventId, time: this.time, type: 'sound', name, x });
  }

  // LAB hand: a soft spring from the cursor to whatever body is under it.
  grabAt(x, y) {
    this.release();
    const pt = { x, y };
    let body = null;
    const actor = this.actors.find(a => !a.dead && !a.knocked && a.swallowedBy == null && Query.point([a.body], pt).length);
    if (actor) {
      knockdown(this, actor, { velocity: { x: 0, y: -1 }, time: 2.5 });
      const r = ragdollOf(this, actor);
      if (r) body = Object.values(r.limbs).sort((a, b) => Math.hypot(a.body.position.x - x, a.body.position.y - y) - Math.hypot(b.body.position.x - x, b.body.position.y - y))[0]?.body;
    }
    if (!body) {
      const bodies = [...this.limbs.map(l => l.body), ...this.props.filter(p => !p.held && !p.body.isStatic).map(p => p.body), ...this.hz.lamps.map(l => l.body)];
      body = Query.point(bodies, pt)[0] || bodies.filter(b => Math.hypot(b.position.x - x, b.position.y - y) < 16).sort((a, b) => Math.hypot(a.position.x - x, a.position.y - y) - Math.hypot(b.position.x - x, b.position.y - y))[0];
    }
    if (!body) return false;
    const c = Constraint.create({ pointA: { x, y }, bodyB: body, pointB: { x: x - body.position.x, y: y - body.position.y }, length: 0, stiffness: 0.12, damping: 0.08 });
    Composite.add(this.engine.world, c);
    this.grab = { c, body };
    this.sound('pickup', x);
    return true;
  }
  dragTo(x, y) { if (this.grab) this.grab.c.pointA = { x, y }; }
  release() {
    if (!this.grab) return;
    Composite.remove(this.engine.world, this.grab.c);
    this.grab = null;
  }
  holdGrab() {
    const limb = this.grab.body.plugin.limb;
    const a = limb && this.actor(limb.actor);
    if (a && a.knocked) a.knock = Math.max(a.knock, 0.6);
  }

  // Two solid fighters squeezed together (against a wall, say) are eased apart; whoever has
  // room to move takes the step.
  separateActors() {
    const solid = this.actors.filter(a => !a.dead && !a.knocked && (a.body.collisionFilter.mask & CAT.actor));
    for (let i = 0; i < solid.length; i++) for (let j = i + 1; j < solid.length; j++) {
      const a = solid[i].body, b = solid[j].body;
      const ox = BODY_W - Math.abs(a.position.x - b.position.x);
      if (ox < 3 || Math.abs(a.position.y - b.position.y) > HALF_H * 1.4) continue;
      const s = a.position.x <= b.position.x ? -1 : 1;
      const room = p => p.position.x > 12 && p.position.x < 948;
      const wa = room(a) ? (room(b) ? 0.5 : 1) : 0;
      // Against the arena wall one of them cannot give way: the other is moved clear at once and
      // stops pushing into it.
      const push = wa === 0.5 ? Math.min(2, ox / 2) : ox / 2;
      Body.setPosition(a, { x: a.position.x + s * push * 2 * wa, y: a.position.y });
      Body.setPosition(b, { x: b.position.x - s * push * 2 * (1 - wa), y: b.position.y });
      if (wa !== 0.5) {
        const mover = wa ? a : b, away = wa ? s : -s;
        if (mover.velocity.x * away < 0) Body.setVelocity(mover, { x: 0, y: mover.velocity.y });
      }
    }
  }

  removeLimb(l) {
    const i = this.limbs.indexOf(l);
    if (i < 0) return;
    if (this.grab?.body === l.body) this.release();
    this.limbs.splice(i, 1);
    Composite.remove(this.engine.world, l.body);
    const r = l.ragdoll;
    if (r) {
      for (const j of r.joints) if (!j.broken && (j.child === l.part || j.parent === l.part)) { Composite.remove(this.engine.world, j.c); j.broken = true; }
      delete r.limbs[l.part];
      if (!Object.keys(r.limbs).length) this.ragdolls = this.ragdolls.filter(x => x !== r);
    }
    for (const p of [...this.pins]) if (p.limb === l.id) { Composite.remove(this.engine.world, p.c); this.pins.splice(this.pins.indexOf(p), 1); }
    for (const a of this.actors) if (a.holdingLimb === l.id) { if (a.holdJoint) Composite.remove(this.engine.world, a.holdJoint); a.holdJoint = null; a.holdingLimb = null; }
  }

  respawnActor(a) {
    const spot = this.spawns[Math.floor(rnd(0, this.spawns.length))];
    Body.setPosition(a.body, { x: spot[0], y: spot[1] });
    Body.setVelocity(a.body, { x: 0, y: 0 });
    Body.setAngle(a.body, 0);
    if (!Composite.allBodies(this.engine.world).includes(a.body)) Composite.add(this.engine.world, a.body);
    Object.assign(a, {
      x: spot[0], y: spot[1], hp: FIGHTERS[a.type].hp, maxHp: FIGHTERS[a.type].hp, dead: false, invincible: 1.7, wounds: {}, partDmg: {}, severed: [], broken: {}, stumps: [], embedded: [],
      bleed: 0, char: 0, freeze: 0, frozen: 0, shock: 0, stun: 0, burning: 0, weapon: null, buff: 0, team: a.originalTeam,
      ai: null, attackCd: 0, holding: null, abilityCd: 1, knocked: false, knock: 0, getup: 0, dodge: 0, dodgeKind: null, climbing: false, drop: {},
      act: null, actT: 0, hits: null, gliding: false, holdingLimb: null, holdJoint: null, ghostClear: true, hitlag: 0, lagPos: null,
      parry: 0, parryLag: 0, counter: 0, perfectT: 0, chase: null, float: 0, airDodged: false, hitstun: 0, hitstunMax: 0, stunN: 0, bloodMark: 0, beamAir: false, bounced: false, bounceArm: 0, turnT: 0, batCd: 0, swarm: null,
      form: null, rage: 0, morphTo: null, frenzy: null, biteCd: 0, chargeCd: 0, carry: null,
      copy: null, belly: null, bellyT: 0, swallowedBy: null, copied: false, wobble: 0
    });
    this.fx('spawn', { x: a.x, y: a.y, color: FIGHTERS[a.type].color });
  }

  step(dt = 1 / 60) {
    if (this.paused || this.winner !== null) return;
    dt = 1 / 60;
    this.shake = Math.max(0, this.shake - dt * 25);
    this.flash = Math.max(0, this.flash - dt * 4);
    if (this.slowmo > 0) {
      this.slowmo -= dt;
      if (this.slowmo <= 0 && this.winPending !== null) {
        this.winner = this.winPending;
        const w = this.actor(this.winner);
        this.onEvent({ type: 'win', winner: w?.name, id: this.winner });
        this.netEvents.push({ id: ++this.eventId, time: this.time, type: 'win', winner: w?.name, wid: this.winner });
        return;
      }
      this.slowAcc += 0.4;
      if (this.slowAcc < 1) return;
      this.slowAcc -= 1;
    }
    // Short dramatic slow motion after knockdowns and knockouts.
    if (this.drama > 0) this.drama -= dt;
    const scale = Math.min(this.timeScale, this.drama > 0 ? 0.35 : 1);
    if (scale < 1) {
      this.scaleAcc += scale;
      if (this.scaleAcc < 1) return;
      this.scaleAcc -= 1;
    }
    this.time += dt;
    this.seq++;
    if (this.hitstop > 0) { this.hitstop -= dt; return; }
    if (this.grab) this.holdGrab();

    for (const a of this.actors) stepActor(this, a, dt);
    stepBullets(this, dt);
    tickHazards(this, dt);
    tickProps(this, dt);
    stepRagdolls(this, dt);
    // Fast parts tunnel through the thin catwalks: cap their speed (falling a bit lower still),
    // also before the physics step so a ragdoll born from a blast does not jump on its first step.
    const capLimbs = () => { for (const l of this.limbs) { const v = l.body.velocity, s = Math.hypot(v.x, v.y); if (s > 18 || v.y > 10) { const k = Math.min(1, 18 / s); Body.setVelocity(l.body, { x: v.x * k, y: Math.min(v.y * k, 10) }); } } };
    capLimbs();
    Engine_update(this.engine);
    settleLimits(this);
    capLimbs();
    for (const a of this.actors) if (!a.dead && !a.knocked) {
      const v = a.body.velocity;
      if (Math.abs(v.x) > 16 || Math.abs(v.y) > 19) Body.setVelocity(a.body, { x: clampV(v.x, 16), y: clampV(v.y, 19) });
      // Never past the side walls (a fast body pressed into a corner can slip through the seam).
      const px = a.body.position.x;
      if (px < 8 || px > 952) { Body.setPosition(a.body, { x: Math.max(8, Math.min(952, px)), y: a.body.position.y }); Body.setVelocity(a.body, { x: 0, y: a.body.velocity.y }); }
    }
    this.separateActors();

    for (const a of this.actors) {
      syncActor(this, a);
      if (!a.dead && a.y > 640) { a.hp = 0; kill(this, a, a.lastHit, { kind: 'fall' }); }
    }
    for (const p of [...this.props]) {
      p.x = p.body.position.x; p.y = p.body.position.y; p.angle = p.body.angle;
      if (p.y > 680) this.removeProp(p);
    }
    for (const l of [...this.limbs]) {
      l.life -= dt;
      l.x = l.body.position.x; l.y = l.body.position.y; l.angle = l.body.angle;
      l.bleed = Math.max(0, l.bleed - dt * 0.35);
      if (l.propGrace > 0 && (l.propGrace -= dt) <= 0) l.body.collisionFilter.mask = MASK.limb;
      l.shock = Math.max(0, (l.shock || 0) - dt);
      if (l.life <= 0 || l.y > 700) this.removeLimb(l);
    }
    if (this.limbs.length > 150) {
      const old = this.limbs.filter(l => !l.ragdoll || l.ragdoll.detached || !l.attached).sort((a, b) => a.life - b.life).slice(0, this.limbs.length - 150);
      old.forEach(l => this.removeLimb(l));
    }
    for (const p of [...this.pins]) { p.life -= dt; if (p.life <= 0) { Composite.remove(this.engine.world, p.c); this.pins.splice(this.pins.indexOf(p), 1); } }
    this.ragdolls = this.ragdolls.filter(r => Object.keys(r.limbs).length);
    this.dropWeapons(dt);
    tickStatuses(this, dt);
    for (const e of this.effects) { e.life -= dt; if (e.kind === 'text') e.y -= dt * 20; }
    this.effects = this.effects.filter(e => e.life > 0);
    const cutoff = this.time - 0.4;
    if (this.netEvents.length > 240 || (this.netEvents[0] && this.netEvents[0].time < cutoff - 0.6)) this.netEvents = this.netEvents.filter(e => e.time >= cutoff).slice(-240);
  }

  dropWeapons(dt) {
    if (this.mode === 'sandbox') return;
    this.weaponT = (this.weaponT ?? 3) - dt;
    if (this.weaponT > 0) return;
    this.weaponT = 7 + Math.random() * 4;
    const out = this.props.filter(p => isMelee(p.kind)).length + this.actors.filter(a => isMelee(a.weapon)).length;
    if (out >= 4) return;
    let x = rnd(70, 890);
    if (x > MAP.pit.x0 - 20 && x < MAP.pit.x1 + 20) x = x < 480 ? MAP.pit.x0 - 40 : MAP.pit.x1 + 40;
    const kind = MELEE[Math.floor(Math.random() * MELEE.length)];
    const p = this.addProp({ kind, x, y: 30, velocity: { x: 0, y: 2 } });
    p.dropGlow = 2.5;
    this.fx('spawn', { x, y: 30, color: '#ffe6a8' });
    this.sound('pickup', x);
  }

  get hazards() { return hazardSnapshot(this); }

  snapshot() {
    const r = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100;
    const cutoff = this.time - 0.35;
    return {
      events: this.netEvents.filter(e => e.time >= cutoff), seq: this.seq, time: this.time, mode: this.mode, winner: this.winner, shake: r(this.shake), flash: r(this.flash), slowmo: this.slowmo > 0, drama: this.drama > 0, countdown: r(this.countdown || 0),
      actors: this.actors.map(a => ({
        id: a.id, type: a.type, name: a.name, bot: a.bot, team: a.team, hp: r(a.hp), maxHp: a.maxHp, kills: a.kills, deaths: a.deaths,
        x: r(a.x), y: r(a.y), vx: r(a.vx), vy: r(a.vy), face: a.face, move: a.move, ground: a.ground, climbing: !!a.climbing, crouch: !!a.crouch,
        dead: a.dead, attack: r(a.attack), attackKind: a.attackKind, attackSeq: a.attackSeq, abilityCd: r(a.abilityCd), hurt: r(a.hurt),
        invincible: r(a.invincible), dodge: r(a.dodge), dodgeKind: a.dodgeKind, stun: r(a.stun), knocked: a.knocked, getup: r(a.getup), aim: r(a.aim),
        act: a.act, combo: a.combo, gliding: a.gliding, chain: g_chain(this, a),
        parry: r(a.parry || 0), parryLag: r(a.parryLag || 0), perfectT: r(a.perfectT || 0), counter: r(a.counter || 0),
        hitstun: r2(a.hitstun || 0), hitstunMax: r2(a.hitstunMax || 0), hitHeavy: !!a.hitHeavy, hitDir: a.hitDir || 0, hitlag: r2(a.hitlag || 0),
        bloodMark: a.bloodMark && this.time - (a.markT ?? -9) < 5 ? a.bloodMark : 0, markLeft: r(Math.max(0, 5 - (this.time - (a.markT ?? -9)))), beamAir: !!a.beamAir, actT: r2(a.actT || 0), reqN: a.reqN || 0, reqDone: !!a.reqDone, batCd: r(a.batCd || 0),
        wounds: a.wounds, severed: a.severed, broken: a.broken, stumps: a.stumps, embedded: a.embedded, bleed: r(a.bleed), char: r(a.char),
        freeze: r(a.freeze), frozen: r(a.frozen), shock: r(a.shock), weapon: a.weapon, ammo: a.ammo, holding: a.holding,
        burning: r(a.burning || 0), holdingLimb: a.holdingLimb || null, respawn: r(a.respawn), skid: r(a.skid || 0), landImpact: r(a.landT > 0 ? a.landImpact : 0),
        powerSeq: a.powerSeq, recoil: r(a.recoil || 0), stats: a.stats, form: a.form || null, rage: r(a.rage || 0), morphTo: a.morphTo || null, rip: a.frenzy?.prey != null ? 1 : 0, slamN: a.slamN || 0,
        copy: a.copy ?? null, belly: a.belly ?? null, bellyT: r(a.bellyT || 0), swallowedBy: a.swallowedBy ?? null, wobble: r2(a.wobble || 0), copied: !!a.copied
      })),
      props: this.props.map(p => ({ id: p.id, kind: p.kind, w: p.w, h: p.h, x: r(p.x), y: r(p.y), angle: r(p.angle * 100) / 100, hp: p.hp, armed: !!p.armed, fuse: p.fuse, burning: r(p.burning || 0), weapon: p.weapon, rocket: p.rocket > 0, chain: !!p.chain })),
      bullets: this.bullets.map(b => ({ id: b.id, x: r(b.x), y: r(b.y), px: r(b.px), py: r(b.py), word: b.word, color: b.color, vx: r(b.vx), vy: r(b.vy), kind: b.kind })),
      limbs: this.limbs.map(l => ({ id: l.id, type: l.type, form: l.form || null, part: l.part, x: r(l.x), y: r(l.y), angle: r(l.angle * 100) / 100, face: l.face, actor: l.actor, attached: l.attached, wounds: l.wounds, char: r(l.char || 0), frozen: l.frozen, bleed: r(l.bleed), embedded: l.embedded || null, shock: (l.shock || 0) > 0, life: r(l.life), cut: l.cut || null })),
      effects: this.effects.map(e => ({ ...e })),
      fires: this.fires.map(f => ({ id: f.id, x: f.x, y: f.y, life: r(f.life) })),
      pins: this.pins.map(p => ({ x: p.x, y: p.y })),
      hazards: hazardSnapshot(this)
    };
  }

  dispose() {
    Events.off(this.engine);
    Composite.clear(this.engine.world, false);
    globalThis.Matter.Engine.clear(this.engine);
  }
}

// Combo count while it is still running (the HUD shows it next to the fighter).
function g_chain(g, a) {
  return a.chain > 1 && g.time - (a.chainT ?? -9) < 1.1 ? a.chain : 0;
}

const clampV = (v, m) => Math.max(-m, Math.min(m, v));

function Engine_update(engine) {
  globalThis.Matter.Engine.update(engine, 1000 / 60);
}
