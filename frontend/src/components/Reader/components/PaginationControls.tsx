import React from 'react';
import { Button } from '../../../components/v2';

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  onPrevPage: () => void;
  onNextPage: () => void;
  onGoToPage: (page: number) => void;
}

export const PaginationControls: React.FC<PaginationControlsProps> = ({
  currentPage,
  totalPages,
  onPrevPage,
  onNextPage,
}) => {
  if (totalPages <= 1) return null;

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white px-4 py-2 rounded-full flex items-center gap-4 z-30">
      <Button
        variant="secondary"
        size="sm"
        onClick={onPrevPage}
        disabled={currentPage <= 1}
        className="text-white bg-transparent border-white/30 hover:bg-white/10 disabled:opacity-30"
      >
        上一页
      </Button>
      <span className="text-sm">
        {currentPage} / {totalPages}
      </span>
      <Button
        variant="secondary"
        size="sm"
        onClick={onNextPage}
        disabled={currentPage >= totalPages}
        className="text-white bg-transparent border-white/30 hover:bg-white/10 disabled:opacity-30"
      >
        下一页
      </Button>
    </div>
  );
};

export default PaginationControls;
