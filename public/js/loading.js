// public/js/loading.js

console.log("[LOADING] Script loading.js carregado.");

const socket = io();

// --- MAPEAMENTO DA UI DA TELA DE ESPERA ---
const ui = {
  nomeSalaEspera: document.getElementById("nome-sala-espera"),
  listaJogadoresEspera: document.getElementById("lista-jogadores-espera"),
  btnIniciarJogo: document.getElementById("btn-iniciar-jogo"),
};

// --- DADOS DA SESSÃO ---
const nomeJogador = sessionStorage.getItem("playerName");
const idSala = sessionStorage.getItem("roomId");
const distancia = sessionStorage.getItem("roomDistance");

// Se não houver dados, o usuário provavelmente chegou aqui por engano.
if (!nomeJogador || !idSala || !distancia) {
  console.error(
    "[LOADING] Dados da sessão incompletos (nome, id ou distância). Voltando para o lobby."
  );
  alert("Erro ao carregar dados da sala. Por favor, tente entrar novamente.");
  window.location.href = "/";
} else {
  // --- LÓGICA DE CONEXÃO ---
  ui.nomeSalaEspera.textContent = idSala;

  // Emite 'entrarNaSala' com todos os dados, incluindo a distância.
  const data = { nomeJogador, idSala, distancia: parseInt(distancia, 10) };
  console.log(`[LOADING] Juntando-se à sala com os dados:`, data);
  socket.emit("entrarNaSala", data);
}

// --- EVENT LISTENERS DA UI ---
ui.btnIniciarJogo.addEventListener("click", () => {
  console.log(
    "[LOADING] Botão 'Iniciar Jogo' clicado. Emitindo evento para o servidor."
  );
  ui.btnIniciarJogo.disabled = true;
  ui.btnIniciarJogo.textContent = "Iniciando...";
  socket.emit("iniciarJogo", idSala);
});

// --- OUVINTES DO SOCKET.IO ---
socket.on("listaJogadores", (jogadores) => {
  console.log("[LOADING] Recebida lista de jogadores:", jogadores);
  ui.listaJogadoresEspera.innerHTML = "";
  jogadores.forEach((jogador) => {
    const li = document.createElement("li");
    li.textContent = jogador.nome + (jogador.isBot ? " (Bot)" : "");
    if (jogador.nome === nomeJogador) {
      li.classList.add("me");
    }
    ui.listaJogadoresEspera.appendChild(li);
  });
});

socket.on("updateState", (state) => {
  // Este evento sinaliza que o jogo começou
  if (state && state.estado === "JOGO") {
    console.log(
      "[LOADING] Estado do jogo mudou para 'JOGO'. Redirecionando para game.html..."
    );
    window.location.href = "game.html";
  }
});

socket.on("log", (message) => {
  console.log("[LOG DO SERVIDOR]", message);
});

socket.on("jogoEncerrado", (data) => {
  alert(data.message || "O jogo foi encerrado pelo servidor.");
  window.location.href = "/";
});

// Ouve um evento de erro caso a entrada na sala falhe (ex: sala cheia)
socket.on("erroEntrar", (data) => {
  console.error("[LOADING] Erro ao entrar na sala:", data.message);
  alert(`Não foi possível entrar na sala: ${data.message}`);
  window.location.href = "/";
});
