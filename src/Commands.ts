import { Command } from "./Command";
import { Add } from "./commands/add";
import { Hello } from "./commands/hello";
import { Help } from "./commands/help";
import { Init } from "./commands/init";
import { Test } from "./commands/test";
import { Report } from "./commands/report";

export const Commands: Command[] = [Hello, Report, Test, Help, Init, Add];
