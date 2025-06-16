// // const mongoose = require('mongoose');

// // // Query History Schema
// // const queryHistorySchema = new mongoose.Schema({
// //   question: { type: String, required: true },
// //   category: { type: String, required: true },
// //   sqlQuery: String,
// //   response: { type: String, required: true },
// //   error: String,
// //   source: { type: String, enum: ['slack', 'api'], required: true }
// // }, { timestamps: true });

// // // Adding an index on createdAt field to optimize sorting
// // queryHistorySchema.index({ createdAt: -1 });

// // // Automatically sort by `createdAt` descending (most recent first) for all queries
// // queryHistorySchema.pre('find', function(next) {
// //   this.sort({ createdAt: -1 });
// //   next();
// // });

// // module.exports = mongoose.model('QueryHistory', queryHistorySchema);

// const mongoose = require("mongoose");

// // Query History Schema
// const queryHistorySchema = new mongoose.Schema({
//   question: { type: String, required: true },
//   category: { type: String, required: true },
//   sqlQuery: String,
//   response: { type: String, required: true },
//   error: String,
//   source: { type: String, enum: ["slack", "api"], required: true },
  
//   // Save plain text values after decoding
//   userId: { type: String, required: true },
//   tenantId: { type: String, required: true },
  
//   // Additional fields
//   username: { type: String, default:  "Unknown" },
//   feedback: { type: Boolean, default: null },
  
//   inputTokens: { type: Number, default: 0 },
//   outputTokens: { type: Number, default: 0 },
//   totalTokens: { type: Number, default: 0 }
// }, { timestamps: true });

// // Adding an index on createdAt field to optimize sorting
// queryHistorySchema.index({ createdAt: -1 });

// // Automatically sort by `createdAt` descending (most recent first) for all queries
// queryHistorySchema.pre("find", function(next) {
//   this.sort({ createdAt: -1 });
//   next();
// });

// // module.exports = mongoose.model("QueryHistory", queryHistorySchema);
// module.exports = queryHistorySchema;



const mongoose = require("mongoose");
// If you want to use moment, uncomment the next line
// const moment = require("moment");

// Query History Schema
const queryHistorySchema = new mongoose.Schema(
  {
    question: { type: String, required: true },
    category: { type: String, required: true },
    sqlQuery: String,
    response: { type: String, required: true },
    error: String,
    source: { type: String, enum: ["slack", "api"], required: true },

    userId: { type: String, required: true },
    tenantId: { type: String, required: true },

    username: { type: String, default: "Unknown" },
    feedback: { type: Boolean, default: null },

    inputTokens: { type: Number, default: 0 },
    outputTokens: { type: Number, default: 0 },
    totalTokens: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    // Enable getters so they run when converting docs to JSON or objects
    toJSON: { getters: true },
    toObject: { getters: true },
  }
);

// Add an index on createdAt for sorting
queryHistorySchema.index({ createdAt: -1 });

// Automatically sort by `createdAt` descending
// queryHistorySchema.pre("find", function (next) {
//   this.sort({ createdAt: -1 });
//   next();
// });

/**
 * Define a getter for `createdAt` to return a custom-formatted date string.
 * Internally, Mongoose stores UTC dates, but this getter
 * will transform them to a local date string for display.
 */
queryHistorySchema.path("createdAt").get(function (value) {
  // Option A: Use built-in toLocaleString (local server time):
  return value.toLocaleString(); 
  // e.g. "3/6/2025, 8:43:15 AM" if your server is in EST, etc.

  // Option B: Use moment for a custom format (uncomment moment above):
  // return moment(value).format("YYYY-MM-DD HH:mm:ss");
});

module.exports = queryHistorySchema;
