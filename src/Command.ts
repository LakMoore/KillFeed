import {
  RESTPostAPIChatInputApplicationCommandsJSONBody,
  ChatInputCommandInteraction,
  Client,
} from "discord.js";

export interface Command
  extends RESTPostAPIChatInputApplicationCommandsJSONBody {
  run: (
    client: Client,
    interaction: ChatInputCommandInteraction
  ) => Promise<void>;
}
