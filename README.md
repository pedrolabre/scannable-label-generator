# LabelForge

SPA client-side para cadastro de produtos e geração de etiquetas com QR Code machine-readable, organizadas em folha A4 e exportadas em PDF vetorial. Tudo roda no navegador: sem servidor, sem conta, sem rede depois da primeira visita.

LabelForge é o nome do produto: é o que aparece na interface, no aplicativo instalado, no título da página e nos metadados do PDF. O repositório se chama `scannable-label-generator`, e é esse o nome do pacote no `package.json`.

## Status

MVP funcional.

## Funcionamento

- Cadastro manual de produtos e importação em lote via CSV, JSON, XML de NFC-e (SEFAZ 4.00) e `.txt`: os relatórios do ERP (Tabela de Preço e Saldo de Estoque por Grupo) ou a planilha salva como texto, com as colunas separadas por tabulação e os mesmos nomes de coluna da planilha. O tipo do `.txt` é reconhecido pelo conteúdo.
- Na importação, o NCM e o código de barras que o arquivo não traz são completados pela base de referência guardada pelo `Completar dados`, antes da conferência. A base é consultada uma vez por lote, pelo código inteiro ou sem os zeros à esquerda; só o campo vazio é completado, e o valor que o arquivo trouxe nunca muda. Sem base, ou com a leitura dela falhando, a importação segue como antes.
- A revisão do lote diz quantos registros ganharam NCM e código de barras pela base e quantos tinham código fora dela, prontos inclusive, e o registro que aparece na revisão leva a marca dos campos que vieram da base. Quando a leitura da base falha, um aviso diz que o lote seguiu como veio do arquivo, e a gravação continua disponível.
- `Completar dados`, ao lado de `Importar`: lê planilhas `.ods` e `.csv`, listas `.json`, notas fiscais `.xml` e arquivos `.txt` e preenche só os campos vazios dos produtos já cadastrados (NCM, código de barras, descrição, categoria e observações), sem criar produto e com o resumo conferido antes de gravar. O código é comparado inteiro e, quando não existe no catálogo, também sem os zeros à esquerda. Na mesma confirmação, o arquivo em colunas que traz NCM ou código de barras (`.ods`, `.csv`, `.json` ou `.txt` com tabulação) atualiza a base de referência código por código, mesmo com o catálogo vazio; o resumo diz antes quantos códigos são novos, quantos mudam e quantos já estavam iguais. A nota fiscal não alimenta a base. A base fica fora do arquivo de backup e continua guardada quando o catálogo é zerado.
- Divergências no `Completar dados`: descrição, preço ou NCM já preenchidos com valor diferente do arquivo não mudam na confirmação. O botão `Divergências (N)` abre um segundo diálogo com o valor cadastrado ao lado do valor do arquivo, tudo aberto em `Manter`; cada item pode ser trocado para `Mudar`, e `Mudar todos` / `Manter todos` valem para o filtro aberto (todos, descrição, preço ou NCM). Só `Aplicar escolhas` grava, e grava só o que está em `Mudar`. A descrição é comparada sem diferença de espaços, e mudá-la refaz o nome da etiqueta a partir dela. Item cujo produto mudou entre a lista e a gravação fica de fora e é contado.
- `Base de referência`, ao lado de `Completar dados`: guarda código, NCM e código de barras; mostra quantos códigos a base tem, quantos têm NCM e código de barras e a data da última carga. Carrega `.ods`, `.csv`, `.json` ou `.txt` com tabulação sem tocar no catálogo, por dois caminhos: `Atualizar a base`, código por código (código novo entra, o que existe recebe o que o arquivo traz, campo vazio no arquivo não apaga o guardado, e código fora do arquivo continua na base), ou `Trocar a base`, que deixa só os códigos do arquivo e pede confirmação dizendo quantos saem. Apaga a base, com confirmação. E completa o NCM e o código de barras vazios dos produtos já cadastrados a partir da base, sem arquivo e com o resumo conferido antes de gravar; o NCM da base diferente do cadastrado aparece em `Divergências`, com o mesmo diálogo do `Completar dados`.
- Listagem paginada, 50 produtos por página, com a troca de página e o trecho exibido no rodapé fixo da coluna. A busca, sem acento e sem diferença de caixa, procura no catálogo inteiro, e a página sai do resultado já em ordem de nome. O catálogo é preparado para a busca uma vez a cada mudança da lista (forma sem acento dos campos e ordem por nome), e cada termo só filtra; o campo mostra cada letra na hora e a lista acompanha logo em seguida, sem esperar a digitação parar. Trocar o termo volta à primeira página, e cadastrar, editar, remover ou importar mantém a página atual. A marcação para a folha é guardada por produto e não muda com a troca de página. A caixa do cabeçalho `Imprimir` (nos cartões, `Imprimir todos`) marca a lista inteira, em todas as páginas: sem busca, o catálogo; com busca, só o resultado. Com a lista toda marcada, ela desmarca a lista; com parte marcada, fica no meio. O que estava marcado fora do resultado da busca fica como estava, e quem já estava marcado mantém as cópias digitadas.
- Geração de QR Code no formato posicional `LF1`, gravando os dados completos do exemplar na etiqueta.
- Etiqueta com cabeçalho (código e logotipo ou nome da empresa), preço à vista, cartão sem juros, crediário com taxa e parcela calculada, EAN, NCM e símbolo 2D no canto inferior.
- Layouts padronizados em milímetros reais, com prévia individual e montagem de grade em folha A4.
- Exportação em PDF vetorial com escala física 1:1.
- Interface em janela única com modais dedicados e adaptação fluida de densidade.
- Na tela larga, as colunas laterais têm uma alça na borda que encosta na listagem. Um clique (ou um arraste) alarga a coluna por cima da listagem, sem mexer nela: a da esquerda vai até pouco antes do código, e a da direita cobre ações, preço e código. Com mais espaço, as opções ficam lado a lado. Uma abre por vez, e ela fecha pela própria alça, por `Esc` ou por um clique na listagem.
- Persistência local no IndexedDB, com duas tabelas: os produtos e a base de referência. O banco que já existe no navegador passa para a versão nova sem perder produto nem base.
- Backup total dos produtos num arquivo JSON, com opção de zerar catálogo. O arquivo sai no formato 2, só com os produtos e a versão do banco; o arquivo do formato 1, com as quatro tabelas, continua sendo aceito na restauração. A base de referência fica fora do arquivo, e restaurar não a apaga.
- PWA instalável e utilizável offline.

## Modelos de etiqueta e folha

A aplicação abre com a `Etiqueta 10 (84,7 x 46,6 mm)` na folha `A4 10 etiquetas (2 x 5)`: 10 etiquetas por folha A4 comum, impressa a 100% e recortada à tesoura.

| Folha | Margens | Entre colunas | Entre linhas |
| --- | --- | --- | --- |
| A4 10 etiquetas (2 x 5) | 12,7 mm | 13,9 mm | 6,5 mm |
| A4 retrato (210 x 297 mm) | 10 mm | 3 mm | 3 mm |
| A4 paisagem (297 x 210 mm) | 10 mm | 3 mm | 3 mm |

| Etiqueta | Na folha de 10 | Em A4 retrato |
| --- | --- | --- |
| Etiqueta 10 (84,7 x 46,6 mm) | 10 | 10 |
| Tag grande (100 x 70 mm) | 3 | 3 |
| Etiqueta média (70 x 50 mm) | 8 | 10 |
| Etiqueta pequena (50 x 30 mm) | 21 | 24 |

- A grade parte do canto superior esquerdo; a sobra fica à direita e embaixo.
- As seis medidas da folha são editáveis e voltam às do modelo quando a folha é trocada.
- `Aproveitar a folha` (margem de 5 mm e etiquetas encostadas) só aparece quando abre uma coluna ou uma linha a mais.
- Na etiqueta de 10 por folha o nome do produto ocupa duas linhas, em corpo menor que o dos outros modelos, e é cortado com reticências quando não cabe.
- A etiqueta de 10 por folha e a tag grande levam o crediário e uma faixa vermelha na base, abaixo do símbolo. A etiqueta média leva só o cartão, e a pequena, nenhum dos dois.

## Logotipo da empresa

O logotipo é carregado uma vez em `Logotipo e textos da etiqueta`, na coluna da prévia, e sai na prévia, na folha e no PDF.

- Formatos aceitos: PNG, JPEG e SVG. SVG é convertido em PNG no carregamento; PNG fica em PNG e JPEG fica em JPEG.
- A imagem não é recusada pelo tamanho: acima de 1.200 px de lado ela é reduzida, sem distorcer, e ainda sai acima de 600 dpi na etiqueta. Se passar de 512 KB, o lado encolhe por passos até 600 px; em último caso, o PNG vira JPEG sobre fundo branco.
- Na etiqueta ocupa o lugar do nome da empresa no cabeçalho, inteira, alinhada à direita. O símbolo não muda de tamanho nem de lugar.
- Na etiqueta de 10 por folha, o logotipo ocupa a coluna do símbolo, do topo até logo acima dele (27 × 13,1 mm), encostado no topo e à direita. A descrição vai para a coluna da esquerda, com até três linhas, e pode descer ao lado do símbolo; o "à vista", o preço, o cartão e o crediário descem uma linha e sobem de novo quando a descrição usa menos linhas. A linha fiscal continua rente à base. Sem logotipo, essa etiqueta volta ao arranjo de cabeçalho, com a descrição na largura inteira.
- A etiqueta pequena não tem lugar para a imagem e continua com o nome da empresa.
- `Mostrar o logotipo na etiqueta` tira a imagem sem apagá-la; `Remover` apaga. Sem logotipo, a etiqueta volta a ser a de antes.
- Fica guardado neste navegador, na mesma chave do nome da empresa, do cartão e do crediário (`labelforge.etiqueta`, no `localStorage`). Não entra no arquivo de backup, e zerar o catálogo ou restaurar um backup não o apaga.

## Cartão e crediário

Configurados uma vez em `Logotipo e textos da etiqueta`, na coluna da prévia, valem para todos os produtos. Na etiqueta saem abaixo do preço à vista, nesta ordem:

```text
À VISTA R$ 1.000,00
10x sem juros no cartão
Crediário: 10x de R$ 180,00
Taxa de Juros: 8% a.m.
```

- **Cartão:** quantidade de parcelas sem juros (2 a 24), sem valor. É opcional: `Mostrar o cartão na etiqueta` tira a linha sem apagar a quantidade.
- **Taxa do crediário:** taxa de juros ao mês (0% a 20%, até duas casas decimais). Com o crediário guardado, a linha da taxa sai sempre.
- **Parcela do crediário:** o cálculo escolhe se ela sai.
  - `Nenhum`: sem cálculo; a etiqueta leva só a taxa.
  - `Simples`: parcela = preço x (1 + taxa x parcelas) / parcelas. R$ 1.000,00 em 10x a 8% a.m. dá 10x de R$ 180,00.
  - `Compostos` (Tabela Price): parcela = preço x taxa / (1 - (1 + taxa)^-parcelas). R$ 1.000,00 em 10x a 8% a.m. dá 10x de R$ 149,03.
  - Com taxa zero, simples e compostos dividem o preço pelas parcelas.
- A conta é feita em centavos inteiros e só a parcela final é arredondada, ao centavo mais próximo. Preço que não dá um centavo por parcela sai só com a taxa.
- `Arredondar a parcela para ,90` mantém o real e troca os centavos por 90: R$ 161,98 e R$ 161,20 saem R$ 161,90.
- Linha que não sai deixa o lugar para a de baixo, que sobe.
- Valor fora dos limites é recusado com o motivo embaixo do campo, e nada é gravado.
- O preço à vista é sempre o maior texto da etiqueta, e nenhuma dessas linhas fica menor que a linha fiscal.
- O crediário sai na etiqueta de 10 por folha e na tag grande; o cartão, também na etiqueta média.
- Ficam guardados neste navegador, na mesma chave do logotipo (`labelforge.etiqueta`). Não entram no arquivo de backup, e zerar o catálogo ou restaurar um backup não os apaga.

## Formato `LF1`

Texto posicional, campos separados por barra vertical, ordem fixa:

| Posição | Campo | Regra |
| --- | --- | --- |
| 0 | versão | `LF1` |
| 1 | código do sistema | obrigatório, letras, números e hífen |
| 2 | nome | obrigatório, como cadastrado |
| 3 | preço em centavos | obrigatório, inteiro |
| 4 | código de barras | opcional, 8, 12, 13 ou 14 dígitos |
| 5 | NCM | opcional, 8 dígitos |
| 6 | exemplar | `c1`, `c2`, ... na ordem da cópia |

```text
LF1|118789|CANTINHO CAFE RUBI|85990|7899075420416|94035000|c1
LF1|118789|CANTINHO CAFE RUBI|85990|||c1
```

- Campo opcional ausente mantém a posição, vazio.
- Não há escape: barra vertical e quebra de linha não ocorrem dentro de campo.
- Texto com acento é lido pela declaração de UTF-8 do próprio QR Code.
- Símbolo gerado com nível de correção M e zona de silêncio de 4 módulos.

## Stack

- React e Vite, em JavaScript.
- Tailwind CSS, com paleta de marca em tokens e acabamento em `tailwind.config.js` e `src/styles/global.css`.
- IBM Plex Sans e Space Grotesk servidas localmente em `public/fonts/`.
- Lucide React para ícones da interface.
- Zod na validação de contratos e schemas de dados.
- Dexie sobre o IndexedDB para persistência local no navegador.
- Zustand no gerenciamento de estado global.
- PapaParse para leitura de CSV. JSON, XML de NFC-e, relatórios `.txt` e planilhas `.ods` são lidos com o próprio navegador (`JSON.parse`, `DOMParser` e `DecompressionStream`), sem biblioteca a mais.
- bwip-js para geração de QR Code no padrão `LF1`.
- jsPDF para renderização e exportação de PDF vetorial em escala física 1:1.
- vite-plugin-pwa para suporte a PWA instalável e operação offline.
- Vitest para testes automatizados unitários e de integração, com fake-indexeddb para exercitar o banco local e limite de 30 s por caso em `vitest.config.js`.

## Comandos

```bash
npm install      # instala as dependências
npm run dev      # servidor de desenvolvimento
npm test         # suíte de testes
npm run build    # build de produção em dist/
npm run preview  # serve o build local
```

## Estrutura do Projeto

```text
scannable-label-generator/
  index.html
  package.json
  postcss.config.js
  tailwind.config.js
  vite.config.js
  vitest.config.js
  README.md
  public/
    fonts/
      ibm-plex-sans-latin-ext.woff2
      ibm-plex-sans-latin.woff2
      space-grotesk-latin-ext.woff2
      space-grotesk-latin.woff2
    icons/
      apple-touch-icon-180.png
      icon-192.png
      icon-512.png
      icon-maskable-512.png
      icon.svg
  src/
    main.jsx
    App.jsx
    App.test.jsx
    AppCompletion.test.jsx
    AppReference.test.jsx
    AppProductList.test.jsx
    components/
      AppShell.jsx
      AppShell.test.jsx
      AppShellDrawers.test.jsx
      AppHeader.jsx
      AppHeader.test.jsx
      backup/
        BackupExportSection.jsx
        BackupFilePicker.jsx
        BackupPanel.jsx
        BackupPanel.test.jsx
        BackupRefusalReport.jsx
        BackupRestoreSection.jsx
        useBackupExport.js
        useBackupRestore.js
      completion/
        CatalogCompletionDivergences.test.jsx
        CatalogCompletionPanel.jsx
        CatalogCompletionPanel.test.jsx
        CatalogCompletionPanelReference.test.jsx
        CatalogCompletionSummary.jsx
        ReferenceEntriesSummary.jsx
      divergence/
        DivergenceDialog.jsx
      import/
        ImportConflictBulkActions.jsx
        ImportConflictNotice.jsx
        ImportDisplayNameField.jsx
        ImportFilePicker.jsx
        ImportFileStatusList.jsx
        ImportPanel.jsx
        ImportRecordIssueList.jsx
        ImportReviewPanel.jsx
        ImportReviewPanel.test.jsx
        ImportReviewRecord.jsx
        ImportReviewSummary.jsx
        ImportReviewSummary.test.jsx
        ImportWritePanel.jsx
        ImportWriteResult.jsx
        conflictLabels.js
        enrichmentSentence.js
        importCounts.js
      label/
        LabelCardSetting.jsx
        LabelCreditSetting.jsx
        LabelCreditSetting.test.jsx
        LabelLayoutPicker.jsx
        LabelLogoSetting.jsx
        LabelLogoSetting.test.jsx
        LabelPreviewDialog.jsx
        LabelPreviewPanel.jsx
        LabelPreviewPanel.test.jsx
        LabelScalePicker.jsx
        LabelSurface.jsx
        LabelTextSettings.jsx
        LabelTextSettings.test.jsx
        ProductLabel.jsx
        ProductLabel.test.jsx
        SavedTextSetting.jsx
        SettingCheckbox.jsx
        previewSelection.js
        previewSelection.test.js
        useProductSymbol.js
      layout/
        ShellColumn.jsx
        ShellColumn.test.jsx
        ShellDrawer.jsx
        StatusBar.jsx
        StatusBar.test.jsx
      print/
        PrintExportButton.jsx
        PrintExportControls.jsx
        PrintExportControls.test.jsx
        PrintJobItemRow.jsx
        PrintJobSettings.jsx
        PrintJobSettings.test.jsx
        SheetCanvas.jsx
        SheetFitToggle.jsx
        SheetLayoutPicker.jsx
        SheetMarginFields.jsx
        SheetNavigation.jsx
        SheetPreview.jsx
        SheetPreview.test.jsx
        SheetPreviewDialog.jsx
        SheetPreviewDialog.test.jsx
        SheetScalePicker.jsx
        printInputs.js
        printInputs.test.js
        printJobState.js
        printSelection.js
        printSelection.test.js
        sheetSlots.js
        sheetSlots.test.js
        usePrintExport.js
        useSheetSymbols.js
      product-form/
        ProductForm.jsx
        ProductFormFields.jsx
        productFormValues.js
        productFormValues.test.js
        useProductForm.js
      product-list/
        ClearCatalogButton.jsx
        ProductCards.jsx
        ProductItemActions.jsx
        ProductList.jsx
        ProductList.test.jsx
        ProductListPager.jsx
        ProductListPages.test.jsx
        ProductListSearch.test.jsx
        ProductListStatus.jsx
        ProductSearchField.jsx
        ProductListSelectAll.test.jsx
        ProductTable.jsx
        ProductTableRow.jsx
        SelectAllForPrint.jsx
        listFixtures.js
        listPage.js
        listPage.test.js
      pwa/
        UpdateNotice.jsx
        UpdateNotice.test.jsx
      reference/
        ClearReferenceButton.jsx
        ReferenceCompletionSection.jsx
        ReferenceCompletionSection.test.jsx
        ReferencePanel.jsx
        ReferencePanel.test.jsx
        ReferenceSheetSection.jsx
        ReferenceStats.jsx
      ui/
        Button.jsx
        Card.jsx
        Checkbox.jsx
        ConfirmModal.jsx
        Field.jsx
        IconButton.jsx
        InlineAlert.jsx
        ModalShell.jsx
        ModalShell.test.jsx
        ScrollRegion.jsx
        ScrollRegion.test.jsx
        SegmentedControl.jsx
        SegmentedControl.test.jsx
        focusClasses.js
    domain/
      schemas/
        backupFileSchema.js
        backupFileSchema.test.js
        commonFields.js
        labelSettingsSchema.js
        productSchema.js
        productSchema.test.js
        referenceEntrySchema.js
        labelLayoutSchema.js
        sheetLayoutSchema.js
        sheetLayoutSchema.test.js
        printJobSchema.js
      services/
        backupFile.js
        backupFile.test.js
        backupFormats.test.js
        backupRead.js
        backupRestore.test.js
        backupText.js
        backupWriter.js
        catalogCompletion.js
        catalogCompletion.test.js
        catalogCompletionDivergence.test.js
        csvParser.js
        importConflict.js
        importConflict.test.js
        importConflictIndex.js
        importCorrection.js
        importError.js
        importRecord.js
        importRecord.test.js
        importReport.js
        importReport.test.js
        importReportIndex.js
        importService.js
        importService.test.js
        importServiceOds.test.js
        importServiceReports.test.js
        importValidation.js
        importValidation.test.js
        importWriter.js
        importWriter.test.js
        installmentPlan.js
        installmentPlan.test.js
        jsonParser.js
        labelArrangements.js
        labelArrangements.test.js
        labelContent.js
        labelContent.test.js
        labelGeometry.js
        labelGeometry.test.js
        labelLayoutCatalog.js
        labelLayoutCatalog.test.js
        labelLogoColumn.test.js
        labelText.js
        labelText.test.js
        logoImage.js
        logoImage.test.js
        nfceParser.js
        nfceParser.test.js
        nfceProductMapping.js
        odsArchive.js
        odsArchive.test.js
        odsEncoding.js
        odsEncoding.test.js
        odsFixtures.js
        odsParser.js
        odsParser.test.js
        odsTable.js
        printDocument.js
        printDocument.test.js
        printExport.js
        printExport.test.js
        printJobBuilder.js
        printJobBuilder.test.js
        printText.js
        printText.test.js
        productCandidateIssue.js
        productEnrichment.js
        productEnrichment.test.js
        productMapping.js
        productMapping.test.js
        productSearch.js
        productSearch.test.js
        productService.js
        referenceCompletion.js
        referenceCompletion.test.js
        referenceEntries.js
        referenceEntries.test.js
        referenceMerge.test.js
        sheetGrid.js
        sheetGrid.test.js
        sheetLayoutCatalog.js
        sheetLayoutCatalog.test.js
        sheetPagination.js
        sheetPagination.test.js
        symbolContent.js
        symbolContent.test.js
        tabularProductMapping.js
        tabularProductMapping.test.js
        txtEncoding.js
        txtEncoding.test.js
        txtReportFixtures.js
        txtReportParser.js
        txtReportParser.test.js
        txtTableParser.js
        txtTableParser.test.js
    lib/
      app-meta.js
      barcode.js
      barcode.test.js
      barcodeCache.js
      barcodeCache.test.js
      barcodeEngine.js
      barcodeError.js
      barcodeSizing.js
      barcodeSizing.test.js
      barcodeSvg.js
      barcodeSvg.test.js
      barcodeSymbology.js
      barcodeSymbology.test.js
      contrast.js
      contrast.test.js
      currency.js
      cx.js
      download.js
      download.test.js
      logoFile.js
      logoFixtures.js
      pdf.js
      pdf.test.js
      pdfBytes.js
      pdfCredit.test.js
      pdfEngine.js
      pdfLogo.test.js
      symbolPath.js
      symbolPath.test.js
    pwa/
      documentMeta.test.js
      manifest.js
      manifest.test.js
      registerServiceWorker.js
      updateState.js
      updateState.test.js
    storage/
      backupRepository.js
      indexed-db.js
      indexed-db.test.js
      labelSettingsStorage.js
      labelSettingsStorage.test.js
      productRepository.js
      productRepository.test.js
      productRepositoryBulkUpdate.test.js
      referenceBoundaries.test.js
      referenceRepository.js
      referenceRepository.test.js
      referenceRepositoryMerge.test.js
      storageError.js
    store/
      divergenceWrite.js
      importBatchUpdates.js
      importEnrichment.js
      importEnrichment.test.js
      importEnrichmentDatabase.test.js
      importEnrichmentFormats.test.js
      referenceCompletionSlice.js
      referenceCompletionSlice.test.js
      useCompletionStore.js
      useCompletionStore.test.js
      useCompletionStoreReference.test.js
      useImportStore.js
      useLabelSettingsStore.js
      usePrintJobStore.js
      useProductStore.js
      useProductStore.test.js
      useReferenceStore.js
      useReferenceStore.test.js
    styles/
      brandClasses.test.js
      global.css
```
