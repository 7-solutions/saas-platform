import * as React from "react";
import { cn } from "../../lib/utils";
const Dialog = ({ open, onOpenChange, children }) => {
    if (!open)
        return null;
    return (<div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => onOpenChange(false)}/>
      <div className="relative z-50">
        {children}
      </div>
    </div>);
};
const DialogContent = ({ className, children }) => {
    return (<div className={cn("bg-white rounded-lg shadow-lg max-w-md w-full mx-4 p-6", className)}>
      {children}
    </div>);
};
const DialogHeader = ({ className, children }) => {
    return (<div className={cn("mb-4", className)}>
      {children}
    </div>);
};
const DialogTitle = ({ className, children }) => {
    return (<h2 className={cn("text-lg font-semibold text-gray-900", className)}>
      {children}
    </h2>);
};
const DialogDescription = ({ className, children }) => {
    return (<p className={cn("text-sm text-gray-600 mt-2", className)}>
      {children}
    </p>);
};
const DialogFooter = ({ className, children }) => {
    return (<div className={cn("flex justify-end space-x-2 mt-6", className)}>
      {children}
    </div>);
};
export { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, };
