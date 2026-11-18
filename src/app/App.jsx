import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

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

function DashboardPage() {
  return (
    <div className="mx-auto w-full max-w-[1400px] p-5 sm:p-7 lg:p-9">
      <div className="mb-8">
        <p className="text-sm font-medium text-gray-500">
          Church Desk / Overview
        </p>

        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-gray-900 sm:text-3xl">
          Dashboard
        </h1>

        <p className="mt-2 text-sm text-gray-500">
          Welcome to Church Desk. Your workspace overview will appear here.
        </p>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 text-xl">
          <span>✦</span>
        </div>

        <h2 className="mt-5 text-lg font-semibold text-gray-900">
          Your dashboard is getting ready
        </h2>

        <p className="mt-2 max-w-xl text-sm leading-6 text-gray-500">
          This is the central dashboard for Church Desk. Updates, summaries,
          and useful shortcuts will be added here.
        </p>
      </div>
    </div>
  );
}

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
          <Route
            path="/access-denied"
            element={<AccessDeniedPage />}
          />

          <Route index element={<DashboardPage />} />

          {/* General membership access: full and read-only roles */}
          <Route
            element={
              <ProtectedRoute workspace="membership" />
            }
          >
            <Route
              path="/membership"
              element={<MembershipPage />}
            />

            <Route
              path="/members"
              element={<MemberList />}
            />

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

          {/* Restricted membership directory for Others */}
          <Route
            element={
              <ProtectedRoute
                workspace="membership"
                allowRestricted
              />
            }
          >
            <Route
              path="/restricted-members"
              element={<MemberList restrictedView />}
            />
          </Route>

          {/* Fellowship Leaders and other permitted roles */}
          <Route
            element={
              <ProtectedRoute workspace="groups" />
            }
          >
            <Route
              path="/groups"
              element={<GroupsPage />}
            />
          </Route>

          {/* Communications */}
          <Route
            element={
              <ProtectedRoute workspace="communications" />
            }
          >
            <Route
              path="/communications"
              element={<CommunicationsPage />}
            />
          </Route>

          {/* Events */}
          <Route
            element={
              <ProtectedRoute workspace="events" />
            }
          >
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
          <Route
            element={
              <ProtectedRoute workspace="leadership" />
            }
          >
            <Route
              path="/leadership"
              element={<LeadershipPage />}
            />
          </Route>

          {/* Reports */}
          <Route
            element={
              <ProtectedRoute workspace="reports" />
            }
          >
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
            <Route
              path="/users"
              element={<UsersPage />}
            />
          </Route>
        </Route>
      </Route>

      <Route
        path="*"
        element={<Navigate to="/" replace />}
      />
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