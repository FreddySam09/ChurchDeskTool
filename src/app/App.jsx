
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from 'react-router-dom'
import AnnualRegister from "../features/membership/annual-register/AnnualRegister";
import { AuthProvider } from '../features/auth/AuthContext'
import LoginPage from '../features/auth/LoginPage'
import MembershipPage from '../features/membership/MembershipPage'
import MembershipDetailsPage from '../features/membership/MembershipDetailsPage'
import MemberList from '../features/membership/MemberList'
import MemberDetails from '../features/membership/MemberDetails'
import GroupsPage from '../features/groups/GroupsPage'

import AppLayout from '../components/layout/AppLayout'
import ProtectedRoute from './ProtectedRoute'

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<MembershipPage />} />
          <Route path="/members" element={<MemberList />} />
          <Route path="/members/:memberId" element={<MemberDetails />} />
          <Route path="/groups" element={<GroupsPage />} />
          <Route path="/annual-register" element={<AnnualRegister />} />

          <Route
            path="/memberships/:membershipRowId"
            element={<MembershipDetailsPage />}
          />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
