import { ShieldCheck, UserRound } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import s from "../Page.module.css";

export default function Profile() {
  const { user } = useAuth();
  return <div><div className={s.pageHead}><div><div className={s.eyebrow}>ACCOUNT SETTINGS</div><h1 className={s.title}>My profile</h1><p className={s.description}>Your current account details and workspace access.</p></div></div>
    <div className={s.formCard}><div className="profile-hero"><div className="profile-avatar">{(user?.name || "U").split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase()}</div><div><h2>{user?.name || "Workspace user"}</h2><p>{user?.email}</p></div></div><div className={s.formGrid} style={{ marginTop: 25 }}><div className={s.formField}><label>Full name</label><div className="readonly-field"><UserRound size={15} />{user?.name || "—"}</div></div><div className={s.formField}><label>Email address</label><div className="readonly-field">{user?.email || "—"}</div></div><div className={s.formField}><label>Workspace role</label><div className="readonly-field"><ShieldCheck size={15} />{user?.role || "—"}</div></div><div className={s.formField}><label>Organization ID</label><div className="readonly-field">{user?.orgId ?? "—"}</div></div></div><p className={s.helper}>Profile editing is not currently provided by the backend API, so these details are read-only.</p></div>
  </div>;
}
