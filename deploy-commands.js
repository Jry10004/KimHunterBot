const { REST, Routes } = require('discord.js');
require('dotenv').config();
const { productionCommands } = require('./commands/commands');

const TOKEN = process.env.BOT_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID || '1376767794842046534';

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
    try {
        console.log('Started refreshing application (/) commands.');
        console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`Client ID: ${CLIENT_ID}`);
        console.log(`Commands count: ${productionCommands.length}`);

        // 전역 명령어로 등록
        await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            { body: productionCommands },
        );

        console.log('Successfully reloaded application (/) commands globally.');
        console.log('Commands registered:');
        productionCommands.forEach(cmd => {
            console.log(`- /${cmd.name}: ${cmd.description}`);
        });
    } catch (error) {
        console.error('Error deploying commands:', error);
    }
})();