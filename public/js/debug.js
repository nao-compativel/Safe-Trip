const socket = io();

// Elementos da UI
const playerNameInput = document.getElementById("playerName");
const roomNameInput = document.getElementById("roomName");
const connectBtn = document.getElementById("connectBtn");
const startGameBtn = document.getElementById("startGameBtn");
const myHandDiv = document.getElementById("myHand");
const playersTargetDiv = document.getElementById("playersTarget");
const gameStatePre = document.getElementById("gameState");
const giveCardBtn = document.getElementById("giveCardBtn");
const cardToGiveSelect = document.getElementById("cardToGive");
const myTurnBtn = document.getElementById("myTurnBtn");

let myId = null;
let oponentes = [];

// Lista de todas as cartas possíveis para o dropdown
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
  const card = JSON.parse(cardToGiveSelect.value);
  socket.emit("debug:giveCard", { card }); // Evento customizado de debug
});

myTurnBtn.addEventListener("click", () => {
  socket.emit("debug:forceMyTurn"); // Evento customizado de debug
});

// Listeners do Socket
socket.on("connect", () => {
  myId = socket.id;
  console.log("Conectado com ID:", myId);
});

socket.on("updateState", (state) => {
  gameStatePre.textContent = JSON.stringify(state, null, 2);

  // Atualiza a mão
  myHandDiv.innerHTML = "<h3>Minha Mão:</h3>";
  state.me.mao.forEach((card, index) => {
    const btn = document.createElement("button");
    btn.className = "card-btn";
    btn.textContent = `${card.tipo} - ${card.valor}`;
    btn.onclick = () => {
      if (card.tipo === "perigo") {
        const targetId = document.querySelector(
          'input[name="target"]:checked'
        )?.value;
        if (!targetId) return alert("Selecione um alvo!");
        socket.emit("jogarCarta", { indiceCarta: index, alvoId: targetId });
      } else {
        socket.emit("jogarCarta", { indiceCarta: index });
      }
    };
    myHandDiv.appendChild(btn);
  });

  // Atualiza lista de alvos
  oponentes = state.oponentes;
  playersTargetDiv.innerHTML = "<h3>Alvos:</h3>";
  oponentes.forEach((p) => {
    playersTargetDiv.innerHTML += `
            <label>
                <input type="radio" name="target" value="${p.id}"> ${p.nome}
            </label><br>
        `;
  });
});
