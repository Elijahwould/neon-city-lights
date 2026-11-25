import type { Character } from "./types";

/** A draft is worth offering to continue when the runner already made a choice. */
export function draftHasWork(character: Pick<Character, "name" | "classId" | "lineageId" | "upbringingId" | "classLevels" | "techs" | "weapons" | "armorId" | "inventory">) {
  return Boolean(
    character.name.trim()
    || character.classId
    || character.lineageId
    || character.upbringingId
    || character.classLevels.length
    || character.techs.length
    || character.weapons.length
    || character.armorId
    || character.inventory.length,
  );
}

/** Build a runner and other new-character links pass fresh=true and always start blank. */
export function builderIntent(input: { id: string | null; fresh: boolean; draftHasWork: boolean }) {
  if (input.id) return "edit" as const;
  if (input.fresh) return "fresh" as const;
  if (input.draftHasWork) return "ask" as const;
  return "fresh" as const;
}
