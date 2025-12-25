import React, { useState } from 'react';
import './App.css';

interface VideoInfo {
  title: string;
  duration: string;
  author: string;
  thumbnail: string;
  description: string;
  views: number;
  uploadDate: string;
  videoId: string;
  sizes: Array<{
    quality: string;
    container: string;
    size: string;
    sizeBytes: number;
  }>;
}

function App() {
  const [url, setUrl] = useState('');
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevenir múltiplas submissões simultâneas
    if (loading) {
      return;
    }
    
    setLoading(true);
    setError(null);
    setVideoInfo(null);

    try {
      // Usar URL relativa em produção, absoluta em desenvolvimento
      const apiUrl = process.env.NODE_ENV === 'production' 
        ? '/api/video-info'
        : 'http://localhost:5000/api/video-info';

      // Criar AbortController para timeout (aumentado para 90s)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log('Timeout do cliente ativado (90s) - cancelando requisição');
        controller.abort();
      }, 90000); // Timeout de 90s no cliente para dar tempo suficiente

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Verificar se a resposta é JSON antes de tentar fazer parse
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(`Resposta inválida do servidor: ${text.substring(0, 100)}`);
      }

      if (!response.ok) {
        try {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Erro ao buscar informações do vídeo');
        } catch (parseError) {
          throw new Error(`Erro ${response.status}: ${response.statusText}`);
        }
      }

      const data = await response.json();
      setVideoInfo(data);
    } catch (err) {
      let errorMessage = 'Erro desconhecido';
      
      if (err instanceof Error) {
        errorMessage = err.message;
        
        // Mensagens mais amigáveis para erros comuns
        if (err.name === 'AbortError' || err.message.includes('timeout') || err.message.includes('Timeout')) {
          errorMessage = 'A requisição demorou muito. Tente novamente.';
        } else if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError') || err.message.includes('ERR_CONNECTION_RESET') || err.message.includes('ECONNRESET') || err.message.includes('ECONNREFUSED')) {
          errorMessage = 'Não foi possível conectar ao servidor. Verifique se o backend está rodando na porta 5000.';
        } else if (err.message.includes('Proxy')) {
          errorMessage = 'Erro de conexão. Tente novamente.';
        }
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const formatViews = (views: number) => {
    if (views >= 1000000) {
      return (views / 1000000).toFixed(1) + 'M';
    }
    if (views >= 1000) {
      return (views / 1000).toFixed(1) + 'K';
    }
    return views.toString();
  };

  return (
    <div className="App">
      <div className="container">
        <header className="header">
          <h1 className="title">📺 YouTube Info Viewer</h1>
          <p className="subtitle">Obtenha informações detalhadas sobre vídeos do YouTube</p>
        </header>

        <form onSubmit={handleSubmit} className="form">
          <div className="input-group">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Cole a URL do vídeo do YouTube aqui..."
              className="url-input"
              disabled={loading}
            />
            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? '⏳ Buscando...' : '🔍 Buscar'}
            </button>
          </div>
        </form>

        {error && (
          <div className="error-message">
            <span className="error-icon">❌</span>
            {error}
          </div>
        )}

        {videoInfo && (
          <div className="video-info-card">
            <div className="video-header">
              <img src={videoInfo.thumbnail} alt={videoInfo.title} className="thumbnail" />
              <div className="video-details">
                <h2 className="video-title">{videoInfo.title}</h2>
                <div className="video-meta">
                  <span className="meta-item">
                    <strong>Autor:</strong> {videoInfo.author}
                  </span>
                  <span className="meta-item">
                    <strong>Visualizações:</strong> {formatViews(videoInfo.views)}
                  </span>
                  <span className="meta-item">
                    <strong>Data:</strong> {new Date(videoInfo.uploadDate).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              </div>
            </div>

            <div className="info-grid">
              <div className="info-card">
                <div className="info-icon">⏱️</div>
                <div className="info-label">Duração</div>
                <div className="info-value">{videoInfo.duration}</div>
              </div>

              <div className="info-card">
                <div className="info-icon">📊</div>
                <div className="info-label">Qualidades Disponíveis</div>
                <div className="info-value">{videoInfo.sizes.length}</div>
              </div>
            </div>

            {videoInfo.sizes.length > 0 && (
              <div className="sizes-section">
                <h3 className="sizes-title">📦 Tamanhos por Qualidade</h3>
                <div className="sizes-grid">
                  {videoInfo.sizes.map((size, index) => (
                    <div key={index} className="size-card">
                      <div className="size-quality">{size.quality}</div>
                      <div className="size-value">{size.size}</div>
                      <div className="size-container">{size.container.toUpperCase()}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {videoInfo.description && (
              <div className="description-section">
                <h3 className="description-title">📝 Descrição</h3>
                <p className="description-text">{videoInfo.description}...</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
