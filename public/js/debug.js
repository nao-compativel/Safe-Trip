const socket = io();

// Elementos da UI
const playerNameInput = document.getElementById("playerName");
const roomNameInput = document.getElementById("roomName");
const connectBtn = document.getElementById("connectBtn");
const startGameBtn = document.getElementById("startGameBtn");
const myHandDiv = document.getElementById("myHand");
const playersInfoDiv = document.getElementById("playersInfo");
const gameStatePre = document.getElementById("gameState");
const giveCardBtn = document.getElementById("giveCardBtn");
const cardToGiveSelect = document.getElementById("cardToGive");
const myTurnBtn = document.getElementById("myTurnBtn");

let myId = null;

// Lista de cartas
const ALL_CARDS = [
  { tipo: "distancia", valor: 25 },
  { tipo: "distancia", valor: 50 },
  { tipo: "distancia", valor: 75 },
  { tipo: "distancia", valor: 100 },
  { tipo: "distancia", valor: 200 },
  { tipo: "perigo", valor: "sem_gasolina" },
  { tipo: "perigo", valor: "pneu_furado" },
  { tipo: "perigo", valor: "acidente" },
  { tipo: "perigo", valor: "limite_velocidade" },
  { tipo: "perigo", valor: "pare" },
  { tipo: "solucao", valor: "gasolina" },
  { tipo: "solucao", valor: "pneu_reserva" },
  { tipo: "solucao", valor: "reparos" },
  { tipo: "solucao", valor: "fim_limite_velocidade" },
  { tipo: "solucao", valor: "siga" },
  { tipo: "seguranca", valor: "tanque_cheio" },
  { tipo: "seguranca", valor: "pneu_inquebravel" },
  { tipo: "seguranca", valor: "as_do_volante" },
  { tipo: "seguranca", valor: "passagem_livre" },
];
ALL_CARDS.forEach((card) => {
  const option = document.createElement("option");
  option.value = JSON.stringify(card);
  option.textContent = `${card.tipo} - ${card.valor}`;
  cardToGiveSelect.appendChild(option);
});

// Eventos
connectBtn.addEventListener("click", () => {
  socket.emit("entrarNaSala", {
    nomeJogador: playerNameInput.value,
    idSala: roomNameInput.value,
    distancia: 700,
  });
});
startGameBtn.addEventListener("click", () => {
  socket.emit("iniciarJogo", roomNameInput.value);
});
giveCardBtn.addEventListener("click", () => {
  socket.emit("debug:giveCard", { card: JSON.parse(cardToGiveSelect.value) });
});
myTurnBtn.addEventListener("click", () => {
  socket.emit("debug:forceMyTurn");
});

// Listeners do Socket
socket.on("connect", () => {
  myId = socket.id;
  console.log("Conectado com ID:", myId);
});

socket.on("updateState", (state) => {
  if (!state) return;
  gameStatePre.textContent = JSON.stringify(state, null, 2);

  // Atualiza Minha Mão
  myHandDiv.innerHTML = "";
  if (state.me && state.me.mao) {
    state.me.mao.forEach((card, index) => {
      const cardDiv = document.createElement("div");
      cardDiv.className = "card-info";
      cardDiv.innerHTML = `<span>${card.tipo} - ${card.valor}</span>`;

      const actionsDiv = document.createElement("div");
      actionsDiv.className = "card-actions";

      const playBtn = document.createElement("button");
      playBtn.textContent = "Jogar";
      playBtn.onclick = () => {
        if (card.tipo === "perigo") {
          const oponentesIds = state.oponentes.map((p) => p.id).join(" | ");
          const targetId = prompt(
            `Escolha o ID do alvo para a carta ${card.valor}:\nAlvos possíveis: ${oponentesIds}`,
            state.oponentes[0]?.id || ""
          );
          if (targetId)
            socket.emit("jogarCarta", { indiceCarta: index, alvoId: targetId });
        } else {
          socket.emit("jogarCarta", { indiceCarta: index });
        }
      };

      const discardBtn = document.createElement("button");
      discardBtn.textContent = "Descartar";
      discardBtn.onclick = () => {
        socket.emit("descartarCarta", { indiceCarta: index });
      };

      actionsDiv.appendChild(playBtn);
      actionsDiv.appendChild(discardBtn);
      cardDiv.appendChild(actionsDiv);
      myHandDiv.appendChild(cardDiv);
    });
  }

  // Atualiza a lista de jogadores
  playersInfoDiv.innerHTML = "";
  const allPlayers = state.me
    ? [state.me, ...state.oponentes]
    : [...state.oponentes];
  allPlayers.forEach((p) => {
    const playerDiv = document.createElement("div");
    playerDiv.className = "player-info";
    let turnIndicator =
      state.jogadorAtualId === p.id ? " <strong>(TURNO ATUAL)</strong>" : "";
    playerDiv.innerHTML = `
        <strong>${p.nome} ${
      p.id === myId ? "(Eu)" : ""
    }</strong>${turnIndicator}<br>
        ID: <code>${p.id}</code><br>
        Dist: ${p.distancia} km | Cartas: ${p.cartasNaMao}<br>
        Perigos: ${p.perigos_ativos.join(", ") || "Nenhum"}<br>
        Seguranças: ${p.segurancas_ativas.join(", ") || "Nenhum"}<br>
        Parado: ${p.precisa_do_siga} | Lento: ${p.limite_de_velocidade}
    `;
    playersInfoDiv.appendChild(playerDiv);
  });
});

socket.on("listaJogadores", (jogadores) => {
  playersInfoDiv.innerHTML = "";
  jogadores.forEach((p) => {
    const playerDiv = document.createElement("div");
    playerDiv.className = "player-info";
    playerDiv.innerHTML = `<strong>${p.nome}</strong><br>ID: <code>${p.id}</code>`;
    playersInfoDiv.appendChild(playerDiv);
  });
});
