import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useReaderStore } from '../stores/readerStore';
import { Card } from '../../../components/v2';

interface ReaderMenuProps {
  projectId: number;
  chapterIndex: number;
  isShare?: boolean;
}

export const ReaderMenu: React.FC<ReaderMenuProps> = ({ projectId, chapterIndex, isShare = false }) => {
  const navigate = useNavigate();
  const isVisible = useReaderStore((state) => state.isMenuVisible);
  const setMenuVisible = useReaderStore((state) => state.setMenuVisible);
  const setTocVisible = useReaderStore((state) => state.setTocVisible);
  const setSettingsVisible = useReaderStore((state) => state.setSettingsVisible);
  const setBookmarkVisible = useReaderStore((state) => state.setBookmarkVisible);
  const setSearchVisible = useReaderStore((state) => state.setSearchVisible);
  const currentPage = useReaderStore((state) => state.currentPage);
  const addBookmark = useReaderStore((state) => state.addBookmark);

  if (!isVisible) return null;

  // 点击背景关闭菜单
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      setMenuVisible(false);
    }
  };

  const handleAddBookmark = () => {
    addBookmark(projectId, chapterIndex, currentPage);
    setMenuVisible(false);
  };

  const handleOpenSettings = () => {
    setSettingsVisible(true);
    setMenuVisible(false);
  };

  const handleOpenToc = () => {
    setTocVisible(true);
    setMenuVisible(false);
  };

  const handleOpenBookmarks = () => {
    setBookmarkVisible(true);
    setMenuVisible(false);
  };

  const handleOpenSearch = () => {
    setSearchVisible(true);
    setMenuVisible(false);
  };

  const handleSwitchToEdit = () => {
    navigate(`/projects/${projectId}/write/${chapterIndex}`);
  };

  const isMobile = window.innerWidth < 768;

  const menuItemClass = "flex items-center justify-center py-4 px-3 rounded-full border border-[#e8ddd0] bg-transparent text-[#3a2c1f] hover:bg-[rgba(91,127,110,0.05)] hover:border-[#5b7f6e] transition-colors cursor-pointer font-inter font-medium";
  const primaryClass = "flex items-center justify-center py-4 px-3 rounded-full bg-[#5b7f6e] text-[#faf7f2] hover:bg-[#4a6b5c] transition-colors cursor-pointer font-inter font-medium";

  return (
    <div
      className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      {isMobile ? (
        // 移动端：底部抽屉
        <Card className="absolute bottom-0 left-0 right-0 rounded-t-[24px] rounded-b-none p-6">
          <h3 className="text-xl font-inter font-medium mb-5 text-[#3a2c1f]">阅读菜单</h3>
          <div className="grid grid-cols-2 gap-3">
            <button className={menuItemClass} onClick={handleOpenToc}>
              <span className="font-inter text-lg">目录</span>
            </button>
            <button className={menuItemClass} onClick={handleOpenSettings}>
              <span className="font-inter text-lg">设置</span>
            </button>
            <button className={menuItemClass} onClick={handleAddBookmark}>
              <span className="font-inter text-lg">添加书签</span>
            </button>
            <button className={menuItemClass} onClick={handleOpenSearch}>
              <span className="font-inter text-lg">全文搜索</span>
            </button>
            {!isShare && (
              <button className={`${primaryClass} col-span-2`} onClick={handleSwitchToEdit}>
                <span className="font-inter text-lg">切换到编辑模式</span>
              </button>
            )}
          </div>
        </Card>
      ) : (
        // 桌面端：居中浮层
        <Card className="w-full max-w-lg p-8">
          <h3 className="text-3xl font-inter font-medium mb-8 text-center text-[#3a2c1f]">阅读菜单</h3>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <button className={`${menuItemClass} text-xl`} onClick={handleOpenToc}>
              <span className="font-inter">目录</span>
            </button>
            <button className={`${menuItemClass} text-xl`} onClick={handleOpenSettings}>
              <span className="font-inter">设置</span>
            </button>
            <button className={`${menuItemClass} text-xl`} onClick={handleOpenBookmarks}>
              <span className="font-inter">我的书签</span>
            </button>
            <button className={`${menuItemClass} text-xl`} onClick={handleOpenSearch}>
              <span className="font-inter">全文搜索</span>
            </button>
          </div>
          {!isShare && (
            <button className={`${primaryClass} w-full text-xl`} onClick={handleSwitchToEdit}>
              <span className="font-inter">切换到编辑模式</span>
            </button>
          )}
        </Card>
      )}
    </div>
  );
};

export default ReaderMenu;
