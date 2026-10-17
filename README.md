# Terraria Journey Archive

Site de fã no estilo da Terraria Wiki para acompanhar a pesquisa de itens no **Modo Jornada**.

Site após configurar o GitHub Pages: **https://sungfix.github.io/terraria-journey-archive/**

## Funcionalidades

- Busca por itens, filtros e categorias; idiomas português, inglês e espanhol (traduções parciais).
- Marcação manual e progresso salvo no navegador; importação/exportação de backup.
- Sprites originais tentados a partir de fontes da wiki e importação manual PNG quando necessário.
- **Sincronização automática opcional:** programa Windows acompanha o `.plr` e atualiza os itens pesquisados no site.
- Se o catálogo da wiki não puder ser carregado, o site exibe uma amostra de 64 itens e informa isso.

## Sincronização automática (Windows)

1. Entre em **[Actions → Aplicativo Windows – Journey Sync](../../actions/workflows/build-sync-windows.yml)**, abra uma execução bem-sucedida e baixe o arquivo em **Artifacts → JourneyArchiveSync-Windows**. O GitHub pode exigir login para baixar os artifacts.
2. Extraia o ZIP e execute `JourneyArchiveSync.exe`. Não precisa instalar o Python.
3. Se houver vários personagens, escolha o personagem de **Modo Jornada** na lista ou selecione o arquivo `.plr` quando solicitado. O aplicativo grava sua escolha para as próximas execuções.
4. Deixe o aplicativo aberto (pode minimizar). Abra o site no **mesmo computador** usando Chrome, Edge ou Brave.
5. Permita o acesso à rede local/loopback se o navegador solicitar. Dentro do painel **Sincronização automática**, o status deve mudar para **Sincronizado com o Terraria**.
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

- O leitor foi testado com saves de teste sintéticos, **não com um `.plr` real do usuário**. Formatos novos ou especiais podem não ser reconhecidos; nesse caso o aplicativo informa o erro e **não altera marcações automaticamente**.
- O mapa de IDs de base é derivado do [terraria-research-tracker](https://github.com/iagox86/terraria-research-tracker) (licença MIT) e cobre principalmente itens até o ID 5124. Itens posteriores podem ser identificados pelo nome, quando houver correspondência.
- Saves em nuvem Steam sem cópia local acessível precisam ser selecionados/baixados localmente.
- O programa deve continuar **aberto** para sincronizar depois que o jogo salvar; atualizações do jogo podem exigir ajustes no leitor.
- Sem aplicativo, a marcação manual continua funcionando.
- O site depende de fontes externas para carregar o catálogo total e as imagens originais.

## Publicar

No repositório, abra **Settings → Pages → Deploy from a branch → main → /(root) → Save**.

## Créditos

Projeto independente de fã. Terraria e sua arte pertencem à Re-Logic; não há afiliação oficial com Re-Logic ou Terraria Wiki.

Dados de IDs/quantidades históricos adaptados de **[iagox86/terraria-research-tracker](https://github.com/iagox86/terraria-research-tracker)**, sob licença MIT (veja a licença do projeto original). A lista de pesquisa mais atual é consultada na [wiki oficial](https://terraria.wiki.gg/wiki/Journey_Mode/Research_list).