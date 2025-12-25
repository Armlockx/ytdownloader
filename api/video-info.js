// Desabilitar verificação de atualização do ytdl-core
process.env.YTDL_NO_UPDATE = 'true';

let YTDlpWrap;
try {
  YTDlpWrap = require('yt-dlp-wrap').default;
  console.log('yt-dlp-wrap carregado com sucesso');
} catch (err) {
  console.error('Erro ao carregar yt-dlp-wrap:', err);
  YTDlpWrap = null;
}

// Função para validar URL do YouTube
function validateYouTubeURL(url) {
  const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/;
  return youtubeRegex.test(url);
}

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

module.exports = async (req, res) => {
  console.log('=== FUNÇÃO INICIADA ===');
  console.log('Node version:', process.version);
  console.log('NODE_ENV:', process.env.NODE_ENV);
  
  // Verificar se yt-dlp-wrap foi carregado
  if (!YTDlpWrap) {
    console.error('yt-dlp-wrap não foi carregado corretamente');
    console.error('Tentando carregar novamente...');
    try {
      YTDlpWrap = require('yt-dlp-wrap').default;
      console.log('yt-dlp-wrap carregado com sucesso na segunda tentativa');
    } catch (err) {
      console.error('Erro ao carregar yt-dlp-wrap na segunda tentativa:', err);
      return res.status(500).json({ 
        error: 'Erro interno: módulo yt-dlp-wrap não disponível',
        details: err.message
      });
    }
  }
  
  console.log('yt-dlp-wrap está funcionando corretamente');

  // Flag para garantir que só enviamos uma resposta
  let responseSent = false;
  let safetyTimeout;
  
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
    }
  };

  try {
    // Permitir CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    // Handle OPTIONS request
    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

    // Apenas aceitar POST
    if (req.method !== 'POST') {
      return sendResponse(405, { error: 'Método não permitido' });
    }

    console.log('=== NOVA REQUISIÇÃO RECEBIDA ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Method:', req.method);
    
    // Timeout de segurança - garantir resposta mesmo se tudo falhar
    // Reduzido para 25s para ficar dentro do limite do Vercel (maxDuration: 60s)
    safetyTimeout = setTimeout(() => {
      console.error('TIMEOUT DE SEGURANÇA ATIVADO (25s)');
      if (!responseSent) {
        sendResponse(504, { error: 'A requisição demorou muito tempo' });
      }
    }, 25000);

    // Parse do body - Vercel faz parse automático se Content-Type for application/json
    let body = req.body;
    console.log('Tipo do body:', typeof body);
    console.log('Body recebido:', body);
    
    // Se body for string, tentar fazer parse
    if (typeof body === 'string' && body.length > 0) {
      try {
        body = JSON.parse(body);
      } catch (parseError) {
        if (safetyTimeout) clearTimeout(safetyTimeout);
        console.error('Erro ao fazer parse do body string:', parseError);
        return sendResponse(400, { error: 'Body inválido - JSON malformado' });
      }
    }
    
    // Se body for Buffer, converter para string e fazer parse
    if (Buffer.isBuffer(body)) {
      try {
        body = JSON.parse(body.toString());
      } catch (parseError) {
        if (safetyTimeout) clearTimeout(safetyTimeout);
        console.error('Erro ao fazer parse do Buffer:', parseError);
        return sendResponse(400, { error: 'Body inválido - Buffer malformado' });
      }
    }

    console.log('Processando URL...');
    console.log('Body parseado:', body);
    const { url } = body || {};

    if (!url) {
      if (safetyTimeout) clearTimeout(safetyTimeout);
      console.log('Erro: URL não fornecida');
      return sendResponse(400, { error: 'URL é obrigatória' });
    }

    console.log('URL recebida:', url);

    // Validar URL do YouTube
    if (!validateYouTubeURL(url)) {
      if (safetyTimeout) clearTimeout(safetyTimeout);
      console.log('Erro: URL inválida');
      return sendResponse(400, { error: 'URL do YouTube inválida' });
    }

    console.log('Iniciando yt-dlp...');
    // Obter informações do vídeo com timeout melhorado
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        console.log('Timeout interno ativado (30s)');
        reject(new Error('Timeout: A requisição demorou muito para responder (30s)'));
      }, 30000);
    });

    let ytDlpInfo;
    let info;
    try {
      const ytDlpWrap = new YTDlpWrap();
      
      // Obter informações do vídeo usando yt-dlp
      ytDlpInfo = await Promise.race([
        ytDlpWrap.execPromise([
          url,
          '--dump-json',
          '--no-warnings',
          '--no-playlist',
          '--no-check-certificate'
        ]).then(result => {
          console.log('yt-dlp concluído com sucesso');
          // yt-dlp retorna JSON como string
          try {
            return JSON.parse(result);
          } catch (parseErr) {
            // Se já for objeto, retornar direto
            if (typeof result === 'object') {
              return result;
            }
            throw new Error('Erro ao fazer parse da resposta do yt-dlp: ' + parseErr.message);
          }
        }).catch(err => {
          console.error('Erro no yt-dlp:', err.message);
          throw err;
        }),
        timeoutPromise
      ]);
      
      // Converter formato do yt-dlp para o formato esperado (compatível com ytdl-core)
      info = {
        videoDetails: {
          title: ytDlpInfo.title || 'Sem título',
          lengthSeconds: ytDlpInfo.duration ? Math.floor(ytDlpInfo.duration).toString() : '0',
          author: {
            name: ytDlpInfo.uploader || ytDlpInfo.channel || 'Desconhecido'
          },
          ownerChannelName: ytDlpInfo.channel || ytDlpInfo.uploader || 'Desconhecido',
          description: ytDlpInfo.description || '',
          thumbnails: ytDlpInfo.thumbnails || (ytDlpInfo.thumbnail ? [{ url: ytDlpInfo.thumbnail }] : []),
          viewCount: ytDlpInfo.view_count ? ytDlpInfo.view_count.toString() : '0',
          publishDate: ytDlpInfo.upload_date || '',
          videoId: ytDlpInfo.id || ''
        },
        formats: ytDlpInfo.formats || []
      };
      
      // Limpar timeout se a requisição foi bem-sucedida
      if (timeoutId) clearTimeout(timeoutId);
      console.log('Informações obtidas, processando...');
    } catch (raceError) {
      // Limpar timeout em caso de erro
      if (timeoutId) clearTimeout(timeoutId);
      if (safetyTimeout) clearTimeout(safetyTimeout);
      console.error('Erro ao obter info:', raceError.message);
      throw raceError;
    }

    // Verificar se temos informações válidas
    if (!info || !info.videoDetails) {
      if (safetyTimeout) clearTimeout(safetyTimeout);
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
      // Verificar se há formatos disponíveis
      if (!info.formats || info.formats.length === 0) {
        console.log('Nenhum formato disponível para este vídeo');
        formats = [];
      } else {
        // yt-dlp usa 'vcodec' e 'acodec' para detectar vídeo/áudio
        // Primeiro tentar formatos com vídeo e áudio
        formats = info.formats.filter(format => 
          format.vcodec && format.vcodec !== 'none' && 
          format.acodec && format.acodec !== 'none'
        );
        
        // Se não houver, usar apenas vídeo
        if (formats.length === 0) {
          formats = info.formats.filter(format => 
            format.vcodec && format.vcodec !== 'none'
          );
        }
        
        // Limitar a 10 formatos para vídeos longos (mais rápido)
        // Priorizar qualidades mais comuns (720p, 480p, 360p)
        if (formats.length > 10) {
          // Ordenar por qualidade e pegar os 10 primeiros
          formats = formats.slice(0, 10);
        }
        
        // Processar formatos de forma mais eficiente
        // yt-dlp usa formato diferente, adaptar
        formats = formats.map(format => {
          try {
            // yt-dlp usa 'filesize' ou 'filesize_approx'
            const sizeBytes = format.filesize ? parseInt(format.filesize) : 
                            (format.filesize_approx ? parseInt(format.filesize_approx) : 0);
            
            // yt-dlp usa 'format_note' ou 'height' para qualidade
            const quality = format.format_note || 
                          (format.height ? `${format.height}p` : null) ||
                          format.quality || 'unknown';
            
            // yt-dlp usa 'ext' para container
            const container = format.ext || format.container || 'unknown';
            
            if (sizeBytes > 0) {
              return {
                quality: quality,
                container: container,
                size: formatBytes(sizeBytes),
                sizeBytes: sizeBytes
              };
            }
            return null;
          } catch (err) {
            return null;
          }
        }).filter(f => f !== null);
      }
      
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

    if (safetyTimeout) clearTimeout(safetyTimeout);
    console.log('✓ Processamento concluído, enviando resposta...');
    sendResponse(200, videoInfo);
  } catch (error) {
    if (safetyTimeout) clearTimeout(safetyTimeout);
    console.error('=== ERRO CAPTURADO ===');
    console.error('Tipo do erro:', error?.constructor?.name);
    console.error('Mensagem do erro:', error?.message);
    console.error('Erro completo:', error);
    if (error?.stack) {
      console.error('Stack trace:', error.stack);
    }
    
    // Se não foi possível enviar resposta ainda, tentar enviar erro genérico
    if (!responseSent) {
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
    } else {
      // Se já foi enviada resposta, apenas logar
      console.log('Resposta já foi enviada, ignorando erro adicional');
    }
  } finally {
    if (typeof safetyTimeout !== 'undefined') {
      clearTimeout(safetyTimeout);
    }
    console.log('=== FIM DA REQUISIÇÃO ===\n');
  }
};

