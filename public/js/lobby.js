// public/js/lobby.js

console.log("[LOBBY] Script lobby.js carregado.");
const socket = io();

// --- MAPEAMENTO DOS ELEMENTOS DA INTERFACE (UI) ---
const ui = {
  playerNameInput: document.getElementById("playerName"),
  roomNameInput: document.getElementById("roomName"),
  createRoomButton: document.querySelector(
    ".game-card .action-button:nth-of-type(1)"
  ),
  helpButton: document.getElementById("helpButton"),
  roomList: document.querySelector(".room-list"),

  // Modal de Configurações
  settingsButton: document.querySelector(".settings-button"),
  settingsModal: document.getElementById("settingsModal"),
  closeSettingsModalButton: document.querySelector(
    "#settingsModal .close-button"
  ),
  volumeSlider: document.getElementById("volumeSlider"),

  // Modal de Ajuda
  helpModal: document.getElementById("helpModal"),
  closeHelpModalButton: document.querySelector("#helpModal .close-button"),
};

// --- CONTROLE DE MÚSICA E SOM ---
const musicas = {
  lobby: new Audio("/sounds/lobby_music.mp3"),
};

function tocarMusicaLobby() {
  const musicaLobby = musicas.lobby;
  if (!musicaLobby) return;

  musicaLobby.loop = true;
  musicaLobby.volume = ui.volumeSlider.value;
  musicaLobby.play().catch(() => {
    console.warn(
      "Navegador bloqueou autoplay. A música iniciará com a interação do usuário."
    );
  });
}

function setVolume(volume) {
  const vol = parseFloat(volume);
  if (isNaN(vol)) return;
  musicas.lobby.volume = vol;
  localStorage.setItem("gameVolume", vol);
}

// --- FUNÇÕES AUXILIARES ---
function showError(element, message) {
  console.error("[LOBBY] Erro de UI:", message);
  element.style.borderColor = "red";
  element.placeholder = message;
  element.focus();
  setTimeout(() => {
    element.style.borderColor = "";
    element.placeholder = "";
  }, 3000);
}

/**
 * [FLUXO CORRIGIDO]
 * A função agora salva os dados na sessão do navegador e redireciona imediatamente.
 * A responsabilidade de emitir 'entrarNaSala' foi movida para loading.js.
 */
function joinRoom(roomId, roomDistance) {
  const playerName = ui.playerNameInput.value.trim();
  if (!playerName) {
    showError(ui.playerNameInput, "Digite seu nome para entrar!");
    return;
  }

  // Se a distância não for passada (clicando em "Entrar" de uma sala existente),
  // pegamos o valor do <select> (para o caso de "Criar Sala").
  const distanciaFinal =
    roomDistance || document.getElementById("roomDistance").value;

  console.log(
    `[LOBBY] Preparando para entrar na sala '${roomId}' com distância de ${distanciaFinal}km.`
  );

  // Salva os dados para a próxima página (partida.html) ler.
  localStorage.setItem("playerName", playerName);
  sessionStorage.setItem("playerName", playerName);
  sessionStorage.setItem("roomId", roomId);
  sessionStorage.setItem("roomDistance", distanciaFinal); // Salva a distância escolhida

  // Redireciona para a página de partida.
  console.log("[LOBBY] Redirecionando para partida.html...");
  window.location.href = "../pages/partida.html";
}

// --- EVENT LISTENERS (Ações do Usuário) ---
ui.createRoomButton.addEventListener("click", () => {
  console.log("[LOBBY] Botão 'Criar Sala' clicado.");
  const roomName = ui.roomNameInput.value.trim();
  if (!roomName) {
    showError(ui.roomNameInput, "Digite um nome para a sala!");
    return;
  }
  joinRoom(roomName);
});

ui.helpButton.addEventListener("click", () =>
  ui.helpModal.classList.remove("hidden")
);
ui.settingsButton.addEventListener("click", () =>
  ui.settingsModal.classList.remove("hidden")
);
ui.closeSettingsModalButton.addEventListener("click", () =>
  ui.settingsModal.classList.add("hidden")
);
ui.settingsModal.addEventListener("click", (event) => {
  if (event.target === ui.settingsModal)
    ui.settingsModal.classList.add("hidden");
});
ui.closeHelpModalButton.addEventListener("click", () =>
  ui.helpModal.classList.add("hidden")
);
ui.helpModal.addEventListener("click", (event) => {
  if (event.target === ui.helpModal) ui.helpModal.classList.add("hidden");
});
ui.volumeSlider.addEventListener("input", (event) =>
  setVolume(event.target.value)
);
document.body.addEventListener(
  "click",
  () => {
    if (musicas.lobby.paused) tocarMusicaLobby();
  },
  { once: true }
);

// --- LÓGICA DO SOCKET.IO ---
socket.on("connect", () => {
  console.log(
    "[LOBBY] Conectado ao servidor com sucesso! ID do Socket:",
    socket.id
  );
});

socket.on("listaDeSalas", (rooms) => {
  console.log("[LOBBY] Recebida lista de salas:", rooms);
  ui.roomList.innerHTML = "";
  if (!rooms || rooms.length === 0) {
    ui.roomList.innerHTML = `<div class="room-item inactive">Nenhuma sala aberta...</div>`;
    return;
  }

  rooms.forEach((room) => {
    const roomItem = document.createElement("div");
    roomItem.className = "room-item";
    const roomInfo = document.createElement("span");
    roomInfo.textContent = `${room.id} (${room.playerCount}/5) - ${room.distancia}km`;
    const joinButton = document.createElement("button");
    joinButton.className = "join-button";
    joinButton.textContent = "Entrar";
    joinButton.onclick = () => {
      console.log(`[LOBBY] Botão 'Entrar' clicado para a sala: ${room.id}`);
      joinRoom(room.id, room.distancia);
    };
    roomItem.appendChild(roomInfo);
    roomItem.appendChild(joinButton);
    ui.roomList.appendChild(roomItem);
  });
});

// --- INICIALIZAÇÃO DA PÁGINA ---
function inicializarLobby() {
  console.log("[LOBBY] Inicializando o lobby...");
  const savedVolume = localStorage.getItem("gameVolume") || "0.3";
  ui.volumeSlider.value = savedVolume;
  setVolume(savedVolume);

  const savedPlayerName = localStorage.getItem("playerName");
  if (savedPlayerName) {
    ui.playerNameInput.value = savedPlayerName;
  }

  tocarMusicaLobby();
}

document.addEventListener("DOMContentLoaded", inicializarLobby);
