const discord = require('discord.js');
const { Routes } = discord;

// Kompatybilność: niektóre środowiska mogą nie udostępniać
// interaction.showModal(). W takim przypadku wysyłamy callback typu 9
// bezpośrednio przez Discord REST API.
async function showModalCompat(modal) {
  if (!this.client?.rest) {
    throw new Error('Discord REST nie jest dostępny.');
  }

  const data = typeof modal?.toJSON === 'function' ? modal.toJSON() : modal;

  return this.client.rest.post(
    Routes.interactionCallback(this.id, this.token),
    {
      body: {
        type: 9,
        data
      }
    }
  );
}

// Ustawiamy metodę bezwarunkowo na kilku poziomach prototypu.
// Dzięki temu działa także wtedy, gdy konkretna klasa interakcji
// nie ma własnej implementacji showModal().
for (const Type of [discord.Interaction, discord.BaseInteraction, discord.ButtonInteraction]) {
  if (Type?.prototype) {
    Type.prototype.showModal = showModalCompat;
  }
}

console.log('GROM: kompatybilna obsługa showModal aktywna.');

require('./index.js');
