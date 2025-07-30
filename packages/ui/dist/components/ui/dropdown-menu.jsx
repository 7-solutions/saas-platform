"use client";
import * as React from "react";
import { cn } from "../../lib/utils";
const DropdownMenuContext = React.createContext({
    open: false,
    setOpen: () => { }
});
const DropdownMenu = ({ children }) => {
    const [open, setOpen] = React.useState(false);
    return (<DropdownMenuContext.Provider value={{ open, setOpen }}>
      <div className="relative inline-block text-left">
        {children}
      </div>
    </DropdownMenuContext.Provider>);
};
const DropdownMenuTrigger = ({ asChild, children }) => {
    const { open, setOpen } = React.useContext(DropdownMenuContext);
    const handleClick = () => {
        setOpen(!open);
    };
    if (asChild) {
        return React.cloneElement(children, {
            onClick: handleClick
        });
    }
    return (<button onClick={handleClick}>
      {children}
    </button>);
};
const DropdownMenuContent = ({ className, children }) => {
    const { open, setOpen } = React.useContext(DropdownMenuContext);
    if (!open)
        return null;
    return (<>
      <div className="fixed inset-0 z-10" onClick={() => setOpen(false)}/>
      <div className={cn("absolute right-0 z-20 mt-2 w-56 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none", className)}>
        <div className="py-1">
          {children}
        </div>
      </div>
    </>);
};
const DropdownMenuItem = ({ className, onClick, children }) => {
    const { setOpen } = React.useContext(DropdownMenuContext);
    const handleClick = () => {
        onClick?.();
        setOpen(false);
    };
    return (<button className={cn("block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900", className)} onClick={handleClick}>
      {children}
    </button>);
};
const DropdownMenuSeparator = ({ className }) => {
    return (<div className={cn("my-1 h-px bg-gray-200", className)}/>);
};
export { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, };
