import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { AccountLayout } from "@/components/layout/AccountLayout";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { AppShell } from "@/components/layout/AppShell";
import { ThemeProvider } from "@/components/ui/ThemeProvider";
import { ChangePasswordPage } from "@/pages/account/ChangePasswordPage";
import { ProfilePage } from "@/pages/account/ProfilePage";
import { DashboardPage } from "@/pages/admin/DashboardPage";
import { EventsPage } from "@/pages/admin/EventsPage";
import { PaymentsPage } from "@/pages/admin/PaymentsPage";
import { QueueDashboardPage } from "@/pages/admin/QueueDashboardPage";
import { SeatEditorPage } from "@/pages/admin/SeatEditorPage";
import { UsersPage } from "@/pages/admin/UsersPage";
import { VenuesPage } from "@/pages/admin/VenuesPage";
import { LoginPage } from "@/pages/auth/LoginPage";
import { RegisterPage } from "@/pages/auth/RegisterPage";
import { CheckoutPage } from "@/pages/booking/CheckoutPage";
import { ConfirmationPage } from "@/pages/booking/ConfirmationPage";
import { SeatSelectionPage } from "@/pages/booking/SeatSelectionPage";
import { WaitingRoomPage } from "@/pages/booking/WaitingRoomPage";
import { MyTicketsPage } from "@/pages/customer/MyTicketsPage";
import { EventDetailPage } from "@/pages/public/EventDetailPage";
import { EventListPage } from "@/pages/public/EventListPage";
import { ProtectedRoute } from "@/routes/ProtectedRoute";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<EventListPage />} />
              <Route path="events/:id" element={<EventDetailPage />} />
              <Route path="login" element={<LoginPage />} />
              <Route path="register" element={<RegisterPage />} />

              <Route
                path="events/:id/book"
                element={
                  <ProtectedRoute>
                    <SeatSelectionPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="events/:id/queue"
                element={
                  <ProtectedRoute>
                    <WaitingRoomPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="checkout/:bookingId"
                element={
                  <ProtectedRoute>
                    <CheckoutPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="confirmation/:bookingId"
                element={
                  <ProtectedRoute>
                    <ConfirmationPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="tickets"
                element={
                  <ProtectedRoute>
                    <MyTicketsPage />
                  </ProtectedRoute>
                }
              />

              <Route path="account" element={<AccountLayout />}>
                <Route index element={<ProfilePage />} />
                <Route path="password" element={<ChangePasswordPage />} />
              </Route>

              <Route path="admin" element={<AdminLayout />}>
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<DashboardPage />} />
                <Route path="events" element={<EventsPage />} />
                <Route path="events/:id/seats" element={<SeatEditorPage />} />
                <Route path="events/:id/queue" element={<QueueDashboardPage />} />
                <Route path="venues" element={<VenuesPage />} />
                <Route path="users" element={<UsersPage />} />
                <Route path="payments" element={<PaymentsPage />} />
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
