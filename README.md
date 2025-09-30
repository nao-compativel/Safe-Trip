# Safe Trip or Not! 🚗💨

## 📖 Sobre o Projeto

**Safe Trip or Not!** é um jogo de cartas multiplayer de corrida, totalmente funcional no navegador, inspirado no clássico jogo de tabuleiro francês *Mille Bornes*. O objetivo é ser o primeiro jogador a atingir a distância final da corrida (customizável), jogando cartas de quilometragem enquanto utiliza cartas de perigo para atrapalhar os oponentes e cartas de solução e segurança para se defender e superar os obstáculos da estrada.

Este projeto foi desenvolvido utilizando uma stack moderna com TypeScript, Node.js e WebSockets para comunicação em tempo real.

---

## ✨ Funcionalidades Principais

- **Multiplayer em Tempo Real:** Jogue com até 5 jogadores em salas privadas.
- **Modo Single Player:** Desafie-se contra 3 bots com inteligência artificial.
- **IA com Dificuldade Dinâmica:** Os bots se adaptam ao seu desempenho, tornando o jogo mais fácil se você estiver para trás e mais desafiador se estiver na liderança.
- **Salas Customizáveis:** Crie salas com o nome que quiser e defina a distância da corrida.
- **Lobby com Atualização Automática:** A lista de salas abertas é atualizada em tempo real para todos os jogadores no lobby.
- **Regras Especiais:** Implementa mecânicas clássicas como o turno extra ao jogar uma carta de segurança (imunidade).
- **Timer de Turno com Pressão:** O tempo de turno diminui drasticamente quando um jogador está próximo da linha de chegada, aumentando a emoção.
- **Sistema de Ociosidade:** Se um jogador não agir a tempo, ele perde a vez com uma penalidade justa (descarte de carta).
- **Interface Vibrante e Responsiva:** Efeitos visuais, animações, efeitos sonoros e um layout que se adapta a diferentes tamanhos de tela.

---

## 🛠️ Tecnologias Utilizadas

- **Backend:**
  - **Node.js:** Ambiente de execução JavaScript.
  - **TypeScript:** Superset do JavaScript que adiciona tipagem estática.
  - **Express:** Framework para a criação do servidor HTTP.
  - **Socket.IO:** Biblioteca para comunicação em tempo real via WebSockets.

- **Frontend:**
  - **HTML5**
  - **CSS3** (com Flexbox e Grid para responsividade)
  - **JavaScript (Vanilla)**

- **Ferramentas de Desenvolvimento:**
  - **ts-node** e **Nodemon:** Para reiniciar o servidor automaticamente durante o desenvolvimento.

---

## 📂 Estrutura do Projeto

```

/
├── public/
│   ├── client.js       \# Lógica do frontend
│   ├── index.html      \# Estrutura da página
│   ├── style.css       \# Estilização
│   └── sounds/         \# Arquivos de áudio
├── src/
│   ├── core/           \# Lógica principal do jogo (classes de Jogo, Jogador, Baralho)
│   ├── socket/         \# Gerenciamento de salas e eventos de socket
│   └── app.ts          \# Ponto de entrada do servidor
├── package.json
└── tsconfig.json

````

---

## 🚀 Como Rodar o Projeto Localmente

Siga os passos abaixo para executar o jogo na sua própria máquina.

### Pré-requisitos

- **Node.js:** Versão 18.x ou superior.
- **NPM** (geralmente instalado junto com o Node.js).

### Instalação e Execução

1.  **Clone o repositório:**
    ```bash
    git clone https://github.com/nao-compativel/Safe-Trip
    ```

2.  **Navegue até a pasta do projeto:**
    ```bash
    cd Safe-Trip
    ```

3.  **Instale as dependências:**
    ```
    npm install
    ```

4.  **Inicie o servidor de desenvolvimento:**
    ```bash
    npm run dev
    ```

5.  **Abra o jogo no navegador:**
    - Abra seu navegador e acesse: `http://localhost:3000`
    - Para simular múltiplos jogadores, abra o mesmo endereço em diferentes abas ou janelas do navegador.

---

## 🎮 Como Jogar

- **Objetivo:** Ser o primeiro a atingir a quilometragem da corrida.
- **Cartas de Distância (🛣️):** Permitem que você avance. Só podem ser usadas se você não tiver problemas e tiver um "sinal verde".
- **Cartas de Perigo (💥):** Use para atacar e parar seus oponentes.
- **Cartas de Solução (🛠️):** Use para consertar problemas que você recebeu. Após consertar, você precisará de uma carta "Siga" para voltar a andar.
- **Cartas de Segurança (✨):** Dão imunidade permanente a um tipo de perigo, consertam o problema instantaneamente e te dão um turno extra!
