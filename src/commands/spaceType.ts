import {
  Client,
  CommandInteraction,
  SlashCommandBooleanOption,
  SlashCommandBuilder,
  SlashCommandStringOption,
} from 'discord.js';
import { Config } from '../Config';
import { getConfigMessage } from '../helpers/DiscordHelper';
import { generateConfigMessage } from '../helpers/KillFeedHelpers';
import { Command } from '../Command';
import { updateChannel } from '../Channels';
import {
  isSpaceType,
  SPACE_TYPE_ABYSSAL,
  SPACE_TYPE_HIGHSEC,
  SPACE_TYPE_LABELS,
  SPACE_TYPE_LOWSEC,
  SPACE_TYPE_NULLSEC,
  SPACE_TYPE_POCHVEN,
  SPACE_TYPE_WORMHOLE,
} from '../helpers/SpaceTypeHelpers';

export const NAME_TYPE = 'type';
export const NAME_ENABLED = 'enabled';

export const TYPE_ALL_SPACE = 'all';

const OPTION_TYPE = new SlashCommandStringOption()
  .setName(NAME_TYPE)
  .setDescription('Kind of space')
  .setRequired(true)
  .addChoices(
    { name: 'Everywhere (clear the filter)', value: TYPE_ALL_SPACE },
    { name: SPACE_TYPE_LABELS[SPACE_TYPE_WORMHOLE], value: SPACE_TYPE_WORMHOLE },
    { name: SPACE_TYPE_LABELS[SPACE_TYPE_HIGHSEC], value: SPACE_TYPE_HIGHSEC },
    { name: SPACE_TYPE_LABELS[SPACE_TYPE_LOWSEC], value: SPACE_TYPE_LOWSEC },
    { name: SPACE_TYPE_LABELS[SPACE_TYPE_NULLSEC], value: SPACE_TYPE_NULLSEC },
    { name: SPACE_TYPE_LABELS[SPACE_TYPE_POCHVEN], value: SPACE_TYPE_POCHVEN },
    { name: SPACE_TYPE_LABELS[SPACE_TYPE_ABYSSAL], value: SPACE_TYPE_ABYSSAL }
  );

const OPTION_ENABLED = new SlashCommandBooleanOption()
  .setName(NAME_ENABLED)
  .setDescription('Include this kind of space? Defaults to true.')
  .setRequired(false);

const builder = new SlashCommandBuilder()
  .setName('space_type')
  .setDescription(
    'Add a kind of space to this channel\'s filter, e.g. wormhole space.'
  )
  .addStringOption(OPTION_TYPE)
  .addBooleanOption(OPTION_ENABLED);

export const SpaceTypeCommand: Command = {
  ...builder.toJSON(),
  run: async (client: Client, interaction: CommandInteraction) => {
    let response = 'Something went wrong!';

    if (
      interaction.isChatInputCommand()
      && interaction.channel
      && interaction.guild
    ) {
      const thisSubscription = Config.getInstance().allSubscriptions.get(
        interaction.channel.id
      );

      if (!thisSubscription) {
        response = 'No subscription found in channel. Use /init to start.';
      }
      else {
        // create some breathing room for the server to catch up
        thisSubscription.PauseForChanges = true;

        const type = interaction.options.getString(NAME_TYPE);
        const enabled = interaction.options.getBoolean(NAME_ENABLED) ?? true;

        if (!thisSubscription.SpaceTypes) {
          thisSubscription.SpaceTypes = new Set();
        }

        if (type === TYPE_ALL_SPACE) {
          thisSubscription.SpaceTypes.clear();
          response =
            'Removed the space filter from this channel.';
        }
        else if (type && isSpaceType(type)) {
          if (enabled) {
            thisSubscription.SpaceTypes.add(type);
          }
          else {
            thisSubscription.SpaceTypes.delete(type);
          }

          response =
            thisSubscription.SpaceTypes.size === 0
              ? 'Removed the space filter from this channel.'
              : `Space filter: ${[...thisSubscription.SpaceTypes]
                .map((spaceType) => SPACE_TYPE_LABELS[spaceType])
                .join(', ')}.`;
        }
        else {
          response = 'Unknown kind of space.';
        }

        // re-generate the config message
        const message = await getConfigMessage(interaction.channel);

        if (message) {
          // save the config into the channel
          await message.edit(generateConfigMessage(thisSubscription));
          await updateChannel(
            client,
            interaction.channel.id,
            interaction.guild.name
          );
        }
        else {
          response = 'No subscription found in channel. Use /init to start.';
        }

        thisSubscription.PauseForChanges = false;
      }
    }

    await interaction.followUp({
      ephemeral: true,
      content: response,
    });
  },
};
