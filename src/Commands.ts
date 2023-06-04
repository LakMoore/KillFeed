import { Command } from "./Command";
import { Add } from "./commands/add";
import { Hello } from "./commands/hello";
import { Help } from "./commands/help";
import { Init } from "./commands/init";
import { Test } from "./commands/test";
import { Info } from "./commands/info";
import { Remove } from "./commands/remove";
import { FullTest } from "./commands/fulltest";
import { SetMinISK } from "./commands/setMinISK";

export const Commands: Command[] = [
  Hello,
  Info,
  Test,
  Help,
  Init,
  Add,
  Remove,
  FullTest,
  SetMinISK,
];
