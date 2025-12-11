import { Client } from "discord.js";
import { LOGGER } from "../helpers/Logger";

export default (client: Client): void => {
  client.on("error", async (error) => {
    LOGGER.error("Discord error: " + error);
  });

  client.on("warn", async (warning) => {
    LOGGER.error("Discord warning: " + warning);
  });
};
