import { Command } from "./Command";
import { Hello } from "./commands/hello";
import { Help } from "./commands/help";
import { Test } from "./commands/test";
import { Update } from "./commands/update";

export const Commands: Command[] = [Hello, Update, Test, Help];
