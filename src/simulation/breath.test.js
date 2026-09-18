import {
  airY,
  ascentReserve,
  breathHold,
  DAY_SECONDS,
  diveHold,
  drainForDays,
  tickBreathHold,
  vehicleCfg,
} from "../world/fauna.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

{
  assert(breathHold(6) === 144, `orca-scale 6 min dive should be 144 s, got ${breathHold(6)}`);
  assert(breathHold(1.2) === 28.8, `orca 1.2 min surface should be 28.8 s, got ${breathHold(1.2)}`);
  assert(breathHold(45, 15) === 360, `sperm 45 min dive at 15× should be 360 s, got ${breathHold(45, 15)}`);
  assert(breathHold(8, 15) === 64, `sperm 8 min surface at 15× should be 64 s, got ${breathHold(8, 15)}`);
}

{
  const orca = vehicleCfg("orca");
  const sperm = vehicleCfg("spermwhale");
  const orcaPad = diveHold(6, 5, -90, 32, -1.2);
  const spermPad = diveHold(45, 15, -700, 55, -1.2);
  assert(orca.diveTime === orcaPad, `orca diveTime should include commute pad ${orcaPad}, got ${orca.diveTime}`);
  assert(orca.diveTime > 144, `orca tank should be longer than the raw 144 s hold, got ${orca.diveTime}`);
  assert(orca.surfaceTime === 28.8, `orca surfaceTime should be 28.8 s, got ${orca.surfaceTime}`);
  assert(sperm.diveTime === spermPad, `sperm diveTime should include commute pad ${spermPad}, got ${sperm.diveTime}`);
  assert(sperm.diveTime > 360, `sperm tank should be longer than the raw 360 s hold, got ${sperm.diveTime}`);
  assert(sperm.surfaceTime === 64, `sperm surfaceTime should be 64 s, got ${sperm.surfaceTime}`);
}

{
  const cfg = { diveTime: 20, surfaceTime: 8, diveSpeed: 24, minDepth: -2 };
  assert(airY(cfg) === -4.4, `airY should sit just under minDepth, got ${airY(cfg)}`);
  const reserve = ascentReserve(-40, cfg);
  assert(reserve >= 20 * 0.12, `reserve should be at least 12% of the tank, got ${reserve}`);
  assert(reserve < 20, "reserve must leave forage time in the tank");

  let s = tickBreathHold(false, 20, 5, cfg, false, { y: -40 });
  assert(s.surfacing === false && s.breathT === 15, `dive should drain, got ${s.breathT}`);

  s = tickBreathHold(false, reserve + 0.4, 1, cfg, false, { y: -40 });
  assert(
    s.surfacing === true && s.breathT > 0 && !s.drowned,
    `should leave for the air before the tank is empty, got ${JSON.stringify(s)}`
  );

  s = tickBreathHold(true, 6, 2, cfg, false, { y: -20 });
  assert(s.surfacing === true && s.breathT === 4 && !s.drowned, `commute should keep draining the tank, got ${JSON.stringify(s)}`);

  s = tickBreathHold(true, 0.4, 1, cfg, false, { y: -12 });
  assert(s.drowned === true && s.breathT === 0, `empty tank underwater should drown, got ${JSON.stringify(s)}`);

  s = tickBreathHold(true, 6, 1, cfg, true, { y: -1, justArrived: true });
  assert(s.surfacing === true && s.breathT === 7, `arriving should start the hang clock, got ${JSON.stringify(s)}`);

  s = tickBreathHold(true, 8, 3, cfg, true, { y: -1 });
  assert(s.surfacing === true && s.breathT === 5, `recovery should count only at the air, got ${s.breathT}`);

  s = tickBreathHold(true, 0.4, 1, cfg, true, { y: -1 });
  assert(s.surfacing === false && s.breathT === 20, `full recovery should start a new dive, got ${JSON.stringify(s)}`);
}

{
  const used = drainForDays(2) * DAY_SECONDS * 2;
  assert(Math.abs(used - 0.94) < 0.01, `2-day cruise drain should empty a full tank, got ${used}`);
  const shark = vehicleCfg("shark");
  const sperm = vehicleCfg("spermwhale");
  const dolphin = vehicleCfg("commondolphin");
  const twoDay = drainForDays(2);
  assert(shark.energyDrain <= twoDay * 1.01, `shark should last ~2 days, drain ${shark.energyDrain}`);
  assert(sperm.energyDrain < shark.energyDrain, `sperm whale should outlast a shark, ${sperm.energyDrain} vs ${shark.energyDrain}`);
  assert(dolphin.energyDrain > shark.energyDrain, `dolphin may burn faster than a shark, ${dolphin.energyDrain}`);
  assert(breathHold(6) / DAY_SECONDS < 0.2, "an orca dive should still be a fraction of the on-screen day");
}

console.log("breath.test.js ok");
