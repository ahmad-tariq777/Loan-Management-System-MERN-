import { useState, useEffect } from "react";
import { NavLink, Link, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard, FilePlus, FileText, CalendarClock, Receipt, UserCircle,
  ClipboardList, FolderCheck, Users, AlertTriangle, BarChart3, ShieldCheck,
  UserCog, Package, ScrollText, Bell, LogOut, Menu, ArrowLeft, Building2,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { notificationService } from "../services/api";

const navByRole = {
  applicant: [
    { group: "Home", links: [{ to: "/dashboard", label: "Dashboard", icon: LayoutDashboard }] },
    {
      group: "Loans",
      links: [
        { to: "/apply-loan", label: "Apply for Loan", icon: FilePlus },
        { to: "/my-loans", label: "My Loans", icon: FileText },
        { to: "/my-installments", label: "Installments", icon: CalendarClock },
        { to: "/payments", label: "Payments", icon: Receipt },
      ],
    },
    { group: "Account", links: [{ to: "/profile", label: "My Profile", icon: UserCircle }] },
  ],
  officer: [
    { group: "Home", links: [{ to: "/dashboard", label: "Dashboard", icon: LayoutDashboard }] },
    {
      group: "Review Work",
      links: [
        { to: "/pending-loans", label: "Pending Loans", icon: ClipboardList },
        { to: "/documents", label: "Documents", icon: FolderCheck },
        { to: "/loans", label: "All Loans", icon: FileText },
        { to: "/applicants", label: "Applicants", icon: Users },
      ],
    },
    {
      group: "Collections",
      links: [
        { to: "/overdue", label: "Overdue", icon: AlertTriangle },
        { to: "/payments", label: "Payments", icon: Receipt },
      ],
    },
    {
      group: "Insights",
      links: [{ to: "/reports", label: "Reports", icon: BarChart3 }],
    },
    { group: "Account", links: [{ to: "/profile", label: "My Account", icon: UserCircle }] },
  ],
  admin: [
    { group: "Home", links: [{ to: "/dashboard", label: "Dashboard", icon: LayoutDashboard }] },
    {
      group: "Review Work",
      links: [
        { to: "/pending-loans", label: "Pending Loans", icon: ClipboardList },
        { to: "/documents", label: "Documents", icon: FolderCheck },
        { to: "/loans", label: "All Loans", icon: FileText },
        { to: "/applicants", label: "Applicants", icon: Users },
      ],
    },
    {
      group: "Collections",
      links: [
        { to: "/overdue", label: "Overdue", icon: AlertTriangle },
        { to: "/payments", label: "Payments", icon: Receipt },
      ],
    },
    {
      group: "Insights",
      links: [{ to: "/reports", label: "Reports", icon: BarChart3 }],
    },
    {
      group: "Administration",
      links: [
        { to: "/users", label: "Users", icon: UserCog },
        { to: "/officers", label: "Officers", icon: ShieldCheck },
        { to: "/products", label: "Loan Products", icon: Package },
        { to: "/audit-logs", label: "Audit Logs", icon: ScrollText },
      ],
    },
    { group: "Account", links: [{ to: "/profile", label: "My Account", icon: UserCircle }] },
  ],
};

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    notificationService
      .getAll({ unread: "true", limit: 1 })
      .then((res) => setUnread(res.data.unreadCount || 0))
      .catch(() => {});
  }, [location.pathname]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const groups = navByRole[user?.role] || [];
  const isHome = location.pathname === "/dashboard";

  return (
    <div className="layout">
      <aside className={`layout__sidebar ${sidebarOpen ? "layout__sidebar--open" : ""}`}>
        <Link to="/dashboard" className="layout__brand">
          <span className="layout__brand-icon">
            <Building2 size={18} />
          </span>
          <span className="layout__brand-text">
            <span className="layout__brand-name">Akhuwat LMS</span>
            <span className="layout__brand-role">{user?.role}</span>
          </span>
        </Link>

        <nav className="layout__nav" aria-label="Main navigation">
          {groups.map((group) => (
            <div key={group.group} className="layout__nav-group">
              <p className="layout__nav-label">{group.group}</p>
              {group.links.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) => `layout__nav-link ${isActive ? "layout__nav-link--active" : ""}`}
                >
                  <Icon size={16} className="layout__nav-icon" />
                  <span className="layout__nav-text">{label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="layout__sidebar-footer">
          <NavLink
            to="/notifications"
            className={({ isActive }) => `layout__nav-link ${isActive ? "layout__nav-link--active" : ""}`}
          >
            <Bell size={16} className="layout__nav-icon" />
            <span className="layout__nav-text">Notifications</span>
            {unread > 0 && <span className="layout__badge">{unread}</span>}
          </NavLink>
          <button type="button" className="layout__signout" onClick={handleLogout}>
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {sidebarOpen && <div className="layout__overlay" onClick={() => setSidebarOpen(false)} />}

      <div className="layout__body">
        <header className="layout__header">
          <button type="button" className="layout__menu-btn" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
            <Menu size={18} />
          </button>
          {!isHome && (
            <button type="button" className="layout__back-btn" onClick={() => navigate(-1)}>
              <ArrowLeft size={16} />
              <span>Back</span>
            </button>
          )}
          <div className="layout__header-spacer" />
          <Link to="/notifications" className="layout__bell" aria-label="Notifications">
            <Bell size={18} />
            {unread > 0 && <span className="layout__badge">{unread}</span>}
          </Link>
          <Link to="/profile" className="layout__header-user">
            <span className="layout__user-info">
              <span className="layout__user-name">{user?.name}</span>
              <span className="layout__user-email">{user?.email}</span>
            </span>
            <span className="layout__avatar">{user?.name?.charAt(0).toUpperCase()}</span>
          </Link>
        </header>

        <main className="layout__main">{children}</main>
      </div>
    </div>
  );
}
