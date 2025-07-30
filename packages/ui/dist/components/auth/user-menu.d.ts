import * as React from "react";
import { User } from "./protected-route";
interface UserMenuProps {
    user: User;
    onLogout: () => void;
    onProfile?: () => void;
    onSettings?: () => void;
    className?: string;
}
export declare function UserMenu({ user, onLogout, onProfile, onSettings, className, }: UserMenuProps): React.JSX.Element;
export {};
//# sourceMappingURL=user-menu.d.ts.map