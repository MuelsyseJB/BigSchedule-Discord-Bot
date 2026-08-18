import 'dotenv/config';
import express from 'express';
import {
  ButtonStyleTypes,
  InteractionResponseFlags,
  InteractionResponseType,
  InteractionType,
  MessageComponentTypes,
  verifyKeyMiddleware,
} from 'discord-interactions';
import { getRandomEmoji, DiscordRequest } from './utils.js';
import { getShuffledOptions, getResult } from './game.js';

// Create an express app
const app = express();
// Get port, or default to 3000
const PORT = process.env.PORT || 3000;
// To keep track of our active games
const activeGames = {};

/**
 * Interactions endpoint URL where Discord will send HTTP requests
 * Parse request body and verifies incoming requests using discord-interactions package
 */
app.post('/interactions', verifyKeyMiddleware(process.env.PUBLIC_KEY), async function (req, res) {
  // Interaction id, type and data
  const { id, type, data } = req.body;

  console.log('MESSAGE_COMPONENT:', InteractionType.MESSAGE_COMPONENT);
  //error handling

  /**
   * Handle verification requests
   */
  if (type === InteractionType.PING) {
    return res.send({ type: InteractionResponseType.PONG });
  }

  /**
   * Handle slash command requests
   * See https://discord.com/developers/docs/interactions/application-commands#slash-commands
   */
  if (type === InteractionType.APPLICATION_COMMAND) {
    const { name } = data;

    // "test" command
    if (name === 'test') {
      // Send a message into the channel where command was triggered from
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          flags: InteractionResponseFlags.IS_COMPONENTS_V2,
          components: [
            {
              type: MessageComponentTypes.TEXT_DISPLAY,
              // Fetches a random emoji to send from a helper function
              content: `hello world ${getRandomEmoji()}`
            }
          ]
        },
      });
    }

    // "Challenge" command
    if (name === 'challenge' && id) {
      //Interaction context
      const context = req.body.context

      // User ID is in user field
      const userId = context === 0 ? req.body.member.user.id : req.body.user.id;

      //User's object choide
      const objectName = req.body.data.options[0].value;

      //Create active game using message ID as the game ID
      //id = message ID
      activeGames[id] = {
        id: userId, objectName,
      }

      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          flags: InteractionResponseFlags.IS_COMPONENTS_V2,
          components: [
          {
            type: MessageComponentTypes.TEXT_DISPLAY,
            //fetches a random emoji to send from a helper function
            content: `penis chud challenge from <@${userId}>`,
          },
          {
            type: MessageComponentTypes.ACTION_ROW,
            components: [
              {
                type: MessageComponentTypes.BUTTON,
                //Append the gameto use later on
                custom_id: `accept_button_${id}`,
                label: 'Accept',
                style: ButtonStyleTypes.PRIMARY,
            },
          ],
        },
      ],
    },
  });
}


    console.error(`unknown command: ${name}`);
    return res.status(400).json({ error: 'unknown command MORON' });
  }


  console.log('TYPE RECEIVED:', type);

if (type === InteractionType.MESSAGE_COMPONENT) {
  console.log('MESSAGE COMPONENT HANDLER REACHED');
}

if (type === 3) {
  //custom_id set in payload when sending message component
  const componentId = data.custom_id;

  if (componentId.startsWith('accept_button_')){
    //get the associated game ID
    const gameId = componentId.replace('accept_button_', '');
    //delete message with token in request body
    //const endpoint = `webhooks/${process.env.APP_ID}/${req.body.token}/messages/${req.body.message.id}`;
    
    try {
        //Delete previous message
        //await DiscordRequest(endpoint, { method: 'DELETE'});

      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          // Indicates it'll be an ephermeral message
          flags: InteractionResponseFlags.EPHEMERAL | InteractionResponseFlags.IS_COMPONENTS_V2,
          components: [
            {
              type: MessageComponentTypes.TEXT_DISPLAY,
              content: 'What is your object of choice?',
            },
            {
            type: MessageComponentTypes.ACTION_ROW,
            components: [
              {
                type: MessageComponentTypes.STRING_SELECT,
                // Append game ID
                custom_id: `select_choice_${gameId}`,
                options: getShuffledOptions(),
              }
            ]}]}});
          } catch (err) {
            console.error('ERROR FUCKING ERROR SENDING THE MESSAGE:', err);
            return res.status(500).json({ error: 'failed to handle button' });
          }
    } else if (componentId.startsWith('select_choice_')) {
      //get the associated game ID
      const gameId = componentId.replace('select_choice_', '');

      if (activeGames[gameId]) {
        // Interaction context
        const context = req.body.context;
        // Get user ID and object choice for responding user
        // User ID is in user field for dms, and member for servers
        const userId = context === 0 ? req.body.member.user.id : req.body.user.id;
        const objectName = data.values[0];
        //Calculate result from helper function
        // Calculate result from helper function
        const resultStr = getResult(activeGames[gameId], {
          id: userId,
          objectName,
        });
        //return to discord knows this part is handled
                  return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: resultStr,
            },
          });
      }
    }
}

  console.error('unknown interaction type', type);
  return res.status(400).json({
    error: 'unknown interaction type, u havent made this yet'
  });
});

app.listen(PORT, () => {
  console.log('Listening on port1 bahahahahaha!', PORT);
});