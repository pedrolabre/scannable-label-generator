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
- PDFMake ou jsPDF (exportação em PDF)
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
      ui/
        Button.jsx
        Card.jsx
        ConfirmModal.jsx
        Field.jsx
        IconButton.jsx
        InlineAlert.jsx
        ModalShell.jsx
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
        nfceParser.js
        nfceParser.test.js
        nfceProductMapping.js
        productCandidateIssue.js
        productMapping.js
        productMapping.test.js
        productSearch.js
        productService.js
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
    storage/
      indexed-db.js
      productRepository.js
      storageError.js
    store/
      useImportStore.js
      useProductStore.js
    styles/
      global.css
```
