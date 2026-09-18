# scannable-label-generator

SPA client-side para cadastro de produtos e geração de etiquetas com QR Code machine-readable, organizadas em folha A4 e exportadas em PDF vetorial. Nome de produto: LabelForge.

## Status

Em desenvolvimento inicial.

## Stack

- React + Vite, JavaScript (sem TypeScript)
- Tailwind CSS
- Zustand (estado global)
- Dexie.js sobre IndexedDB (persistência local)
- Zod (validação de schemas)
- Vitest (testes automatizados)
- PapaParse (CSV via Web Worker)
- bwip-js (QR Code)
- jsPDF (exportação em PDF)
- vite-plugin-pwa

## Escopo do MVP

- Cadastro manual de produtos (criar, editar, remover, listar)
- Importação em lote via CSV, JSON e XML de NFC-e (SEFAZ 4.00)
- Geração de QR Code contendo exclusivamente o código do produto
- Layouts de etiqueta padronizados, múltiplos tamanhos, em milímetros reais
- Motor de impressão: seleção de itens, montagem automática em folha A4, preview
- Exportação em PDF vetorial com escala física 1:1
- Persistência local em IndexedDB, com exportação e restauração total
- PWA instalável e funcional offline

## Instalação como aplicativo

O LabelForge é uma PWA: pode ser instalado como aplicativo e usado sem conexão.

1. Gere a versão de produção e sirva-a localmente:

   ```bash
   npm run build
   npm run preview
   ```

2. Abra o endereço indicado no terminal. No Chrome ou no Edge, use o ícone de instalação na barra
   de endereço, ou o menu do navegador, e confirme a instalação.
3. Na primeira visita o aplicativo guarda tudo o que precisa para funcionar sem rede: a interface,
   o gerador do código 2D e o gerador do PDF. A partir daí, cadastro, importação, prévia e
   exportação em PDF continuam disponíveis com a rede desligada.
4. Quando uma versão nova é publicada, um aviso aparece no topo da página com a ação de atualizar.
   A troca só acontece quando você clica: a folha em preparo não sobrevive ao recarregamento.

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
    icons/
      apple-touch-icon-180.png
      icon-192.png
      icon-512.png
      icon-maskable-512.png
      icon.svg
  src/
    main.jsx
    App.jsx
    components/
      AppShell.jsx
      AppHeader.jsx
      LocalOnlyNotice.jsx
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
        LabelPreviewPanel.jsx
        LabelPreviewPanel.test.jsx
        LabelScalePicker.jsx
        LabelSurface.jsx
        ProductLabel.jsx
        ProductLabel.test.jsx
        previewSelection.js
        previewSelection.test.js
        useProductSymbol.js
      print/
        PrintExportButton.jsx
        PrintExportControls.jsx
        PrintExportControls.test.jsx
        PrintJobItemRow.jsx
        PrintJobPanel.jsx
        PrintJobPanel.test.jsx
        SheetCanvas.jsx
        SheetLayoutPicker.jsx
        SheetMarginFields.jsx
        SheetNavigation.jsx
        SheetPreview.jsx
        SheetPreview.test.jsx
        SheetScalePicker.jsx
        printInputs.js
        printInputs.test.js
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
        useProductForm.js
      product-list/
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
        SegmentedControl.jsx
    domain/
      schemas/
        commonFields.js
        productSchema.js
        labelLayoutSchema.js
        sheetLayoutSchema.js
        printJobSchema.js
      services/
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
        labelGeometry.js
        labelGeometry.test.js
        labelLayoutCatalog.js
        labelLayoutCatalog.test.js
        labelText.js
        labelText.test.js
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
        sheetPagination.js
        sheetPagination.test.js
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
      currency.js
      cx.js
      download.js
      download.test.js
      pdf.js
      pdf.test.js
      pdfEngine.js
      symbolPath.js
      symbolPath.test.js
    pwa/
      manifest.js
      manifest.test.js
      registerServiceWorker.js
      updateState.js
      updateState.test.js
    storage/
      indexed-db.js
      productRepository.js
      storageError.js
    store/
      useImportStore.js
      usePrintJobStore.js
      useProductStore.js
    styles/
      global.css
```
