import { Client, REST } from 'discord.js';
import { LOGGER } from '../helpers/Logger';

export default async function errorListeners(client: Client) {
  const doErrors = async () => {
    for await (const error of Client.on(client, 'error')) {
      LOGGER.error('Discord error: ' + error);
    }
  };

  const doWarnings = async () => {
    for await (const warning of Client.on(client, 'warn')) {
      LOGGER.warning('Discord warning: ' + warning);
    }
  };

  const doRateLimits = async () => {
    for await (const rateLimitInfo of REST.on(client.rest, 'rateLimited')) {
      LOGGER.error('Discord rate limited: ' + JSON.stringify(rateLimitInfo));
    }
  };

  const doInvalidRequestWarnings = async () => {
    for await (const invalidRequestWarnings of REST.on(
      client.rest,
      'invalidRequestWarning'
    )) {
      for (const invalidRequestInfo of invalidRequestWarnings) {
        LOGGER.warning(
          'Discord invalid request warning: '
            + JSON.stringify(invalidRequestInfo)
        );
      }
    }
  };

  const doRestResponses = async () => {
    for await (const [request, response] of REST.on(client.rest, 'response')) {
      // Do not log full request/response objects; they may contain sensitive headers (Authorization)
      // and are extremely noisy.
      LOGGER.info(
        'Discord request: '
          + JSON.stringify({
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
        }
        catch {
          bodyPreview = '[unreadable body]';
        }
      }

      LOGGER.info(
        'Discord response: '
          + JSON.stringify({
            body: bodyPreview,
            status: response.status,
            statusText: response.statusText,
            ok: response.ok,
          })
      );
    }
  };

  const doRestDebug = async () => {
    for await (const debugInfo of REST.on(client.rest, 'restDebug')) {
      LOGGER.debug('Discord restDebug: ' + debugInfo);
    }
  };

  return Promise.all([
    doErrors(),
    doWarnings(),
    doRateLimits(),
    doInvalidRequestWarnings(),
    doRestResponses(),
    doRestDebug(),
  ]);
}
