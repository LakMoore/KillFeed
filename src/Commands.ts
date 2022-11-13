import { Command } from "./Command";
import { Hello } from "./commands/hello";
import { Test } from "./commands/test";
import { Update } from "./commands/update";

export const Commands: Command[] = [Hello, Update, Test];
