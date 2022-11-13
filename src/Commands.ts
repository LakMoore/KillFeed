import { Command } from "./Command";
import { Hello } from "./commands/hello";
import { Update } from "./commands/update";

export const Commands: Command[] = [Hello, Update];
