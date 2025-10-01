// public/js/game.js

console.log("[GAME] Script game.js carregado.");

const socket = io();

// --- MAPEAMENTO DE EMOJIS PARA CADA CARTA ---
const CARD_EMOJIS = {
  distancia: "🛣️",
  pneu_furado: "💥",
  sem_gasolina: "⛽",
  acidente: "🚗💥",
  limite_velocidade: "🐢",
  pare: "🛑",
  pneu_reserva: "⚙️",
  gasolina: "⛽",
  reparos: "🛠️",
  fim_limite_velocidade: "⚡",
  siga: "🟢",
  tanque_cheio: "🛡️",
  pneu_inquebravel: "🛡️",
  as_do_volante: "🛡️",
  passagem_livre: "🛡️",
};

// --- MAPEAMENTO DA UI ---
const ui = {
  oponentesDiv: document.getElementById("oponentes"),
  pistaContainer: document.getElementById("pista-container"),
  hudJogador: document.getElementById("hud-jogador"),
  nomeJogadorHud: document.getElementById("nome-jogador-hud"),
  distanciaJogadorHud: document.getElementById("distancia-jogador-hud"),
  perigosJogadorHud: document.getElementById("perigos-jogador-hud"),
  segurancasJogadorHud: document.getElementById("segurancas-jogador-hud"),
  btnModoDescartar: document.getElementById("btn-modo-descartar"),
  maoJogadorDiv: document.getElementById("mao-jogador"),
  logJogoDiv: document.getElementById("log-jogo"),
  timerBarContainer: document.getElementById("timer-bar-container"),
  timerBarInner: document.getElementById("timer-bar-inner"),
  turnoNotificacao: document.getElementById("turno-notificacao"),
  erroNotificacao: document.getElementById("erro-notificacao"),
};

// --- CONTROLE DE SOM E MÚSICA ---
const sons = {
  seuTurno: new Audio("/sounds/your_turn.mp3"),
  jogarCarta: new Audio("/sounds/card_play.mp3"),
  vitoria: new Audio("/sounds/game_win.mp3"),
  derrota: new Audio("/sounds/game_lose.mp3"),
};
const musicaPartida = new Audio("/sounds/game_music.mp3");

function playSound(soundKey) {
  if (sons[soundKey]) {
    sons[soundKey].currentTime = 0;
    sons[soundKey].play().catch((e) => {});
  }
}
function tocarMusica() {
  musicaPartida.loop = true;
  musicaPartida.play().catch(() => {});
}

// --- ESTADO LOCAL ---
let meuId = null;
let jogadorAnteriorId = null;
let modoDescarte = false;
let turnTimerInterval = null;

// --- DADOS DA SESSÃO ---
const nomeJogador = sessionStorage.getItem("playerName");
const idSala = sessionStorage.getItem("roomId");
if (!nomeJogador || !idSala) window.location.href = "/";

// --- LÓGICA DE TIMEOUT DE RECONEXÃO ---
const connectionTimeout = setTimeout(() => {
  console.error(
    "[GAME] Timeout! Não recebeu 'updateState' do servidor. Voltando para o lobby."
  );
  alert(
    "Não foi possível reconectar à partida. A sala pode ter sido encerrada."
  );
  window.location.href = "/";
}, 5000); // 5 segundos de tolerância
console.log(
  "[GAME] Timeout de reconexão de 5s iniciado. Aguardando 'updateState'..."
);

// --- INICIALIZAÇÃO ---
const savedVolume = localStorage.getItem("gameVolume") || "0.3";
Object.values(sons).forEach((sound) => (sound.volume = savedVolume));
musicaPartida.volume = savedVolume;
tocarMusica();
console.log(`[GAME] Emitindo 'entrarNaSala' para a sala '${idSala}'`);
socket.emit("entrarNaSala", { nomeJogador, idSala });

// --- FUNÇÕES DE UI (Notificações, Modais) ---
function mostrarNotificacao(elemento, duracao = 1500) {
  elemento.classList.remove("hidden");
  elemento.classList.add("show");
  setTimeout(() => {
    elemento.classList.remove("show");
    setTimeout(() => elemento.classList.add("hidden"), 500);
  }, duracao);
}

function mostrarErro(mensagem) {
  ui.erroNotificacao.textContent = mensagem;
  mostrarNotificacao(ui.erroNotificacao, 2500);
}

function escolherAlvo(oponentes, onAlvoEscolhido) {
  const modal = document.createElement("div");
  modal.id = "modal-alvo";
  modal.innerHTML = "<h2>Escolha um Alvo</h2>";
  oponentes.forEach((oponente) => {
    const oponenteId = oponente.id.replace("oponente-", "");
    const oponenteNome = oponente
      .querySelector("h4")
      .textContent.split(" - ")[0];
    const btn = document.createElement("button");
    btn.textContent = oponenteNome;
    btn.onclick = () => {
      onAlvoEscolhido(oponenteId);
      document.body.removeChild(modal);
    };
    modal.appendChild(btn);
  });
  const cancelBtn = document.createElement("button");
  cancelBtn.textContent = "Cancelar";
  cancelBtn.style.backgroundColor = "#ff6347";
  cancelBtn.onclick = () => document.body.removeChild(modal);
  modal.appendChild(cancelBtn);
  document.body.appendChild(modal);
}

// --- FUNÇÕES DE RENDERIZAÇÃO ---
function renderizarMao(mao, jogadorAtualId) {
  ui.maoJogadorDiv.innerHTML = "";
  mao.forEach((carta, index) => {
    const cartaDiv = document.createElement("div");
    cartaDiv.className = `carta ${carta.tipo}`;
    if (meuId !== jogadorAtualId) cartaDiv.classList.add("disabled");
    const valorTexto = String(carta.valor).replace(/_/g, " ");
    const emoji = CARD_EMOJIS[carta.valor] || CARD_EMOJIS[carta.tipo] || "❓";
    cartaDiv.innerHTML = `<span class="emoji">${emoji}</span><span class="valor">${valorTexto}</span>`;
    cartaDiv.addEventListener("click", () => {
      if (meuId !== jogadorAtualId) return;
      playSound("jogarCarta");
      if (modoDescarte) {
        socket.emit("descartarCarta", { indiceCarta: index });
      } else {
        if (carta.tipo === "perigo") {
          const alvos = Array.from(document.querySelectorAll(".oponente"));
          if (alvos.length > 0) {
            escolherAlvo(alvos, (alvoId) => {
              socket.emit("jogarCarta", { indiceCarta: index, alvoId });
            });
          } else {
            mostrarErro("Não há oponentes para atacar.");
          }
        } else {
          socket.emit("jogarCarta", { indiceCarta: index });
        }
      }
    });
    ui.maoJogadorDiv.appendChild(cartaDiv);
  });
}

function renderizarOponentes(oponentes, jogadorAtualId) {
  ui.oponentesDiv.innerHTML = "";
  oponentes.forEach((oponente) => {
    const oponenteDiv = document.createElement("div");
    oponenteDiv.className = "oponente";
    oponenteDiv.id = `oponente-${oponente.id}`;
    if (oponente.id === jogadorAtualId) oponenteDiv.classList.add("turno");
    oponenteDiv.innerHTML = `<h4>${oponente.nome} ${oponente.carroEmoji}</h4><p>${oponente.distancia} km</p><p>Cartas: ${oponente.cartasNaMao}</p>`;
    ui.oponentesDiv.appendChild(oponenteDiv);
  });
}

function renderizarPista(jogadores, distanciaObjetivo) {
  document.querySelectorAll(".carro-jogador").forEach((carro) => {
    const carroId = carro.id.replace("carro-", "");
    if (!jogadores.some((p) => p.id === carroId)) carro.remove();
  });
  jogadores.forEach((jogador) => {
    let carroDiv = document.getElementById(`carro-${jogador.id}`);
    if (!carroDiv) {
      carroDiv = document.createElement("div");
      carroDiv.id = `carro-${jogador.id}`;
      carroDiv.className = "carro-jogador";
      carroDiv.textContent = jogador.carroEmoji;
      ui.pistaContainer.appendChild(carroDiv);
    }
    const progresso = (jogador.distancia / distanciaObjetivo) * 100;
    carroDiv.style.left = `calc(${Math.min(
      95,
      Math.max(5, progresso)
    )}% - 15px)`;
  });
}

function renderizarHUD(jogador, jogadorAtualId) {
  ui.hudJogador.classList.toggle("turno", jogador.id === jogadorAtualId);
  ui.nomeJogadorHud.textContent = `${jogador.nome} ${jogador.carroEmoji}`;
  ui.distanciaJogadorHud.textContent = jogador.distancia;
  ui.perigosJogadorHud.innerHTML = "";
  if (jogador.precisa_do_siga)
    ui.perigosJogadorHud.innerHTML += `<div class="hud-status perigo">🚦 Parado</div>`;
  if (jogador.limite_de_velocidade)
    ui.perigosJogadorHud.innerHTML += `<div class="hud-status perigo">🐢 Lento</div>`;
  jogador.perigos_ativos.forEach((p) => {
    ui.perigosJogadorHud.innerHTML += `<div class="hud-status perigo">😡 ${p.replace(
      /_/g,
      " "
    )}</div>`;
  });
  ui.segurancasJogadorHud.innerHTML = "";
  jogador.segurancas_ativas.forEach((s) => {
    ui.segurancasJogadorHud.innerHTML += `<div class="hud-status seguranca">✨ ${s.replace(
      /_/g,
      " "
    )}</div>`;
  });
}

function updateTurnTimer(startTime, totalDuration) {
  const elapsed = Date.now() - startTime;
  const remaining = totalDuration - elapsed;
  const percentage = Math.max(0, (remaining / totalDuration) * 100);
  ui.timerBarInner.style.width = `${percentage}%`;
  if (percentage < 30) ui.timerBarInner.style.backgroundColor = "#ff6347";
  else if (percentage < 60) ui.timerBarInner.style.backgroundColor = "#ffa500";
  else ui.timerBarInner.style.backgroundColor = "#ffd700";
}

// --- EVENT LISTENER DA UI ---
ui.btnModoDescartar.addEventListener("click", () => {
  modoDescarte = !modoDescarte;
  ui.btnModoDescartar.classList.toggle("active", modoDescarte);
});

// --- OUVINTES DO SOCKET.IO ---
socket.on("connect", () => {
  meuId = socket.id;
  console.log("[GAME] Conectado com ID:", meuId);
});

socket.on("updateState", (state) => {
  clearTimeout(connectionTimeout);
  if (!state || !state.me)
    return console.warn("[GAME] 'updateState' inválido recebido.");
  console.log("[GAME] 'updateState' recebido:", state);

  const eu = state.me;
  if (state.jogadorAtualId === meuId && jogadorAnteriorId !== meuId) {
    console.log("[GAME] É o meu turno!");
    mostrarNotificacao(ui.turnoNotificacao);
    playSound("seuTurno");
  }
  jogadorAnteriorId = state.jogadorAtualId;

  renderizarOponentes(state.oponentes, state.jogadorAtualId);
  renderizarPista([eu, ...state.oponentes], eu.distanciaObjetivo);
  renderizarHUD(eu, state.jogadorAtualId);
  renderizarMao(eu.mao, state.jogadorAtualId);

  if (turnTimerInterval) clearInterval(turnTimerInterval);
  if (state.estado === "JOGO" && state.jogadorAtualId === meuId) {
    ui.timerBarContainer.style.display = "block";
    updateTurnTimer(state.turnStartTime, state.turnDuration);
    turnTimerInterval = setInterval(
      () => updateTurnTimer(state.turnStartTime, state.turnDuration),
      100
    );
  } else {
    ui.timerBarContainer.style.display = "none";
  }

  if (state.estado === "ENCERRADA" && state.vencedor) {
    musicaPartida.pause();
    setTimeout(() => {
      if (state.vencedor.id === meuId) {
        playSound("vitoria");
        alert(`PARABÉNS! Você venceu! 🏆`);
      } else {
        playSound("derrota");
        alert(`Fim de jogo! O vencedor é ${state.vencedor.nome}.`);
      }
      window.location.href = "/";
    }, 500);
  }
});

socket.on("log", (mensagem) => {
  console.log("[LOG DO SERVIDOR]", mensagem);
  const p = document.createElement("p");
  p.textContent = mensagem;
  ui.logJogoDiv.prepend(p);
  if (ui.logJogoDiv.children.length > 20)
    ui.logJogoDiv.removeChild(ui.logJogoDiv.lastChild);
});

socket.on("erroJogada", (data) => {
  console.error("[GAME] Erro de jogada:", data.message);
  mostrarErro(data.message);
});

socket.on("jogoEncerrado", (data) => {
  alert(data.message || "O jogo foi encerrado pelo servidor.");
  window.location.href = "/";
});

socket.on("disconnect", () => {
  console.warn("[GAME] Desconectado do servidor.");
  mostrarErro("Você foi desconectado. Tentando reconectar...");
});

socket.on("reconnect", () => {
  console.log("[GAME] Reconectado ao servidor!");
  mostrarErro("Reconectado!"); // Mostra uma notificação de sucesso
  // Informa ao servidor que estamos de volta na sala
  socket.emit("entrarNaSala", { nomeJogador, idSala });
});
