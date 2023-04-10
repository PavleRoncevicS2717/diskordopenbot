const { Client, Events, GatewayIntentBits} = require("discord.js")
require("dotenv/config")
const { OpenAIApi, Configuration} = require("openai")
const { Player, QueryType} =require("discord-player")
require("./config.json")
const config = new Configuration({
    apiKey: process.env.OPENAI_API_KEY
})

const openai = new OpenAIApi(config)

const client = new Client ({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates

    ]
})


client.once(Events.ClientReady, (clientUser) =>{
    console.log(`Logged in as ${clientUser.user.tag}`)
})
client.login(process.env.DISCORD_BOT_TOKEN)

const Bot_channel = "1094333847031783564"
const botMusicChan = "417289141915746305"
const PASTMSG = 5


client.on(Events.MessageCreate, async (message) =>{
    if (message.author.bot) return
    if(message.channel.id !== Bot_channel) return

    message.channel.sendTyping()
    let messages = Array.from(await message.channel.messages.fetch({
        limit: PASTMSG,
        before: message.id
    }))
    messages = messages.map(m=>m[1])
    messages.unshift(message)

    let users = [...new Set([...messages.map(m=> m.member.displayName), client.user.username] )]

    let lastUser = users.pop()

    let prompt = `Ovo sada je konverzacija izmedju ${users.join(", ")}, i tebe ${lastUser}. Ti si crni srbin, rodjen na planini pijes rakiju stalno i uvek si malo pijan. Dosta si nacionalistican ali paradoxalno non stop prozivas svoju drzavu jer je ipak sranje. \n\n`

    for (let i = messages.length - 1; i >=0; i--) {
        const m = messages[i]
        prompt += `${m.member.displayName}: ${m.content}\n`
    }
    prompt += `${client.user.username}:`
    console.log("prompt:", prompt)

    const response = await openai.createCompletion({
        prompt,
        model: "text-davinci-003",
        max_tokens: 500,
        stop: ["\n"]
    })

    console.log("response", response.data.choices[0].text)
    await message.channel.send(response.data.choices[0].text)


    //console.log(message.content)
})

const player = new Player(client)
player.on("trackStart", (queue, track) => {
    queue.metadata.send(`🎶 | SVIRAA: **${track.title}** in **${queue.connection.channel.name}**!`);
})
player.on("trackAdd", (queue, track) => {
    queue.metadata.send(`🎶 | Track **${track.title}** queued!`);
})
player.on("botDisconnect", (queue) => {
    queue.metadata.send("❌ | Nema para nema ni muzike");
})
player.on("channelEmpty", (queue) => {
    queue.metadata.send("❌ | Nema nidje nikog odo ja");
})
player.on("queueEnd", (queue) => {
    queue.metadata.send("✅ | Tuto finito ");
})
client.on("messageCreate", async (message) => {
    if (message.author.bot) return

    if (!client.application?.owner) await client.application?.fetch()
})
client.on("messageCreate", async (message) => {


    if (message.content === "!deploy" && message.author.id === client.application?.owner?.id) {
        await message.guild.commands.set([
            {
                name: "play",
                description: "Plays a song from youtube",
                options: [
                    {
                        name: "query",
                        type: "STRING",
                        description: "The song you want to play",
                        required: true
                    }
                ]
            },
            {
                name: "skip",
                description: "Skip to the current song"
            },
            {
                name: "queue",
                description: "See the queue"
            },
            {
                name: "stop",
                description: "Stop the player"
            },
        ])

        await message.reply("Deployed!")
    }
})
client.on("interactionCreate", async (interaction) => {
    if (!interaction.isCommand() || !interaction.guildId) return

    if (!(interaction.member instanceof GuildMember) || !interaction.member.voice.channel) {
        return void interaction.reply({ content: "You are not in a voice channel!", ephemeral: true })
    }

    if (interaction.guild.me.voice.channelId && interaction.member.voice.channelId !== interaction.guild.me.voice.channelId) {
        return void interaction.reply({ content: "You are not in my voice channel!", ephemeral: true })
    }
    if (interaction.commandName === "play") {
        await interaction.deferReply()

        const query = interaction.options.get("query").value
        const searchResult = await player
            .search(query, {
                requestedBy: interaction.user,
                searchEngine: QueryType.AUTO
            })
            .catch(() => {})
        if (!searchResult || !searchResult.tracks.length) return void interaction.followUp({ content: "No results were found!" })

        const queue = await player.createQueue(interaction.guild, {
            metadata: interaction.channel
        })

        try {
            if (!queue.connection) await queue.connect(interaction.member.voice.channel);
        } catch {
            void player.deleteQueue(interaction.guildId)
            return void interaction.followUp({ content: "Could not join your voice channel!" })
        }

        await interaction.followUp({ content: `⏱ | Loading your ${searchResult.playlist ? "playlist" : "track"}...` })
        searchResult.playlist ? queue.addTracks(searchResult.tracks) : queue.addTrack(searchResult.tracks[0])
        if (!queue.playing) await queue.play()
    } else if (interaction.commandName === "skip") {
        await interaction.deferReply()
        const queue = player.getQueue(interaction.guildId);
        if (!queue || !queue.playing) return void interaction.followUp({ content: "❌ | No music is being played!" })
        const currentTrack = queue.current
        const success = queue.skip()
        return void interaction.followUp({
            content: success ? `✅ | Skipped **${currentTrack}**!` : "❌ | Something went wrong!"
        });
    } else if (interaction.commandName === "stop") {
        await interaction.deferReply()
        const queue = player.getQueue(interaction.guildId)
        if (!queue || !queue.playing) return void interaction.followUp({ content: "❌ | No music is being played!" })
        queue.destroy()
        return void interaction.followUp({ content: "🛑 | Stopped the player!" })
    } else {
        interaction.reply({
            content: "Unknown command!",
            ephemeral: true
        });
    }
})



