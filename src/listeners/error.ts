import { APIRequest, Client, ResponseLike } from "discord.js";
import { LOGGER } from "../helpers/Logger";

export default (client: Client): void => {
  client.on("error", async (error) => {
    LOGGER.error("Discord error: " + error);
  });

  client.on("warn", async (warning) => {
    LOGGER.error("Discord warning: " + warning);
  });

  client.rest.on("rateLimited", (rateLimitInfo) => {
    LOGGER.info("Discord rate limited: " + JSON.stringify(rateLimitInfo));
  });

  client.rest.on("response", (request: APIRequest, response: ResponseLike) => {
    LOGGER.info("Discord request: " + JSON.stringify(request));
    LOGGER.info("Discord response: " + JSON.stringify(response));
  });

  client.rest.on("restDebug ", (info: string) => {
    LOGGER.info("Discord restDebug : " + info);
  });
};
