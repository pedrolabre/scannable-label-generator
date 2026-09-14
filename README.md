# LabelForge

SPA client-side para cadastro de produtos e geração de etiquetas com QR Code machine-readable, organizadas em folha A4 e exportadas em PDF vetorial. Tudo roda no navegador: sem servidor, sem conta, sem rede depois da primeira visita.

## Status

Em desenvolvimento inicial.

## Funcionamento

- Cadastro manual de produtos (criar, editar, remover e listar).
- Importação em lote via CSV, JSON e XML de NFC-e (SEFAZ 4.00).
- Geração de código 2D com os dados da etiqueta, sem dependência de rede ou servidor.
- Layouts de etiqueta padronizados em milímetros reais, com diagramação automática e escala 1:1.
- Montagem automática em grade de folha A4 com controle de margens e prévia interativa.
- Exportação em PDF vetorial com escala física 1:1.
- Persistência local no IndexedDB com exportação e restauração total de backup.
- PWA instalável e funcional offline.

## Stack

- React e Vite, em JavaScript.
- Tailwind CSS e PostCSS para estilização utilitária.
- Lucide React para ícones da interface.
- Zod na validação de contratos e schemas de dados.
- Dexie sobre o IndexedDB para persistência local no navegador.
- Zustand no gerenciamento de estado global.
- PapaParse e fast-xml-parser para leitura de CSV, JSON e XML de NFC-e.
- bwip-js para geração de código 2D / QR Code no navegador.
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
