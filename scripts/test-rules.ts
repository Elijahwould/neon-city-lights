import rulesJson from "../public/data/rules.json";
import { applyLevelUp, blankCharacter, cyberdeckSize, derive, lineageGrantsFeat, meetsMulticlassPrereq, pointBuySpent, roll4d6DropLowest } from "../src/lib/character";
import { startingMoney, xpForLevel } from "../src/lib/creation";
import type { Character, Rules } from "../src/lib/types";

const rules = rulesJson as Rules;
let failed = 0;

function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}\n  expected ${JSON.stringify(expected)}\n  actual   ${JSON.stringify(actual)}`);
  } else {
    console.log(`ok   ${name}`);
  }
}

function runner(partial: Partial<Character>): Character {
  return { ...blankCharacter(), name: "Test", ...partial };
}

const scores = { str: 16, dex: 14, con: 14, int: 16, wis: 12, cha: 14 };

const enforcer5 = derive(runner({
  classId: "enforcer",
  subclassId: "enforcer:juicer",
  level: 5,
  baseScores: scores,
  armorId: "armor:ceramiron",
  defenseStyle: true,
  weapons: [{ id: "weapon:katana" }],
}), rules);
check("enforcer 5 pb", enforcer5.pb, 3);
check("enforcer 5 hp", enforcer5.hp, 44);
check("enforcer 5 slots", enforcer5.slots.slice(0, 2), [4, 2]);
check("enforcer 5 ac heavy defense", enforcer5.ac, 18);
check("enforcer 5 prepared", enforcer5.preparedMax, 4);
check("enforcer 5 attacks", enforcer5.attackCount, 2);
check("enforcer 5 katana proficient", enforcer5.attacks[0]?.proficient, true);

const wizard5 = derive(runner({
  classId: "techwizard",
  level: 5,
  baseScores: { ...scores, con: 12 },
}), rules);
check("wizard 5 hp", wizard5.hp, 27);
check("wizard 5 slots", wizard5.slots.slice(0, 3), [4, 3, 2]);
check("wizard 5 tricks", wizard5.tricksMax, 4);
check("wizard 5 prepared", wizard5.preparedMax, 8);
check("wizard 5 dc", wizard5.techDc, 14);

const brawler5 = derive(runner({
  classId: "brawler",
  lineageId: "race:new-human",
  level: 5,
  baseScores: { str: 10, dex: 16, con: 14, int: 10, wis: 14, cha: 10 },
}), rules);
check("brawler 5 ac", brawler5.ac, 15);
check("brawler 5 speed", brawler5.speed, 40);
check("brawler 5 hp", brawler5.hp, 38);
check("brawler 5 chi", brawler5.resources["CHI Points"], "5");
check("brawler 5 die", brawler5.resources["Martial Arts"], "1d6");

const outlaw5 = derive(runner({
  classId: "outlaw",
  level: 5,
  baseScores: { ...scores, dex: 16 },
  skillProfs: ["Stealth", "Acrobatics", "Perception", "Sleight of Hand"],
  skillExpertise: ["Stealth", "Acrobatics"],
  upbringingId: "upbringing:street-kid",
}), rules);
check("outlaw 5 sneak", outlaw5.resources["Sneak Attack"], "3d6");
check("outlaw 5 stealth", outlaw5.skills.find((s) => s.name === "Stealth")?.mod, 9);
check("outlaw street kid deception", outlaw5.skills.find((s) => s.name === "Deception")?.proficient, true);

const tough = derive(runner({
  classId: "enforcer",
  level: 5,
  baseScores: scores,
  asiPicks: [{ level: 4, mode: "feat", featId: "feat:tough" }],
}), rules);
check("tough hp", tough.hp, 54);

const sf = derive(runner({
  classId: "streetfighter",
  level: 1,
  baseScores: { ...scores, con: 16 },
}), rules);
check("street fighter unarmored", sf.ac, 16);
const sfArmor = derive(runner({
  classId: "streetfighter",
  level: 1,
  baseScores: { ...scores, con: 16 },
  armorId: "armor:micromesh",
}), rules);
check("street fighter light uses con", sfArmor.ac, 14);

const ren = derive(runner({
  classId: "renegade",
  level: 1,
  baseScores: scores,
  shield: true,
}), rules);
check("renegade shield unarmored", ren.ac, 16);

const buy = pointBuySpent({ str: 15, dex: 15, con: 15, int: 8, wis: 8, cha: 8 }, rules);
check("point buy 27", buy, 27);

const streamer = derive(runner({ classId: "streamer", level: 5, baseScores: scores }), rules);
check("streamer pact slots", streamer.slots[2], 2);
check("streamer known", streamer.techsKnownMax, 6);

const frail = derive(runner({
  classId: "techwizard",
  level: 2,
  baseScores: { str: 10, dex: 10, con: 1, int: 14, wis: 10, cha: 10 },
}), rules);
check("minimum 1 hp per level", frail.hp, 2);

const heavy = derive(runner({
  classId: "enforcer",
  level: 1,
  baseScores: { str: 10, dex: 14, con: 14, int: 10, wis: 10, cha: 12 },
  armorId: "armor:ceramiron",
}), rules);
check("unmet strength slows by 10", heavy.speed, 20);
check("unmet strength disadvantages stealth", heavy.skills.find((s) => s.name === "Stealth")?.disadvantage, true);
check("unmet strength disadvantages acrobatics", heavy.skills.find((s) => s.name === "Acrobatics")?.disadvantage, true);

const nade = derive(runner({
  classId: "enforcer",
  level: 1,
  baseScores: scores,
  weapons: [{ id: "weapon:fragmentation-grenade" }],
}), rules);
check("grenades are military", nade.attacks[0]?.proficient, true);

const roninDefense = derive(runner({
  classId: "ronin",
  level: 1,
  baseScores: { ...scores, str: 16 },
  armorId: "armor:polysteel",
  defenseStyle: true,
}), rules);
check("defense +2 is enforcer only", roninDefense.ac, 19);

const multi = derive(runner({
  classId: "auditor",
  subclassId: null,
  level: 7,
  classLevels: [
    { id: "auditor", level: 4, subclassId: null },
    { id: "techwizard", level: 3, subclassId: null },
  ],
  baseScores: scores,
}), rules);
check("auditor 4 wizard 3 slots", multi.slots.slice(0, 3), [4, 3, 2]);
check("multiclass pb uses total level", multi.pb, 3);

const mech = derive(runner({
  level: 5,
  classLevels: [
    { id: "mechanist", level: 4, subclassId: null },
    { id: "techwizard", level: 1, subclassId: null },
  ],
  baseScores: scores,
}), rules);
check("mechanist counts as half caster", mech.slots.slice(0, 2), [4, 2]);

const gifted = derive(runner({
  level: 5,
  classLevels: [
    { id: "techwizard", level: 2, subclassId: null },
    { id: "streamer", level: 3, subclassId: null },
  ],
  baseScores: scores,
}), rules);
check("streamer gifted slots stay separate", gifted.pactSlots, 2);
check("streamer pact level", gifted.pactLevel, 2);
check("wizard slots stay on the wizard table", gifted.slots[0], 3);

check("pretender prereq both sides", meetsMulticlassPrereq("pretender", { ...scores, str: 14, dex: 10, int: 10, wis: 14 }), true);
check("pretender prereq fails one side", meetsMulticlassPrereq("pretender", { ...scores, str: 14, dex: 14, int: 10, wis: 10 }), false);
check("mechanist prereq int", meetsMulticlassPrereq("mechanist", { ...scores, int: 12 }), false);

const jerboan = derive(runner({
  classId: "ronin",
  level: 1,
  lineageId: "race:jerboan",
  sublineage: "Punk Rock Jerboan",
  baseScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  lineageAsi: { con: 2 },
  subAsi: { str: 1 },
}), rules);
check("jerboan heritage stacks", jerboan.scores.con, 12);
check("jerboan heritage stacks str", jerboan.scores.str, 11);

check("new human feat needs predisposition", lineageGrantsFeat("race:new-human", "Natural Biodiversity", true), false);
check("new human feat with predisposition", lineageGrantsFeat("race:new-human", "Specialized Predisposition", true), true);
check("human feat stays", lineageGrantsFeat("race:human", null, true), true);
check("deck at 1", cyberdeckSize(1), 6);
check("deck at 5", cyberdeckSize(5), 14);

const leveled = applyLevelUp(runner({ classId: "enforcer", level: 5, classLevels: [{ id: "enforcer", level: 5, subclassId: "enforcer:juicer" }] }), rules, "techwizard");
check("level up adds a class", leveled.level, 6);
check("level up sets mp to the new level threshold", leveled.mpEarned, 1);
check("level up keeps the first class", leveled.classLevels[0]?.id, "enforcer");

const lowHigh = derive(runner({
  classId: "enforcer",
  level: 5,
  baseScores: scores,
  cybernetics: [{ id: "cybernetic:optics" }, { id: "cybernetic:biomod-xl", stat: "str" }],
}), rules);
const highLow = derive(runner({
  classId: "enforcer",
  level: 5,
  baseScores: scores,
  cybernetics: [{ id: "cybernetic:biomod-xl", stat: "str" }, { id: "cybernetic:optics" }],
}), rules);
check("cyber order does not matter", lowHigh.scores.str, highLow.scores.str);
check("best biomod still applies", lowHigh.scores.str, 22);

let rolls = 0;
const seq = [6, 6, 6, 1, 5, 5, 5, 1];
check("4d6 drop lowest", roll4d6DropLowest(() => (seq[rolls++] - 1) / 6), 18);

const core = rules.lineages.find((item) => item.id === "race:core");
const hard = rules.lineages.find((item) => item.id === "race:hardlight-core");
check("core speed", core?.speed, 30);
check("hardlight core speed", hard?.speed, 30);
check("level 1 money", startingMoney(1).credits, 10000);
check("level 3 money", startingMoney(3).credits, 20000);
check("level 5 money is the wiki stipend", startingMoney(5).credits, 40000);
check("level 10 money is the house rule", startingMoney(10).credits, 90000);
check("level 10 money is labeled a house rule", startingMoney(10).houseRule, true);
check("level 3 uses 5e xp", xpForLevel(3), 900);
check("level 1 xp", xpForLevel(1), 0);

if (failed) {
  console.error(`${failed} failed`);
  process.exit(1);
}
console.log("all checks passed");
