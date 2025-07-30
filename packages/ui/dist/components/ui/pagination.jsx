import * as React from "react";
import { cn } from "../../lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./button";
const Pagination = ({ currentPage, totalPages, onPageChange, className }) => {
    const getVisiblePages = () => {
        const delta = 2;
        const range = [];
        const rangeWithDots = [];
        for (let i = Math.max(2, currentPage - delta); i <= Math.min(totalPages - 1, currentPage + delta); i++) {
            range.push(i);
        }
        if (currentPage - delta > 2) {
            rangeWithDots.push(1, '...');
        }
        else {
            rangeWithDots.push(1);
        }
        rangeWithDots.push(...range);
        if (currentPage + delta < totalPages - 1) {
            rangeWithDots.push('...', totalPages);
        }
        else {
            rangeWithDots.push(totalPages);
        }
        return rangeWithDots;
    };
    if (totalPages <= 1)
        return null;
    const visiblePages = getVisiblePages();
    return (<nav className={cn("flex items-center justify-center space-x-1", className)}>
      <Button variant="outline" size="sm" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage <= 1}>
        <ChevronLeft className="h-4 w-4"/>
        Previous
      </Button>

      {visiblePages.map((page, index) => (<React.Fragment key={index}>
          {page === '...' ? (<span className="px-3 py-2 text-gray-500">...</span>) : (<Button variant={currentPage === page ? "default" : "outline"} size="sm" onClick={() => onPageChange(page)}>
              {page}
            </Button>)}
        </React.Fragment>))}

      <Button variant="outline" size="sm" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage >= totalPages}>
        Next
        <ChevronRight className="h-4 w-4"/>
      </Button>
    </nav>);
};
export { Pagination };
