import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import MonitorPage from "@/pages/MonitorPage";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MonitorPage />} />
      </Routes>
    </Router>
  );
}
