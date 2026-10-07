require('dotenv').config();
const mongoose = require('mongoose');
const { reindexProductsToSearch } = require('../dist/server/services/productSearch');

async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is required');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const indexed = await reindexProductsToSearch();
  console.log(`Indexed ${indexed} products in Typesense`);
}

main()
  .catch(error => {
    console.error(`Product search reindex failed: ${error.stack || error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
