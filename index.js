const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

io.on("connect", (socket) => {
    console.log("user connected with socketID=", socket.id);
    socket.emit("hello");
});
  
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "/html/index.html"));
});

httpServer.listen(5000, () => {
    console.log("Listening on port 5000.");
});