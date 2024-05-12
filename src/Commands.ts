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
import { SetPingTarget } from "./commands/setPingTarget";
import { Stats } from "./commands/stats";

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
  SetPingTarget,
  Stats,
];
