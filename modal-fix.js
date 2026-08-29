const { ButtonInteraction, Routes } = require('discord.js');

// Awaryjna obsługa modali. Jeśli użyta wersja/runtime discord.js
// nie udostępnia interaction.showModal(), wysyłamy callback typu 9
// bezpośrednio do Discord API.
if (typeof ButtonInteraction.prototype.showModal !== 'function') {
  ButtonInteraction.prototype.showModal = async function (modal) {
    if (!this.client?.rest) {
      throw new Error('Discord REST nie jest dostępny.');
    }

    const data = typeof modal?.toJSON === 'function' ? modal.toJSON() : modal;

    await this.client.rest.post(
      Routes.interactionCallback(this.id, this.token),
      {
        body: {
          type: 9,
          data
        }
      }
    );
  };

  console.log('GROM: włączono awaryjny moduł showModal().');
}

require('./index.js');
