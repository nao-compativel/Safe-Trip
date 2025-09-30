import { GameRoom } from "../core/GameRoom";

class RoomManager {
  private rooms = new Map<string, GameRoom>();

  /**
   * Obtém uma sala existente pelo ID ou cria uma nova se ela não existir.
   * @param id O ID da sala.
   * @param distancia A distância objetivo para a corrida, usada apenas se a sala for nova.
   * @returns A instância da GameRoom.
   */
  public getOrCreateRoom(id: string, distancia: number): GameRoom {
    let room = this.rooms.get(id);
    if (!room) {
      room = new GameRoom(id, distancia); // Passa a distância na criação
      this.rooms.set(id, room);
      console.log(`Sala '${id}' criada com objetivo de ${distancia}km.`);
    }
    return room;
  }

  /**
   * Apenas obtém uma sala se ela já existir.
   * @param id O ID da sala.
   * @returns A instância da GameRoom ou undefined.
   */
  public getRoom(id: string): GameRoom | undefined {
    return this.rooms.get(id);
  }

  /**
   * Retorna uma lista de salas que estão aguardando jogadores e ainda não começaram.
   * @returns Um array com informações públicas das salas.
   */
  public getPublicRooms(): {
    id: string;
    playerCount: number;
    distancia: number;
  }[] {
    return Array.from(this.rooms.values())
      .filter((room) => room.estado === "AGUARDANDO")
      .map((room) => ({
        id: room.id,
        playerCount: room.jogadores.size,
        distancia: room.distanciaObjetivo,
      }));
  }

  /**
   * Verifica se uma sala está vazia e, se estiver, a remove do gerenciador.
   * @param id O ID da sala a ser verificada.
   */
  public deleteRoomIfEmpty(id: string): void {
    const room = this.rooms.get(id);
    if (room && room.jogadores.size === 0) {
      this.rooms.delete(id);
      console.log(`Sala '${id}' estava vazia e foi removida.`);
    }
  }
}

// Exportamos uma única instância do gerente para ser usada em toda a aplicação (padrão Singleton).
export const roomManager = new RoomManager();
