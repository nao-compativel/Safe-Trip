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
};

// --- FUNÇÕES AUXILIARES ---

/**
 * Exibe uma notificação de erro simples para o usuário.
 * @param {HTMLElement} element O elemento do input que causou o erro.
 * @param {string} message A mensagem a ser exibida.
 */
function showError(element, message) {
  element.style.borderColor = "red";
  element.placeholder = message;
  element.focus();

  setTimeout(() => {
    element.style.borderColor = "";
    element.placeholder = ""; // Limpa o placeholder para não confundir
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

  // Redireciona para a página do jogo/espera
  window.location.href = "game.html"; // Certifique-se que o nome do arquivo está correto
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
    'Como Jogar:\n\n1. Digite seu nome de usuário.\n2. Para criar uma sala, digite o nome da sala e clique em "Criar Sala".\n3. Para entrar em uma sala existente, clique em "Entrar" na lista de "Salas Abertas".'
  );
});

// --- LÓGICA DO SOCKET.IO ---

// Recebe a lista de salas abertas do servidor
socket.on("listaDeSalas", (rooms) => {
  ui.roomList.innerHTML = ""; // Limpa a lista atual

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

// Solicita a lista de salas assim que a página carrega
socket.emit("getRoomList");
