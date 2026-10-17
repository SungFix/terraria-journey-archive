# Terraria Journey Archive

Site de fã com **uma única página**: lista de pesquisas do Modo Jornada e artigos completos da Terraria Wiki carregados dentro do próprio site ao clicar em cada item.

Site publicado no GitHub Pages: **https://sungfix.github.io/terraria-journey-archive/**

## Funcionalidades

- **6.133 itens pesquisáveis** da lista oficial do Terraria (17/10/2026); 13 entradas sem pesquisa foram excluídas.
- Lista compacta com pesquisa por nome ou ID, filtros e categorias; idioma dos itens em português, inglês e espanhol quando disponível.
- Clique no cartão para abrir **o artigo completo dentro do próprio site**, sem página de wiki separada.
- Artigos carregados sob demanda da API oficial da Terraria Wiki, incluindo atributos, receitas, tabelas, imagens, sons e histórico, com atribuição e licença.
- As traduções dependem dos artigos existentes na wiki; quando indisponíveis, o site pode mostrar a versão inglesa.
- Sprites de Terraria carregados de fontes externas, com indicação visual quando uma imagem falhar.
- Marcação manual e progresso salvo no navegador, com opções de exportar/importar backup pelo botão ⚙.
- **Sincronização automática sem CMD:** o aplicativo Windows fica na bandeja do sistema, acompanha o `.plr` e não modifica seu personagem.
- Catálogo atual fica salvo em `data/catalog-base.json` e é atualizado semanalmente pelo workflow `update-catalog.yml`.

## Sincronização automática (Windows) — sem janela de CMD

O sincronizador agora tem uma **versão discreta na bandeja do Windows**.

1. Baixe a última compilação bem-sucedida em **[Actions → Aplicativo Windows - Journey Sync](../../actions/workflows/build-sync-windows.yml)** → **Artifacts → JourneyArchiveSync-Windows**. O GitHub pode exigir login.
2. Extraia o ZIP e **feche primeiro o sincronizador antigo que deixa o CMD aberto**.
3. Execute **`JourneyArchiveSync.exe`**. Ele **não abre uma janela de Prompt de Comando**. Seu ícone aparece próximo ao relógio do Windows (talvez em **Mostrar ícones ocultos `^`**).
4. Se ainda não houver um personagem salvo, o Windows mostrará uma janela para escolher um `.plr`. Caso contrário, o aplicativo reutiliza a seleção anterior.
5. Abra o [Journey Archive](https://sungfix.github.io/terraria-journey-archive/) no **mesmo computador**. O progresso sincroniza quando o jogo salva, sem arrastar arquivos.

**Clique com o botão direito no ícone da bandeja:**

- **Abrir Journey Archive** abre o site no navegador.
- **Escolher personagem** troca o `.plr` monitorado.
- **Iniciar com Windows** liga ou desliga a inicialização automática do usuário atual, sem administrador.
- **Ver status** mostra o personagem, as pesquisas reconhecidas e possíveis erros.
- **Sair do sincronizador** encerra o aplicativo e sua sincronização. Fechar o navegador não encerra o aplicativo.

O sincronizador lê o save a cada 3 segundos; o site o consulta a cada 5 segundos. O programa **não altera nem envia seu personagem**. **Não é um serviço do Windows:** para iniciar após reiniciar o PC, habilite **Iniciar com Windows**; o aplicativo será aberto ao entrar em sua conta.

### Diagnóstico separado (opcional)

O ZIP contém também `JourneyArchiveSync-Diagnostico.exe`, uma versão de console para ler mensagens de erro. Você **não precisa abri-la para sincronizar**. Se a versão da bandeja já estiver ativa, feche-a antes de iniciar o diagnóstico como serviço, pois ambas usam a porta 47838.

Para verificar um save sem modificar nada, abra um Prompt na pasta do executável e execute:

```bat
JourneyArchiveSync-Diagnostico.exe --diagnose
```

Para trocar o personagem no diagnóstico:

```bat
JourneyArchiveSync-Diagnostico.exe --select
```

A entrada antiga de inicialização `--start` continua compatível ao substituir o exe anterior **no mesmo caminho**. Se você mover o novo exe, use **Iniciar com Windows** no ícone para registrar a nova localização.

### Rodar pelo código-fonte (alternativa)

Requer Python 3.11+:

```bat
py -3 -m pip install -r companion\requirements.txt
py -3 companion\sync.py
```

O projeto contém também `companion/Iniciar-sincronizador.bat` (quando executado na estrutura original do repositório).

## Privacidade e segurança

- O programa **apenas lê** o `.plr`; não altera, substitui ou exclui os saves do Terraria.
- Ele disponibiliza **somente nomes/IDs e contadores de pesquisa**, mais o nome do personagem, via `127.0.0.1:47838`. Nenhum `.plr` é enviado à internet, e o serviço só escuta no computador local.
- Apenas o site `https://sungfix.github.io` (além de testes locais) recebe autorização CORS para consultar a resposta local.
- O site guarda uma cópia dos contadores no armazenamento local do navegador para manter o progresso visível quando o aplicativo estiver desconectado.
- O aplicativo consulta o GitHub para baixar **somente o catálogo público de IDs** caso o arquivo não tenha sido incluído no pacote.
- Pode haver alertas do Windows ou do antivírus por se tratar de aplicativo independente sem assinatura digital. Verifique o código-fonte e não desative sua proteção para executá-lo.

## Limitações

- A leitura usa a biblioteca independente `terraria-player`, testada pelo projeto original com Terraria **1.4.5.6**. O sincronizador usa um **leitor adaptado com validações adicionais para saves v326**; a leitura do personagem v326 foi confirmada pelo usuário. Outros saves e versões podem requerer testes. Formatos acima de 326 continuam bloqueados. Foram realizados testes sintéticos e um teste com save público v326, além da confirmação funcional do usuário. Se houver falha, o aplicativo informa o erro e **não altera marcações automaticamente**.
- O mapa de IDs de base é derivado do [terraria-research-tracker](https://github.com/iagox86/terraria-research-tracker) (licença MIT) e cobre principalmente itens até o ID 5124. Itens posteriores podem ser identificados pelo nome, quando houver correspondência.
- Saves em nuvem Steam sem cópia local acessível precisam ser selecionados/baixados localmente.
- A versão discreta deve continuar **ativa na bandeja do sistema** para sincronizar depois que o jogo salvar; atualizações do jogo podem exigir ajustes no leitor.
- Sem aplicativo, a marcação manual continua funcionando.
- O site contém a lista de 6.133 itens pesquisáveis em arquivo local e depende de fontes externas somente para os **artigos completos**, traduções complementares e imagens originais.

## Publicar

No repositório, abra **Settings → Pages → Deploy from a branch → main → /(root) → Save**.

## Créditos

Leitor completo de personagem: **[royalrizen/Terraria-Plr-Editor](https://github.com/royalrizen/Terraria-Plr-Editor)** (MIT; licença em [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)).


Projeto independente de fã. Terraria e sua arte pertencem à Re-Logic; não há afiliação oficial com Re-Logic ou Terraria Wiki.

Os artigos da [Terraria Wiki](https://terraria.wiki.gg) são exibidos mediante a API pública, sob licença [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) e atribuição ao artigo e seus autores. Imagens podem ter licenças próprias.

Dados de IDs/quantidades históricos adaptados de **[iagox86/terraria-research-tracker](https://github.com/iagox86/terraria-research-tracker)**, sob licença MIT (veja a licença do projeto original). A lista de pesquisa mais atual é consultada na [wiki oficial](https://terraria.wiki.gg/wiki/Journey_Mode/Research_list).