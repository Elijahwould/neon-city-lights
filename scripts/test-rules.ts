import rulesJson from "../public/data/rules.json";
import { addClassLevel, applyLevelUp, asiAssignmentOk, assignPooledScore, blankCharacter, classLevelAccess, classTechBudget, collectGrantedTechs, cyberdeckSize, derive, findClass, findSubclass, fitClassLevels, lineageAsiMode, lineageGrantsFeat, meetsMulticlassPrereq, pointBuySpent, roll4d6DropLowest, techLevelAccess, techPickCounts, trickAllowance } from "../src/lib/character";
import { HIDDEN_LINEAGES } from "../src/lib/data";
import { builderIntent, draftHasWork } from "../src/lib/draft";
import flavor from "../public/data/flavor.json";
import { chosenEquipment, equipmentLines, gearBalance, gearCatalog, gearLedger, grantEquipment, itemsNamedIn, startingMoney, xpForLevel } from "../src/lib/creation";
import { unfilledLineageChoices } from "../src/lib/traits";
import { fillNclWorkbook, sheetEditUrl, sheetValueWrites } from "../src/lib/gsheet";
import { writeValuesIntoXlsx } from "../src/lib/xlsx-values";
import { sheetAttackName } from "../src/lib/grants";
import * as XLSX from "xlsx";
import { readFileSync } from "node:fs";
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

check("flex accepts +2 on one score", asiAssignmentOk("flex", { str: 2 }), true);
check("flex accepts two +1s", asiAssignmentOk("flex", { str: 1, dex: 1 }), true);
check("flex rejects +2 and +1 together", asiAssignmentOk("flex", { str: 2, dex: 1 }), false);
check("human increase is two +1s", asiAssignmentOk("plus1plus1", { str: 1, dex: 1 }), true);
check("human increase rejects three +1s", asiAssignmentOk("plus1plus1", { str: 1, dex: 1, con: 1 }), false);
check("spread accepts +2 and +1", asiAssignmentOk("spread", { str: 2, dex: 1 }), true);
const splicerLineage = rules.lineages.find((item) => item.id === "race:splicer")!;
check("splicer uses the shared increase", splicerLineage.asi, "spread");
check("splicer house rule is recorded", (splicerLineage.houseRule ?? "").includes("same ability increase"), true);
check("splicer accepts +2 and +1", asiAssignmentOk(lineageAsiMode(splicerLineage), { str: 2, dex: 1 }), true);
check("splicer accepts three +1s", asiAssignmentOk(lineageAsiMode(splicerLineage), { str: 1, dex: 1, con: 1 }), true);
check("splicer no longer accepts two +2s", asiAssignmentOk(lineageAsiMode(splicerLineage), { str: 2, dex: 2 }), false);
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
check("the phb human is hidden from the picker", HIDDEN_LINEAGES.has("race:human"), true);
check("the playtest core is hidden from the picker", HIDDEN_LINEAGES.has("race:core"), true);
check("new human stays in the picker", HIDDEN_LINEAGES.has("race:new-human"), false);
check("hardlight core stays in the picker", HIDDEN_LINEAGES.has("race:hardlight-core"), false);
const worked = runner({ name: "Vex", classId: "enforcer", lineageId: "race:new-human" });
check("a named draft is unfinished work", draftHasWork(worked), true);
check("a blank draft is not worth continuing", draftHasWork(blankCharacter()), false);
check("build a runner starts fresh even when a draft exists", builderIntent({ id: null, fresh: true, draftHasWork: true }), "fresh");
check("opening the builder with a draft asks first", builderIntent({ id: null, fresh: false, draftHasWork: true }), "ask");
check("an empty visit starts fresh", builderIntent({ id: null, fresh: false, draftHasWork: false }), "fresh");
check("editing a saved runner loads that runner", builderIntent({ id: "abc", fresh: true, draftHasWork: true }), "edit");
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

const sourcecoder = findClass(rules, "sourcecoder")!;
const influencer = findClass(rules, "influencer")!;
const enforcerClass = findClass(rules, "enforcer")!;
const wizard = findClass(rules, "techwizard")!;
const roninClass = findClass(rules, "ronin")!;
const bladeSub = findSubclass(rules, "ronin:technoblade")!;
check("source coder 1 learns 4 tricks and 2 techs", classTechBudget(sourcecoder, null, 1, 3), { tricks: 4, techs: 2, prepared: null, mode: "known" });
check("source coder 5 learns 5 tricks and 6 techs", classTechBudget(sourcecoder, null, 5, 3), { tricks: 5, techs: 6, prepared: null, mode: "known" });
check("influencer 1 learns 2 tricks and 4 techs", classTechBudget(influencer, null, 1, 2), { tricks: 2, techs: 4, prepared: null, mode: "known" });
check("enforcer 5 prepares 4 techs and no tricks", classTechBudget(enforcerClass, null, 5, 2), { tricks: 0, techs: 4, prepared: 4, mode: "prepared" });
check("techwizard 1 has 3 tricks and a 6-tech deck", classTechBudget(wizard, null, 1, 3), { tricks: 3, techs: 6, prepared: 4, mode: "deck" });
check("technoblade 1 has no tricks or techs yet", classTechBudget(roninClass, bladeSub, 1, 3), { tricks: 0, techs: 0, prepared: null, mode: "known" });
check("technoblade 3 learns 2 tricks and 3 techs", classTechBudget(roninClass, bladeSub, 3, 3), { tricks: 2, techs: 3, prepared: null, mode: "known" });
check("source coder 3 locks 3rd-level techs until 5", classLevelAccess(sourcecoder, null, 3).find((gate) => gate.level === 3)?.reason, "Unlocks at Source Coder 5");
check("source coder 3 can learn 2nd-level techs", classLevelAccess(sourcecoder, null, 3).find((gate) => gate.level === 2)?.open, true);
check("enforcer class lock still names level 2", classLevelAccess(enforcerClass, null, 1).find((gate) => gate.level === 1)?.reason, "Unlocks at Enforcer 2");

const juicer5 = collectGrantedTechs(rules, runner({ classId: "enforcer", subclassId: "enforcer:juicer", level: 5, classLevels: [{ id: "enforcer", level: 5, subclassId: "enforcer:juicer" }] }));
check("juicer 5 grants the level 3 techs", juicer5.some((note) => note.id === "tech:cacophonous-strike" && note.source === "Granted by Clause of the Juicer at level 3"), true);
check("juicer 5 grants the level 5 techs", juicer5.some((note) => note.id === "tech:wavedash" && note.source === "Granted by Clause of the Juicer at level 5"), true);
const juicer2 = collectGrantedTechs(rules, runner({ classId: "enforcer", subclassId: "enforcer:juicer", level: 2, classLevels: [{ id: "enforcer", level: 2, subclassId: "enforcer:juicer" }] }));
check("juicer grants wait until their level", juicer2.length, 0);
const grantIds = new Set(juicer5.map((note) => note.id));
check("a granted tech does not spend a tech pick", techPickCounts([
  { id: "tech:cacophonous-strike", classId: "enforcer" },
  { id: "tech:anomaly-detector", classId: "enforcer" },
  { id: "tech:aimbot", classId: "sourcecoder" },
], "enforcer", rules.techs, grantIds), { tricks: 0, techs: 1 });
const helping = collectGrantedTechs(rules, runner({ asiPicks: [{ level: 1, mode: "feat", featId: "feat:helping-hand-hacker" }] }));
check("helping hand hacker grants its trick", helping.some((note) => note.id === "tech:hovering-helping-hand" && note.source === "Granted by Helping Hand Hacker"), true);
const elfTrick = collectGrantedTechs(rules, runner({ lineageId: "race:elf", lineagePicks: ["bonus-tech:techwizard:tech:aimbot"] }));
check("a lineage trick is granted by the lineage", elfTrick.some((note) => note.id === "tech:aimbot" && note.source === "Granted by Elf"), true);

check("debt is the stipend minus the charged gear", gearBalance(10000, [{ name: "Heavy pistol", cost: 12000, source: "Class: Streamer" }]), -2000);
const streamerClass = findClass(rules, "streamer")!;
const streamerKit = grantEquipment(chosenEquipment(equipmentLines(streamerClass, rules), {}).filter((item) => item.category !== "cybernetics"), "Class: Streamer");
check("streamer starting kit does not add cybernetics", streamerKit.cybernetics.length, 0);
check("streamer weapons are labeled with the class", streamerKit.weapons.every((weapon) => weapon.source === "Class: Streamer"), true);
const street = rules.upbringings.find((item) => item.id === "upbringing:street-kid")!;
const streetGear = itemsNamedIn(gearCatalog(rules), street.equipment);
check("street kid gear is not added without that upbringing", streetGear.every((item) => item.category !== "cybernetics"), true);
const bare = runner({ classId: "streamer", level: 1 });
check("a runner with no upbringing has no upbringing charges", gearLedger(bare, rules).some((line) => line.source.startsWith("Upbringing:")), false);
check("an empty splicer still needs both splice groups", unfilledLineageChoices(runner({ lineageId: "race:splicer" }), rules.lineages).length, 2);
check("filled splices leave the lineage list", unfilledLineageChoices(runner({
  lineageId: "race:splicer",
  lineagePicks: ["major:aquatic", "minor:adorable-tail", "minor:digitigrade"],
}), rules.lineages).length, 0);

const template = XLSX.read(readFileSync("public/data/ncl-gsheet-v2.1.xlsx"));
const filledRunner = runner({
  name: "Vex Kade",
  classId: "enforcer",
  subclassId: "enforcer:juicer",
  level: 5,
  classLevels: [{ id: "enforcer", level: 5, subclassId: "enforcer:juicer" }],
  lineageId: "race:human",
  upbringingId: "upbringing:street-kid",
  baseScores: scores,
  lineageAsi: { str: 1, dex: 1 },
  fightingStyles: ["Defense"],
  armorId: "armor:ceramiron",
  armorSource: "Class: Enforcer",
  weapons: [{ id: "weapon:spear", source: "Class: Enforcer" }],
  skillProfs: ["Athletics", "Intimidation"],
});
const filledDerived = derive(filledRunner, rules);
const filled = fillNclWorkbook(template, filledRunner, rules, filledDerived);
const mainSheet = filled.book.Sheets["v2.1"];
check("the template level formula stays", Boolean(mainSheet.AL6?.f), true);
check("the template version cell stays 2.1", mainSheet.AQ4?.v, "2.1");
check("the class cell names the enforcer", String(mainSheet.T5?.v).includes("Enforcer"), true);
check("the name is written", mainSheet.C6?.v, "Vex Kade");
check("the strength base score is written", mainSheet.C16?.v, 16);
check("athletics is marked proficient", mainSheet.H28?.v, 1);
check("the sheet keeps every template tab", filled.book.SheetNames.join(","), template.SheetNames.join(","));
check("age has no runner field", filled.unmapped.some((line) => line.startsWith("Age")), true);

const originalBytes = new Uint8Array(readFileSync("public/data/ncl-gsheet-v2.1-original.xlsx"));
const originalBook = XLSX.read(originalBytes, { type: "array", cellFormula: true });
const mapped = sheetValueWrites(originalBook, filledRunner, rules, filledDerived);
const formulaCells = new Set<string>();
for (const name of originalBook.SheetNames) {
  const sheet = originalBook.Sheets[name];
  for (const addr of Object.keys(sheet)) {
    if (sheet[addr]?.f) formulaCells.add(`${name}!${addr}`);
  }
}
check("the mapping writes the character name", mapped.writes.some((write) => write.range === "'v2.1'!C6" && write.value === "Vex Kade"), true);
check("the mapping writes the strength score", mapped.writes.some((write) => write.range === "'v2.1'!C16" && write.value === 16), true);
check("the mapping writes the class", mapped.writes.some((write) => write.range === "'v2.1'!T5" && String(write.value).includes("Enforcer")), true);
check("the mapping writes athletics", mapped.writes.some((write) => write.range === "'v2.1'!H28" && write.value === 1), true);
check("the mapping never targets a formula cell", mapped.writes.every((write) => !formulaCells.has(write.range.replace(/^'([^']+)'!/, "$1!"))), true);
const patched = writeValuesIntoXlsx(originalBytes, mapped.cells);
const patchedBook = XLSX.read(patched.bytes, { type: "array", cellFormula: true, cellStyles: true });
check("the excel file keeps the level formula", Boolean(patchedBook.Sheets["v2.1"].AL6?.f), true);
check("the excel file keeps the name cell's style", Boolean(patchedBook.Sheets["v2.1"].C6?.s), true);
check("the excel file contains the runner name", patchedBook.Sheets["v2.1"].C6?.v, "Vex Kade");
check("the sheet link names the owning Google account", sheetEditUrl("abc", "runner@example.com"), "https://docs.google.com/spreadsheets/d/abc/edit?authuser=runner%40example.com");

const stalker = derive(runner({ classId: "auditor", subclassId: "auditor:dark-stalker", level: 3, baseScores: scores }), rules);
check("dark stalker adds wisdom to initiative", stalker.initiative, 3);
const buckler = derive(runner({ classId: "outlaw", subclassId: "outlaw:swashbuckler", level: 3, baseScores: scores }), rules);
check("swashbuckler adds charisma to initiative", buckler.initiative, 4);
const bulwark = derive(runner({ classId: "techwizard", subclassId: "techwizard:bulwark", level: 2, baseScores: scores }), rules);
check("bulwark adds intelligence to initiative", bulwark.initiative, 5);
const dullBulwark = derive(runner({ classId: "techwizard", subclassId: "techwizard:bulwark", level: 2, baseScores: { ...scores, int: 8 } }), rules);
check("bulwark intelligence cannot lower initiative", dullBulwark.initiative, 2);
const nexus = derive(runner({ classId: "techwizard", subclassId: "techwizard:nexus-modder", level: 2, baseScores: scores }), rules);
check("nexus modder does not add intelligence to initiative", nexus.initiative, 2);
const stasis = derive(runner({ classId: "techwizard", subclassId: "techwizard:stasis-technician", level: 2, baseScores: scores }), rules);
check("stasis technician adds intelligence to initiative", stasis.initiative, 5);

const fast = derive(runner({ classId: "renegade", level: 5, baseScores: scores }), rules);
check("renegade fast movement adds 10 feet", fast.speed, 40);
const heavyRenegade = derive(runner({ classId: "renegade", level: 5, armorId: "armor:ceramiron", baseScores: scores }), rules);
check("renegade fast movement stops in heavy armor", heavyRenegade.speed, 30);
const feral = derive(runner({ classId: "renegade", level: 7, baseScores: scores }), rules);
check("renegade gains advantage on initiative at 7th", feral.initiativeNotes.some((note) => note.startsWith("Advantage")), true);
const armoredBrawler = derive(runner({ classId: "brawler", level: 6, armorId: "armor:nanofilm", baseScores: scores }), rules);
check("brawler unarmored movement needs an empty armor slot", armoredBrawler.speed, 30);
const scout = derive(runner({ classId: "outlaw", subclassId: "outlaw:scout", level: 9, baseScores: scores }), rules);
check("scout superior mobility adds 10 feet at 9th", scout.speed, 40);
check("scout gains nature", scout.skills.find((skill) => skill.name === "Nature")?.proficient, true);
check("scout expertise is on survival", scout.skills.find((skill) => skill.name === "Survival")?.expertise, true);

const surge = derive(runner({ classId: "sourcecoder", subclassId: "sourcecoder:surge-splicer", level: 1, baseScores: scores }), rules);
const plainCoder = derive(runner({ classId: "sourcecoder", level: 1, baseScores: scores }), rules);
check("surge splicer unarmored ac is 13 + dex", surge.ac, 15);
check("surge splicer gains 1 hp at 1st level", surge.hp, plainCoder.hp + 1);
const aqueous = derive(runner({
  classId: "sourcecoder",
  subclassId: "sourcecoder:surge-splicer",
  level: 14,
  baseScores: scores,
  grantPicks: { "affinity:sourcecoder:surge-splicer": ["Aqueous"] },
}), rules);
check("aqueous surge movement is a swim speed", aqueous.movement.includes("swim"), true);
const streetElf = derive(runner({ lineageId: "race:elf", sublineage: "Street", baseScores: scores }), rules);
check("street elf speedy is 35 feet", streetElf.speed, 35);
const jerboanSpeed = derive(runner({ lineageId: "race:jerboan", sublineage: "Punk Rock Jerboan", baseScores: scores }), rules);
check("jerboan base speed stays 25", jerboanSpeed.speed, 25);
const wukong = derive(runner({ lineageId: "race:wukong", sublineage: "Melon Munchers", baseScores: scores }), rules);
check("wukong climbs at 25 feet", wukong.movement.includes("25 ft. climb"), true);
const stacker = derive(runner({ classId: "ronin", level: 4, lineageId: "race:artificiate", sublineage: "Stackerbot", baseScores: scores }), rules);
const plainRonin = derive(runner({ classId: "ronin", level: 4, baseScores: scores }), rules);
check("stackerbot gains 1 hp per level", stacker.hp, plainRonin.hp + 4);
const researcher = derive(runner({
  lineageId: "race:artificiate",
  sublineage: "Researchbot",
  baseScores: scores,
  grantPicks: { "skill:race:artificiate|Researchbot": ["History", "Medicine"] },
}), rules);
check("researchbot skills are proficient", researcher.skills.filter((skill) => skill.proficient).map((skill) => skill.name).sort(), ["History", "Medicine"]);
const ronin2 = derive(runner({ classId: "ronin", level: 2, baseScores: scores }), rules);
const gojira = derive(runner({ classId: "ronin", level: 2, lineageId: "race:kaijuborn", sublineage: "Gojira", baseScores: scores }), rules);
check("gojira swims 30 feet", gojira.movement.includes("30 ft. swim"), true);
check("gojira gains 1 hp per level", gojira.hp, ronin2.hp + 2);
const loader = derive(runner({ lineageId: "race:remake", sublineage: "Heavy Loader", baseScores: scores }), rules);
check("heavy loader chassis ac is 18", loader.ac, 18);
const nimble = derive(runner({ lineageId: "race:remake", sublineage: "Nimble 36", baseScores: { ...scores, dex: 18 } }), rules);
check("nimble 36 ac caps dex at 2 and walks 35", nimble.ac === 15 && nimble.speed === 35, true);
const engineer = derive(runner({ classId: "mechanist", subclassId: "mechanist:engineer", level: 3, baseScores: scores }), rules);
check("engineer grants electrician's tools", engineer.proficiencyText.includes("Electrician's Tools (Engineer)"), true);
const pilot = derive(runner({
  classId: "mechanist",
  subclassId: "mechanist:mech-pilot",
  level: 3,
  baseScores: scores,
  grantPicks: { "vehicle:mechanist:mech-pilot": ["Motorcycle", "Van"] },
}), rules);
check("mech pilot names two land vehicles", pilot.proficiencyText.includes("Motorcycle (Mech Pilot)") && pilot.proficiencyText.includes("Van (Mech Pilot)"), true);
const generalist = derive(runner({ classId: "techwizard", subclassId: "techwizard:it-generalist", level: 2, baseScores: scores }), rules);
check("it generalist grants both kits", generalist.proficiencyText.includes("Hacker's Kit (IT Generalist)") && generalist.proficiencyText.includes("Programmer's Kit (IT Generalist)"), true);
const vlogger = derive(runner({
  classId: "influencer",
  subclassId: "influencer:vlogger",
  level: 3,
  baseScores: scores,
  grantPicks: { "skill:influencer:vlogger": ["Deception", "Insight", "Persuasion"] },
}), rules);
check("vlogger chooses three skills", ["Deception", "Insight", "Persuasion"].every((name) => vlogger.skills.find((skill) => skill.name === name)?.proficient), true);

const katana = rules.weapons.find((weapon) => weapon.id === "weapon:katana");
check("two-handed katana matches the attack tab", katana ? sheetAttackName(katana, { id: katana.id, grip: "two" }) : "", "Two-handed katana");
const knuckles = rules.weapons.find((weapon) => weapon.id === "weapon:brass-knuckles");
check("brass knuckles name the damage type", knuckles ? sheetAttackName(knuckles, { id: knuckles.id, damageType: "piercing" }) : "", "Brass Knuckles (piercing)");
const swung = derive(runner({ classId: "ronin", level: 1, baseScores: scores, weapons: [{ id: "weapon:katana", grip: "two" }] }), rules);
check("a two-handed katana deals 1d10", swung.attacks[0]?.damage.startsWith("1d10"), true);
const typed = derive(runner({ classId: "ronin", level: 1, baseScores: scores, weapons: [{ id: "weapon:brass-knuckles", damageType: "slashing" }] }), rules);
check("brass knuckles can deal slashing", typed.attacks[0]?.damage.includes("slashing"), true);
const gloves = derive(runner({ classId: "mechanist", subclassId: "mechanist:armorer", level: 3, baseScores: scores, weapons: [{ id: "weapon:concussion-gloves" }] }), rules);
check("concussion gloves use intelligence for an armorer", gloves.attacks[0]?.toHit, 5);
check("concussion gloves deal thunder", gloves.attacks[0]?.damage.includes("thunder"), true);
const launcher = rules.weapons.find((weapon) => weapon.id === "weapon:arc-launcher");
check("arc launcher is in the weapon table", Boolean(launcher), true);
const dipped = derive(runner({
  level: 2,
  classLevels: [{ id: "ronin", level: 1, subclassId: null }, { id: "influencer", level: 1, subclassId: null }],
  baseScores: scores,
}), rules);
check("influencer multiclass can be a streaming tool or an instrument", dipped.proficiencyText.includes("one instrument of your choice"), true);

const workbook = XLSX.read(readFileSync("public/data/ncl-gsheet-v2.1.xlsx"), { cellFormula: true });
const classInfo = workbook.Sheets["Class Info"];
const lineageInfo = workbook.Sheets["Lineage Info"];
const cellValue = (sheet: XLSX.WorkSheet, addr: string) => sheet[addr]?.f ? `=${sheet[addr].f}` : sheet[addr]?.v;
check("influencer skills on the sheet choose 3", String(cellValue(classInfo, "Q39")).includes("Choose 3"), true);
check("outlaw skills on the sheet choose 4", String(cellValue(classInfo, "Q69")).includes("Choose 4"), true);
check("outlaw weapons on the sheet name the revolver", String(cellValue(classInfo, "X69")).includes("Revolver"), true);
check("mechanist multiclass tools are locksmith and a basic toolkit", cellValue(classInfo, "AB48"), "Light Armor, Medium Armor, Shields, 2 Tools (Locksmith's Tools, Basic Toolkit)");
check("auditor multiclass grants no skill", cellValue(classInfo, "AB7"), "Light Armor, Medium Armor, Shields, Civilian Weapons, Military Weapons");
check("nexus initiative cell is a dash", cellValue(classInfo, "M149"), "-");
check("singularity initiative cell is a dash", cellValue(classInfo, "M151"), "-");
check("bulwark initiative formula stays", cellValue(classInfo, "M142"), "=intMod");
check("techwizard weapons on the sheet name the heavy pistol", String(cellValue(classInfo, "X141")).includes("Heavy Pistol"), true);
check("rave grants an electronic instrument", cellValue(classInfo, "AB23"), "1 Tool (Electronic Musical Instrument)");
check("sentai savior grants performance", cellValue(classInfo, "Q150"), "Performance");
check("scout grants nature and survival", cellValue(classInfo, "Q75"), "Choose 2, Nature, Survival");
check("new human increase is one +2 or two +1s", cellValue(lineageInfo, "F7"), "Increase one score by 2, or two different scores by 1 (str, dex, con, int, wis, cha)");
check("new human language is an old world language", cellValue(lineageInfo, "X7"), "Common, 1 Language (Old World)");

if (failed) {
  console.error(`${failed} failed`);
  process.exit(1);
}
console.log("all checks passed");
