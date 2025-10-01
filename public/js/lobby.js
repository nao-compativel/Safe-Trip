// Conectando ao servidor Socket.IO
const socket = io();

// --- MAPEAMENTO DOS ELEMENTOS DA INTERFACE (UI) ---
const ui = {
  // Card da esquerda
  playerNameInput: document.getElementById("playerName"),
  roomNameInput: document.getElementById("roomName"),
  createRoomButton: document.querySelector(
    ".game-card .action-button:nth-of-type(1)"
  ),
  helpButton: document.querySelector(
    ".game-card .action-button:nth-of-type(2)"
  ),

  // Card da direita
  roomList: document.querySelector(".room-list"),

  // --- [INÍCIO] NOVOS ELEMENTOS DO MODAL ---
  settingsButton: document.querySelector(".settings-button"),
  settingsModal: document.getElementById("settingsModal"),
  closeModalButton: document.querySelector(".close-button"),
  volumeSlider: document.getElementById("volumeSlider"),
  // --- [FIM] NOVOS ELEMENTOS DO MODAL ---
};

// --- CONTROLE DE MÚSICA E SOM ---
const musicas = {
  lobby: new Audio("../sounds/lobby_music.mp3"),
};

/**
 * Toca a música do lobby, respeitando o volume salvo.
 */
function tocarMusicaLobby() {
  const musicaLobby = musicas.lobby;
  if (!musicaLobby) return;

  Object.values(musicas).forEach((music) => music.pause()); // Para todas as outras

  musicaLobby.loop = true;
  musicaLobby.volume = ui.volumeSlider.value; // Usa o valor atual do slider
  musicaLobby.play().catch(() => {
    // Autoplay foi bloqueado, a música começará quando o usuário clicar na tela
    console.warn(
      "Navegador bloqueou autoplay. A música iniciará com a interação do usuário."
    );
  });
}

/**
 * Define o volume de todas as músicas e salva a preferência.
 * @param {number} volume - O nível do volume (entre 0 e 1).
 */
function setVolume(volume) {
  const vol = parseFloat(volume);
  if (isNaN(vol)) return;

  // Aplica o volume a todas as instâncias de áudio
  Object.values(musicas).forEach((music) => {
    music.volume = vol;
  });

  // Salva a preferência no cache do navegador
  localStorage.setItem("gameVolume", vol);
}

// --- LÓGICA DO MODAL ---
function openModal() {
  ui.settingsModal.classList.remove("hidden");
}

function closeModal() {
  ui.settingsModal.classList.add("hidden");
}

// --- FUNÇÕES AUXILIARES ---
function showError(element, message) {
  element.style.borderColor = "red";
  element.placeholder = message;
  element.focus();

  setTimeout(() => {
    element.style.borderColor = "";
    element.placeholder = "";
  }, 3000);
}

/**
 * Valida o nome do jogador e redireciona para a sala de jogo.
 * @param {string} roomId O ID da sala para entrar.
 */
function joinRoom(roomId) {
  const playerName = ui.playerNameInput.value.trim();

  if (!playerName) {
    showError(ui.playerNameInput, "Digite seu nome para entrar!");
    return;
  }

  // Armazena os dados no sessionStorage para usar na próxima página
  sessionStorage.setItem("playerName", playerName);
  sessionStorage.setItem("roomId", roomId);

  window.location.href = "espera-page.html"; // Redireciona para a tela de espera
}

// --- EVENT LISTENERS ---

// Evento para o botão "Criar Sala"
ui.createRoomButton.addEventListener("click", () => {
  const roomName = ui.roomNameInput.value.trim();
  if (!roomName) {
    showError(ui.roomNameInput, "Digite um nome para a sala!");
    return;
  }
  joinRoom(roomName);
});

// (Opcional) Evento para o botão de Ajuda
ui.helpButton.addEventListener("click", () => {
  alert(
    'Como Jogar:\n\n1. Digite seu nome de usuário.\n2. Para criar uma sala, digite o nome e clique em "Criar Sala".\n3. Para entrar, clique em "Entrar" na lista de salas.'
  );
});

// Listeners do Modal
ui.settingsButton.addEventListener("click", openModal);
ui.closeModalButton.addEventListener("click", closeModal);
ui.settingsModal.addEventListener("click", (event) => {
  // Fecha o modal apenas se o clique for no fundo (overlay)
  if (event.target === ui.settingsModal) {
    closeModal();
  }
});

// Listener para o controle de volume
ui.volumeSlider.addEventListener("input", (event) => {
  setVolume(event.target.value);
});

// Listener para iniciar a música com a primeira interação do usuário
document.body.addEventListener(
  "click",
  () => {
    if (musicas.lobby.paused) {
      tocarMusicaLobby();
    }
  },
  { once: true }
);

// --- LÓGICA DO SOCKET.IO E INICIALIZAÇÃO ---

// Recebe a lista de salas abertas do servidor
socket.on("listaDeSalas", (rooms) => {
  ui.roomList.innerHTML = "";

  if (!rooms || rooms.length === 0) {
    const emptyMessage = document.createElement("div");
    emptyMessage.className = "room-item inactive";
    emptyMessage.textContent = "Nenhuma sala aberta no momento...";
    ui.roomList.appendChild(emptyMessage);
    return;
  }

  // Cria um item para cada sala na lista
  rooms.forEach((room) => {
    const roomItem = document.createElement("div");
    roomItem.className = "room-item";

    const roomNameSpan = document.createElement("span");
    roomNameSpan.textContent = `${room.id} (${room.playerCount}/${
      room.maxPlayers || 5
    })`;

    const joinButton = document.createElement("button");
    joinButton.className = "join-button";
    joinButton.textContent = "Entrar";
    joinButton.onclick = () => joinRoom(room.id);

    roomItem.appendChild(roomNameSpan);
    roomItem.appendChild(joinButton);
    ui.roomList.appendChild(roomItem);
  });
});

// --- INICIALIZAÇÃO DA PÁGINA ---
function inicializarLobby() {
  // 1. Puxa o volume salvo do cache ou define um padrão (ex: 0.3)
  const savedVolume = localStorage.getItem("gameVolume") || "0.3";

  // 2. Define o valor inicial do slider e aplica o volume
  ui.volumeSlider.value = savedVolume;
  setVolume(savedVolume);

  // 3. Solicita a lista de salas ao servidor
  socket.emit("getRoomList");

  // 4. Tenta tocar a música (pode ser bloqueado pelo navegador)
  tocarMusicaLobby();
}

// Roda a função de inicialização quando o DOM estiver pronto
document.addEventListener("DOMContentLoaded", inicializarLobby);

// --- LÓGICA DO SOCKET.IO ---

// Quando o socket se conecta
socket.on("connect", () => {
  console.log("Conectado ao servidor Socket.IO");
});

// Quando o socket se desconecta
socket.on("disconnect", () => {
  console.log("Desconectado do servidor Socket.IO");
});
