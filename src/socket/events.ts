import { Server, Socket } from "socket.io";
import { roomManager } from "./RoomManager";
import { GameRoom } from "../core/GameRoom";
function broadcastRoomList(io: Server) {
  const salasPublicas = roomManager.getPublicRooms();
  console.log("[DEBUG] Transmitindo lista de salas:", salasPublicas); // <--- ADICIONE ESTA LINHA
  io.emit("listaDeSalas", salasPublicas);
}

export function handleSocketEvents(io: Server, socket: Socket) {
  console.log(`Usuário conectado: ${socket.id}`);
  broadcastRoomList(io);

  socket.on("entrarNaSala", ({ nomeJogador, idSala, distancia }) => {
    const room = roomManager.getOrCreateRoom(idSala, distancia);
    const resultado = room.adicionarJogador(socket.id, nomeJogador);
    if (!resultado.success) {
      socket.emit("log", `Erro ao entrar na sala: ${resultado.message}`);
      return;
    }

    socket.join(idSala);
    io.to(idSala).emit("log", `${nomeJogador} entrou na sala.`);
    const playersInfo = Array.from(room.jogadores.values()).map((p) => ({
      id: p.id,
      nome: p.nome,
    }));
    io.to(idSala).emit("listaJogadores", playersInfo);
    socket.data.idSala = idSala;
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

      if (room.jogadores.size > 1) {
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

  socket.on("disconnect", () => {
    console.log(`[Disconnect] Usuário desconectado: ${socket.id}`);
    const idSala = socket.data.idSala;

    if (idSala) {
      const room = roomManager.getRoom(idSala);
      if (room) {
        const jogador = room.jogadores.get(socket.id);
        if (!jogador) return; // Jogador já pode ter sido removido

        console.log(
          `[Disconnect] Jogador ${jogador.nome} está saindo da sala ${idSala}.`
        );
        io.to(idSala).emit("log", `${jogador.nome} saiu do jogo.`);

        // Guarda o índice do jogador atual antes de qualquer modificação
        const eraTurnoDoJogadorDesconectado =
          room.ordemTurno[room.jogadorAtualIdx] === socket.id;

        // Remove o jogador do mapa de jogadores
        room.jogadores.delete(socket.id);

        // **INÍCIO DA CORREÇÃO**
        // Remove o jogador também da ordem de turnos
        const indexNaOrdem = room.ordemTurno.indexOf(socket.id);
        if (indexNaOrdem > -1) {
          room.ordemTurno.splice(indexNaOrdem, 1);
          console.log(`[Disconnect] Jogador removido da ordem de turnos.`);
        }

        // Ajusta o índice do jogador atual para não pular um turno
        // Se o jogador removido estava antes do jogador atual na lista, o índice do atual precisa ser decrementado.
        if (room.jogadorAtualIdx > indexNaOrdem) {
          room.jogadorAtualIdx--;
        }
        // Garante que o índice não fique fora dos limites após a remoção
        if (room.jogadorAtualIdx >= room.ordemTurno.length) {
          room.jogadorAtualIdx = 0;
        }
        // **FIM DA CORREÇÃO**

        // Se o jogo estava rolando e agora tem menos de 2 jogadores, encerra.
        if (room.estado === "JOGANDO" && room.jogadores.size < 2) {
          io.to(idSala).emit("jogoEncerrado", {
            message:
              "A partida foi encerrada pois não há oponentes suficientes.",
          });
          roomManager.deleteRoom(idSala);
          console.log(
            `[Disconnect] Sala ${idSala} encerrada por falta de jogadores.`
          );
        }
        // Se era o turno do jogador que desconectou, força a passagem para o próximo.
        else if (eraTurnoDoJogadorDesconectado && room.estado === "JOGANDO") {
          console.log(
            `[Disconnect] O jogador do turno atual saiu. Avançando para o próximo turno.`
          );
          // Como o índice já foi ajustado, chamar proximoTurno vai funcionar, mas precisa de um pequeno ajuste
          // para não incrementar de novo. Em vez disso, chamamos o onStateChange e reiniciamos o timer.
          room.jogadorAtualIdx--; // Volta um para que o proximoTurno() avance para o jogador correto
          room.proximoTurno();
        }
        // Se o jogo não acabou, apenas atualiza a lista de jogadores na UI.
        else {
          const playersInfo = Array.from(room.jogadores.values()).map((p) => ({
            id: p.id,
            nome: p.nome,
          }));
          io.to(idSala).emit("listaJogadores", playersInfo);
        }

        // Se a sala ficou vazia, deleta (isto pode ser redundante se a lógica acima já cobriu, mas é uma boa garantia)
        if (room.jogadores.size === 0) {
          roomManager.deleteRoom(idSala);
        }
        broadcastRoomList(io);
      }
    }
  });
}
