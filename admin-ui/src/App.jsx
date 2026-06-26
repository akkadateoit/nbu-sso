import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Layout   from './components/Layout'
import Dashboard from './pages/Dashboard'
import Apps      from './pages/Apps'
import Users     from './pages/Users'
import AuditLog  from './pages/AuditLog'
import Callback  from './pages/Callback'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename="/admin">
        <Routes>
          <Route path="/callback" element={<Callback />} />
          <Route element={<Layout />}>
            <Route index        element={<Dashboard />} />
            <Route path="apps"  element={<Apps />} />
            <Route path="users" element={<Users />} />
            <Route path="audit" element={<AuditLog />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
