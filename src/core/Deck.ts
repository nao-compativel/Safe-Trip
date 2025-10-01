import { Card, CardType } from "./Card";

export class Deck {
  cartas: Card[] = [];
  descarte: Card[] = [];

  constructor(numJogadores: number) {
    this.criar_baralho(numJogadores);
    this.embaralhar();
  }

  criar_baralho(numJogadores: number) {
    console.log(
      `Criando um baralho balanceado para ${numJogadores} jogadores.`
    );

    // O tipo agora espera apenas 3 elementos na tupla: [tipo, valor, quantidade]
    let defs: [CardType, Card["valor"], number][] = [
      ["distancia", 25, 8],
      ["distancia", 50, 8],
      ["distancia", 75, 8],
      ["distancia", 100, 10],
      ["distancia", 200, 3],
      ["perigo", "pneu_furado", 3],
      ["perigo", "sem_gasolina", 3],
      ["perigo", "acidente", 3],
      ["perigo", "limite_velocidade", 4],
      ["perigo", "pare", 4],
      ["solucao", "pneu_reserva", 5],
      ["solucao", "gasolina", 5],
      ["solucao", "reparos", 5],
      ["solucao", "fim_limite_velocidade", 5],
      ["solucao", "siga", 12],
      ["seguranca", "tanque_cheio", 1],
      ["seguranca", "pneu_inquebravel", 1],
      ["seguranca", "as_do_volante", 1],
      ["seguranca", "passagem_livre", 1],
    ];

    if (numJogadores > 2) {
      // O tipo para cartas extras também foi simplificado.
      type ExtraCardDef = [CardType, Card["valor"], number];

      // A lista de cartas extras não contém mais os emojis.
      const cartasExtrasPorJogador: ExtraCardDef[] = [
        ["distancia", 100, 1],
        ["solucao", "siga", 2],
        ["perigo", "limite_velocidade", 1],
        ["solucao", "fim_limite_velocidade", 1],
      ];

      for (let i = 2; i < numJogadores; i++) {
        // A desestruturação agora pega apenas os 3 valores, ignorando o emoji que não existe mais.
        cartasExtrasPorJogador.forEach(([tipo, valor, qtd]) => {
          // O push agora adiciona um array com 3 elementos, conforme o tipo de `defs`.
          defs.push([tipo, valor, qtd]);
        });
      }
    }

    this.cartas = [];
    // Toda a lógica do `emojiMap` foi removida por não ser mais necessária.
    defs.forEach(([tipo, valor, qtd]) => {
      for (let i = 0; i < qtd; i++) {
        this.cartas.push({ tipo, valor });
      }
    });
  }

  embaralhar() {
    for (let i = this.cartas.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cartas[i], this.cartas[j]] = [this.cartas[j], this.cartas[i]];
    }
  }

  comprar_carta(): Card | null {
    if (this.cartas.length === 0) {
      if (this.descarte.length === 0) return null;
      this.cartas = this.descarte;
      this.descarte = [];
      this.embaralhar();
    }
    return this.cartas.pop()!;
  }
}
