// src/server.ts

import express from "express";
import * as http from "http";
import { Server } from "socket.io";
import path from "path";
import { GameRoom } from "./game";

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve os arquivos estáticos da pasta 'public'
app.use(express.static(path.join(__dirname, "..", "public")));

const rooms = new Map<string, GameRoom>();

io.on("connection", (socket) => {
  console.log(`Usuário conectado: ${socket.id}`);

  socket.on("entrarNaSala", ({ nomeJogador, idSala }) => {
    let room = rooms.get(idSala);
    if (!room) {
      room = new GameRoom(idSala);
      rooms.set(idSala, room);
    }

    socket.join(idSala);
    room.adicionarJogador(socket.id, nomeJogador);
    console.log(`${nomeJogador} entrou na sala ${idSala}`);

    io.to(idSala).emit("log", `${nomeJogador} entrou na sala.`);

    const playersInfo = Array.from(room.jogadores.values()).map((p) => ({
      id: p.id,
      nome: p.nome,
    }));
    io.to(idSala).emit("listaJogadores", playersInfo);

    socket.data.idSala = idSala;
  });

  socket.on("iniciarJogo", (idSala) => {
    const room = rooms.get(idSala);
    if (room && room.jogadores.get(socket.id)) {
      room.iniciarJogo();
      console.log(`Jogo iniciado na sala ${idSala}`);

      room.jogadores.forEach((jogador) => {
        const gameState = room.getStateFor(jogador.id);
        io.to(jogador.id).emit("updateState", gameState);
      });
      io.to(idSala).emit("log", `O jogo começou!`);
    }
  });

  socket.on("jogarCarta", ({ indiceCarta, alvoId }) => {
    const idSala = socket.data.idSala;
    const room = rooms.get(idSala);

    if (room) {
      const result = room.jogarCarta(socket.id, indiceCarta, alvoId);

      if (!result.success) {
        socket.emit("log", `Jogada Inválida: ${result.message}`);
      } else {
        io.to(idSala).emit("log", result.message);
      }

      if (result.success) {
        room.jogadores.forEach((jogador) => {
          const gameState = room.getStateFor(jogador.id);
          io.to(jogador.id).emit("updateState", gameState);
        });
      }
    }
  });

  socket.on("descartarCarta", ({ indiceCarta }) => {
    const idSala = socket.data.idSala;
    const room = rooms.get(idSala);
    if (room) {
      const result = room.descartarCarta(socket.id, indiceCarta);
      io.to(idSala).emit("log", result.message);

      if (result.success) {
        room.jogadores.forEach((jogador) => {
          const gameState = room.getStateFor(jogador.id);
          io.to(jogador.id).emit("updateState", gameState);
        });
      }
    }
  });

  socket.on("disconnect", () => {
    console.log(`Usuário desconectado: ${socket.id}`);
    const idSala = socket.data.idSala;
    const room = rooms.get(idSala);
    if (room) {
      const jogador = room.jogadores.get(socket.id);
      if (jogador) {
        io.to(idSala).emit("log", `${jogador.nome} saiu do jogo.`);
        room.jogadores.delete(socket.id);

        // Remove a sala se estiver vazia
        if (room.jogadores.size === 0) {
          rooms.delete(idSala);
          console.log(`Sala ${idSala} vazia, removida.`);
        } else {
          const playersInfo = Array.from(room.jogadores.values()).map((p) => ({
            id: p.id,
            nome: p.nome,
          }));
          io.to(idSala).emit("listaJogadores", playersInfo);
        }
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
// Acesse o jogo em http://localhost:3000
