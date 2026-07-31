import type { CommandInteraction, Client } from 'discord.js';
import { CachedESI } from '../esi/cache';
import type { Command } from '../Command';
import { Config } from '../Config';
import { canUseChannel } from '../helpers/DiscordHelper';
import { formatISKValue } from '../helpers/JaniceHelper';
import { SPACE_TYPE_LABELS } from '../helpers/SpaceTypeHelpers';

export const Info: Command = {
  name: 'info',
  description: 'Output a list of what we are currently listening for.',
  run: async (client: Client, interaction: CommandInteraction) => {
    let response = 'KillFeed is not able to view this channel!';

    if (interaction.channel && canUseChannel(interaction.channel)) {
      const thisSubscription = Config.getInstance().allSubscriptions.get(
        interaction.channelId
      );

      if (!thisSubscription) {
        response =
          'A subscription was not found for this channel. Please use the /init command to get started.';
      }
      else {
        response = '';
        if (thisSubscription.Alliances.size > 0) {
          response
            += '**Alliances:**\n'
            + (await CachedESI
              .getAllianceNames(Array.from(thisSubscription.Alliances))
              .then((names) => {
                return names
                  .map((n) => `- ${n}`)
                  .sort((a, b) => a.localeCompare(b))
                  .join('\n');
              }))
            + '\n';
        }
        if (thisSubscription.Corporations.size > 0) {
          response
            += '**Corporations:**\n'
            + (await CachedESI
              .getCorporationNames(Array.from(thisSubscription.Corporations))
              .then((names) => {
                return names
                  .map((n) => `- ${n}`)
                  .sort((a, b) => a.localeCompare(b))
                  .join('\n');
              }))
            + '\n';
        }
        if (thisSubscription.Characters.size > 0) {
          response
            += '**Characters:**\n'
            + (await CachedESI
              .getCharacterNames(Array.from(thisSubscription.Characters))
              .then((names) => {
                return names
                  .map((n) => `- ${n}`)
                  .sort((a, b) => a.localeCompare(b))
                  .join('\n');
              }))
            + '\n';
        }
        if (thisSubscription.Ships.size > 0) {
          response
            += '**Ships:**\n'
            + (await CachedESI
              .getShipNames(Array.from(thisSubscription.Ships))
              .then((ships) => {
                return ships
                  .map((ship) => `- ${ship}`)
                  .sort((a, b) => a.localeCompare(b))
                  .join('\n');
              }))
            + '\n';
        }
        if (thisSubscription.Regions.size > 0) {
          response
            += '**Regions:**\n'
            + (await CachedESI
              .getRegions(Array.from(thisSubscription.Regions))
              .then((regions) => {
                return regions
                  .map((region) => `- ${region.name}`)
                  .sort((a, b) => a.localeCompare(b))
                  .join('\n');
              }))
            + '\n';
        }
        if (thisSubscription.Constellations.size > 0) {
          response
            += '**Constellations:**\n'
            + (await CachedESI
              .getConstellations(Array.from(thisSubscription.Constellations))
              .then((constellations) => {
                return constellations
                  .map((constellation) => `- ${constellation.name}`)
                  .sort((a, b) => a.localeCompare(b))
                  .join('\n');
              }))
            + '\n';
        }

        if (thisSubscription.SpaceTypes?.size) {
          response
            += '**Space:**\n'
            + [...thisSubscription.SpaceTypes]
              .map((spaceType) => `- ${SPACE_TYPE_LABELS[spaceType]}`)
              .join('\n')
            + '\n';
        }

        if (thisSubscription.Systems.size > 0) {
          response
            += '**Systems:**\n'
            + (await Promise
              .all(
                Array
                  .from(thisSubscription.Systems)
                  .map((id) => CachedESI.getSystem(id))
              )
              .then((systems) => {
                return systems
                  .map((system) => `- ${system.name}`)
                  .sort((a, b) => a.localeCompare(b))
                  .join('\n');
              }))
            + '\n';
        }

        response += `\nShowing (Kills/Losses): ${thisSubscription.Show}\n`;

        if (thisSubscription.MinISK) {
          response
            += `Minimum ISK: ${formatISKValue(thisSubscription.MinISK)}\n`;
        }

        if (response.length > 0) {
          response = 'Listening for:\n' + response;
        }
        else {
          response = 'No filters set. Use /add command to set some filters.';
        }
        if (thisSubscription.FullTest) {
          if (response.length > 0) {
            response += '\n';
          }
          response += 'Full test mode is on';
        }
        response += '\nFormat is ' + thisSubscription.ResponseFormat;
        response
          += '\nBot is currently active in '
          + Config.getInstance().allSubscriptions.size
          + ' channels';
      }
    }

    await interaction.followUp({
      ephemeral: true,
      content: response,
    });
  },
};
