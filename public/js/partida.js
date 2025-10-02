// js/partida.js
document.addEventListener("DOMContentLoaded", () => {
  console.log("[PARTIDA] Script unificado carregado e DOM pronto.");

  const socket = io();

  // --- CONTROLE DE SOM E MÚSICA ---
  const sons = {
    seuTurno: new Audio("/sounds/your_turn.mp3"),
    jogarCarta: new Audio("/sounds/card_play.mp3"),
    vitoria: new Audio("/sounds/game_win.mp3"),
    derrota: new Audio("/sounds/game_lose.mp3"),
    cartaEspecial: new Audio("/sounds/special_play.mp3"),
  };
  const musicaPartida = new Audio("/sounds/game_music.mp3");

  function playSound(soundKey) {
    const savedVolume = localStorage.getItem("gameVolume") || "0.3";
    if (sons[soundKey]) {
      sons[soundKey].volume = parseFloat(savedVolume);
      sons[soundKey].currentTime = 0;
      sons[soundKey].play().catch((e) => console.warn("Erro ao tocar som:", e));
    }
  }
  function playSoundSpecial(soundKey) {
    const soundToPlay = sons[soundKey];
    if (!soundToPlay) return;
    const savedVolume = localStorage.getItem("gameVolume") || "0.3";
    soundToPlay.volume = parseFloat(savedVolume);
    soundToPlay.currentTime = 0;
    const musicaEstavaTocando = !musicaPartida.paused;
    if (musicaEstavaTocando) {
      musicaPartida.pause();
    }
    const afterSoundEnds = () => {
      if (musicaEstavaTocando) {
        musicaPartida.play().catch(() => {});
      }
      soundToPlay.removeEventListener("ended", afterSoundEnds);
    };
    soundToPlay.addEventListener("ended", afterSoundEnds);
    soundToPlay.play().catch((e) => {
      console.warn("Erro ao tocar som especial:", e);
      afterSoundEnds();
    });
  }
  function tocarMusica() {
    const savedVolume = localStorage.getItem("gameVolume") || "0.3";
    musicaPartida.volume = parseFloat(savedVolume);
    musicaPartida.loop = true;
    musicaPartida.playbackRate = 1.0;
    musicaPartida
      .play()
      .catch(() => console.warn("Navegador bloqueou autoplay."));
  }

  // --- MAPEAMENTO DE EMOJIS E REGRAS ---
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
  const MAPA_PROBLEMAS = {
    sem_gasolina: { solucao: "gasolina" },
    pneu_furado: { solucao: "pneu_reserva" },
    acidente: { solucao: "reparos" },
  };

  // --- MAPEAMENTO COMPLETO DA UI ---
  const ui = {
    telaEspera: document.getElementById("tela-espera"),
    nomeSalaEspera: document.getElementById("nome-sala-espera"),
    listaJogadoresEspera: document.getElementById("lista-jogadores-espera"),
    btnIniciarJogo: document.getElementById("btn-iniciar-jogo"),
    telaJogo: document.getElementById("tela-jogo"),
    oponentesDiv: document.getElementById("oponentes"),
    pistaContainer: document.getElementById("pista-container"),
    hudJogador: document.getElementById("hud-jogador"),
    nomeJogadorHud: document.getElementById("nome-jogador-hud"),
    distanciaJogadorHud: document.getElementById("distancia-jogador-hud"),
    perigosJogadorHud: document.getElementById("perigos-jogador-hud"),
    segurancasJogadorHud: document.getElementById("segurancas-jogador-hud"),
    maoJogadorDiv: document.getElementById("mao-jogador"),
    logJogoDiv: document.getElementById("log-jogo"),
    timerBarContainer: document.getElementById("timer-bar-container"),
    timerBarInner: document.getElementById("timer-bar-inner"),
    turnoNotificacao: document.getElementById("turno-notificacao"),
    erroNotificacao: document.getElementById("erro-notificacao"),
    descarteDropzone: document.getElementById("descarte-dropzone"),
    btnVoltarLobby: document.getElementById("btn-voltar-lobby"),
  };

  // --- ESTADO LOCAL E DADOS DA SESSÃO ---
  let meuId = null;
  let jogadorAtualIdGlobal = null;
  let jogadorAnteriorId = null;
  let turnTimerInterval = null;
  let ultimoTurnDuration = 15000;
  let meuCarroEmoji = "🚙";
  let jogoFinalizado = false;
  let distanciasAnteriores = {};

  const nomeJogador = sessionStorage.getItem("playerName");
  const idSala = sessionStorage.getItem("roomId");
  const distancia = sessionStorage.getItem("roomDistance");

  // --- LÓGICA DE INICIALIZAÇÃO E DRAG & DROP ---
  document.body.className = "fase-espera";
  if (ui.descarteDropzone) {
    ui.descarteDropzone.addEventListener("dragover", (event) => {
      event.preventDefault();
      if (meuId === jogadorAtualIdGlobal) {
        ui.descarteDropzone.classList.add("drag-over");
      }
    });
    ui.descarteDropzone.addEventListener("dragleave", () => {
      ui.descarteDropzone.classList.remove("drag-over");
    });
    ui.descarteDropzone.addEventListener("drop", (event) => {
      event.preventDefault();
      ui.descarteDropzone.classList.remove("drag-over");
      if (meuId === jogadorAtualIdGlobal) {
        const indiceCarta = parseInt(
          event.dataTransfer.getData("text/plain"),
          10
        );
        const maoArray = Array.from(ui.maoJogadorDiv.children);
        const cardElement = maoArray[indiceCarta];
        if (cardElement) {
          animarCartaParaDescarte(cardElement);
          cardElement.style.opacity = "0";
          setTimeout(() => {
            socket.emit("descartarCarta", { indiceCarta: indiceCarta });
            playSound("jogarCarta");
          }, 600);
        }
      } else {
        mostrarNotificacaoEfeito("Espere seu turno para descartar!", "perigo");
      }
    });
  } else {
    console.error(
      "ERRO: Elemento 'descarte-dropzone' não foi encontrado no HTML!"
    );
  }

  if (!nomeJogador || !idSala || !distancia) {
    alert("Erro ao carregar dados da sala. Por favor, tente entrar novamente.");
    window.location.href = "/";
  } else {
    ui.nomeSalaEspera.textContent = idSala;
    const data = { nomeJogador, idSala, distancia: parseInt(distancia, 10) };
    socket.emit("entrarNaSala", data);
  }

  // --- EVENT LISTENERS DA UI ---
  ui.btnIniciarJogo.addEventListener("click", () => {
    ui.btnIniciarJogo.disabled = true;
    ui.btnIniciarJogo.textContent = "Iniciando...";
    socket.emit("iniciarJogo", idSala);
  });
  // O botão de voltar ao lobby do modal de fim de jogo foi removido junto com o modal
  // Se precisar dele em outro lugar, o listener é este:
  // if(ui.btnVoltarLobby) {
  //   ui.btnVoltarLobby.addEventListener("click", () => {
  //       window.location.href = "/";
  //   });
  // }

  // --- OUVINTES DO SOCKET.IO ---
  socket.on("connect", () => {
    meuId = socket.id;
  });

  socket.on("listaJogadores", (jogadores) => {
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

  socket.on("efeitoAplicado", (dados) => {
    if (dados.alvoId === meuId) {
      mostrarAnimacaoAtaque(dados.atacante.carroEmoji, dados.perigo);
      const perigoFormatado = dados.perigo.replace(/_/g, " ");
      const solucaoFormatada = dados.solucao.replace(/_/g, " ");
      const mensagem = `${dados.atacante.nome} te aplicou ${perigoFormatado}! Use: ${solucaoFormatada}.`;
      mostrarNotificacaoEfeito(mensagem, "perigo");
    }
  });

  socket.on("cartaSegurancaJogada", (dados) => {
    mostrarAnimacaoGlobal(dados.jogador, dados.carta);
    playSoundSpecial("cartaEspecial");
  });

  socket.on("updateState", (state) => {
    if (jogoFinalizado) return;
    if (!state || !state.me) return;

    const eu = state.me;
    meuCarroEmoji = eu.carroEmoji;
    jogadorAtualIdGlobal = state.jogadorAtualId;

    if (state.estado === "ENCERRADA" && state.vencedor) {
      jogoFinalizado = true;
      if (turnTimerInterval) clearInterval(turnTimerInterval);
      musicaPartida.pause();
      musicaPartida.playbackRate = 1.0;

      // Renderiza a tela uma última vez para mostrar a jogada final
      renderizarPista([eu, ...state.oponentes], eu.distanciaObjetivo);

      setTimeout(() => {
        const todosJogadores = [state.me, ...state.oponentes];
        todosJogadores.sort((a, b) => b.distancia - a.distancia);
        let rankingString = "\n\n-- RANKING FINAL --\n";
        todosJogadores.forEach((p, index) => {
          const medalha =
            index === 0 ? "🏆" : index === 1 ? "🥈" : index === 2 ? "🥉" : "";
          rankingString += `${index + 1}º: ${p.nome} (${
            p.distancia
          } km) ${medalha}\n`;
        });
        const venceu = state.vencedor.id === meuId;
        const mensagemPrincipal = venceu
          ? "PARABÉNS! VOCÊ VENCEU!"
          : `Fim de Jogo! O vencedor foi ${state.vencedor.nome}.`;
        playSound(venceu ? "vitoria" : "derrota");
        alert(mensagemPrincipal + rankingString);
        window.location.href = "/";
      }, 1200);
      return;
    }

    if (state.estado === "JOGO") {
      const progresso = eu.distancia / eu.distanciaObjetivo;
      if (progresso >= 0.95) {
        document.body.className = "fase-jogo fase-final";
        musicaPartida.playbackRate = 1.4;
      } else if (progresso >= 0.85) {
        document.body.className = "fase-jogo fase-perigo";
        musicaPartida.playbackRate = 1.25;
      } else if (progresso >= 0.65) {
        document.body.className = "fase-jogo fase-alerta";
        musicaPartida.playbackRate = 1.1;
      } else {
        if (document.body.className.indexOf("fase-jogo") === -1) {
          document.body.className = "fase-jogo";
        }
        musicaPartida.playbackRate = 1.0;
      }

      if (state.jogadorAtualId === meuId) {
        console.log(
          `%c[TIMER] Duração recebida: ${state.turnDuration}, Duração anterior: ${ultimoTurnDuration}`,
          "color: yellow; font-weight: bold;"
        );
        if (state.turnDuration < ultimoTurnDuration) {
          mostrarNotificacaoVelocidade();
        }
        ultimoTurnDuration = state.turnDuration;
      } else {
        ultimoTurnDuration = 15000;
      }
    }

    if (
      state.estado === "JOGO" &&
      ui.telaEspera.classList.contains("hidden") === false
    ) {
      tocarMusica();
      ui.telaEspera.classList.add("hidden");
      ui.telaJogo.classList.remove("hidden");
    }

    if (state.jogadorAtualId === meuId && jogadorAnteriorId !== meuId) {
      mostrarNotificacao(ui.turnoNotificacao);
      playSound("seuTurno");
    }
    jogadorAnteriorId = state.jogadorAtualId;

    renderizarOponentes(
      state.oponentes,
      state.jogadorAtualId,
      eu.distanciaObjetivo
    );
    renderizarPista([eu, ...state.oponentes], eu.distanciaObjetivo);
    renderizarHUD(eu, state.jogadorAtualId);
    renderizarMao(eu.mao, state.jogadorAtualId, eu);

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
  });

  socket.on("log", (message) => {
    const p = document.createElement("p");
    p.textContent = message;
    ui.logJogoDiv.prepend(p);
    if (ui.logJogoDiv.children.length > 20)
      ui.logJogoDiv.removeChild(ui.logJogoDiv.lastChild);
  });

  socket.on("erroJogada", (data) =>
    mostrarNotificacaoEfeito(data.message, "perigo")
  );

  socket.on("erroEntrar", (data) => {
    alert(`Não foi possível entrar na sala: ${data.message}`);
    window.location.href = "/";
  });

  // --- FUNÇÕES DE UI E RENDERIZAÇÃO ---

  function animarCartaParaDescarte(cardElement) {
    const cardRect = cardElement.getBoundingClientRect();
    const discardRect = ui.descarteDropzone.getBoundingClientRect();
    const clone = cardElement.cloneNode(true);
    clone.classList.remove("dragging");
    clone.classList.add("card-clone");
    clone.style.left = `${cardRect.left}px`;
    clone.style.top = `${cardRect.top}px`;
    clone.style.width = `${cardRect.width}px`;
    clone.style.height = `${cardRect.height}px`;
    const translateX =
      discardRect.left +
      discardRect.width / 2 -
      cardRect.left -
      cardRect.width / 2;
    const translateY =
      discardRect.top +
      discardRect.height / 2 -
      cardRect.top -
      cardRect.height / 2;
    document.body.appendChild(clone);
    clone.style.setProperty("--translateX", `${translateX}px`);
    clone.style.setProperty("--translateY", `${translateY}px`);
    setTimeout(() => {
      clone.remove();
    }, 600);
  }

  function animarJogadaDeCarta(cardElement, onAnimationEnd) {
    const cardRect = cardElement.getBoundingClientRect();
    const clone = cardElement.cloneNode(true);
    clone.classList.add("card-playing-animation");
    clone.style.left = `${cardRect.left}px`;
    clone.style.top = `${cardRect.top}px`;
    clone.style.width = `${cardRect.width}px`;
    clone.style.height = `${cardRect.height}px`;

    document.body.appendChild(clone);
    cardElement.classList.add("hidden-by-anim");

    setTimeout(() => {
      clone.remove();
      onAnimationEnd();
    }, 800);
  }

  function mostrarAnimacaoGlobal(jogador, carta) {
    const animacaoDiv = document.getElementById("animacao-global");
    if (!animacaoDiv) return;
    document.getElementById("global-jogador-emoji").textContent =
      jogador.carroEmoji;
    document.getElementById("global-carta-emoji").textContent =
      CARD_EMOJIS[carta.valor] || "🛡️";
    document.getElementById("global-carta-nome").textContent =
      carta.valor.replace(/_/g, " ");
    animacaoDiv.classList.remove("hidden");
    animacaoDiv.classList.add("show");
    setTimeout(() => {
      animacaoDiv.classList.remove("show");
      animacaoDiv.classList.add("hidden");
    }, 2500);
  }

  function mostrarAnimacaoAtaque(atacanteEmoji, perigo) {
    const animacaoDiv = document.getElementById("animacao-ataque");
    if (!animacaoDiv) return;
    const atacanteSpan = document.getElementById("atacante-emoji");
    const perigoSpan = document.getElementById("perigo-emoji");
    const alvoSpan = document.getElementById("alvo-emoji");
    atacanteSpan.textContent = atacanteEmoji;
    perigoSpan.textContent = CARD_EMOJIS[perigo] || "😡";
    alvoSpan.textContent = meuCarroEmoji;
    animacaoDiv.classList.remove("hidden");
    animacaoDiv.classList.add("show");
    setTimeout(() => {
      animacaoDiv.classList.remove("show");
      animacaoDiv.classList.add("hidden");
    }, 2500);
  }

  function mostrarNotificacaoVelocidade() {
    const container = document.getElementById("efeito-notificacao-container");
    if (!container) return;
    const notificacaoDiv = document.createElement("div");
    notificacaoDiv.className = `notificacao-efeito info`;
    notificacaoDiv.innerHTML = `⚡ O tempo está passando mais rápido!`;
    container.appendChild(notificacaoDiv);
    setTimeout(() => {
      notificacaoDiv.remove();
    }, 2500);
  }

  function escolherAlvo(oponentes, onAlvoEscolhido) {
    const modal = document.createElement("div");
    modal.id = "modal-alvo";
    let botoesHTML = '<h2>Escolha um Alvo</h2><div class="alvo-botoes">';
    oponentes.forEach((oponenteElement) => {
      const oponenteId = oponenteElement.id.replace("oponente-", "");
      const oponenteNome = oponenteElement
        .querySelector("h4")
        .textContent.split(" - ")[0];
      botoesHTML += `<button data-alvo-id="${oponenteId}">${oponenteNome}</button>`;
    });
    botoesHTML += `<button class="cancelar">Cancelar</button></div>`;
    modal.innerHTML = botoesHTML;
    document.body.appendChild(modal);
    modal.addEventListener("click", (event) => {
      const target = event.target;
      if (target.tagName === "BUTTON") {
        if (target.classList.contains("cancelar")) {
          document.body.removeChild(modal);
        } else {
          const alvoId = target.getAttribute("data-alvo-id");
          if (alvoId) {
            onAlvoEscolhido(alvoId);
            document.body.removeChild(modal);
          }
        }
      }
    });
  }

  function mostrarNotificacaoEfeito(mensagem, tipo = "info") {
    const container = document.getElementById("efeito-notificacao-container");
    const notificacaoDiv = document.createElement("div");
    notificacaoDiv.className = `notificacao-efeito ${tipo}`;
    notificacaoDiv.textContent = mensagem;
    container.appendChild(notificacaoDiv);
    setTimeout(() => {
      notificacaoDiv.remove();
    }, 4000);
  }

  function mostrarNotificacao(elemento, duracao = 1500) {
    elemento.classList.remove("hidden");
    elemento.classList.add("show");
    setTimeout(() => {
      elemento.classList.remove("show");
      setTimeout(() => elemento.classList.add("hidden"), 500);
    }, duracao);
  }

  function renderizarMao(mao, jogadorAtualId, eu) {
    ui.maoJogadorDiv.innerHTML = "";
    mao.forEach((carta, index) => {
      const cartaDiv = document.createElement("div");
      cartaDiv.className = `carta ${carta.tipo}`;
      cartaDiv.setAttribute("draggable", true);
      let isPlayable = true;
      if (meuId !== jogadorAtualId) {
        isPlayable = false;
      } else {
        switch (carta.tipo) {
          case "distancia":
            if (eu.precisa_do_siga || eu.perigos_ativos.length > 0)
              isPlayable = false;
            if (eu.limite_de_velocidade && carta.valor > 50) isPlayable = false;
            if (eu.distancia + carta.valor > eu.distanciaObjetivo)
              isPlayable = false;
            break;
          case "solucao":
            if (carta.valor === "siga") {
              if (!eu.precisa_do_siga) isPlayable = false;
            } else if (carta.valor === "fim_limite_velocidade") {
              if (!eu.limite_de_velocidade) isPlayable = false;
            } else {
              const problema = Object.keys(MAPA_PROBLEMAS).find(
                (p) => MAPA_PROBLEMAS[p].solucao === carta.valor
              );
              if (!problema || !eu.perigos_ativos.includes(problema))
                isPlayable = false;
            }
            break;
        }
      }
      if (!isPlayable) {
        cartaDiv.classList.add("carta-invalida");
      }

      const valorTexto = String(carta.valor).replace(/_/g, " ");
      const emoji = CARD_EMOJIS[carta.valor] || CARD_EMOJIS[carta.tipo] || "❓";
      cartaDiv.innerHTML = `<span class="emoji">${emoji}</span><span class="valor">${valorTexto}</span>`;

      cartaDiv.addEventListener("dragstart", (event) => {
        if (meuId !== jogadorAtualId) {
          event.preventDefault();
          return;
        }
        event.dataTransfer.setData("text/plain", index);
        event.dataTransfer.effectAllowed = "move";
        setTimeout(() => cartaDiv.classList.add("dragging"), 0);
      });
      cartaDiv.addEventListener("dragend", () => {
        cartaDiv.classList.remove("dragging");
      });

      cartaDiv.addEventListener("click", () => {
        if (!isPlayable) {
          mostrarNotificacaoEfeito(
            "Você não pode jogar esta carta agora!",
            "perigo"
          );
          return;
        }

        const acaoAposAnimacao = () => {
          if (carta.tipo === "perigo") {
            const oponentes = Array.from(
              document.querySelectorAll(".oponente")
            );
            if (oponentes.length > 0) {
              escolherAlvo(oponentes, (alvoId) => {
                socket.emit("jogarCarta", {
                  indiceCarta: index,
                  alvoId: alvoId,
                });
              });
            } else {
              mostrarNotificacaoEfeito(
                "Não há oponentes para atacar.",
                "perigo"
              );
            }
          } else {
            socket.emit("jogarCarta", { indiceCarta: index });
          }
        };

        animarJogadaDeCarta(cartaDiv, acaoAposAnimacao);
        playSound("jogarCarta");
      });
      ui.maoJogadorDiv.appendChild(cartaDiv);
    });
  }

  function renderizarOponentes(oponentes, jogadorAtualId, distanciaObjetivo) {
    ui.oponentesDiv.innerHTML = "";
    oponentes.forEach((oponente) => {
      const oponenteDiv = document.createElement("div");
      oponenteDiv.className = "oponente";
      oponenteDiv.id = `oponente-${oponente.id}`;
      if (oponente.id === jogadorAtualId) oponenteDiv.classList.add("turno");
      const kmFaltantes = distanciaObjetivo - oponente.distancia;
      let efeitosHTML = '<div class="oponente-efeitos">';
      if (oponente.precisa_do_siga)
        efeitosHTML += `<span class="efeito-icone" title="Parado">🛑</span>`;
      if (oponente.limite_de_velocidade)
        efeitosHTML += `<span class="efeito-icone" title="Limite de Velocidade">🐢</span>`;
      oponente.perigos_ativos.forEach((p) => {
        efeitosHTML += `<span class="efeito-icone" title="${p.replace(
          /_/g,
          " "
        )}">${CARD_EMOJIS[p] || "😡"}</span>`;
      });
      oponente.segurancas_ativas.forEach((s) => {
        efeitosHTML += `<span class="efeito-icone" title="${s.replace(
          /_/g,
          " "
        )}">${CARD_EMOJIS[s] || "🛡️"}</span>`;
      });
      efeitosHTML += "</div>";
      oponenteDiv.innerHTML = `<h4>${oponente.nome} ${oponente.carroEmoji}</h4><p>Faltam ${kmFaltantes} km</p><p>Cartas: ${oponente.cartasNaMao}</p>${efeitosHTML}`;
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
        carroDiv.innerHTML = `<span class="emoji-carro">${jogador.carroEmoji}</span><span class="emoji-reacao"></span>`;
        ui.pistaContainer.appendChild(carroDiv);
      }
      const progresso = (jogador.distancia / distanciaObjetivo) * 100;
      carroDiv.style.left = `calc(${Math.min(
        95,
        Math.max(5, progresso)
      )}% - 15px)`;

      const distanciaAtual = jogador.distancia;
      const distanciaAnterior = distanciasAnteriores[jogador.id] || 0;
      const emojiReacaoSpan = carroDiv.querySelector(".emoji-reacao");
      if (emojiReacaoSpan) {
        let reactionEmoji = "";
        if (jogador.precisa_do_siga) {
          reactionEmoji = "🚦";
        } else if (jogador.perigos_ativos.length > 0) {
          reactionEmoji = "😡";
        } else if (distanciaAtual > distanciaAnterior) {
          reactionEmoji = "😎";
        }
        if (reactionEmoji) {
          emojiReacaoSpan.textContent = reactionEmoji;
          emojiReacaoSpan.classList.add("show");
          setTimeout(() => {
            emojiReacaoSpan.classList.remove("show");
          }, 1500);
        }
      }
      distanciasAnteriores[jogador.id] = distanciaAtual;
    });
  }

  function renderizarHUD(jogador, jogadorAtualId) {
    ui.hudJogador.classList.toggle("turno", jogador.id === jogadorAtualId);
    ui.nomeJogadorHud.textContent = `${jogador.nome} ${jogador.carroEmoji}`;
    ui.distanciaJogadorHud.textContent = `${jogador.distancia} km (faltam ${
      jogador.distanciaObjetivo - jogador.distancia
    } km)`;

    ui.perigosJogadorHud.innerHTML = "";
    if (jogador.precisa_do_siga) {
      ui.perigosJogadorHud.innerHTML += `<div class="hud-status perigo">🚦 Parado <span class="hud-hint">(Use: Siga)</span></div>`;
    }
    if (jogador.limite_de_velocidade) {
      ui.perigosJogadorHud.innerHTML += `<div class="hud-status perigo">🐢 Lento <span class="hud-hint">(Use: Fim Limite Velocidade)</span></div>`;
    }
    jogador.perigos_ativos.forEach((p) => {
      const solucaoInfo = MAPA_PROBLEMAS[p];
      const dica = solucaoInfo
        ? `(Use: ${solucaoInfo.solucao.replace(/_/g, " ")})`
        : "";
      ui.perigosJogadorHud.innerHTML += `<div class="hud-status perigo">😡 ${p.replace(
        /_/g,
        " "
      )} <span class="hud-hint">${dica}</span></div>`;
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
    else if (percentage < 60)
      ui.timerBarInner.style.backgroundColor = "#ffa500";
    else ui.timerBarInner.style.backgroundColor = "#ffd700";
  }
});
