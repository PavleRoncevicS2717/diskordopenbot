const { Client, Events, GatewayIntentBits} = require("discord.js")
require("dotenv/config")
const { OpenAIApi, Configuration} = require("openai")

const config = new Configuration({
    apiKey: process.env.OPENAI_API_KEY
})

const openai = new OpenAIApi(config)

const client = new Client ({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent

    ]
})

client.once(Events.ClientReady, (clientUser) =>{
    console.log(`Logged in as ${clientUser.user.tag}`)
})
client.login(process.env.DISCORD_BOT_TOKEN)

const Bot_channel = "1094333847031783564"

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

    let prompt = `Ovo sada je konverzacija izmedju ${users.join(", ")}, i ${lastUser}, Budi lud kolko mozes. \n\n`

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