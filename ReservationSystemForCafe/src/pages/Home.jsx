import { Navigate } from 'react-router-dom';

export default function Home() {
  // Redirect root to Overview per new requirement
  return <Navigate to="/dashboard/overview" replace />;
}