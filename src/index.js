const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bodyParser = require("body-parser");
const connectDB = require("./db/db");
const User = require("./models/User");
const bcrypt = require("bcrypt");
const Message = require("./models/Message");
const { Server } = require("socket.io");
const app = express();
const http = require("http");
const server = http.createServer(app);

require("dotenv").config();

const PORT = 5000;
const SECRET_KEY = "your_secret_key";

connectDB();

// Store users and their socket IDs
const userSockets = new Map();
const roomUsers = new Map();
const activeRooms = new Set([
  "Jobers",
  "Ventas",
  "Coordinacion",
  "Gestion",
  "Marketing",
  "Contabilidad",
  "RRHH",
]);

const io = new Server(server, {
  cors: {
    origin: "https://plataforma-mundojob-frontend.onrender.com",
    // origin: "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true,
    allowedHeaders: ["Content-Type"],
  },
});

app.use(cors());
app.use(bodyParser.json());
app.use(express.json());
app.use(
  cors({
    origin: "https://plataforma-mundojob-frontend.onrender.com",
    // origin: "http://localhost:5173",
  })
);

app.get("/api/rooms", (req, res) => {
  res.json(Array.from(activeRooms));
});

// Endpoint de registro
app.post("/register", async (req, res) => {
  const { username, password } = req.body;

  try {
    // Input validation
    if (!username || !password) {
      return res
        .status(400)
        .json({ message: "Username and password are required" });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: "Username already exists" });
    }

    // Create new user
    const user = new User({
      username,
      password,
      role: "user", // Set default role
    });

    // Save user to database
    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, username: user.username },
      SECRET_KEY,
      { expiresIn: "1h" }
    );

    // Return success response
    res.status(201).json({
      message: "User registered successfully",
      token,
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({
      message: "Registration failed",
      error: error.message,
    });
  }
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    // Buscar al usuario en la base de datos
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Comparar contraseñas
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Generar un token JWT
    const token = jwt.sign({ username }, SECRET_KEY, { expiresIn: "1h" });
    res.json({ token });
  } catch (error) {
    console.error("Login failed", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.get("/api/messages/:room", async (req, res) => {
  try {
    const messages = await Message.find({
      room: req.params.room,
      type: { $ne: "system" },
    })
      .sort({ timestamp: -1 })
      .limit(50);
    res.json(messages.reverse());
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

io.on("connection", (socket) => {
  console.log("Usuario conectado:", socket.id);

  socket.on("joinRoom", ({ username, room }) => {
    userSockets.set(username, socket.id);
    socket.join(room);

    if (!roomUsers.has(room)) {
      roomUsers.set(room, new Set());
    }
    roomUsers.get(room).add(username);

    io.to(room).emit("roomUsers", Array.from(roomUsers.get(room)));
  });

  socket.on("directMessage", async ({ from, to, message }) => {
    const toSocketId = userSockets.get(to);
    if (toSocketId) {
      io.to(toSocketId).emit("message", {
        username: from,
        text: message,
        timestamp: new Date(),
        isDirect: true,
      });

      socket.emit("message", {
        username: from,
        text: message,
        timestamp: new Date(),
        isDirect: true,
      });

      const newMessage = new Message({
        type: "direct",
        from,
        to,
        text: message,
      });
      await newMessage.save();
    }
  });

  socket.on("sendMessage", async ({ username, room, message }) => {
    const newMessage = new Message({
      room,
      username,
      text: message,
      type: "room",
    });

    try {
      await newMessage.save();
      io.to(room).emit("message", {
        username,
        text: message,
        timestamp: newMessage.timestamp,
        type: "room",
      });
    } catch (error) {
      console.error("Error al guardar mensaje:", error);
    }
  });

  socket.on("leaveRoom", async ({ username, room }) => {
    socket.leave(room);

    if (roomUsers.has(room)) {
      roomUsers.get(room).delete(username);
      if (roomUsers.get(room).size === 0) {
        roomUsers.delete(room);
        if (
          ![
            "Jobers",
            "Ventas",
            "Coordinacion",
            "Gestion",
            "Marketing",
            "Contabilidad",
            "RRHH",
          ].includes(room)
        ) {
          activeRooms.delete(room);
          io.emit("roomsUpdated", Array.from(activeRooms));
        }
      } else {
        io.to(room).emit("roomUsers", Array.from(roomUsers.get(room)));
      }
    }
  });

  socket.on("disconnect", () => {
    let disconnectedUsername;
    for (const [username, socketId] of userSockets.entries()) {
      if (socketId === socket.id) {
        disconnectedUsername = username;
        userSockets.delete(username);
        break;
      }
    }

    if (disconnectedUsername) {
      for (const [room, users] of roomUsers.entries()) {
        if (users.has(disconnectedUsername)) {
          users.delete(disconnectedUsername);
          io.to(room).emit("roomUsers", Array.from(users));
        }
      }
    }

    console.log("Usuario desconectado:", socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
