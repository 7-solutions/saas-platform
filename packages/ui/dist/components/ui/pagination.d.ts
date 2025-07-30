import * as React from "react";
interface PaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    className?: string;
}
declare const Pagination: React.FC<PaginationProps>;
export { Pagination };
//# sourceMappingURL=pagination.d.ts.map