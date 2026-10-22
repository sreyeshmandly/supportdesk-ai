import { useState } from "react";
import { NavLink } from "react-router-dom";
import { Activity, BookOpenText, Bot, ChevronLeft, CircleHelp, LayoutDashboard, LifeBuoy, Users, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import styles from "./Layout.module.css";

const links = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { to: "/tickets", label: "Tickets", icon: LifeBuoy },
  { to: "/knowledge-base", label: "Knowledge base", icon: BookOpenText },
  { to: "/ai-assistant", label: "AI assistant", icon: Bot },
];

export default function Sidebar() {
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const items = user?.role === "admin" ? [...links, { to: "/users", label: "Team members", icon: Users }] : links;
  return <>
    <button className={styles.mobileMenu} onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle navigation">{mobileOpen ? <X size={20} /> : <CircleHelp size={20} />}</button>
    <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ""} ${mobileOpen ? styles.mobileOpen : ""}`}>
      <div className={styles.brand}><div className={styles.brandMark}><Activity size={21} /></div>{!collapsed && <div><strong>supportdesk<span>AI</span></strong><small>PRO WORKSPACE</small></div>}<button className={styles.collapse} onClick={() => setCollapsed(!collapsed)} aria-label="Collapse sidebar"><ChevronLeft size={16} /></button></div>
      {!collapsed && <div className={styles.orgLabel}>WORKSPACE</div>}
      <nav className={styles.nav}>
        {items.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} title={collapsed ? label : undefined} onClick={() => setMobileOpen(false)} className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ""}`}><Icon size={19} strokeWidth={1.8} /><span>{label}</span></NavLink>)}
      </nav>
      {!collapsed && <div className={styles.sidebarHelp}><div className={styles.helpIcon}><Bot size={18} /></div><strong>AI, working quietly</strong><p>Tickets are analyzed in the background so your team can focus on people.</p><NavLink to="/ai-assistant">Explore AI assistant <span>↗</span></NavLink></div>}
      <div className={styles.sidebarBottom}><div className={styles.onlineDot} />{!collapsed && <span>API-connected workspace</span>}</div>
    </aside>
    {mobileOpen && <button className={styles.scrim} onClick={() => setMobileOpen(false)} aria-label="Close navigation" />}
  </>;
}
