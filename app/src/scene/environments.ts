import { Group } from "three";
import type { ThemeId } from "./themes";
import { themes } from "./themes";
import { box } from "./sets/props";
import { resort } from "./sets/resort";
import { arena } from "./sets/arena";
import { club } from "./sets/club";
import { neon } from "./sets/neon";
import { mishka } from "./sets/mishka";
export function environment(theme: ThemeId): Group {
  const group = new Group();
  box(group, [0, -0.15, 0], [70, 0.2, 70], themes[theme].floor);
  if (theme === "wii") resort(group);
  if (theme === "open") arena(group);
  if (theme === "club") club(group);
  if (theme === "neon") neon(group);
  if (theme === "mishka") mishka(group);
  return group;
}
