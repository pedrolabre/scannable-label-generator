/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'media',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      /**
       * Unica fonte de cor do produto. Nenhum valor literal acompanha a classe
       * no componente: quando a cor de um papel muda, ela muda aqui e em lugar
       * nenhum mais.
       *
       * O vermelho carrega dois papeis, marca e erro, e o que os separa e o
       * peso, nao o matiz: a marca preenche, o erro usa fundo tenue com borda
       * propria e texto proprio. Nenhum texto de erro cai sobre preenchimento
       * vermelho.
       *
       * Verde e amarelo sao raros por regra, e nao por acaso. Verde so aparece
       * em confirmacao; amarelo so em aviso. Fora disso os dois nao existem, e
       * e isso que impede a tela de virar semaforo conforme novos estados
       * entrarem.
       *
       * `neutro.papel` existe para uma coisa so: separar a coluna central das
       * duas laterais brancas e alternar as faixas da listagem.
       */
      colors: {
        marca: {
          vermelho: '#C1121F',
          vermelhoEscuro: '#8E0D17',
          vermelhoTenue: '#FDECEE',
          vermelhoBorda: '#F3C2C6',
          vermelhoTexto: '#A01018',
          verde: '#1B7A3E',
          verdeTexto: '#16693A',
          verdeEscuro: '#0F4F2A',
          verdeTenue: '#E9F5EE',
          verdeBorda: '#B9DCC6',
          amarelo: '#E8B004',
          amareloTenue: '#FDF4D9',
          amareloBorda: '#EBD79A',
          amareloTexto: '#7A5A00',
          amareloTextoForte: '#6B4E00',
        },
        neutro: {
          branco: '#FFFFFF',
          papel: '#FAFAFA',
          superficie: '#EFEFEF',
          tinta: '#141414',
          tintaMedia: '#333333',
          tintaFraca: '#5E5E5E',
          divisor: '#E6E6E6',
          borda: '#DCDCDC',
          bordaForte: '#C9C9C9',
          cortina: 'rgba(0, 0, 0, 0.46)',
        },
      },

      /**
       * Canto reto em todo o produto. A chave e unica de proposito: qualquer
       * outra abriria de novo a escolha que esta linha fecha.
       */
      borderRadius: {
        DEFAULT: '0',
      },

      /**
       * Uma face de display para numero, marca e titulo curto; uma face de
       * texto para o resto. Os dois arquivos sao servidos pela propria
       * aplicacao, porque ela precisa desenhar igual sem rede.
       */
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
      },

      /**
       * A unica elevacao do produto, e ela existe por necessidade: o painel do
       * dialogo precisa se descolar da tela que continua desenhada atras dele.
       */
      boxShadow: {
        modal: '0 24px 64px rgba(0, 0, 0, 0.28)',
      },
    },
  },
  plugins: [],
};
