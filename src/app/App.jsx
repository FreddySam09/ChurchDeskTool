
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
import UsersPage from "../features/users/UsersPage";

function AccessDeniedPage() {
  return (
    <div className="mx-auto max-w-xl py-16 text-center">
      <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-500">
        <span className="text-2xl">!</span>
      </div>

      <h1 className="text-xl font-semibold text-gray-900">
        Access restricted
      </h1>

      <p className="mt-2 text-sm leading-6 text-gray-500">
        Your account does not have permission to access this page.
        Contact a church administrator if you believe this is a mistake.
      </p>

      <button
        type="button"
        onClick={() => window.history.back()}
        className="mt-6 rounded-lg bg-[#1e1e1e] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-black"
      >
        Go back
      </button>
    </div>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          {/* Access denied - available to all authenticated users */}
          <Route
            path="/access-denied"
            element={<AccessDeniedPage />}
          />

          {/* Membership */}
          <Route element={<ProtectedRoute workspace="membership" />}>
            <Route index element={<MembershipPage />} />

            <Route path="/members" element={<MemberList />} />

            <Route
              path="/members/:memberId"
              element={<MemberDetails />}
            />

            <Route
              path="/memberships/:membershipRowId"
              element={<MembershipDetailsPage />}
            />

            <Route
              path="/annual-register"
              element={<AnnualRegister />}
            />
          </Route>

          {/* Groups */}
          <Route element={<ProtectedRoute workspace="groups" />}>
            <Route path="/groups" element={<GroupsPage />} />
          </Route>

          {/* Communications */}
          <Route element={<ProtectedRoute workspace="communications" />}>
            <Route
              path="/communications"
              element={<CommunicationsPage />}
            />
          </Route>

          {/* Events */}
          <Route element={<ProtectedRoute workspace="events" />}>
            <Route
              path="/events"
              element={
                <Navigate
                  to="/events/church-calendar"
                  replace
                />
              }
            />

            <Route
              path="/events/church-calendar"
              element={<EventsPage />}
            />

            <Route
              path="/events/christmas-carols"
              element={<ChristmasCarolsPage />}
            />

            <Route
              path="/events/special-events"
              element={<EventsPage />}
            />

            <Route
              path="/events/christmas-carols/:dayId/visits"
              element={<CarolDayVisitsPage />}
            />
          </Route>

          {/* Leadership */}
          <Route element={<ProtectedRoute workspace="leadership" />}>
            <Route
              path="/leadership"
              element={<LeadershipPage />}
            />
          </Route>

          {/* Reports */}
          <Route element={<ProtectedRoute workspace="reports" />}>
            <Route
              path="/reports"
              element={<ReportsPage />}
            />
          </Route>

          {/* User administration */}
          <Route
            element={
              <ProtectedRoute
                allowedRoles={["Super Admin", "Admin"]}
              />
            }
          >
            <Route path="/users" element={<UsersPage />} />
          </Route>
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
