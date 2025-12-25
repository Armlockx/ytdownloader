// Desabilitar verificação de atualização do ytdl-core
process.env.YTDL_NO_UPDATE = 'true';

const express = require('express');
const cors = require('cors');
const ytdl = require('@distube/ytdl-core');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Configurar keep-alive para manter conexões abertas
app.use((req, res, next) => {
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Keep-Alive', 'timeout=60');
  next();
});

app.use(cors());
app.use(express.json());

// Servir arquivos estáticos do build da aplicação React
app.use(express.static(path.join(__dirname, 'client/build')));

// Handler para erros não tratados de promessas
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Rota raiz
app.get('/', (req, res) => {
  res.json({
    message: 'YouTube Info Viewer API',
    version: '1.0.0',
    endpoints: {
      'POST /api/video-info': 'Obter informações de um vídeo do YouTube'
    },
    frontend: 'Acesse http://localhost:3000 para usar a interface web'
  });
});

// Endpoint para obter informações do vídeo
app.post('/api/video-info', async (req, res) => {
  console.log('=== NOVA REQUISIÇÃO RECEBIDA ===');
  console.log('Timestamp:', new Date().toISOString());
  
  // Flag para garantir que só enviamos uma resposta
  let responseSent = false;
  
  const sendResponse = (statusCode, data) => {
    if (responseSent || res.headersSent) {
      return; // Já enviado, ignorar
    }
    
    responseSent = true;
    console.log(`✓ Enviando resposta: ${statusCode}`);
    try {
      res.status(statusCode).json(data);
      console.log(`✓ Resposta ${statusCode} enviada com sucesso`);
    } catch (err) {
      console.error('✗ Erro ao enviar resposta:', err.message);
      // Se der erro, não resetar responseSent para evitar loops
    }
  };

  // Timeout de segurança - garantir resposta mesmo se tudo falhar
  const safetyTimeout = setTimeout(() => {
    console.error('TIMEOUT DE SEGURANÇA ATIVADO (35s)');
    if (!responseSent) {
      sendResponse(504, { error: 'A requisição demorou muito tempo' });
    }
  }, 35000);

  try {
    console.log('Processando URL...');
    const { url } = req.body;

    if (!url) {
      clearTimeout(safetyTimeout);
      console.log('Erro: URL não fornecida');
      return sendResponse(400, { error: 'URL é obrigatória' });
    }

    console.log('URL recebida:', url);

    // Validar URL do YouTube
    if (!ytdl.validateURL(url)) {
      clearTimeout(safetyTimeout);
      console.log('Erro: URL inválida');
      return sendResponse(400, { error: 'URL do YouTube inválida' });
    }

    console.log('Iniciando ytdl.getInfo...');
    // Obter informações do vídeo com timeout melhorado
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        console.log('Timeout interno ativado (30s)');
        reject(new Error('Timeout: A requisição demorou muito para responder (30s)'));
      }, 30000);
    });

    let info;
    try {
      info = await Promise.race([
        ytdl.getInfo(url).then(result => {
          console.log('ytdl.getInfo concluído com sucesso');
          return result;
        }).catch(err => {
          console.error('Erro no ytdl.getInfo:', err.message);
          throw err;
        }),
        timeoutPromise
      ]);
      
      // Limpar timeout se a requisição foi bem-sucedida
      if (timeoutId) clearTimeout(timeoutId);
      console.log('Informações obtidas, processando...');
    } catch (raceError) {
      // Limpar timeout em caso de erro
      if (timeoutId) clearTimeout(timeoutId);
      clearTimeout(safetyTimeout);
      console.error('Erro ao obter info:', raceError.message);
      throw raceError;
    }

    // Verificar se temos informações válidas
    if (!info || !info.videoDetails) {
      clearTimeout(safetyTimeout);
      console.log('Erro: info ou videoDetails inválidos');
      return sendResponse(500, { error: 'Não foi possível obter informações do vídeo' });
    }

    console.log('Montando resposta...');

    // Processar informações básicas primeiro (mais rápido)
    const authorName = info.videoDetails.author?.name || info.videoDetails.ownerChannelName || 'Desconhecido';
    const description = info.videoDetails.description || '';
    const descriptionPreview = description.substring(0, 200);
    
    let thumbnailUrl = '';
    if (info.videoDetails.thumbnails && info.videoDetails.thumbnails.length > 0) {
      thumbnailUrl = info.videoDetails.thumbnails[info.videoDetails.thumbnails.length - 1].url;
    }

    // Processar formatos de forma mais eficiente (limitar para não demorar muito)
    let formats = [];
    try {
      // Primeiro tentar formatos com vídeo e áudio
      formats = info.formats.filter(format => format.hasVideo && format.hasAudio);
      
      // Se não houver, usar apenas vídeo
      if (formats.length === 0) {
        formats = info.formats.filter(format => format.hasVideo);
      }
      
      // Limitar a 20 formatos para não demorar muito no processamento
      if (formats.length > 20) {
        formats = formats.slice(0, 20);
      }
      
      // Processar formatos de forma mais eficiente
      formats = formats.map(format => {
        try {
          const sizeBytes = format.contentLength ? parseInt(format.contentLength) : 0;
          if (sizeBytes > 0) {
            return {
              quality: format.qualityLabel || format.quality || 'unknown',
              container: format.container || 'unknown',
              size: formatBytes(sizeBytes),
              sizeBytes: sizeBytes
            };
          }
          return null;
        } catch (err) {
          return null;
        }
      }).filter(f => f !== null);
      
    } catch (err) {
      console.error('Erro ao processar formatos:', err);
      formats = [];
    }
    
    // Construir resposta
    const videoInfo = {
      title: info.videoDetails.title || 'Sem título',
      duration: formatDuration(parseInt(info.videoDetails.lengthSeconds || 0)),
      author: authorName,
      thumbnail: thumbnailUrl,
      description: descriptionPreview,
      views: parseInt(info.videoDetails.viewCount || 0) || 0,
      uploadDate: info.videoDetails.publishDate || '',
      videoId: info.videoDetails.videoId || '',
      sizes: formats
    };

    clearTimeout(safetyTimeout);
    console.log('✓ Processamento concluído, enviando resposta...');
    sendResponse(200, videoInfo);
  } catch (error) {
    clearTimeout(safetyTimeout);
    console.error('=== ERRO CAPTURADO ===');
    console.error('Erro ao obter informações do vídeo:', error);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
    
    let errorMessage = 'Erro ao obter informações do vídeo. Verifique se a URL está correta.';
    let statusCode = 500;
    
    if (error && error.message) {
      if (error.message.includes('Video unavailable')) {
        errorMessage = 'Vídeo não disponível ou privado';
        statusCode = 404;
      } else if (error.message.includes('Private video')) {
        errorMessage = 'Este vídeo é privado';
        statusCode = 403;
      } else if (error.message.includes('Sign in to confirm your age')) {
        errorMessage = 'Este vídeo requer confirmação de idade';
        statusCode = 403;
      } else if (error.message.includes('Timeout')) {
        errorMessage = 'A requisição demorou muito. Tente novamente ou use outro vídeo.';
        statusCode = 504;
      } else if (error.message.includes('Unable to retrieve video metadata') || error.message.includes('ECONNRESET') || error.message.includes('socket') || error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
        errorMessage = 'Erro de conexão com o YouTube. Tente novamente em alguns instantes.';
        statusCode = 503;
      } else if (error.message.includes('ERR_INTERNET_DISCONNECTED') || error.message.includes('network')) {
        errorMessage = 'Erro de conexão com o YouTube. Verifique sua internet.';
        statusCode = 503;
      } else if (error.message.includes('parse') || error.message.includes('decipher') || error.message.includes('transform')) {
        // Erros de parsing do ytdl-core - geralmente funcionam mesmo com warnings
        errorMessage = 'Erro ao processar informações do vídeo. Tente novamente.';
        statusCode = 503;
      } else {
        errorMessage = error.message.substring(0, 200); // Limitar tamanho da mensagem
      }
    }
    
    console.log('Enviando resposta de erro:', statusCode, errorMessage);
    // Garantir que sempre retornamos JSON
    sendResponse(statusCode, { error: errorMessage });
  } finally {
    clearTimeout(safetyTimeout);
    console.log('=== FIM DA REQUISIÇÃO ===\n');
  }
});

// Função para formatar duração
function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// Função para formatar bytes
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

// Middleware de tratamento de erros não capturados (deve ser o último)
app.use((err, req, res, next) => {
  console.error('Erro não tratado:', err);
  if (!res.headersSent) {
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Servir index.html para todas as outras rotas (para client-side routing do React)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/build/index.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`API disponível em http://localhost:${PORT}`);
});

