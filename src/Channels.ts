import { Client, TextChannel } from "discord.js";
import { Config } from "./Config";

export function updateChannel(client: Client<boolean>, channelId: string) {
  return client.channels.fetch(channelId, { cache: true }).then((channel) => {
    // If this is a purely text based channel
    if (
      channel &&
      channel.isTextBased() &&
      !channel.isVoiceBased() &&
      // didn't want to restrict it to TextChannel, but removing this makes a
      // mess of the message collection (below)
      channel instanceof TextChannel
    ) {
      let thisChannel = Config.getInstance().registeredChannels.get(channel.id);
      if (thisChannel !== undefined) {
        // If we already had a config loaded for this channel
        // we need to clear this channel out of the all listeners

        thisChannel.Alliances.forEach((allianceId) => {
          Config.getInstance()
            .matchedAlliances.get(allianceId)
            ?.delete(channel.id);
          console.log(
            `Deleted alliance ${allianceId} from server ${channel.id}`
          );
        });
        thisChannel.Corporations.forEach((allianceId) => {
          Config.getInstance()
            .matchedCorporations.get(allianceId)
            ?.delete(channel.id);
          console.log(
            `Deleted corporation ${allianceId} from server ${channel.id}`
          );
        });
        thisChannel.Characters.forEach((allianceId) => {
          Config.getInstance()
            .matchedCharacters.get(allianceId)
            ?.delete(channel.id);
          console.log(
            `Deleted character ${allianceId} from server ${channel.id}`
          );
        });
      }

      // reset config for this server
      thisChannel = {
        Channel: channel,
        ResponseFormat: "zKill",
        Alliances: new Set<number>(),
        Corporations: new Set<number>(),
        Characters: new Set<number>(),
      };
      Config.getInstance().registeredChannels.set(channel.id, thisChannel);

      // fetch all pinned messages on this channel
      return channel.messages
        .fetchPinned(false)
        .then((pinned) => {
          // async "foreach"
          return Promise.all(
            pinned.map((message, key) => {
              // Due to Discord "Intents", only the messages where
              // the bot is tagged will have content
              if (message.content) {
                // config messages should be in the format:
                // alliance/99011699/
                // corporation/98725503/
                // character/418245524/
                message.content.split("\n").forEach((line) => {
                  console.log(line);

                  // ignore any lines that start with #
                  if (!line.startsWith("#")) {
                    // tokenise the lines on /
                    const instruction = line.split("/");

                    // if this looks like a config line
                    if (instruction.length > 1) {
                      let inst = instruction[0].toLowerCase();
                      let id = Number.parseInt(instruction[1]);
                      let matcher = null;

                      // if this still looks like a config line
                      if (id.toString() === instruction[1]) {
                        console.log(id);

                        if (inst == "alliance") {
                          matcher = Config.getInstance().matchedAlliances;
                          thisChannel?.Alliances.add(id);
                        } else if (inst == "corporation") {
                          matcher = Config.getInstance().matchedCorporations;
                          thisChannel?.Corporations.add(id);
                        } else if (inst == "character") {
                          matcher = Config.getInstance().matchedCharacters;
                          thisChannel?.Characters.add(id);
                        }

                        if (matcher) {
                          let s = matcher.get(id);
                          if (!s) {
                            s = new Set<string>();
                          }
                          s.add(channel.id);
                          matcher.set(id, s);
                        }
                      }
                    }
                  }
                });
              }
            })
          );
        })
        .catch((err) => {
          console.log(err);
        });
    }
  });
}