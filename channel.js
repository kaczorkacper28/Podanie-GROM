// Wymuszony kanał, na który trafiają wyniki podań.
// Ustawiamy go przed uruchomieniem index.js, więc wartość z .env nie nadpisze tego ID.
process.env.REVIEW_CHANNEL_ID = '1543364942777032805';
