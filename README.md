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
- **Sincronização automática:** o programa Windows acompanha o `.plr` sem modificar seu personagem.
- Catálogo atual fica salvo em `data/catalog-base.json` e é atualizado semanalmente pelo workflow `update-catalog.yml`.

## Sincronização automática (Windows)

1. Entre em **[Actions → Aplicativo Windows – Journey Sync](../../actions/workflows/build-sync-windows.yml)**, abra uma execução bem-sucedida e baixe o arquivo em **Artifacts → JourneyArchiveSync-Windows**. O GitHub pode exigir login para baixar os artifacts.
2. Extraia o ZIP e execute `JourneyArchiveSync.exe`. Não precisa instalar o Python.
3. Se houver vários personagens, escolha o personagem de **Modo Jornada** na lista ou selecione o arquivo `.plr` quando solicitado. O aplicativo grava sua escolha para as próximas execuções.
4. Deixe o aplicativo aberto (pode minimizar). Abra o site no **mesmo computador** usando Chrome, Edge ou Brave.
5. Permita o acesso à rede local/loopback se o navegador solicitar. Na parte superior da lista, o indicador deve mudar para **Sincronizado**.
6. Continue jogando. O programa verifica o arquivo de personagem a cada **3 segundos**. O site consulta o programa a cada **5 segundos**, e as marcações serão atualizadas depois que o **jogo salvar o personagem**.

Acompanhar o save não exige arrastar arquivos a cada atualização. Com o site fechado, o aplicativo pode continuar lendo saves; o site se atualiza ao ser reaberto. Para acompanhar após reiniciar o PC, veja a configuração abaixo.

### Iniciar automaticamente com o Windows (opcional)

Abra o Prompt de Comando na pasta que contém o `.exe` e execute:

```bat
JourneyArchiveSync.exe --install-startup
```

Para desativar:

```bat
JourneyArchiveSync.exe --remove-startup
```

Isso adiciona/remove uma entrada no **Registro do usuário atual (HKCU)**, sem administrador. Caso mova o `.exe`, configure a inicialização novamente.

Para selecionar outro personagem, execute:

```bat
JourneyArchiveSync.exe --select
```

### Diagnóstico seguro (se houver erro na leitura)

Abra o Prompt de Comando na pasta do executável e rode:

```bat
JourneyArchiveSync.exe --diagnose
```

Esse comando mostra a versão do save, sua dimensão e, quando a leitura passa, um resumo da estrutura e das pesquisas, sem publicar o arquivo ou o nome do personagem. Em saves v326, quando o leitor falha, ele informa a linha do leitor, **offset** (posição numérica do erro) e se a tabela de pesquisas já havia sido inteiramente lida. Nenhum byte bruto ou conteúdo do save é exibido.

**V8:** Usa um adaptador de layout v326 para considerar o indicador de favorito nos equipamentos (introduzido no formato 322) e um byte reservado nos dados permanentes (introduzido no 324). A leitura foi verificada com um arquivo real e público de personagem v326 no GitHub Actions, além dos testes sintéticos. O teste real é de personagem **não Jornada**; a leitura do progresso de pesquisa do seu personagem Jornada ainda precisa de confirmação. A leitura continua local e somente de consulta.

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
- O programa deve continuar **aberto** para sincronizar depois que o jogo salvar; atualizações do jogo podem exigir ajustes no leitor.
- Sem aplicativo, a marcação manual continua funcionando.
- O site contém a lista de 6.133 itens pesquisáveis em arquivo local e depende de fontes externas somente para os **artigos completos**, traduções complementares e imagens originais.

## Publicar

No repositório, abra **Settings → Pages → Deploy from a branch → main → /(root) → Save**.

## Créditos

Leitor completo de personagem: **[royalrizen/Terraria-Plr-Editor](https://github.com/royalrizen/Terraria-Plr-Editor)** (MIT; licença em [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)).


Projeto independente de fã. Terraria e sua arte pertencem à Re-Logic; não há afiliação oficial com Re-Logic ou Terraria Wiki.

Os artigos da [Terraria Wiki](https://terraria.wiki.gg) são exibidos mediante a API pública, sob licença [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) e atribuição ao artigo e seus autores. Imagens podem ter licenças próprias.

Dados de IDs/quantidades históricos adaptados de **[iagox86/terraria-research-tracker](https://github.com/iagox86/terraria-research-tracker)**, sob licença MIT (veja a licença do projeto original). A lista de pesquisa mais atual é consultada na [wiki oficial](https://terraria.wiki.gg/wiki/Journey_Mode/Research_list).