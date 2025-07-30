import * as React from "react";
interface DialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: React.ReactNode;
}
interface DialogContentProps {
    className?: string;
    children: React.ReactNode;
}
interface DialogHeaderProps {
    className?: string;
    children: React.ReactNode;
}
interface DialogTitleProps {
    className?: string;
    children: React.ReactNode;
}
interface DialogDescriptionProps {
    className?: string;
    children: React.ReactNode;
}
interface DialogFooterProps {
    className?: string;
    children: React.ReactNode;
}
declare const Dialog: React.FC<DialogProps>;
declare const DialogContent: React.FC<DialogContentProps>;
declare const DialogHeader: React.FC<DialogHeaderProps>;
declare const DialogTitle: React.FC<DialogTitleProps>;
declare const DialogDescription: React.FC<DialogDescriptionProps>;
declare const DialogFooter: React.FC<DialogFooterProps>;
export { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, };
//# sourceMappingURL=dialog.d.ts.map