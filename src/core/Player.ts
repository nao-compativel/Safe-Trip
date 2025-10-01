import { Card, PerigoType, SegurancaType } from "./Card";

export class Player {
  id: string;
  nome: string;
  isBot: boolean;
  disconnected: boolean = false; // Essencial para a reconexão

  carroEmoji: string = "❓";
  distancia = 0;
  mao: Card[] = [];
  perigos_ativos = new Set<PerigoType>();
  segurancas_ativas = new Set<SegurancaType>();
  limite_de_velocidade = false;
  precisa_do_siga = false;

  constructor(id: string, nome: string, isBot: boolean = false) {
    this.id = id;
    this.nome = nome;
    this.isBot = isBot;
  }

  podeAndar(): boolean {
    return this.perigos_ativos.size === 0 && !this.precisa_do_siga;
  }

  adicionarSeguranca(seg: SegurancaType) {
    this.segurancas_ativas.add(seg);
    if (seg === "passagem_livre") {
      this.limite_de_velocidade = false;
      this.precisa_do_siga = false;
    }
  }

  get publicState() {
    return {
      id: this.id,
      nome: this.nome,
      isBot: this.isBot,
      disconnected: this.disconnected,
      carroEmoji: this.carroEmoji,
      distancia: this.distancia,
      perigos_ativos: Array.from(this.perigos_ativos),
      segurancas_ativas: Array.from(this.segurancas_ativas),
      limite_de_velocidade: this.limite_de_velocidade,
      precisa_do_siga: this.precisa_do_siga,
      cartasNaMao: this.mao.length,
    };
  }
}
