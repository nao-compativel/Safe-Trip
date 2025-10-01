// Em src/app.ts
import express from "express";
import * as http from "http";
import { Server } from "socket.io";
import path from "path";
import { handleSocketEvents } from "./socket/events";

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "..", "public")));

io.on("connection", (socket) => {
  handleSocketEvents(io, socket);
});

// O setInterval foi removido daqui para melhorar a eficiência.
// A lista de salas agora é atualizada apenas quando necessário (eventos de entrar/sair/iniciar).

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
