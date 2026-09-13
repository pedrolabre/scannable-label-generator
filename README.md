# scannable-label-generator

SPA client-side para cadastro de produtos e geração de etiquetas com código 2D (Data Matrix/QR) machine-readable, organizadas em folha A4 e exportadas em PDF vetorial. Nome de produto: LabelForge.

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
- bwip-js (Data Matrix/QR)
- PDFMake ou jsPDF (exportação em PDF)
- vite-plugin-pwa

## Escopo do MVP

- Cadastro manual de produtos (criar, editar, remover, listar)
- Importação em lote via CSV, JSON e XML de NFC-e (SEFAZ 4.00)
- Geração de Data Matrix/QR contendo exclusivamente o código do produto
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
        ImportFilePicker.jsx
        ImportFileStatusList.jsx
        ImportPanel.jsx
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
        importError.js
        importRecord.js
        importRecord.test.js
        importService.js
        importService.test.js
        jsonParser.js
        nfceParser.js
        nfceParser.test.js
        productSearch.js
        productService.js
    lib/
      app-meta.js
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
