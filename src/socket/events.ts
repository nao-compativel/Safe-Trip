// src/socket/events.ts
import { Server, Socket } from "socket.io";
import { roomManager } from "./RoomManager";

function broadcastRoomList(io: Server) {
  const salasPublicas = roomManager.getPublicRooms();
  io.emit("listaDeSalas", salasPublicas);
}

export function handleSocketEvents(io: Server, socket: Socket) {
  console.log(`Usuário conectado: ${socket.id}`);

  // Envia a lista de salas apenas para o novo usuário conectado
  socket.emit("listaDeSalas", roomManager.getPublicRooms());

  socket.on("entrarNaSala", ({ nomeJogador, idSala, distancia }) => {
    const room = roomManager.getOrCreateRoom(idSala, distancia);
    const resultado = room.adicionarJogador(socket.id, nomeJogador);
    if (!resultado.success) {
      socket.emit("log", `Erro ao entrar na sala: ${resultado.message}`);
      return;
    }

    socket.join(idSala);
    socket.data.idSala = idSala;

    io.to(idSala).emit("log", `${nomeJogador} entrou na sala.`);
    const playersInfo = Array.from(room.jogadores.values()).map((p) => ({
      id: p.id,
      nome: p.nome,
    }));
    io.to(idSala).emit("listaJogadores", playersInfo);

    broadcastRoomList(io);
  });

  socket.on("iniciarJogo", (idSala) => {
    const room = roomManager.getRoom(idSala);
    if (room && room.jogadores.get(socket.id)) {
      if (room.jogadores.size === 1) {
        room.addBots(3);
        io.to(idSala).emit("log", `Adicionando 3 bots para a corrida!`);
        const playersInfo = Array.from(room.jogadores.values()).map((p) => ({
          id: p.id,
          nome: p.nome,
        }));
        io.to(idSala).emit("listaJogadores", playersInfo);
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
        console.log(`Jogo iniciado na sala ${idSala}`);
        broadcastRoomList(io); // Remove a sala da lista de salas abertas
      } else {
        socket.emit("log", "É necessário pelo menos 2 jogadores para começar.");
      }
    }
  });

  socket.on("jogarCarta", ({ indiceCarta, alvoId }) => {
    const room = roomManager.getRoom(socket.data.idSala);
    if (room) {
      const result = room.jogarCarta(socket.id, indiceCarta, alvoId);
      if (!result.success) {
        socket.emit("log", `Jogada Inválida: ${result.message}`);
      }
    }
  });

  socket.on("descartarCarta", ({ indiceCarta }) => {
    const room = roomManager.getRoom(socket.data.idSala);
    if (room) {
      room.descartarCarta(socket.id, indiceCarta);
    }
  });

  // [ATUALIZADO] Lógica de desconexão simplificada
  socket.on("disconnect", () => {
    console.log(`[Disconnect] Usuário desconectado: ${socket.id}`);
    const idSala = socket.data.idSala;

    if (idSala) {
      const room = roomManager.getRoom(idSala);
      if (room) {
        const eraTurnoDoJogador = room.removerJogador(socket.id);

        if (room.jogadores.size === 0) {
          console.log(
            `[Disconnect] Sala ${idSala} ficou vazia e foi deletada.`
          );
          roomManager.deleteRoom(idSala);
        } else if (room.estado === "JOGO" && room.jogadores.size < 2) {
          // [CORRIGIDO]
          io.to(idSala).emit("jogoEncerrado", {
            message:
              "A partida foi encerrada pois não há oponentes suficientes.",
          });
          roomManager.deleteRoom(idSala);
        } else if (eraTurnoDoJogador && room.estado === "JOGO") {
          // [CORRIGIDO]
          console.log(
            `[Disconnect] Jogador do turno atual saiu. Avançando para o próximo.`
          );
          room.proximoTurno();
        } else {
          const playersInfo = Array.from(room.jogadores.values()).map((p) => ({
            id: p.id,
            nome: p.nome,
          }));
          io.to(idSala).emit("listaJogadores", playersInfo);
        }

        broadcastRoomList(io);
      }
    }
  });
  // Apenas funcionam em salas que começam com "debug_" para segurança
  socket.on("debug:giveCard", ({ card }) => {
    const room = roomManager.getRoom(socket.data.idSala);
    if (room && socket.data.idSala.startsWith("debug")) {
      const player = room.jogadores.get(socket.id);
      if (player) {
        player.mao.push(card);
        room.onStateChange?.(); // Força a atualização do estado para todos
      }
    }
  });

  socket.on("debug:forceMyTurn", () => {
    const room = roomManager.getRoom(socket.data.idSala);
    if (room && socket.data.idSala.startsWith("debug_")) {
      const myIndex = room.ordemTurno.indexOf(socket.id);
      if (myIndex !== -1) {
        room.jogadorAtualIdx = myIndex;
        room.onStateChange?.(
          `Turno forçado para ${room.jogadores.get(socket.id)?.nome}.`
        );
      }
    }
  });
}
