const express = require('express');
const app = express();
app.use(express.static('public'));

const { createServer } = require("http");
const { Server } = require("socket.io");

const httpServer = createServer(app);
const io = new Server(httpServer);

io.on("connection", (socket) => {
  console.log("socketID:", socket.id);
});

httpServer.listen(8008);