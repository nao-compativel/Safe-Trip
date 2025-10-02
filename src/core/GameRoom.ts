// src/core/GameRoom.ts
import { Player } from "./Player";
import { Deck } from "./Deck";
import { Card, PerigoType, SegurancaType, SolucaoType } from "./Card";

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

export type RoomState = "AGUARDANDO" | "JOGO" | "ENCERRADA";

export class GameRoom {
  id: string;
  jogadores = new Map<string, Player>();
  baralho!: Deck;
  ordemTurno: string[] = [];
  jogadorAtualIdx = 0;
  estado: RoomState = "AGUARDANDO";
  vencedor: Player | null = null;
  distanciaObjetivo: number;
  turnTimer: NodeJS.Timeout | null = null;
  turnStartTime: number = 0;
  currentTurnDuration: number = 15000;

  public onStateChange: (message?: string) => void = () => {};

  constructor(id: string, distanciaObjetivo: number = 700) {
    this.id = id;
    this.distanciaObjetivo = distanciaObjetivo;
  }

  adicionarJogador(
    id: string,
    nome: string
  ): { success: boolean; message: string; jogador?: Player } {
    if (this.estado !== "AGUARDANDO") {
      return { success: false, message: "O jogo já começou." };
    }
    if (this.jogadores.size >= MAX_PLAYERS) {
      return {
        success: false,
        message: `A sala está cheia (limite de ${MAX_PLAYERS} jogadores).`,
      };
    }
    const jogador = new Player(id, nome);
    this.jogadores.set(id, jogador);
    return { success: true, message: "Jogador adicionado.", jogador };
  }

  addBots(count: number) {
    const botNames = ["Herbie", "KITT", "Mach 5", "Relâmpago McQueen"];
    for (let i = 0; i < count; i++) {
      if (this.jogadores.size >= MAX_PLAYERS) break;
      const botId = `bot_${i}_${Date.now()}`;
      const result = this.adicionarJogador(
        botId,
        botNames[i % botNames.length]
      );
      if (result.jogador) {
        result.jogador.isBot = true;
      }
    }
  }

  removerJogador(id: string) {
    const jogador = this.jogadores.get(id);
    if (!jogador) return;

    this.jogadores.delete(id);
    this.onStateChange?.(`${jogador.nome} saiu da sala.`);
    const indexNaOrdem = this.ordemTurno.indexOf(id);
    if (indexNaOrdem > -1) {
      this.ordemTurno.splice(indexNaOrdem, 1);
      if (this.estado === "JOGO" && this.ordemTurno.length > 0) {
        if (this.jogadorAtualIdx >= indexNaOrdem && this.jogadorAtualIdx > 0) {
          this.jogadorAtualIdx--;
        }
      }
    }
  }

  iniciarJogo() {
    if (this.jogadores.size < 1 || this.estado === "JOGO") return;
    this.estado = "JOGO";
    this.baralho = new Deck(this.jogadores.size);
    this.ordemTurno = Array.from(this.jogadores.keys()).sort(
      () => Math.random() - 0.5
    );

    const coresCarros = ["🚗", "🚕", "🚙", "🏎️", "🚓"];
    this.ordemTurno.forEach((playerId, index) => {
      const jogador = this.jogadores.get(playerId);
      if (jogador) {
        jogador.carroEmoji = coresCarros[index % coresCarros.length];
        for (let i = 0; i < 6; i++) {
          const carta = this.baralho.comprar_carta();
          if (carta) jogador.mao.push(carta);
        }
      }
    });
    this.jogadorAtualIdx = -1;
    this.proximoTurno();
  }

  proximoTurno() {
    this.clearTurnTimer();

    if (this.ordemTurno.length === 0) {
      this.estado = "ENCERRADA";
      this.onStateChange?.("Jogo encerrado por falta de jogadores.");
      return;
    }

    const jogadorAnterior = this.jogadores.get(
      this.ordemTurno[this.jogadorAtualIdx]
    );
    if (
      jogadorAnterior &&
      jogadorAnterior.distancia >= this.distanciaObjetivo
    ) {
      this.estado = "ENCERRADA";
      this.vencedor = jogadorAnterior;
      this.onStateChange?.(`${jogadorAnterior.nome} venceu a corrida!`);
      return;
    }

    this.jogadorAtualIdx = (this.jogadorAtualIdx + 1) % this.ordemTurno.length;
    const proximoJogador = this.jogadores.get(
      this.ordemTurno[this.jogadorAtualIdx]
    );

    if (!proximoJogador) {
      if (this.ordemTurno.length > 0) this.proximoTurno();
      return;
    }

    const novaCarta = this.baralho.comprar_carta();
    if (novaCarta) proximoJogador.mao.push(novaCarta);

    const progresso = proximoJogador.distancia / this.distanciaObjetivo;
    if (!proximoJogador.isBot) {
      if (progresso >= 0.9) {
        this.currentTurnDuration = 3000; // 3 segundos (Rush Final)
      } else if (progresso >= 0.85) {
        this.currentTurnDuration = 7000; // 7 segundos
      } else if (progresso >= 0.65) {
        this.currentTurnDuration = 10000; // 10 segundos
      } else {
        this.currentTurnDuration = 15000; // 15 segundos
      }
    } else {
      this.currentTurnDuration = 2000;
    }

    this.turnStartTime = Date.now();
    this.onStateChange(`É a vez de ${proximoJogador.nome}.`);

    this.turnTimer = setTimeout(() => {
      if (proximoJogador.isBot) {
        this.autoPlay(proximoJogador.id);
      } else {
        this.handleIdleHuman(proximoJogador.id);
      }
    }, this.currentTurnDuration);
  }

  jogarCarta(
    socketId: string,
    indiceCarta: number,
    alvoId?: string
  ): { success: boolean; message: string; acao?: any } {
    if (socketId !== this.ordemTurno[this.jogadorAtualIdx]) {
      console.warn(
        `[JOGADA INVÁLIDA] Tentativa de jogada por ${
          this.jogadores.get(socketId)?.nome
        } fora do turno. Turno atual é de ${
          this.jogadores.get(this.ordemTurno[this.jogadorAtualIdx])?.nome
        }.`
      );
      return { success: false, message: "Espere seu turno para jogar." };
    }

    const jogador = this.jogadores.get(socketId);
    if (!jogador) return { success: false, message: "Jogador não encontrado." };
    const carta = jogador.mao[indiceCarta];
    if (!carta) return { success: false, message: "Carta não encontrada." };

    this.clearTurnTimer();
    let msg = "";
    let acaoParaEmitir: any = null;

    switch (carta.tipo) {
      case "distancia": {
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
      }
      case "perigo": {
        const alvo = this.jogadores.get(alvoId!);
        if (!alvo) return { success: false, message: "Alvo inválido." };
        const perigo = carta.valor as PerigoType;
        const { solucao, seguranca } = MAPA_PROBLEMAS[perigo];

        if (alvo.segurancas_ativas.has(seguranca)) {
          msg = `Ataque bloqueado! ${alvo.nome} tem ${seguranca.replace(
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

          acaoParaEmitir = {
            evento: "efeitoAplicado",
            dados: {
              atacante: { nome: jogador.nome, carroEmoji: jogador.carroEmoji },
              alvoId: alvo.id,
              perigo: perigo,
              solucao: solucao,
            },
          };
        }
        break;
      }
      case "solucao": {
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
          msg = `${jogador.nome} se livra do limite de velocidade (⚡)!`;
        } else {
          const problema = (Object.keys(MAPA_PROBLEMAS) as PerigoType[]).find(
            (p) => MAPA_PROBLEMAS[p].solucao === solucao
          );
          if (!problema || !jogador.perigos_ativos.has(problema))
            return {
              success: false,
              message: `Você não tem o problema '${problema?.replace(
                /_/g,
                " "
              )}' para resolver.`,
            };
          jogador.perigos_ativos.delete(problema);
          msg = `${jogador.nome} consertou o problema de '${problema.replace(
            /_/g,
            " "
          )}'! 🛠️`;
        }
        break;
      }
      case "seguranca": {
        const seguranca = carta.valor as SegurancaType;
        jogador.segurancas_ativas.add(seguranca);
        Object.entries(MAPA_PROBLEMAS).forEach(
          ([perigo, { seguranca: segurancaDoMapa }]) => {
            if (segurancaDoMapa === seguranca) {
              const perigoKey = perigo as PerigoType;
              if (perigoKey === "limite_velocidade")
                jogador.limite_de_velocidade = false;
              if (perigoKey === "pare") jogador.precisa_do_siga = false;
              jogador.perigos_ativos.delete(perigoKey);
            }
          }
        );
        msg = `${jogador.nome} joga ${seguranca.replace(
          /_/g,
          " "
        )} e ganha imunidade! ✨ (Joga de novo)`;
        acaoParaEmitir = {
          evento: "cartaSegurancaJogada",
          dados: {
            jogador: { nome: jogador.nome, carroEmoji: jogador.carroEmoji },
            carta: { valor: seguranca },
          },
        };
        this.baralho.descarte.push(jogador.mao.splice(indiceCarta, 1)[0]);
        this.onStateChange(msg);
        this.turnStartTime = Date.now();
        this.turnTimer = setTimeout(() => {
          if (jogador.isBot) this.autoPlay(socketId);
          else this.handleIdleHuman(socketId);
        }, this.currentTurnDuration);
        return { success: true, message: msg, acao: acaoParaEmitir };
      }
    }

    this.baralho.descarte.push(jogador.mao.splice(indiceCarta, 1)[0]);
    this.onStateChange(msg);
    this.proximoTurno();
    return { success: true, message: msg, acao: acaoParaEmitir };
  }

  descartarCarta(socketId: string, indiceCarta: number) {
    if (socketId !== this.ordemTurno[this.jogadorAtualIdx]) {
      return;
    }
    const jogador = this.jogadores.get(socketId);
    if (!jogador || !jogador.mao[indiceCarta]) return;

    this.clearTurnTimer();
    const cartaDescartada = jogador.mao.splice(indiceCarta, 1)[0];
    this.baralho.descarte.push(cartaDescartada);
    this.onStateChange(`${jogador.nome} descartou uma carta.`);
    this.proximoTurno();
  }

  public forceTurnFor(playerId: string): boolean {
    if (this.estado !== "JOGO") return false;
    const playerIndex = this.ordemTurno.indexOf(playerId);
    if (playerIndex === -1) return false;

    this.clearTurnTimer();
    this.jogadorAtualIdx = playerIndex - 1;
    if (this.jogadorAtualIdx < 0) {
      this.jogadorAtualIdx = this.ordemTurno.length - 1;
    }
    this.proximoTurno();
    return true;
  }

  private handleIdleHuman(playerId: string) {
    this.clearTurnTimer();
    if (playerId !== this.ordemTurno[this.jogadorAtualIdx]) {
      return;
    }
    const jogador = this.jogadores.get(playerId);
    if (!jogador) {
      this.proximoTurno();
      return;
    }
    this.onStateChange(
      `${jogador.nome} não jogou a tempo! Descartando uma carta...`
    );
    if (jogador.mao.length > 0) {
      const cartaDescartada = jogador.mao.splice(0, 1)[0];
      this.baralho.descarte.push(cartaDescartada);
    }
    this.proximoTurno();
  }

  private autoPlay(playerId: string) {
    const jogador = this.jogadores.get(playerId);
    if (
      !jogador ||
      !jogador.isBot ||
      playerId !== this.ordemTurno[this.jogadorAtualIdx]
    ) {
      return;
    }
    setTimeout(() => {
      if (
        this.estado !== "JOGO" ||
        playerId !== this.ordemTurno[this.jogadorAtualIdx]
      )
        return;
      if (jogador.mao.length === 0) {
        this.proximoTurno();
        return;
      }
      let acao:
        | { tipo: "JOGAR"; indice: number; alvoId?: string }
        | { tipo: "DESCARTAR"; indice: number }
        | null = null;
      if (!jogador.podeAndar()) {
        if (jogador.precisa_do_siga) {
          const index = jogador.mao.findIndex((c) => c.valor === "siga");
          if (index > -1) acao = { tipo: "JOGAR", indice: index };
        } else {
          const problema = Array.from(jogador.perigos_ativos)[0];
          const solucao = MAPA_PROBLEMAS[problema]?.solucao;
          if (solucao) {
            const index = jogador.mao.findIndex((c) => c.valor === solucao);
            if (index > -1) acao = { tipo: "JOGAR", indice: index };
          }
        }
      }
      if (!acao) {
        const index = jogador.mao.findIndex((c) => c.tipo === "seguranca");
        if (index > -1) acao = { tipo: "JOGAR", indice: index };
      }
      if (!acao && jogador.podeAndar()) {
        const melhoresCartasDistancia = jogador.mao
          .map((c, i) => ({ ...c, originalIndex: i }))
          .filter(
            (c) =>
              c.tipo === "distancia" &&
              (!jogador.limite_de_velocidade || (c.valor as number) <= 50) &&
              jogador.distancia + (c.valor as number) <= this.distanciaObjetivo
          )
          .sort((a, b) => (b.valor as number) - (a.valor as number));
        if (melhoresCartasDistancia.length > 0) {
          acao = {
            tipo: "JOGAR",
            indice: melhoresCartasDistancia[0].originalIndex,
          };
        }
      }
      if (!acao) {
        const indexPerigo = jogador.mao.findIndex((c) => c.tipo === "perigo");
        if (indexPerigo > -1) {
          const alvos = Array.from(this.jogadores.values())
            .filter((p) => p.id !== playerId && !p.isBot)
            .sort((a, b) => b.distancia - a.distancia);
          if (alvos.length > 0) {
            acao = { tipo: "JOGAR", indice: indexPerigo, alvoId: alvos[0].id };
          }
        }
      }
      if (!acao) {
        acao = { tipo: "DESCARTAR", indice: 0 };
      }
      if (acao.tipo === "JOGAR") {
        this.jogarCarta(playerId, acao.indice, acao.alvoId);
      } else if (acao.tipo === "DESCARTAR") {
        this.descartarCarta(playerId, acao.indice);
      }
    }, 1000 + Math.random() * 1000);
  }

  private clearTurnTimer() {
    if (this.turnTimer) {
      clearTimeout(this.turnTimer);
      this.turnTimer = null;
    }
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
}
