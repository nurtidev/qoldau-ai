import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import { ToastProvider } from '@/components/Toast'
import { Header, AdminTopBar, AdminSidebar } from '@/components/Layout/Header'
import { Footer } from '@/components/Layout/Footer'
import { useIsBelowLaptop } from '@/hooks/useMediaQuery'

import { HomePage }             from '@/pages/HomePage'
import { ServicesPage }         from '@/pages/ServicesPage'
import { ServiceDetailPage }    from '@/pages/ServiceDetailPage'
import { CabinetDashboard }     from '@/pages/cabinet/DashboardPage'
import { ApplyPage }            from '@/pages/cabinet/ApplyPage'
import { ApplicationDetailPage } from '@/pages/cabinet/ApplicationDetailPage'
import { AdminDashboard }       from '@/pages/admin/AdminDashboard'
import { AdminServices }        from '@/pages/admin/AdminServices'
import { AdminApplications }    from '@/pages/admin/AdminApplications'
import { ServiceFormPage }      from '@/pages/admin/ServiceFormPage'
import { LoginPage }            from '@/pages/LoginPage'
import { KnowledgePage }        from '@/pages/KnowledgePage'
import { NewsPage }             from '@/pages/NewsPage'
import { ContactsPage }         from '@/pages/ContactsPage'
import { ProjectsMapPage }      from '@/pages/ProjectsMapPage'
import { AnalyticsCatalogPage } from '@/pages/AnalyticsCatalogPage'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore()
  if (!user) return <Navigate to="/" replace />
  return <>{children}</>
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore()
  if (!user) return <Navigate to="/" replace />
  if (user.role !== 'admin' && user.role !== 'author') return <Navigate to="/" replace />
  return <>{children}</>
}

function Shell() {
  const location = useLocation()
  const isAdmin = location.pathname.startsWith('/admin')
  const isBelowLaptop = useIsBelowLaptop()
  const [adminNavOpen, setAdminNavOpen] = useState(false)

  // Закрывать off-canvas сайдбар при смене маршрута
  useEffect(() => { setAdminNavOpen(false) }, [location.pathname])

  // Esc + блокировка скролла body, пока off-canvas сайдбар открыт
  useEffect(() => {
    if (!adminNavOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setAdminNavOpen(false) }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [adminNavOpen])

  const adminRoutes = (
    <>
      <Route path="/admin"                   element={<RequireAdmin><AdminDashboard /></RequireAdmin>} />
      <Route path="/admin/services"          element={<RequireAdmin><AdminServices /></RequireAdmin>} />
      <Route path="/admin/services/new"      element={<RequireAdmin><ServiceFormPage /></RequireAdmin>} />
      <Route path="/admin/services/:id/edit" element={<RequireAdmin><ServiceFormPage /></RequireAdmin>} />
      <Route path="/admin/applications"      element={<RequireAdmin><AdminApplications /></RequireAdmin>} />
    </>
  )

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {isAdmin
        ? <AdminTopBar showMenuButton={isBelowLaptop} onMenuClick={() => setAdminNavOpen(true)} />
        : <Header />}

      {isAdmin ? (
        <div style={{ display: 'flex', flex: 1 }}>
          <AdminSidebar offCanvas={isBelowLaptop} open={adminNavOpen} onClose={() => setAdminNavOpen(false)} />
          <main style={{ flex: 1, minWidth: 0, background: 'var(--color-bg)', overflow: 'hidden' }}>
            <Routes>{adminRoutes}</Routes>
          </main>
        </div>
      ) : (
        <main style={{ flex: 1 }}>
          <Routes>
            <Route path="/"           element={<HomePage />} />
            <Route path="/services"   element={<ServicesPage />} />
            <Route path="/services/:id" element={<ServiceDetailPage />} />
            <Route path="/login"      element={<LoginPage />} />
            <Route path="/knowledge"  element={<KnowledgePage />} />
            <Route path="/projects-map" element={<ProjectsMapPage />} />
            <Route path="/analytics"  element={<AnalyticsCatalogPage />} />
            <Route path="/news"       element={<NewsPage />} />
            <Route path="/contacts"   element={<ContactsPage />} />
            <Route path="/cabinet"    element={<RequireAuth><CabinetDashboard /></RequireAuth>} />
            <Route path="/cabinet/apply/:service_id" element={<RequireAuth><ApplyPage /></RequireAuth>} />
            <Route path="/cabinet/applications/:id"  element={<RequireAuth><ApplicationDetailPage /></RequireAuth>} />
            {adminRoutes}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      )}

      {!isAdmin && <Footer />}
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <Shell />
      </ToastProvider>
    </BrowserRouter>
  )
}
