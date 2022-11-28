import { Channel, TextChannel } from "discord.js";
import { ChannelSettings } from "../Config";

// serialise our settings storage object, dropping the internal reference to the channel itself

export function generateConfigMessage(settings: ChannelSettings): string {
  return JSON.stringify(
    settings,
    (key, value) => {
      if (key === "Channel") {
        return "";
      } else if (value instanceof Set) {
        return [...value];
      }
      return value;
    },
    2
  );
}

export function parseConfigMessage(
  message: string,
  channel: Channel
): ChannelSettings {
  let result = undefined;

  try {
    result = JSON.parse(message, (key, value) => {
      if (key === "Channel") {
        return channel;
      } else if (value instanceof Array) {
        return new Set(value);
      }
      return value;
    });
  } catch (error) {
    console.log("Error while parsing the config");
  }

  if (result?.ResponseFormat) {
    return result;
  }

  return {
    Channel: channel as TextChannel,
    ResponseFormat: "Embed",
    FullTest: false,
    Alliances: new Set<number>(),
    Corporations: new Set<number>(),
    Characters: new Set<number>(),
    Ships: new Set<number>(),
  };
}

export function addMatcherEntry(
  matcher: Map<number, Set<string>>,
  id: number,
  channelId: string
) {
  let s = matcher.get(id);
  if (!s) {
    s = new Set<string>();
  }
  s.add(channelId);
  matcher.set(id, s);
}
