import { breathHold, tickBreathHold, vehicleCfg } from "../world/fauna.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

{
  assert(breathHold(6) === 72, `orca-scale 6 min dive should be 72 s, got ${breathHold(6)}`);
  assert(breathHold(1.2) === 14.4, `orca 1.2 min surface should be 14.4 s, got ${breathHold(1.2)}`);
  assert(breathHold(45, 15) === 180, `sperm 45 min dive at 15× should be 180 s, got ${breathHold(45, 15)}`);
  assert(breathHold(8, 15) === 32, `sperm 8 min surface at 15× should be 32 s, got ${breathHold(8, 15)}`);
}

{
  const orca = vehicleCfg("orca");
  assert(orca.diveTime === 72, `orca diveTime should be 72 s, got ${orca.diveTime}`);
  assert(orca.surfaceTime === 14.4, `orca surfaceTime should be 14.4 s, got ${orca.surfaceTime}`);
  const sperm = vehicleCfg("spermwhale");
  assert(sperm.diveTime === 180, `sperm diveTime should be 180 s, got ${sperm.diveTime}`);
  assert(sperm.surfaceTime === 32, `sperm surfaceTime should be 32 s, got ${sperm.surfaceTime}`);
}

{
  const cfg = { diveTime: 20, surfaceTime: 8 };
  let s = tickBreathHold(false, 20, 5, cfg, false);
  assert(s.surfacing === false && s.breathT === 15, `dive should drain, got ${s.breathT}`);
  s = tickBreathHold(false, 0.5, 1, cfg, false);
  assert(s.surfacing === true && s.breathT === 8, `empty tank should start the commute with a full surface interval, got ${JSON.stringify(s)}`);
  s = tickBreathHold(true, 8, 4, cfg, false);
  assert(s.surfacing === true && s.breathT === 8, `commute up must not burn surfaceTime, got ${s.breathT}`);
  s = tickBreathHold(true, 8, 3, cfg, true);
  assert(s.surfacing === true && s.breathT === 5, `recovery should count only at the air, got ${s.breathT}`);
  s = tickBreathHold(true, 0.4, 1, cfg, true);
  assert(s.surfacing === false && s.breathT === 20, `full recovery should start a new dive, got ${JSON.stringify(s)}`);
}

console.log("breath.test.js ok");
