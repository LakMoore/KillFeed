import { MessageCreateOptions } from "discord.js";
import { Package } from "../zKillboard";

export interface BaseFormat {
  getMessage: (data: Package, kill: boolean) => MessageCreateOptions;
}
