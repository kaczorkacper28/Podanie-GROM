require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits } = require('discord.js');

const { TOKEN, CLIENT_ID, GUILD_ID, REVIEW_CHANNEL_ID, ACCEPTED_ROLE_ID = '', REJECTED_ROLE_ID = '' } = process.env;
if (!TOKEN || !CLIENT_ID || !GUILD_ID || !REVIEW_CHANNEL_ID) {
  console.error('Brak TOKEN, CLIENT_ID, GUILD_ID lub REVIEW_CHANNEL_ID w .env');
  process.exit(1);
}

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'applications.json');
fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '{}');
const read = () => { try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch { return {}; } };
const write = data => fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

// 44 pytań. Pytania 1-5 są formalne i mają 0 pkt. Suma pozostałych = 100 pkt.
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
const sessions = new Map();
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

function modalFor(userId, page) {
  const start = page * PER_MODAL;
  const modal = new ModalBuilder().setCustomId(`grom_${userId}_${page}`).setTitle(`GROM • Część ${page + 1}/9`);
  for (let i = start; i < Math.min(start + PER_MODAL, QUESTIONS.length); i++) {
    const input = new TextInputBuilder()
      .setCustomId(`q${i + 1}`)
      .setLabel(`${i + 1}. ${QUESTIONS[i]}`.slice(0, 45))
      .setStyle(i < 5 ? TextInputStyle.Short : TextInputStyle.Paragraph)
      .setRequired(true).setMaxLength(1000);
    modal.addComponents(new ActionRowBuilder().addComponents(input));
  }
  return modal;
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
const points = answers => answers.reduce((sum, a, i) => sum + scoreAnswer(a, MAX[i]), 0);
function status(score) {
  if (score >= 95) return ['🟣 Wynik wybitny','REKOMENDOWANY',0x9b59b6];
  if (score >= 85) return ['🟢 Zakwalifikowany do dalszego etapu','DALSZY ETAP',0x2ecc71];
  if (score >= 75) return ['🟡 Zakwalifikowany do rozmowy','ROZMOWA',0xf1c40f];
  if (score >= 65) return ['🟠 Wymagana rozmowa dodatkowa','DODATKOWA WERYFIKACJA',0xe67e22];
  return ['❌ Odrzucone','ODRZUCONE',0xe74c3c];
}
function summaryEmbed(app) {
  const [name, state, color] = status(app.score);
  return new EmbedBuilder().setColor(color).setTitle('🇵🇱 GROM • PODANIE REKRUTACYJNE')
    .setDescription(`**Kandydat:** <@${app.userId}>\n**Nick:** ${app.nick}\n**Wynik:** **${app.score}/100 pkt**\n**Status:** ${state}`)
    .addFields({ name:'Ocena', value:name, inline:true }, { name:'Data', value:`<t:${Math.floor(app.createdAt/1000)}:F>`, inline:true })
    .setFooter({ text:'GROM • System rekrutacyjny' });
}
function detailEmbeds(app) {
  const embeds = [];
  for (let start = 0; start < QUESTIONS.length; start += 5) {
    const embed = new EmbedBuilder().setColor(0x111827).setTitle(`📋 GROM • Odpowiedzi ${start + 1}-${Math.min(start + 5, QUESTIONS.length)}`);
    for (let i = start; i < Math.min(start + 5, QUESTIONS.length); i++) {
      const answer = String(app.answers[i] || '').slice(0, 850);
      embed.addFields({ name:`${i + 1}. ${QUESTIONS[i]} • ${scoreAnswer(app.answers[i], MAX[i])}/${MAX[i]} pkt`, value:answer || 'Brak odpowiedzi' });
    }
    embeds.push(embed);
  }
  return embeds;
}
function reviewRow(userId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`accept_${userId}`).setLabel('Przyjmij').setEmoji('✅').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`reject_${userId}`).setLabel('Odrzuć').setEmoji('❌').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`details_${userId}`).setLabel('Pełne odpowiedzi').setEmoji('📋').setStyle(ButtonStyle.Secondary)
  );
}

const commands = [
  new SlashCommandBuilder().setName('podanie-grom').setDescription('Publikuje panel rekrutacyjny GROM.').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder().setName('grom-status').setDescription('Pokazuje status Twojego podania do GROM.')
].map(c => c.toJSON());

client.once('ready', async () => {
  const rest = new REST({ version:'10' }).setToken(TOKEN);
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body:commands });
  console.log(`GROM BOT online: ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'podanie-grom') {
        const embed = new EmbedBuilder().setColor(0x111827).setTitle('🇵🇱 GROM • REKRUTACJA ELITARNA')
          .setDescription('Podanie zawiera **44 pytania** i maksymalnie **100 punktów**.\n\n🔴 0–64 — odrzucone\n🟠 65–74 — dodatkowa weryfikacja\n🟡 75–84 — rozmowa\n🟢 85–94 — dalszy etap\n🟣 95–100 — wynik wybitny\n\nKliknij przycisk, aby rozpocząć.');
        return interaction.reply({ embeds:[embed], components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('start_grom').setLabel('Rozpocznij podanie').setEmoji('🇵🇱').setStyle(ButtonStyle.Primary))] });
      }
      if (interaction.commandName === 'grom-status') {
        const app = read()[interaction.user.id];
        return interaction.reply(app ? { embeds:[summaryEmbed(app)], ephemeral:true } : { content:'Nie masz jeszcze podania.', ephemeral:true });
      }
    }

    if (interaction.isButton()) {
      if (interaction.customId === 'start_grom') {
        const data = read();
        if (data[interaction.user.id]?.completed) return interaction.reply({ content:'Masz już złożone podanie. Użyj `/grom-status`.', ephemeral:true });
        sessions.set(interaction.user.id, []);
        return interaction.showModal(modalFor(interaction.user.id, 0));
      }

      if (/^(accept|reject|details)_\d+$/.test(interaction.customId)) {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) return interaction.reply({ content:'Nie masz uprawnień do rozpatrywania podań.', ephemeral:true });
        const [action, userId] = interaction.customId.split('_');
        const data = read(); const app = data[userId];
        if (!app) return interaction.reply({ content:'Nie znaleziono podania.', ephemeral:true });
        if (action === 'details') return interaction.reply({ embeds:detailEmbeds(app), ephemeral:true });
        app.finalStatus = action === 'accept' ? 'PRZYJĘTY' : 'ODRZUCONY';
        app.reviewedBy = interaction.user.id; app.reviewedAt = Date.now(); write(data);
        const member = await interaction.guild.members.fetch(userId).catch(() => null);
        if (member && action === 'accept' && ACCEPTED_ROLE_ID) await member.roles.add(ACCEPTED_ROLE_ID).catch(() => {});
        if (member && action === 'reject' && REJECTED_ROLE_ID) await member.roles.add(REJECTED_ROLE_ID).catch(() => {});
        const embed = summaryEmbed(app).addFields({ name:'Decyzja komisji', value:`${action === 'accept' ? '✅ PRZYJĘTY' : '❌ ODRZUCONY'}\nRekruter: <@${interaction.user.id}>` });
        return interaction.update({ embeds:[embed], components:[] });
      }
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith('grom_')) {
      const [, userId, pageText] = interaction.customId.split('_');
      const page = Number(pageText);
      if (interaction.user.id !== userId) return interaction.reply({ content:'To podanie nie należy do Ciebie.', ephemeral:true });
      const answers = sessions.get(userId) || [];
      for (let i = page * PER_MODAL; i < Math.min((page + 1) * PER_MODAL, QUESTIONS.length); i++) answers[i] = interaction.fields.getTextInputValue(`q${i + 1}`);
      sessions.set(userId, answers);
      const next = page + 1;
      if (next < Math.ceil(QUESTIONS.length / PER_MODAL)) return interaction.showModal(modalFor(userId, next));

      const app = { userId, nick:interaction.user.username, answers, score:points(answers), completed:true, createdAt:Date.now(), finalStatus:'OCZEKUJE NA KOMISJĘ' };
      const data = read(); data[userId] = app; write(data); sessions.delete(userId);
      const channel = await client.channels.fetch(REVIEW_CHANNEL_ID).catch(() => null);
      if (channel?.isTextBased()) await channel.send({ embeds:[summaryEmbed(app)], components:[reviewRow(userId)] });
      return interaction.reply({ content:`✅ Podanie wysłane do komisji. Wynik automatyczny: **${app.score}/100 pkt** — **${status(app.score)[1]}**.`, ephemeral:true });
    }
  } catch (error) {
    console.error(error);
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) await interaction.reply({ content:'Wystąpił błąd. Spróbuj ponownie.', ephemeral:true }).catch(() => {});
  }
});

client.login(TOKEN);
