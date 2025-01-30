const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000, // Tiempo máximo para intentar conectarse
    });
    console.log("Conectado a MongoDB");
  } catch (error) {
    console.error("Error de conexión:", error);
    process.exit(1);
  }
};

module.exports = connectDB;
