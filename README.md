# Animal Fighter

Briga de animais em pixel art com física, ragdolls e partidas online direto no navegador.

**Jogar:** https://cartooncodervt.github.io/animal-fighter/

## Jogar com amigos

1. Abra o jogo e entre em **ONLINE → CRIAR SALA**.
2. Mande o código da sala (ou o link de convite) para os amigos; eles entram em **ONLINE → ENTRAR**.
3. Até 4 jogadores. A conexão é direta entre os navegadores (WebRTC via PeerJS).

## Controles

A/D mover · W/Espaço pular · S agachar · J ataque · K especial · Shift parry/esquiva · E pegar · L revoada (Nox) · Esc pausa.
Também funciona com controle e toque.

**Mingau, o Rei Gato**, não suja as patas: cinco gatinhos da corte lutam por ele (soldado, arqueiro, assassino, mago e escudeiro). Eles têm vida própria: protegem o rei a todo custo, atacam sozinhos e em turnos quem chega perto dele (o assassino corta quem estiver batendo no rei, o escudeiro se põe na frente e leva o golpe por ele) e nunca se afastam muito dele. Cada J é uma ordem: o soldado corta, o assassino some e aparece atrás, o arqueiro dispara, o mago chama um raio e o escudeiro lança o rival para o alto. **S+J** faz chover flechas, **lado+J** é a carga, e o escudeiro bloqueia tiros na frente do rei. O K é o **ATAQUE REAL**: a corte inteira ataca junto.

**Lola** luta com facas e salta no tempo dentro dos combos (some e reaparece atrás, na frente ou acima do rival), deixando facas paradas no ar onde sumiu. No meio do combo ela monta padrões de bullet hell: **S+J** faz chover facas sobre o rival, um toque de **lado+J** ergue uma muralha de facas entre os dois e, no ar, um anel de facas se fecha em espiral. O K dela carrega devagar e para o tempo de verdade: **ZA WARUDO**.

**Nox** faz sangrar com cada golpe e bebe o sangue, inclusive as poças que ficam no chão da arena. Com a barra cheia, **K** o transforma no **DARK NOX** por 30 segundos (e ele continua DARK mesmo se morrer): ele solta a foice, que voa sozinha como um familiar cortando quem chega perto, e luta com as garras num combo frenético em que a foice ataca junto.

**Quebrar o combo:** apanhando, aperte **Shift** no momento certo do próximo golpe.

## Arenas

Escolha a arena na tela de lutadores (**M**) ou, online, na sala (o anfitrião escolhe).

- **Depósito 07 · Turno da Noite**: esteira, prensa hidráulica, triturador, cabo elétrico e carga pendurada.
- **Castelo · Salão do Relógio**: um salão gótico à meia-noite. Velas que soltam itens quando quebradas (corações, água benta, armas), um lustre que despenca se a corrente for cortada, pêndulos que varrem as sacadas, uma pedra solta sobre o fosso de estacas, armaduras que desmontam e deixam a arma... e alguns segredos para quem prestar atenção.

## Créditos

Física: [Matter.js](https://brm.io/matter-js/) (MIT) · Rede: [PeerJS](https://peerjs.com/) (MIT). Licenças em `vendor/`.
