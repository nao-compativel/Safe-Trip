import { GameRoom } from "./GameRoom";

class RoomManager {
  private rooms = new Map<string, GameRoom>();

  /**
   * ATUALIZADO: A função agora aceita a distância como segundo argumento.
   * @param id O ID da sala.
   * @param distancia A distância objetivo, usada apenas se a sala for nova.
   * @returns A instância da GameRoom.
   */
  public getOrCreateRoom(id: string, distancia: number): GameRoom {
    let room = this.rooms.get(id);
    if (!room) {
      // Se a distância for inválida (undefined, null, 0), usa 700 como padrão.
      const distanciaFinal = distancia || 700;
      room = new GameRoom(id, distanciaFinal);
      this.rooms.set(id, room);
      console.log(`Sala '${id}' criada com objetivo de ${distanciaFinal}km.`);
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
  public deleteRoom(id: string): boolean {
    return this.rooms.delete(id);
  }

  public deleteRoomIfEmpty(id: string) {
    const room = this.getRoom(id);
    if (room && room.jogadores.size === 0) {
      this.deleteRoom(id);
    }
  }
}

// Exportamos uma única instância do gerente para ser usada em toda a aplicação.
export const roomManager = new RoomManager();
