// Em src/app.ts

import express from "express";
import * as http from "http";
import { Server } from "socket.io";
import path from "path";
import { handleSocketEvents } from "./socket/events";
import { roomManager } from "./socket/RoomManager";

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "..", "public")));

io.on("connection", (socket) => {
  handleSocketEvents(io, socket);
});

// Envia um "pulso" com a lista de salas atualizada para todos a cada 1 segundos.
// Isso garante que a lista de salas no lobby esteja sempre correta.
setInterval(() => {
  io.emit("listaDeSalas", roomManager.getPublicRooms());
}, 2500);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
