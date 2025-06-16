const mongoose = require("mongoose");
const queryHistorySchema = require("../models/QueryHistory");

/**
 * Returns a Mongoose model that stores documents in a collection named after the tenantId.
 * If a model already exists for that tenant, it reuses it.
 * Otherwise, it creates a new one.
 * 
 * @param {string} tenantId - The tenant ID to use as the collection name.
 * @returns {mongoose.Model} A Mongoose model for that tenant's query history.
 */
function getQueryHistoryModel(tenantId) {
  // We create a unique model name to avoid collisions in the Mongoose cache
  const modelName = `QueryHistory_${tenantId}`;

  // If a model with this name already exists, just return it
  if (mongoose.models[modelName]) {
    return mongoose.models[modelName];
  }

  // The third argument sets the actual collection name in MongoDB
  // Here we use tenantId as the collection name
  return mongoose.model(modelName, queryHistorySchema, tenantId);
}

module.exports = getQueryHistoryModel;
