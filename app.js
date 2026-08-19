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
import cron from 'cron';

import {
  Client,
  GatewayIntentBits,
  Events,
  TimestampStyles
} from 'discord.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
  ]
});

// Create an express app
const app = express();
// Get port, or default to 3000
const PORT = process.env.PORT || 3000;
// To keep track of our active games
const activeGames = {};

//guild
let guild;
let channel;
let bigWalkRole;

//print time
const startupNow = new Date();
let unixTime = Math.floor(startupNow.getTime() / 1000);

console.log('Current time:', startupNow);
console.log('Unixtime: ', unixTime);
/**
 * Interactions endpoint URL where Discord will send HTTP requests
 * Parse request body and verifies incoming requests using discord-interactions package
 */

 //command list
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
      console.log('/test proc');
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
    if (name === 'rps' && id) {
      //Interaction context
      console.log('/rps proc');
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

    if (name === 'time') {
      console.log('/time proc');
      const now = new Date();
      unixTime = Math.floor(now.getTime() / 1000);
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          flags: InteractionResponseFlags.IS_COMPONENTS_V2,
          components:[
            {
              type: MessageComponentTypes.TEXT_DISPLAY,
              content: `Current time: <t:${unixTime}>`
            }
                    ] 
              },
                    });
    }


    console.error(`unknown command: ${name}`);
    return res.status(400).json({ error: 'unknown command MORON' });
  }


  console.log('TYPE RECEIVED:', type);

  //debug print command
if (type === InteractionType.MESSAGE_COMPONENT) {
  console.log('MESSAGE COMPONENT HANDLER REACHED');
}
  //actual event handler
if (type === InteractionType.MESSAGE_COMPONENT) {
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

//error handling
  console.error('unknown interaction type', type);
  return res.status(400).json({
    error: 'unknown interaction type, u havent made this yet'
  });
});

//constructor(cronTime, onTick, onComplete, start, timeZone, context, runOnInit, utcOffset, unrefTimeout, waitForCompletion, errorHandler, name, threshold):
//repeat message periodically      crontime        
//                                 onTick (function to execute at time)
let repeatTime = new cron.CronJob('00 00 9 * * *',
                                 () => {
                                    console.log('/repeatTime proc');
                                    const guild = client.guilds.cache.get('579666389829287936');
                                    const channel = guild.channels.cache.get('1539140727043522612');
                                    channel.send('It is 9am');
                                 },
                                  null,
                                  false,
                                  'Asia/Tokyo'
                                  );
//repeatTime.start();

//every day, ping everyone and see when they are available, if everyone is available then ping a possible session time

let dateMessage;

let scheduleRepeat = new cron.CronJob('00 27 23 * * *',
                                 async () => {
                                    console.log('/repeatTime proc');

dateMessage = await channel.send(`herro everyone!! <@&${bigWalkRole.id}>
react 🟥 if youre available from (9am to 12pm) on (tomorrow's date)
react 🟩 if youre available from (12pm to 4pm) on (tomorrow's date)`);
                                    await dateMessage.react('🟥');
                                    await dateMessage.react('🟩');

                                    
                                 },
                                  null,
                                  false,
                                  'Asia/Tokyo'
                                  );
scheduleRepeat.start();

let i = 0;
let timeSlotFound = false;
//print current reactions
let timeSlotArray = [0, 0, 0, 0, 0];
let reactionCountRepeat = new cron.CronJob('30 * * * * *', 
                          async() => {

  i = 0;
  timeSlotArray = [0, 0, 0, 0, 0];

  console.log('/reactionCountRepeat proc');

  if (!dateMessage) {
    return;
  }

  let reactionCounts = dateMessage.reactions.cache;
    for (const reaction of reactionCounts.values()) {
      console.log('Emoji:', reaction.emoji.name);
      console.log('Count:', reaction.count);
          i++;
    //chatgpt get roles
      const users = await reaction.users.fetch();
      for (const user of users.values()) {

        //fetch and print user roles
        console.log('User:', user.username);
        const member = await dateMessage.guild.members.fetch(user.id);
        console.log('Roles:', member.roles.cache.map(role => role.name));

        if (member.roles.cache.has(bigWalkRole.id)) {
          console.log(`${user.username} is in the Big Walk group, adding to timeslot`);
          timeSlotArray[i] = timeSlotArray[i] + 1;
        }

        //if time slot successfully found
        if (timeSlotArray[i] === bigWalkRole.members.size) {

          console.log('Time slot found at:', reaction.emoji.name);

await channel.send(`<@&${bigWalkRole.id}>
hoooolly fuck!! An available timeslot was found at this timeslot tomorrow: ${reaction.emoji.name}
everyone get on big walk tomorrow at this specific time!!`);
          timeSlotFound = true;
          
        }
      }

    }
    if (timeSlotFound === true){
      reactionCountRepeat.stop();
    }
  }

);
reactionCountRepeat.start();


//startup
app.listen(PORT, () => {
  console.log('Listening on port1 bahahahahaha!', PORT);
});

//chatgpted this part
client.login(process.env.DISCORD_TOKEN);
client.once(Events.ClientReady, readyClient => {
  console.log(`Logged in: ${readyClient.user.tag}`);

  // guild initialization
guild = client.guilds.cache.get('579666389829287936');
channel = guild.channels.cache.get('1539140727043522612');
bigWalkRole = guild.roles.cache.get('1539590284671844422');

console.log('Guild:', guild.name);
console.log('Channel:', channel.name);
console.log('Big Walk Role:', bigWalkRole.name);

});