// src/socket/events.ts
import { Server, Socket } from "socket.io";
import { roomManager } from "../core/RoomManager";
import { GameRoom } from "../core/GameRoom";
import { Player } from "../core/Player";
import { Card } from "../core/Card";

function broadcastRoomList(io: Server) {
  const salasPublicas = roomManager.getPublicRooms();
  io.emit("listaDeSalas", salasPublicas);
}

export function handleSocketEvents(io: Server, socket: Socket) {
  console.log(`Usuário conectado: ${socket.id}`);
  socket.emit("listaDeSalas", roomManager.getPublicRooms());

  socket.on("entrarNaSala", ({ nomeJogador, idSala, distancia }) => {
    const room: GameRoom = roomManager.getOrCreateRoom(idSala, distancia);

    if (room.estado === "JOGO") {
      const jogadorExistente = Array.from(room.jogadores.values()).find(
        (p: Player) => !p.isBot && p.nome === nomeJogador
      );
      if (!jogadorExistente) {
        socket.emit("erroEntrar", {
          message: "Este jogo já começou e você não é um jogador válido.",
        });
        return;
      }

      const oldSocketId = jogadorExistente.id;
      if (room.jogadores.has(oldSocketId)) {
        room.jogadores.delete(oldSocketId);
      }

      jogadorExistente.id = socket.id;
      jogadorExistente.disconnected = false;
      room.jogadores.set(socket.id, jogadorExistente);

      const indexNaOrdem = room.ordemTurno.indexOf(oldSocketId);
      if (indexNaOrdem > -1) {
        room.ordemTurno[indexNaOrdem] = socket.id;
      }

      socket.join(idSala);
      socket.data.idSala = idSala;
      io.to(idSala).emit("log", `${nomeJogador} reconectou!`);
      const gameState = room.getStateFor(socket.id);
      if (gameState) socket.emit("updateState", gameState);
    } else {
      // Estado AGUARDANDO
      const resultado = room.adicionarJogador(socket.id, nomeJogador);
      if (!resultado.success) {
        socket.emit("erroEntrar", { message: resultado.message });
        return;
      }
      socket.join(idSala);
      socket.data.idSala = idSala;
      const playersInfo = Array.from(room.jogadores.values()).map(
        (p: Player) => p.publicState
      );
      io.to(idSala).emit("listaJogadores", playersInfo);
      broadcastRoomList(io);
    }
  });

  socket.on("iniciarJogo", (idSala) => {
    const room = roomManager.getRoom(idSala);
    if (room && room.jogadores.get(socket.id)) {
      if (room.jogadores.size === 1) {
        room.addBots(1);
      }

      room.onStateChange = (message?: string) => {
        if (message) io.to(idSala).emit("log", message);

        room.jogadores.forEach((jogador: Player) => {
          if (!jogador.isBot) {
            const gameState = room.getStateFor(jogador.id);
            if (gameState) io.to(jogador.id).emit("updateState", gameState);
          }
        });

        if (room.estado === "ENCERRADA") {
          console.log(
            `[GAME END] Partida na sala '${idSala}' terminou. Agendando limpeza em 30 segundos.`
          );
          setTimeout(() => {
            console.log(`[CLEANUP] Deletando sala finalizada: ${idSala}`);
            roomManager.deleteRoom(idSala);
            broadcastRoomList(io);
          }, 30000);
        }
      };

      room.iniciarJogo();
      broadcastRoomList(io);
    }
  });

  socket.on("jogarCarta", ({ indiceCarta, alvoId }) => {
    const room = roomManager.getRoom(socket.data.idSala);
    if (room) {
      const result = room.jogarCarta(socket.id, indiceCarta, alvoId);
      if (!result.success) {
        socket.emit("erroJogada", { message: result.message });
      } else if (result.acao) {
        io.to(socket.data.idSala).emit(result.acao.evento, result.acao.dados);
      }
    }
  });

  socket.on("descartarCarta", ({ indiceCarta }) => {
    const room = roomManager.getRoom(socket.data.idSala);
    if (room) {
      room.descartarCarta(socket.id, indiceCarta);
    }
  });

  socket.on("debug:giveCard", ({ card }) => {
    const room = roomManager.getRoom(socket.data.idSala);
    const player = room?.jogadores.get(socket.id);
    if (room && player && card) {
      player.mao.push(card as Card);
      room.onStateChange?.(
        `Debug: ${player.nome} recebeu a carta ${card.valor}.`
      );
    }
  });

  socket.on("debug:forceMyTurn", () => {
    const room = roomManager.getRoom(socket.data.idSala);
    const player = room?.jogadores.get(socket.id);
    if (room && player) {
      const success = room.forceTurnFor(socket.id);
      if (success) {
        room.onStateChange?.(`Debug: Turno forçado para ${player.nome}.`);
      }
    }
  });

  socket.on("disconnect", () => {
    const idSala = socket.data.idSala;
    if (!idSala) return;
    const room = roomManager.getRoom(idSala);
    if (!room) return;
    const jogador = room.jogadores.get(socket.id);
    if (!jogador) return;

    if (room.estado === "JOGO") {
      jogador.disconnected = true;
      io.to(idSala).emit("log", `${jogador.nome} se desconectou.`);
      const humanPlayers = Array.from(room.jogadores.values()).filter(
        (p: Player) => !p.isBot && !p.disconnected
      );

      // [CORREÇÃO] Verificação redundante removida
      if (humanPlayers.length === 0) {
        io.to(idSala).emit("jogoEncerrado", {
          message: "Todos os jogadores saíram.",
        });
        roomManager.deleteRoom(idSala);
        broadcastRoomList(io);
      } else if (room.ordemTurno[room.jogadorAtualIdx] === socket.id) {
        room.proximoTurno();
      }
    } else if (room.estado === "AGUARDANDO") {
      room.removerJogador(socket.id);
      if (room.jogadores.size === 0) {
        roomManager.deleteRoom(idSala);
      } else {
        io.to(idSala).emit(
          "listaJogadores",
          Array.from(room.jogadores.values()).map((p: Player) => p.publicState)
        );
      }
      broadcastRoomList(io);
    }
  });
}
