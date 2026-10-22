import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Header from "./Header";
import styles from "./Layout.module.css";

export default function AppLayout() {
  return <div className={styles.shell}><Sidebar /><div className={styles.main}><Header /><main className={styles.content}><Outlet /></main><footer className={styles.footer}>SupportDesk AI Pro <span>Built for support teams that move fast.</span></footer></div></div>;
}
