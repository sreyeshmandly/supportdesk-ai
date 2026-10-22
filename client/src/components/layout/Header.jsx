import { Bell, ChevronDown, LogOut, Search, UserRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useState } from "react";
import styles from "./Layout.module.css";

export default function Header() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const initials = (user?.name || "User").split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase();
  return <header className={styles.header}>
    <div className={styles.breadcrumb}><span>Workspace</span><span className={styles.slash}>/</span><strong>Support operations</strong></div>
    <div className={styles.headerActions}>
      <div className={styles.searchHint}><Search size={16} /><span>Search is available on individual lists</span><kbd>/</kbd></div>
      <div className={styles.headerDivider} />
      <button className={styles.iconButton} title="Notifications are not yet connected to a backend endpoint" aria-label="Notifications"><Bell size={18} /><i /></button>
      <div className={styles.userMenuWrap}>
        <button className={styles.userMenu} onClick={() => setMenuOpen(!menuOpen)}><span className={styles.avatar}>{initials}</span><span className={styles.userInfo}><strong>{user?.name || "Workspace user"}</strong><small>{user?.role || "member"}</small></span><ChevronDown size={15} /></button>
        {menuOpen && <div className={styles.dropdown}><button onClick={() => { navigate("/profile"); setMenuOpen(false); }}><UserRound size={16} />My profile</button><button onClick={() => { logout(); navigate("/login", { replace: true }); }}><LogOut size={16} />Sign out</button></div>}
      </div>
    </div>
  </header>;
}
