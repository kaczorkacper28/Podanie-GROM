require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const {
  Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder,
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  PermissionFlagsBits, MessageFlags, Events
} = require('discord.js');

const { TOKEN, CLIENT_ID, GUILD_ID, REVIEW_CHANNEL_ID, ACCEPTED_ROLE_ID = '', REJECTED_ROLE_ID = '' } = process.env;
const ADMIN_USER_ID = process.env.ADMIN_USER_ID || '734656240201760869';

if (!TOKEN || !CLIENT_ID || !GUILD_ID || !REVIEW_CHANNEL_ID) {
  console.error('Brak TOKEN, CLIENT_ID, GUILD_ID lub REVIEW_CHANNEL_ID w .env');
  process.exit(1);
}

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'applications.json');
fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '{}');

function readData() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch { return {}; }
}
function writeData(data) { fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2)); }

const MAX = [0,0,0,0,0,2,3,5,3,3,2,2,3,3,2,4,3,3,3,4,2,3,3,2,3,3,4,3,3,2,3,2,3,2,1,1,1,1,1,3,2,2,2,3];

const QUESTIONS = [
  'Nick Discord','Nick w grze','Wiek','Staż na serwerze','Data rozpoczęcia RP',
  'Wymień formacje, w których pełniłeś służbę.',
  'Czy posiadasz doświadczenie w RP? Jeśli tak, opisz je.',
  'Dlaczego chcesz dołączyć właśnie do GROM?',
  'Co odróżnia operatora jednostki specjalnej od zwykłego funkcjonariusza?',
  'Dlaczego powinniśmy wybrać Ciebie, a nie innego kandydata?',
  'Jakie są Twoje trzy największe słabości?',
  'Co zrobisz, jeżeli podczas służby okaże się, że nie jesteś najlepszą osobą w zespole?',
  'Przełożony podejmuje decyzję, z którą się nie zgadzasz. Co robisz?',
  'Członek zespołu popełnia poważny błąd. Jak postępujesz?',
  'Otrzymujesz bardzo trudny psychicznie rozkaz. Jak reagujesz?',
  'Sytuacja podczas zadania wymyka się spod kontroli. Opisz swoje zachowanie.',
  'Co jest ważniejsze: wykonanie zadania czy bezpieczeństwo zespołu? Uzasadnij.',
  'Jak zachowasz się po nieudanej akcji, za którą częściowo odpowiadasz?',
  'Masz 10 sekund na decyzję, a żadna opcja nie jest idealna. Jak decydujesz?',
  'Twoja decyzja może uratować jedną osobę, ale zmniejsza szanse powodzenia całej operacji. Co bierzesz pod uwagę?',
  'Przełożony publicznie krytykuje Cię za decyzję. Jak reagujesz?',
  'Kolega prosi o zatajenie jego błędu przed dowódcą. Co robisz?',
  'Co robisz, gdy emocje zaczynają wpływać na Twoje decyzje?',
  'Co dla Ciebie oznacza lojalność wobec zespołu?',
  'Czy lojalność wobec kolegi może być ważniejsza od regulaminu? Uzasadnij.',
  'Członek zespołu złamał regulamin, ale jego działanie pomogło uratować sytuację. Co robisz?',
  'Czy potrafisz przyjąć rozkaz bez dyskusji? Kiedy można zakwestionować decyzję?',
  'Co jest gorsze dla jednostki: brak umiejętności czy brak dyscypliny?',
  'Zespół jest pod presją czasu i powstaje konflikt dotyczący decyzji dowódcy. Jak go rozwiązujesz?',
  'Co robisz, jeżeli dowódca podtrzymuje swoją decyzję?',
  'Kolega popełnia błąd. Możesz mu pomóc albo kontynuować własne zadanie. Jak decydujesz?',
  'Jakie czynniki bierzesz pod uwagę przy podejmowaniu decyzji?',
  'Po operacji dowódca niesłusznie obwinia Cię za niepowodzenie. Co robisz?',
  'Czy bronisz swojego stanowiska przed przełożonym? Uzasadnij.',
  'Jaka cecha może sprawić, że nie nadajesz się do GROM?',
  'Jaka sytuacja mogłaby spowodować, że straciłbyś koncentrację?',
  'Jak reagujesz na porażkę?',
  'Jak reagujesz na niesprawiedliwą ocenę?',
  'Czy potrafisz przyznać się do błędu przed całym zespołem?',
  'Masz możliwość natychmiastowego awansu, ale wymaga to złamania zasady. Co robisz?',
  'Gdybyś mógł bez konsekwencji opuścić GROM, dlaczego miałbyś zostać?',
  'Co zrobisz, jeżeli szkolenie okaże się znacznie trudniejsze, niż zakładałeś?',
  'Co oznacza dla Ciebie odpowiedzialność za cały zespół?',
  'W jednym zdaniu: dlaczego mamy Ci zaufać?'
];

const PER_MODAL = 5;
const TOTAL_PAGES = Math.ceil(QUESTIONS.length / PER_MODAL);
const sessions = new Map();
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const rest = new REST({ version: '10' }).setToken(TOKEN);

// Modal można otworzyć tylko jako odpowiedź na NOWĄ interakcję.
// Dlatego po wysłaniu jednej części pokazujemy przycisk „Następna część”.
// Dopiero kliknięcie tego przycisku otwiera kolejny modal.
function modalPayload(userId, page) {
  const start = page * PER_MODAL;
  const components = [];

  for (let i = start; i < Math.min(start + PER_MODAL, QUESTIONS.length); i++) {
    components.push({
      type: 1,
      components: [{
        type: 4,
        custom_id: `q${i + 1}`,
        style: i < 5 ? 1 : 2,
        label: `Pytanie ${i + 1}`,
        placeholder: QUESTIONS[i].slice(0, 100),
        required: true,
        min_length: 1,
        max_length: 4000
      }]
    });
  }

  return {
    custom_id: `grom_${userId}_${page}`,
    title: `GROM • Część ${page + 1}/${TOTAL_PAGES}`,
    components
  };
}

async function openModal(interaction, page) {
  await rest.post(
    Routes.interactionCallback(interaction.id, interaction.token),
    { body: { type: 9, data: modalPayload(interaction.user.id, page) } }
  );
}

function nextPartRow(userId, page) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`next_grom_${userId}_${page}`)
      .setLabel(`Przejdź do części ${page + 1}`)
      .setEmoji('➡️')
      .setStyle(ButtonStyle.Primary)
  );
}

function scoreAnswer(answer, max) {
  if (!max) return 0;
  const text = String(answer || '').trim().toLowerCase();
  if (!text) return 0;
  const words = text.split(/\s+/).filter(Boolean).length;
  let points = 0;
  if (words >= 8) points++;
  if (words >= 20) points++;
  if (words >= 40) points++;
  if (words >= 70) points++;
  const keywords = ['odpowiedzial','dyscyplin','zespół','współprac','komunik','opan','spokój','analiz','regulamin','rozkaz','przełoż','dowód','bezpieczeń','decyz','błąd','uczciw','procedur','lojal','presj','emocj','kontrol','pomoc','raport','konsekwenc','nauka'];
  const hits = keywords.filter(k => text.includes(k)).length;
  if (hits >= 2) points++;
  if (hits >= 4) points++;
  if (max >= 4 && words >= 45 && hits >= 3) points = Math.max(points, max - 1);
  if (max >= 5 && words >= 70 && hits >= 4) points = max;
  return Math.min(points, max);
}

function totalScore(answers) {
  return answers.reduce((sum, answer, i) => sum + scoreAnswer(answer, MAX[i]), 0);
}

function getStatus(score) {
  if (score >= 95) return ['🟣 Wynik wybitny','REKOMENDOWANY',0x9b59b6];
  if (score >= 85) return ['🟢 Zakwalifikowany do dalszego etapu','DALSZY ETAP',0x2ecc71];
  if (score >= 75) return ['🟡 Zakwalifikowany do rozmowy','ROZMOWA',0xf1c40f];
  if (score >= 65) return ['🟠 Wymagana rozmowa dodatkowa','DODATKOWA WERYFIKACJA',0xe67e22];
  return ['❌ Odrzucone','ODRZUCONE',0xe74c3c];
}

function getFinalStatus(app) {
  if (app?.finalStatus === 'PRZYJĘTY') {
    return ['✅ Przyjęty', 'PRZYJĘTY', 0x2ecc71];
  }

  if (app?.finalStatus === 'ODRZUCONY') {
    return ['❌ Odrzucone', 'ODRZUCONY', 0xe74c3c];
  }

  return getStatus(Number(app?.score) || 0);
}

function summaryEmbed(app) {
  const [name, state, color] = getFinalStatus(app);

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle('🇵🇱 GROM • PODANIE REKRUTACYJNE')
    .setDescription(`**Kandydat:** <@${app.userId}>\n**Nick:** ${app.nick || 'Nieznany'}\n**Wynik:** **${Number(app.score) || 0}/100 pkt**\n**Status:** ${state}`)
    .addFields(
      { name:'Ocena', value:name, inline:true },
      { name:'Data', value:`<t:${Math.floor((app.createdAt || Date.now())/1000)}:F>`, inline:true }
    );

  if (app.finalStatus && app.reviewedBy) {
    embed.addFields({
      name: 'Decyzja komisji',
      value: `${app.finalStatus === 'PRZYJĘTY' ? '✅ PRZYJĘTY' : '❌ ODRZUCONY'}\nRekruter: <@${app.reviewedBy}>`
    });
  }

  return embed.setFooter({text:'GROM • System rekrutacyjny'});
}

// Jeżeli bot został zrestartowany, lokalny applications.json może być pusty.
// W takim przypadku odczytujemy podstawowe dane bezpośrednio z wiadomości
// rekrutacyjnej w kanale REVIEW_CHANNEL_ID. Dzięki temu przyciski nadal działają.
async function findApplicationInReviewChannel(userId) {
  const channel = await client.channels.fetch(REVIEW_CHANNEL_ID).catch(() => null);
  if (!channel || !channel.isTextBased() || !channel.messages) return null;

  const messages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
  if (!messages) return null;

  for (const message of messages.values()) {
    const embed = message.embeds?.[0];
    const description = embed?.description || '';

    if (!description.includes(`<@${userId}>`)) continue;

    const scoreMatch = description.match(/\*\*(\d+)\/100 pkt\*\*/);
    const nickMatch = description.match(/\*\*Nick:\*\* ([^\n]+)/);
    const dateMatch = description.match(/<t:(\d+):F>/);

    let finalStatus = null;
    const decisionField = embed.fields?.find(field => field.name === 'Decyzja komisji');

    if (decisionField) {
      if (decisionField.value.includes('PRZYJĘTY')) finalStatus = 'PRZYJĘTY';
      if (decisionField.value.includes('ODRZUCONY')) finalStatus = 'ODRZUCONY';
    }

    return {
      userId,
      nick: nickMatch?.[1] || 'Nieznany',
      score: Number(scoreMatch?.[1] || 0),
      createdAt: dateMatch ? Number(dateMatch[1]) * 1000 : message.createdTimestamp,
      finalStatus,
      reviewMessageId: message.id
    };
  }

  return null;
}

function detailEmbeds(app) {
  const embeds=[];
  for(let start=0;start<QUESTIONS.length;start+=5){
    const embed=new EmbedBuilder()
      .setColor(0x111827)
      .setTitle(`📋 GROM • Odpowiedzi ${start+1}-${Math.min(start+5,QUESTIONS.length)}`);
    for(let i=start;i<Math.min(start+5,QUESTIONS.length);i++) {
      embed.addFields({
        name:`${i+1}. ${QUESTIONS[i]} • ${scoreAnswer(app.answers[i],MAX[i])}/${MAX[i]} pkt`,
        value:String(app.answers[i]||'Brak odpowiedzi').slice(0,1024)
      });
    }
    embeds.push(embed);
  }
  return embeds;
}

function reviewRow(userId){
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`accept_${userId}`).setLabel('Przyjmij').setEmoji('✅').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`reject_${userId}`).setLabel('Odrzuć').setEmoji('❌').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`details_${userId}`).setLabel('Pełne odpowiedzi').setEmoji('📋').setStyle(ButtonStyle.Secondary)
  );
}

const commands=[
  new SlashCommandBuilder().setName('podanie-grom').setDescription('Publikuje panel rekrutacyjny GROM.').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder().setName('grom-status').setDescription('Pokazuje status Twojego podania do GROM.'),
  new SlashCommandBuilder().setName('grom-id').setDescription('Pokazuje Twój prawdziwy Discord User ID.')
].map(c=>c.toJSON());

client.once(Events.ClientReady, async()=>{
  try{
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID,GUILD_ID),{body:commands});
    console.log(`GROM BOT online: ${client.user.tag}`);
    console.log(`Właściciel systemu: ${ADMIN_USER_ID}`);
    console.log('GROM: wieloetapowy formularz z checkpointem aktywny.');
  }catch(error){ console.error('Błąd rejestracji komend:',error); }
});

client.on(Events.InteractionCreate, async interaction=>{
  try{
    if(interaction.isChatInputCommand()){
      if(interaction.commandName==='grom-id') {
        return interaction.reply({content:`🆔 **Twój Discord User ID:**\n\`${interaction.user.id}\``,flags:MessageFlags.Ephemeral});
      }

      if(interaction.commandName==='podanie-grom'){
        const embed=new EmbedBuilder()
          .setColor(0x111827)
          .setTitle('🇵🇱 GROM • REKRUTACJA ELITARNA')
          .setDescription('Podanie zawiera **44 pytania** i maksymalnie **100 punktów**.\n\n🔴 **0–64** — odrzucone\n🟠 **65–74** — dodatkowa weryfikacja\n🟡 **75–84** — rozmowa\n🟢 **85–94** — dalszy etap\n🟣 **95–100** — wynik wybitny\n\nKliknij przycisk, aby rozpocząć.');
        return interaction.reply({
          embeds:[embed],
          components:[new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('start_grom').setLabel('Rozpocznij podanie').setEmoji('🇵🇱').setStyle(ButtonStyle.Primary)
          )]
        });
      }

      if(interaction.commandName==='grom-status'){
        const data = readData();
        let app = data[interaction.user.id];

        if (!app) {
          app = await findApplicationInReviewChannel(interaction.user.id);

          if (app) {
            data[interaction.user.id] = app;
            writeData(data);
          }
        }

        return interaction.reply({
          content:app?undefined:'Nie masz jeszcze podania.',
          embeds:app?[summaryEmbed(app)]:[],
          flags:MessageFlags.Ephemeral
        });
      }
    }

    if(interaction.isButton()){
      if(interaction.customId==='start_grom'){
        const data=readData();
        if(data[interaction.user.id]?.completed) {
          return interaction.reply({content:'Masz już złożone podanie. Użyj `/grom-status`.',flags:MessageFlags.Ephemeral});
        }
        sessions.set(interaction.user.id,[]);
        await openModal(interaction,0);
        return;
      }

      const nextMatch = interaction.customId.match(/^next_grom_(\d+)_(\d+)$/);
      if(nextMatch){
        const userId=nextMatch[1];
        const page=Number(nextMatch[2]);
        if(interaction.user.id!==userId) {
          return interaction.reply({content:'🔒 To podanie należy do innej osoby.',flags:MessageFlags.Ephemeral});
        }
        const answers=sessions.get(userId);
        if(!answers) {
          return interaction.reply({content:'Sesja podania wygasła. Kliknij „Rozpocznij podanie” ponownie.',flags:MessageFlags.Ephemeral});
        }
        if(page<0 || page>=TOTAL_PAGES) {
          return interaction.reply({content:'Nieprawidłowa część podania.',flags:MessageFlags.Ephemeral});
        }
        await openModal(interaction,page);
        return;
      }

      if(/^(accept|reject|details)_\d+$/.test(interaction.customId)){
        if(interaction.user.id!==ADMIN_USER_ID) {
          return interaction.reply({
            content:'🔒 Tylko właściciel systemu może rozpatrywać podania.',
            flags:MessageFlags.Ephemeral
          });
        }

        const [action,userId] = interaction.customId.split('_');
        const data = readData();

        // Najpierw szukamy w applications.json.
        // Jeżeli plik został utracony po restarcie/wdrożeniu, szukamy
        // podstawowych danych w wiadomości rekrutacyjnej Discorda.
        let app = data[userId];

        if (!app) {
          app = await findApplicationInReviewChannel(userId);

          if (app) {
            // Przywracamy rekord do lokalnego pliku, aby kolejne kliknięcia
            // i /grom-status mogły korzystać z tego samego rekordu.
            data[userId] = app;
            writeData(data);
          }
        }

        if(!app) {
          return interaction.reply({
            content:'❌ Nie znaleziono podania w bazie ani w kanale rekrutacyjnym.',
            flags:MessageFlags.Ephemeral
          });
        }

        if(action==='details') {
          if (!Array.isArray(app.answers) || app.answers.length === 0) {
            return interaction.reply({
              content:'⚠️ Dane odpowiedzi nie są już dostępne w applications.json. Podstawowe dane podania zostały odzyskane z wiadomości rekrutacyjnej.',
              flags:MessageFlags.Ephemeral
            });
          }

          return interaction.reply({
            embeds:detailEmbeds(app),
            flags:MessageFlags.Ephemeral
          });
        }

        // Nie pozwalamy ponownie zmienić rozpatrzonego podania.
        if (app.finalStatus) {
          return interaction.reply({
            content:`⚠️ To podanie zostało już rozpatrzone jako **${app.finalStatus}**.`,
            flags:MessageFlags.Ephemeral
          });
        }

        app.finalStatus = action === 'accept' ? 'PRZYJĘTY' : 'ODRZUCONY';
        app.reviewedBy = interaction.user.id;
        app.reviewedAt = Date.now();

        data[userId] = app;
        writeData(data);

        const member = await interaction.guild.members.fetch(userId).catch(() => null);

        if(member && action === 'accept' && ACCEPTED_ROLE_ID) {
          await member.roles.add(ACCEPTED_ROLE_ID).catch(error => {
            console.error('Nie udało się nadać roli przyjętego:', error);
          });
        }

        if(member && action === 'reject' && REJECTED_ROLE_ID) {
          await member.roles.add(REJECTED_ROLE_ID).catch(error => {
            console.error('Nie udało się nadać roli odrzuconego:', error);
          });
        }

        // summaryEmbed() sam pokazuje PRZYJĘTY/ODRZUCONY,
        // zamiast ponownie wyliczać status z punktów.
        const embed = summaryEmbed(app);

        return interaction.update({
          embeds:[embed],
          components:[]
        });
      }
    }

    if(interaction.isModalSubmit()&&interaction.customId.startsWith('grom_')){
      const [,userId,pageText]=interaction.customId.split('_');
      const page=Number(pageText);
      if(interaction.user.id!==userId) return interaction.reply({content:'To podanie nie należy do Ciebie.',flags:MessageFlags.Ephemeral});

      const answers=sessions.get(userId)||[];
      const start=page*PER_MODAL;
      for(let i=start;i<Math.min(start+PER_MODAL,QUESTIONS.length);i++) {
        answers[i]=interaction.fields.getTextInputValue(`q${i+1}`);
      }
      sessions.set(userId,answers);

      const next=page+1;
      if(next<TOTAL_PAGES){
        // WAŻNE: nie otwieramy kolejnego modala bezpośrednio z modal submit.
        // Discord odrzuca type=9 w odpowiedzi na MODAL_SUBMIT.
        return interaction.reply({
          content:`✅ **Część ${page+1}/${TOTAL_PAGES} zapisana.**\nKliknij poniżej, aby przejść dalej.`,
          components:[nextPartRow(userId,next)],
          flags:MessageFlags.Ephemeral
        });
      }

      const app={userId,nick:interaction.user.username,answers,score:totalScore(answers),completed:true,createdAt:Date.now()};
      const data=readData();
      data[userId]=app;
      writeData(data);
      sessions.delete(userId);

      const reviewChannel=await client.channels.fetch(REVIEW_CHANNEL_ID).catch(()=>null);
      if(reviewChannel&&reviewChannel.isTextBased()) {
        await reviewChannel.send({embeds:[summaryEmbed(app)],components:[reviewRow(userId)]});
      }

      return interaction.reply({
        content:`✅ Podanie zostało wysłane. Twój wynik: **${app.score}/100 pkt**. Użyj /grom-status, aby sprawdzić status.`,
        flags:MessageFlags.Ephemeral
      });
    }
  }catch(error){
    console.error('GROM interaction error:',error);
    if(!interaction.replied&&!interaction.deferred) {
      await interaction.reply({content:'❌ Wystąpił błąd. Spróbuj ponownie.',flags:MessageFlags.Ephemeral}).catch(()=>{});
    }
  }
});

client.login(TOKEN).catch(error=>{
  console.error('Błąd logowania bota:',error);
  process.exit(1);
});
