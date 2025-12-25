# 📺 YouTube Info Viewer

Uma aplicação web moderna para visualizar informações detalhadas sobre vídeos do YouTube, incluindo título, duração, tamanho e mais.

## ✨ Funcionalidades

- 🔍 Busca de informações de vídeos do YouTube via URL
- 📊 Exibição de informações detalhadas:
  - Título do vídeo
  - Duração
  - Autor/Canal
  - Número de visualizações
  - Data de publicação
  - Tamanhos disponíveis por qualidade
  - Descrição (preview)
  - Thumbnail do vídeo
- 🎨 Design moderno e responsivo
- ⚡ Atualização em tempo real

## 🚀 Como executar

### Pré-requisitos

- Node.js (versão 14 ou superior)
- npm ou yarn

### Instalação

1. Instale as dependências do projeto:

```bash
npm run install-all
```

Ou manualmente:

```bash
npm install
cd client
npm install
```

### Executar em desenvolvimento

Para executar o servidor backend e frontend simultaneamente:

```bash
npm run dev
```

Ou execute separadamente:

**Terminal 1 - Backend:**
```bash
npm run server
```

**Terminal 2 - Frontend:**
```bash
npm run client
```

A aplicação estará disponível em:
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

## 📦 Estrutura do Projeto

```
ytdownloader/
├── client/                 # Frontend React
│   ├── src/
│   │   ├── App.tsx        # Componente principal
│   │   ├── App.css        # Estilos
│   │   └── index.tsx      # Entry point
│   └── package.json
├── server.js              # Backend Express
├── package.json           # Dependências do backend
└── README.md
```

## 🛠️ Tecnologias Utilizadas

### Backend
- **Node.js** - Runtime JavaScript
- **Express** - Framework web
- **ytdl-core** - Biblioteca para obter informações do YouTube
- **CORS** - Habilitar requisições cross-origin

### Frontend
- **React** - Biblioteca JavaScript para UI
- **TypeScript** - Tipagem estática
- **CSS3** - Estilização moderna com gradientes e animações

## 📝 Como usar

1. Acesse a aplicação no navegador
2. Cole a URL de um vídeo do YouTube no campo de input
3. Clique em "Buscar" ou pressione Enter
4. As informações do vídeo serão exibidas em tempo real

## 🔧 API Endpoints

### POST /api/video-info

Obtém informações de um vídeo do YouTube.

**Request Body:**
```json
{
  "url": "https://www.youtube.com/watch?v=VIDEO_ID"
}
```

**Response:**
```json
{
  "title": "Título do vídeo",
  "duration": "10:30",
  "author": "Nome do canal",
  "thumbnail": "URL da thumbnail",
  "description": "Descrição do vídeo...",
  "views": 1234567,
  "uploadDate": "2024-01-01T00:00:00.000Z",
  "videoId": "VIDEO_ID",
  "sizes": [
    {
      "quality": "720p",
      "container": "mp4",
      "size": "150.5 MB",
      "sizeBytes": 157286400
    }
  ]
}
```

## 📄 Licença

MIT

