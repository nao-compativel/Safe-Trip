import { Card, PerigoType, SegurancaType } from "./Card";

/**
 * Representa um jogador (humano ou bot).
 * Mantive os campos originais e adicionei métodos auxiliares para facilitar
 * manutenção e leitura no GameRoom.
 */
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

  // OBS: alterei para false por padrão. Antes estava true e impedia o jogador de
  // avançar sem jogar 'siga' primeiro. Troque para true apenas se a regra do seu
  // jogo exigir que o jogador comece "parado".
  precisa_do_siga = false;

  constructor(id: string, nome: string, isBot: boolean = false) {
    this.id = id;
    this.nome = nome;
    this.isBot = isBot;
  }

  /**
   * Retorna true se o jogador pode jogar cartas de distância:
   * sem perigos ativos e não precisando de 'siga'.
   */
  podeAndar(): boolean {
    return this.perigos_ativos.size === 0 && !this.precisa_do_siga;
  }

  // ----------------- Métodos auxiliares -----------------

  /**
   * Aplica um perigo ao jogador (retorna true se aplicado).
   * Se o jogador tiver a segurança correspondente, retorna false (não aplicado).
   */
  aplicarPerigo(
    perigo: PerigoType,
    segurancaImunizante?: SegurancaType
  ): boolean {
    if (
      segurancaImunizante &&
      this.segurancas_ativas.has(segurancaImunizante)
    ) {
      return false;
    }
    this.perigos_ativos.add(perigo);
    return true;
  }

  /**
   * Remove um perigo do jogador (se existir).
   */
  removerPerigo(perigo: PerigoType) {
    this.perigos_ativos.delete(perigo);
  }

  /**
   * Adiciona uma segurança ao jogador (ex.: 'passagem_livre').
   * Aplica efeitos colaterais necessários (ex.: remover limite e 'siga').
   */
  adicionarSeguranca(seg: SegurancaType) {
    this.segurancas_ativas.add(seg);
    if (seg === "passagem_livre") {
      this.limite_de_velocidade = false;
      this.precisa_do_siga = false;
    }
  }

  /**
   * Remove uma segurança do jogador.
   */
  removerSeguranca(seg: SegurancaType) {
    this.segurancas_ativas.delete(seg);
  }

  // -----------------------------------------------------

  /**
   * Estado público do jogador (enviado ao cliente).
   * Não expõe a mão completa, apenas o tamanho da mão.
   */
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
