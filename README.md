# LabelForge

SPA client-side para cadastro de produtos e geração de etiquetas com código 2D (Data Matrix/QR) machine-readable, organizadas em folha A4 e exportadas em PDF vetorial. Tudo roda no navegador: sem servidor, sem conta, sem rede depois da primeira visita.

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

## Comandos

```bash
npm install      # instala as dependências
npm run dev      # servidor de desenvolvimento
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
  README.md
  src/
    main.jsx
    App.jsx
    components/
      AppShell.jsx
      AppHeader.jsx
      LocalOnlyNotice.jsx
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
        ModalShell.jsx
    domain/
      schemas/
        commonFields.js
        productSchema.js
        labelLayoutSchema.js
        sheetLayoutSchema.js
        printJobSchema.js
      services/
        productSearch.js
        productService.js
    lib/
      app-meta.js
      currency.js
      cx.js
    storage/
      indexed-db.js
      productRepository.js
    store/
      useProductStore.js
    styles/
      global.css
```
