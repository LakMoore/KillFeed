import { Client } from "discord.js";
import { Config, GuildSettings } from "./Config";

export function updateGuild(client: Client<boolean>, guildId: string) {
  // Fetch the guild/server by ID
  return client.guilds.fetch(guildId).then((g) => {
    let gs = Config.getInstance().guildSettings.get(guildId);
    if (gs !== undefined) {
      // If we already had a config loaded for this server
      // we need to clear this server out of the all listeners

      gs.Alliances.forEach((allianceId) => {
        Config.getInstance().matchedAlliances.get(allianceId)?.delete(guildId);
        console.log(`Deleted alliance ${allianceId} from server ${guildId}`);
      });
      gs.Corporations.forEach((allianceId) => {
        Config.getInstance()
          .matchedCorporations.get(allianceId)
          ?.delete(guildId);
        console.log(`Deleted corporation ${allianceId} from server ${guildId}`);
      });
      gs.Characters.forEach((allianceId) => {
        Config.getInstance().matchedCharacters.get(allianceId)?.delete(guildId);
        console.log(`Deleted character ${allianceId} from server ${guildId}`);
      });
    }

    // reset config for this server
    gs = {
      GuildID: guildId,
      Alliances: new Set<number>(),
      Corporations: new Set<number>(),
      Characters: new Set<number>(),
    };
    Config.getInstance().guildSettings.set(guildId, gs);

    // Fetch all channels from this guild/server
    return g.channels.fetch().then((c) => {
      // This is an async "foreach"
      return Promise.all(
        c.map((chn) => {
          // If this is a purely text based channel
          if (chn && chn.isTextBased() && !chn.isVoiceBased()) {
            console.log("Channel: " + chn.name);

            // fetch all pinned messages on this channel
            return chn.messages.fetchPinned(true).then((pinned) => {
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
                              gs?.Alliances.add(id);
                            } else if (inst == "corporation") {
                              matcher =
                                Config.getInstance().matchedCorporations;
                              gs?.Corporations.add(id);
                            } else if (inst == "character") {
                              matcher = Config.getInstance().matchedCharacters;
                              gs?.Characters.add(id);
                            }

                            if (matcher) {
                              let s = matcher.get(id);
                              if (!s) {
                                s = new Set<string>();
                              }
                              s.add(chn.id);
                              matcher.set(id, s);
                            }
                          }
                        }
                      }
                    });
                  }
                })
              );
            });
          }
        })
      );
    });
  });
}
