const mongoose = require("mongoose");

let connectionPromise = null;

async function connectDatabase() {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error("MONGODB_URI is missing. Add it in your .env file.");
  }

  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (!connectionPromise) {
    connectionPromise = mongoose.connect(mongoUri).then((connection) => {
      console.log("MongoDB connected.");
      return connection;
    });
  }

  return connectionPromise;
}

module.exports = connectDatabase;
