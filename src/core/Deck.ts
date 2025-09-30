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

    let defs: [CardType, Card["valor"], number, string?][] = [
      ["distancia", 25, 8, "🛣️"],
      ["distancia", 50, 8, "🛣️"],
      ["distancia", 75, 8, "🛣️"],
      ["distancia", 100, 10, "🛣️"],
      ["distancia", 200, 3, "🚀"],
      ["perigo", "pneu_furado", 3, "🛞"],
      ["perigo", "sem_gasolina", 3, "⛽️⬇️"],
      ["perigo", "acidente", 3, "💥"],
      ["perigo", "limite_velocidade", 4, "🐢"],
      ["perigo", "pare", 4, "🛑"],
      ["solucao", "pneu_reserva", 5, "🔧"],
      ["solucao", "gasolina", 5, "⛽️⬆️"],
      ["solucao", "reparos", 5, "🛠️"],
      ["solucao", "fim_limite_velocidade", 5, "⚡"],
      ["solucao", "siga", 12, "🟢"],
      ["seguranca", "tanque_cheio", 1, "⛽️✅"],
      ["seguranca", "pneu_inquebravel", 1, "🛡️"],
      ["seguranca", "as_do_volante", 1, "🏅"],
      ["seguranca", "passagem_livre", 1, "✨"],
    ];

    if (numJogadores > 2) {
      // CORREÇÃO 1: Definimos um tipo explícito para as cartas extras.
      type ExtraCardDef = [CardType, Card["valor"], number, string | undefined];

      // CORREÇÃO 2: Aplicamos esse tipo à nossa lista de cartas.
      const cartasExtrasPorJogador: ExtraCardDef[] = [
        ["distancia", 100, 1, "🛣️"],
        ["solucao", "siga", 2, "🟢"],
        ["perigo", "limite_velocidade", 1, "🐢"],
        ["solucao", "fim_limite_velocidade", 1, "⚡"],
      ];

      for (let i = 2; i < numJogadores; i++) {
        cartasExtrasPorJogador.forEach(([tipo, valor, qtd, emoji]) => {
          // CORREÇÃO 3: Agora o `push` funciona sem precisar de conversões (`as ...`)
          // porque o TypeScript já sabe os tipos corretos.
          defs.push([tipo, valor, qtd, emoji]);
        });
      }
    }

    this.cartas = [];
    const emojiMap = new Map<string, string>();
    defs.forEach(([tipo, valor, qtd, emoji]) => {
      const key = `${tipo}-${valor}`;
      if (emoji && !emojiMap.has(key)) {
        emojiMap.set(key, emoji);
      }

      for (let i = 0; i < qtd; i++) {
        this.cartas.push({ tipo, valor, emoji: emojiMap.get(key) });
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
