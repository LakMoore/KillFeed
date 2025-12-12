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

  client.rest.on("invalidRequestWarning", (invalidRequestInfo) => {
    LOGGER.info(
      "Discord invalid request warning: " + JSON.stringify(invalidRequestInfo)
    );
  });

  client.rest.on(
    "response",
    async (request: APIRequest, response: ResponseLike) => {
      // Do not log full request/response objects; they may contain sensitive headers (Authorization)
      // and are extremely noisy.
      LOGGER.info(
        "Discord request: " +
          JSON.stringify({
            method: request.method,
            path: request.path,
            route: request.route,
            retries: request.retries,
          })
      );

      let bodyPreview: string | undefined;
      // @discordjs/rest emits a cloned Response (see makeNetworkRequest), so reading the body here
      // will not consume the body used by the library.
      if (!response.ok) {
        try {
          const text = await response.text();
          bodyPreview =
            text.length > 2000 ? `${text.slice(0, 2000)}...[truncated]` : text;
        } catch {
          bodyPreview = "[unreadable body]";
        }
      }

      LOGGER.info(
        "Discord response: " +
          JSON.stringify({
            body: bodyPreview,
            status: response.status,
            statusText: response.statusText,
            ok: response.ok,
          })
      );
    }
  );

  client.rest.on("restDebug", (info: string) => {
    LOGGER.info("Discord restDebug : " + info);
  });
};
