import React, { useState, useEffect, useCallback } from 'react';
import { Play, X, Plus, Music, Settings, LayoutGrid, Dices, Gift, ChevronLeft, ChevronRight, Trash2, AlertCircle, Sparkles } from 'lucide-react';

// --- Default Test Data (YouTube Music Playlist) ---
interface Song {
  id: number;
  title: string;
  artist: string;
  coverUrl: string;
  youtubeMusicUrl: string;
}

const initialSongs: Song[] = [
  {
    id: 1,
    title: '夜に駆ける',
    artist: 'YOASOBI',
    coverUrl: '/covers/yoasobi_yoru_ni_kakeru.png',
    youtubeMusicUrl: 'https://music.youtube.com/watch?v=by4SYYWlhEs'
  },
  {
    id: 2,
    title: 'Shape of You',
    artist: 'Ed Sheeran',
    coverUrl: '/covers/ed_sheeran_shape_of_you.png',
    youtubeMusicUrl: 'https://music.youtube.com/watch?v=JGwWNGJdvx8'
  },
  {
    id: 3,
    title: 'Blinding Lights',
    artist: 'The Weeknd',
    coverUrl: '/covers/the_weeknd_blinding_lights.png',
    youtubeMusicUrl: 'https://music.youtube.com/watch?v=4NRXx6U8ABQ'
  }
];

// --- Gacha Test Data (Hidden Pool) ---
const initialGachaSongs: Song[] = [
  {
    id: 101,
    title: 'Bling-Bang-Bang-Born',
    artist: 'Creepy Nuts',
    coverUrl: '/covers/creepy_nuts_bbbb.png',
    youtubeMusicUrl: 'https://music.youtube.com/watch?v=210R0ozmLwg'
  },
  {
    id: 102,
    title: 'Idol (アイドル)',
    artist: 'YOASOBI',
    coverUrl: '/covers/yoasobi_idol.png',
    youtubeMusicUrl: 'https://music.youtube.com/watch?v=ZRtdQ81jCgA'
  }
];

function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initialValue;
    try {
      const item = window.localStorage.getItem(key);
      if (!item) return initialValue;
      
      const parsed = JSON.parse(item);
      // Migrate old appleMusicUrl keys, values, and cover URLs to new AI assets if needed
      if (Array.isArray(parsed)) {
        const defaultYoutubeUrls: Record<number, string> = {
          1: 'https://music.youtube.com/watch?v=by4SYYWlhEs',
          2: 'https://music.youtube.com/watch?v=JGwWNGJdvx8',
          3: 'https://music.youtube.com/watch?v=4NRXx6U8ABQ',
          101: 'https://music.youtube.com/watch?v=210R0ozmLwg',
          102: 'https://music.youtube.com/watch?v=ZRtdQ81jCgA',
        };
        const defaultCovers: Record<number, string> = {
          1: '/covers/yoasobi_yoru_ni_kakeru.png',
          2: '/covers/ed_sheeran_shape_of_you.png',
          3: '/covers/the_weeknd_blinding_lights.png',
          101: '/covers/creepy_nuts_bbbb.png',
          102: '/covers/yoasobi_idol.png',
        };

        const migrated = parsed.map((song: any) => {
          let updatedUrl = song.youtubeMusicUrl || song.appleMusicUrl || '';
          let updatedCover = song.coverUrl || '';
          
          // If the URL contains apple music or is empty, resolve it
          if (!updatedUrl || updatedUrl.includes('apple.com') || updatedUrl.includes('music.apple.com')) {
            if (defaultYoutubeUrls[song.id]) {
              updatedUrl = defaultYoutubeUrls[song.id];
            } else {
              // Fallback for user-added songs that had Apple Music URLs
              updatedUrl = 'https://music.youtube.com/watch?v=by4SYYWlhEs';
            }
          }

          // Force update cover URL for default songs to use the new AI-generated images
          if (defaultCovers[song.id]) {
            updatedCover = defaultCovers[song.id];
          }

          return {
            id: song.id,
            title: song.title,
            artist: song.artist,
            coverUrl: updatedCover,
            youtubeMusicUrl: updatedUrl
          };
        });
        return migrated as unknown as T;
      }
      return parsed;
    } catch (error) {
      console.warn(`Error reading localStorage (Key: ${key}):`, error);
      return initialValue;
    }
  });

  const setValue = useCallback((value: T | ((val: T) => T)) => {
    try {
      setStoredValue((prev: T) => {
        const valueToStore = typeof value === 'function' ? (value as Function)(prev) : value;
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(key, JSON.stringify(valueToStore));
        }
        return valueToStore;
      });
    } catch (error) {
      console.warn(`Error setting localStorage (Key: ${key}):`, error);
    }
  }, [key]);

  return [storedValue, setValue];
}

export default function App() {
  const [songs, setSongs] = useLocalStorage<Song[]>('aura_songs_list', initialSongs);
  const [gachaSongs, setGachaSongs] = useLocalStorage<Song[]>('aura_gacha_songs_list', initialGachaSongs);

  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [viewMode, setViewMode] = useState<string>('user'); // 'user', 'admin', 'gacha'
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isHovering, setIsHovering] = useState<boolean>(false);
  const [formData, setFormData] = useState({ title: '', artist: '', coverUrl: '', youtubeMusicUrl: '', targetPlaylist: 'main' });

  // Player overlay state
  const [isEmbedLoaded, setIsEmbedLoaded] = useState<boolean>(false);

  // Custom UI components to replace native alert/confirm
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ message: string; onConfirm: () => void } | null>(null);

  // Prevent out-of-bounds indexing when songs are deleted
  useEffect(() => {
    if (songs.length === 0) {
      setCurrentIndex(0);
    } else if (currentIndex >= songs.length) {
      setCurrentIndex(songs.length - 1);
    }
  }, [songs.length, currentIndex]);

  // Reset player play state when song is closed or changed
  useEffect(() => {
    setIsEmbedLoaded(false);
  }, [selectedSong]);

  // Auto-carousel timer
  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (viewMode === 'user' && songs.length > 0 && !selectedSong && !isHovering && !confirmDialog) {
      timer = setInterval(() => {
        setCurrentIndex((prev: number) => (prev + 1) % songs.length);
      }, 3000);
    }
    return () => clearInterval(timer);
  }, [viewMode, songs.length, selectedSong, isHovering, confirmDialog]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (viewMode !== 'user' || selectedSong || confirmDialog || songs.length <= 1) return;
      if (e.key === 'ArrowLeft') {
        setCurrentIndex((prev: number) => (prev === 0 ? songs.length - 1 : prev - 1));
      } else if (e.key === 'ArrowRight') {
        setCurrentIndex((prev: number) => (prev + 1) % songs.length);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode, selectedSong, confirmDialog, songs.length]);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const getYoutubeEmbed = (url: string): string | null => {
    if (!url) return null;
    if (url.includes('youtube.com/embed/')) return url;

    let videoId: string | null = null;
    try {
      if (url.includes('youtu.be/')) {
        videoId = url.split('youtu.be/')[1].split(/[?#]/)[0];
      } else if (url.includes('v=')) {
        videoId = url.split('v=')[1].split(/[&?#]/)[0];
      } else if (url.includes('embed/')) {
        videoId = url.split('embed/')[1].split(/[?#]/)[0];
      }
    } catch (error) {
      console.warn("Error parsing YouTube URL:", error);
    }

    if (videoId) {
      return `https://www.youtube.com/embed/${videoId}?autoplay=1`;
    }
    return null;
  };

  const handleAddSong = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const embedUrl = getYoutubeEmbed(formData.youtubeMusicUrl);

    if (!embedUrl) {
      showToast('請輸入有效的 YouTube Music 或影片網址！');
      return;
    }

    if (!formData.title.trim() || !formData.artist.trim()) {
      showToast('請填寫完整的歌曲與歌手名稱！');
      return;
    }

    const newSong = {
      id: Date.now(),
      title: formData.title.trim(),
      artist: formData.artist.trim(),
      coverUrl: formData.coverUrl.trim() || 'https://images.unsplash.com/photo-1614680376573-df3480f0c6ff?auto=format&fit=crop&q=80&w=500', // default fallback
      youtubeMusicUrl: formData.youtubeMusicUrl.trim()
    };

    if (formData.targetPlaylist === 'gacha') {
      setGachaSongs([newSong, ...gachaSongs]);
      showToast('已成功加入抽抽樂隱藏池！');
    } else {
      setSongs([newSong, ...songs]);
      setCurrentIndex(0);
      showToast('已成功加入精選輪播歌單！');
    }

    setFormData(prev => ({ ...prev, title: '', artist: '', coverUrl: '', youtubeMusicUrl: '' }));
  };

  const handleDeleteSong = (id: number) => {
    setConfirmDialog({
      message: '確定要從精選歌單中刪除此歌曲嗎？',
      onConfirm: () => {
        setSongs((prevSongs: Song[]) => prevSongs.filter((song: Song) => song.id !== id));
        setConfirmDialog(null);
      }
    });
  };

  const handleDeleteGacha = (id: number) => {
    setConfirmDialog({
      message: '確定要從抽抽樂隱藏池中刪除此歌曲嗎？',
      onConfirm: () => {
        setGachaSongs((prevGachaSongs: Song[]) => prevGachaSongs.filter((song: Song) => song.id !== id));
        setConfirmDialog(null);
      }
    });
  };

  const handleDrawSong = () => {
    if (gachaSongs.length === 0) {
      showToast('抽抽樂歌單目前是空的，請先到後台新增歌曲！');
      return;
    }
    const randomIndex = Math.floor(Math.random() * gachaSongs.length);
    setSelectedSong(gachaSongs[randomIndex]);
  };

  return (
    <div className="min-h-screen bg-dark-bg text-white font-sans selection:bg-gold selection:text-black flex flex-col justify-between relative overflow-hidden">
      
      {/* Background Ambient Glows */}
      <div className="ambient-glow animate-pulse-glow top-[-200px] left-[-200px]" />
      <div className="ambient-glow animate-pulse-glow bottom-[-200px] right-[-200px] [animation-delay:-4s]" />

      <div className="z-10 flex flex-col min-h-screen justify-between">
        {/* Header Navigation */}
        <nav className="sticky top-0 z-40 bg-[#0d0d0d]/75 backdrop-blur-xl border-b border-white/5 px-6 py-4 flex flex-col sm:flex-row gap-4 justify-between items-center shadow-[0_4px_30px_rgba(0,0,0,0.4)]">
          <div className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gold to-gold-dark flex items-center justify-center shadow-[0_0_20px_rgba(212,175,55,0.4)] group-hover:scale-105 transition-transform duration-300">
              <Music size={20} className="text-[#0d0d0d] font-bold" />
            </div>
            <h1 className="text-xl font-bold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-gold">
              AURA <span className="text-gold font-light tracking-normal">MUSIC</span>
            </h1>
          </div>

          {/* Navigation tabs */}
          <div className="flex gap-1.5 bg-white/5 p-1 rounded-full border border-white/10 overflow-x-auto w-full sm:w-auto max-w-full no-scrollbar justify-center">
            <button
              onClick={() => setViewMode('user')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-full transition-all duration-300 whitespace-nowrap cursor-pointer ${
                viewMode === 'user'
                  ? 'bg-gold/20 text-gold shadow-[0_0_15px_rgba(212,175,55,0.25)] border-t border-white/10'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <LayoutGrid size={16} />
              <span className="text-sm font-medium tracking-wide">精選輪播</span>
            </button>
            <button
              onClick={() => setViewMode('gacha')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-full transition-all duration-300 whitespace-nowrap cursor-pointer ${
                viewMode === 'gacha'
                  ? 'bg-gold/20 text-gold shadow-[0_0_15px_rgba(212,175,55,0.25)] border-t border-white/10'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Dices size={16} />
              <span className="text-sm font-medium tracking-wide">命運選歌</span>
            </button>
            <button
              onClick={() => setViewMode('admin')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-full transition-all duration-300 whitespace-nowrap cursor-pointer ${
                viewMode === 'admin'
                  ? 'bg-gold/20 text-gold shadow-[0_0_15px_rgba(212,175,55,0.25)] border-t border-white/10'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Settings size={16} />
              <span className="text-sm font-medium tracking-wide">後台管理</span>
            </button>
          </div>
        </nav>

        {/* Main Workspace */}
        <main className="container mx-auto px-4 sm:px-6 py-10 flex-grow flex flex-col justify-center">

          {/* User Mode (Carousel) */}
          {viewMode === 'user' && (
            <div className="flex flex-col items-center justify-center space-y-8 animate-fade-in duration-500">
              {songs.length > 0 ? (
                <>
                  <div className="text-center space-y-2 mb-2">
                    <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-widest uppercase">
                      Editor's Pick
                    </h2>
                    <p className="text-gold text-xs tracking-[0.25em] uppercase font-semibold flex items-center justify-center gap-1.5">
                      <Sparkles size={12} className="text-gold animate-pulse" />
                      編輯精選歌單
                    </p>
                  </div>

                  <div className="flex items-center gap-4 md:gap-10 w-full max-w-5xl justify-center relative">
                    <button
                      onClick={() => setCurrentIndex((prev: number) => (prev === 0 ? songs.length - 1 : prev - 1))}
                      className="absolute left-0 sm:static p-3.5 sm:p-4 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-gold transition-all duration-300 backdrop-blur-md border border-white/10 hover:border-gold/30 hover:scale-105 active:scale-95 z-10 cursor-pointer shadow-lg"
                    >
                      <ChevronLeft size={24} className="md:w-7 md:h-7" />
                    </button>

                    {(() => {
                      const currentSong = songs[currentIndex] || songs[songs.length - 1] || null;
                      if (!currentSong) return null;

                      return (
                        <div
                          onMouseEnter={() => setIsHovering(true)}
                          onMouseLeave={() => setIsHovering(false)}
                          className="group relative w-72 h-72 sm:w-80 sm:h-80 md:w-[420px] md:h-[420px] rounded-3xl overflow-hidden shadow-2xl transition-all duration-500 border border-white/10 hover:border-gold/40 hover:shadow-[0_20px_50px_rgba(212,175,55,0.2)]"
                        >
                          <img
                            src={currentSong.coverUrl}
                            alt={currentSong.title}
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                          />

                          {/* Gradient Overlay */}
                          <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] via-[#09090b]/40 to-transparent opacity-85"></div>

                          {/* Song Info */}
                          <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8 text-center transform transition-transform duration-300 group-hover:-translate-y-2">
                            <h3 className="text-xl md:text-3xl font-bold text-white mb-1.5 md:mb-2 truncate drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
                              {currentSong.title}
                            </h3>
                            <p className="text-sm md:text-lg text-gold truncate font-light tracking-wide drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                              {currentSong.artist}
                            </p>
                          </div>

                          {/* Hover Play Overlay */}
                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center pb-20">
                            <button
                              onClick={() => setSelectedSong(currentSong)}
                              className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-gold/90 hover:bg-gold text-[#0d0d0d] backdrop-blur-md flex items-center justify-center shadow-[0_0_35px_rgba(212,175,55,0.6)] transform scale-75 group-hover:scale-100 transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer border border-white/20"
                            >
                              <Play size={32} className="text-[#0d0d0d] fill-current ml-1.5 md:w-9 md:h-9" />
                            </button>
                          </div>

                          {/* Individual Delete Button */}
                          <button
                            onClick={(e: React.MouseEvent) => {
                              e.stopPropagation();
                              handleDeleteSong(currentSong.id);
                            }}
                            className="absolute top-4 right-4 p-2.5 bg-red-950/80 hover:bg-red-600 text-red-200 hover:text-white rounded-full transition-all duration-300 opacity-0 group-hover:opacity-100 shadow-lg border border-red-500/20 hover:scale-105 active:scale-95 cursor-pointer"
                            title="從精選歌單刪除"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      );
                    })()}

                    <button
                      onClick={() => setCurrentIndex((prev: number) => (prev + 1) % songs.length)}
                      className="absolute right-0 sm:static p-3.5 sm:p-4 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-gold transition-all duration-300 backdrop-blur-md border border-white/10 hover:border-gold/30 hover:scale-105 active:scale-95 z-10 cursor-pointer shadow-lg"
                    >
                      <ChevronRight size={24} className="md:w-7 md:h-7" />
                    </button>
                  </div>

                  {/* Carousel Indicators */}
                  <div className="flex gap-2 mt-4 flex-wrap justify-center px-4 max-w-full">
                    {songs.map((_: Song, idx: number) => (
                      <button
                        key={idx}
                        onClick={() => setCurrentIndex(idx)}
                        className={`h-1.5 rounded-full transition-all duration-500 cursor-pointer ${
                          idx === currentIndex
                            ? 'bg-gold w-8 shadow-[0_0_12px_rgba(212,175,55,0.8)]'
                            : 'bg-white/15 w-2 hover:bg-white/40'
                        }`}
                      />
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-12 px-8 bg-white/5 backdrop-blur-md rounded-3xl border border-white/10 max-w-md mx-4 shadow-xl">
                  <Music size={44} className="mx-auto mb-4 text-gold opacity-50 animate-pulse" />
                  <p className="text-gray-400 text-sm tracking-wide">精選輪播歌單目前是空的，請先到後台新增歌曲！</p>
                </div>
              )}
            </div>
          )}

          {/* Gacha Mode */}
          {viewMode === 'gacha' && (
            <div className="flex flex-col items-center justify-center space-y-12 animate-fade-in duration-500 px-4">
              <div className="text-center space-y-3">
                <h2 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-gold-light via-gold to-gold-dark drop-shadow-[0_0_30px_rgba(212,175,55,0.25)] tracking-wider">
                  命運選歌
                </h2>
                <p className="text-gray-400 text-sm tracking-widest font-light">不知道聽什麼？讓命運為你決定下一首旋律</p>
              </div>

              {/* Glowing Interactive Gacha Button */}
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-gold/15 blur-2xl animate-pulse"></div>
                <button
                  onClick={handleDrawSong}
                  className="group relative flex flex-col items-center justify-center w-56 h-56 md:w-60 md:h-60 rounded-full bg-gradient-to-tr from-[#1a1a1a] via-[#262626] to-[#121212] border border-gold/40 text-gold shadow-[0_0_40px_rgba(0,0,0,0.8)] hover:shadow-[0_0_50px_rgba(212,175,55,0.3)] transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer"
                >
                  <div className="absolute inset-2.5 rounded-full border border-dashed border-gold/20 group-hover:border-gold/40 animate-[spin_12s_linear_infinite] transition-colors"></div>
                  <Gift size={52} className="mb-3.5 text-gold group-hover:-translate-y-3 transition-transform duration-300 w-12 h-12 md:w-14 md:h-14" />
                  <span className="text-lg md:text-xl font-bold tracking-[0.2em] text-white">啟動命運</span>
                  <span className="text-[10px] text-gold/60 mt-1 uppercase tracking-widest">Roll Music</span>
                </button>
              </div>

              <div className="flex items-center gap-3 px-5 py-3 rounded-full bg-white/5 border border-white/5 backdrop-blur-md text-center shadow-lg">
                <Dices size={16} className="text-gold flex-shrink-0" />
                <p className="text-xs text-gray-300 tracking-wider">
                  專屬抽卡池中共有 <span className="text-gold font-bold text-base mx-1">{gachaSongs.length}</span> 首隱藏好歌
                </p>
              </div>
            </div>
          )}

          {/* Admin Mode */}
          {viewMode === 'admin' && (
            <div className="max-w-4xl mx-auto space-y-10 animate-fade-in duration-500 w-full">
              {/* Add Song Panel */}
              <div className="bg-white/5 backdrop-blur-xl border border-white/5 rounded-3xl p-6 sm:p-8 shadow-2xl">
                <div className="flex items-center gap-4 mb-6 border-b border-white/5 pb-5">
                  <div className="p-3 rounded-xl bg-gold/10 text-gold flex-shrink-0">
                    <Plus size={20} />
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold tracking-wide">新增音樂庫</h2>
                    <p className="text-gray-400 text-xs mt-0.5">支援加入 YouTube Music 連結並分配至不同歌單</p>
                  </div>
                </div>

                <form onSubmit={handleAddSong} className="space-y-6">
                  {/* Playlist Selection */}
                  <div className="space-y-2.5">
                    <label className="text-xs font-semibold text-gray-400 tracking-wider uppercase">選擇發佈位置</label>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <label className={`flex-1 flex sm:flex-col items-center justify-start sm:justify-center gap-3 p-4 rounded-2xl border cursor-pointer transition-all duration-300 ${
                        formData.targetPlaylist === 'main'
                          ? 'border-gold bg-gold/10 text-gold shadow-[0_0_15px_rgba(212,175,55,0.1)]'
                          : 'border-white/5 bg-white/2 hover:bg-white/5 text-gray-400'
                      }`}>
                        <input
                          type="radio"
                          value="main"
                          checked={formData.targetPlaylist === 'main'}
                          onChange={() => setFormData({ ...formData, targetPlaylist: 'main' })}
                          className="hidden"
                        />
                        <LayoutGrid size={20} />
                        <span className="font-bold tracking-wider text-xs sm:text-sm">精選輪播歌單</span>
                      </label>
                      <label className={`flex-1 flex sm:flex-col items-center justify-start sm:justify-center gap-3 p-4 rounded-2xl border cursor-pointer transition-all duration-300 ${
                        formData.targetPlaylist === 'gacha'
                          ? 'border-gold bg-gold/10 text-gold shadow-[0_0_15px_rgba(212,175,55,0.1)]'
                          : 'border-white/5 bg-white/2 hover:bg-white/5 text-gray-400'
                      }`}>
                        <input
                          type="radio"
                          value="gacha"
                          checked={formData.targetPlaylist === 'gacha'}
                          onChange={() => setFormData({ ...formData, targetPlaylist: 'gacha' })}
                          className="hidden"
                        />
                        <Dices size={20} />
                        <span className="font-bold tracking-wider text-xs sm:text-sm">抽抽樂隱藏池</span>
                      </label>
                    </div>
                  </div>

                  {/* Basic Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs text-gray-400 font-medium">歌曲名稱</label>
                      <input
                        required
                        type="text"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        className="w-full bg-white/2 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition-all text-sm"
                        placeholder="例如: 告白氣球"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs text-gray-400 font-medium">歌手名稱</label>
                      <input
                        required
                        type="text"
                        value={formData.artist}
                        onChange={(e) => setFormData({ ...formData, artist: e.target.value })}
                        className="w-full bg-white/2 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition-all text-sm"
                        placeholder="例如: 周杰倫"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs text-gray-400 font-medium">專輯封面圖片網址 (URL)</label>
                    <input
                      type="url"
                      value={formData.coverUrl}
                      onChange={(e) => setFormData({ ...formData, coverUrl: e.target.value })}
                      className="w-full bg-white/2 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition-all text-sm"
                      placeholder="https://..."
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs text-gold font-medium">YouTube Music 歌曲連結 (必填)</label>
                    <input
                      required
                      type="url"
                      value={formData.youtubeMusicUrl}
                      onChange={(e) => setFormData({ ...formData, youtubeMusicUrl: e.target.value })}
                      className="w-full bg-white/2 border border-gold/40 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/30 transition-all text-sm"
                      placeholder="例如: https://music.youtube.com/watch?v=..."
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full mt-4 bg-gradient-to-r from-gold to-gold-dark hover:opacity-90 text-[#0d0d0d] font-bold py-3 rounded-xl shadow-[0_8px_25px_rgba(212,175,55,0.2)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 text-sm tracking-wider cursor-pointer"
                  >
                    新增至音樂庫
                  </button>
                </form>
              </div>

              {/* Playlist Management */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Carousel List */}
                <div className="bg-white/5 border border-white/5 rounded-3xl p-5 shadow-xl space-y-4">
                  <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2 pb-3 border-b border-white/5">
                    <LayoutGrid size={15} className="text-gold" />
                    精選輪播歌單 ({songs.length})
                  </h3>
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {songs.map((song) => (
                      <div key={song.id} className="flex items-center justify-between p-3 bg-white/2 hover:bg-white/5 rounded-xl border border-white/5 transition-all duration-300">
                        <div className="flex items-center gap-3 min-w-0">
                          <img src={song.coverUrl} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                          <div className="min-w-0">
                            <h4 className="text-xs font-bold text-white truncate">{song.title}</h4>
                            <p className="text-[10px] text-gray-400 truncate mt-0.5">{song.artist}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteSong(song.id)}
                          className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all duration-300 flex-shrink-0 cursor-pointer"
                          title="刪除"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                    {songs.length === 0 && <p className="text-xs text-gray-500 text-center py-8">歌單目前是空的</p>}
                  </div>
                </div>

                {/* Gacha List */}
                <div className="bg-white/5 border border-white/5 rounded-3xl p-5 shadow-xl space-y-4">
                  <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2 pb-3 border-b border-white/5">
                    <Dices size={15} className="text-gold" />
                    抽抽樂隱藏池 ({gachaSongs.length})
                  </h3>
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {gachaSongs.map((song) => (
                      <div key={song.id} className="flex items-center justify-between p-3 bg-white/2 hover:bg-white/5 rounded-xl border border-white/5 transition-all duration-300">
                        <div className="flex items-center gap-3 min-w-0">
                          <img src={song.coverUrl} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                          <div className="min-w-0">
                            <h4 className="text-xs font-bold text-white truncate">{song.title}</h4>
                            <p className="text-[10px] text-gray-400 truncate mt-0.5">{song.artist}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteGacha(song.id)}
                          className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all duration-300 flex-shrink-0 cursor-pointer"
                          title="刪除"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                    {gachaSongs.length === 0 && <p className="text-xs text-gray-500 text-center py-8">歌單目前是空的</p>}
                  </div>
                </div>
              </div>
            </div>
          )}

        </main>

        {/* Footer */}
        <footer className="w-full text-center py-6 text-[10px] text-gray-500 border-t border-white/5 px-4 z-10 tracking-widest uppercase">
          &copy; {new Date().getFullYear()} AURA MUSIC. All rights reserved.
        </footer>
      </div>

      {/* Music Player Modal */}
      {selectedSong && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 transition-all duration-300">
          {/* Backdrop Blur Overlay */}
          <div
            className="absolute inset-0 bg-black/85 backdrop-blur-md animate-fade-in"
            onClick={() => setSelectedSong(null)}
          ></div>

          {/* Player Container */}
          <div className="relative w-full max-w-xl bg-[#141416]/90 border border-white/10 rounded-3xl overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.8),0_0_40px_rgba(212,175,55,0.05)] z-10 flex flex-col transform scale-100 animate-zoom-in">
            {/* Header */}
            <div className="flex justify-between items-center p-4 border-b border-white/5 bg-white/5 backdrop-blur-md">
              <div className="flex items-center gap-3 min-w-0">
                <img src={selectedSong.coverUrl} alt="cover" className="w-12 h-12 rounded-lg object-cover shadow-md border border-white/10 flex-shrink-0" />
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-white tracking-wide truncate">{selectedSong.title}</h3>
                  <p className="text-[11px] text-gold truncate mt-0.5">{selectedSong.artist}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedSong(null)}
                className="p-2 rounded-full bg-white/5 hover:bg-gold hover:text-black text-gray-300 transition-all duration-300 flex-shrink-0 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Iframe Content / Preview Image Placeholder */}
            <div 
              onClick={!isEmbedLoaded ? () => setIsEmbedLoaded(true) : undefined}
              className={`w-full bg-[#0a0a0b] flex items-center justify-center min-h-[320px] relative overflow-hidden group ${!isEmbedLoaded ? 'cursor-pointer' : ''}`}
            >
              {!isEmbedLoaded ? (
                <div className="w-full flex flex-col items-center justify-center py-8 relative z-10 transition-all duration-300 hover:scale-[1.02]">
                  {/* Blurry Background Cover */}
                  <img 
                    src={selectedSong.coverUrl} 
                    alt="" 
                    className="absolute inset-0 w-full h-full object-cover blur-xl opacity-35 scale-110 z-0"
                  />
                  
                  {/* Album Card Preview */}
                  <div className="relative z-10 w-44 h-44 sm:w-48 sm:h-48 rounded-2xl overflow-hidden shadow-2xl border border-white/10 group-hover:border-gold/40 transition-all duration-500">
                    <img 
                      src={selectedSong.coverUrl} 
                      alt={selectedSong.title} 
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Play Overlay */}
                  <div className="mt-4 flex flex-col items-center gap-3 z-10">
                    <div className="w-16 h-16 rounded-full bg-gold/90 text-[#0d0d0d] flex items-center justify-center shadow-[0_0_30px_rgba(212,175,55,0.4)] group-hover:scale-110 group-hover:bg-gold transition-all duration-300 border border-white/20">
                      <Play size={24} className="fill-current ml-1" />
                    </div>
                    <span className="text-[10px] text-gold/80 font-bold tracking-widest uppercase bg-black/55 px-3 py-1 rounded-full border border-white/5 backdrop-blur-sm shadow-md">
                      點擊載入並播放音樂
                    </span>
                  </div>
                </div>
              ) : (
                (() => {
                  const embedUrl = getYoutubeEmbed(selectedSong.youtubeMusicUrl);
                  if (!embedUrl) {
                    return <p className="text-xs text-red-400 py-12">無法解析該播放連結</p>;
                  }
                  return (
                    <iframe
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                      frameBorder="0"
                      height="300"
                      title={`YouTube Music: ${selectedSong.title}`}
                      style={{ width: '100%', maxWidth: '100%', overflow: 'hidden', background: 'transparent', height: '300px', border: 'none' }}
                      src={embedUrl}
                    ></iframe>
                  );
                })()
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50 animate-fade-in-up">
          <div className="bg-[#151518] border border-gold/40 text-white px-5 py-3 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.5),0_0_20px_rgba(212,175,55,0.1)] flex items-center gap-3 backdrop-blur-md">
            <AlertCircle size={16} className="text-gold" />
            <span className="text-xs font-semibold tracking-wide">{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-fade-in duration-300">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setConfirmDialog(null)}></div>
          <div className="relative bg-[#151518]/95 border border-white/10 rounded-2xl p-6 max-w-xs w-full shadow-2xl animate-zoom-in">
            <h3 className="text-base font-bold text-white mb-1.5 flex items-center gap-2">
              <AlertCircle size={16} className="text-red-500" />
              確認刪除
            </h3>
            <p className="text-gray-400 text-xs leading-relaxed mb-5">{confirmDialog.message}</p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white transition-colors text-xs font-medium cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={confirmDialog.onConfirm}
                className="px-4 py-2 rounded-lg bg-red-650 hover:bg-red-600 text-white border border-red-500/20 transition-all text-xs font-bold cursor-pointer"
              >
                確認
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}