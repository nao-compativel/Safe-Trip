export type CardType = "distancia" | "perigo" | "solucao" | "seguranca";
export type PerigoType =
  | "sem_gasolina"
  | "pneu_furado"
  | "acidente"
  | "limite_velocidade"
  | "pare";
export type SolucaoType =
  | "gasolina"
  | "pneu_reserva"
  | "reparos"
  | "fim_limite_velocidade"
  | "siga";
export type SegurancaType =
  | "tanque_cheio"
  | "pneu_inquebravel"
  | "as_do_volante"
  | "passagem_livre";

export interface Card {
  tipo: CardType;
  valor: number | PerigoType | SolucaoType | SegurancaType;
  emoji?: string;
}
