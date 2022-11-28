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

export function addListener(
  listener: Map<number, Set<string>>,
  id: number,
  channelId: string
) {
  let s = listener.get(id);
  if (!s) {
    s = new Set<string>();
  }
  s.add(channelId);
  listener.set(id, s);
}

export function removeListener(
  listener: Map<number, Set<string>> | undefined,
  id: number,
  channelId: string
) {
  // remove the ID from the current filters
  if (listener) {
    let s = listener.get(id);
    if (s) {
      s.delete(channelId);
      listener.set(id, s);
    }
    // no need to delete the channel id if
    // the alliance isn't currently being listened for
  }
}
