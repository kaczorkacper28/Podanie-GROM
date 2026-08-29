require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits
} = require('discord.js');

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const REVIEW_CHANNEL_ID = process.env.REVIEW_CHANNEL_ID;
const ACCEPTED_ROLE_ID = process.env.ACCEPTED_ROLE_ID || '';
const REJECTED_ROLE_ID = process.env.REJECTED_ROLE_ID || '';
const MIN_AUTO_SCORE = Number(process.env.MIN_AUTO_SCORE || 65);

if (!TOKEN || !CLIENT_ID || !GUILD_ID || !REVIEW_CHANNEL_ID) {
  console.error('Brak TOKEN, CLIENT_ID, GUILD_ID lub REVIEW_CHANNEL_ID w .env');
  process.exit(1);
}

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'applications.json');
fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '{}', 'utf8');

function loadData() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch { return {}; }
}
function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

const MAX_POINTS = [0,0,0,0,0,2,3,5,3,3,2,2,3,3,2,4,3,3,3,4,2,3,3,2,3,3,4,3,3,2,3,2,3,2,1,1,1,1,1,3,2,2,2,1];
const QUESTION_TEXT = [
  'Nick Discord',
  'Nick w grze',
  'Wiek',
  'Staż na serwerze',
  'Data rozpoczęcia RP',
  'Dotychczasowe formacje, w których pełniłeś służbę',
  'Czy posiadasz doświadczenie w RP? Jeśli tak, opisz je',
  'Dlaczego chcesz dołączyć właśnie do GROM?',
  'Co według Ciebie odróżnia operatora jednostki specjalnej od zwykłego funkcjonariusza?',
  'Dlaczego powinniśmy wybrać Ciebie, a nie innego kandydata?',
  'Jakie są Twoje trzy największe słabości?',
  'Co zrobisz, jeżeli podczas służby okaże się, że nie jesteś najlepszą osobą w zespole?',
  'Twój przełożony podejmuje decyzję, z którą się nie zgadzasz. Co robisz?',
  'Jeden z członków zespołu popełnia poważny błąd. Jak postępujesz?',
  'Otrzymujesz rozkaz, którego wykonanie będzie dla Ciebie bardzo trudne psychicznie. Jak reagujesz?',
  'Podczas wykonywania zadania sytuacja zaczyna wymykać się spod kontroli. Opisz swoje zachowanie.',
  'Co jest ważniejsze: wykonanie zadania czy bezpieczeństwo zespołu? Uzasadnij.',
  'Jak zachowasz się po nieudanej akcji, za którą częściowo odpowiadasz?',
  'Masz 10 sekund na podjęcie decyzji, a żadna opcja nie jest idealna. Jak decydujesz?',
  'Twoja decyzja może uratować jedną osobę, ale zmniejsza szanse powodzenia całej operacji. Co bierzesz pod uwagę?',
  'Przełożony publicznie krytykuje Cię za decyzję. Jak reagujesz?',
  'Kolega prosi Cię o zatajenie jego błędu przed dowódcą. Co robisz?',
  'Co robisz, gdy emocje zaczynają wpływać na Twoje decyzje?',
  'Co dla Ciebie oznacza lojalność wobec zespołu?',
  'Czy lojalność wobec kolegi może być ważniejsza od regulaminu? Uzasadnij.',
  'Członek zespołu złamał regulamin, ale jego działanie pomogło uratować sytuację. Co robisz?',
  'Czy potrafisz przyjąć rozkaz bez dyskusji? Kiedy można zakwestionować decyzję?',
  'Co jest gorsze dla jednostki: brak umiejętności czy brak dyscypliny?',
  'Zespół jest pod presją czasu. Powstaje konflikt dotyczący decyzji dowódcy. Jak go rozwiązujesz?',
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
  'Gdybyś otrzymał możliwość opuszczenia GROM bez konsekwencji, dlaczego miałbyś zostać?',
  'Co zrobisz, jeżeli szkolenie okaże się znacznie trudniejsze, niż zakładałeś?',
  'Co oznacza dla Ciebie odpowiedzialność za cały zespół?',
  'W jednym zdaniu: dlaczego mamy Ci zaufać?'
];

const QUESTIONS_PER_MODAL = 5;
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const sessions = new Map();

function questionModal(userId, page) {
  const start = page * QUESTIONS_PER_MODAL;
  const end = Math.min(start + QUESTIONS_PER_MODAL, QUESTION_TEXT.length);
  const modal = new ModalBuilder().setCustomId(`grom_answer_${userId}_${page}`).setTitle(`GROM • Część ${page + 1}/9`);

  for (let i = start; i < end; i++) {
    const input = new TextInputBuilder()
      .setCustomId(`q${i + 1}`)
      .setLabel(`${i + 1}. ${QUESTION_TEXT[i]}`.slice(0, 45))
      .setStyle(i < 5 ? TextInputStyle.Short : TextInputStyle.Paragraph)
      .setRequired(true)
      .setMinLength(i < 5 ? 1 : 5)
      .setMaxLength(1000);
    modal.addComponents(new ActionRowBuilder().addComponents(input));
  }
  return modal;
}

function autoScore(answer, max, questionNumber) {
  if (!max) return 0;
  const text = String(answer || '').trim();
  if (!text) return 0;
  const words = text.split(/\s+/).filter(Boolean).length;
  let score = 0;
  if (words >= 8) score++;
  if (words >= 18) score++;
  if (words >= 35) score++;
  if (words >= 60) score++;

  const good = [
    'odpowiedzial', 'dyscyplin', 'zespół', 'zespołu', 'współprac', 'komunik',
    'spokój', 'opan', 'rozsądek', 'analiz', 'konsekwenc', 'regulamin',
    'rozkaz', 'przełożon', 'dowód', 'bezpieczeń', 'priorytet', 'decyzj',
    'błąd', 'przyzn', 'uczyć', 'nauka', 'lojal', 'uczciw', 'procedur',
    'samokryty', 'presj', 'emocj', 'kontrol', 'pomóc', 'raport'
  ];
  const hits = good.filter(k => text.toLowerCase().includes(k)).length;
  if (hits >= 2) score++;
  if (hits >= 4) score++;

  // Pytania formalne nie są punktowane.
  score = Math.min(score, max);

  // Dłuższe odpowiedzi są oceniane surowiej tylko wtedy, gdy pytanie jest warte więcej.
  if (max >= 4 && words >= 45 && hits >= 3) score = Math.max(score, max - 1);
  if (max >= 5 && words >= 70 && hits >= 4) score = max;
  return Math.min(score, max);
}

function totalScore(answers) {
  return answers.reduce((sum, answer, index) => sum + autoScore(answer, MAX_POINTS[index], index + 1), 0);
}

function resultFor(score) {
  if (score >= 95) return { name: '🟣 Wynik wybitny', color: 0x9b59b6, status: 'REKOMENDOWANY' };
  if (score >= 85) return { name: '🟢 Zakwalifikowany do dalszego etapu', color: 0x2ecc71, status: 'DALSZY ETAP' };
  if (score >= 75) return { name: '🟡 Zakwalifikowany do rozmowy', color: 0xf1c40f, status: 'ROZMOWA' };
  if (score >= 65) return { name: '🟠 Wymagana rozmowa dodatkowa', color: 0xe67e22, status: 'DODATKOWA WERYFIKACJA' };
  return { name: '❌ Odrzucone', color: 0xe74c3c, status: 'ODRZUCONE' };
}

function applicationEmbed(app, detailed = false) {
  const result = resultFor(app.score);
  const embed = new EmbedBuilder()
    .setColor(result.color)
    .setTitle('🇵🇱 GROM • PODANIE REKRUTACYJNE')
    .setDescription(`**Kandydat:** <@${app.userId}>\n**Nick:** ${app.discordNick}\n**Wynik:** **${app.score}/100 pkt**\n**Status:** ${result.status}`)
    .addFields(
      { name: 'Ocena', value: result.name, inline: true },
      { name: 'Data', value: `<t:${Math.floor(app.createdAt / 1000)}:F>`, inline: true }
    )
    .setFooter({ text: 'GROM • System rekrutacyjny' });

  if (detailed) {
    const lines = app.answers.map((a, i) => `**${i + 1}. ${QUESTION_TEXT[i]}**\n${a}\n**Punkty: ${autoScore(a, MAX_POINTS[i], i + 1)}/${MAX_POINTS[i]}**`);
    for (let i = 0; i < lines.length; i += 3) {
      embed.addFields({ name: `Odpowiedzi ${i + 1}-${Math.min(i + 3, lines.length)}`, value: lines.slice(i, i + 3).join('\n\n').slice(0, 1024) });
    }
  }
  return embed;
}

function reviewButtons(id) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`grom_accept_${id}`).setLabel('Przyjmij').setEmoji('✅').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`grom_reject_${id}`).setLabel('Odrzuć').setEmoji('❌').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`grom_details_${id}`).setLabel('Pełne odpowiedzi').setEmoji('📋').setStyle(ButtonStyle.Secondary)
  );
}

const commands = [
  new SlashCommandBuilder()
    .setName('podanie-grom')
    .setDescription('Publikuje panel rekrutacyjny GROM.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder()
    .setName('grom-status')
    .setDescription('Pokazuje wynik Twojego ostatniego podania do GROM.')
].map(c => c.toJSON());

client.once('ready', async () => {
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
  console.log(`Zalogowano jako ${client.user.tag}`);
  console.log('Komendy /podanie-grom i /grom-status są gotowe.');
});

client.on('interactionCreate', async interaction => {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'podanie-grom') {
        const embed = new EmbedBuilder()
          .setColor(0x111827)
          .setTitle('🇵🇱 GROM • REKRUTACJA ELITARNA')
          .setDescription('**Chcesz ubiegać się o miejsce w GROM?**\n\nPodanie składa się z **44 pytań** i jest automatycznie punktowane do **100 pkt**.\n\n🔴 0–64 pkt — odrzucone\n🟠 65–74 pkt — dodatkowa weryfikacja\n🟡 75–84 pkt — rozmowa\n🟢 85–94 pkt — dalszy etap\n🟣 95–100 pkt — wynik wybitny\n\nKliknij przycisk poniżej, aby rozpocząć.');
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('grom_start').setLabel('Rozpocznij podanie').setEmoji('🇵🇱').setStyle(ButtonStyle.Primary)
        );
        await interaction.reply({ embeds: [embed], components: [row] });
      }

      if (interaction.commandName === 'grom-status') {
        const data = loadData();
        const app = data[interaction.user.id];
        if (!app) return interaction.reply({ content: 'Nie masz jeszcze złożonego podania.', ephemeral: true });
        return interaction.reply({ embeds: [applicationEmbed(app)], ephemeral: true });
      }
      return;
    }

    if (interaction.isButton()) {
      if (interaction.customId === 'grom_start') {
        const data = loadData();
        if (data[interaction.user.id]?.completed) {
          return interaction.reply({ content: 'Masz już złożone podanie. Użyj `/grom-status`, aby sprawdzić wynik.', ephemeral: true });
        }
        sessions.set(interaction.user.id, { answers: [] });
        return interaction.showModal(questionModal(interaction.user.id, 0));
      }

      if (interaction.customId.startsWith('grom_accept_') || interaction.customId.startsWith('grom_reject_')) {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
          return interaction.reply({ content: 'Nie masz uprawnień do rozpatrywania podań.', ephemeral: true });
        }
        const id = interaction.customId.split('_').pop();
        const data = loadData();
        const app = data[id];
        if (!app) return interaction.reply({ content: 'Nie znaleziono podania.', ephemeral: true });
        const accepted = interaction.customId.startsWith('grom_accept_');
        app.reviewedBy = interaction.user.id;
        app.reviewedAt = Date.now();
        app.finalStatus = accepted ? 'PRZYJĘTY' : 'ODRZUCONY';
        saveData(data);

        const member = await interaction.guild.members.fetch(id).catch(() => null);
        if (member && accepted && ACCEPTED_ROLE_ID) await member.roles.add(ACCEPTED_ROLE_ID).catch(() => {});
        if (member && !accepted && REJECTED_ROLE_ID) await member.roles.add(REJECTED_ROLE_ID).catch(() => {});

        const updated = EmbedBuilder.from(applicationEmbed(app)).addFields({ name: 'Decyzja komisji', value: `${accepted ? '✅ PRZYJĘTY' : '❌ ODRZUCONY'}\nRekruter: <@${interaction.user.id}>` });
        await interaction.update({ embeds: [updated], components: [] });
        return;
      }

      if (interaction.customId.startsWith('grom_details_')) {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
          return interaction.reply({ content: 'Nie masz uprawnień.', ephemeral: true });
        }
        const id = interaction.customId.split('_').pop();
        const app = loadData()[id];
        if (!app) return interaction.reply({ content: 'Nie znaleziono podania.', ephemeral: true });
        return interaction.reply({ embeds: [applicationEmbed(app, true)], ephemeral: true });
      }
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith('grom_answer_')) {
      const parts = interaction.customId.split('_');
      const userId = parts[2];
      const page = Number(parts[3]);
      if (interaction.user.id !== userId) return interaction.reply({ content: 'To podanie nie należy do Ciebie.', ephemeral: true });

      const session = sessions.get(userId) || { answers: [] };
      for (let i = page * QUESTIONS_PER_MODAL; i < Math.min((page + 1) * QUESTIONS_PER_MODAL, QUESTION_TEXT.length); i++) {
        session.answers[i] = interaction.fields.getTextInputValue(`q${i + 1}`);
      }
      sessions.set(userId, session);

      const nextPage = page + 1;
      if (nextPage < Math.ceil(QUESTION_TEXT.length / QUESTIONS_PER_MODAL)) {
        await interaction.showModal(questionModal(userId, nextPage));
        return;
      }

      const score = totalScore(session.answers);
      const user = interaction.user;
      const app = {
        userId,
        discordNick: user.username,
        answers: session.answers,
        score,
        completed: true,
        createdAt: Date.now(),
        finalStatus: 'OCZEKUJE NA KOMISJĘ'
      };
      const data = loadData();
      data[userId] = app;
      saveData(data);
      sessions.delete(userId);

      const reviewChannel = await client.channels.fetch(REVIEW_CHANNEL_ID).catch(() => null);
      if (reviewChannel?.isTextBased()) {
        await reviewChannel.send({ embeds: [applicationEmbed(app)], components: [reviewButtons(userId)] });
      }

      await interaction.reply({
        content: `✅ Podanie zostało wysłane do komisji. Twój automatyczny wynik to **${score}/100 pkt**. Status: **${resultFor(score).status}**.`,
        ephemeral: true
      });
    }
  } catch (error) {
    console.error(error);
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: 'Wystąpił błąd podczas obsługi podania. Spróbuj ponownie.', ephemeral: true }).catch(() => {});
    }
  }
});

process.on('unhandledRejection', console.error);
process.on('uncaughtException', console.error);
client.login(TOKEN);
