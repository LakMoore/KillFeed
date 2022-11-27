import { Command } from "./Command";
import { Hello } from "./commands/hello";
import { Help } from "./commands/help";
import { Init } from "./commands/init";
import { Test } from "./commands/test";
import { Update } from "./commands/update";

export const Commands: Command[] = [Hello, Update, Test, Help, Init];
