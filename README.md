# LabelForge

SPA client-side para cadastro de produtos e geração de etiquetas com QR Code machine-readable, organizadas em folha A4 e exportadas em PDF vetorial. Tudo roda no navegador: sem servidor, sem conta, sem rede depois da primeira visita.

## Status

MVP funcional.

## Funcionamento

- Cadastro manual de produtos e importação em lote via CSV, JSON e XML de NFC-e (SEFAZ 4.00).
- Geração de QR Code no formato posicional `LF1`, gravando os dados completos do exemplar na etiqueta.
- Etiqueta com cabeçalho (código e logotipo ou nome da empresa), preço, parcelamento, EAN, NCM e símbolo 2D no canto inferior.
- Layouts padronizados em milímetros reais, com prévia individual e montagem de grade em folha A4.
- Exportação em PDF vetorial com escala física 1:1.
- Interface em janela única com modais dedicados e adaptação fluida de densidade.
- Persistência local no IndexedDB com backup total e opção de zerar catálogo.
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
- Na etiqueta de 10 por folha o nome do produto ocupa uma linha, cortada com reticências quando não cabe.

## Logotipo da empresa

O logotipo é carregado uma vez em `Logotipo e textos da etiqueta`, na coluna da prévia, e sai na prévia, na folha e no PDF.

- Formatos aceitos: PNG, JPEG e SVG. SVG é convertido em PNG no carregamento; PNG fica em PNG e JPEG fica em JPEG.
- A imagem não é recusada pelo tamanho: acima de 1.200 px de lado ela é reduzida, sem distorcer, e ainda sai acima de 600 dpi na etiqueta. Se passar de 512 KB, o lado encolhe por passos até 600 px; em último caso, o PNG vira JPEG sobre fundo branco.
- Na etiqueta ocupa o lugar do nome da empresa no cabeçalho, inteira, alinhada à direita. O símbolo não muda de tamanho nem de lugar.
- A etiqueta pequena não tem lugar para a imagem e continua com o nome da empresa.
- `Mostrar o logotipo na etiqueta` tira a imagem sem apagá-la; `Remover` apaga. Sem logotipo, a etiqueta volta a ser a de antes.
- Fica guardado neste navegador, na mesma chave do nome da empresa e do parcelamento (`labelforge.etiqueta`, no `localStorage`). Não entra no arquivo de backup, e zerar o catálogo ou restaurar um backup não o apaga.

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
- PapaParse e fast-xml-parser para leitura de CSV, JSON e XML de NFC-e.
- bwip-js para geração de QR Code no padrão `LF1`.
- jsPDF para renderização e exportação de PDF vetorial em escala física 1:1.
- vite-plugin-pwa para suporte a PWA instalável e operação offline.
- Vitest para testes automatizados unitários e de integração.

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
    components/
      AppShell.jsx
      AppShell.test.jsx
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
      import/
        ImportConflictBulkActions.jsx
        ImportConflictNotice.jsx
        ImportDisplayNameField.jsx
        ImportFilePicker.jsx
        ImportFileStatusList.jsx
        ImportPanel.jsx
        ImportRecordIssueList.jsx
        ImportReviewPanel.jsx
        ImportReviewRecord.jsx
        ImportReviewSummary.jsx
        ImportWritePanel.jsx
        ImportWriteResult.jsx
        conflictLabels.js
        importCounts.js
      label/
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
        previewSelection.js
        previewSelection.test.js
        useProductSymbol.js
      layout/
        ShellColumn.jsx
        ShellColumn.test.jsx
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
        ProductListStatus.jsx
        ProductSearchField.jsx
        ProductTable.jsx
        ProductTableRow.jsx
      pwa/
        UpdateNotice.jsx
        UpdateNotice.test.jsx
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
        labelLayoutSchema.js
        sheetLayoutSchema.js
        sheetLayoutSchema.test.js
        printJobSchema.js
      services/
        backupFile.js
        backupFile.test.js
        backupRead.js
        backupRestore.test.js
        backupText.js
        backupWriter.js
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
        importValidation.js
        importValidation.test.js
        importWriter.js
        importWriter.test.js
        jsonParser.js
        labelContent.js
        labelContent.test.js
        labelGeometry.js
        labelGeometry.test.js
        labelLayoutCatalog.js
        labelLayoutCatalog.test.js
        labelText.js
        labelText.test.js
        logoImage.js
        logoImage.test.js
        nfceParser.js
        nfceParser.test.js
        nfceProductMapping.js
        printDocument.js
        printDocument.test.js
        printExport.js
        printExport.test.js
        printJobBuilder.js
        printJobBuilder.test.js
        printText.js
        printText.test.js
        productCandidateIssue.js
        productMapping.js
        productMapping.test.js
        productSearch.js
        productService.js
        sheetGrid.js
        sheetGrid.test.js
        sheetLayoutCatalog.js
        sheetLayoutCatalog.test.js
        sheetPagination.js
        sheetPagination.test.js
        symbolContent.js
        symbolContent.test.js
        tabularProductMapping.js
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
      pdfEngine.js
      pdfLogo.test.js
      symbolPath.js
      symbolPath.test.js
    pwa/
      manifest.js
      manifest.test.js
      registerServiceWorker.js
      updateState.js
      updateState.test.js
    storage/
      backupRepository.js
      indexed-db.js
      labelSettingsStorage.js
      labelSettingsStorage.test.js
      productRepository.js
      productRepository.test.js
      storageError.js
    store/
      useImportStore.js
      useLabelSettingsStore.js
      usePrintJobStore.js
      useProductStore.js
      useProductStore.test.js
    styles/
      brandClasses.test.js
      global.css
```
