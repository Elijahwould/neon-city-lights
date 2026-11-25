import rulesJson from "../public/data/rules.json";
import { addClassLevel, applyLevelUp, asiAssignmentOk, assignPooledScore, blankCharacter, cyberdeckSize, derive, fitClassLevels, lineageGrantsFeat, meetsMulticlassPrereq, pointBuySpent, roll4d6DropLowest, techLevelAccess, trickAllowance } from "../src/lib/character";
import flavor from "../public/data/flavor.json";
import { chosenEquipment, equipmentLines, startingMoney, xpForLevel } from "../src/lib/creation";
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
check("defense +2 in heavy armor is not enforcer-only", roninDefense.ac, 20);

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

const capped = derive(runner({
  classId: "enforcer",
  level: 8,
  baseScores: { ...scores, str: 15 },
  lineageAsi: { str: 2 },
  asiPicks: [
    { level: 4, classId: "enforcer", mode: "asi", abilities: { str: 2 } },
    { level: 8, classId: "enforcer", mode: "asi", abilities: { str: 2 } },
  ],
}), rules);
check("ability scores stop at 20 before cybernetics", capped.scores.str, 20);

const jerboanHeavy = derive(runner({
  classId: "enforcer",
  level: 1,
  lineageId: "race:jerboan",
  sublineage: "Punk Rock Jerboan",
  baseScores: { str: 10, dex: 14, con: 14, int: 10, wis: 10, cha: 12 },
  armorId: "armor:ceramiron",
}), rules);
check("jerboan speed ignores heavy armor", jerboanHeavy.speed, 25);
check("punk rock jerboan gains 1 hp per level", jerboanHeavy.hp, 13);

const noStat = derive(runner({
  classId: "enforcer",
  level: 5,
  baseScores: scores,
  cybernetics: [{ id: "cybernetic:biomod-xl" }],
}), rules);
check("biomod without an ability does nothing", noStat.scores.str, 16);

const mariner = derive(runner({
  classId: "ronin",
  level: 1,
  baseScores: { ...scores, dex: 14 },
  fightingStyles: ["Mariner"],
}), rules);
check("mariner adds 1 ac without heavy armor", mariner.ac, 13);

const duelist = derive(runner({
  classId: "ronin",
  level: 1,
  baseScores: { ...scores, str: 16 },
  fightingStyles: ["Dueling"],
  weapons: [{ id: "weapon:katana" }],
}), rules);
check("dueling adds 2 damage", duelist.attacks[0]?.damage.includes("+5"), true);

const split = addClassLevel([{ id: "enforcer", level: 5, subclassId: null }], "techwizard", 5);
check("adding a class keeps the level total", split?.map((entry) => entry.level), [4, 1]);
check("a level-1 character cannot be split", addClassLevel([{ id: "enforcer", level: 1, subclassId: null }], "techwizard", 1), null);
check("edited class levels still sum to the total", fitClassLevels([
  { id: "enforcer", level: 5, subclassId: null },
  { id: "techwizard", level: 1, subclassId: null },
], 5, "techwizard").map((entry) => entry.level), [4, 1]);

check("human increase is two +1s", asiAssignmentOk("plus1plus1", { str: 1, dex: 1 }), true);
check("human increase rejects three +1s", asiAssignmentOk("plus1plus1", { str: 1, dex: 1, con: 1 }), false);
check("spread accepts +2 and +1", asiAssignmentOk("spread", { str: 2, dex: 1 }), true);
check("splicer accepts two +2s", asiAssignmentOk("splicer", { str: 2, dex: 2 }), true);
check("splicer rejects a lone +2", asiAssignmentOk("splicer", { str: 2 }), false);
const swapped = assignPooledScore({ str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 }, "cha", 15);
check("standard array swaps instead of duplicating", swapped, { str: 8, dex: 14, con: 13, int: 12, wis: 10, cha: 15 });

const enforcer = rules.classes.find((item) => item.id === "enforcer");
const lines = equipmentLines(enforcer!, rules);
const packLine = lines.find((line) => line.options.some((option) => option.label.toLowerCase().includes("hobo")));
check("enforcer pack line is a choice", packLine?.choice, true);
check("option a is not hobo's pack", (packLine?.options.find((option) => option.key === "a")?.items ?? []).some((item) => item.id === "gear:hobos-pack"), false);
check("option b is hobo's pack", (packLine?.options.find((option) => option.key === "b")?.items ?? []).some((item) => item.id === "gear:hobos-pack"), true);
const defaults = chosenEquipment(lines, {});
check("default kit keeps ceramiron", defaults.some((item) => item.id === "armor:ceramiron"), true);
check("default kit does not take hobo's pack", defaults.some((item) => item.id === "gear:hobos-pack"), false);
const hobos = chosenEquipment(lines, { [packLine!.id]: "b" });
check("choosing b adds hobo's pack", hobos.some((item) => item.id === "gear:hobos-pack"), true);

const gunFu = derive(runner({
  classId: "ronin",
  level: 1,
  baseScores: scores,
  fightingStyles: ["Gun-Fu"],
  weapons: [{ id: "weapon:light-pistol" }],
}), rules);
check("gun-fu adds 1 to a one-handed ranged attack", gunFu.attacks[0]?.toHit, 5);

const thrown = derive(runner({
  classId: "ronin",
  level: 1,
  baseScores: { ...scores, str: 16 },
  fightingStyles: ["Thrown Weapon Fighting"],
  weapons: [{ id: "weapon:knife" }],
}), rules);
check("thrown style adds a second attack row", thrown.attacks.map((attack) => attack.name), ["Knife", "Knife (thrown)"]);
check("thrown row gets the ronin +2", thrown.attacks[1]?.damage.includes("+5"), true);
check("melee knife does not get the thrown bonus", thrown.attacks[0]?.damage.includes("+3"), true);

const off = derive(runner({
  classId: "ronin",
  level: 1,
  baseScores: { ...scores, str: 16 },
  weapons: [{ id: "weapon:machete" }, { id: "weapon:knife" }],
}), rules);
check("off-hand drops the ability modifier", off.attacks[1]?.damage.includes("+0"), true);
const twf = derive(runner({
  classId: "ronin",
  level: 1,
  baseScores: { ...scores, str: 16 },
  fightingStyles: ["Two-Weapon Fighting"],
  weapons: [{ id: "weapon:machete" }, { id: "weapon:knife" }],
}), rules);
check("two-weapon fighting puts the modifier back", twf.attacks[1]?.damage.includes("+3"), true);

const fists = derive(runner({
  classId: "enforcer",
  level: 1,
  baseScores: scores,
  fightingStyles: ["Unarmed Fighting"],
}), rules);
check("unarmed fighting with free hands is 1d8", fists.attacks.some((attack) => attack.damage.startsWith("1d8")), true);

const natural = derive(runner({
  classId: "ronin",
  level: 1,
  lineageId: "race:splicer",
  lineagePicks: ["major:natural-armor", "minor:digitigrade", "minor:adorable-tail"],
  baseScores: { ...scores, dex: 14 },
}), rules);
check("natural armor is 13 + dex", natural.ac, 15);
check("digitigrade adds 5 feet", natural.speed, 35);
check("adorable tail grants persuasion", natural.skills.find((skill) => skill.name === "Persuasion")?.proficient, true);

const hare = derive(runner({
  classId: "ronin",
  level: 1,
  lineageId: "race:splicer",
  lineagePicks: ["major:leporine"],
  baseScores: { ...scores, dex: 14 },
}), rules);
check("leporine adds proficiency to initiative", hare.initiative, 4);
check("powerful build doubles carry", derive(runner({ lineagePicks: ["major:powerful-build"], baseScores: scores }), rules).carryMultiplier, 2);

const flavorBook = flavor as { classes: Record<string, { origin?: string | null; book?: string | null; examples?: string[] }>; lineages: Record<string, { blurb?: string | null; image?: string | null }> };
check("enforcer page does not name a dnd class", flavorBook.classes.enforcer?.origin ?? null, null);
check("enforcer book is the player's handbook", flavorBook.classes.enforcer?.book, "Player's Handbook");
check("dark stalker is from gloom stalker", flavorBook.classes["auditor:dark-stalker"]?.origin, "Gloom Stalker");
check("street fighter is from pugilist", flavorBook.classes.streetfighter?.origin, "Pugilist");
check("enforcer has wiki vignettes", (flavorBook.classes.enforcer?.examples ?? []).length >= 2, true);
check("human blurb comes from the wiki intro", (flavorBook.lineages["race:human"]?.blurb ?? "").includes("four hundred years"), true);
check("splicer portrait is stored locally", flavorBook.lineages["race:splicer"]?.image, "/art/race-splicer.jpg");

const allowance = trickAllowance(["Ordained Warrior"], 4, [
  { trick: true, level: 0, classes: ["enforcer"] },
  { trick: true, level: 0, classes: ["ordinator"] },
  { trick: true, level: 0, classes: ["ordinator"] },
], ["enforcer"]);
check("ordained warrior keeps two class trick slots", allowance.ownCap, 2);
check("ordinator tricks are bonus-only", allowance.isBonusOnly({ classes: ["ordinator"] }), true);
check("enforcer tricks are not bonus tricks", allowance.isBonusOnly({ classes: ["enforcer"] }), false);
check("two ordinator tricks fill the bonus", allowance.bonusUsed.ordinator, 2);

const wizard1 = derive(runner({ classId: "techwizard", level: 1, baseScores: scores }), rules);
const wizardGates = techLevelAccess(rules, runner({ classId: "techwizard", level: 1, classLevels: [{ id: "techwizard", level: 1, subclassId: null }], baseScores: scores }), wizard1.slots, wizard1.pactLevel, wizard1.tricksMax);
check("techwizard 1 can cast level 1", wizardGates.find((gate) => gate.level === 1)?.open, true);
check("techwizard 1 locks level 3 until 5", wizardGates.find((gate) => gate.level === 3)?.reason, "Unlocks at Techwizard 5");
check("techwizard 1 can learn tricks", wizardGates.find((gate) => gate.level === 0)?.open, true);

const enforcer1 = derive(runner({ classId: "enforcer", level: 1, baseScores: scores }), rules);
const enforcerGates = techLevelAccess(rules, runner({ classId: "enforcer", level: 1, classLevels: [{ id: "enforcer", level: 1, subclassId: null }], baseScores: scores }), enforcer1.slots, enforcer1.pactLevel, enforcer1.tricksMax);
check("enforcer 1 locks 1st-level techs until level 2", enforcerGates.find((gate) => gate.level === 1)?.reason, "Unlocks at Enforcer 2");

const blade = derive(runner({ classId: "ronin", subclassId: "ronin:technoblade", level: 1, classLevels: [{ id: "ronin", level: 1, subclassId: "ronin:technoblade" }], baseScores: scores }), rules);
const bladeGates = techLevelAccess(rules, runner({ classId: "ronin", level: 1, classLevels: [{ id: "ronin", level: 1, subclassId: "ronin:technoblade" }], baseScores: scores }), blade.slots, blade.pactLevel, blade.tricksMax);
check("technoblade locks 1st-level techs until ronin 3", bladeGates.find((gate) => gate.level === 1)?.reason, "Unlocks at Ronin 3");

const multiCast = derive(runner({
  level: 2,
  classLevels: [
    { id: "techwizard", level: 1, subclassId: null },
    { id: "ordinator", level: 1, subclassId: null },
  ],
  baseScores: scores,
}), rules);
const splitGates = techLevelAccess(rules, runner({
  level: 2,
  classLevels: [
    { id: "techwizard", level: 1, subclassId: null },
    { id: "ordinator", level: 1, subclassId: null },
  ],
  baseScores: scores,
}), multiCast.slots, multiCast.pactLevel, multiCast.tricksMax);
check("multiclass locks 2nd-level techs until combined caster level 3", splitGates.find((gate) => gate.level === 2)?.reason, "Unlocks at combined caster level 3");

if (failed) {
  console.error(`${failed} failed`);
  process.exit(1);
}
console.log("all checks passed");
