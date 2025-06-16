// utils/tokenUsage.js
const QueryHistory = require('../models/QueryHistory');
async function updateTokenUsage(userId, tenantId, tokensUsed) {
  const tokenLimit = parseInt(process.env.TOKEN_LIMIT || '1000000', 10);

  let tokenUsage = await TokenUsage.findOne({ userID: userId, tenantID: tenantId });
  if (!tokenUsage) {
    tokenUsage = new TokenUsage({ userID: userId, tenantID: tenantId });
  }

  const newTotal = tokenUsage.totalTokens + tokensUsed;
  if (newTotal > tokenLimit) {
    throw new Error('Token limit exceeded');
  }

  tokenUsage.totalTokens = newTotal;
  await tokenUsage.save();
}

module.exports = updateTokenUsage;