const socket = io();

const ui = {
  telaLogin: document.getElementById("tela-login"),
  telaEspera: document.getElementById("tela-espera"),
  telaJogo: document.getElementById("tela-jogo"),
  nomeJogadorInput: document.getElementById("nome-jogador"),
  idSalaInput: document.getElementById("id-sala"),
  distanciaInput: document.getElementById("distancia-km"),
  btnEntrar: document.getElementById("btn-entrar"),
  listaSalasDiv: document.getElementById("lista-salas"),
  btnIniciarJogo: document.getElementById("btn-iniciar-jogo"),
  nomeSalaEspera: document.getElementById("nome-sala-espera"),
  listaJogadoresEspera: document.getElementById("lista-jogadores-espera"),
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
  turnoNotificacao: document.getElementById("turno-notificacao"),
  velocidadeNotificacao: document.getElementById("velocidade-notificacao"),
  erroNotificacao: document.getElementById("erro-notificacao"), // Adicionado para erros
  btnAjuda: document.getElementById("btn-ajuda"),
  modalAjuda: document.getElementById("modal-ajuda"),
  btnFecharAjuda: document.getElementById("btn-fechar-ajuda"),
};

let minhaId = null;
let jogadorAnteriorId = null;
let modoDescarte = false;
let distanciaObjetivo = 700;
let distanciasAnteriores = {};
let turnTimerInterval = null;
let ultimoTurnDuration = 15000;

const sons = {
  yourTurn: new Audio("/sounds/your_turn.mp3"),
  cardPlay: new Audio("/sounds/card_play.mp3"),
  gameWin: new Audio("/sounds/game_win.mp3"),
  gameLose: new Audio("/sounds/game_lose.mp3"),
};
Object.values(sons).forEach((sound) => (sound.volume = 0.5));
const musicas = {
  lobby: new Audio("/sounds/lobby_music.mp3"),
  partida: new Audio("/sounds/game_music.mp3"),
};
Object.values(musicas).forEach((music) => {
  music.loop = true;
  music.volume = 0.3;
});

function playSound(soundKey) {
  if (sons[soundKey]) {
    sons[soundKey].currentTime = 0;
    sons[soundKey].play().catch((e) => console.warn("Erro ao tocar som:", e));
  }
}

function tocarMusica(nomeMusica) {
  Object.values(musicas).forEach((music) => music.pause());
  if (musicas[nomeMusica]) {
    musicas[nomeMusica].currentTime = 0;
    musicas[nomeMusica]
      .play()
      .catch(() => console.warn("Navegador bloqueou autoplay."));
  }
}

function mostrarNotificacaoTurno() {
  playSound("yourTurn");
  ui.turnoNotificacao.classList.remove("hidden");
  ui.turnoNotificacao.classList.add("show");
  setTimeout(() => {
    ui.turnoNotificacao.classList.remove("show");
    setTimeout(() => ui.turnoNotificacao.classList.add("hidden"), 500);
  }, 1500);
}

function mostrarNotificacaoVelocidade() {
  ui.velocidadeNotificacao.classList.remove("hidden");
  ui.velocidadeNotificacao.classList.add("show");
  setTimeout(() => {
    ui.velocidadeNotificacao.classList.remove("show");
    setTimeout(() => ui.velocidadeNotificacao.classList.add("hidden"), 500);
  }, 2000);
}

function mostrarErro(mensagem) {
  if (!ui.erroNotificacao) return;
  ui.erroNotificacao.textContent = mensagem;
  ui.erroNotificacao.classList.remove("hidden");
  ui.erroNotificacao.classList.add("show");
  setTimeout(() => {
    ui.erroNotificacao.classList.remove("show");
    setTimeout(() => ui.erroNotificacao.classList.add("hidden"), 500);
  }, 2500);
}

function escolherAlvo(oponentes, onAlvoEscolhido) {
  const modal = document.createElement("div");
  modal.id = "modal-alvo";
  modal.innerHTML = "<h2>Escolha um Alvo</h2>";
  oponentes.forEach((oponente) => {
    const btn = document.createElement("button");
    btn.textContent = oponente.nome;
    btn.onclick = () => {
      onAlvoEscolhido(oponente.id);
      document.body.removeChild(modal);
    };
    modal.appendChild(btn);
  });
  document.body.appendChild(modal);
}

function updateTurnTimer(startTime, totalDuration) {
  const timerBar = document.getElementById("timer-bar-inner");
  if (!timerBar) return;
  const elapsed = Date.now() - startTime;
  const remaining = totalDuration - elapsed;
  const percentage = Math.max(0, (remaining / totalDuration) * 100);
  timerBar.style.width = `${percentage}%`;
  timerBar.style.backgroundColor =
    percentage < 30 ? "#FF6347" : percentage < 60 ? "#FFA500" : "#FFD700";
}

document.body.addEventListener(
  "click",
  () => {
    if (musicas.lobby.paused && !ui.telaLogin.classList.contains("hidden")) {
      tocarMusica("lobby");
    }
  },
  { once: true }
);

ui.btnEntrar.addEventListener("click", () => {
  const nomeJogador = ui.nomeJogadorInput.value.trim();
  const idSala = ui.idSalaInput.value.trim();
  const distancia = parseInt(ui.distanciaInput.value, 10) || 700;
  if (nomeJogador && idSala) {
    socket.emit("entrarNaSala", { nomeJogador, idSala, distancia });
    ui.telaLogin.classList.add("hidden");
    ui.telaEspera.classList.remove("hidden");
    ui.nomeSalaEspera.textContent = idSala;
  }
});

ui.btnIniciarJogo.addEventListener("click", () => {
  socket.emit("iniciarJogo", ui.idSalaInput.value.trim());
});

ui.btnModoDescartar.addEventListener("click", () => {
  modoDescarte = !modoDescarte;
  ui.btnModoDescartar.classList.toggle("active", modoDescarte);
  logMessage(`Modo Descarte ${modoDescarte ? "ATIVADO" : "DESATIVADO"}.`);
});

ui.btnAjuda.addEventListener("click", () =>
  ui.modalAjuda.classList.remove("hidden")
);
if (ui.btnFecharAjuda) {
  ui.btnFecharAjuda.addEventListener("click", () =>
    ui.modalAjuda.classList.add("hidden")
  );
}
window.addEventListener("click", (event) => {
  if (event.target == ui.modalAjuda) ui.modalAjuda.classList.add("hidden");
});

socket.on("listaDeSalas", (salas) => {
  ui.listaSalasDiv.innerHTML = "";
  if (salas.length === 0) {
    ui.listaSalasDiv.innerHTML = "<p>Nenhuma sala aberta no momento.</p>";
    return;
  }
  salas.forEach((sala) => {
    const salaDiv = document.createElement("div");
    salaDiv.className = "sala-item";
    salaDiv.innerHTML = `<span>${sala.id} (${sala.playerCount} jogadores)</span> <span>${sala.distancia}km</span>`;
    salaDiv.onclick = () => {
      const nomeJogador = ui.nomeJogadorInput.value.trim();
      if (!nomeJogador) {
        ui.nomeJogadorInput.style.borderColor = "red";
        ui.nomeJogadorInput.placeholder =
          "Por favor, digite seu nome primeiro!";
        ui.nomeJogadorInput.focus();
        setTimeout(() => {
          ui.nomeJogadorInput.style.borderColor = "";
          ui.nomeJogadorInput.placeholder = "Seu nome";
        }, 2500);
        return;
      }
      socket.emit("entrarNaSala", {
        nomeJogador,
        idSala: sala.id,
        distancia: sala.distancia,
      });
      ui.telaLogin.classList.add("hidden");
      ui.telaEspera.classList.remove("hidden");
      ui.nomeSalaEspera.textContent = sala.id;
    };
    ui.listaSalasDiv.appendChild(salaDiv);
  });
});

socket.on("listaJogadores", (jogadores) => {
  ui.listaJogadoresEspera.innerHTML = "";
  jogadores.forEach((jogador) => {
    const li = document.createElement("li");
    li.textContent = jogador.nome;
    ui.listaJogadoresEspera.appendChild(li);
  });
});

socket.on("updateState", (state) => {
  if (!state) return;

  if (
    !ui.telaEspera.classList.contains("hidden") &&
    state.estado === "JOGANDO"
  ) {
    ui.telaEspera.classList.add("hidden");
    ui.telaJogo.classList.remove("hidden");
    tocarMusica("partida");
  }

  distanciaObjetivo = state.me.distanciaObjetivo || distanciaObjetivo;
  if (
    state.me.id === state.jogadorAtualId &&
    jogadorAnteriorId !== state.jogadorAtualId
  ) {
    mostrarNotificacaoTurno();
  }
  jogadorAnteriorId = state.jogadorAtualId;
  minhaId = state.me.id;
  modoDescarte = false;
  ui.btnModoDescartar.classList.remove("active");

  if (turnTimerInterval) clearInterval(turnTimerInterval);
  const timerContainer = document.getElementById("timer-bar-container");
  const turnDuration = state.turnDuration || 15000;

  if (
    state.estado === "JOGANDO" &&
    state.me.id === state.jogadorAtualId &&
    !state.me.isBot
  ) {
    timerContainer.style.display = "block";
    updateTurnTimer(state.turnStartTime, turnDuration);
    turnTimerInterval = setInterval(
      () => updateTurnTimer(state.turnStartTime, turnDuration),
      100
    );

    if (turnDuration < ultimoTurnDuration) {
      mostrarNotificacaoVelocidade();
    }
  } else {
    timerContainer.style.display = "none";
  }
  ultimoTurnDuration = turnDuration;

  const todosJogadores = [...state.oponentes, state.me];

  let liderId = null;
  let maxDistancia = -1;
  todosJogadores.forEach((p) => {
    if (p.distancia > maxDistancia) {
      maxDistancia = p.distancia;
      liderId = p.id;
    }
  });
  document.querySelectorAll(".carro-jogador").forEach((carro) => {
    const carroId = carro.id.replace("carro-", "");
    if (!todosJogadores.some((p) => p.id === carroId)) carro.remove();
  });

  todosJogadores.forEach((jogador) => {
    let carroDiv = document.getElementById(`carro-${jogador.id}`);
    if (!carroDiv) {
      carroDiv = document.createElement("div");
      carroDiv.id = `carro-${jogador.id}`;
      carroDiv.className = "carro-jogador";
      carroDiv.innerHTML = `<span class="emoji-reacao"></span>${jogador.carroEmoji}`;
      carroDiv.style.left = "5%";
      ui.pistaContainer.appendChild(carroDiv);
    }
    setTimeout(() => {
      const progress = jogador.distancia / distanciaObjetivo;
      carroDiv.style.left = `${Math.min(95, Math.max(5, progress * 100))}%`;
    }, 10);

    const distanciaAtual = jogador.distancia;
    const distanciaAnterior = distanciasAnteriores[jogador.id] || 0;

    // =============================================================
    // INÍCIO DO BLOCO CORRIGIDO
    // =============================================================
    if (distanciaAtual > distanciaAnterior) {
      carroDiv.classList.add("movendo");
      setTimeout(() => {
        carroDiv.classList.remove("movendo");
      }, 400);
    }
    // =============================================================
    // FIM DO BLOCO CORRIGIDO
    // =============================================================

    const emojiReacaoSpan = carroDiv.querySelector(".emoji-reacao");
    if (emojiReacaoSpan) {
      let reactionEmoji = "";
      if (jogador.perigos_ativos.length > 0) reactionEmoji = "😡";
      else if (jogador.precisa_do_siga) reactionEmoji = "🚦";
      else if (distanciaAtual > distanciaAnterior) reactionEmoji = "😎";
      if (reactionEmoji) {
        emojiReacaoSpan.textContent = reactionEmoji;
        emojiReacaoSpan.classList.add("show");
        setTimeout(() => emojiReacaoSpan.classList.remove("show"), 1500);
      }
    }
    distanciasAnteriores[jogador.id] = jogador.distancia;
    if (jogador.id === liderId && state.estado === "JOGANDO") {
      carroDiv.classList.add("lider");
    } else {
      carroDiv.classList.remove("lider");
    }
  });

  ui.oponentesDiv.innerHTML = "";
  state.oponentes.forEach((oponente) => {
    const oponenteDiv = document.createElement("div");
    oponenteDiv.className = "oponente";
    if (oponente.id === state.jogadorAtualId)
      oponenteDiv.classList.add("turno");
    const perigos =
      oponente.perigos_ativos.map((p) => p.replace(/_/g, " ")).join(", ") ||
      "Nenhum";
    const segurancas =
      oponente.segurancas_ativas.map((s) => s.replace(/_/g, " ")).join(", ") ||
      "Nenhuma";
    oponenteDiv.innerHTML = `
            <h4>${oponente.nome} ${oponente.carroEmoji} - ${oponente.distancia} km</h4>
            <p>Cartas: ${oponente.cartasNaMao}</p>
            <p style="color:salmon;">Perigos: ${perigos}</p>
            <p style="color:lightgreen;">Seguranças: ${segurancas}</p>
        `;
    ui.oponentesDiv.appendChild(oponenteDiv);
  });

  ui.hudJogador.classList.toggle("turno", state.me.id === state.jogadorAtualId);
  ui.nomeJogadorHud.innerHTML = `${state.me.nome} ${state.me.carroEmoji}`;
  ui.distanciaJogadorHud.textContent = `${state.me.distancia}`;

  ui.perigosJogadorHud.innerHTML = "";
  if (
    state.me.perigos_ativos.length > 0 ||
    state.me.limite_de_velocidade ||
    state.me.precisa_do_siga
  ) {
    if (state.me.precisa_do_siga)
      ui.perigosJogadorHud.innerHTML +=
        '<div class="hud-status perigo"><span>🚦</span> Parado</div>';
    if (state.me.limite_de_velocidade)
      ui.perigosJogadorHud.innerHTML +=
        '<div class="hud-status perigo"><span>🐢</span> Lento</div>';
    state.me.perigos_ativos.forEach((p) => {
      ui.perigosJogadorHud.innerHTML += `<div class="hud-status perigo"><span>😡</span> ${p.replace(
        /_/g,
        " "
      )}</div>`;
    });
  }

  ui.segurancasJogadorHud.innerHTML = "";
  if (state.me.segurancas_ativas.length > 0) {
    state.me.segurancas_ativas.forEach((s) => {
      ui.segurancasJogadorHud.innerHTML += `<div class="hud-status seguranca"><span>✨</span> ${s.replace(
        /_/g,
        " "
      )}</div>`;
    });
  }

  ui.maoJogadorDiv.innerHTML = "";
  state.me.mao.forEach((carta, index) => {
    const cartaDiv = document.createElement("div");
    cartaDiv.className = `carta ${carta.tipo}`;
    cartaDiv.innerHTML = `<span class="emoji">${
      carta.emoji || "❓"
    }</span><span class="valor">${String(carta.valor).replace(
      /_/g,
      " "
    )}</span>`;
    cartaDiv.addEventListener("click", () => {
      if (state.me.id !== state.jogadorAtualId) return;
      if (modoDescarte) {
        socket.emit("descartarCarta", { indiceCarta: index });
        playSound("cardPlay");
      } else {
        if (carta.tipo === "perigo") {
          if (state.oponentes.length > 0) {
            escolherAlvo(state.oponentes, (alvoId) => {
              socket.emit("jogarCarta", { indiceCarta: index, alvoId });
              playSound("cardPlay");
            });
          } else {
            logMessage("Não há oponentes para atacar.");
          }
        } else {
          socket.emit("jogarCarta", { indiceCarta: index });
          playSound("cardPlay");
        }
      }
    });
    ui.maoJogadorDiv.appendChild(cartaDiv);
  });

  if (state.estado === "FINALIZADO" && state.vencedor) {
    document
      .querySelectorAll(".turno")
      .forEach((el) => el.classList.remove("turno"));
    setTimeout(() => {
      if (state.vencedor.id === minhaId) {
        playSound("gameWin");
        alert(`PARABÉNS, ${state.vencedor.nome}! Você venceu a corrida! 🏆`);
      } else {
        playSound("gameLose");
        alert(
          `Fim de jogo! O vencedor é ${state.vencedor.nome}. Mais sorte na próxima!`
        );
      }
      tocarMusica("lobby");
      window.location.reload();
    }, 1200);
  }
});

function logMessage(mensagem) {
  const p = document.createElement("p");
  p.textContent = mensagem;
  ui.logJogoDiv.prepend(p);
  if (ui.logJogoDiv.children.length > 10) {
    ui.logJogoDiv.removeChild(ui.logJogoDiv.lastChild);
  }
}

socket.on("log", (mensagem) => {
  console.log("Evento 'log' recebido:", mensagem);

  if (typeof mensagem === "string" && mensagem.startsWith("Jogada Inválida:")) {
    mostrarErro(mensagem.replace("Jogada Inválida: ", ""));
  } else {
    logMessage(mensagem);
  }
});
