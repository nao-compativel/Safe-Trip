import { Card, PerigoType, SegurancaType } from "./Card";

export class Player {
  id: string;
  nome: string;
  isBot: boolean;
  carroEmoji: string = "❓"; // Carro do jogador
  distancia = 0;
  mao: Card[] = [];
  perigos_ativos = new Set<PerigoType>();
  segurancas_ativas = new Set<SegurancaType>();
  limite_de_velocidade = false;
  precisa_do_siga = true;

  constructor(id: string, nome: string, isBot: boolean = false) {
    this.id = id;
    this.nome = nome;
    this.isBot = isBot;
  }

  podeAndar(): boolean {
    return this.perigos_ativos.size === 0 && !this.precisa_do_siga;
  }

  get publicState() {
    return {
      id: this.id,
      nome: this.nome,
      isBot: this.isBot,
      carroEmoji: this.carroEmoji, // Envia o carro para o cliente
      distancia: this.distancia,
      perigos_ativos: Array.from(this.perigos_ativos),
      segurancas_ativas: Array.from(this.segurancas_ativas),
      limite_de_velocidade: this.limite_de_velocidade,
      precisa_do_siga: this.precisa_do_siga,
      cartasNaMao: this.mao.length,
    };
  }
}
