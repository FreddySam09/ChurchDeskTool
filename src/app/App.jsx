
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AnnualRegister from "../features/membership/annual-register/AnnualRegister";
import { AuthProvider } from "../features/auth/AuthContext";
import LoginPage from "../features/auth/LoginPage";
import MembershipPage from "../features/membership/MembershipPage";
import MembershipDetailsPage from "../features/membership/MembershipDetailsPage";
import MemberList from "../features/membership/MemberList";
import MemberDetails from "../features/membership/MemberDetails";
import GroupsPage from "../features/groups/GroupsPage";
import EventsPage from "../features/events/EventsPage";
import ChristmasCarolsPage from "../features/events/ChristmasCarolsPage";
import CarolDayVisitsPage from "../features/events/CarolDayVisitsPage";
import CommunicationsPage from "../features/communications/CommunicationsPage";
import AppLayout from "../components/layout/AppLayout";
import ProtectedRoute from "./ProtectedRoute";
import LeadershipPage from "../features/leadership/LeadershipPage";
import ReportsPage from "../features/reports/ReportsPage";

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

          <Route path="/communications" element={<CommunicationsPage />} />

          <Route
            path="/events"
            element={<Navigate to="/events/church-calendar" replace />}
          />
          <Route path="/events/church-calendar" element={<EventsPage />} />
          <Route
            path="/events/christmas-carols"
            element={<ChristmasCarolsPage />}
          />
          <Route path="/events/special-events" element={<EventsPage />} />
          <Route
            path="/events/christmas-carols/:dayId/visits"
            element={<CarolDayVisitsPage />}
          />
          <Route path="/leadership" element={<LeadershipPage />} />
          <Route path="/reports" element={<ReportsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
