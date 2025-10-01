// src/socket/events.ts (VERSÃO FINAL CORRIGIDA)

import { Server, Socket } from "socket.io";
import { roomManager } from "./RoomManager";

function broadcastRoomList(io: Server) {
  const salasPublicas = roomManager.getPublicRooms();
  io.emit("listaDeSalas", salasPublicas);
}

export function handleSocketEvents(io: Server, socket: Socket) {
  console.log(`Usuário conectado: ${socket.id}`);
  socket.emit("listaDeSalas", roomManager.getPublicRooms());

  socket.on("entrarNaSala", ({ nomeJogador, idSala, distancia }) => {
    console.log(`[SERVER] Evento 'entrarNaSala': ${nomeJogador} -> ${idSala}`);
    const room = roomManager.getOrCreateRoom(idSala, distancia);

    if (room.estado === "AGUARDANDO") {
      const resultado = room.adicionarJogador(socket.id, nomeJogador);
      if (!resultado.success) {
        socket.emit("erroEntrar", { message: resultado.message });
        return;
      }
      socket.join(idSala);
      socket.data.idSala = idSala;

      const playersInfo = Array.from(room.jogadores.values()).map((p) => ({
        id: p.id,
        nome: p.nome,
        isBot: p.isBot,
      }));
      io.to(idSala).emit("listaJogadores", playersInfo);
      broadcastRoomList(io);
    } else if (room.estado === "JOGO") {
      // [LÓGICA DE RECONEXÃO ROBUSTA]
      // Não confia mais na flag 'disconnected'. Apenas procura por nome.
      const jogadorExistente = Array.from(room.jogadores.values()).find(
        (p) => !p.isBot && p.nome === nomeJogador
      );

      if (!jogadorExistente) {
        socket.emit("erroEntrar", {
          message: "Este jogo já começou e você não é um dos jogadores.",
        });
        return;
      }

      console.log(
        `[SERVER] Forçando reconexão para '${nomeJogador}'. Trocando ID ${jogadorExistente.id} por ${socket.id}`
      );
      const oldSocketId = jogadorExistente.id;

      // Desconecta o socket antigo se ele ainda estiver ativo por algum motivo
      if (io.sockets.sockets.get(oldSocketId)) {
        io.sockets.sockets.get(oldSocketId)?.disconnect();
      }

      room.jogadores.delete(oldSocketId);

      jogadorExistente.id = socket.id;
      jogadorExistente.disconnected = false; // Garante que está como conectado
      room.jogadores.set(socket.id, jogadorExistente);

      const indexNaOrdem = room.ordemTurno.indexOf(oldSocketId);
      if (indexNaOrdem > -1) {
        room.ordemTurno[indexNaOrdem] = socket.id;
      }

      socket.join(idSala);
      socket.data.idSala = idSala;

      io.to(idSala).emit("log", `${nomeJogador} reconectou!`);
      const gameState = room.getStateFor(socket.id);
      socket.emit("updateState", gameState);
    }
  });

  socket.on("iniciarJogo", (idSala) => {
    const room = roomManager.getRoom(idSala);
    if (room && room.jogadores.get(socket.id)) {
      if (room.jogadores.size === 1) {
        room.addBots(3);
      }
      if (room.jogadores.size >= 2) {
        room.onStateChange = (message?: string) => {
          if (message) {
            io.to(idSala).emit("log", message);
          }
          room.jogadores.forEach((jogador) => {
            if (!jogador.isBot) {
              const gameState = room.getStateFor(jogador.id);
              io.to(jogador.id).emit("updateState", gameState);
            }
          });
        };
        room.iniciarJogo();
        broadcastRoomList(io);
      }
    }
  });

  socket.on("jogarCarta", ({ indiceCarta, alvoId }) => {
    const room = roomManager.getRoom(socket.data.idSala);
    if (room) {
      const result = room.jogarCarta(socket.id, indiceCarta, alvoId);
      if (!result.success) {
        socket.emit("erroJogada", { message: result.message });
      }
    }
  });

  socket.on("descartarCarta", ({ indiceCarta }) => {
    const room = roomManager.getRoom(socket.data.idSala);
    if (room) {
      room.descartarCarta(socket.id, indiceCarta);
    }
  });

  socket.on("disconnect", () => {
    console.log(`[Disconnect] Usuário desconectado: ${socket.id}`);
    const idSala = socket.data.idSala;
    if (!idSala) return;

    const room = roomManager.getRoom(idSala);
    if (!room) return;

    const jogador = room.jogadores.get(socket.id);

    // Se o jogador não foi encontrado, ele já foi substituído por uma reconexão, então não fazemos nada.
    if (!jogador) return;

    if (room.estado === "AGUARDANDO") {
      room.removerJogador(socket.id);
      if (room.jogadores.size === 0) {
        roomManager.deleteRoom(idSala);
      }
      broadcastRoomList(io);
    } else if (room.estado === "JOGO") {
      if (!jogador.isBot) {
        jogador.disconnected = true;
        io.to(idSala).emit(
          "log",
          `${jogador.nome} se desconectou. Aguardando reconexão...`
        );

        const humanPlayers = Array.from(room.jogadores.values()).filter(
          (p) => !p.isBot && !p.disconnected
        );
        if (humanPlayers.length === 0) {
          console.log(
            `[SERVER] Todos os humanos desconectaram da sala ${idSala}. Deletando sala.`
          );
          io.to(idSala).emit("jogoEncerrado", {
            message: "Todos os jogadores saíram. A partida foi encerrada.",
          });
          roomManager.deleteRoom(idSala);
          broadcastRoomList(io);
        } else if (room.ordemTurno[room.jogadorAtualIdx] === socket.id) {
          room.proximoTurno();
        }
      }
    }
  });
}
