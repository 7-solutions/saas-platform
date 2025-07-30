import * as React from "react";
interface DropdownMenuProps {
    children: React.ReactNode;
}
interface DropdownMenuTriggerProps {
    asChild?: boolean;
    children: React.ReactNode;
}
interface DropdownMenuContentProps {
    className?: string;
    children: React.ReactNode;
}
interface DropdownMenuItemProps {
    className?: string;
    onClick?: () => void;
    children: React.ReactNode;
}
interface DropdownMenuSeparatorProps {
    className?: string;
}
declare const DropdownMenu: React.FC<DropdownMenuProps>;
declare const DropdownMenuTrigger: React.FC<DropdownMenuTriggerProps>;
declare const DropdownMenuContent: React.FC<DropdownMenuContentProps>;
declare const DropdownMenuItem: React.FC<DropdownMenuItemProps>;
declare const DropdownMenuSeparator: React.FC<DropdownMenuSeparatorProps>;
export { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, };
//# sourceMappingURL=dropdown-menu.d.ts.map