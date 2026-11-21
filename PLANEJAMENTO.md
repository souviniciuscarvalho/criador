# Criador — planejamento

App pessoal (sem login) para criar conteúdo de redes sociais: feed, story e carrossel.

## Abas
1. **Criar** — escolhe o formato (Feed 4:5, Quadrado, Story 9:16, Carrossel, Personalizado), edita slides (título, texto, cores, alinhamento), associa referências e baixa PNG.
2. **Referências** — adiciona conteúdos (nome, nicho, tipo, texto, prints). O app faz um estudo e guarda os padrões; ao criar, as referências escolhidas servem de base.
3. **Conexões** — Claude Code (campos provisórios; formato será definido depois).

## Decisões
- Next.js + Tailwind, tudo no navegador. Dados em localStorage (uso pessoal, sem backend).
- Exportação PNG via canvas, no tamanho real do formato.
- Estudo de referência: hoje heurística local simples; vira análise real do Claude quando a conexão existir.

## Fases
- [x] F1: estrutura, Criar, Referências, Conexões (base)
- [ ] F2: conexão Claude Code (estudo de referências + geração de texto)
- [ ] F3: templates, upload de imagens nos slides, fontes
- [ ] F4: persistência na nuvem (se quiser acessar de vários dispositivos), publicação direta
