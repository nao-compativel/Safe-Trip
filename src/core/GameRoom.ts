import { Player } from "./Player";
import { Deck } from "./Deck";
import { Card, PerigoType, SegurancaType, SolucaoType } from "./Card";

type BotDifficulty = "FACIL" | "NORMAL" | "DIFICIL";

const MAX_PLAYERS = 5;
const MAPA_PROBLEMAS: Record<
  PerigoType,
  { solucao: SolucaoType; seguranca: SegurancaType }
> = {
  sem_gasolina: { solucao: "gasolina", seguranca: "tanque_cheio" },
  pneu_furado: { solucao: "pneu_reserva", seguranca: "pneu_inquebravel" },
  acidente: { solucao: "reparos", seguranca: "as_do_volante" },
  limite_velocidade: {
    solucao: "fim_limite_velocidade",
    seguranca: "passagem_livre",
  },
  pare: { solucao: "siga", seguranca: "passagem_livre" },
};

export class GameRoom {
  id: string;
  jogadores = new Map<string, Player>();
  baralho!: Deck;
  ordemTurno: string[] = [];
  jogadorAtualIdx = 0;
  estado: "AGUARDANDO" | "JOGANDO" | "FINALIZADO" = "AGUARDANDO";
  vencedor: Player | null = null;
  distanciaObjetivo: number;
  turnTimer: NodeJS.Timeout | null = null;
  turnStartTime: number = 0;
  currentTurnDuration: number = 15000;
  rooms: Map<string, GameRoom> = new Map();

  // --- CONSTANTES PARA A DINÂMICA DE VELOCIDADE ---
  readonly tempoMaximoTurno: number = 15000; // 15 segundos
  readonly tempoMinimoTurno: number = 5000; // 5 segundos
  readonly fatorExponencial: number = 2; // Aumentar para uma curva mais acentuada
  // --- [FIM] CONSTANTES ---

  public onStateChange: (message?: string) => void = () => {};

  constructor(id: string, distanciaObjetivo: number = 700) {
    this.id = id;
    this.distanciaObjetivo = distanciaObjetivo;
  }

  addBots(count: number) {
    const botNames = ["Herbie", "KITT", "Mach 5", "Relâmpago McQueen"];
    for (let i = 0; i < count; i++) {
      if (this.jogadores.size >= MAX_PLAYERS) break;
      const botId = `bot_${i}_${Date.now()}`;
      const botName = botNames[i % botNames.length];
      const bot = new Player(botId, botName, true);
      this.jogadores.set(botId, bot);
    }
  }

  private clearTurnTimer() {
    if (this.turnTimer) {
      clearTimeout(this.turnTimer);
      this.turnTimer = null;
    }
  }

  adicionarJogador(
    id: string,
    nome: string
  ): { success: boolean; message: string } {
    if (this.estado !== "AGUARDANDO") {
      return { success: false, message: "O jogo já começou." };
    }
    if (this.jogadores.size >= MAX_PLAYERS) {
      return {
        success: false,
        message: `A sala está cheia (limite de ${MAX_PLAYERS} jogadores).`,
      };
    }
    const novoJogador = new Player(id, nome);
    this.jogadores.set(id, novoJogador);
    return { success: true, message: "Jogador adicionado." };
  }

  iniciarJogo() {
    if (this.jogadores.size < 2 || this.estado === "JOGANDO") return;
    this.estado = "JOGANDO";
    this.baralho = new Deck(this.jogadores.size);
    this.ordemTurno = Array.from(this.jogadores.keys());
    for (let i = this.ordemTurno.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.ordemTurno[i], this.ordemTurno[j]] = [
        this.ordemTurno[j],
        this.ordemTurno[i],
      ];
    }

    const coresCarros = ["🚗", "🚕", "🚙", "🏎️", "🚓"];
    this.ordemTurno.forEach((playerId, index) => {
      const jogador = this.jogadores.get(playerId);
      if (jogador) {
        jogador.carroEmoji = coresCarros[index % coresCarros.length];
      }
    });

    this.jogadorAtualIdx = -1;
    this.jogadores.forEach((jogador) => {
      for (let i = 0; i < 6; i++) {
        const carta = this.baralho.comprar_carta();
        if (carta) jogador.mao.push(carta);
      }
    });
    this.proximoTurno();
  }

  getStateFor(socketId: string) {
    const jogador = this.jogadores.get(socketId);
    if (!jogador) return null;
    return {
      me: {
        ...jogador.publicState,
        mao: jogador.mao,
        distanciaObjetivo: this.distanciaObjetivo,
      },
      oponentes: Array.from(this.jogadores.values())
        .filter((p) => p.id !== socketId)
        .map((p) => p.publicState),
      jogadorAtualId: this.ordemTurno[this.jogadorAtualIdx],
      estado: this.estado,
      vencedor: this.vencedor?.publicState,
      turnStartTime: this.turnStartTime,
      turnDuration: this.currentTurnDuration,
    };
  }

  private handleIdleHuman(playerId: string) {
    const jogador = this.jogadores.get(playerId);
    if (!jogador || jogador.mao.length === 0) {
      this.proximoTurno();
      return;
    }

    this.onStateChange(
      `${jogador.nome} não jogou a tempo! Descartando uma carta...`
    );

    let indexToDiscard = jogador.mao.findIndex(
      (c) =>
        c.tipo === "distancia" &&
        jogador.distancia + (c.valor as number) > this.distanciaObjetivo
    );

    if (indexToDiscard === -1) {
      indexToDiscard = jogador.mao.findIndex((c) => c.tipo === "distancia");
    }

    if (indexToDiscard === -1) {
      indexToDiscard = 0;
    }

    this.descartarCarta(playerId, indexToDiscard);
  }

  public proximoTurno() {
    this.clearTurnTimer();
    if (this.estado === "FINALIZADO") {
      this.onStateChange();
      return;
    }
    const jogadorAnterior = this.ordemTurno[this.jogadorAtualIdx]
      ? this.jogadores.get(this.ordemTurno[this.jogadorAtualIdx])
      : null;
    if (
      jogadorAnterior &&
      jogadorAnterior.distancia >= this.distanciaObjetivo
    ) {
      this.estado = "FINALIZADO";
      this.vencedor = jogadorAnterior;
      this.onStateChange();
      return;
    }

    this.jogadorAtualIdx = (this.jogadorAtualIdx + 1) % this.ordemTurno.length;
    const proximoJogador = this.jogadores.get(
      this.ordemTurno[this.jogadorAtualIdx]
    )!;
    const novaCarta = this.baralho.comprar_carta();
    if (novaCarta) proximoJogador.mao.push(novaCarta);

    // --- LÓGICA DE TEMPO EXPONENCIAL ATUALIZADA ---
    if (!proximoJogador.isBot) {
      const progresso = Math.min(
        1,
        proximoJogador.distancia / this.distanciaObjetivo
      );

      const rangeTempo = this.tempoMaximoTurno - this.tempoMinimoTurno;
      const reducaoTempo =
        rangeTempo * Math.pow(progresso, this.fatorExponencial);

      this.currentTurnDuration = Math.max(
        this.tempoMinimoTurno,
        this.tempoMaximoTurno - reducaoTempo
      );
    } else {
      this.currentTurnDuration = 1000; // Tempo fixo para bots
    }
    // --- [FIM] LÓGICA ATUALIZADA ---

    this.turnStartTime = Date.now();
    this.onStateChange(`É a vez de ${proximoJogador.nome}.`);

    const timeoutCallback = () => {
      if (proximoJogador.isBot) {
        this.autoPlay(proximoJogador.id);
      } else {
        this.handleIdleHuman(proximoJogador.id);
      }
    };

    this.turnTimer = setTimeout(timeoutCallback, this.currentTurnDuration);
  }

  jogarCarta(
    socketId: string,
    indiceCarta: number,
    alvoId?: string
  ): { success: boolean; message: string } {
    if (socketId !== this.ordemTurno[this.jogadorAtualIdx]) {
      return { success: false, message: "Espere seu turno para jogar." };
    }
    const jogador = this.jogadores.get(socketId);
    if (!jogador) return { success: false, message: "Jogador não encontrado." };
    const carta = jogador.mao[indiceCarta];
    if (!carta) return { success: false, message: "Carta não encontrada." };

    if (!jogador.isBot && carta.tipo !== "seguranca") {
      this.clearTurnTimer();
    }

    let msg = "";

    switch (carta.tipo) {
      case "distancia":
        if (jogador.precisa_do_siga)
          return {
            success: false,
            message: "Motor desligado! Você precisa jogar uma carta Siga (🟢).",
          };
        if (jogador.perigos_ativos.size > 0)
          return {
            success: false,
            message: `Você tem um problema (${Array.from(
              jogador.perigos_ativos
            ).join(", ")})! Resolva-o primeiro.`,
          };
        if (jogador.limite_de_velocidade && (carta.valor as number) > 50)
          return {
            success: false,
            message: "Em velocidade reduzida (🐢)! Só até 50km.",
          };
        if (
          jogador.distancia + (carta.valor as number) >
          this.distanciaObjetivo
        )
          return {
            success: false,
            message: "Essa distância ultrapassa a linha de chegada.",
          };
        jogador.distancia += carta.valor as number;
        msg = `${jogador.nome} avança ${carta.valor} km! 🛣️`;
        break;
      case "perigo":
        const alvo = this.jogadores.get(alvoId!);
        if (!alvo)
          return { success: false, message: "Escolha um alvo para atacar." };
        const perigo = carta.valor as PerigoType;
        const imunidade = MAPA_PROBLEMAS[perigo].seguranca;
        if (alvo.segurancas_ativas.has(imunidade)) {
          msg = `Ataque bloqueado! ${alvo.nome} tem ${imunidade.replace(
            /_/g,
            " "
          )} ✨!`;
        } else {
          if (perigo === "limite_velocidade") alvo.limite_de_velocidade = true;
          else if (perigo === "pare") alvo.precisa_do_siga = true;
          else alvo.perigos_ativos.add(perigo);
          msg = `${jogador.nome} aplicou '${perigo.replace(/_/g, " ")}' em ${
            alvo.nome
          }! 😈`;
        }
        break;
      case "solucao":
        const solucao = carta.valor as SolucaoType;
        if (solucao === "siga") {
          if (!jogador.precisa_do_siga)
            return {
              success: false,
              message: "Sinal verde! Você já pode andar.",
            };
          jogador.precisa_do_siga = false;
          msg = `${jogador.nome} joga uma carta Siga (🟢) e acelera!`;
        } else if (solucao === "fim_limite_velocidade") {
          if (!jogador.limite_de_velocidade)
            return {
              success: false,
              message: "Você não está com limite de velocidade.",
            };
          jogador.limite_de_velocidade = false;
          jogador.precisa_do_siga = true;
          msg = `${jogador.nome} se livra do limite de velocidade (⚡)!`;
        } else {
          const problemaCorrespondente = Object.keys(MAPA_PROBLEMAS).find(
            (p) => MAPA_PROBLEMAS[p as PerigoType].solucao === solucao
          ) as PerigoType;
          if (!jogador.perigos_ativos.has(problemaCorrespondente))
            return {
              success: false,
              message: `Você não tem o problema '${problemaCorrespondente.replace(
                /_/g,
                " "
              )}' para resolver.`,
            };
          jogador.perigos_ativos.delete(problemaCorrespondente);
          jogador.precisa_do_siga = true;
          msg = `${
            jogador.nome
          } consertou o problema de '${problemaCorrespondente.replace(
            /_/g,
            " "
          )}'! 🛠️`;
        }
        break;
      case "seguranca":
        this.clearTurnTimer();
        const seguranca = carta.valor as SegurancaType;
        jogador.segurancas_ativas.add(seguranca);

        msg = `Imunidade! ${jogador.nome} joga ${seguranca.replace(
          /_/g,
          " "
        )} e joga de novo! ✨`;

        Object.entries(MAPA_PROBLEMAS).forEach(
          ([perigo, { seguranca: segurancaDoMapa }]) => {
            if (segurancaDoMapa === seguranca) {
              const perigoKey = perigo as PerigoType;
              if (perigoKey === "limite_velocidade")
                jogador.limite_de_velocidade = false;
              if (perigoKey === "pare") jogador.precisa_do_siga = false;
              if (jogador.perigos_ativos.has(perigoKey)) {
                jogador.perigos_ativos.delete(perigoKey);
              }
            }
          }
        );
        if (seguranca === "passagem_livre") {
          jogador.limite_de_velocidade = false;
          jogador.precisa_do_siga = false;
        }

        jogador.mao.splice(indiceCarta, 1);

        this.turnStartTime = Date.now();
        this.onStateChange(msg);

        const callback = () => {
          if (jogador.isBot) {
            this.autoPlay(jogador.id);
          } else {
            const humanCallback = () => this.handleIdleHuman(jogador.id);
            this.turnTimer = setTimeout(
              humanCallback,
              this.currentTurnDuration
            );
          }
        };

        if (jogador.isBot) {
          setTimeout(callback, 1000);
        } else {
          callback();
        }

        return { success: true, message: msg };
    }

    this.baralho.descarte.push(jogador.mao.splice(indiceCarta, 1)[0]);
    this.proximoTurno();
    return { success: true, message: msg };
  }

  descartarCarta(
    socketId: string,
    indiceCarta: number
  ): { success: boolean; message: string } {
    if (socketId !== this.ordemTurno[this.jogadorAtualIdx]) {
      return { success: false, message: "Espere seu turno para jogar." };
    }
    const jogador = this.jogadores.get(socketId);
    if (!jogador || indiceCarta >= jogador.mao.length)
      return { success: false, message: "Carta inválida." };
    if (!jogador.isBot) this.clearTurnTimer();
    const cartaDescartada = jogador.mao.splice(indiceCarta, 1)[0];
    this.baralho.descarte.push(cartaDescartada);
    const msg = `${jogador.nome} descartou ${String(
      cartaDescartada.valor
    ).replace(/_/g, " ")}.`;
    this.proximoTurno();
    return { success: true, message: msg };
  }

  autoPlay(playerId: string) {
    const jogador = this.jogadores.get(playerId);
    if (
      !jogador ||
      !jogador.isBot ||
      playerId !== this.ordemTurno[this.jogadorAtualIdx] ||
      this.estado !== "JOGANDO"
    ) {
      return;
    }

    this.onStateChange(`Bot ${jogador.nome} está jogando...`);

    setTimeout(() => {
      if (jogador.mao.length === 0) {
        this.proximoTurno();
        return;
      }

      let difficulty: BotDifficulty = "NORMAL";
      const humanPlayer = Array.from(this.jogadores.values()).find(
        (p) => !p.isBot
      );

      if (humanPlayer) {
        if (humanPlayer.distancia > jogador.distancia + 200) {
          difficulty = "DIFICIL";
        } else if (jogador.distancia > humanPlayer.distancia + 200) {
          difficulty = "FACIL";
        }
      }

      let acaoParaExecutar: {
        tipo: "JOGAR";
        indice: number;
        alvoId?: string;
      } | null = null;

      const safetyCardIndex = jogador.mao.findIndex(
        (c) => c.tipo === "seguranca"
      );
      if (safetyCardIndex > -1) {
        if (!(difficulty === "FACIL" && Math.random() < 0.5)) {
          acaoParaExecutar = { tipo: "JOGAR", indice: safetyCardIndex };
        }
      }

      if (!acaoParaExecutar) {
        const problemas = Array.from(jogador.perigos_ativos);
        if (problemas.length > 0) {
          const index = jogador.mao.findIndex(
            (c) =>
              c.tipo === "solucao" &&
              MAPA_PROBLEMAS[problemas[0]].solucao === c.valor
          );
          if (index > -1) acaoParaExecutar = { tipo: "JOGAR", indice: index };
        }
        if (!acaoParaExecutar && jogador.limite_de_velocidade) {
          const index = jogador.mao.findIndex(
            (c) => c.valor === "fim_limite_velocidade"
          );
          if (index > -1) acaoParaExecutar = { tipo: "JOGAR", indice: index };
        }
        if (!acaoParaExecutar && jogador.precisa_do_siga) {
          const index = jogador.mao.findIndex((c) => c.valor === "siga");
          if (index > -1) acaoParaExecutar = { tipo: "JOGAR", indice: index };
        }
      }

      if (!acaoParaExecutar) {
        const attackCardIndex = jogador.mao.findIndex(
          (c) => c.tipo === "perigo"
        );
        if (attackCardIndex > -1) {
          let alvosPotenciais = Array.from(this.jogadores.values()).filter(
            (p) => p.id !== playerId
          );
          if (alvosPotenciais.length > 0) {
            let alvoFinal = null;
            if (difficulty === "DIFICIL" && humanPlayer) {
              alvoFinal = humanPlayer;
            } else if (difficulty === "FACIL" && Math.random() < 0.6) {
              alvoFinal =
                alvosPotenciais[
                  Math.floor(Math.random() * alvosPotenciais.length)
                ];
            } else {
              alvoFinal = alvosPotenciais.sort(
                (a, b) => b.distancia - a.distancia
              )[0];
            }
            if (alvoFinal) {
              acaoParaExecutar = {
                tipo: "JOGAR",
                indice: attackCardIndex,
                alvoId: alvoFinal.id,
              };
            }
          }
        }
      }

      if (!acaoParaExecutar && jogador.podeAndar()) {
        const cartasDistancia = jogador.mao
          .map((c, i) => ({ ...c, originalIndex: i }))
          .filter(
            (c) =>
              c.tipo === "distancia" &&
              jogador.distancia + (c.valor as number) <=
                this.distanciaObjetivo &&
              (!jogador.limite_de_velocidade || (c.valor as number) <= 50)
          )
          .sort((a, b) => (b.valor as number) - (a.valor as number));
        if (cartasDistancia.length > 0) {
          acaoParaExecutar = {
            tipo: "JOGAR",
            indice: cartasDistancia[0].originalIndex,
          };
        }
      }

      if (acaoParaExecutar) {
        this.jogarCarta(
          playerId,
          acaoParaExecutar.indice,
          acaoParaExecutar.alvoId
        );
      } else {
        let indexToDiscard = -1;
        if (difficulty === "FACIL" && Math.random() < 0.3) {
          indexToDiscard = Math.floor(Math.random() * jogador.mao.length);
        } else {
          indexToDiscard = jogador.mao.findIndex(
            (c) =>
              c.tipo === "distancia" &&
              (c.valor as number) > 50 &&
              jogador.limite_de_velocidade
          );
          if (indexToDiscard === -1)
            indexToDiscard = jogador.mao.findIndex(
              (c) => c.tipo === "distancia"
            );
          if (indexToDiscard === -1)
            indexToDiscard = jogador.mao.findIndex((c) => c.tipo === "perigo");
          if (indexToDiscard === -1)
            indexToDiscard = jogador.mao.findIndex((c) => c.tipo === "solucao");
          if (indexToDiscard === -1) indexToDiscard = 0;
        }
        this.descartarCarta(playerId, indexToDiscard);
      }
    }, 1000);
  }

  public deleteRoom(id: string) {
    this.rooms.delete(id);
  }

  private cleanupInactiveRooms() {
    console.log("[Cleanup] Procurando por salas inativas...");
    const roomsToDelete: string[] = [];
    this.rooms.forEach((room, id) => {
      if (room.jogadores.size === 0) {
        roomsToDelete.push(id);
      }
    });

    if (roomsToDelete.length > 0) {
      console.log(
        `[Cleanup] Deletando ${roomsToDelete.length} salas inativas:`,
        roomsToDelete
      );
      roomsToDelete.forEach((id) => this.deleteRoom(id));
    }
  }
}
